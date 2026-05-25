from __future__ import annotations

from copy import deepcopy
from typing import Any
import uuid

from pipeline.utils import safe_fix_text, safe_float, safe_int, sha256_text, utc_now_iso

QUESTION_SCHEMA = {
    "id": str,
    "content_hash": str,
    "board": str,
    "level": str,
    "subject": str,
    "subject_code": str,
    "topic": str,
    "subtopic": str,
    "year": int,
    "session": str,
    "paper_number": int,
    "question_number": int,
    "question": str,
    "answer": str,
    "worked_solution": str,
    "marks": int,
    "question_type": str,
    "formulas_used": list,
    "concepts_used": list,
    "reasoning_steps": list,
    "common_mistakes": list,
    "exam_tips": list,
    "difficulty": str,
    "marks_guidance": str,
    "source": str,
    "verified": bool,
    "verification_score": float,
    "verification_notes": str,
    "ocr_quality": float,
    "needs_review": bool,
    "created_at": str,
    "embedding_model": str,
    "embedding_text": str,
}

FORMULA_SCHEMA = {
    "id": str,
    "subject": str,
    "topic": str,
    "formula_text": str,
    "latex": str,
    "variables": dict,
    "conditions": str,
    "level": str,
    "board": str,
    "source": str,
    "verified": bool,
    "verification_score": float,
    "created_at": str,
    "embedding_model": str,
    "embedding_text": str,
}

CONCEPT_SCHEMA = {
    "id": str,
    "subject": str,
    "topic": str,
    "concept_name": str,
    "definition": str,
    "explanation": str,
    "examples": list,
    "common_mistakes": list,
    "exam_tips": list,
    "level": str,
    "board": str,
    "source": str,
    "verified": bool,
    "verification_score": float,
    "created_at": str,
    "embedding_model": str,
    "embedding_text": str,
}

QUESTION_REQUIRED_FIELDS = ["question", "answer", "subject", "board", "level", "year", "topic"]
FORMULA_REQUIRED_FIELDS = ["subject", "formula_text", "latex", "level", "board", "source"]
CONCEPT_REQUIRED_FIELDS = ["subject", "topic", "concept_name", "definition", "level", "board", "source"]


def default_question_record() -> dict[str, Any]:
    return {
        "id": "",
        "content_hash": "",
        "board": "",
        "level": "",
        "subject": "",
        "subject_code": "",
        "topic": "",
        "subtopic": "",
        "year": None,
        "session": "",
        "paper_number": None,
        "question_number": None,
        "question": "",
        "answer": "",
        "worked_solution": "",
        "marks": None,
        "question_type": "structured",
        "formulas_used": [],
        "concepts_used": [],
        "reasoning_steps": [],
        "common_mistakes": [],
        "exam_tips": [],
        "difficulty": "",
        "marks_guidance": "",
        "source": "",
        "verified": False,
        "verification_score": 0.0,
        "verification_notes": "",
        "ocr_quality": 1.0,
        "needs_review": False,
        "created_at": utc_now_iso(),
        "embedding_model": "",
        "embedding_text": "",
    }


def default_formula_record() -> dict[str, Any]:
    return {
        "id": "",
        "subject": "",
        "topic": "",
        "formula_text": "",
        "latex": "",
        "variables": {},
        "conditions": "",
        "level": "",
        "board": "",
        "source": "",
        "verified": False,
        "verification_score": 0.0,
        "created_at": utc_now_iso(),
        "embedding_model": "",
        "embedding_text": "",
    }


def default_concept_record() -> dict[str, Any]:
    return {
        "id": "",
        "subject": "",
        "topic": "",
        "concept_name": "",
        "definition": "",
        "explanation": "",
        "examples": [],
        "common_mistakes": [],
        "exam_tips": [],
        "level": "",
        "board": "",
        "source": "",
        "verified": False,
        "verification_score": 0.0,
        "created_at": utc_now_iso(),
        "embedding_model": "",
        "embedding_text": "",
    }


def build_content_hash(question: str, answer: str = "") -> str:
    return sha256_text(f"{safe_fix_text(question)}||{safe_fix_text(answer)}")


