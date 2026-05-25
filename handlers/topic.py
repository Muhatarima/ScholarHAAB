from __future__ import annotations

import re

from knowledge_base import KnowledgeBase, normalize_text
from router import QueryRoute

from .common import footer, opening_line, render_speed_answer, tutor_tip_from_context


SPECIAL_TOPIC_EXPLANATIONS = {
    "photoelectric effect": {
        "summary": "Light can eject electrons from a metal surface, but only if the light frequency is above the threshold frequency.",
        "examiner": "Mention threshold frequency, emitted electrons, and that energy comes in photons.",
    },
    "osmosis": {
        "summary": "Osmosis is the net movement of water molecules through a partially permeable membrane from higher to lower water potential.",
        "examiner": "Use the phrase 'partially permeable membrane' and say water molecules, not just water.",
    },
    "waves": {
        "summary": "Waves transfer energy from one place to another without overall transfer of matter.",
        "examiner": "State the wave property or equation clearly before applying it.",
    },
}


def _clean_summary(topic: str, raw_summary: str | None) -> str:
    normalized_topic = normalize_text(topic)
    special = SPECIAL_TOPIC_EXPLANATIONS.get(normalized_topic)
    if special:
        return special["summary"]

    summary = re.sub(r"\s+", " ", (raw_summary or "")).strip()
    if not summary:
        return f"{topic} is tested through definition, application, and one precise exam conclusion."
    if len(summary) > 180 or sum(character.isdigit() for character in summary) > 8 or "by the end of this topic" in summary.lower():
        return f"{topic} is tested through definition, application, and one precise exam conclusion."
    return summary


def _examiner_line(topic: str, exam_tips: list[str]) -> str:
    special = SPECIAL_TOPIC_EXPLANATIONS.get(normalize_text(topic))
    if special:
        return special["examiner"]
    return exam_tips[0] if exam_tips else "State the key idea first, then tie it directly to the question."


def handle_topic_explain(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    if route.year is None and re.search(r"\b(qp|paper|p\d)\b", route.normalized):
        requested_subject = route.subject or "that subject"
        requested_paper = f" Paper {route.paper_number}" if route.paper_number else ""
        repeat_profile = {"appeared_in": [], "last_seen_year": None}
        tutor_tip = "Give the board and year first, otherwise you waste time revising the wrong paper."
        intro = opening_line(route, "okay so here's the thing -")
        answer = "\n".join(
            [
                f"{intro} I can shortlist important questions for {requested_subject}{requested_paper}, but I still need the board and year.",
                "Say it like: Cambridge 2019 Chemistry Paper 2, or Edexcel 2022 Physics Paper 1.",
                footer([requested_subject], repeat_profile, tutor_tip),
            ]
        )
        return {
            "answer": answer,
            "topics_needed": [requested_subject],
            "repeated": False,
            "source": "clarification_required",
            "tokens_used": 0,
            "from_cache": False,
        }

    topic = route.topic or "the topic"
    classified = knowledge.classify_topic(topic, route.subject)
    subject = route.subject or classified.get("subject") or "Cambridge"
    resolved_topic = classified.get("topic") or topic.title()
    concept = knowledge.concept_support(resolved_topic, subject)
    repeat_profile = knowledge.topic_repeat_profile(topic=resolved_topic, subject=subject, level=route.level)
    recent = knowledge.recent_questions(topic=resolved_topic, subject=subject, level=route.level, limit=2)
    recent_refs = ", ".join(
        f"{row.paper_code or row.source_pdf} {row.question_number or ''}".strip()
        for row in recent
    ) or "recent question pattern not indexed yet"

    summary = _clean_summary(resolved_topic, concept.get("summary"))
    formula_line = ", ".join(concept.get("formula_candidates", [])[:2]) or "Use the defining relationship for the topic if a formula is needed."
    exam_tips = concept.get("exam_tips") or ["State the core idea first, then pin it to the wording in the question."]
    examiner_line = _examiner_line(resolved_topic, exam_tips)
    tutor_tip = tutor_tip_from_context(topic=resolved_topic, concept=concept)
    intro = opening_line(
        route,
        "okay so here's the thing -",
        confident="nice - you're already connecting the right idea.",
        frustrated="okay let's slow this down -",
    )

    if normalize_text(resolved_topic) == "osmosis" and "energy" in route.normalized:
        main_text = (
            f"{intro} you're right to connect this to transport, but osmosis itself does not need energy. "
            f"It is passive because water moves down a water potential gradient through a partially permeable membrane. "
            f"Examiner wants: {examiner_line}"
        )
        answer = render_speed_answer(main_text, footer([resolved_topic], repeat_profile, tutor_tip))
    elif route.speed_requested:
        main_text = (
            f"{intro} {resolved_topic} is basically this: {summary} "
            f"If a formula shows up, use {formula_line}. Examiner wants: {examiner_line}"
        )
        answer = render_speed_answer(main_text, footer([resolved_topic], repeat_profile, tutor_tip))
    else:
        bullets = [
            f"- Core idea: {summary}",
            "- Formal line: write the definition using the exact scientific words, not a loose paraphrase.",
        ]
        if recent_refs != "recent question pattern not indexed yet":
            bullets.append(f"- Common exam use: recent papers keep circling back to {recent_refs}.")
        else:
            bullets.append("- Common exam use: this usually comes as explanation first, then one short application line.")
        bullets.append("Examiner wants: " + examiner_line)
        answer = "\n".join([intro, *bullets, footer([resolved_topic], repeat_profile, tutor_tip)])

    return {
        "answer": answer,
        "topics_needed": [resolved_topic],
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": recent_refs,
        "tokens_used": 0,
        "from_cache": False,
    }

