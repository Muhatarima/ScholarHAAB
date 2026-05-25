from __future__ import annotations

from dataclasses import dataclass

from knowledge_base import KnowledgeBase, normalize_text
from router import QueryRoute

from .common import footer, opening_line, tutor_tip_from_context


@dataclass(slots=True)
class MockVariant:
    topic: str
    question: str
    marks: int
    model_answer: str
    tests: str
    common_mistake: str


def _waves_variants() -> list[MockVariant]:
    return [
        MockVariant(
            topic="Waves",
            question="A loudspeaker produces sound of frequency 680 Hz in air where the wave speed is 340 m/s. Calculate the wavelength of the sound.",
            marks=3,
            model_answer="Use v = fλ. So λ = v/f = 340/680 = 0.50 m.",
            tests="Wave equation, rearranging formulas, unit handling",
            common_mistake="Students divide the wrong way round and get 2.0 m instead of 0.50 m.",
        ),
        MockVariant(
            topic="Waves",
            question="A ripple tank produces water waves with frequency 12 Hz and wavelength 0.15 m. Find the speed of the waves.",
            marks=3,
            model_answer="v = fλ = 12 × 0.15 = 1.8 m/s.",
            tests="Wave equation, substitution, multiplication with decimals",
            common_mistake="Students write Hz as the final unit instead of m/s.",
        ),
        MockVariant(
            topic="Waves",
            question="A guitar string causes a sound wave of wavelength 0.80 m in air. If the speed of sound is 320 m/s, calculate the frequency of the sound.",
            marks=4,
            model_answer="Use v = fλ, so f = v/λ = 320/0.80 = 400 Hz.",
            tests="Rearranging the wave equation, substitution, unit recognition",
            common_mistake="Students use the string length as the wavelength even though the question asks about the sound in air.",
        ),
        MockVariant(
            topic="Waves",
            question="A radio wave has frequency 2.5 × 10^6 Hz and travels at 3.0 × 10^8 m/s. Calculate its wavelength.",
            marks=4,
            model_answer="λ = v/f = (3.0 × 10^8) / (2.5 × 10^6) = 1.2 × 10^2 m = 120 m.",
            tests="Scientific notation, wave equation, careful powers of ten",
            common_mistake="Students divide the powers of ten incorrectly and lose two marks immediately.",
        ),
        MockVariant(
            topic="Waves",
            question="A student measures 8 complete waves passing a point in 4.0 s. The wavelength is 0.25 m. Calculate the wave speed.",
            marks=5,
            model_answer="Frequency f = number/time = 8/4.0 = 2.0 Hz. Then v = fλ = 2.0 × 0.25 = 0.50 m/s.",
            tests="Frequency from data, then wave equation, two-stage calculation",
            common_mistake="Students use 8 as the frequency directly instead of dividing by time first.",
        ),
    ]


def _circuits_variants() -> list[MockVariant]:
    return [
        MockVariant(
            topic="Circuits",
            question="A resistor of resistance 6.0 Ω is connected across a 12 V battery. Calculate the current in the circuit.",
            marks=3,
            model_answer="Use V = IR. So I = V/R = 12/6.0 = 2.0 A.",
            tests="Ohm's law, rearranging formulas, current in a simple circuit",
            common_mistake="Students multiply V and R instead of dividing to find current.",
        ),
        MockVariant(
            topic="Circuits",
            question="Two resistors of 4.0 Ω and 8.0 Ω are connected in series to a 12 V supply. Calculate the total resistance of the circuit.",
            marks=2,
            model_answer="For series, R_total = 4.0 + 8.0 = 12.0 Ω.",
            tests="Series resistance rule, simple addition",
            common_mistake="Students try to use the parallel formula even though the resistors are in series.",
        ),
        MockVariant(
            topic="Circuits",
            question="A lamp draws a current of 0.40 A from a 9.0 V battery. Calculate the resistance of the lamp.",
            marks=3,
            model_answer="Use V = IR. So R = V/I = 9.0/0.40 = 22.5 Ω.",
            tests="Ohm's law, rearrangement, decimal division",
            common_mistake="Students write 3.6 Ω by multiplying instead of dividing.",
        ),
        MockVariant(
            topic="Circuits",
            question="A student connects 6.0 Ω and 3.0 Ω resistors in parallel. Show that the total resistance is 2.0 Ω.",
            marks=4,
            model_answer="For parallel, 1/R_total = 1/6.0 + 1/3.0 = 1/6 + 2/6 = 3/6 = 1/2. So R_total = 2.0 Ω.",
            tests="Parallel resistance, fraction work, showing a proof-style calculation",
            common_mistake="Students add the resistors directly, which only works for series circuits.",
        ),
        MockVariant(
            topic="Circuits",
            question="A 24 V supply is connected to a heater that has resistance 8.0 Ω. Calculate the power rating of the heater.",
            marks=5,
            model_answer="First find current: I = V/R = 24/8.0 = 3.0 A. Then power P = VI = 24 × 3.0 = 72 W.",
            tests="Ohm's law linked with electric power, two-step calculation",
            common_mistake="Students jump straight to P = IV without finding the missing current first.",
        ),
    ]


