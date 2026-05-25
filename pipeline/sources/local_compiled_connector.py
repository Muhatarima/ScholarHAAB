from __future__ import annotations

from pathlib import Path
import re
from typing import Any

from pipeline.schema import normalize_concept_record, normalize_formula_record, normalize_question_record
from pipeline.subjects import YEARS
from pipeline.utils import (
    ROOT_DIR,
    build_exam_tips,
    looks_like_formula_candidate,
    looks_like_noisy_source_text,
    read_jsonl,
    safe_fix_text,
    unique_clean_strings,
)

COMPILED_QBANK_PATH = ROOT_DIR / "data" / "qbank_compiled" / "qbank_question_bank_feed_safe.jsonl"
CONCEPT_GLOB = ROOT_DIR / "data"


def _matches_subject_year(row: dict[str, Any], subject: str, years: list[int]) -> bool:
    if row.get("subject", "").lower() != subject.lower():
        return False
    year = row.get("year")
    return year in years if isinstance(year, int) else True


def _pick_question_answer(row: dict[str, Any]) -> str:
    answer = safe_fix_text(str(row.get("answer") or ""))
    if answer:
        return answer
    question = safe_fix_text(str(row.get("question_text") or ""))
    solution = safe_fix_text(str(row.get("solution") or ""))
    if not solution or not _has_meaningful_overlap(question, solution):
        return ""
    return solution[:500]


def _has_meaningful_overlap(question: str, candidate: str) -> bool:
    question_tokens = {token for token in re.findall(r"[A-Za-z]{4,}", question.lower())}
    candidate_tokens = {token for token in re.findall(r"[A-Za-z]{4,}", candidate.lower())}
    if not question_tokens or not candidate_tokens:
        return False
    overlap = question_tokens & candidate_tokens
    return len(overlap) >= 2


def _clean_list(values: list[Any] | None, max_items: int = 3) -> list[str]:
    return unique_clean_strings(values or [], max_items=max_items)


def _is_generic_past_paper_row(row: dict[str, Any]) -> bool:
    topic = safe_fix_text(str(row.get("topic") or "")).lower()
    summary = safe_fix_text(str(row.get("conceptSummary") or ""))
    source_labels = " ".join(row.get("sourceLabels") or []).lower()
    if topic in {"past paper", "question paper", "official past paper", "source paper"}:
        return True
    if summary.lower().startswith("past paper is a recurring"):
        return True
    return "question paper" in source_labels and not row.get("examTips")


def _is_low_signal_concept_row(row: dict[str, Any]) -> bool:
    if _is_generic_past_paper_row(row):
        return True
    summary = safe_fix_text(str(row.get("conceptSummary") or ""))
    topic = safe_fix_text(str(row.get("topic") or ""))
    if not summary or not topic:
        return True
    if looks_like_noisy_source_text(topic):
        return True
    if looks_like_noisy_source_text(summary):
        return True
    joined_patterns = " ".join(str(item) for item in (row.get("answerPatterns") or [])[:2])
    if "Official answer span not linked yet" in joined_patterns and not row.get("examTips"):
        return True
    return False


def _build_concept_examples(row: dict[str, Any]) -> list[str]:
    examples = []
    for value in row.get("questionExamples") or []:
        cleaned = safe_fix_text(str(value or ""))
        if not cleaned or looks_like_noisy_source_text(cleaned):
            continue
        examples.append(cleaned[:240])
        if len(examples) >= 3:
            break
    return unique_clean_strings(examples, max_items=3)


def _build_common_mistakes(row: dict[str, Any]) -> list[str]:
    cleaned_patterns = []
    for value in row.get("answerPatterns") or []:
        cleaned = safe_fix_text(str(value or ""))
        if not cleaned or looks_like_noisy_source_text(cleaned):
            continue
        if "Official answer span not linked yet" in cleaned:
            continue
        cleaned_patterns.append(cleaned[:220])
        if len(cleaned_patterns) >= 3:
            break
    return unique_clean_strings(cleaned_patterns, max_items=3)


