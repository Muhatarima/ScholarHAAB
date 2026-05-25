from __future__ import annotations

import re
from dataclasses import dataclass

from knowledge_base import KnowledgeBase, SESSION_ALIASES, normalize_text


QUERY_TYPES = {
    "past_paper_ref",
    "topic_explain",
    "formula_lookup",
    "repeat_check",
    "solve_question",
    "concept_link",
    "mock_generate",
}

FRUSTRATED_PATTERNS = (
    "i don't understand",
    "i dont understand",
    "confused",
    "help",
    "i keep getting this wrong",
    "i keep getting",
    "why",
    "???",
)

CONFIDENT_PATTERNS = (
    "i think",
    "is it because",
    "so does that mean",
)

SPEED_PATTERNS = (
    "quick",
    "fast",
    "just tell me",
    "tldr",
    "short",
)


@dataclass(slots=True)
class QueryRoute:
    query_type: str
    raw: str
    normalized: str
    subject: str | None = None
    level: str | None = None
    year: int | None = None
    session: str | None = None
    paper_number: str | None = None
    variant: str | None = None
    question_number: str | None = None
    topic: str | None = None
    wants_example: bool = False
    wants_all_formulas: bool = False
    last_question: bool = False
    frustrated: bool = False
    confident_attempt: bool = False
    speed_requested: bool = False
    mock_count: int = 1


STOPWORDS = {
    "a",
    "all",
    "and",
    "answer",
    "bio",
    "board",
    "chem",
    "chemistry",
    "chapter",
    "directly",
    "explain",
    "for",
    "formula",
    "give",
    "help",
    "i",
    "is",
    "june",
    "last",
    "level",
    "like",
    "make",
    "maths",
    "me",
    "mock",
    "need",
    "o",
    "often",
    "on",
    "p",
    "paper",
    "past",
    "phy",
    "physics",
    "practice",
    "q",
    "question",
    "questions",
    "quick",
    "repeated",
    "session",
    "test",
    "topics",
    "what",
    "which",
    "year",
}


def detect_query_type(user_input: str) -> str:
    normalized = normalize_text(user_input)

    if re.search(
        r"\b(mock question|mock questions|mock test|test me on|practice question|practice questions|make a question like|make a question on|generate a question|generate questions|write .*mock|give me .*mock)\b",
        normalized,
    ):
        return "mock_generate"
    if re.search(r"\bformula\b|\bequations?\b|\beq\b", normalized):
        return "formula_lookup"
    if re.search(r"\brepeat(ed|s)?\b|\bhot topics?\b|\boften\b", normalized):
        return "repeat_check"
    if re.search(r"what .*need to know|prerequisite|prerequisites|concept link|topics do i need", normalized):
        return "concept_link"
    if re.match(r"^if all .+ are .+ and all .+ are .+,? are .+ .+", normalized):
        return "solve_question"
    if re.match(r"^(calculate|solve|find|determine|differentiate|integrate)\b", normalized):
        return "solve_question"
    if re.search(r"\b(qp|paper|p\d|question|q\d|w\d{2}|s\d{2}|m\d{2})\b", normalized) and re.search(
        r"\b(20(?:1[4-9]|2[0-4]))\b|\b\d{4}\b",
        normalized,
    ):
        return "past_paper_ref"
    if len(normalized.split()) >= 8 and re.search(
        r"\bcalculate|solve|find|determine|show|prove|given|state|explain\b|\[\d+\]",
        normalized,
    ):
        return "solve_question"
    return "topic_explain"


