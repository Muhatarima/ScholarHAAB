from __future__ import annotations

import argparse
import json
import os
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client
from tqdm import tqdm

from config import LOGS_DIR, REPORTS_DIR, VALIDATED_DIR, PIPELINE_ROOT

ROOT = PIPELINE_ROOT.parent
FAILED_LOG = LOGS_DIR / "ingestion_failed.jsonl"
REPORT_PATH = REPORTS_DIR / "ingestion_report.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def is_placeholder(value: str | None) -> bool:
    return not value or value.lower().startswith("your_") or "your_" in value.lower()


def load_environment() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(PIPELINE_ROOT / ".env")
    if is_placeholder(os.getenv("SUPABASE_URL")) and os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    if is_placeholder(os.getenv("SUPABASE_KEY")) and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        os.environ["SUPABASE_KEY"] = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def build_embed_text(question: dict[str, Any]) -> str:
    return f"""
Subject: {question.get('subject')}
Level: {question.get('level')}
Board: {question.get('board')}
Year: {question.get('year')}
Topic: {question.get('topic')}
Question: {question.get('question_text_clean') or question.get('question_text')}
Mark Scheme: {question.get('mark_scheme_clean') or question.get('mark_scheme')}
""".strip()


def load_questions(limit: int | None = None) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    for file_path in VALIDATED_DIR.rglob("*.json"):
        questions.extend(json.loads(file_path.read_text(encoding="utf-8")))
        if limit is not None and len(questions) >= limit:
            return questions[:limit]
    return questions


def generate_embedding(client: OpenAI, text: str) -> list[float]:
    response = client.embeddings.create(model="text-embedding-3-small", input=text[:8000])
    return response.data[0].embedding


def normalize_for_db(question: dict[str, Any], embedding: list[float]) -> dict[str, Any]:
    allowed = {
        "id",
        "board",
        "level",
        "subject",
        "subject_code",
        "year",
        "session",
        "paper",
        "question_number",
        "part",
        "question_text",
        "question_text_clean",
        "has_diagram",
        "diagram_description",
        "marks",
        "mark_scheme",
        "mark_scheme_points",
        "mark_scheme_clean",
        "topic",
        "subtopic",
        "difficulty",
        "keywords",
        "command_word",
        "question_type",
        "confidence_score",
        "needs_review",
        "review_reason",
    }
    row = {key: question.get(key) for key in allowed}
    row["embedding"] = embedding
    row["confidence_score"] = row.get("confidence_score") or (0.75 if row.get("needs_review") else 1.0)
    return row


def ingest_all(limit: int | None = None, batch_size: int = 50) -> dict[str, Any]:
    load_environment()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if is_placeholder(url) or is_placeholder(key):
        raise RuntimeError("Missing valid SUPABASE_URL/SUPABASE_KEY for ingestion.")
    if is_placeholder(openai_key):
        raise RuntimeError("Missing valid OPENAI_API_KEY for embeddings.")

    supabase = create_client(url, key)
    openai_client = OpenAI(api_key=openai_key)
    questions = load_questions(limit=limit)
    total = len(questions)
    ingested = 0
    failed = 0
    per_subject: Counter[str] = Counter()

    for start in tqdm(range(0, total, batch_size), desc="Embedding and ingesting"):
        batch = questions[start : start + batch_size]
        rows: list[dict[str, Any]] = []
        for question in batch:
            try:
                embedding = generate_embedding(openai_client, build_embed_text(question))
                rows.append(normalize_for_db(question, embedding))
            except Exception as exc:
                failed += 1
                append_jsonl(FAILED_LOG, {"id": question.get("id"), "stage": "embedding", "error": str(exc), "timestamp": now_iso()})
        if not rows:
            continue
        try:
            supabase.table("questions").upsert(rows, on_conflict="id").execute()
            ingested += len(rows)
            for row in rows:
                per_subject[f"{row['board']} {row['level']} {row['subject']}"] += 1
        except Exception as exc:
            failed += len(rows)
            for row in rows:
                append_jsonl(FAILED_LOG, {"id": row.get("id"), "stage": "supabase", "error": str(exc), "timestamp": now_iso()})
        time.sleep(1)

    report = {
        "total_questions": total,
        "total_ingested": ingested,
        "total_failed": failed,
        "success_rate_pct": round((ingested / total * 100) if total else 0, 2),
        "per_subject": dict(sorted(per_subject.items())),
        "created_at": now_iso(),
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()
    try:
        report = ingest_all(limit=args.limit, batch_size=args.batch_size)
        return 0 if report["success_rate_pct"] >= 99 else 2
    except Exception as exc:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report = {
            "status": "BLOCKED",
            "blocked_reason": str(exc),
            "total_questions": len(load_questions(limit=args.limit)),
            "total_ingested": 0,
            "total_failed": 0,
            "success_rate_pct": 0,
            "created_at": now_iso(),
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
