from __future__ import annotations

import argparse
import json
from collections import Counter
from pipeline.storage import get_supabase_client, read_review_queue
from pipeline.utils import OUTPUT_DIR, logger, read_jsonl


def _load_local_bucket(kind: str) -> list[dict]:
    rows: list[dict] = []
    for path in OUTPUT_DIR.glob(f"*_{kind}.jsonl"):
        rows.extend(read_jsonl(path))
    return rows


def show_dashboard(show_review_queue: bool = False) -> None:
    client = get_supabase_client()
    stats_rows: list[dict]
    formula_rows: list[dict] = []
    concept_rows: list[dict] = []
    if client is not None:
        try:
            result = client.table("qbank_chunks").select(
                "board, level, subject, verified, enriched", count="exact"
            ).execute()
            stats_rows = result.data or []
            formula_rows = (client.table("formula_bank").select("id", count="exact").execute().data or [])
            concept_rows = (client.table("concept_bank").select("id", count="exact").execute().data or [])
        except Exception as exc:
            logger.warning(f"Supabase dashboard query failed, falling back to local files: {exc}")
            stats_rows = _load_local_bucket("questions")
            formula_rows = _load_local_bucket("formulas")
            concept_rows = _load_local_bucket("concepts")
    else:
        stats_rows = _load_local_bucket("questions")
        formula_rows = _load_local_bucket("formulas")
        concept_rows = _load_local_bucket("concepts")

    total = len(stats_rows)
    verified = sum(1 for row in stats_rows if row.get("verified"))
    enriched = sum(1 for row in stats_rows if row.get("enriched"))
    by_subject = Counter(
        f"{row.get('board', 'Unknown')} {row.get('level', 'Unknown')} {row.get('subject', 'Unknown')}"
        for row in stats_rows
    )

    print("\n" + "=" * 60)
    print("SCHOLARHAAB DATASET PIPELINE DASHBOARD")
    print("=" * 60)
    print(f"Total records:  {total:,}")
    print(f"Verified:       {verified:,} ({(verified / max(total, 1)) * 100:.1f}%)")
    print(f"Enriched:       {enriched:,} ({(enriched / max(total, 1)) * 100:.1f}%)")
    print(f"Formula rows:   {len(formula_rows):,}")
    print(f"Concept rows:   {len(concept_rows):,}")
    print("\nTop subjects by record count:")
    for subject, count in by_subject.most_common(10):
        print(f"  {subject:<40} {count:>5}")

    if show_review_queue:
        review_rows = read_review_queue()
        print("\nReview queue:")
        print(json.dumps(review_rows[:20], indent=2, ensure_ascii=False))

    latest_run_path = OUTPUT_DIR / "pipeline_run_results.jsonl"
    if latest_run_path.exists():
        runs = read_jsonl(latest_run_path)
        if runs:
            latest = runs[-1]
            print("\nLatest pipeline run:")
            print(json.dumps(latest, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="ScholarHAAB pipeline dashboard")
    parser.add_argument("--show-review-queue", action="store_true")
    args = parser.parse_args()
    show_dashboard(show_review_queue=args.show_review_queue)


if __name__ == "__main__":
    main()
