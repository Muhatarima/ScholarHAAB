from __future__ import annotations

import argparse
from pathlib import Path

from data_pipeline_common import classify_rows, ensure_tmp_dir, load_json, save_json


def run(parsed_path: Path) -> list[dict]:
    rows = load_json(parsed_path)
    classified = classify_rows(rows)
    out_path = ensure_tmp_dir() / "classified_rows.json"
    save_json(out_path, classified)
    print(f"Classifier stage complete: {len(classified)} rows classified.")
    print(f"Classified rows saved to: {out_path}")
    return classified


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--input", default=str(ensure_tmp_dir() / "parsed_rows.json"))
    args = cli.parse_args()
    run(Path(args.input))


if __name__ == "__main__":
    main()
