from __future__ import annotations

import re
from typing import Any

from knowledge_base import KnowledgeBase, QuestionRow, normalize_text, unique_preserve_order
from router import QueryRoute


def compact_question_quote(question_text: str, limit_words: int = 18) -> str:
    words = question_text.split()
    if len(words) <= limit_words:
        return question_text.strip()
    return " ".join(words[:limit_words]).strip() + "..."


def extract_numbers(text: str) -> list[float]:
    return [float(match) for match in re.findall(r"(?<![A-Za-z])(\d+(?:\.\d+)?)", text)]


def find_best_formula(knowledge: KnowledgeBase, query: str, subject: str | None, topic: str | None) -> dict[str, Any] | None:
    search_text = " ".join(part for part in [topic, query] if part)
    entries = knowledge.find_formula_entries(search_text, subject)
    return entries[0] if entries else None


def infer_topics(question: QuestionRow | None, route_topic: str | None, formula_entry: dict[str, Any] | None) -> list[str]:
    topics = []
    if question:
        topics.extend([question.topic, question.sub_topic or "", question.chapter or ""])
    if route_topic:
        topics.append(route_topic)
    if formula_entry:
        topics.extend(formula_entry.get("prerequisites", []))
        topics.append(formula_entry.get("topic", ""))
    cleaned = [topic for topic in topics if topic]
    return unique_preserve_order(cleaned)[:4]


def simple_calculation_hint(query: str, formula_entry: dict[str, Any] | None) -> str | None:
    if not formula_entry:
        return None

    expression = formula_entry.get("expression", "")
    numbers = extract_numbers(query)
    name = normalize_text(formula_entry.get("name", ""))

    if "momentum" in name and len(numbers) >= 2:
        result = numbers[0] * numbers[1]
        return f"Using {expression}, {numbers[0]} × {numbers[1]} = {result:g}."
    if "wave speed" in name and len(numbers) >= 2:
        result = numbers[0] * numbers[1]
        return f"Using {expression}, {numbers[0]} × {numbers[1]} = {result:g}."
    if "density" in name and len(numbers) >= 2 and numbers[1] != 0:
        result = numbers[0] / numbers[1]
        return f"Using {expression}, {numbers[0]} ÷ {numbers[1]} = {result:g}."
    if "pressure" in name and len(numbers) >= 2 and numbers[1] != 0:
        result = numbers[0] / numbers[1]
        return f"Using {expression}, {numbers[0]} ÷ {numbers[1]} = {result:g}."
    if "ohm" in name and len(numbers) >= 2 and numbers[1] != 0:
        result = numbers[0] / numbers[1]
        return f"Using {expression}, {numbers[0]} ÷ {numbers[1]} = {result:g}."
    if "mole" in name and len(numbers) >= 2 and numbers[1] != 0:
        result = numbers[0] / numbers[1]
        return f"Using {expression}, {numbers[0]} ÷ {numbers[1]} = {result:g} mol."
    if "concentration" in name and len(numbers) >= 2 and numbers[1] != 0:
        result = numbers[0] / numbers[1]
        return f"Using {expression}, {numbers[0]} ÷ {numbers[1]} = {result:g}."
    return None


def frequency_bucket(repeat_profile: dict[str, Any]) -> str:
    years = len(repeat_profile.get("appeared_in", []))
    if years >= 4:
        return "High"
    if years >= 2:
        return "Medium"
    return "Low"


def footer(topics_needed: list[str], repeat_profile: dict[str, Any], tutor_tip: str) -> str:
    topics = ", ".join(topics_needed[:4]) if topics_needed else "core definitions"
    frequency = frequency_bucket(repeat_profile)
    last_seen = repeat_profile.get("last_seen_year")
    last_seen_text = str(last_seen) if last_seen else "not pinned yet"
    return "\n".join(
        [
            "---",
            f"📌 Topics you need: {topics}",
            f"🔁 Exam frequency: {frequency} — last seen {last_seen_text}",
            f"💡 Tutor tip: {tutor_tip}",
        ]
    )


def opening_line(route: QueryRoute, default: str, *, confident: str | None = None, frustrated: str | None = None) -> str:
    if route.frustrated:
        return frustrated or "okay let's slow this down —"
    if route.confident_attempt:
        return confident or "nice — you already know half of this."
    return default


def tutor_tip_from_context(
    *,
    topic: str,
    concept: dict[str, Any] | None = None,
    formula_entry: dict[str, Any] | None = None,
    fallback: str | None = None,
) -> str:
    if formula_entry and formula_entry.get("exam_tip"):
        return str(formula_entry["exam_tip"])
    if concept:
        exam_tips = concept.get("exam_tips") or []
        if exam_tips:
            return str(exam_tips[0])
        summary = concept.get("summary") or ""
        if summary:
            return f"Keep your final line tied to {topic.lower()}, not just the numbers."
    return fallback or f"Keep the last line sharp — Cambridge usually rewards the exact {topic.lower()} phrase."


def render_speed_answer(main_text: str, footer_text: str) -> str:
    compact = re.sub(r"\s+", " ", main_text.replace("\n", " ")).strip()
    compact = re.sub(r" +([,.;:!?])", r"\1", compact)
    return f"{compact}\n{footer_text}"


def answer_box(value: str) -> str:
    return f"[Answer: {value}]"

