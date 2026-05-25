from __future__ import annotations

from knowledge_base import KnowledgeBase
from router import QueryRoute

from .common import footer, opening_line, tutor_tip_from_context


def handle_concept_link(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    topic = route.topic or "this topic"
    classified = knowledge.classify_topic(topic, route.subject)
    subject = route.subject or classified.get("subject")
    resolved_topic = classified.get("topic") or topic.title()
    chain = knowledge.concept_chain(resolved_topic, subject)
    repeat_profile = knowledge.topic_repeat_profile(topic=resolved_topic, subject=subject, level=route.level)

    prereqs = chain.get("prerequisites", [])[:3]
    related = chain.get("related_topics", [])[:1]
    quick_note = chain.get("quick_note", "Build the basics first, then return to the combined exam move.")
    tutor_tip = tutor_tip_from_context(topic=resolved_topic, fallback="Start with the first prerequisite, then come back and test yourself on the full chain.")
    first_step = prereqs[0] if prereqs else resolved_topic
    core_chain = ", ".join(prereqs) or resolved_topic
    related_line = f" Often combined with {related[0]}." if related else ""

    answer = "\n".join(
        [
            opening_line(route, "okay so here's the thing -"),
            f"For this you'll need: {core_chain}.{related_line}",
            f"Start with {first_step} first. Quick note: {quick_note}",
            footer([resolved_topic] + prereqs[:2], repeat_profile, tutor_tip),
        ]
    )

    return {
        "answer": answer,
        "topics_needed": [resolved_topic] + prereqs,
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": "topic_graph",
        "tokens_used": 0,
        "from_cache": False,
    }

