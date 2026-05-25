# FAILURE_TRIAGE_PIPELINE

1. Capture the failing query, files, sources, and debug context.
2. Label the failure as one of: data gap, OCR issue, retrieval issue, reasoning issue, citation issue, UX issue.
3. Decide whether the root cause is:
   - missing data
   - corrupted data
   - weak retrieval
   - prompt/solver failure
   - UI/rendering failure
4. Create:
   - one bug ticket
   - one dataset or logic fix task
   - one regression case
5. Re-run:
   - targeted regression
   - `npm run eval:rag`
   - `npm run qa` if answer behavior changed
6. Close the issue only when the regression is green.