def build_uuid(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def normalize_question_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(default_question_record())
    normalized.update(record)
    normalized["question"] = safe_fix_text(str(normalized.get("question") or ""))
    normalized["answer"] = safe_fix_text(str(normalized.get("answer") or ""))
    normalized["worked_solution"] = safe_fix_text(str(normalized.get("worked_solution") or ""))
    normalized["topic"] = safe_fix_text(str(normalized.get("topic") or "General"))
    normalized["subtopic"] = safe_fix_text(str(normalized.get("subtopic") or ""))
    normalized["subject"] = safe_fix_text(str(normalized.get("subject") or ""))
    normalized["board"] = safe_fix_text(str(normalized.get("board") or ""))
    normalized["level"] = safe_fix_text(str(normalized.get("level") or ""))
    normalized["subject_code"] = safe_fix_text(str(normalized.get("subject_code") or ""))
    normalized["session"] = safe_fix_text(str(normalized.get("session") or ""))
    normalized["source"] = safe_fix_text(str(normalized.get("source") or ""))
    normalized["year"] = safe_int(normalized.get("year"))
    normalized["paper_number"] = safe_int(normalized.get("paper_number"))
    normalized["question_number"] = safe_int(normalized.get("question_number"))
    normalized["marks"] = safe_int(normalized.get("marks"))
    normalized["verification_score"] = safe_float(normalized.get("verification_score"), 0.0) or 0.0
    normalized["ocr_quality"] = safe_float(normalized.get("ocr_quality"), 1.0) or 0.0
    normalized["formulas_used"] = list(normalized.get("formulas_used") or [])
    normalized["concepts_used"] = list(normalized.get("concepts_used") or [])
    normalized["reasoning_steps"] = list(normalized.get("reasoning_steps") or [])
    normalized["common_mistakes"] = list(normalized.get("common_mistakes") or [])
    normalized["exam_tips"] = list(normalized.get("exam_tips") or [])
    normalized["difficulty"] = safe_fix_text(str(normalized.get("difficulty") or ""))
    normalized["marks_guidance"] = safe_fix_text(str(normalized.get("marks_guidance") or ""))
    normalized["embedding_text"] = safe_fix_text(str(normalized.get("embedding_text") or ""))
    if not normalized["content_hash"]:
        normalized["content_hash"] = build_content_hash(normalized["question"], normalized["answer"])
    if not normalized["id"]:
        normalized["id"] = build_uuid(normalized["content_hash"])
    return normalized


def normalize_formula_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(default_formula_record())
    normalized.update(record)
    normalized["formula_text"] = safe_fix_text(str(normalized.get("formula_text") or ""))
    normalized["latex"] = safe_fix_text(str(normalized.get("latex") or normalized["formula_text"]))
    normalized["topic"] = safe_fix_text(str(normalized.get("topic") or "General"))
    normalized["subject"] = safe_fix_text(str(normalized.get("subject") or ""))
    normalized["board"] = safe_fix_text(str(normalized.get("board") or ""))
    normalized["level"] = safe_fix_text(str(normalized.get("level") or ""))
    normalized["source"] = safe_fix_text(str(normalized.get("source") or ""))
    normalized["verification_score"] = safe_float(normalized.get("verification_score"), 0.0) or 0.0
    normalized["embedding_text"] = safe_fix_text(str(normalized.get("embedding_text") or ""))
    if not normalized["id"]:
        normalized["id"] = build_uuid(
            sha256_text(f"{normalized['subject']}||{normalized['topic']}||{normalized['formula_text']}")
        )
    return normalized


def normalize_concept_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(default_concept_record())
    normalized.update(record)
    normalized["concept_name"] = safe_fix_text(str(normalized.get("concept_name") or ""))
    normalized["definition"] = safe_fix_text(str(normalized.get("definition") or ""))
    normalized["explanation"] = safe_fix_text(str(normalized.get("explanation") or ""))
    normalized["topic"] = safe_fix_text(str(normalized.get("topic") or "General"))
    normalized["subject"] = safe_fix_text(str(normalized.get("subject") or ""))
    normalized["board"] = safe_fix_text(str(normalized.get("board") or ""))
    normalized["level"] = safe_fix_text(str(normalized.get("level") or ""))
    normalized["source"] = safe_fix_text(str(normalized.get("source") or ""))
    normalized["examples"] = list(normalized.get("examples") or [])
    normalized["common_mistakes"] = list(normalized.get("common_mistakes") or [])
    normalized["exam_tips"] = list(normalized.get("exam_tips") or [])
    normalized["verification_score"] = safe_float(normalized.get("verification_score"), 0.0) or 0.0
    normalized["embedding_text"] = safe_fix_text(str(normalized.get("embedding_text") or ""))
    if not normalized["id"]:
        normalized["id"] = build_uuid(
            sha256_text(f"{normalized['subject']}||{normalized['topic']}||{normalized['concept_name']}")
        )
    return normalized


def missing_required_fields(record: dict[str, Any], required_fields: list[str]) -> list[str]:
    missing: list[str] = []
    for field in required_fields:
        value = record.get(field)
        if value is None:
            missing.append(field)
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(field)
            continue
    return missing
