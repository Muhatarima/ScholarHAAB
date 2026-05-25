# HAAB Combined Prompt Pack Execution Roadmap

Source prompt: [HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md)

This is the shortest realistic path from the current ScholarHAAB repo to the prompt pack's required output set.

## Priority Order

### Wave 0 - Protect launch quality

Goal: do not launch with fake completeness.

Build:

1. canonical coverage matrix generator
2. missing-items report generator
3. duplicate-items report generator
4. low-confidence report generator
5. `TODO_FIX_DATA.json`

Acceptance criteria:

- every run outputs the five artifacts
- CI fails if coverage drops or report generation breaks
- release notes can cite a machine-generated coverage percentage

## Wave 1 - OCR and extraction trust layer

Goal: make broken inputs visible instead of silently accepted.

Build:

1. scan-quality score per page
2. page-order and partial-extraction checks
3. math/symbol corruption checks
4. low-confidence review queue
5. before/after OCR example set

Acceptance criteria:

- low-confidence scans are routed to review instead of being treated as valid source truth
- unresolved extraction failures are listed in a durable report

## Wave 2 - Taxonomy and classifier

Goal: no question left uncategorized without being flagged.

Build:

1. `data/taxonomy/taxonomy.json`
2. `data/taxonomy/topic_synonyms.json`
3. confidence-based classifier pipeline
4. `output/uncategorized_report.json`
5. classifier evaluation report

Acceptance criteria:

- every indexed question receives subject/topic/subtopic or enters the manual-review queue
- classifier confidence threshold is explicit and test-covered

## Wave 3 - Solver-mode expansion

Goal: move from "good tutor" to "mode-complete teacher engine."

Build:

1. direct answer mode
2. standard step-by-step mode
3. alternative method mode
4. intuition-first mode
5. beginner mode
6. shortcut mode
7. trap-analysis mode
8. hint-only mode
9. revision mode
10. similar-question suggestion mode

Acceptance criteria:

- every mode has a prompt template, sample output, and at least one automated eval
- math formatting remains clean across modes

## Wave 4 - Hard release gate

Goal: deployment can be blocked by evidence, not opinion.

Build:

1. `docs/RELEASE_GATE.md`
2. `docs/PASS_FAIL_MATRIX.md`
3. benchmark threshold config
4. release smoke checklist
5. blocker summary generation

Acceptance criteria:

- deployment is blocked if any critical benchmark or coverage rule fails
- thresholds are numeric, not subjective

## Wave 5 - Continuous quality operations

Goal: no bug repeats silently after launch.

Build:

1. weekly quality report template
2. failure triage pipeline doc
3. bug-to-regression workflow doc
4. automated clustering for low-confidence and failed queries

Acceptance criteria:

- every production failure maps to a ticket + regression + data/prompt fix path

## 30 / 60 / 90 Day Plan

### 30 days

- ship coverage matrix and all gap reports
- add low-confidence extraction routing
- draft taxonomy skeleton for core flagship subjects
- add release-gate docs

### 60 days

- complete taxonomy + classifier evaluation
- expand solver modes beyond direct/tutor
- wire benchmark exports and break/fix reports
- add weekly quality pipeline

### 90 days

- broaden subject coverage depth
- formalize manual-review workflows
- tighten mobile release readiness
- automate recurring coverage and quality checks in CI/CD

## Must-Build

- coverage proof artifacts
- low-confidence handling
- taxonomy outputs
- manual-review queue for uncategorized/weak OCR
- release gate and pass/fail matrix

## Should-Build

- full solver-mode library
- benchmark CSV exports
- OCR before/after artifact pack
- weekly quality reports

## Later-Build

- wider document-coaching intelligence
- more advanced prediction/recommendation layers
- broader mobile-native polish beyond core learning and guidance flows

## Exact Implementation Task List

1. Create `scripts/generate_coverage_reports.mjs`.
2. Create `scripts/validate_coverage_matrix.mjs`.
3. Create `docs/reports/` output targets for coverage and gap artifacts.
4. Add extraction confidence and corruption validators to the file/document pipeline.
5. Create `data/taxonomy/` and seed the first strict taxonomy.
6. Create classifier scoring + thresholding + manual-review queue output.
7. Add prompt library docs and fixtures for all solver modes.
8. Add eval cases for each new solver mode.
9. Generate `BREAK_REPORT.md`, `FIX_PLAN.md`, and `BENCHMARK_RESULTS.csv` from the current eval system.
10. Create `RELEASE_GATE.md` and `PASS_FAIL_MATRIX.md` from the existing `prod:check`, `qa`, and `eval:rag` gates.
11. Add weekly quality template and bug-to-regression workflow docs.
12. Re-run the full gate: build, regressions, eval, QA, prod check.
