from __future__ import annotations

from knowledge_base import KnowledgeBase
from router import QueryRoute

from .common import footer, opening_line, render_speed_answer, tutor_tip_from_context


def handle_formula_lookup(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    entries = knowledge.find_formula_entries(route.raw, route.subject)
    if not entries:
        topic = route.topic or "this topic"
        repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
        tutor_tip = "If the formula is missing from memory, write the definition first and rebuild the equation from the units."
        intro = opening_line(route, "okay so here's the thing -")
        answer = "\n".join(
            [
                f"{intro} I do not have a verified formula card for {topic} yet.",
                "Core idea: start from the definition the examiner expects, then turn that into the standard equation.",
                "Examiner wants: the named quantity, the correct relationship, and the unit.",
                footer([topic.title()], repeat_profile, tutor_tip),
            ]
        )
        return {
            "answer": answer,
            "topics_needed": [topic.title()],
            "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
            "source": "formula_bank_fallback",
            "tokens_used": 0,
            "from_cache": False,
        }

    if route.wants_all_formulas:
        chosen = entries[:4]
        topic = chosen[0]["topic"]
        repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=chosen[0].get("subject"), level=route.level)
        tutor_tip = tutor_tip_from_context(topic=topic, formula_entry=chosen[0])
        intro = opening_line(route, "okay so here's the thing -")
        main_text = "\n".join(
            [
                f"{intro} these are the formula lines Cambridge loves to recycle for {topic.lower()}.",
                *(f"- {entry['name']}: {entry['expression']}" for entry in chosen),
                "Examiner wants: the exact formula plus the correct unit or rearrangement.",
            ]
        )
        answer = render_speed_answer(main_text, footer([topic], repeat_profile, tutor_tip)) if route.speed_requested else f"{main_text}\n{footer([topic], repeat_profile, tutor_tip)}"
        return {
            "answer": answer,
            "topics_needed": [topic],
            "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
            "source": "formula_bank",
            "tokens_used": 0,
            "from_cache": False,
        }

    entry = entries[0]
    repeat_profile = knowledge.topic_repeat_profile(topic=entry["topic"], subject=entry.get("subject"), level=route.level)
    tutor_tip = tutor_tip_from_context(topic=entry["topic"], formula_entry=entry)
    intro = opening_line(
        route,
        "okay so here's the thing -",
        confident="nice - you're already looking in the right place.",
        frustrated="okay let's slow this down -",
    )
    main_text = "\n".join(
        [
            f"{intro} for {entry['topic'].lower()}, the formula you need is {entry['expression']}.",
            f"When to use it: {entry['usage']}",
            (
                f"Worked example: {entry['worked_example']}"
                if route.wants_example
                else f"Examiner wants: the formula first, then the substitution, then the final unit. {entry['exam_tip']}"
            ),
        ]
    )
    answer = render_speed_answer(main_text, footer(entry.get("prerequisites", [entry["topic"]]), repeat_profile, tutor_tip)) if route.speed_requested else f"{main_text}\n{footer(entry.get('prerequisites', [entry['topic']]), repeat_profile, tutor_tip)}"

    return {
        "answer": answer,
        "topics_needed": entry.get("prerequisites", [entry["topic"]]),
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": "formula_bank",
        "tokens_used": 0,
        "from_cache": False,
    }
