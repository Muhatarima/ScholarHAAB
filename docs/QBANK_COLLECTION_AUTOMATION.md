# QBank Collection Automation

You do **not** need to download every page manually.

Use this flow:

## 1. Fetch source pages automatically

```bash
node scripts/fetch_qbank_source_pages.mjs --limit 40
```

This reads:

- [qbank_source_manifest.jsonl](C:/Users/User/scholorhaab/data/qbank_source_manifest.jsonl)

And saves:

- `data/qbank_collection/raw_pages/*.html`
- `data/qbank_collection/fetch_manifest.jsonl`

Notes:

- it fetches HTML pages, not every PDF
- it skips proxy-only sources unless you pass `--include-proxy`
- use `--limit` first to test on a small batch

## 2. Extract and rank links from those pages

```bash
node scripts/extract_qbank_catalog_links.mjs
```

This writes:

- `data/qbank_collection/extracted_links.jsonl`
- `data/qbank_collection/priority_queue.jsonl`
- `data/qbank_collection/link_summary.json`

The priority queue favors:

- official Cambridge links
- official Pearson/Edexcel links
- past-paper and syllabus-like pages
- official PDFs

## 3. Clean the extracted links into usable queues

```bash
node scripts/build_qbank_collection_queues.mjs
```

This writes:

- `data/qbank_collection/queues/official_catalog_queue.jsonl`
- `data/qbank_collection/queues/official_pdf_queue.jsonl`
- `data/qbank_collection/queues/official_subject_queue.jsonl`
- `data/qbank_collection/queues/discovery_queue.jsonl`
- `data/qbank_collection/queues/review_queue.jsonl`
- `data/qbank_collection/queues/rejected_queue.jsonl`
- `data/qbank_collection/queues/generated_source_manifest.jsonl`

The generated source manifest is picked up automatically by:

- `scripts/import_qbank_sources.mjs`
- `lib/server/qbank-sources.ts`

This step removes noisy links like:

- template placeholders
- news or marketing pages
- admin/support pages
- utility pages

## 4. Convert real batches into product data

Use:

- [QBANK_BATCH_IMPORT.md](C:/Users/User/scholorhaab/docs/QBANK_BATCH_IMPORT.md) for paper catalogs
- [QBANK_SEED_BATCH_IMPORT.md](C:/Users/User/scholorhaab/docs/QBANK_SEED_BATCH_IMPORT.md) for topic/question batches

## 4.5 Promote the best official candidates automatically

```bash
node scripts/promote_qbank_candidates_to_data.mjs
```

This creates:

- `data/qbank_seed_promoted_auto.jsonl`
- `data/qbank_paper_promoted_auto.jsonl`
- `data/qbank_collection/promoted/promoted_summary.json`

These files are picked up automatically by the existing QBank loaders because they match:

- `qbank_seed*.jsonl`
- `qbank_paper*.jsonl`

## 4.6 Download official PDF candidates

```bash
node scripts/download_qbank_official_pdfs.mjs --limit 12
```

This creates:

- `data/qbank_collection/downloads/download_manifest.jsonl`
- `data/qbank_collection/downloads/download_failures.jsonl`
- `data/qbank_collection/downloads/download_summary.json`
- `data/qbank_collection/downloaded_pdfs/...`

Use `--board Cambridge` or `--board Edexcel` to focus the run.
Use `--resource-group paper --skip-known` to focus on new question papers, mark schemes, and examiner reports.

## 4.7 Index the downloaded PDFs into structured drafts

```bash
node scripts/index_qbank_downloaded_pdfs.mjs
```

This creates:

- `data/qbank_collection/indexed/downloaded_pdf_index.jsonl`
- `data/qbank_collection/indexed/downloaded_pdf_seed_drafts.jsonl`
- `data/qbank_collection/indexed/downloaded_pdf_paper_drafts.jsonl`
- `data/qbank_collection/indexed/downloaded_pdf_index_summary.json`

These indexed drafts stay separate for now so we can review them before merging them into the main QBank data pack.

## 4.8 Promote indexed official PDFs into additive QBank data

```bash
node scripts/promote_indexed_qbank_pdfs_to_data.mjs
```

This creates:

- `data/qbank_seed_pdf_indexed_auto.jsonl`
- `data/qbank_paper_pdf_indexed_auto.jsonl`
- `data/qbank_collection/promoted/pdf_indexed_promoted_summary.json`

## 4.9 Run the whole PDF pipeline in one command

```bash
node scripts/run_qbank_pdf_pipeline.mjs --resource-group paper --skip-known --limit 20
```

This runs:

- `download_qbank_official_pdfs.mjs`
- `index_qbank_downloaded_pdfs.mjs`
- `promote_indexed_qbank_pdfs_to_data.mjs`

## 4.9b Backfill multiple paper batches automatically

```bash
node scripts/backfill_qbank_pdf_pipeline.mjs --resource-group paper --limit 20 --rounds 3
```

This repeats the paper pipeline, then refreshes:

- extracted paper text
- visual flags
- derived question spans

## 4.10 Extract text from downloaded official PDFs

```bash
node scripts/extract_qbank_pdf_text.mjs --limit 30
```

This creates:

- `data/qbank_collection/extracted_text/pdf_text_index.jsonl`
- `data/qbank_collection/extracted_text/pdf_text_chunks.jsonl`
- `data/qbank_collection/extracted_text/pdf_visual_flags.jsonl`
- `data/qbank_collection/extracted_text/pdf_text_summary.json`

This step also flags visual-heavy documents so diagrams, graphs, tables, and image-rich biology papers stay visible in the retrieval layer.

## 4.11 Derive question and answer spans from official paper text

```bash
node scripts/derive_qbank_question_spans.mjs
```

This creates:

- `data/qbank_seed_pdf_question_auto.jsonl`
- `data/qbank_collection/derived_questions/question_span_candidates.jsonl`
- `data/qbank_collection/derived_questions/answer_span_candidates.jsonl`
- `data/qbank_collection/derived_questions/question_span_summary.json`

## 5. Import everything

```bash
node scripts/import_all_qbank_data.mjs
```

## Best practice

- treat official Cambridge/Pearson as truth
- treat PapaCambridge and Physics & Maths Tutor as discovery
- turn discovery results into structured rows before using them in chat