def _extract_year_and_session(text: str) -> tuple[int | None, str | None]:
    normalized = normalize_text(text)

    four_digit = re.search(r"\b(20(?:1[4-9]|2[0-4]))\b", normalized)
    if four_digit:
        year = int(four_digit.group(1))
    else:
        session_code = re.search(r"\b([msw])(\d{2})\b", normalized)
        if session_code:
            suffix = int(session_code.group(2))
            year = 2000 + suffix
        else:
            year = None

    session = None
    session_code = re.search(r"\b([msw])(\d{2})\b", normalized)
    if session_code:
        session = SESSION_ALIASES.get(session_code.group(1))
    else:
        for key, resolved in SESSION_ALIASES.items():
            if key in {"m", "s", "w"}:
                continue
            if key in normalized:
                session = resolved
                break
    return year, session


def _extract_paper_info(text: str) -> tuple[str | None, str | None]:
    normalized = normalize_text(text)
    qp_match = re.search(r"\bqp\s*(\d{2})\b", normalized)
    if qp_match:
        variant = qp_match.group(1)
        return variant[0], variant

    paper_match = re.search(r"\bpaper\s*(\d)\b", normalized)
    if paper_match:
        return paper_match.group(1), None

    short_match = re.search(r"\bp\s*(\d)\b", normalized)
    if short_match:
        return short_match.group(1), None

    return None, None


def _extract_question_number(text: str) -> tuple[str | None, bool]:
    normalized = normalize_text(text)
    if "last question" in normalized:
        return None, True

    match = re.search(r"\bq(?:uestion)?\s*(\d+[a-z]?)\b", normalized)
    if match:
        return match.group(1), False
    return None, False


def _extract_mock_count(text: str) -> int:
    normalized = normalize_text(text)
    match = re.search(r"\b(\d+)\s+mock questions?\b", normalized) or re.search(r"\b(\d+)\s+questions?\b", normalized)
    if not match:
        return 1
    return max(1, min(int(match.group(1)), 5))


def _extract_topic(text: str, knowledge: KnowledgeBase, subject: str | None) -> str | None:
    topic_entry = knowledge.resolve_topic_from_graph(text, subject)
    if topic_entry:
        return topic_entry.get("topic")

    normalized = normalize_text(text)
    cleaned = re.sub(
        r"\b(20(?:1[4-9]|2[0-4])|qp|paper|question|june|may|october|november|march|february|a level|o level)\b",
        " ",
        normalized,
    )
    tokens = [token for token in cleaned.split() if token and token not in STOPWORDS and not token.isdigit()]
    if not tokens:
        return None
    if len(tokens) >= 3:
        return " ".join(tokens[:3]).title()
    return " ".join(tokens).title()


def route_query(user_input: str, knowledge: KnowledgeBase) -> QueryRoute:
    query_type = detect_query_type(user_input)
    normalized = normalize_text(user_input)
    subject, subject_level = knowledge.resolve_subject(user_input)
    level = knowledge.resolve_level(user_input) or subject_level
    year, session = _extract_year_and_session(user_input)
    paper_number, variant = _extract_paper_info(user_input)
    question_number, last_question = _extract_question_number(user_input)

    if not subject:
        subject, inferred_level = knowledge.infer_subject_from_topic(user_input)
        if not level:
            level = inferred_level

    topic = _extract_topic(user_input, knowledge, subject)
    wants_example = "example" in normalized or "worked" in normalized
    wants_all_formulas = "all" in normalized and query_type == "formula_lookup"

    return QueryRoute(
        query_type=query_type,
        raw=user_input,
        normalized=normalized,
        subject=subject,
        level=level,
        year=year,
        session=session,
        paper_number=paper_number,
        variant=variant,
        question_number=question_number,
        topic=topic,
        wants_example=wants_example,
        wants_all_formulas=wants_all_formulas,
        last_question=last_question,
        frustrated=any(pattern in normalized for pattern in FRUSTRATED_PATTERNS),
        confident_attempt=any(pattern in normalized for pattern in CONFIDENT_PATTERNS),
        speed_requested=any(pattern in normalized for pattern in SPEED_PATTERNS),
        mock_count=_extract_mock_count(user_input) if query_type == "mock_generate" else 1,
    )

