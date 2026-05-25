from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from pipeline.embedder import embed_batch
from pipeline.enricher import enrich_record
from pipeline.schema import normalize_concept_record, normalize_formula_record, normalize_question_record
from pipeline.sources.huggingface_connector import (
    HUGGINGFACE_DATASETS,
    download_hf_dataset,
    search_huggingface_for_subject,
)
from pipeline.sources.local_compiled_connector import (
    load_local_compiled_questions,
    load_local_concepts,
    load_local_formulas,
)
from pipeline.sources.syllabus_scraper import get_syllabus_topics
from pipeline.sources.web_scraper import scrape_formulas, scrape_subject_papers
from pipeline.storage import (
    complete_pipeline_run,
    save_for_review,
    start_pipeline_run,
    upsert_to_supabase,
    write_output_rows,
)
from pipeline.subjects import YEARS, SUBJECT_REGISTRY, canonical_level_name, iter_subjects
from pipeline.utils import (
    OUTPUT_DIR,
    build_exam_tips,
    logger,
    looks_like_broken_ocr,
    read_jsonl,
    sha256_text,
    utc_now_iso,
)
from pipeline.verifier import attempt_auto_fix, validate_structure, verify_formula, verify_record


@dataclass
class PipelineStats:
    collected: int = 0
    verified: int = 0
    auto_fixed: int = 0
    enriched: int = 0
    embedded: int = 0
    skipped: int = 0
    needs_review: int = 0
    raw_sources: int = 0
    errors: list[str] = field(default_factory=list)

    def report(self) -> str:
        return json.dumps(
            {
                "collected": self.collected,
                "verified": self.verified,
                "auto_fixed": self.auto_fixed,
                "enriched": self.enriched,
                "embedded": self.embedded,
                "skipped": self.skipped,
                "needs_review": self.needs_review,
                "raw_sources": self.raw_sources,
                "errors": len(self.errors),
            },
            indent=2,
        )

    def as_payload(self) -> dict[str, Any]:
        return {
            "completed_at": utc_now_iso(),
            "collected": self.collected,
            "verified": self.verified,
            "auto_fixed": self.auto_fixed,
            "skipped": self.skipped,
            "needs_review": self.needs_review,
            "errors": self.errors,
        }


