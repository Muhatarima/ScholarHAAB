from __future__ import annotations

import os
from pathlib import Path
from typing import Callable

from cache import AnswerCache
from handlers.common import find_best_formula, footer, tutor_tip_from_context
from handlers.concept import handle_concept_link
from handlers.formula import handle_formula_lookup
from handlers.mock import handle_mock_generate
from handlers.past_paper import handle_past_paper_ref
from handlers.repeat import handle_repeat_check
from handlers.solver import handle_solve_question
from handlers.topic import handle_topic_explain
from knowledge_base import KnowledgeBase
from rate_limiter import RateLimitHandler
from router import QueryRoute, route_query
from token_guard import SYSTEM_PROMPT, TokenGuard
from tutor_style import filter_tone, has_banned_phrases, log_quality_failure, quality_check


class TutorEngine:
    def __init__(self) -> None:
        root = Path(__file__).resolve().parent
        cache_path = Path(os.environ.get("TUTOR_CACHE_DB_PATH", root / "data" / "answers.db"))
        self.root = root
        self.quality_failure_log = root / "logs" / "quality_failures.log"
        self.system_prompt = SYSTEM_PROMPT
        self.knowledge = KnowledgeBase()
        self.cache = AnswerCache(cache_path)
        self.token_guard = TokenGuard(root / "logs" / "cost_log.csv")
        self.rate_limiter = RateLimitHandler(self.cache)

    def answer(
        self,
        user_input: str,
        subject: str | None = None,
        level: str | None = None,
        user_id: str | None = None,
    ) -> dict:
        return self._run(user_input, subject=subject, level=level, user_id=user_id)

    def _run(
        self,
        user_input: str,
        *,
        subject: str | None = None,
        level: str | None = None,
        user_id: str | None = None,
        provider_override: Callable[[], dict] | None = None,
        fallback_override: Callable[[], dict] | None = None,
    ) -> dict:
        route = route_query(user_input, self.knowledge)
        if subject and not route.subject:
            route.subject = subject
        if level and not route.level:
            route.level = level
        cache_key = self.cache.build_cache_key(route.subject, route.topic, route.query_type)

        response = self.rate_limiter.run(
            cache_key=cache_key,
            query=user_input,
            provider_call=provider_override or (lambda: self._dispatch(route)),
            fallback_call=fallback_override or (lambda: self._fallback(route)),
        )

        payload = response.payload
        payload.setdefault("topics_needed", [])
        payload.setdefault("repeated", False)
        payload.setdefault("source", "")
        payload.setdefault("tokens_used", 0)
        payload.setdefault("from_cache", False)
        payload["answer"] = self._finalize_answer(route, payload["answer"], payload)

        budget_override = 120 if route.speed_requested else None
        guard_result = self.token_guard.enforce(route.query_type, payload["answer"], budget_override=budget_override)
        final_answer = guard_result.text

        final_quality = quality_check(final_answer, route.query_type)
        if not final_quality.passed:
            repaired = self._repair_answer(route, final_answer, payload, final_quality.issues)
            guard_result = self.token_guard.enforce(route.query_type, repaired, budget_override=budget_override)
            final_answer = guard_result.text
            final_quality = quality_check(final_answer, route.query_type)
            if not final_quality.passed:
                log_quality_failure(
                    self.quality_failure_log,
                    query_type=route.query_type,
                    prompt=route.raw,
                    answer=final_answer,
                    issues=final_quality.issues,
                )

        payload["answer"] = final_answer
        payload["delivery_tag"] = response.delivery_tag or payload.get("delivery_tag")

        self.token_guard.log_cost(
            query_type=route.query_type,
            subject=route.subject,
            topic=route.topic,
            from_cache=bool(payload["from_cache"]),
            delivery_tag=payload.get("delivery_tag"),
            tokens_used=int(payload.get("tokens_used", 0)),
            answer_tokens=guard_result.answer_token_count,
        )

        if not payload["from_cache"]:
            self.cache.store(
                cache_key=cache_key,
                query_type=route.query_type,
                subject=route.subject,
                topic=route.topic,
                query=user_input,
                answer=payload["answer"],
                topics_needed=list(payload["topics_needed"]),
                repeated=bool(payload["repeated"]),
                source=str(payload["source"]),
            )

        return {
            "answer": payload["answer"],
            "topics_needed": payload["topics_needed"],
            "repeated": payload["repeated"],
            "source": payload["source"],
            "tokens_used": int(payload.get("tokens_used", 0)),
            "from_cache": bool(payload["from_cache"]),
        }

    def _dispatch(self, route: QueryRoute) -> dict:
        if route.query_type == "past_paper_ref":
            return handle_past_paper_ref(route, self.knowledge)
        if route.query_type == "topic_explain":
            return handle_topic_explain(route, self.knowledge)
        if route.query_type == "formula_lookup":
            return handle_formula_lookup(route, self.knowledge)
        if route.query_type == "repeat_check":
            return handle_repeat_check(route, self.knowledge)
        if route.query_type == "concept_link":
            return handle_concept_link(route, self.knowledge)
        if route.query_type == "mock_generate":
            return handle_mock_generate(route, self.knowledge)
        return handle_solve_question(route, self.knowledge)

    def _fallback(self, route: QueryRoute) -> dict:
        if route.query_type == "formula_lookup":
            return handle_formula_lookup(route, self.knowledge)
        if route.query_type == "repeat_check":
            return handle_repeat_check(route, self.knowledge)
        if route.query_type == "concept_link":
            return handle_concept_link(route, self.knowledge)
        if route.query_type == "topic_explain":
            return handle_topic_explain(route, self.knowledge)
        if route.query_type == "past_paper_ref":
            return handle_past_paper_ref(route, self.knowledge)
        if route.query_type == "mock_generate":
            return handle_mock_generate(route, self.knowledge)
        return handle_solve_question(route, self.knowledge)

    def _footer_for_route(self, route: QueryRoute, payload: dict) -> str:
        topics_needed = list(payload.get("topics_needed") or [])
        topic = topics_needed[0] if topics_needed else route.topic
        if not topic:
            classified = self.knowledge.classify_topic(route.raw, route.subject)
            topic = classified.get("topic") or route.subject or "Core exam method"
            if not route.subject:
                route.subject = classified.get("subject")

        repeat_profile = self.knowledge.topic_repeat_profile(topic=topic, subject=route.subject, level=route.level)
        formula_entry = find_best_formula(self.knowledge, route.raw, route.subject, topic)
        concept = self.knowledge.concept_support(topic, route.subject)
        tutor_tip = tutor_tip_from_context(topic=topic, concept=concept, formula_entry=formula_entry)
        footer_topics = topics_needed or [topic]
        return footer(footer_topics, repeat_profile, tutor_tip)

    def _repair_answer(self, route: QueryRoute, answer: str, payload: dict, issues: list[str]) -> str:
        repaired = filter_tone(answer).strip()

        if "robotic phrases detected" in issues and has_banned_phrases(repaired):
            repaired = filter_tone(repaired)

        if "too short — likely incomplete" in issues:
            repaired = f"{repaired}\nThe trick examiners love is seeing the principle and the final conclusion linked in one clean flow."

        if "calculation missing — no = sign found" in issues:
            formula_entry = find_best_formula(self.knowledge, route.raw, route.subject, route.topic)
            formula_line = (
                f"Formula first: {formula_entry['expression']}"
                if formula_entry
                else "Key relationship = choose the main rule, then substitute carefully."
            )
            repaired = f"{formula_line}\n{repaired}"

        if "mark scheme tip missing" in issues:
            repaired = f"{repaired}\nMark scheme tip: use the exact key phrase the examiner expects, then tie it to the question data."

        if "marks allocation missing" in issues:
            repaired = f"{repaired}\n[4 marks]"

        if "model answer missing" in issues:
            repaired = f"{repaired}\nModel answer: write the method, the calculation or definition, and the final exam-ready line."

        if "what this tests missing" in issues:
            repaired = f"{repaired}\nWhat this tests: topic recall, examiner wording, and method selection."

        if "topic footer missing" in issues:
            repaired = f"{repaired}\n{self._footer_for_route(route, payload)}"

        return filter_tone(repaired).strip()

    def _finalize_answer(self, route: QueryRoute, answer: str, payload: dict) -> str:
        filtered = filter_tone(answer)
        initial_quality = quality_check(filtered, route.query_type)
        if initial_quality.passed:
            return filtered
        return self._repair_answer(route, filtered, payload, initial_quality.issues)


_ENGINE = TutorEngine()


def answer(
    user_input: str,
    subject: str | None = None,
    level: str | None = None,
    user_id: str | None = None,
) -> dict:
    return _ENGINE.answer(user_input, subject=subject, level=level, user_id=user_id)

