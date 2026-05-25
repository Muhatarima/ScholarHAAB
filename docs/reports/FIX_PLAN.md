# FIX_PLAN

Generated: 2026-04-10T09:16:52.905Z

## Highest-priority fixes

1. Raise verified target-resource coverage above the release threshold.
2. Reduce generic-topic rows so strict taxonomy coverage clears the threshold.
3. Keep low-confidence and duplicate counts from rising via `npm run proof:validate`.

## Exact next engineering tasks

1. Re-run missing coverage ingestion and unblock source acquisition for high-value unresolved rows.
2. Add manual-review or classifier refinement for rows currently labeled as generic topics.
3. Keep benchmark and release-gate artifacts refreshed in CI before deploy.
