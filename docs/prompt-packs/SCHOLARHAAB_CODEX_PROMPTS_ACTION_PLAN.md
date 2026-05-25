# ScholarHAAB Codex Prompts Action Plan

Source prompt: [SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/SCHOLARHAAB_CODEX_PROMPTS_EXTRACT.md)

This prompt pack should **not** be applied literally over the current repo. ScholarHAAB already has a stronger backend than the DOCX assumes. The right move is to treat the DOCX as an optimization checklist and selectively absorb the useful parts.

## 1. What The DOCX Is Really Asking For

It wants five backend outcomes:

1. cheaper model usage
2. stronger cache hit rate
3. clearer subscription/limit enforcement
4. simpler prompt discipline
5. safer API/security defaults

## 2. Best Interpretation For The Current Repo

Do **not** downgrade the current architecture into the simple single-route version from the DOCX.

Instead:

- keep the current `lib/server/chat-api.ts` orchestration
- keep the current multimodal file handler
- keep the current retrieval and product routing
- use the DOCX as a delta checklist for:
  - token-budget visibility
  - cache policy clarity
  - security header hardening
  - documentation cleanup

## 3. Immediate Work Tracks

### Track A — Cost visibility and token governance

Deliver:

- one documented source of truth for:
  - provider order
  - max token defaults
  - fallback rules
  - quota guard behavior
- optional admin-facing token budget summary

Acceptance criteria:

- product team can explain exactly how token spend is controlled
- no duplicate or contradictory token-limit logic across files

### Track B — Cache policy cleanup

Deliver:

- one canonical explanation of:
  - `cached_answers` legacy path
  - `answer_cache` current path
  - personal-question skip rules
  - TTL rules

Acceptance criteria:

- engineers can tell which cache layer is active
- repeated-question behavior is measurable and auditable

### Track C — Security baseline hardening

Deliver:

- API security header coverage
- explicit documentation of auth, rate limit, and sanitization flow

Acceptance criteria:

- security behavior is visible at the edge and in code
- no ambiguity about whether `/api/*` gets headers

### Track D — Prompt-pack alignment docs

Deliver:

- this extract
- gap analysis
- roadmap

Acceptance criteria:

- future engineers do not paste these prompts blindly and accidentally remove stronger existing systems

## 4. What To Reuse From The DOCX

Keep these ideas:

- cost-aware provider fallback
- stronger cache-first mentality
- clear tier/limit messaging
- strict no-filler prompts
- small, testable implementation order

## 5. What Not To Copy Literally

Do not replace current ScholarHAAB systems with the DOCX versions of:

- `lib/ai-service.ts`
- `app/api/chat/route.ts`
- file handling
- usage control

Reason:

- the repo already has multipart handling, provider runtime health, retries, quota safeguards, debug observability, richer usage flow, and better multimodal extraction than the DOCX version.

## 6. Recommended Next Engineering Step

Use this prompt pack as a **backend audit sheet**, then implement only the missing deltas:

1. document the active cache architecture
2. add/confirm API security headers in the edge layer
3. expose token-budget reasoning more clearly in docs and, if needed, admin stats
4. remove any dead/legacy ambiguity between `cached_answers` and `answer_cache`
