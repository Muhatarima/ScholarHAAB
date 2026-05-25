from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from config import REPORTS_DIR, PIPELINE_ROOT

ROOT = PIPELINE_ROOT.parent
SCHEMA_PATH = PIPELINE_ROOT / "scripts" / "schema.sql"
REPORT_PATH = REPORTS_DIR / "database_setup_report.json"

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS past_papers (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  level TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  year INTEGER NOT NULL,
  session TEXT NOT NULL,
  paper TEXT NOT NULL,
  paper_type TEXT NOT NULL,
  file_path TEXT,
  total_questions INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  level TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  year INTEGER NOT NULL,
  session TEXT NOT NULL,
  paper TEXT NOT NULL,
  question_number TEXT NOT NULL,
  part TEXT,
  question_text TEXT NOT NULL,
  question_text_clean TEXT,
  has_diagram BOOLEAN DEFAULT FALSE,
  diagram_description TEXT,
  marks INTEGER,
  mark_scheme TEXT,
  mark_scheme_points JSONB DEFAULT '[]',
  mark_scheme_clean TEXT,
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT,
  keywords JSONB DEFAULT '[]',
  command_word TEXT,
  question_type TEXT,
  embedding vector(1536),
  confidence_score FLOAT DEFAULT 1.0,
  needs_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT,
  board TEXT,
  level TEXT,
  subject TEXT,
  year INTEGER,
  session TEXT,
  paper TEXT,
  status TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_embedding
  ON questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_questions_subject_year
  ON questions(subject, year, level, board);

CREATE INDEX IF NOT EXISTS idx_questions_topic
  ON questions(subject, topic, difficulty);

CREATE INDEX IF NOT EXISTS idx_questions_board_level
  ON questions(board, level);

CREATE OR REPLACE FUNCTION match_questions(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_subject text DEFAULT NULL,
  filter_level text DEFAULT NULL,
  filter_board text DEFAULT NULL,
  filter_topic text DEFAULT NULL,
  filter_year_from int DEFAULT NULL,
  filter_year_to int DEFAULT NULL
)
RETURNS TABLE (
  id text,
  board text,
  level text,
  subject text,
  subject_code text,
  year int,
  session text,
  paper text,
  question_number text,
  part text,
  question_text text,
  marks int,
  mark_scheme text,
  mark_scheme_points jsonb,
  topic text,
  subtopic text,
  difficulty text,
  has_diagram boolean,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    q.id,
    q.board,
    q.level,
    q.subject,
    q.subject_code,
    q.year,
    q.session,
    q.paper,
    q.question_number,
    q.part,
    q.question_text,
    q.marks,
    q.mark_scheme,
    q.mark_scheme_points,
    q.topic,
    q.subtopic,
    q.difficulty,
    q.has_diagram,
    1 - (q.embedding <=> query_embedding) AS similarity
  FROM questions q
  WHERE q.embedding IS NOT NULL
    AND (filter_subject IS NULL OR q.subject = filter_subject)
    AND (filter_level IS NULL OR q.level = filter_level)
    AND (filter_board IS NULL OR q.board = filter_board)
    AND (filter_topic IS NULL OR q.topic = filter_topic)
    AND (filter_year_from IS NULL OR q.year >= filter_year_from)
    AND (filter_year_to IS NULL OR q.year <= filter_year_to)
    AND 1 - (q.embedding <=> query_embedding) > 0.5
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
$$;
""".strip()


def load_environment() -> None:
    load_dotenv(ROOT / ".env.local")
    load_dotenv(PIPELINE_ROOT / ".env")
    if is_placeholder(os.getenv("SUPABASE_URL")) and os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    if is_placeholder(os.getenv("SUPABASE_KEY")) and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        os.environ["SUPABASE_KEY"] = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def is_placeholder(value: str | None) -> bool:
    if not value:
        return True
    lowered = value.lower()
    return lowered.startswith("your_") or "your_" in lowered or lowered.startswith("postgresql://postgres:password")


def write_schema() -> None:
    SCHEMA_PATH.write_text(SCHEMA_SQL + "\n", encoding="utf-8")


def run_psql_if_possible() -> tuple[bool, str]:
    db_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if is_placeholder(db_url):
        return False, "SUPABASE_DB_URL/DATABASE_URL not set; wrote SQL for Supabase SQL Editor instead."

    psql = shutil.which("psql")
    if not psql:
        return False, "psql not found; install PostgreSQL CLI or run schema.sql in Supabase SQL Editor."

    result = subprocess.run(
        [psql, db_url, "-v", "ON_ERROR_STOP=1", "-f", str(SCHEMA_PATH)],
        text=True,
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0:
        return False, result.stderr[-2000:] or result.stdout[-2000:]
    return True, result.stdout[-2000:]


def verify_tables() -> dict[str, str]:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if is_placeholder(url) or is_placeholder(key):
        return {
            "past_papers": "not_checked_missing_supabase_env",
            "questions": "not_checked_missing_supabase_env",
            "pipeline_logs": "not_checked_missing_supabase_env",
        }

    try:
        supabase = create_client(url, key)
    except Exception as exc:
        return {
            "past_papers": f"not_checked_invalid_supabase_client: {exc}",
            "questions": f"not_checked_invalid_supabase_client: {exc}",
            "pipeline_logs": f"not_checked_invalid_supabase_client: {exc}",
        }
    checks: dict[str, str] = {}
    for table in ("past_papers", "questions", "pipeline_logs"):
        try:
            supabase.table(table).select("id", count="exact").limit(1).execute()
            checks[table] = "ok"
        except Exception as exc:
            checks[table] = f"missing_or_blocked: {exc}"
    return checks


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    load_environment()
    write_schema()
    executed, message = run_psql_if_possible()
    table_checks = verify_tables()
    ok = executed and all(value == "ok" for value in table_checks.values())

    report = {
        "phase": "database_setup",
        "status": "complete" if ok else "manual_sql_required",
        "schema_path": str(SCHEMA_PATH),
        "executed_via_psql": executed,
        "message": message,
        "table_checks": table_checks,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
