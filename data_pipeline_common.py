from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
TMP_DIR = DATA_DIR / "_pipeline_tmp"

COMPILED_BANK_FILES = [
    DATA_DIR / "qbank_compiled" / "qbank_question_bank_feed_safe.jsonl",
    DATA_DIR / "qbank_compiled" / "qbank_question_bank_ao_level.jsonl",
]

SESSION_CODE_MAP = {
    "february/march": "m",
    "march": "m",
    "may/june": "s",
    "june": "s",
    "october/november": "w",
    "november": "w",
}

SUBJECT_SLUG_MAP = {
    "accounting": "Accounting",
    "biology": "Biology",
    "business": "Business",
    "chemistry": "Chemistry",
    "computer-science": "Computer Science",
    "economics": "Economics",
    "english": "English",
    "mathematics": "Mathematics",
    "physics": "Physics",
    "mixed": "Mixed",
}


def ensure_tmp_dir() -> Path:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    return TMP_DIR


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return cleaned or "unknown"


def title_from_slug(text: str) -> str:
    return " ".join(part.capitalize() for part in text.replace("_", "-").split("-") if part)


def find_pdf_folder() -> tuple[Path | None, list[dict[str, Any]]]:
    search_roots = [
        ROOT_DIR / "pdfs",
        Path.home() / "Downloads",
        Path.home() / "Desktop",
        DATA_DIR / "qbank_collection" / "downloaded_pdfs",
    ]
    findings: list[dict[str, Any]] = []
    for root in search_roots:
        if not root.exists():
            continue
        pdfs = list(root.rglob("*.pdf"))
        if not pdfs:
            continue
        findings.append(
            {
                "path": root,
                "count": len(pdfs),
                "subjects": sorted(detect_subjects(pdfs)),
            }
        )
    if not findings:
        return None, []
    findings.sort(key=lambda item: (item["count"], str(item["path"])), reverse=True)
    return findings[0]["path"], findings


def detect_subjects(pdf_paths: list[Path]) -> set[str]:
    subjects: set[str] = set()
    for path in pdf_paths:
        parts = [part.lower() for part in path.parts]
        for part in parts:
            if part in SUBJECT_SLUG_MAP:
                subjects.add(SUBJECT_SLUG_MAP[part])
        if path.parent.name.lower() in SUBJECT_SLUG_MAP:
            subjects.add(SUBJECT_SLUG_MAP[path.parent.name.lower()])
    return subjects


def build_pdf_manifest(input_dir: Path) -> dict[str, Any]:
    pdfs = sorted(input_dir.rglob("*.pdf"))
    manifest_files: list[dict[str, Any]] = []
    for index, pdf_path in enumerate(pdfs, start=1):
        subject = infer_subject_from_path(pdf_path)
        manifest_files.append(
            {
                "index": index,
                "name": pdf_path.name,
                "path": str(pdf_path),
                "relative_path": str(pdf_path.relative_to(input_dir)),
                "subject": subject,
                "subject_slug": slugify(subject),
            }
        )
    return {
        "input_dir": str(input_dir),
        "pdf_count": len(manifest_files),
        "subjects": sorted({item["subject"] for item in manifest_files if item["subject"]}),
        "files": manifest_files,
    }


def infer_subject_from_path(path: Path) -> str:
    for part in reversed(path.parts):
        lowered = part.lower()
        if lowered in SUBJECT_SLUG_MAP:
            return SUBJECT_SLUG_MAP[lowered]
    return title_from_slug(path.parent.name)


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_session(raw_session: Any, source_name: str) -> tuple[str, str]:
    session_text = str(raw_session or "").strip()
    lowered = session_text.lower()
    if lowered in SESSION_CODE_MAP:
        return SESSION_CODE_MAP[lowered], session_text or pretty_session(SESSION_CODE_MAP[lowered])
    match = re.search(r"_(m|s|w)\d{2}_", source_name.lower())
    if match:
        code = match.group(1)
        return code, pretty_session(code)
    return "s", "May/June"


def pretty_session(code: str) -> str:
    return {"m": "February/March", "s": "May/June", "w": "October/November"}.get(code, "May/June")


def extract_subject_code(row: dict[str, Any], source_name: str) -> str:
    paper_code = str(row.get("paper_code") or "").strip()
    if paper_code and "/" in paper_code:
        return paper_code.split("/", 1)[0]
    match = re.match(r"(?P<code>\d{4})_", source_name)
    if match:
        return match.group("code")
    match = re.search(r"(?P<code>\d{4})", source_name)
    return match.group("code") if match else ""


def extract_variant(row: dict[str, Any], source_name: str) -> str:
    paper_code = str(row.get("paper_code") or "").strip()
    if paper_code and "/" in paper_code:
        return paper_code.split("/", 1)[1]
    match = re.search(r"_(?:qp|ms|in|er)_(\d{2})", source_name.lower())
    if match:
        return match.group(1)
    match = re.search(r"paper\s+(\d)\s+variant\s+(\d)", str(row.get("paper") or "").lower())
    if match:
        return f"{match.group(1)}{match.group(2)}"
    return ""


def extract_paper_number(row: dict[str, Any], variant: str, source_name: str) -> str:
    if variant:
        return variant[0]
    match = re.search(r"paper\s+(\d)", str(row.get("paper") or "").lower())
    if match:
        return match.group(1)
    match = re.search(r"_(?:qp|ms|in|er)_(\d{2})", source_name.lower())
    if match:
        return match.group(1)[0]
    return ""


