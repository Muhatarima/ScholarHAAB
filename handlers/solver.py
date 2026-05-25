from __future__ import annotations

import re

from knowledge_base import KnowledgeBase, normalize_text
from router import QueryRoute

from .common import answer_box, extract_numbers, find_best_formula, footer, opening_line, render_speed_answer, simple_calculation_hint, tutor_tip_from_context


def _split_parts(question_text: str) -> list[str]:
    parts = re.split(r"(?=\([a-z]\))", question_text)
    cleaned = [part.strip() for part in parts if part.strip()]
    return cleaned or [question_text.strip()]


def _format_calculation_answer(
    route: QueryRoute,
    *,
    topic: str,
    formula: str,
    numbered_steps: list[str],
    final_answer: str,
    watch_out: str,
    repeat_profile: dict,
    tutor_tip: str,
    source: str,
) -> dict:
    intro = opening_line(
        route,
        "okay so here's the thing —",
        confident="nice — you already know half of this.",
        frustrated="okay let's slow this down —",
    )
    main_text = "\n".join(
        [
            intro,
            f"Formula first: {formula}",
            *[f"{index}. {step}" for index, step in enumerate(numbered_steps, start=1)],
            answer_box(final_answer),
            f"Watch out: {watch_out}",
        ]
    )
    answer = render_speed_answer(main_text, footer([topic], repeat_profile, tutor_tip)) if route.speed_requested else f"{main_text}\n{footer([topic], repeat_profile, tutor_tip)}"
    return {
        "answer": answer,
        "topics_needed": [topic],
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": source,
        "tokens_used": 0,
        "from_cache": False,
    }


def _deterministic_math_or_logic_answer(route: QueryRoute, knowledge: KnowledgeBase) -> dict | None:
    normalized = normalize_text(route.raw)
    numbers = extract_numbers(route.raw)

    trig_derivatives = [
        (r"y\s*=\s*sin\s*x\b|\bsinx\b", "dy/dx = cos x", "d/dx(sin x) = cos x"),
        (r"y\s*=\s*cos\s*x\b|\bcosx\b", "dy/dx = -sin x", "d/dx(cos x) = -sin x"),
        (r"y\s*=\s*tan\s*x\b|\btanx\b", "dy/dx = sec^2 x", "d/dx(tan x) = sec^2 x"),
    ]

    if "differentiate" in normalized:
        for pattern, final_answer, formula in trig_derivatives:
            if re.search(pattern, normalized):
                topic = "Differentiation"
                repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
                tutor_tip = "Differentiate the outer function carefully — that is where silly sign mistakes happen."
                return _format_calculation_answer(
                    route,
                    topic=topic,
                    formula=formula,
                    numbered_steps=[
                        "Spot the standard derivative rule before you touch the algebra.",
                        f"Apply the rule directly to the function given, so {formula}.",
                        f"Write the derivative in standard form: {final_answer}.",
                    ],
                    final_answer=final_answer,
                    watch_out="most students drop the negative sign on cos x or forget the trig rule entirely.",
                    repeat_profile=repeat_profile,
                    tutor_tip=tutor_tip,
                    source="deterministic_solver_rule",
                )

        power_match = re.search(r"differentiate\s+y?\s*=?\s*([0-9.]+)?x\^?(\d+)", normalized)
        if power_match:
            coefficient = float(power_match.group(1) or 1)
            power = int(power_match.group(2))
            new_coefficient = coefficient * power
            new_power = power - 1
            final_answer = f"dy/dx = {new_coefficient:g}x^{new_power}"
            topic = "Differentiation"
            repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
            tutor_tip = "Multiply by the power first, then reduce the power by one — always in that order."
            return _format_calculation_answer(
                route,
                topic=topic,
                formula="d/dx(x^n) = nx^(n-1)",
                numbered_steps=[
                    f"The coefficient is {coefficient:g} and the power is {power}.",
                    f"Multiply them: {coefficient:g} × {power} = {new_coefficient:g}.",
                    f"Reduce the power by one: x^{power} becomes x^{new_power}.",
                ],
                final_answer=final_answer,
                watch_out="students often change the power but forget to multiply by the old power.",
                repeat_profile=repeat_profile,
                tutor_tip=tutor_tip,
                source="deterministic_solver_rule",
            )

    if "force" in normalized and len(numbers) >= 2 and ("kg" in route.raw.lower() or "kg" in normalized):
        mass = numbers[0]
        acceleration = numbers[1]
        force = mass * acceleration
        topic = "Newton's 2nd law"
        repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject="Physics", level=route.level)
        tutor_tip = "If the question gives mass and acceleration directly, do not overthink it — F = ma is the whole move."
        return _format_calculation_answer(
            route,
            topic=topic,
            formula="F = ma",
            numbered_steps=[
                f"Take the given values: m = {mass:g} kg and a = {acceleration:g} m/s^2.",
                f"Substitute into F = ma, so F = {mass:g} × {acceleration:g}.",
                f"Calculate the product: F = {force:g} N.",
            ],
            final_answer=f"{force:g} N",
            watch_out="most students mix this up with momentum and multiply mass by velocity instead.",
            repeat_profile=repeat_profile,
            tutor_tip=tutor_tip,
            source="deterministic_solver_rule",
        )

    if "momentum" in normalized and len(numbers) >= 2:
        mass = numbers[0]
        velocity = numbers[1]
        momentum = mass * velocity
        topic = "Momentum"
        repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject="Physics", level=route.level)
        tutor_tip = "Write the unit as kg m/s, not just N or kg."
        return _format_calculation_answer(
            route,
            topic=topic,
            formula="p = mv",
            numbered_steps=[
                f"Take the given values: m = {mass:g} kg and v = {velocity:g} m/s.",
                f"Substitute into p = mv, so p = {mass:g} × {velocity:g}.",
                f"Calculate the product: p = {momentum:g} kg m/s.",
            ],
            final_answer=f"{momentum:g} kg m/s",
            watch_out="students often forget momentum is a vector quantity and drop the correct unit.",
            repeat_profile=repeat_profile,
            tutor_tip=tutor_tip,
            source="deterministic_solver_rule",
        )

    if ("wave" in normalized or "wavelength" in normalized or "frequency" in normalized) and len(numbers) >= 2:
        first, second = numbers[0], numbers[1]
        if any(keyword in normalized for keyword in ("speed", "wave speed", "calculate its speed")):
            speed = first * second
            topic = "Waves"
            repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject="Physics", level=route.level)
            tutor_tip = "Check the unit on wavelength before you multiply — metres only."
            return _format_calculation_answer(
                route,
                topic=topic,
                formula="v = fλ",
                numbered_steps=[
                    f"Take the given values: f = {first:g} Hz and λ = {second:g} m.",
                    f"Substitute into v = fλ, so v = {first:g} × {second:g}.",
                    f"Calculate the wave speed: v = {speed:g} m/s.",
                ],
                final_answer=f"{speed:g} m/s",
                watch_out="students sometimes divide here, but the wave equation for speed is multiplication.",
                repeat_profile=repeat_profile,
                tutor_tip=tutor_tip,
                source="deterministic_solver_rule",
            )

    syllogism = re.search(
        r"all\s+([a-z]+)\s+are\s+([a-z]+)\s+and\s+all\s+([a-z]+)\s+are\s+([a-z]+),?\s+are\s+([a-z]+)\s+([a-z]+)",
        normalized,
    )
    if syllogism:
        first_group, first_parent, second_group, second_parent, asked_group, asked_parent = syllogism.groups()
        if second_parent == first_group and asked_group == second_group and asked_parent == first_parent:
            topic = "Logical reasoning"
            repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
            tutor_tip = "Write the chain in order — subgroup to bigger group — and the conclusion becomes obvious."
            answer = "\n".join(
                [
                    opening_line(route, "okay so here's the thing —"),
                    "Core rule = if group B sits inside group A, and group A sits inside group C, then group B sits inside group C.",
                    f"1. All {second_group} are {first_group}.",
                    f"2. All {first_group} are {first_parent}.",
                    f"3. So yes, all {second_group} are {first_parent}.",
                    "Mark scheme tip: show the logic chain clearly instead of jumping straight to yes or no.",
                    footer([topic], repeat_profile, tutor_tip),
                ]
            )
            return {
                "answer": answer,
                "topics_needed": [topic],
                "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
                "source": "deterministic_logic_rule",
                "tokens_used": 0,
                "from_cache": False,
            }

    return None