def _osmosis_variants() -> list[MockVariant]:
    return [
        MockVariant(
            topic="Osmosis",
            question="A student places potato cylinders in distilled water for 30 minutes. Explain why the cylinders increase in mass.",
            marks=4,
            model_answer="Water enters the potato cells by osmosis through a partially permeable membrane because the water potential is higher outside than inside the cells.",
            tests="Definition of osmosis, water potential, membrane language",
            common_mistake="Students say 'water diffuses in' without mentioning the partially permeable membrane.",
        ),
        MockVariant(
            topic="Osmosis",
            question="A visking tubing bag containing concentrated sugar solution is placed in water. State and explain what happens to the bag after 20 minutes.",
            marks=5,
            model_answer="The bag swells because water moves into the bag by osmosis from higher water potential outside to lower water potential inside through the partially permeable membrane.",
            tests="Osmosis direction, explanation with water potential, application to a setup",
            common_mistake="Students focus on sugar moving out instead of water moving in.",
        ),
    ]


def _generic_variants(topic: str) -> list[MockVariant]:
    safe_topic = topic or "General practice"
    return [
        MockVariant(
            topic=safe_topic,
            question=f"A student is asked to solve a short Cambridge-style problem on {safe_topic.lower()}. State the key principle and apply it to the data given.",
            marks=4,
            model_answer=f"State the main {safe_topic.lower()} rule first, then apply it directly to the values or evidence in the question.",
            tests=f"{safe_topic}, exam wording, method selection",
            common_mistake="Students start calculating before they identify what the question is actually testing.",
        )
    ]


def _pick_variants(topic: str | None, subject: str | None, count: int) -> list[MockVariant]:
    normalized_topic = normalize_text(topic or "")
    normalized_subject = normalize_text(subject or "")

    if "wave" in normalized_topic:
        variants = _waves_variants()
    elif "circuit" in normalized_topic or "electric" in normalized_topic or "resistance" in normalized_topic:
        variants = _circuits_variants()
    elif "osmosis" in normalized_topic:
        variants = _osmosis_variants()
    elif "physics" in normalized_subject:
        variants = _waves_variants()
    else:
        variants = _generic_variants(topic or subject or "General practice")

    return variants[: max(1, min(count, len(variants)))]


def handle_mock_generate(route: QueryRoute, knowledge: KnowledgeBase) -> dict:
    referenced_question = None
    if route.year and (route.paper_number or route.variant):
        referenced_question = knowledge.find_question(
            subject=route.subject,
            year=route.year,
            session=route.session,
            paper_number=route.paper_number,
            variant=route.variant,
            question_number=route.question_number,
            level=route.level,
        )

    topic = route.topic
    subject = route.subject
    if referenced_question:
        topic = referenced_question.topic
        subject = referenced_question.subject
        if not route.level:
            route.level = referenced_question.level

    if not topic:
        classified = knowledge.classify_topic(route.raw, route.subject)
        topic = classified.get("topic") or "General practice"
        subject = subject or classified.get("subject")

    repeat_profile = knowledge.topic_repeat_profile(topic=topic, subject=subject, level=route.level)
    concept = knowledge.concept_support(topic, subject)
    tutor_tip = tutor_tip_from_context(topic=topic, concept=concept, fallback="Do the mock under exam timing, then mark your wording against the model answer.")
    variants = _pick_variants(topic, subject, route.mock_count)

    blocks: list[str] = []
    for index, variant in enumerate(variants, start=1):
        prefix = f"{index}. " if len(variants) > 1 else ""
        blocks.extend(
            [
                f"{prefix}{variant.question}",
                f"[{variant.marks} marks]",
                f"Model answer: {variant.model_answer}",
                f"What this tests: {variant.tests}",
                f"Common mistake: {variant.common_mistake}",
                "",
            ]
        )

    intro = opening_line(
        route,
        "okay so here's the thing —",
        confident="nice — if you want exam-style practice, this is exactly the right move.",
        frustrated="okay let's slow this down —",
    )
    if len(variants) == 1:
        answer = "\n".join([intro, *blocks[:-1], footer([topic], repeat_profile, tutor_tip)])
    else:
        answer = "\n".join(
            [
                f"{intro} here are {len(variants)} Cambridge-style practice questions on {topic.lower()}.",
                *blocks[:-1],
                footer([topic], repeat_profile, tutor_tip),
            ]
        )

    return {
        "answer": answer,
        "topics_needed": [topic],
        "repeated": len(repeat_profile.get("appeared_in", [])) >= 2,
        "source": "mock_generator",
        "tokens_used": 0,
        "from_cache": False,
        "is_mock": True,
    }

