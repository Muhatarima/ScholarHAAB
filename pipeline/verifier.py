from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pipeline.schema import QUESTION_REQUIRED_FIELDS, QUESTION_SCHEMA, missing_required_fields
from pipeline.storage import read_review_queue, save_for_review, write_output_rows
from pipeline.utils import (
    OUTPUT_DIR,
    alpha_ratio,
    clean_ocr_spacing,
    logger,
    looks_like_formula_candidate,
    looks_like_broken_ocr,
    read_jsonl,
    safe_float,
    safe_int,
    utc_now_iso,
)

_MODEL = None

VERIFY_PROMPT = """
You are a Cambridge/Edexcel exam expert. Verify this exam content.
Return ONLY valid JSON. No other text.

Content to verify:
Subject: {subject}
Level: {level}
Board: {board}
Year: {year}
Topic: {topic}
Question: {question}
Answer: {answer}

Check ALL of the following:
1. Is the question grammatically correct and complete?
2. Is the answer factually correct for {subject} at {level}?
3. Is this appropriate for {board} {level} level?
4. Are any formulas or equations in the answer correct?
5. Is the topic classification correct for this question?
6. Does the question match the stated year/board style?

Return this exact JSON:
{{
  "factually_correct": true,
  "grammar_correct": true,
  "level_appropriate": true,
  "formulas_correct": true,
  "topic_matches": true,
  "overall_score": 0.0,
  "issues_found": ["issue"],
  "corrected_question": null,
  "corrected_answer": null,
  "reasoning": "brief explanation"
}}
"""

FORMULA_VERIFY_PROMPT = """
You are a physics/chemistry/math expert.
Verify this formula is correct for {subject} {level}.
Return ONLY JSON:
{{
  "formula_correct": true,
  "latex_correct": true,
  "variables_defined": true,
  "corrected_formula": null,
  "corrected_latex": null,
  "notes": "important conditions"
}}
"""


@dataclass
class VerificationResult:
    passed: bool
    score: float
    issues: list[str]
    fixed_content: dict[str, Any] | None
    needs_human: bool


def get_gemini_model():
    global _MODEL
    if _MODEL is False:
        return None
    if _MODEL is not None:
        return _MODEL
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        _MODEL = False
        return None
    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=api_key)
        _MODEL = genai.GenerativeModel("gemini-1.5-flash")
        return _MODEL
    except Exception as exc:
        logger.warning(f"Gemini model unavailable for verification: {exc}")
        _MODEL = False
        return None


def validate_structure(record: dict[str, Any], schema: dict[str, Any]) -> VerificationResult:
    issues: list[str] = []
    missing = missing_required_fields(record, QUESTION_REQUIRED_FIELDS)
    issues.extend(f"MISSING_FIELD: {field}" for field in missing)

    year = safe_int(record.get("year"))
    if year is not None and not (2014 <= year <= 2025):
        issues.append(f"INVALID_YEAR: {year}")

    text = str(record.get("question") or "")
    quality = alpha_ratio(text)
    if quality < 0.5:
        issues.append(f"LOW_OCR_QUALITY: {quality:.2f}")
    if looks_like_broken_ocr(text):
        issues.append("OCR_ARTIFACTS")
    if len(text.split()) < 5:
        issues.append(f"TOO_SHORT: {len(text.split())} words")

    score = max(0.0, 1.0 - len(issues) * 0.2)
    return VerificationResult(
        passed=not issues,
        score=score,
        issues=issues,
        fixed_content=None,
        needs_human=score < 0.3,
    )


