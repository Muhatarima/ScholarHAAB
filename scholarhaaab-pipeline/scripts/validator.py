from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tqdm import tqdm

from config import EXTRACTED_DIR, REPORTS_DIR, VALIDATED_DIR


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_question(question: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    text = str(question.get("question_text") or "")
    if len(text.strip()) < 10:
        issues.append({"severity": "critical", "field": "question_text", "message": "Empty or too short"})
    if text.rstrip().endswith(("...", "-")):
        issues.append({"severity": "critical", "field": "question_text", "message": "Text appears truncated"})
    if not question.get("question_number"):
        issues.append({"severity": "critical", "field": "question_number", "message": "Missing question number"})
    year = question.get("year")
    if not isinstance(year, int) or year < 2014 or year > 2024:
        issues.append({"severity": "critical", "field": "year", "message": f"Invalid year: {year}"})
    if question.get("mark_scheme") == "NOT_FOUND":
        issues.append({"severity": "warning", "field": "mark_scheme", "message": "Mark scheme missing"})
    marks = question.get("marks")
    if not isinstance(marks, int) or marks <= 0:
        issues.append({"severity": "warning", "field": "marks", "message": "Marks not found"})
    if not question.get("topic"):
        issues.append({"severity": "warning", "field": "topic", "message": "Topic not classified"})
    if re.search(r"\b\d+\s*/\s*$", text):
        issues.append({"severity": "warning", "field": "math", "message": "Formula may be truncated"})
    return issues


def try_auto_fix(question: dict[str, Any], issues: list[dict[str, str]], seen_ids: set[str]) -> bool:
    fixed = False
    if question.get("id") in seen_ids:
        base = str(question.get("id") or "question")
        suffix = 2
        while f"{base}_{suffix}" in seen_ids:
            suffix += 1
        question["id"] = f"{base}_{suffix}"
        fixed = True
    if not question.get("topic"):
        question["topic"] = "General"
        fixed = True
    if not isinstance(question.get("marks"), int) or question.get("marks") <= 0:
        question["marks"] = 1
        question["needs_review"] = True
        question["review_reason"] = "Marks auto-filled as 1; manual review needed"
        fixed = True
    return fixed and not any(issue["severity"] == "critical" for issue in validate_question(question))


def output_path_for(input_path: Path) -> Path:
    return VALIDATED_DIR / input_path.relative_to(EXTRACTED_DIR)


def validate_all(limit: int | None = None) -> dict[str, Any]:
    files = list(EXTRACTED_DIR.rglob("*.json"))
    if limit is not None:
        files = files[:limit]
    passed = 0
    failed = 0
    auto_fixed = 0
    needs_review: list[dict[str, Any]] = []
    warning_counts: Counter[str] = Counter()
    seen_ids: set[str] = set()

    for file_path in tqdm(files, desc="Validating extracted JSON"):
        questions = json.loads(file_path.read_text(encoding="utf-8"))
        validated: list[dict[str, Any]] = []
        for question in questions:
            issues = validate_question(question)
            critical = [issue for issue in issues if issue["severity"] == "critical"]
            warnings = [issue for issue in issues if issue["severity"] == "warning"]
            for issue in warnings:
                warning_counts[issue["field"]] += 1
            if question.get("id") in seen_ids:
                critical.append({"severity": "critical", "field": "id", "message": "Duplicate ID"})
            if critical:
                if try_auto_fix(question, critical, seen_ids):
                    auto_fixed += 1
                    passed += 1
                    validated.append(question)
                    seen_ids.add(question["id"])
                else:
                    failed += 1
                    needs_review.append({"question": question, "issues": issues + critical})
                continue
            if warnings:
                question["needs_review"] = True
                question["review_reason"] = "; ".join(issue["message"] for issue in warnings)
            passed += 1
            validated.append(question)
            seen_ids.add(question["id"])

        output_path = output_path_for(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(validated, indent=2, ensure_ascii=False), encoding="utf-8")

    total = passed + failed
    review_pct = (len(needs_review) / total * 100) if total else 0
    report = {
        "status": "pass" if review_pct < 5 else "review_needed",
        "files": len(files),
        "passed": passed,
        "failed": failed,
        "auto_fixed": auto_fixed,
        "needs_manual_review": len(needs_review),
        "manual_review_pct": round(review_pct, 2),
        "warning_counts": dict(warning_counts),
        "created_at": now_iso(),
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "manual_review.json").write_text(json.dumps(needs_review[:5000], indent=2, ensure_ascii=False), encoding="utf-8")
    (REPORTS_DIR / "validation_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    report = validate_all(limit=args.limit)
    return 0 if report["status"] == "pass" else 2


if __name__ == "__main__":
    raise SystemExit(main())