def handle_solve_question(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    deterministic = _deterministic_math_or_logic_answer(route, knowledge)
    if deterministic:
        return deterministic

    classified = knowledge.classify_topic(route.raw, route.subject)
    formula_entry = find_best_formula(
        knowledge,
        route.raw,
        route.subject,
        route.topic or classified.get("topic"),
    )
    subject = route.subject or (formula_entry or {}).get("subject") or classified.get("subject") or "Cambridge"
    topic = (formula_entry or {}).get("topic") or classified.get("topic") or route.topic or "mixed practice"
    repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=subject, level=route.level)
    concept = knowledge.concept_support(topic, subject)
    parts = _split_parts(route.raw)
    calc_hint = simple_calculation_hint(route.raw, formula_entry)
    tutor_tip = tutor_tip_from_context(topic=topic, concept=concept, formula_entry=formula_entry)

    intro = opening_line(
        route,
        "okay so here's the thing —",
        confident="nice — you're already attacking it the right way.",
        frustrated="okay let's slow this down —",
    )

    lines = [intro]
    if formula_entry:
        lines.append(f"Formula first: {formula_entry['expression']}")
    else:
        lines.append(f"Key relationship = use the main {topic.lower()} rule before you touch the numbers.")

    for index, part in enumerate(parts, start=1):
        label = f"Part {index}" if len(parts) > 1 else "Step"
        part_quote = part if len(part) < 110 else part[:107].rstrip() + "..."
        lines.append(f"{index}. {label}: {part_quote}")
        if calc_hint and index == 1:
            lines.append(f"{index}.1 {calc_hint}")
        else:
            lines.append(f"{index}.1 Write the principle, substitute carefully, then finish with the exact conclusion the examiner wants.")

    lines.append("Mark scheme tip: keep each line connected to the data or wording in the question.")
    lines.append(footer([topic] + (concept.get("exam_tips", [])[:1] if concept else []), repeat_profile, tutor_tip))

    answer = "\n".join(lines)
    if route.speed_requested:
        answer = render_speed_answer(
            " ".join(line for line in lines[:-1] if not line.startswith("---")),
            lines[-1],
        )

    return {
        "answer": answer,
        "topics_needed": [topic],
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": "raw_question_text",
        "tokens_used": 0,
        "from_cache": False,
    }