def _extract_json_block(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in verifier response.")
    return json.loads(text[start : end + 1])


def verify_content_with_ai(record: dict[str, Any]) -> VerificationResult:
    model = get_gemini_model()
    if model is None:
        heuristics_ok = not looks_like_broken_ocr(record.get("question", "")) and bool(
            record.get("answer")
        )
        score = 0.7 if heuristics_ok else 0.35
        return VerificationResult(
            passed=heuristics_ok,
            score=score,
            issues=[] if heuristics_ok else ["AI_VERIFIER_UNAVAILABLE"],
            fixed_content=None,
            needs_human=not heuristics_ok,
        )

    prompt = VERIFY_PROMPT.format(
        subject=record.get("subject", ""),
        level=record.get("level", ""),
        board=record.get("board", ""),
        year=record.get("year", ""),
        topic=record.get("topic", ""),
        question=str(record.get("question", ""))[:1000],
        answer=str(record.get("answer", ""))[:500],
    )

    try:
        response = model.generate_content(prompt)
        result = _extract_json_block(response.text.strip())
    except Exception as exc:
        return VerificationResult(
            passed=False,
            score=0.0,
            issues=[f"VERIFICATION_API_ERROR: {exc}"],
            fixed_content=None,
            needs_human=True,
        )

    score = safe_float(result.get("overall_score"), 0.5) or 0.5
    issues = [str(item) for item in result.get("issues_found", [])]
    fixed = None
    if result.get("corrected_question") or result.get("corrected_answer"):
        fixed = {**record}
        if result.get("corrected_question"):
            fixed["question"] = result["corrected_question"]
        if result.get("corrected_answer"):
            fixed["answer"] = result["corrected_answer"]

    passed = score >= 0.75 and bool(result.get("factually_correct"))
    return VerificationResult(
        passed=passed,
        score=score,
        issues=issues,
        fixed_content=fixed,
        needs_human=score < 0.4,
    )


def verify_formula(formula_record: dict[str, Any]) -> VerificationResult:
    model = get_gemini_model()
    if model is None:
        formula = str(formula_record.get("formula_text") or "")
        looks_valid = looks_like_formula_candidate(formula)
        issues = [] if looks_valid else ["FORMULA_HEURISTIC_REJECTED"]
        return VerificationResult(looks_valid, 0.8 if looks_valid else 0.3, issues, None, not looks_valid)

    prompt = FORMULA_VERIFY_PROMPT.format(
        formula=formula_record.get("formula_text", ""),
        subject=formula_record.get("subject", ""),
        level=formula_record.get("level", ""),
    )
    try:
        response = model.generate_content(prompt)
        result = _extract_json_block(response.text.strip())
    except Exception as exc:
        return VerificationResult(False, 0.0, [f"FORMULA_VERIFY_ERROR: {exc}"], None, True)

    fixed = None
    if result.get("corrected_formula") or result.get("corrected_latex"):
        fixed = {**formula_record}
        if result.get("corrected_formula"):
            fixed["formula_text"] = result["corrected_formula"]
        if result.get("corrected_latex"):
            fixed["latex"] = result["corrected_latex"]
    passed = bool(result.get("formula_correct")) and bool(result.get("latex_correct"))
    return VerificationResult(passed, 1.0 if passed else 0.4, [], fixed, not passed)


def cross_reference_verify(record: dict[str, Any], all_records: list[dict[str, Any]]) -> bool:
    similar = [
        row
        for row in all_records
        if row.get("subject") == record.get("subject")
        and row.get("year") == record.get("year")
        and row.get("topic") == record.get("topic")
        and row.get("id") != record.get("id")
    ]
    if len(similar) < 3:
        return True
    same_answer_count = sum(1 for row in similar if row.get("answer") == record.get("answer"))
    return same_answer_count >= 1


def infer_topic(question: str, subject: str) -> str:
    q = question.lower()
    if "integrat" in q:
        return "Integration"
    if "differentiat" in q or "derivative" in q:
        return "Differentiation"
    if "organic" in q:
        return "Organic Chemistry"
    if "wave" in q:
        return "Wave Motion"
    if "thermo" in q or "gas" in q:
        return "Thermodynamics"
    return f"{subject} General".strip()


def extract_year(source: str | None) -> int | None:
    if not source:
        return None
    match = re.search(r"\b(20\d{2})\b", source)
    return safe_int(match.group(1)) if match else None


def fix_ocr_text(text: str) -> str:
    return clean_ocr_spacing(text)


def verify_record(record: dict[str, Any]) -> dict[str, Any]:
    structure_result = validate_structure(record, QUESTION_SCHEMA)
    if structure_result.needs_human:
        record["verified"] = False
        record["needs_review"] = True
        record["verification_notes"] = "; ".join(structure_result.issues)
        return record

    if any("OCR_ARTIFACTS" in issue or "LOW_OCR_QUALITY" in issue for issue in structure_result.issues):
        record["question"] = fix_ocr_text(str(record.get("question", "")))
        record["answer"] = fix_ocr_text(str(record.get("answer", "")))

    ai_result = verify_content_with_ai(record)
    if ai_result.fixed_content:
        record.update(ai_result.fixed_content)

    record["verified"] = ai_result.passed and structure_result.passed
    record["verification_score"] = round((structure_result.score + ai_result.score) / 2, 4)
    record["verification_notes"] = "; ".join(structure_result.issues + ai_result.issues)
    record["needs_review"] = ai_result.needs_human
    record["verified_at"] = utc_now_iso()
    return record


def attempt_auto_fix(record: dict[str, Any]) -> dict[str, Any] | None:
    fixed = {**record}
    notes = str(record.get("verification_notes", ""))
    if "OCR_ARTIFACTS" in notes or "LOW_OCR_QUALITY" in notes:
        fixed["question"] = fix_ocr_text(str(fixed.get("question", "")))
        fixed["answer"] = fix_ocr_text(str(fixed.get("answer", "")))
    if "MISSING_FIELD: topic" in notes:
        fixed["topic"] = infer_topic(str(fixed.get("question", "")), str(fixed.get("subject", "")))
    if "MISSING_FIELD: year" in notes:
        fixed["year"] = extract_year(str(fixed.get("source", "")))
    required = ["question", "answer", "subject", "board", "level"]
    if any(not fixed.get(field) for field in required):
        return None
    return fixed


def retry_failed_records(input_path: Path | None = None) -> list[dict[str, Any]]:
    if input_path:
        rows = read_jsonl(input_path)
    else:
        rows = [item["record_data"] for item in read_review_queue()]
    retried: list[dict[str, Any]] = []
    for row in rows:
        verified = verify_record(row)
        if verified.get("verified"):
            retried.append(verified)
        else:
            save_for_review(verified, verified.get("verification_notes", "retry_failed"))
    return retried


def main() -> None:
    parser = argparse.ArgumentParser(description="ScholarHAAB verifier utility")
    parser.add_argument("--mode", choices=["retry-failed"], default="retry-failed")
    parser.add_argument("--input")
    parser.add_argument("--output")
    args = parser.parse_args()

    retried = retry_failed_records(Path(args.input) if args.input else None)
    output = Path(args.output) if args.output else OUTPUT_DIR / "verified_retry.jsonl"
    write_output_rows(output, retried)
    logger.info(f"Verifier retry completed: {len(retried)} records written to {output}")


if __name__ == "__main__":
    main()
