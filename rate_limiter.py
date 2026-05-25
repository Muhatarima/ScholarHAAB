from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

from cache import AnswerCache, CacheHit


class RateLimitError(RuntimeError):
    pass


@dataclass(slots=True)
class RateLimitedResponse:
    payload: dict
    delivery_tag: str | None


class RateLimitHandler:
    def __init__(self, cache: AnswerCache) -> None:
        self.cache = cache

    def run(
        self,
        *,
        cache_key: str,
        query: str,
        provider_call: Callable[[], dict],
        fallback_call: Callable[[], dict],
    ) -> RateLimitedResponse:
        cached = self.cache.lookup(cache_key, query)
        if cached:
            return RateLimitedResponse(payload=self._cache_payload(cached), delivery_tag="from_cache")

        try:
            return RateLimitedResponse(payload=provider_call(), delivery_tag=None)
        except RateLimitError:
            cached_retry = self.cache.lookup(cache_key, query)
            if cached_retry:
                return RateLimitedResponse(payload=self._cache_payload(cached_retry), delivery_tag="from_cache")

            time.sleep(3)
            try:
                return RateLimitedResponse(payload=provider_call(), delivery_tag=None)
            except RateLimitError:
                fallback_payload = fallback_call()
                fallback_payload["delivery_tag"] = "local_fallback"
                fallback_payload["from_cache"] = False
                return RateLimitedResponse(payload=fallback_payload, delivery_tag="local_fallback")

    def _cache_payload(self, cached: CacheHit) -> dict:
        return {
            "answer": cached.answer,
            "topics_needed": cached.topics_needed,
            "repeated": cached.repeated,
            "source": cached.source,
            "tokens_used": 0,
            "from_cache": True,
            "delivery_tag": cached.delivery_tag,
        }

