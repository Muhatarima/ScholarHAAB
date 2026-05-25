from __future__ import annotations

import argparse
from pathlib import Path

from data_pipeline_common import ensure_tmp_dir, load_json, load_rows_from_compiled_banks, save_json


def run(manifest_path: Path) -> list[dict]:
    manifest = load_json(manifest_path)
    input_dir = Path(manifest["input_dir"])
    rows = load_rows_from_compiled_banks(input_dir)
    tmp_dir = ensure_tmp_dir()
    parsed_path = tmp_dir / "parsed_rows.json"
    save_json(parsed_path, rows)

    extracted = 0
    total = len(rows)
    current_source = ""
    for row in rows:
        extracted += 1
        if row["source_filename"] != current_source:
            current_source = row["source_filename"]
            print(f"Processing: {current_source}")
            print(f"Questions extracted so far: {extracted} of {total}")

    print(f"Parser stage complete: {len(rows)} questions prepared.")
    print(f"Parsed rows saved to: {parsed_path}")
    return rows


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--manifest", default=str(ensure_tmp_dir() / "ocr_manifest.json"))
    args = cli.parse_args()
    run(Path(args.manifest))


if __name__ == "__main__":
    main()
