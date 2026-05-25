from __future__ import annotations

from knowledge_base import KnowledgeBase
from router import QueryRoute

from .common import compact_question_quote, find_best_formula, footer, infer_topics, opening_line, simple_calculation_hint, tutor_tip_from_context


def handle_past_paper_ref(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    question = knowledge.find_question(
        subject=route.subject,
        year=route.year,
        session=route.session,
        paper_number=route.paper_number,
        variant=route.variant,
        question_number=route.question_number,
        last_question=route.last_question,
        level=route.level,
        topic=route.topic,
    )

    if not question:
        topic = route.topic or "this question"
        support = knowledge.concept_support(topic, route.subject)
        repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
        topics_needed = [topic.title()]
        tutor_tip = tutor_tip_from_context(topic=topic.title(), concept=support, fallback="Give board, year, paper, and question number together so you do not revise the wrong source.")
        intro = opening_line(route, "okay so here's the thing -")
        answer = "\n".join(
            [
                f"{intro} I could not pin the exact paper reference yet.",
                f"What it is probably testing: {topic.title()}.",
                "Based on mark scheme pattern: define the core idea, apply it directly to the data, then finish with the exact conclusion Cambridge rewards.",
                "Mark scheme tip: include the key term the examiner expects, not just the right general idea.",
                footer(topics_needed, repeat_profile, tutor_tip),
            ]
        )
        return {
            "answer": answer,
            "topics_needed": topics_needed,
            "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
            "source": "local_qbank_fallback",
            "tokens_used": 0,
            "from_cache": False,
        }

    formula_entry = find_best_formula(knowledge, question.question_text, question.subject, question.topic)
    repeat_profile = knowledge.topic_repeat_profile(topic=question.topic, subject=question.subject, level=question.level)
    topics_needed = infer_topics(question, route.topic, formula_entry)
    question_label = compact_question_quote(question.question_text)
    source = f"{question.paper_code or question.paper or question.source_pdf} Q{question.question_number or '?'}"
    calc_hint = simple_calculation_hint(question.question_text, formula_entry)
    tutor_tip = tutor_tip_from_context(topic=question.topic, formula_entry=formula_entry, fallback="Use the wording from the question in your final line - Cambridge gives quiet marks for that.")
    paper_reference_parts = [question.board, question.level, question.subject]
    if question.year:
        paper_reference_parts.append(str(question.year))
    if question.session:
        paper_reference_parts.append(question.session)
    if question.paper:
        paper_reference_parts.append(question.paper)
    elif route.paper_number:
        paper_reference_parts.append(f"Paper {route.paper_number}")
    paper_reference = " ".join(part for part in paper_reference_parts if part)

    intro = opening_line(
        route,
        "okay so here's the thing -",
        confident="nice - you already found the right paper trail.",
        frustrated="okay let's slow this down -",
    )
    lines = [
        intro,
        f"This question is really asking you to handle {question.topic.lower()} in exam wording.",
        f"Past paper: {paper_reference}",
        f'Question: "{question_label}"',
    ]
    if formula_entry:
        lines.append(f"Formula first: {formula_entry['expression']}")
    lines.append("1. Restate what the examiner wants in one short line before you calculate or explain.")
    if calc_hint:
        lines.append(f"2. {calc_hint}")
        lines.append("3. Finish with the exact unit or conclusion the paper is rewarding.")
        lines.append("Watch out: most students lose marks here because they stop at the number and forget the final exam sentence.")
    else:
        lines.append("2. Write the principle or definition first, then connect it directly to the data in the question.")
        lines.append("3. End with a one-line conclusion using the same language the question uses.")
    lines.append(f"Mark scheme tip: {question.topic} answers score best when each step is tied back to the question data.")
    lines.append(footer(topics_needed, repeat_profile, tutor_tip))

    return {
        "answer": "\n".join(lines),
        "topics_needed": topics_needed,
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": source,
        "tokens_used": 0,
        "from_cache": False,
    }
