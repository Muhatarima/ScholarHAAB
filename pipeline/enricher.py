from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pipeline.utils import OUTPUT_DIR, logger, read_jsonl, safe_fix_text, write_jsonl
from pipeline.verifier import get_gemini_model

ENRICH_PROMPT = """
You are a Cambridge/Edexcel expert tutor creating high-quality study material.

Question: {question}
Answer: {answer}
Subject: {subject}, Level: {level}

Generate enrichment data. Return ONLY valid JSON:
{{
  "reasoning_steps": ["step"],
  "formulas_used": [{{"formula":"PV=nRT","latex":"PV=nRT","when_to_use":"ideal gas problems"}}],
  "concepts_used": ["ideal gas law"],
  "topic_tags": ["thermodynamics"],
  "difficulty": "easy|medium|hard",
  "marks_guidance": "Show all working.",
  "common_mistakes": ["mistake"],
  "exam_tips": ["tip"]
}}
"""


def _extract_json_block(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in enrichment response.")
    return json.loads(text[start : end + 1])


def _heuristic_enrichment(record: dict[str, Any]) -> dict[str, Any]:
    question = str(record.get("question", ""))
    answer = str(record.get("answer", ""))
    formulas = []
    for match in re.findall(r"[A-Za-z][A-Za-z0-9]*\s*=\s*[^,.;]{1,30}", f"{question} {answer}"):
        formulas.append({"formula": match, "latex": match, "when_to_use": record.get("topic", "General")})
    concepts = list({record.get("topic", "General"), record.get("subtopic", "")} - {""})
    return {
        "reasoning_steps": [
            "Step 1: Identify what the question is asking.",
            "Step 2: Recall the key formula or concept.",
            "Step 3: Apply it carefully to the given values or statements.",
        ],
        "formulas_used": formulas[:5],
        "concepts_used": concepts or ["General"],
        "topic_tags": concepts or ["General"],
        "difficulty": "medium",
        "marks_guidance": "Show the formula first, then your working.",
        "common_mistakes": ["Skipping a unit conversion", "Jumping to the answer without showing steps"],
        "exam_tips": ["Underline what the examiner is asking before you calculate.", "Check the final answer against the question wording."],
    }


async def enrich_record(record: dict[str, Any]) -> dict[str, Any]:
    if not record.get("verified"):
        return record

    model = get_gemini_model()
    if model is None:
        record.update(_heuristic_enrichment(record))
        record["enriched"] = True
        return record

    prompt = ENRICH_PROMPT.format(
        question=str(record.get("question", ""))[:800],
        answer=str(record.get("answer", ""))[:400],
        subject=record.get("subject", ""),
        level=record.get("level", ""),
    )
    try:
        response = model.generate_content(prompt)
        enrichment = _extract_json_block(response.text.strip())
    except Exception as exc:
        logger.warning(f"Enrichment failed for {record.get('id')}: {exc}")
        enrichment = _heuristic_enrichment(record)

    enrichment["marks_guidance"] = safe_fix_text(str(enrichment.get("marks_guidance") or ""))
    record.update(enrichment)
    record["enriched"] = True
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description="ScholarHAAB enrichment utility")
    parser.add_argument("--mode", choices=["enrich-only"], default="enrich-only")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()

    rows = read_jsonl(Path(args.input))
    enriched = []
    import asyncio

    for row in rows:
        enriched.append(asyncio.run(enrich_record(row)))
    output = Path(args.output) if args.output else OUTPUT_DIR / "enriched_records.jsonl"
    write_jsonl(output, enriched)
    logger.info(f"Enrichment completed: {len(enriched)} rows written to {output}")


if __name__ == "__main__":
    main()

