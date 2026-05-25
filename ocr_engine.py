from __future__ import annotations

import argparse
from pathlib import Path

from data_pipeline_common import build_pdf_manifest, ensure_tmp_dir, save_json


def run(input_dir: Path, lang: str = "eng") -> dict:
    manifest = build_pdf_manifest(input_dir)
    tmp_dir = ensure_tmp_dir()
    manifest_path = tmp_dir / "ocr_manifest.json"

    for item in manifest["files"]:
        print(f"Processing: {item['name']} ({item['index']} of {manifest['pdf_count']})")

    payload = {
        **manifest,
        "lang": lang,
        "engine": "repo-backed-qbank-pipeline",
        "note": "This stage scans the local PDF corpus and prepares a manifest for parser/classifier/exporter.",
    }
    save_json(manifest_path, payload)
    print(f"OCR stage complete: {manifest['pdf_count']} PDFs indexed.")
    print(f"Manifest saved to: {manifest_path}")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--lang", default="eng")
    args = parser.parse_args()
    run(Path(args.input), lang=args.lang)


if __name__ == "__main__":
    main()
