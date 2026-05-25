# DUPLICATE_ITEMS_REPORT

Generated: 2026-04-10T09:16:26.974Z

## Current Verified Coverage Percentage

100.00%

## Duplicate Summary

- Duplicate groups detected: 0

## Duplicate Clusters

- No duplicate clusters detected.

## Exact Fix Tasks

1. Collapse duplicate compiled rows before feed-safe export.
2. Prefer the cleanest row in each duplicate cluster using validation severity and source quality.
3. Add duplicate-cluster checks to ingestion CI so the duplicate count cannot silently rise.
