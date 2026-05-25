# HAAB Combined Prompt Pack Action Plan

Source prompt: [HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md](C:/Users/User/scholorhaab/docs/prompt-packs/HAAB_COMBINED_CODEX_PROMPTS_EXTRACT.md)

This turns the PDF into concrete implementation tracks for ScholarHAAB.

## 1. What The Prompt Is Really Asking For

The prompt pack is not one task. It is five linked programs:

1. Build a trustworthy ingestion and coverage pipeline.
2. Build a strict subject/topic taxonomy and classifier.
3. Build a teacher-grade solver engine with multiple explanation modes.
4. Build a measurable RAG reliability + release gate system.
5. Keep the team focused on one flagship wedge instead of shipping three half-finished products.

## 2. Product Recommendation

### Flagship product

Launch **A/O Level + admission QBank solving** first.

Why:

- highest repeat usage
- easiest to verify objectively
- strongest current repo foundation
- clearest monetization path through daily study habit
- best fit for the existing multimodal upload and retrieval stack

### Second product

Launch **scholarship + study-abroad intelligence** second.

Why:

- valuable, but freshness-sensitive
- harder to verify exhaustively than exam content
- more likely to cause trust damage if presented too early without stricter official-source verification

### Later research product

Keep **deep document evaluation and profile-coaching intelligence** as the later layer.

Why:

- high value, but needs stronger rubricing, scoring consistency, and human-review style outputs

## 3. Immediate Build Tracks

### Track A: Data completeness and coverage proof

Deliver:

- canonical coverage matrix
- missing-items report
- duplicate-items report
- low-confidence report
- CI gate that fails if coverage drops

Acceptance criteria:

- every indexed paper/question has board, subject, year, source, extraction status, and confidence
- every missing target can be listed explicitly
- no "fully complete" claim without a machine-generated report

### Track B: OCR and scanned PDF rescue

Deliver:

- preprocessing pipeline for scanned files
- formula-safe normalization
- per-page and per-question confidence scoring
- review queue for unreadable items

Acceptance criteria:

- unreadable scans are flagged, not silently treated as valid
- question boundary failures are visible in reports
- math and chemistry symbol corruption is measured

### Track C: Taxonomy and classification

Deliver:

- `taxonomy.json`
- `topic_synonyms.json`
- `uncategorized_report.json`
- classifier evaluation report

Acceptance criteria:

- every question maps to subject > topic > subtopic or lands in a manual-review queue
- no vague catch-all labels except explicit review buckets

### Track D: Solver engine quality

Deliver:

- prompt library for all answer modes
- subject-specific solver prompts
- evaluation rubric
- sample outputs

Acceptance criteria:

- each supported answer mode is callable and testable
- beginner mode is simpler than direct mode
- hint mode does not leak the full answer
- trap-analysis mode explains common wrong paths

### Track E: RAG reliability and release gates

Deliver:

- red-team benchmark set
- benchmark CSV
- break report
- pass/fail release matrix

Acceptance criteria:

- every release candidate runs retrieval, grounding, citation, abstention, and latency checks
- deployment is blocked when critical thresholds fail

### Track F: Continuous quality operations

Deliver:

- failure triage pipeline
- weekly quality report template
- bug-to-regression workflow

Acceptance criteria:

- every real production failure can be traced to dataset, retrieval, reasoning, or UX
- every recurring failure becomes a regression case

## 4. Proposed Output Set For This Repo

These are the missing artifacts the prompt pack expects and the repo should eventually generate:

- `docs/reports/COMPLETE_COVERAGE_REPORT.md`
- `docs/reports/MISSING_ITEMS_REPORT.md`
- `docs/reports/DUPLICATE_ITEMS_REPORT.md`
- `docs/reports/LOW_CONFIDENCE_ITEMS_REPORT.md`
- `output/TODO_FIX_DATA.json`
- `data/taxonomy/taxonomy.json`
- `data/taxonomy/topic_synonyms.json`
- `output/uncategorized_report.json`
- `docs/reports/CLASSIFIER_EVALUATION_REPORT.md`
- `docs/reports/BREAK_REPORT.md`
- `docs/reports/FIX_PLAN.md`
- `output/BENCHMARK_RESULTS.csv`
- `tests/regressions/`
- `docs/RELEASE_GATE.md`
- `docs/PASS_FAIL_MATRIX.md`
- `docs/WEEKLY_QUALITY_REPORT_TEMPLATE.md`

## 5. What To Build First

Order:

1. Coverage proof and missing-data reporting
2. OCR confidence + low-quality routing
3. Taxonomy + classifier + uncategorized queue
4. Solver-mode expansion
5. Release gate and pass/fail matrix
6. Continuous quality loop

Why this order:

- the prompt pack's biggest rule is "do not claim completeness without evidence"
- right now the repo can answer well in many cases, but it still lacks full proof artifacts
- solving quality improves faster when coverage gaps and classification gaps are machine-visible

## 6. What Not To Do Yet

Do not expand feature scope before these are real:

- complete coverage accounting
- low-confidence reporting
- taxonomy outputs
- release-gate docs and thresholds
- solver-mode test matrix

That is the difference between a strong demo and a release-ready education platform.
