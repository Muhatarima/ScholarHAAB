from __future__ import annotations

from pathlib import Path
from typing import Any
import uuid

from pipeline.utils import OUTPUT_DIR, REVIEW_DIR, append_jsonl, chunked, ensure_dir, logger, read_jsonl

_SUPABASE_CLIENT = None


def get_supabase_client():
    global _SUPABASE_CLIENT
    if _SUPABASE_CLIENT is False:
        return None
    if _SUPABASE_CLIENT is not None:
        return _SUPABASE_CLIENT

    try:
        from supabase import create_client  # type: ignore
    except Exception as exc:
        logger.warning(f"Supabase client unavailable: {exc}")
        _SUPABASE_CLIENT = False
        return None

    import os

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.warning("Supabase environment missing; local backup mode only.")
        _SUPABASE_CLIENT = False
        return None

    _SUPABASE_CLIENT = create_client(url, key)
    return _SUPABASE_CLIENT


def upsert_to_supabase(records: list[dict[str, Any]], table: str, conflict: str = "content_hash") -> int:
    if not records:
        return 0
    client = get_supabase_client()
    if client is None:
        return 0

    inserted = 0
    for batch in chunked(records, 200):
        try:
            client.table(table).upsert(batch, on_conflict=conflict).execute()
            inserted += len(batch)
        except Exception as exc:
            logger.error(f"Supabase upsert failed for {table}: {exc}")
    return inserted


def save_for_review(record: dict[str, Any], reason: str) -> None:
    ensure_dir(REVIEW_DIR)
    payload = {"reason": reason, "record_data": record}
    append_jsonl(REVIEW_DIR / "review_queue.jsonl", payload)
    client = get_supabase_client()
    if client is None:
        return
    try:
        client.table("review_queue").insert(payload).execute()
    except Exception as exc:
        logger.warning(f"Could not persist review_queue row: {exc}")


def read_review_queue() -> list[dict[str, Any]]:
    return read_jsonl(REVIEW_DIR / "review_queue.jsonl")


def write_output_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    from pipeline.utils import write_jsonl

    ensure_dir(path.parent)
    write_jsonl(path, rows)


def start_pipeline_run(context: dict[str, Any]) -> str:
    run_id = str(uuid.uuid4())
    payload = {
        "id": run_id,
        "started_at": context.get("started_at"),
        "completed_at": None,
        "collected": 0,
        "verified": 0,
        "auto_fixed": 0,
        "skipped": 0,
        "needs_review": 0,
        "errors": [],
        "context": context,
    }
    append_jsonl(OUTPUT_DIR / "pipeline_runs.jsonl", payload)
    client = get_supabase_client()
    if client is None:
        return run_id
    try:
        client.table("pipeline_runs").insert(
            {
                "id": run_id,
                "started_at": context.get("started_at"),
                "collected": 0,
                "verified": 0,
                "auto_fixed": 0,
                "skipped": 0,
                "needs_review": 0,
                "errors": [],
            }
        ).execute()
    except Exception as exc:
        logger.warning(f"Could not create pipeline run row: {exc}")
    return run_id


def complete_pipeline_run(run_id: str, payload: dict[str, Any]) -> None:
    append_jsonl(OUTPUT_DIR / "pipeline_run_results.jsonl", {"id": run_id, **payload})
    client = get_supabase_client()
    if client is None:
        return
    try:
        client.table("pipeline_runs").update(payload).eq("id", run_id).execute()
    except Exception as exc:
        logger.warning(f"Could not update pipeline run row {run_id}: {exc}")
