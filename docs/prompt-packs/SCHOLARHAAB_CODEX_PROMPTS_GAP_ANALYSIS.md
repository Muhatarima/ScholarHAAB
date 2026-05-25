# ScholarHAAB Codex Prompts Gap Analysis

Source prompt: [SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md)

This compares the DOCX backend prompt pack with the current ScholarHAAB repo state.

## Summary

Overall result: **mostly present, often stronger than the prompt pack, but with a few cleanup/documentation gaps**.

## Prompt-by-Prompt Comparison

### Prompt 1 — Token-optimized AI service

Status: **Present and stronger**

Evidence:

- [lib/ai-service.ts](C:/Users/User/scholorhaab/lib/ai-service.ts)

Current repo is stronger because it already has:

- provider chain with Gemini, OpenAI, Groq, and OpenAI-compatible fallback
- retries and provider runtime guards
- multipart generation support
- quota safeguards
- provider health snapshot
- token estimation and usage logging

Gap vs DOCX:

- the DOCX wants a simpler console-log-based service
- current repo is better, but more complex to explain

Recommendation:

- keep current implementation
- document it better instead of replacing it

### Prompt 2 — Tier-aware token limits

Status: **Partial, but intentionally different**

Evidence:

- [lib/usage.ts](C:/Users/User/scholorhaab/lib/usage.ts)
- [lib/server/usage.ts](C:/Users/User/scholorhaab/lib/server/usage.ts)

Current repo uses:

- tier-aware **daily credits**
- action-based pricing by product/action
- DB-backed daily usage reads/writes

Difference from DOCX:

- DOCX assumes question count + token budget as the primary control plane
- current repo uses credits instead

Gap:

- there is no single simple token-budget module matching the DOCX exactly

Recommendation:

- do not rewrite to the DOCX version
- optionally add clearer docs/admin surfacing for token budgets behind the credit system

### Prompt 3 — Smart answer cache

Status: **Present and stronger, but naming is messy**

Evidence:

- [lib/responseCache.ts](C:/Users/User/scholorhaab/lib/responseCache.ts)
- [lib/server/cache.ts](C:/Users/User/scholorhaab/lib/server/cache.ts)
- [docs/sql/014_cached_answers.sql](C:/Users/User/scholorhaab/docs/sql/014_cached_answers.sql)
- [docs/sql/021_answer_cache.sql](C:/Users/User/scholorhaab/docs/sql/021_answer_cache.sql)

Current repo already has:

- structured cache keying
- TTL by intent
- personal-question bypass
- DB-backed answer cache
- hit counting and purge support

Gap:

- two cache stories appear in the repo:
  - legacy `cached_answers`
  - current `answer_cache`

Recommendation:

- keep `answer_cache` as canonical
- document migration/legacy status explicitly

### Prompt 4 — Optimized system prompts

Status: **Present and stronger**

Evidence:

- [lib/prompts.ts](C:/Users/User/scholorhaab/lib/prompts.ts)

Current repo already supports:

- product-specific prompts
- direct vs tutor modes
- stronger student-safe rules
- multimodal instructions
- context-aware prompt prefixing

Gap:

- the DOCX includes a small embedded scholarship knowledge block
- current repo prefers retrieval/corpus grounding over stuffing static scholarship facts into the system prompt

Recommendation:

- keep current prompt architecture

### Prompt 5 — Main chat API route

Status: **Present and much stronger**

Evidence:

- [app/api/chat/route.ts](C:/Users/User/scholorhaab/app/api/chat/route.ts)
- [lib/server/chat-api.ts](C:/Users/User/scholorhaab/lib/server/chat-api.ts)

Current repo already has:

- thin API wrapper
- deep server orchestration
- auth resolution
- cache
- usage preview/commit
- rate limiting
- retrieval
- multimodal file handling
- citations/debug payloads

Gap:

- none functionally
- only documentation simplicity

Recommendation:

- absolutely do not replace with the simpler DOCX route

### Prompt 6 — File input handler

Status: **Present and much stronger**

Evidence:

- [lib/server/file-input.ts](C:/Users/User/scholorhaab/lib/server/file-input.ts)

Current repo supports more than the DOCX asks for:

- images
- PDFs
- scanned/low-signal PDFs
- DOCX
- TXT / CSV / JSON
- XLS / XLSX
- PPTX
- traceability and warnings

Gap:

- none at the feature level

Recommendation:

- keep current implementation

### Prompt 7 — Usage tracking & SQL

Status: **Mostly present**

Evidence:

- [docs/sql/001_daily_usage.sql](C:/Users/User/scholorhaab/docs/sql/001_daily_usage.sql)
- [docs/sql/002_chat_history.sql](C:/Users/User/scholorhaab/docs/sql/002_chat_history.sql)
- [docs/sql/003_identity_and_subscriptions.sql](C:/Users/User/scholorhaab/docs/sql/003_identity_and_subscriptions.sql)
- [docs/sql/011_high_security_rls_and_limits.sql](C:/Users/User/scholorhaab/docs/sql/011_high_security_rls_and_limits.sql)

Current repo already has:

- profiles
- subscriptions
- daily usage
- chat sessions/messages
- triggers and RLS

Gap:

- names and exact shapes differ from the DOCX
- current schema is more product-specific than the generic DOCX version

Recommendation:

- no rewrite needed

### Prompt 8 — Security hardening

Status: **Partial**

Evidence:

- [lib/server/auth.ts](C:/Users/User/scholorhaab/lib/server/auth.ts)
- [lib/server/rate-limit.ts](C:/Users/User/scholorhaab/lib/server/rate-limit.ts)
- [lib/server/request-body.ts](C:/Users/User/scholorhaab/lib/server/request-body.ts)
- [proxy.ts](C:/Users/User/scholorhaab/proxy.ts)

Current repo already has:

- auth resolution
- bearer/cookie identity support
- rate limiting
- request body parsing
- route protection

Gap:

- the specific security headers from the DOCX are not being added in `proxy.ts`
- there is no dedicated `lib/security.ts` wrapper file matching the prompt pack shape

Recommendation:

- if adopting anything from Prompt 8, add response security headers in the edge/proxy layer

## Bottom Line

The DOCX is **not a missing implementation blueprint** for ScholarHAAB. It is a **lighter-weight backend optimization pack** that mostly describes systems the repo already has in richer form.

The real gaps are:

1. clearer documentation of current cache and usage architecture
2. explicit API security headers at the edge
3. cleanup of legacy vs current cache naming
