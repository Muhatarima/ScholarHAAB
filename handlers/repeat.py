from __future__ import annotations

from knowledge_base import KnowledgeBase
from router import QueryRoute

from .common import footer, opening_line, tutor_tip_from_context


def handle_repeat_check(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    topic = route.topic or "this topic"
    classified = knowledge.classify_topic(topic, route.subject)
    subject = route.subject or classified.get("subject")
    resolved_topic = classified.get("topic") or topic.title()
    repeat_profile = knowledge.topic_repeat_profile(topic=resolved_topic, subject=subject, level=route.level)
    concept_chain = knowledge.concept_chain(resolved_topic, subject)
    last_question = knowledge.find_question(
        subject=subject,
        year=repeat_profile.get("last_seen_year"),
        topic=resolved_topic,
        level=route.level,
    )
    last_paper = (
        f"{last_question.paper_code or last_question.source_pdf} q{last_question.question_number}"
        if last_question
        else "not pinned yet"
    )
    prediction = "High chance it shows up again." if len(repeat_profile.get("appeared_in", [])) >= 3 else "Possible, but not a guaranteed banker."
    tutor_tip = tutor_tip_from_context(topic=resolved_topic, fallback="Revise the repeated topic with one worked example and one definition — that combo usually pays off fastest.")

    answer = "\n".join(
        [
            opening_line(route, "okay so here's the thing —"),
            f"Topic: {resolved_topic}",
            f"Appeared in: {', '.join(str(year) for year in repeat_profile.get('appeared_in', [])) or 'no verified years yet'}",
            f"Frequency: {repeat_profile.get('frequency_label')}",
            f"Last paper: {last_paper}",
            f"Prediction: {prediction}",
            f"Related topics: {', '.join(concept_chain.get('related_topics', [])[:3]) or 'core applications around the same chapter'}",
            footer([resolved_topic] + concept_chain.get("prerequisites", [])[:2], repeat_profile, tutor_tip),
        ]
    )

    return {
        "answer": answer,
        "topics_needed": [resolved_topic] + concept_chain.get("prerequisites", [])[:2],
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": last_paper,
        "tokens_used": 0,
        "from_cache": False,
    }

