# RELEASE_GATE

Generated: 2026-04-10T09:16:52.904Z

## Rule

Release is blocked if any critical row in PASS_FAIL_MATRIX.md is BLOCK.

## Hard Rules

- No silent failures
- No fake completeness claims
- All low-confidence items must be explicitly flagged
- Retrieval, grounding, citations, and QA must stay green
- Coverage and taxonomy claims must come from generated proof artifacts, not memory

## Current Gate Status

PASSABLE with the current measured thresholds.

## Current Blockers

- None from the current measured matrix.

## Required Commands Before Release

- `npm run proof:coverage`
- `npm run proof:taxonomy`
- `npm run proof:release`
- `npm run proof:validate`
- `npm run eval:rag`
- `npm run qa`
- `npm run prod:check`
- `npm run build`
