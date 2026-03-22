# RAG Import

Use the generated seed files from `Playground`:

- `C:/Users/User/Documents/Playground/dataset_pack/official_rag/supabase_rag_documents_main_seed.jsonl`
- `C:/Users/User/Documents/Playground/dataset_pack/official_rag/supabase_rag_documents_auxiliary_seed.jsonl`

Required SQL:

- [004_rag_documents.sql](C:/Users/User/scholorhaab/docs/sql/004_rag_documents.sql)

Main tier import:

```bash
node scripts/import_rag_documents.mjs --tier main
```

Auxiliary tier import:

```bash
node scripts/import_rag_documents.mjs --tier aux
```

Test a small slice first:

```bash
node scripts/import_rag_documents.mjs --tier main --limit 50 --batch-size 50
```

Recommended order:

1. create the SQL objects
2. import `main`
3. verify retrieval quality
4. import `aux` only if needed