def extract_paper_type(source_name: str) -> str:
    match = re.search(r"_(qp|ms|in|er)_", source_name.lower())
    return match.group(1) if match else "qp"


def detect_difficulty(row: dict[str, Any]) -> str:
    marks = row.get("marks")
    if isinstance(marks, (int, float)):
        if marks >= 8:
            return "Hard"
        if marks >= 4:
            return "Medium"
        return "Easy"
    text = str(row.get("question_text") or "")
    if len(text) > 500:
        return "Hard"
    if len(text) > 220:
        return "Medium"
    return "Easy"


def normalize_question_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def load_rows_from_compiled_banks(input_dir: Path, year_min: int = 2014, year_max: int = 2024) -> list[dict[str, Any]]:
    manifest = build_pdf_manifest(input_dir)
    pdf_lookup = {
        Path(item["path"]).name.lower(): item["path"]
        for item in manifest["files"]
    }
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str, str, str]] = set()

    for bank_path in COMPILED_BANK_FILES:
        if not bank_path.exists():
            continue
        with bank_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                raw = json.loads(line)
                year = raw.get("year")
                if not isinstance(year, int) or year < year_min or year > year_max:
                    continue
                question_text = normalize_question_text(str(raw.get("question_text") or ""))
                if not question_text:
                    continue

                source_raw = str(raw.get("source_pdf") or "")
                source_name = Path(source_raw).name
                resolved_source = pdf_lookup.get(source_name.lower())
                if not resolved_source:
                    continue

                variant = extract_variant(raw, source_name)
                paper_number = extract_paper_number(raw, variant, source_name)
                subject = str(raw.get("subject") or infer_subject_from_path(Path(resolved_source))).strip() or "General"
                session_code, session_label = normalize_session(raw.get("session"), source_name)
                subject_code = extract_subject_code(raw, source_name)
                question_number = str(raw.get("question_number") or "").strip()

                dedupe_key = (
                    subject.lower(),
                    str(year),
                    session_code,
                    variant,
                    question_number.lower(),
                    question_text.lower(),
                )
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                row = {
                    "qualification": "A Level" if "a level" in str(raw.get("level") or "").lower() else "O Level",
                    "level": raw.get("level"),
                    "board": raw.get("board"),
                    "subject": subject,
                    "subject_code": subject_code,
                    "year": year,
                    "session": session_code,
                    "session_label": session_label,
                    "variant": variant,
                    "paper_number": paper_number,
                    "paper_type": extract_paper_type(source_name),
                    "paper": raw.get("paper"),
                    "paper_code": raw.get("paper_code"),
                    "question_number": question_number,
                    "question_text": question_text,
                    "marks": raw.get("marks"),
                    "question_type": raw.get("question_type"),
                    "difficulty": detect_difficulty(raw),
                    "topic": str(raw.get("topic") or "General").strip() or "General",
                    "sub_topic": str(raw.get("sub_topic") or raw.get("topic") or "General").strip() or "General",
                    "chapter": str(raw.get("chapter") or raw.get("subject") or subject).strip() or subject,
                    "source_pdf": resolved_source,
                    "source_filename": source_name,
                    "source_url": raw.get("source_url"),
                    "answer_ready": bool(raw.get("answer_ready")),
                    "topic_tags": [
                        part
                        for part in [
                            str(raw.get("topic") or "").strip(),
                            str(raw.get("sub_topic") or "").strip(),
                            str(raw.get("chapter") or "").strip(),
                        ]
                        if part
                    ],
                }
                rows.append(row)
    return rows


def classify_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    classified: list[dict[str, Any]] = []
    for row in rows:
        updated = dict(row)
        if updated["topic"] == "General":
            lowered = updated["question_text"].lower()
            keyword_topics = [
                ("integration", "Integration"),
                ("differentiat", "Differentiation"),
                ("vector", "Vectors"),
                ("wave", "Waves"),
                ("organic", "Organic Chemistry"),
                ("mole", "Moles"),
                ("osmos", "Osmosis"),
                ("momentum", "Momentum"),
                ("electric", "Electricity"),
            ]
            for needle, topic in keyword_topics:
                if needle in lowered:
                    updated["topic"] = topic
                    updated["sub_topic"] = topic
                    break
        if not updated["topic_tags"]:
            updated["topic_tags"] = [updated["topic"], updated["sub_topic"], updated["chapter"]]
        classified.append(updated)
    return classified


def build_dataset_master(rows: list[dict[str, Any]]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    dataset: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    sorted_rows = sorted(
        rows,
        key=lambda item: (
            item["subject"],
            item["year"],
            item["session"],
            item["paper_number"],
            item["variant"],
            item["question_number"],
        ),
    )
    for row in sorted_rows:
        subject = row["subject"]
        year = str(row["year"])
        dataset[subject][year].append(row)
    return {subject: dict(years) for subject, years in dataset.items()}


def flatten_dataset(dataset: dict[str, dict[str, list[dict[str, Any]]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for years in dataset.values():
        for question_list in years.values():
            if isinstance(question_list, list):
                rows.extend(question_list)
    return rows


def top_topics_by_subject(rows: list[dict[str, Any]], limit: int = 5) -> dict[str, list[str]]:
    grouped: dict[str, defaultdict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows:
        grouped[row["subject"]][row["topic"]] += 1
    result: dict[str, list[str]] = {}
    for subject, topics in grouped.items():
        ranked = sorted(topics.items(), key=lambda item: (-item[1], item[0]))
        result[subject] = [topic for topic, _ in ranked[:limit]]
    return result