def _dedupe_records(records: list[dict[str, Any]], key_fields: tuple[str, ...]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for record in records:
        identity = "||".join(str(record.get(field) or "") for field in key_fields)
        record_hash = sha256_text(identity)
        if record_hash in seen:
            continue
        seen.add(record_hash)
        record["content_hash"] = record_hash
        record["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, record_hash))
        unique.append(record)
    return unique


def _quality_gate_report(
    question_rows: list[dict[str, Any]],
    formula_rows: list[dict[str, Any]],
    concept_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    broken_ocr = [row.get("id") for row in question_rows if looks_like_broken_ocr(str(row.get("question", "")))]
    invalid_years = [
        row.get("id")
        for row in question_rows
        if row.get("year") is None or not (2014 <= int(row.get("year")) <= 2024)
    ]
    empty_question_or_answer = [
        row.get("id")
        for row in question_rows
        if not str(row.get("question") or "").strip() or not str(row.get("answer") or "").strip()
    ]
    missing_formula_latex = [row.get("id") for row in formula_rows if not str(row.get("latex") or "").strip()]
    weak_concepts = [
        row.get("id")
        for row in concept_rows
        if len([tip for tip in (row.get("exam_tips") or []) if str(tip).strip()]) < 2
    ]
    null_embeddings = [
        row.get("id")
        for row in [*question_rows, *formula_rows, *concept_rows]
        if not row.get("embedding")
    ]

    checks = {
        "no_broken_ocr_pattern": {"passed": len(broken_ocr) == 0, "count": len(broken_ocr), "sample_ids": broken_ocr[:10]},
        "years_within_2014_2024": {"passed": len(invalid_years) == 0, "count": len(invalid_years), "sample_ids": invalid_years[:10]},
        "no_empty_question_or_answer": {
            "passed": len(empty_question_or_answer) == 0,
            "count": len(empty_question_or_answer),
            "sample_ids": empty_question_or_answer[:10],
        },
        "formula_rows_have_latex": {
            "passed": len(missing_formula_latex) == 0,
            "count": len(missing_formula_latex),
            "sample_ids": missing_formula_latex[:10],
        },
        "concept_rows_have_two_exam_tips": {
            "passed": len(weak_concepts) == 0,
            "count": len(weak_concepts),
            "sample_ids": weak_concepts[:10],
        },
        "zero_null_embeddings": {"passed": len(null_embeddings) == 0, "count": len(null_embeddings), "sample_ids": null_embeddings[:10]},
    }

    return {
        "generated_at": utc_now_iso(),
        "question_rows": len(question_rows),
        "formula_rows": len(formula_rows),
        "concept_rows": len(concept_rows),
        "checks": checks,
    }


async def _collect_questions(board: str, level: str, subject: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    question_records = load_local_compiled_questions(subject["name"], board, level)
    raw_sources: list[dict[str, Any]] = []

    for dataset_id in HUGGINGFACE_DATASETS[:3]:
        question_records.extend(download_hf_dataset(dataset_id, subject["name"], board, level, limit=100))

    for dataset_id in search_huggingface_for_subject(subject["name"])[:2]:
        question_records.extend(download_hf_dataset(dataset_id, subject["name"], board, level, limit=75))

    for year in YEARS:
        try:
            raw_sources.extend(await scrape_subject_papers(board, level, subject, year))
            await asyncio.sleep(1)
        except Exception as exc:
            logger.warning(f"Paper scrape failed for {subject['name']} {year}: {exc}")
    return question_records, raw_sources


def _collect_concepts_and_formulas(board: str, level: str, subject: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    concepts = load_local_concepts(subject["name"], board, level)
    formulas = load_local_formulas(subject["name"], board, level)

    for topic in get_syllabus_topics(subject["code"], level):
        concepts.append(
            normalize_concept_record(
                {
                    "subject": subject["name"],
                    "topic": topic["topic"],
                    "concept_name": topic["topic"],
                    "definition": f"Official syllabus topic for {subject['name']}.",
                    "explanation": f"Syllabus topic extracted from Cambridge official materials: {topic['topic']}.",
                    "examples": [],
                    "common_mistakes": [],
                    "exam_tips": build_exam_tips(subject["name"], topic["topic"], board, level, []),
                    "level": level,
                    "board": board,
                    "source": "cambridge:official_syllabus",
                    "verified": True,
                }
            )
        )

    formulas.extend(scrape_formulas(subject["name"]))
    return concepts, formulas


def _verify_question_bucket(records: list[dict[str, Any]], stats: PipelineStats) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for record in records:
        try:
            result = verify_record(normalize_question_record(record))
            if result.get("verified"):
                verified.append(result)
                stats.verified += 1
                continue
            if result.get("needs_review"):
                save_for_review(result, result.get("verification_notes", "needs_review"))
                stats.needs_review += 1
                continue
            fixed = attempt_auto_fix(result)
            if fixed:
                retried = verify_record(normalize_question_record(fixed))
                if retried.get("verified"):
                    verified.append(retried)
                    stats.auto_fixed += 1
                    stats.verified += 1
                    continue
            stats.skipped += 1
        except Exception as exc:
            stats.errors.append(str(exc))
            logger.error(f"Question verification failed: {exc}")
    return verified


def _verify_formula_bucket(records: list[dict[str, Any]], stats: PipelineStats) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for record in records:
        result = verify_formula(normalize_formula_record(record))
        if result.fixed_content:
            record.update(result.fixed_content)
        record["verified"] = result.passed
        record["verification_score"] = result.score
        if result.passed:
            verified.append(record)
            stats.verified += 1
        else:
            stats.needs_review += 1
            save_for_review(record, "; ".join(result.issues or ["formula_verify_failed"]))
    return verified


def _verify_concept_bucket(records: list[dict[str, Any]], stats: PipelineStats) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for record in records:
        structure = validate_structure(
            {
                "question": record.get("definition") or record.get("explanation"),
                "answer": record.get("explanation"),
                "subject": record.get("subject"),
                "board": record.get("board"),
                "level": record.get("level"),
                "year": 2014,
                "topic": record.get("topic"),
            },
            {},
        )
        record["verified"] = structure.score >= 0.6
        record["verification_score"] = structure.score
        if record["verified"]:
            verified.append(record)
            stats.verified += 1
        else:
            stats.needs_review += 1
            save_for_review(record, "; ".join(structure.issues or ["concept_verify_failed"]))
    return verified


async def process_subject(
    board: str, level: str, subject: dict[str, Any], stats: PipelineStats
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    logger.info(f"Starting pipeline for {board} {level} {subject['name']}")
    questions, raw_sources = await _collect_questions(board, level, subject)
    concepts, formulas = _collect_concepts_and_formulas(board, level, subject)

    questions = _dedupe_records(questions, ("question", "answer", "source"))
    concepts = _dedupe_records(concepts, ("subject", "topic", "concept_name", "source"))
    formulas = _dedupe_records(formulas, ("subject", "topic", "formula_text", "source"))

    stats.collected += len(questions) + len(concepts) + len(formulas)
    stats.raw_sources += len(raw_sources)

    verified_questions = _verify_question_bucket(questions, stats)
    verified_formulas = _verify_formula_bucket(formulas, stats)
    verified_concepts = _verify_concept_bucket(concepts, stats)

    enriched_questions: list[dict[str, Any]] = []
    for record in verified_questions:
        enriched_questions.append(await enrich_record(record))
        stats.enriched += 1

    await embed_batch(enriched_questions)
    await embed_batch(verified_formulas)
    await embed_batch(verified_concepts)
    stats.embedded += len(enriched_questions) + len(verified_formulas) + len(verified_concepts)

    subject_slug = subject["name"].lower().replace(" ", "_")
    board_slug = board.lower()
    level_slug = level.lower().replace(" ", "_")

    write_output_rows(OUTPUT_DIR / f"{board_slug}_{level_slug}_{subject_slug}_questions.jsonl", enriched_questions)
    write_output_rows(OUTPUT_DIR / f"{board_slug}_{level_slug}_{subject_slug}_concepts.jsonl", verified_concepts)
    write_output_rows(OUTPUT_DIR / f"{board_slug}_{level_slug}_{subject_slug}_formulas.jsonl", verified_formulas)
    write_output_rows(OUTPUT_DIR / "raw_sources" / f"{board_slug}_{level_slug}_{subject_slug}_sources.jsonl", raw_sources)

    upsert_to_supabase(enriched_questions, "qbank_chunks", conflict="content_hash")
    upsert_to_supabase(verified_formulas, "formula_bank", conflict="id")
    upsert_to_supabase(verified_concepts, "concept_bank", conflict="id")
    logger.info(f"Completed {board} {level} {subject['name']}: {len(enriched_questions)} question rows")
    return enriched_questions, verified_formulas, verified_concepts


async def main_async(board: str | None, level: str | None, subject_name: str | None) -> PipelineStats:
    stats = PipelineStats()
    started_at = utc_now_iso()
    current_run_questions: list[dict[str, Any]] = []
    current_run_formulas: list[dict[str, Any]] = []
    current_run_concepts: list[dict[str, Any]] = []
    run_id = start_pipeline_run(
        {
            "started_at": started_at,
            "board": board,
            "level": level,
            "subject": subject_name,
        }
    )
    logger.info("ScholarHAAB Dataset Pipeline - Starting")
    for board_key, level_key, subject in iter_subjects(board, level, subject_name):
        try:
            subject_questions, subject_formulas, subject_concepts = await process_subject(
                board_key.capitalize(), canonical_level_name(level_key), subject, stats
            )
            current_run_questions.extend(subject_questions)
            current_run_formulas.extend(subject_formulas)
            current_run_concepts.extend(subject_concepts)
        except Exception as exc:
            logger.error(f"Subject pipeline crashed for {board_key} {level_key} {subject['name']}: {exc}")
            stats.errors.append(f"{board_key}:{level_key}:{subject['name']}:{exc}")
    quality_report = _quality_gate_report(current_run_questions, current_run_formulas, current_run_concepts)
    write_output_rows(OUTPUT_DIR / "pipeline_run_summary.jsonl", [{"report": stats.report(), "quality_gate_report": quality_report}])
    write_output_rows(OUTPUT_DIR / "quality_gate_report.jsonl", [quality_report])
    (OUTPUT_DIR / "quality_gate_report.json").write_text(json.dumps(quality_report, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUTPUT_DIR / "errors.json").write_text(json.dumps(stats.errors, indent=2, ensure_ascii=False), encoding="utf-8")
    complete_pipeline_run(run_id, {**stats.as_payload(), "quality_gate_report": quality_report})
    logger.info(f"Pipeline complete\n{stats.report()}")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="ScholarHAAB dataset pipeline orchestrator")
    parser.add_argument("--board")
    parser.add_argument("--level", choices=["o_level", "a_level"])
    parser.add_argument("--subject")
    args = parser.parse_args()
    asyncio.run(main_async(args.board, args.level, args.subject))


if __name__ == "__main__":
    main()
