# BUG_TO_REGRESSION_WORKFLOW

1. Reproduce the bug with the smallest possible query/file set.
2. Save the failing case into the eval or regression suite.
3. Fix the root cause, not only the symptom.
4. Re-run the failing case first.
5. Re-run the wider suite.
6. Record the before/after evidence in the bug or PR notes.
