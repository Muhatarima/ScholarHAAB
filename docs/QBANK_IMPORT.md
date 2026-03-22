# QBank Import

Run these in order:

1. `005_qbank_core.sql`
2. `006_qbank_sources.sql`
3. `007_qbank_papers.sql`

Then import:

```bash
node scripts/import_qbank_seed.mjs
node scripts/import_qbank_sources.mjs
node scripts/import_qbank_papers.mjs
```

Or run everything together:

```bash
node scripts/import_all_qbank_data.mjs
```

Required env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Seed imports stay cheap and let QBank answer from structured paper/topic metadata instead of asking the model to guess.

For larger official paper catalogs, use [QBANK_BATCH_IMPORT.md](C:/Users/User/scholorhaab/docs/QBANK_BATCH_IMPORT.md).

For larger official topic/question batches, use [QBANK_SEED_BATCH_IMPORT.md](C:/Users/User/scholorhaab/docs/QBANK_SEED_BATCH_IMPORT.md).

For automated source-page collection and link extraction, use [QBANK_COLLECTION_AUTOMATION.md](C:/Users/User/scholorhaab/docs/QBANK_COLLECTION_AUTOMATION.md).
