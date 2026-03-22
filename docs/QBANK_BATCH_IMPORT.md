# QBank Batch Import

Use this when you collect larger paper catalogs from official Cambridge or Edexcel pages.

## 1. Normalize the raw batch

```bash
node scripts/normalize_qbank_paper_batch.mjs --input path/to/raw-papers.jsonl --output data/qbank_paper_manifest.generated.jsonl
```

Accepted raw fields:

- `board`
- `level`
- `subject`
- `year`
- `paper`
- `paper_code`
- `paper_title`
- `session`
- `focus_topics`
- `source_label`
- `source_url`
- `quality_tier`

The normalizer also accepts fallback names like:

- `exam_board`
- `qualification`
- `exam_year`
- `paper_name`
- `paper_label`
- `title`
- `topics`
- `tags`
- `url`

## 2. Import into Supabase

```bash
node scripts/import_qbank_papers.mjs --input data/qbank_paper_manifest.generated.jsonl
```

## 3. Product result

This feeds:

- `/api/qbank/paper-search`
- `/api/qbank/catalog`
- `/qbank/search`

The goal is cheap structured retrieval before LLM generation.
