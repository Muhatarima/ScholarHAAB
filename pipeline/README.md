# ScholarHAAB Automated Dataset Pipeline

This pipeline builds verified QBank, formula, and concept records for Cambridge and Edexcel `O Level` and `A Level` coverage from `2014-2024`.

## Main modules

- `pipeline/subjects.py`
- `pipeline/sources/`
- `pipeline/schema.py`
- `pipeline/verifier.py`
- `pipeline/enricher.py`
- `pipeline/embedder.py`
- `pipeline/orchestrator.py`
- `pipeline/dashboard.py`

## Install

```bash
pip install -r pipeline/requirements.txt
playwright install chromium
```

## Run

```bash
python -m pipeline.orchestrator
python -m pipeline.orchestrator --board cambridge --level o_level --subject Chemistry
python -m pipeline.dashboard
python -m pipeline.verifier --mode retry-failed
python -m pipeline.enricher --mode enrich-only --input output/cambridge_a_level_chemistry_questions.jsonl
python -m pipeline.dashboard --show-review-queue
```

## What it uses immediately

The pipeline already reuses:

- local compiled QBank questions from `data/qbank_compiled/qbank_question_bank_feed_safe.jsonl`
- local concept/formula layers from `data/qbank_concept*.jsonl`
- HuggingFace dataset connectors
- web source discovery for public paper links
- Cambridge syllabus topic extraction

## Output

The pipeline writes:

- `output/*_questions.jsonl`
- `output/*_concepts.jsonl`
- `output/*_formulas.jsonl`
- `output/raw_sources/*.jsonl`
- `output/pipeline_runs.jsonl`
- `output/pipeline_run_results.jsonl`
- `output/quality_gate_report.json`

## Notes

- If Gemini embedding or verification is unavailable, the pipeline falls back to deterministic local heuristics instead of stopping.
- Supabase upserts are optional. If credentials are missing, local JSONL backups still complete.
- Every run now records:
  - collected / verified / auto-fixed / skipped / review counts
  - quality gate results
  - run metadata for replay/debugging
