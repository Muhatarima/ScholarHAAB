# PASS_FAIL_MATRIX

Generated: 2026-04-10T09:16:52.905Z

| Check | Threshold | Actual | Status | Notes |
|---|---|---|---|---|
| Verified target-resource coverage | 100.00% actionable coverage | 100.00% | PASS | Indexed coverage over actionable target slots. Raw slot coverage is 84.23% including excluded, optional, blocked, and not-yet-published rows. |
| Low-confidence rows flagged | All flagged, none hidden | 727 flagged | PASS | Low-confidence rows are now explicitly written into LOW_CONFIDENCE_ITEMS_REPORT.md and TODO_FIX_DATA.json. |
| Strict topic classification coverage | 100.00% | 100.00% | PASS | Every question must map to subject > topic > subtopic; low-confidence mappings are tracked separately. |
| Low-confidence taxonomy rows flagged | All flagged, none hidden | 79 flagged below 0.6 | PASS | Manual-review taxonomy rows are written to output/manual_review_queue.json. |
| RAG benchmark pass rate | 100% | 33/33 | PASS | Uses logs/rag-eval/latest_summary.json. |
| Citation correctness | 100% | 8/8 | PASS | Critical for grounded release claims. |
| QA suite | 100% pass, average >= 95 | 16/16, avg 99 | PASS | Uses logs/qa/latest_qa_results.txt. |
