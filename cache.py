from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from knowledge_base import normalize_text


TTL_DAYS = 30
CACHE_VERSION = "tutor_engine_v5"


@dataclass(slots=True)
class CacheHit:
    answer: str
    topics_needed: list[str]
    repeated: bool
    source: str
    delivery_tag: str


class AnswerCache:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cache_key TEXT NOT NULL,
                    query_type TEXT NOT NULL,
                    subject TEXT,
                    topic TEXT,
                    normalized_query TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    topics_needed TEXT NOT NULL,
                    repeated INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def build_cache_key(self, subject: str | None, topic: str | None, query_type: str) -> str:
        basis = f"{CACHE_VERSION}|{subject or 'general'}|{topic or 'general'}|{query_type}"
        return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:20]

    def lookup(self, cache_key: str, query: str, similarity_threshold: float = 0.85) -> CacheHit | None:
        normalized_query = normalize_text(query)
        oldest_allowed = (datetime.now(timezone.utc) - timedelta(days=TTL_DAYS)).isoformat()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT normalized_query, answer, topics_needed, repeated, source
                FROM answers
                WHERE cache_key = ?
                  AND created_at >= ?
                ORDER BY id DESC
                """,
                (cache_key, oldest_allowed),
            ).fetchall()

        best_row = None
        best_score = 0.0
        for row in rows:
            score = SequenceMatcher(None, normalized_query, row[0]).ratio()
            if score > best_score:
                best_row = row
                best_score = score

        if best_row and best_score >= similarity_threshold:
            return CacheHit(
                answer=best_row[1],
                topics_needed=json.loads(best_row[2]),
                repeated=bool(best_row[3]),
                source=best_row[4],
                delivery_tag="from_cache",
            )
        return None

    def store(
        self,
        *,
        cache_key: str,
        query_type: str,
        subject: str | None,
        topic: str | None,
        query: str,
        answer: str,
        topics_needed: list[str],
        repeated: bool,
        source: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO answers (
                    cache_key, query_type, subject, topic, normalized_query,
                    answer, topics_needed, repeated, source, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cache_key,
                    query_type,
                    subject,
                    topic,
                    normalize_text(query),
                    answer,
                    json.dumps(topics_needed),
                    1 if repeated else 0,
                    source,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            connection.commit()
