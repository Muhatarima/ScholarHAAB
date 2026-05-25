from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "output"
PIPELINE_LOG_DIR = ROOT_DIR / "logs" / "pipeline"
REVIEW_DIR = OUTPUT_DIR / "review_queue"


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_logger(name: str = "scholarhaab.pipeline") -> logging.Logger:
    ensure_dir(PIPELINE_LOG_DIR)
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        fmt='{"timestamp":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}'
    )
    file_handler = logging.FileHandler(PIPELINE_LOG_DIR / "pipeline.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    return logger


logger = build_logger()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def safe_fix_text(value: str) -> str:
    text = value or ""
    try:
        import ftfy  # type: ignore

        text = ftfy.fix_text(text)
    except Exception:
        pass
    return normalize_whitespace(text)


def clean_ocr_spacing(value: str) -> str:
    text = safe_fix_text(value)
    text = re.sub(r"\b([A-Za-z]) ([A-Za-z]) ([A-Za-z])\b", r"\1\2\3", text)
    text = re.sub(r"\b([A-Za-z]) ([A-Za-z])\b", r"\1\2", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return normalize_whitespace(text)


def alpha_ratio(text: str) -> float:
    if not text:
        return 0.0
    good = sum(1 for ch in text if ch.isalpha() or ch.isspace())
    return good / max(len(text), 1)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def chunked(values: list[Any], size: int) -> Iterable[list[Any]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, default)
    return value.strip() if isinstance(value, str) else value


def looks_like_broken_ocr(text: str) -> bool:
    return bool(re.search(r"\b[a-zA-Z] [a-zA-Z] [a-zA-Z]\b", text or ""))


def has_overcompressed_token(text: str) -> bool:
    return bool(re.search(r"[A-Za-z0-9]{24,}", text or ""))


def looks_like_noisy_source_text(text: str) -> bool:
    cleaned = safe_fix_text(text)
    if not cleaned:
        return True
    if looks_like_broken_ocr(cleaned):
        return True
    if has_overcompressed_token(cleaned):
        return True
    return alpha_ratio(cleaned) < 0.45


def unique_clean_strings(values: Iterable[Any], max_items: int | None = None) -> list[str]:
    seen: set[str] = set()
    cleaned_values: list[str] = []
    for value in values:
        cleaned = safe_fix_text(str(value or ""))
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        cleaned_values.append(cleaned)
        if max_items is not None and len(cleaned_values) >= max_items:
            break
    return cleaned_values


def build_exam_tips(
    subject: str,
    topic: str,
    board: str,
    level: str,
    existing: Iterable[Any] | None = None,
) -> list[str]:
    tips = unique_clean_strings(existing or [], max_items=4)
    base_tips = [
        f"For {board or 'exam'} {level or 'level'} {subject}, write the key idea for {topic or 'the topic'} before adding detail.",
        f"Practice one recent {subject} question on {topic or 'this area'} and mark it against the official scheme straight after.",
        f"Use the exact syllabus wording for {topic or 'the concept'} when you revise definitions or explanations.",
    ]
    for tip in base_tips:
        if len(tips) >= 2:
            break
        if tip not in tips:
            tips.append(tip)
    return tips[:4]


def looks_like_formula_candidate(text: str) -> bool:
    cleaned = safe_fix_text(text)
    if not cleaned or len(cleaned) < 4 or len(cleaned) > 80:
        return False
    if any(
        token in cleaned.lower()
        for token in (
            "which row",
            "which statement",
            "both ",
            "neither ",
            "official answer",
            "question paper",
            " is present",
            " are present",
            " but not ",
        )
    ):
        return False
    if has_overcompressed_token(cleaned):
        return False
    if not any(symbol in cleaned for symbol in ("=", "->", "Δ", "^", "/", "∝", "±")):
        return False
    return len(cleaned.split()) <= 14


def safe_int(value: Any, default: int | None = None) -> int | None:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default