def _normalize_formula_text(value: str) -> str:
    cleaned = safe_fix_text(value)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def load_local_compiled_questions(
    subject: str, board: str, level: str, years: list[int] | None = None
) -> list[dict[str, Any]]:
    years = years or YEARS
    rows = read_jsonl(COMPILED_QBANK_PATH)
    normalized: list[dict[str, Any]] = []
    for row in rows:
        if row.get("board", "").lower() != board.lower():
            continue
        if row.get("level", "").lower() != level.lower():
            continue
        if not _matches_subject_year(row, subject, years):
            continue
        answer = _pick_question_answer(row)
        question_text = safe_fix_text(str(row.get("question_text") or ""))
        if not question_text or not answer:
            continue
        normalized.append(
            normalize_question_record(
                {
                    "id": "",
                    "content_hash": "",
                    "board": row.get("board"),
                    "level": row.get("level"),
                    "subject": row.get("subject"),
                    "subject_code": row.get("subject_code", ""),
                    "topic": row.get("topic", "General"),
                    "subtopic": row.get("subtopic", ""),
                    "year": row.get("year"),
                    "session": row.get("session", ""),
                    "paper_number": row.get("paper_number"),
                    "question_number": row.get("question_number"),
                    "question": question_text,
                    "answer": answer,
                    "worked_solution": row.get("solution") or "",
                    "marks": row.get("marks"),
                    "question_type": row.get("question_type") or "structured",
                    "formulas_used": row.get("formulas_used") or [],
                    "concepts_used": row.get("concepts_used") or [row.get("topic", "General")],
                    "reasoning_steps": row.get("reasoning_steps") or [],
                    "source": row.get("source_url") or row.get("source_pdf") or "local:compiled_qbank",
                    "verified": bool(row.get("ready_for_feed")),
                    "verification_score": 0.95 if row.get("ready_for_feed") else 0.5,
                    "verification_notes": "; ".join(row.get("validator_issues") or []),
                    "ocr_quality": 1.0,
                }
            )
        )
    return normalized


def _iter_concept_files() -> list[Path]:
    return sorted(CONCEPT_GLOB.glob("qbank_concept*.jsonl"))


def load_local_concepts(subject: str, board: str | None = None, level: str | None = None) -> list[dict[str, Any]]:
    concepts: list[dict[str, Any]] = []
    for path in _iter_concept_files():
        for row in read_jsonl(path):
            if row.get("subject", "").lower().find(subject.lower()) == -1:
                continue
            if board and row.get("board", "").lower() != board.lower():
                continue
            if level and row.get("level", "").lower() != level.lower():
                continue
            if _is_low_signal_concept_row(row):
                continue
            topic = safe_fix_text(str(row.get("topic") or "General"))
            concept_name = safe_fix_text(str(row.get("topic") or row.get("chapter") or "Concept"))
            summary = safe_fix_text(str(row.get("conceptSummary") or concept_name))
            exam_tips = build_exam_tips(
                str(row.get("subject") or subject),
                topic,
                str(row.get("board") or board or ""),
                str(row.get("level") or level or ""),
                row.get("examTips") or [],
            )
            concepts.append(
                normalize_concept_record(
                    {
                        "id": "",
                        "subject": row.get("subject"),
                        "topic": topic,
                        "concept_name": concept_name,
                        "definition": summary,
                        "explanation": summary,
                        "examples": _build_concept_examples(row),
                        "common_mistakes": _build_common_mistakes(row),
                        "exam_tips": exam_tips,
                        "level": row.get("level"),
                        "board": row.get("board"),
                        "source": (row.get("sourceLabels") or ["local:concept_seed"])[0],
                        "verified": True,
                    }
                )
            )
    return concepts


def load_local_formulas(subject: str, board: str | None = None, level: str | None = None) -> list[dict[str, Any]]:
    formulas: list[dict[str, Any]] = []
    for path in _iter_concept_files():
        for row in read_jsonl(path):
            if row.get("subject", "").lower().find(subject.lower()) == -1:
                continue
            if board and row.get("board", "").lower() != board.lower():
                continue
            if level and row.get("level", "").lower() != level.lower():
                continue
            source_labels = " ".join(row.get("sourceLabels") or []).lower()
            topic = safe_fix_text(str(row.get("topic") or "General"))
            if "question paper" in source_labels or topic.lower() == "past paper":
                continue
            for formula in row.get("formulaCandidates") or []:
                formula_text = _normalize_formula_text(str(formula or ""))
                if not looks_like_formula_candidate(formula_text):
                    continue
                formulas.append(
                    normalize_formula_record(
                        {
                            "subject": row.get("subject"),
                            "topic": topic,
                            "formula_text": formula_text,
                            "latex": formula_text,
                            "variables": {},
                            "conditions": "",
                            "level": row.get("level"),
                            "board": row.get("board"),
                            "source": (row.get("sourceLabels") or ["local:concept_seed"])[0],
                            "verified": True,
                        }
                    )
                )
    return formulas
