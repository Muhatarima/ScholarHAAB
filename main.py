from __future__ import annotations

import argparse
from pathlib import Path

import classifier
import exporter
import ocr_engine
import parser as parser_stage
from data_pipeline_common import TMP_DIR


def parse_bool(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--input", required=True)
    cli.add_argument("--output", required=True)
    cli.add_argument("--format", default="json")
    cli.add_argument("--classify", default="True")
    cli.add_argument("--lang", default="eng")
    args = cli.parse_args()

    input_dir = Path(args.input)
    output_base = Path(args.output)

    ocr_engine.run(input_dir, lang=args.lang)
    manifest_path = TMP_DIR / "ocr_manifest.json"
    parser_stage.run(manifest_path)
    classified_path = TMP_DIR / "parsed_rows.json"
    if parse_bool(args.classify):
        classifier.run(classified_path)
        classified_path = TMP_DIR / "classified_rows.json"
    exporter.run(classified_path, output_base, fmt=args.format)
    print("Pipeline complete.")


if __name__ == "__main__":
    main()
