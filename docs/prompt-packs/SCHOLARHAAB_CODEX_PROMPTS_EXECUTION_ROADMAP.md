# ScholarHAAB Codex Prompts Execution Roadmap

Source prompt: [SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md)

This is the shortest safe roadmap for applying the useful parts of the DOCX prompt pack to the current repo.

## Guiding Rule

Do not overwrite stronger current systems with simpler DOCX versions.

## Phase 1 — Safe alignment

Goal:

- document what is already stronger than the DOCX
- prevent accidental downgrades

Tasks:

1. keep current `lib/ai-service.ts` as canonical
2. keep current `lib/server/chat-api.ts` as canonical
3. keep current `lib/server/file-input.ts` as canonical
4. use this prompt-pack doc set as the translation layer for future contributors

Acceptance criteria:

- no engineer mistakes the DOCX for a literal replacement plan

## Phase 2 — Close the real gaps

Goal:

- adopt only the missing benefits

Tasks:

1. document the active cache architecture
   - canonical path
   - legacy path
   - TTL rules
   - personal-question skip rules
2. document token-cost control
   - provider order
   - fallback behavior
   - quota guard
   - where token estimation is logged
3. add security headers in the proxy/edge layer for API routes
4. optionally expose token-budget reasoning in admin/ops docs

Acceptance criteria:

- cost, cache, and security behavior are easy to audit

## Phase 3 — Cleanup and consolidation

Goal:

- reduce ambiguity in backend architecture

Tasks:

1. decide whether `cached_answers` is legacy-only or still active
2. if legacy-only:
   - mark it clearly in docs
   - avoid new code touching it
3. if still active:
   - document the reason for both cache layers
4. update backend docs so usage/limits are explained once, not across multiple disconnected files

Acceptance criteria:

- one clear explanation exists for usage + cache + security

## Priority Order

### Must do

- preserve current advanced backend
- document current reality
- add edge security headers if still missing

### Should do

- consolidate cache naming/docs
- explain token-cost policy for ops and product use

### Nice to have

- admin-facing token spend summary
- prompt-pack compliance checklist

## What To Avoid

Do not:

- collapse `chat-api.ts` into a simple one-file handler
- replace advanced multipart handling with the minimal DOCX version
- replace credit-based usage with a naive token-only gate unless there is a product decision to do so
- move static scholarship facts into the system prompt if retrieval already provides the better source of truth

## Recommended Next Concrete Step

If continuing from this roadmap, the best next implementation task is:

1. add API security headers in [proxy.ts](C:/Users/User/scholorhaab/proxy.ts)
2. write a short backend architecture note explaining:
   - AI provider chain
   - usage/credit enforcement
   - `answer_cache` vs `cached_answers`
   - why `chat-api.ts` is the real orchestration layer

That gives the biggest clarity gain with the least risk to the current production-ready backend.
