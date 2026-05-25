from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
import pdfplumber
from tqdm import tqdm

from config import EXTRACTED_DIR, LOGS_DIR, RAW_DIR, REPORTS_DIR

QUESTION_START = re.compile(r"(?m)^(?:Question\s+)?(\d{1,2})(?:\s*\(([a-z])\))?[\.\s]")
PART_START = re.compile(r"(?m)^\(([a-z])\)")
MARKS_RE = re.compile(r"\[(\d{1,2})\]")
COMMANDS = [
    "calculate",
    "explain",
    "describe",
    "state",
    "define",
    "evaluate",
    "discuss",
    "analyse",
    "determine",
    "show",
    "sketch",
    "draw",
    "list",
    "name",
    "identify",
    "suggest",
    "compare",
    "justify",
    "derive",
    "prove",
    "predict",
]

TOPIC_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "Physics": {
        "Waves": ["wave", "frequency", "wavelength", "amplitude", "interference", "diffraction", "sound", "light"],
        "Forces": ["force", "momentum", "acceleration", "velocity", "mass", "weight", "friction", "pressure"],
        "Electricity": ["current", "voltage", "resistance", "circuit", "power", "ohm", "charge", "emf"],
        "Thermal": ["temperature", "heat", "thermal", "specific heat", "latent heat", "gas"],
        "Nuclear": ["radioactive", "nuclear", "decay", "half-life", "alpha", "beta", "gamma"],
        "Mechanics": ["kinematics", "projectile", "energy", "work", "power", "efficiency"],
    },
    "Mathematics": {
        "Algebra": ["equation", "inequality", "polynomial", "factor", "quadratic", "simultaneous"],
        "Calculus": ["differentiat", "integrat", "derivative", "integral", "gradient", "maximum", "minimum"],
        "Trigonometry": ["sine", "cosine", "tangent", "sin", "cos", "tan", "radian", "bearing"],
        "Statistics": ["probability", "mean", "median", "standard deviation", "distribution", "normal", "binomial"],
        "Geometry": ["circle", "triangle", "area", "volume", "coordinate", "vector", "matrix"],
        "Sequences": ["sequence", "series", "arithmetic", "geometric", "nth term"],
    },
    "Chemistry": {
        "Organic Chemistry": ["alkane", "alkene", "alcohol", "ester", "organic", "hydrocarbon", "polymer", "isomer"],
        "Atomic Structure": ["atom", "electron", "proton", "neutron", "shell", "ion", "isotope"],
        "Bonding": ["covalent", "ionic", "metallic", "bond", "molecule", "lattice"],
        "Energetics": ["enthalpy", "exothermic", "endothermic", "activation energy", "hess", "bond energy"],
        "Kinetics": ["rate", "catalyst", "concentration", "temperature", "collision"],
        "Equilibrium": ["equilibrium", "reversible", "le chatelier", "acid", "base", "ph", "buffer"],
    },
    "Biology": {
        "Cell Biology": ["cell", "nucleus", "mitosis", "meiosis", "dna", "chromosome", "membrane", "diffusion"],
        "Genetics": ["gene", "allele", "genotype", "phenotype", "dominant", "recessive", "mutation"],
        "Ecology": ["ecosystem", "food chain", "population", "habitat", "biodiversity"],
        "Human Biology": ["heart", "blood", "lung", "kidney", "nerve", "hormone", "enzyme", "digestion"],
    },
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\x00", " ")).strip()


def extract_text_pymupdf(pdf_path: Path) -> tuple[str, bool]:
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    has_diagram = False
    for page in doc:
        parts.append(page.get_text("text"))
        if page.get_images(full=True):
            has_diagram = True
    return "\n".join(parts), has_diagram


