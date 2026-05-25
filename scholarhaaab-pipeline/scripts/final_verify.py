from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

from config import CAMBRIDGE_O_LEVEL_SUBJECTS, PIPELINE_ROOT, REPORTS_DIR

ROOT = PIPELINE_ROOT.parent
REPORT_PATH = REPORTS_DIR / "FINAL_VERIFICATION_REPORT.json"


def is_placeholder(value: str | None) -> bool:
    return not value or value.lower().startswith("your_") or "your_" in value.lower()


def load_environment() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(PIPELINE_ROOT / ".env")
    if is_placeholder(os.getenv("SUPABASE_URL")) and os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    if is_placeholder(os.getenv("SUPABASE_KEY")) and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        os.environ["SUPABASE_KEY"] = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def fail(name: str, reason: str) -> dict[str, Any]:
    return {"name": name, "pass": False, "reason": reason}


def ok(name: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"name": name, "pass": True, **(extra or {})}


def count_query(supabase, column = "id", **filters):
    query = supabase.table("questions").select(column, count="exact")
    for key, value in filters.items():
        query = query.eq(key, value)
    result = query.limit(1).execute()
    return result.count or 0


def run_verification() -> dict[str, Any]:
    load_environment()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    tests: list[dict[str, Any]] = []
    if is_placeholder(url) or is_placeholder(key):
        report = {
            "status": "BLOCKED",
            "blocked_reason": "Missing valid Supabase URL/service key.",
            "tests": [fail("database_connection", "Missing valid Supabase URL/service key")],
            "all_tests_passed": False,
            "completion_date": datetime.now(timezone.utc).isoformat(),
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return report

    try:
        supabase = create_client(url, key)
    except Exception as exc:
        report = {
            "status": "BLOCKED",
            "blocked_reason": f"Supabase client failed: {exc}",
            "tests": [fail("database_connection", str(exc))],
            "all_tests_passed": False,
            "completion_date": datetime.now(timezone.utc).isoformat(),
        }
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return report

    total = count_query(supabase)
    tests.append(ok("database_populated", {"count": total}) if total > 50000 else fail("database_populated", f"Expected >50000, found {total}"))

    try:
        boards = supabase.table("questions").select("board").limit(100000).execute().data or []
        board_set = {row.get("board") for row in boards}
        tests.append(ok("both_boards_present", {"boards": sorted(board_set)}) if {"cambridge", "edexcel"}.issubset(board_set) else fail("both_boards_present", f"Found boards: {sorted(board_set)}"))
        level_set = {row.get("level") for row in boards}
        tests.append(ok("both_levels_present", {"levels": sorted(level_set)}) if {"O Level", "A Level"}.issubset(level_set) else fail("both_levels_present", f"Found levels: {sorted(level_set)}"))
    except Exception as exc:
        tests.append(fail("board_level_queries", str(exc)))

    for subject in CAMBRIDGE_O_LEVEL_SUBJECTS:
        try:
            count = count_query(supabase, subject=subject)
            tests.append(ok(f"subject_searchable_{subject}", {"count": count}) if count > 0 else fail(f"subject_searchable_{subject}", "0 rows"))
        except Exception as exc:
            tests.append(fail(f"subject_searchable_{subject}", str(exc)))

    try:
        missing_embeddings = supabase.table("questions").select("id", count="exact").is_("embedding", "null").limit(1).execute().count or 0
        tests.append(ok("embeddings_present") if missing_embeddings == 0 else fail("embeddings_present", f"{missing_embeddings} rows with null embeddings"))
    except Exception as exc:
        tests.append(fail("embeddings_present", str(exc)))

    if not is_placeholder(openai_key):
        try:
            client = OpenAI(api_key=openai_key)
            embedding = client.embeddings.create(model="text-embedding-3-small", input="wave motion frequency").data[0].embedding
            start = time.perf_counter()
            results = supabase.rpc("match_questions", {"query_embedding": embedding, "match_count": 5, "filter_subject": "Physics"}).execute().data or []
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            good = len(results) >= 3 and max((row.get("similarity") or 0) for row in results) > 0.7
            tests.append(ok("similarity_search", {"results": len(results), "duration_ms": duration_ms}) if good else fail("similarity_search", f"Results={len(results)}"))
        except Exception as exc:
            tests.append(fail("similarity_search", str(exc)))
    else:
        tests.append(fail("similarity_search", "Missing OpenAI key"))

    all_passed = all(test["pass"] for test in tests)
    report = {
        "status": "COMPLETE" if all_passed else "FAILED",
        "total_questions": total,
        "tests": tests,
        "all_tests_passed": all_passed,
        "rag_verified": all_passed,
        "completion_date": datetime.now(timezone.utc).isoformat(),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    raise SystemExit(0 if run_verification()["all_tests_passed"] else 2)
