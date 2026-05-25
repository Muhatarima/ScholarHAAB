from __future__ import annotations

import asyncio
import hashlib
import math
from typing import Any

from pipeline.utils import chunked, logger

_EMBEDDING_CLIENT = None


def build_embedding_text(record: dict[str, Any]) -> str:
    parts = [
        f"{record.get('board', '')} {record.get('level', '')} {record.get('subject', '')} {record.get('year', '')}".strip(),
        f"Topic: {record.get('topic', '')} | Subtopic: {record.get('subtopic', '')}".strip(),
    ]
    if record.get("formula_text"):
        parts.append(f"Formula: {record['formula_text']}")
    if record.get("latex"):
        parts.append(f"LaTeX: {record['latex']}")
    if record.get("concept_name"):
        parts.append(f"Concept: {record['concept_name']}")
    if record.get("definition"):
        parts.append(f"Definition: {record['definition']}")
    if record.get("explanation"):
        parts.append(f"Explanation: {record['explanation']}")
    if record.get("question"):
        parts.append(f"Question: {record['question']}")
    if record.get("answer"):
        parts.append(f"Answer: {record['answer']}")
    if record.get("examples"):
        parts.append(f"Examples: {', '.join(str(item) for item in record['examples'][:3])}")
    if record.get("exam_tips"):
        parts.append(f"Exam tips: {', '.join(str(item) for item in record['exam_tips'][:3])}")
    if record.get("concepts_used"):
        parts.append(f"Concepts: {', '.join(record['concepts_used'])}")
    if record.get("formulas_used"):
        formulas = []
        for item in record["formulas_used"]:
            formulas.append(item["formula"] if isinstance(item, dict) else str(item))
        parts.append(f"Formulas: {', '.join(formulas[:10])}")
    if record.get("reasoning_steps"):
        parts.append("Reasoning: " + " -> ".join(record["reasoning_steps"][:3]))
    return "\n".join(part for part in parts if part)


def _normalize_vector(values: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in values))
    if magnitude == 0:
        return values
    return [value / magnitude for value in values]


def _fallback_embed_text(text: str, dims: int = 768) -> list[float]:
    vector = [0.0] * dims
    for token in text.lower().split():
        index = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % dims
        vector[index] += 1.0
    return _normalize_vector(vector)


def _get_embedding_client():
    global _EMBEDDING_CLIENT
    if _EMBEDDING_CLIENT is False:
        return None
    if _EMBEDDING_CLIENT is not None:
        return _EMBEDDING_CLIENT
    try:
        import google.generativeai as genai  # type: ignore
        import os

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            _EMBEDDING_CLIENT = False
            return None
        genai.configure(api_key=api_key)
        _EMBEDDING_CLIENT = genai
        return _EMBEDDING_CLIENT
    except Exception as exc:
        logger.warning(f"Embedding client unavailable: {exc}")
        _EMBEDDING_CLIENT = False
        return None


async def embed_batch(records: list[dict[str, Any]], batch_size: int = 50) -> list[dict[str, Any]]:
    client = _get_embedding_client()
    for batch_index, batch in enumerate(chunked(records, batch_size), start=1):
        texts = [build_embedding_text(record) for record in batch]
        embeddings: list[list[float]] | None = None
        if client is not None:
            for attempt in range(5):
                try:
                    result = client.embed_content(
                        model="models/text-embedding-004",
                        content=texts,
                        task_type="retrieval_document",
                    )
                    raw_embeddings = result.get("embedding") or result.get("embeddings") or []
                    if raw_embeddings and isinstance(raw_embeddings[0], dict):
                        embeddings = [item.get("values") or item.get("embedding") for item in raw_embeddings]
                    else:
                        embeddings = raw_embeddings
                    break
                except Exception as exc:
                    wait = (2**attempt) + 1
                    logger.warning(f"Embedding retry {attempt + 1} failed: {exc}")
                    await asyncio.sleep(wait)
        if embeddings is None:
            embeddings = [_fallback_embed_text(text) for text in texts]
            model_name = "hash-fallback-768"
        else:
            model_name = "text-embedding-004"
        for offset, record in enumerate(batch):
            record["embedding"] = embeddings[offset]
            record["embedding_model"] = model_name
            record["embedding_text"] = texts[offset][:500]
        logger.info(f"Embedded batch {batch_index} ({len(batch)} records)")
    return records