def extract_text_pdfplumber(pdf_path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def split_questions(text: str) -> list[dict[str, Any]]:
    matches = list(QUESTION_START.finditer(text))
    questions: list[dict[str, Any]] = []
    if not matches:
        return []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        raw = text[start:end].strip()
        q_number = match.group(1)
        part = match.group(2)
        marks = [int(value) for value in MARKS_RE.findall(raw)]
        questions.append(
            {
                "number": q_number,
                "part": part,
                "text": clean_text(raw),
                "marks": marks[-1] if marks else None,
            }
        )
    return questions


def extract_with_pymupdf(pdf_path: Path) -> tuple[list[dict[str, Any]], bool]:
    text, has_diagram = extract_text_pymupdf(pdf_path)
    return split_questions(text), has_diagram


def extract_with_pdfplumber(pdf_path: Path) -> list[dict[str, Any]]:
    return split_questions(extract_text_pdfplumber(pdf_path))


def extract_mark_schemes(ms_path: Path) -> dict[str, dict[str, Any]]:
    if not ms_path.exists():
        return {}
    try:
        text, _ = extract_text_pymupdf(ms_path)
    except Exception:
        text = extract_text_pdfplumber(ms_path)
    schemes: dict[str, dict[str, Any]] = {}
    for entry in split_questions(text):
        points = [
            clean_text(re.sub(r"\(\d+\)|\[\d+\]", "", line))
            for line in re.split(r"[\n\r]+|(?:\s{2,})", entry["text"])
            if len(clean_text(line)) > 8
        ]
        schemes[str(entry["number"])] = {"full_text": entry["text"], "points": points[:12]}
    return schemes


def parse_path(pdf_path: Path) -> dict[str, Any]:
    rel = pdf_path.relative_to(RAW_DIR)
    board, level, subject_slug, year, file_name = rel.parts[:5]
    match = re.match(r"(?P<session>.+)_paper(?P<paper>[^_]+)_(?P<type>qp|ms)\.pdf$", file_name)
    if not match:
        raise ValueError(f"Cannot parse pipeline PDF path: {pdf_path}")
    return {
        "board": board,
        "level": level,
        "subject": subject_slug.replace("-", " ").title(),
        "subject_code": None,
        "year": int(year),
        "session": match.group("session"),
        "paper": f"Paper {match.group('paper')}",
        "paper_type": match.group("type"),
    }


def build_id(info: dict[str, Any], question: dict[str, Any], index: int) -> str:
    part = question.get("part") or "x"
    return (
        f"{info['board']}_{info['level']}_{info['subject'].replace(' ', '_')}_"
        f"{info['year']}_{info['session']}_{info['paper'].replace(' ', '')}_"
        f"{question['number']}_{part}_{index}"
    ).lower()


def classify_topic(subject: str, text: str) -> str:
    subject_topics = TOPIC_KEYWORDS.get(subject, TOPIC_KEYWORDS.get(subject.replace("Additional ", ""), {}))
    lowered = text.lower()
    best_topic = "General"
    best_score = 0
    for topic, keywords in subject_topics.items():
        score = sum(1 for keyword in keywords if keyword in lowered)
        if score > best_score:
            best_topic = topic
            best_score = score
    return best_topic


def extract_command_word(text: str) -> str | None:
    lowered = text.lower()[:220]
    for command in COMMANDS:
        if re.search(rf"\b{re.escape(command)}\b", lowered):
            return command
    return None


def estimate_difficulty(question: dict[str, Any]) -> str:
    marks = question.get("marks") or 0
    command = (question.get("command_word") or "").lower()
    if marks >= 6 or command in {"evaluate", "discuss", "analyse", "derive", "prove"}:
        return "hard"
    if marks >= 3 or command in {"explain", "describe", "calculate", "determine", "show"}:
        return "medium"
    return "easy"


def extract_keywords(text: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z\-]{3,}", text.lower())
    common = {"question", "answer", "show", "state", "explain", "calculate", "paper"}
    counts = Counter(word for word in words if word not in common)
    return [word for word, _ in counts.most_common(12)]


def classify_question_type(question: dict[str, Any]) -> str:
    command = question.get("command_word")
    if command in {"calculate", "determine", "show"}:
        return "calculation"
    if command in {"draw", "sketch"}:
        return "diagram"
    if command in {"explain", "describe", "discuss", "evaluate"}:
        return "explanation"
    return "structured"


def output_path_for(info: dict[str, Any]) -> Path:
    file_stem = f"{info['year']}_{info['session']}_{info['paper'].replace(' ', '')}.json"
    return EXTRACTED_DIR / info["board"] / info["level"] / info["subject"].replace(" ", "-").lower() / file_stem


def extract_paper(qp_path: Path, force: bool = False) -> list[dict[str, Any]]:
    info = parse_path(qp_path)
    output_path = output_path_for(info)
    if output_path.exists() and not force:
        return json.loads(output_path.read_text(encoding="utf-8"))

    ms_path = Path(str(qp_path).replace("_qp.pdf", "_ms.pdf"))
    questions, has_diagram = extract_with_pymupdf(qp_path)
    if len(questions) < 3:
        questions = extract_with_pdfplumber(qp_path)
    mark_schemes = extract_mark_schemes(ms_path)

    objects: list[dict[str, Any]] = []
    for index, question in enumerate(questions, start=1):
        if len(question["text"]) < 25 or re.fullmatch(r"\d+\s*[A-D]?", question["text"].strip()):
            continue
        q_number = str(question["number"])
        scheme = mark_schemes.get(q_number)
        command_word = extract_command_word(question["text"])
        question["command_word"] = command_word
        topic = classify_topic(info["subject"], question["text"])
        objects.append(
            {
                "id": build_id(info, question, index),
                "board": info["board"],
                "level": "A Level" if info["level"] == "a-level" else "O Level",
                "subject": info["subject"],
                "subject_code": info.get("subject_code"),
                "year": info["year"],
                "session": info["session"].replace("_", "/"),
                "paper": info["paper"],
                "question_number": q_number,
                "part": question.get("part"),
                "question_text": question["text"],
                "question_text_clean": clean_text(question["text"]),
                "has_diagram": has_diagram,
                "diagram_description": "Diagram present in original PDF" if has_diagram else None,
                "marks": question.get("marks"),
                "mark_scheme": scheme["full_text"] if scheme else "NOT_FOUND",
                "mark_scheme_points": scheme["points"] if scheme else [],
                "mark_scheme_clean": clean_text(scheme["full_text"]) if scheme else "",
                "topic": topic,
                "subtopic": None,
                "difficulty": estimate_difficulty(question),
                "keywords": extract_keywords(question["text"]),
                "command_word": command_word,
                "question_type": classify_question_type(question),
                "needs_review": scheme is None,
                "review_reason": "Mark scheme not found" if scheme is None else None,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(objects, indent=2, ensure_ascii=False), encoding="utf-8")
    append_jsonl(LOGS_DIR / "extraction_progress.jsonl", {"file": str(qp_path), "questions": len(objects), "timestamp": now_iso()})
    return objects


def extract_all_papers(limit: int | None = None, force: bool = False) -> dict[str, Any]:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = [path for path in RAW_DIR.rglob("*.pdf") if "_qp.pdf" in path.name]
    if limit is not None:
        pdfs = pdfs[:limit]
    total_questions = 0
    errors: list[dict[str, str]] = []
    by_subject: Counter[str] = Counter()
    for pdf_path in tqdm(pdfs, desc="Extracting papers"):
        try:
            questions = extract_paper(pdf_path, force=force)
            total_questions += len(questions)
            if questions:
                by_subject[f"{questions[0]['board']} {questions[0]['level']} {questions[0]['subject']}"] += len(questions)
        except Exception as exc:
            errors.append({"file": str(pdf_path), "error": str(exc)})
            append_jsonl(LOGS_DIR / "extraction_errors.jsonl", {"file": str(pdf_path), "error": str(exc), "timestamp": now_iso()})
    report = {
        "total_pdfs": len(pdfs),
        "total_questions_extracted": total_questions,
        "per_subject": dict(sorted(by_subject.items())),
        "errors": errors,
        "created_at": now_iso(),
    }
    (REPORTS_DIR / "extraction_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    report = extract_all_papers(limit=args.limit, force=args.force)
    return 0 if report["errors"] == [] else 1


if __name__ == "__main__":
    raise SystemExit(main())
