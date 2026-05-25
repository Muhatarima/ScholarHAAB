from __future__ import annotations

import json
from collections import Counter

from config import EXTRACTED_DIR, REPORTS_DIR


def main() -> int:
    files = list(EXTRACTED_DIR.rglob("*.json"))
    total = 0
    with_ms = 0
    review = 0
    per_subject: Counter[str] = Counter()
    for path in files:
        questions = json.loads(path.read_text(encoding="utf-8"))
        for question in questions:
            total += 1
            if question.get("mark_scheme") and question.get("mark_scheme") != "NOT_FOUND":
                with_ms += 1
            if question.get("needs_review"):
                review += 1
            per_subject[f"{question.get('board')} {question.get('level')} {question.get('subject')}"] += 1
    report = {
        "files": len(files),
        "total_questions": total,
        "mark_scheme_coverage_pct": round((with_ms / total * 100) if total else 0, 2),
        "needs_review_count": review,
        "per_subject": dict(sorted(per_subject.items())),
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "count_extracted_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
