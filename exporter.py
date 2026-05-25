from __future__ import annotations

import argparse
from pathlib import Path

from data_pipeline_common import build_dataset_master, ensure_tmp_dir, load_json, save_json


def run(classified_path: Path, output_base: Path, fmt: str = "json") -> Path:
    rows = load_json(classified_path)
    dataset = build_dataset_master(rows)
    output_path = output_base.with_suffix(".json") if output_base.suffix != ".json" else output_base
    save_json(output_path, dataset)
    print(f"Exporter stage complete: {sum(len(v) for years in dataset.values() for v in years.values())} questions exported.")
    print(f"Dataset saved to: {output_path}")
    return output_path


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--input", default=str(ensure_tmp_dir() / "classified_rows.json"))
    cli.add_argument("--output", required=True)
    cli.add_argument("--format", default="json")
    args = cli.parse_args()
    run(Path(args.input), Path(args.output), fmt=args.format)


if __name__ == "__main__":
    main()
