from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from tutor_style import BANNED_PHRASES, SYSTEM_PROMPT, filter_tone


TOKEN_BUDGETS = {
    "past_paper_ref": 280,
    "topic_explain": 270,
    "formula_lookup": 150,
    "repeat_check": 0,
    "solve_question": 280,
    "concept_link": 80,
    "mock_generate": 250,
}

FILLER_PHRASES = tuple(BANNED_PHRASES)

GPT_4O_MINI_OUTPUT_COST_PER_1K = 0.0006


@dataclass(slots=True)
class TokenGuardResult:
    text: str
    answer_token_count: int
    budget: int


def estimate_tokens(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def trim_to_complete_sentence(text: str, budget: int) -> str:
    if budget <= 0:
        return text

    if estimate_tokens(text) <= budget:
        return text

    footer_start = text.find("\n---\n")
    if footer_start != -1:
        body = text[:footer_start].rstrip()
        footer = text[footer_start:].strip()
        footer_tokens = estimate_tokens(footer)
        if footer_tokens < budget:
            trimmed_body = trim_to_complete_sentence(body, budget - footer_tokens)
            return f"{trimmed_body}\n{footer}".strip()

    chunks = re.split(r"(?<=[.!?])\s+", text.strip())
    kept: list[str] = []
    for chunk in chunks:
        candidate = " ".join(kept + [chunk]).strip()
        if estimate_tokens(candidate) > budget:
            break
        kept.append(chunk)

    if kept:
        return " ".join(kept).strip()

    words = text.strip().split()
    clipped: list[str] = []
    for word in words:
        candidate = " ".join(clipped + [word]).strip()
        if estimate_tokens(candidate) > budget:
            break
        clipped.append(word)
    return " ".join(clipped).rstrip(",;:-") + "."


def remove_filler(text: str) -> str:
    return filter_tone(text)


class TokenGuard:
    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.log_path.exists():
            with self.log_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(
                    [
                        "timestamp",
                        "query_type",
                        "subject",
                        "topic",
                        "from_cache",
                        "delivery_tag",
                        "tokens_used",
                        "answer_tokens",
                        "cost_usd",
                    ]
                )

    def enforce(self, query_type: str, text: str, budget_override: int | None = None) -> TokenGuardResult:
        budget = budget_override if budget_override is not None else TOKEN_BUDGETS[query_type]
        cleaned = remove_filler(text)
        if budget > 0:
            cleaned = trim_to_complete_sentence(cleaned, budget)
        return TokenGuardResult(
            text=cleaned,
            answer_token_count=estimate_tokens(cleaned),
            budget=budget,
        )

    def log_cost(
        self,
        *,
        query_type: str,
        subject: str | None,
        topic: str | None,
        from_cache: bool,
        delivery_tag: str | None,
        tokens_used: int,
        answer_tokens: int,
    ) -> None:
        cost = 0.0 if tokens_used <= 0 else round((tokens_used / 1000) * GPT_4O_MINI_OUTPUT_COST_PER_1K, 6)
        with self.log_path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    datetime.now(timezone.utc).isoformat(),
                    query_type,
                    subject or "",
                    topic or "",
                    "true" if from_cache else "false",
                    delivery_tag or "",
                    tokens_used,
                    answer_tokens,
                    f"{cost:.6f}",
                ]
            )
