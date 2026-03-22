# QBank Topic/Question Batch Import

Use this when you collect larger official topic or question batches for QBank.

## 1. Normalize the raw batch

```bash
node scripts/normalize_qbank_seed_batch.mjs --input path/to/raw-qbank-seed.jsonl --output data/qbank_seed.generated.jsonl
```

Accepted topic-style fields:

- `board`
- `level`
- `subject`
- `chapter`
- `topic`
- `importance_score`
- `repeat_years`
- `exam_tips`
- `summary`
- `search_text`
- `source_label`
- `source_url`

Accepted question-style fields:

- `board`
- `level`
- `subject`
- `chapter`
- `topic`
- `year`
- `paper`
- `question_label`
- `question_text`
- `answer_summary`
- `method_steps`
- `repeat_signal`
- `source_label`
- `source_url`

Fallback names also work, including:

- `exam_board`
- `qualification`
- `unit`
- `section`
- `topic_name`
- `questionText`
- `answerSummary`
- `steps`
- `paper_name`
- `paper_label`
- `exam_year`
- `url`

## 2. Import into Supabase

```bash
node scripts/import_qbank_seed.mjs --input data/qbank_seed.generated.jsonl
```

## 3. Product result

This feeds:

- `/api/qbank/chat`
- `/api/qbank/search`
- `/api/qbank/topic-search`
- `/api/qbank/question-search`

The goal is cheap topic/question retrieval before the model writes the final answer.
