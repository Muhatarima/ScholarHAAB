# HAAB Combined Prompt Pack Gap Analysis

Source prompt: [HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md)

This compares the prompt-pack requirements against the current ScholarHAAB repo.

## Current Readiness Snapshot

The repo is **strong on runtime app behavior** and **partial on data-governance proof**.

- Runtime/eval/deploy readiness: strong
- Multimodal uploads and RAG: strong
- Mobile architecture: present
- Coverage proof, taxonomy outputs, and release-gate documents: incomplete

## Gap Matrix

| Area | Current status | Evidence in repo | Gap |
|---|---|---|---|
| Web app architecture | Present | [ARCHITECTURE_V5.md](C:/Users/User/scholorhaab/docs/ARCHITECTURE_V5.md), [chat-api.ts](C:/Users/User/scholorhaab/lib/server/chat-api.ts) | Needs refreshed architecture doc aligned to current multimodal/mobile state |
| Mobile app architecture | Present | [mobile/README.md](C:/Users/User/scholorhaab/mobile/README.md), [mobile/App.tsx](C:/Users/User/scholorhaab/mobile/App.tsx) | Needs release-level device QA and store-readiness docs |
| Multimodal upload handling | Present | [file-input.ts](C:/Users/User/scholorhaab/lib/server/file-input.ts), [rag_eval_cases.json](C:/Users/User/scholorhaab/evals/rag_eval_cases.json) | OCR rescue is still fallback-oriented, not full preprocessing/review-queue grade |
| PDF/doc/image extraction | Present | [file-input.ts](C:/Users/User/scholorhaab/lib/server/file-input.ts) | No dedicated before/after OCR repair artifact set |
| Retrieval eval harness | Present | [rag_eval.ts](C:/Users/User/scholorhaab/scripts/rag_eval.ts), [run_regression_checks.mjs](C:/Users/User/scholorhaab/scripts/run_regression_checks.mjs) | Needs benchmark exports and break/fix docs named exactly as the prompt asks |
| Release/readiness checks | Present | [prod_ready_check.ts](C:/Users/User/scholorhaab/scripts/prod_ready_check.ts), [predeploy_check.mjs](C:/Users/User/scholorhaab/scripts/predeploy_check.mjs) | Missing hard release-gate docs like `RELEASE_GATE.md` and `PASS_FAIL_MATRIX.md` |
| QBank coverage accounting | Partial | [qbank-coverage.ts](C:/Users/User/scholorhaab/lib/server/qbank-coverage.ts), [qbank-completion.ts](C:/Users/User/scholorhaab/lib/server/qbank-completion.ts), `scripts/generate_qbank_coverage_targets.mjs` | No canonical cross-product coverage matrix and no generated coverage reports in the required filenames |
| Missing-data reporting | Partial | [qbank-gap-status.ts](C:/Users/User/scholorhaab/lib/server/qbank-gap-status.ts), missing coverage queue files under `data/qbank_collection/missing_coverage` | No repo-level `COMPLETE_COVERAGE_REPORT.md`, `MISSING_ITEMS_REPORT.md`, `LOW_CONFIDENCE_ITEMS_REPORT.md`, `TODO_FIX_DATA.json` |
| Duplicate detection | Partial | answer cache and dataset cleaning patterns exist; no single canonical report | No `DUPLICATE_ITEMS_REPORT.md` output for educational corpora |
| OCR confidence / review queue | Partial | low-signal detection in [file-input.ts](C:/Users/User/scholorhaab/lib/server/file-input.ts) | No durable review queue schema or unresolved-failure report |
| Taxonomy and synonym mapping | Partial | concepts and compiled question layers exist in `data/qbank_*`, concept retrieval exists in [qbank-concepts.ts](C:/Users/User/scholorhaab/lib/server/qbank-concepts.ts) | No `taxonomy.json`, `topic_synonyms.json`, or `uncategorized_report.json` |
| Topic classifier pipeline | Partial | concept/tag retrieval exists | No explicit confidence-based classifier pipeline + manual-review queue output |
| Solver modes | Partial | direct/tutor prompting in [prompts.ts](C:/Users/User/scholorhaab/lib/prompts.ts) | Missing explicit support for all 10 modes requested in the PDF |
| Subject-specific solver prompts | Partial | QBank and Abroad prompts exist | Missing dedicated subject prompt library for math/physics/chemistry/English/logic in reusable artifacts |
| Sample outputs + rubric | Missing | none found in required form | Needs prompt library docs and evaluation rubric |
| Continuous quality ops | Partial | [qa-feedback.ts](C:/Users/User/scholorhaab/lib/server/qa-feedback.ts), [feedback-improvement.ts](C:/Users/User/scholorhaab/lib/server/feedback-improvement.ts), QA scripts exist | Missing weekly quality report template and explicit bug-to-regression workflow docs |
| Benchmark result export | Partial | eval results written under `logs/rag-eval` | Missing stable `BENCHMARK_RESULTS.csv` and named `BREAK_REPORT.md` / `FIX_PLAN.md` |

## Verified Strengths

These prompt-pack asks are already materially present:

- multimodal file ingestion for image/PDF/DOCX/XLSX/TXT/PPTX
- grounded chat routing for QBank and Abroad
- regression testing and one-command evals
- production-readiness script
- mobile client structure with shared backend reuse
- cautious fallback behavior when evidence is weak

## Verified Missing Or Incomplete Outputs

I checked the repo for these and did not find them:

- `taxonomy.json`
- `topic_synonyms.json`
- `uncategorized_report.json`
- `COMPLETE_COVERAGE_REPORT.md`
- `MISSING_ITEMS_REPORT.md`
- `DUPLICATE_ITEMS_REPORT.md`
- `LOW_CONFIDENCE_ITEMS_REPORT.md`
- `PASS_FAIL_MATRIX.md`

## Biggest Product Risk

The product is close to deployable as an app, but it is **not yet fully provable as a complete education data system**.

That means the main risk is not "chat pipeline broken."
The main risk is:

- incomplete proof of data coverage
- incomplete proof of taxonomy completeness
- incomplete proof that all low-confidence or uncategorized items are visible

## Exact Gaps To Close

1. Generate the canonical coverage matrix across all supported exams, years, subjects, papers, and extracted assets.
2. Produce the four named coverage reports plus `TODO_FIX_DATA.json`.
3. Build the formal taxonomy outputs and classifier evaluation report.
4. Expand solver modes from `direct/tutor` into the full mode family required by the prompt pack.
5. Write hard release-gate documents with measurable thresholds and blocking conditions.
6. Add quality-ops templates so post-launch failures feed back into regressions and data repair.
