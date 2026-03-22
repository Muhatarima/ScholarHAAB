# ScholarHAAB Build Roadmap

## Phase 1: Platform Backbone

Goal: turn the current prototype shell into a real multi-product app skeleton.

Build:

- product selection flow from landing page
- product-specific routes: `/abroad` and `/qbank`
- server-side auth/session handling
- `profiles` and `user_daily_usage`
- usage-limit checks
- shared chat session and message storage

Exit condition:

- a signed-in user can enter either product
- daily usage is enforced correctly
- chat history is saved safely

## Phase 2: Abroad MVP

Goal: make the scholarship consultant genuinely useful.

Build:

- official scholarship retrieval layer
- scholarship matcher by profile
- country/cost/finance guidance retrieval
- SOP/LOR review flow
- roadmap generator

Exit condition:

- the product can answer scholarship questions with retrieval
- the product can review an SOP/LOR with structured feedback
- the product can produce a realistic action plan

## Phase 3: QBank MVP

Goal: make the tutor side accurate and clearly better than a generic chat bot.

Build:

- paper and question index
- direct-mode solving route
- tutor-mode guided solving route
- board, subject, year, chapter search
- topic importance and repeat-question lookup

Exit condition:

- a user can ask for a solution directly
- a user can enter tutor mode and be guided
- the app can search by board, year, topic, and paper

## Phase 4: Trial, Billing, and Limits

Goal: make the product commercially usable.

Build:

- 7-day trial logic
- Pro and Premium tiers
- upgrade prompts and plan gating
- billing integration

Exit condition:

- trial users are tracked correctly
- paid tiers unlock the right limits

## Phase 5: Quality and Trust Layer

Goal: reduce hallucination and make the product safer.

Build:

- citation UI for abroad answers
- source freshness indicators
- review queue for weak/generated content
- evaluation dataset and benchmark runs
- feedback review workflow

Exit condition:

- high-stakes answers are clearly source-backed
- you can measure whether quality is improving

## Immediate Next Task

Implement Phase 1 first.

Inside Phase 1, the best first coding slice is:

1. create `/abroad` and `/qbank`
2. make the current chat page reusable for both
3. pass `product` and `mode` through the API
4. prepare shared usage-limit and auth utilities

This is the smallest step that moves the app from concept to platform.
