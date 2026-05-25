from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
COMPILED_DIR = DATA_DIR / "qbank_compiled"


@dataclass(slots=True)
class QuestionRow:
    id: str
    board: str
    level: str
    subject: str
    topic: str
    question_type: str
    marks: int | None
    question_number: str | None
    question_text: str
    year: int | None
    paper: str | None
    paper_code: str | None
    session: str | None
    source_pdf: str
    frequency: int
    sub_topic: str | None = None
    chapter: str | None = None


@dataclass(slots=True)
class TopicFrequencyRow:
    board: str
    level: str
    subject: str
    topic: str
    question_count: int
    total_frequency: int
    years: list[int]


@dataclass(slots=True)
class ConceptRow:
    id: str
    board: str
    level: str
    subject: str
    chapter: str
    topic: str
    concept_summary: str
    exam_tips: list[str]
    repeat_years: list[str]
    formula_candidates: list[str]
    question_examples: list[str]
    answer_patterns: list[str]
    importance_score: int


SUBJECT_ALIASES: dict[str, tuple[str, str | None]] = {
    "0580": ("Mathematics", "O Level"),
    "4024": ("Mathematics", "O Level"),
    "9709": ("Mathematics", "A Level"),
    "math": ("Mathematics", None),
    "maths": ("Mathematics", None),
    "mathematics": ("Mathematics", None),
    "additional mathematics": ("Mathematics", "O Level"),
    "9231": ("Further Mathematics", "A Level"),
    "further mathematics": ("Further Mathematics", "A Level"),
    "9702": ("Physics", "A Level"),
    "5054": ("Physics", "O Level"),
    "phy": ("Physics", None),
    "physics": ("Physics", None),
    "9701": ("Chemistry", "A Level"),
    "5070": ("Chemistry", "O Level"),
    "chem": ("Chemistry", None),
    "chemistry": ("Chemistry", None),
    "9700": ("Biology", "A Level"),
    "5090": ("Biology", "O Level"),
    "bio": ("Biology", None),
    "biology": ("Biology", None),
    "9708": ("Economics", "A Level"),
    "2281": ("Economics", "O Level"),
    "economics": ("Economics", None),
    "9706": ("Accounting", "A Level"),
    "7707": ("Accounting", "O Level"),
    "accounting": ("Accounting", None),
    "9609": ("Business", "A Level"),
    "business": ("Business", None),
    "9618": ("Computer Science", "A Level"),
    "2210": ("Computer Science", "O Level"),
    "computer science": ("Computer Science", None),
    "cs": ("Computer Science", None),
    "9626": ("ICT", "A Level"),
    "0417": ("ICT", "O Level"),
    "ict": ("ICT", None),
    "9093": ("English", "A Level"),
    "1123": ("English", "O Level"),
    "english": ("English", None),
}

LEVEL_ALIASES = {
    "a level": "A Level",
    "as level": "A Level",
    "as/a level": "A Level",
    "o level": "O Level",
    "igcse": "O Level",
}

SESSION_ALIASES = {
    "m": "February/March",
    "s": "May/June",
    "w": "October/November",
    "march": "February/March",
    "february": "February/March",
    "june": "May/June",
    "may": "May/June",
    "november": "October/November",
    "october": "October/November",
}


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (value or "").lower())).strip()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def natural_question_key(value: str | None) -> tuple[int, str]:
    if not value:
        return (0, "")
    match = re.match(r"(\d+)([a-z()]*)", value.lower().replace(" ", ""))
    if not match:
        return (0, value)
    number = int(match.group(1))
    suffix = match.group(2)
    return (number, suffix)


class KnowledgeBase:
    def __init__(self) -> None:
        self.questions = self._load_questions()
        self.topic_frequency = self._load_topic_frequency()
        self.concepts = self._load_concepts()
        self.formula_bank = self._load_json(DATA_DIR / "formula_bank.json").get("formulas", [])
        self.topic_graph = self._load_json(DATA_DIR / "topic_graph.json").get("topics", [])

        self.questions_by_subject: dict[str, list[QuestionRow]] = defaultdict(list)
        for row in self.questions:
            self.questions_by_subject[row.subject].append(row)

    def _load_json(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _load_questions(self) -> list[QuestionRow]:
        rows: list[QuestionRow] = []
        for file_name in ("qbank_question_bank_feed_safe.jsonl", "qbank_question_bank_ao_level.jsonl"):
            for row in read_jsonl(COMPILED_DIR / file_name):
                rows.append(
                    QuestionRow(
                        id=row["id"],
                        board=row.get("board", "Cambridge"),
                        level=row.get("level", "Unknown"),
                        subject=row.get("subject", "Unknown"),
                        topic=row.get("topic", "Unknown"),
                        question_type=row.get("question_type", "structured"),
                        marks=row.get("marks"),
                        question_number=row.get("question_number"),
                        question_text=row.get("question_text", ""),
                        year=row.get("year"),
                        paper=row.get("paper"),
                        paper_code=row.get("paper_code"),
                        session=row.get("session"),
                        source_pdf=row.get("source_pdf", ""),
                        frequency=row.get("frequency", 1),
                        sub_topic=row.get("sub_topic"),
                        chapter=row.get("chapter"),
                    )
                )
        return rows

    def _load_topic_frequency(self) -> list[TopicFrequencyRow]:
        rows: list[TopicFrequencyRow] = []
        for file_name in ("qbank_topic_frequency.jsonl", "qbank_topic_frequency_ao_level.jsonl"):
            for row in read_jsonl(COMPILED_DIR / file_name):
                rows.append(
                    TopicFrequencyRow(
                        board=row.get("board", "Cambridge"),
                        level=row.get("level", "Unknown"),
                        subject=row.get("subject", "Unknown"),
                        topic=row.get("topic", "Unknown"),
                        question_count=row.get("question_count", 0),
                        total_frequency=row.get("total_frequency", 0),
                        years=row.get("years", []),
                    )
                )
        return rows

    def _load_concepts(self) -> list[ConceptRow]:
        rows: list[ConceptRow] = []
        for row in read_jsonl(DATA_DIR / "qbank_concept_cleaned.jsonl"):
            rows.append(
                ConceptRow(
                    id=row["id"],
                    board=row.get("board", "General"),
                    level=row.get("level", "Unknown"),
                    subject=row.get("subject", "Unknown"),
                    chapter=row.get("chapter", ""),
                    topic=row.get("topic", ""),
                    concept_summary=row.get("conceptSummary", ""),
                    exam_tips=row.get("examTips", []),
                    repeat_years=row.get("repeatYears", []),
                    formula_candidates=row.get("formulaCandidates", []),
                    question_examples=row.get("questionExamples", []),
                    answer_patterns=row.get("answerPatterns", []),
                    importance_score=row.get("importanceScore", 0),
                )
            )
        return rows

    def resolve_subject(self, text: str) -> tuple[str | None, str | None]:
        normalized = normalize_text(text)
        for alias, value in sorted(SUBJECT_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
            if re.search(rf"(^|\b){re.escape(alias)}(\b|$)", normalized):
                return value
        return (None, None)

    def resolve_level(self, text: str) -> str | None:
        normalized = normalize_text(text)
        for alias, level in LEVEL_ALIASES.items():
            if alias in normalized:
                return level
        return None

    def resolve_topic_from_graph(self, text: str, subject: str | None = None) -> dict[str, Any] | None:
        normalized = normalize_text(text)
        normalized_tokens = set(normalized.split())
        best_match: dict[str, Any] | None = None
        best_score = 0
        for entry in self.topic_graph:
            if subject and entry.get("subject") not in {subject, None, ""}:
                continue
            names = [entry.get("topic", "")] + entry.get("aliases", [])
            for name in names:
                candidate = normalize_text(name)
                if not candidate:
                    continue
                candidate_tokens = set(candidate.split())
                if candidate in normalized or normalized in candidate or candidate_tokens.issubset(normalized_tokens):
                    score = len(candidate)
                    if score > best_score:
                        best_match = entry
                        best_score = score
        return best_match

    def infer_subject_from_topic(self, text: str) -> tuple[str | None, str | None]:
        match = self.resolve_topic_from_graph(text)
        if not match:
            return (None, None)
        return (match.get("subject"), match.get("level"))

    def find_formula_entries(self, text: str, subject: str | None = None) -> list[dict[str, Any]]:
        normalized = normalize_text(text)
        matches: list[dict[str, Any]] = []
        for entry in self.formula_bank:
            if subject and entry.get("subject") not in {subject, "General"}:
                continue
            names = [entry.get("name", "")] + entry.get("aliases", [])
            if any(normalize_text(name) in normalized or normalize_text(normalized) in normalize_text(name) for name in names if name):
                matches.append(entry)
                continue
            if entry.get("topic") and normalize_text(entry["topic"]) in normalized:
                matches.append(entry)
        if matches:
            return matches

        topic_entry = self.resolve_topic_from_graph(text, subject)
        if topic_entry:
            target_topic = normalize_text(topic_entry.get("topic", ""))
            for entry in self.formula_bank:
                if subject and entry.get("subject") not in {subject, "General"}:
                    continue
                if normalize_text(entry.get("topic", "")) == target_topic:
                    matches.append(entry)
        return matches

    def find_question(
        self,
        *,
        subject: str | None,
        year: int | None,
        session: str | None = None,
        paper_number: str | None = None,
        variant: str | None = None,
        question_number: str | None = None,
        last_question: bool = False,
        level: str | None = None,
        topic: str | None = None,
    ) -> QuestionRow | None:
        candidates = [
            row
            for row in self.questions
            if (not subject or row.subject == subject)
            and (not year or row.year == year)
            and (not level or level in row.level)
        ]

        if session:
            candidates = [row for row in candidates if row.session == session]

        if variant:
            candidates = [
                row
                for row in candidates
                if (row.paper_code and row.paper_code.endswith(f"/{variant}"))
                or (row.paper and normalize_text(f"variant {variant[-1]}") in normalize_text(row.paper))
            ]
        elif paper_number:
            candidates = [
                row
                for row in candidates
                if (row.paper_code and row.paper_code.split("/")[-1].startswith(str(paper_number)))
                or (row.paper and normalize_text(f"paper {paper_number}") in normalize_text(row.paper))
            ]

        if topic:
            topic_norm = normalize_text(topic)
            topic_filtered = [
                row
                for row in candidates
                if topic_norm in normalize_text(row.topic)
                or topic_norm in normalize_text(row.sub_topic)
                or topic_norm in normalize_text(row.question_text)
            ]
            if topic_filtered:
                candidates = topic_filtered

        if last_question and candidates:
            return sorted(candidates, key=lambda row: natural_question_key(row.question_number), reverse=True)[0]

        if question_number:
            query_number = normalize_text(question_number).replace("question ", "").replace("q ", "").replace("q", "")
            exact = [
                row for row in candidates
                if normalize_text(row.question_number).startswith(query_number)
            ]
            if exact:
                candidates = exact

        if not candidates:
            return None
        return sorted(
            candidates,
            key=lambda row: (
                row.year or 0,
                natural_question_key(row.question_number),
                row.frequency,
            ),
            reverse=True,
        )[0]

    def recent_questions(
        self,
        *,
        topic: str,
        subject: str | None = None,
        level: str | None = None,
        limit: int = 3,
    ) -> list[QuestionRow]:
        topic_norm = normalize_text(topic)
        candidates = [
            row
            for row in self.questions
            if (not subject or row.subject == subject)
            and (not level or level in row.level)
            and (
                topic_norm in normalize_text(row.topic)
                or topic_norm in normalize_text(row.sub_topic)
                or topic_norm in normalize_text(row.chapter)
                or topic_norm in normalize_text(row.question_text)
            )
        ]
        return sorted(candidates, key=lambda row: (row.year or 0, row.frequency), reverse=True)[:limit]

    def topic_repeat_profile(
        self,
        *,
        topic: str,
        subject: str | None = None,
        level: str | None = None,
    ) -> dict[str, Any]:
        topic_norm = normalize_text(topic)
        matched_rows = [
            row
            for row in self.topic_frequency
            if (not subject or row.subject == subject)
            and (not level or level in row.level)
            and (
                topic_norm == normalize_text(row.topic)
                or topic_norm in normalize_text(row.topic)
                or normalize_text(row.topic) in topic_norm
            )
        ]
        if matched_rows:
            best = sorted(matched_rows, key=lambda row: (len(row.years), row.total_frequency), reverse=True)[0]
            return {
                "topic": best.topic,
                "appeared_in": sorted(best.years),
                "frequency_label": self._frequency_label(best.years),
                "last_seen_year": max(best.years) if best.years else None,
                "question_count": best.question_count,
            }

        question_matches = self.recent_questions(topic=topic, subject=subject, level=level, limit=200)
        years = sorted({row.year for row in question_matches if row.year})
        if years:
            return {
                "topic": topic.title(),
                "appeared_in": years,
                "frequency_label": self._frequency_label(years),
                "last_seen_year": max(years),
                "question_count": len(question_matches),
            }

        graph_entry = self.resolve_topic_from_graph(topic, subject)
        if graph_entry:
            repeat_years = [int(year) for year in graph_entry.get("repeat_years", []) if str(year).isdigit()]
            return {
                "topic": graph_entry.get("topic", topic.title()),
                "appeared_in": repeat_years,
                "frequency_label": self._frequency_label(repeat_years),
                "last_seen_year": max(repeat_years) if repeat_years else None,
                "question_count": len(repeat_years),
            }

        return {
            "topic": topic.title(),
            "appeared_in": [],
            "frequency_label": "LOW",
            "last_seen_year": None,
            "question_count": 0,
        }

    def _frequency_label(self, years: list[int]) -> str:
        if not years:
            return "LOW"
        density = len(years)
        if density >= 6:
            return f"{density}/{density} years - VERY HIGH"
        if density >= 4:
            return f"{density} years - HIGH"
        if density >= 2:
            return f"{density} years - MEDIUM"
        return f"{density} year - LOW"

    def concept_support(self, topic: str, subject: str | None = None) -> dict[str, Any]:
        topic_norm = normalize_text(topic)
        matched = [
            row
            for row in self.concepts
            if (not subject or row.subject == subject)
            and (
                topic_norm in normalize_text(row.topic)
                or topic_norm in normalize_text(row.chapter)
                or normalize_text(row.topic) in topic_norm
            )
        ]
        if matched:
            best = sorted(matched, key=lambda row: row.importance_score, reverse=True)[0]
            return {
                "summary": best.concept_summary,
                "exam_tips": best.exam_tips,
                "repeat_years": [int(year) for year in best.repeat_years if str(year).isdigit()],
                "formula_candidates": best.formula_candidates,
                "question_examples": best.question_examples,
                "answer_patterns": best.answer_patterns,
            }

        graph_entry = self.resolve_topic_from_graph(topic, subject)
        if graph_entry:
            return {
                "summary": graph_entry.get("summary", ""),
                "exam_tips": graph_entry.get("exam_tips", []),
                "repeat_years": graph_entry.get("repeat_years", []),
                "formula_candidates": graph_entry.get("formula_candidates", []),
                "question_examples": graph_entry.get("question_examples", []),
                "answer_patterns": graph_entry.get("answer_patterns", []),
            }

        return {
            "summary": "",
            "exam_tips": [],
            "repeat_years": [],
            "formula_candidates": [],
            "question_examples": [],
            "answer_patterns": [],
        }

    def concept_chain(self, topic: str, subject: str | None = None) -> dict[str, Any]:
        entry = self.resolve_topic_from_graph(topic, subject)
        if entry:
            return {
                "topic": entry.get("topic", topic.title()),
                "subject": entry.get("subject", subject),
                "prerequisites": entry.get("prerequisites", []),
                "related_topics": entry.get("related_topics", []),
                "quick_note": entry.get("quick_note", ""),
            }
        support = self.concept_support(topic, subject)
        fallback_prereqs = unique_preserve_order([topic.title(), subject or "Core definitions"])
        return {
            "topic": topic.title(),
            "subject": subject,
            "prerequisites": fallback_prereqs,
            "related_topics": [],
            "quick_note": support.get("summary", "")[:120],
        }

    def classify_topic(self, text: str, subject: str | None = None) -> dict[str, Any]:
        normalized = normalize_text(text)
        best_topic = None
        best_score = 0

        for entry in self.topic_graph:
            if subject and entry.get("subject") not in {subject, None, ""}:
                continue
            score = 0
            for alias in [entry.get("topic", "")] + entry.get("aliases", []):
                alias_norm = normalize_text(alias)
                if alias_norm and alias_norm in normalized:
                    score = max(score, len(alias_norm))
            if score > best_score:
                best_topic = entry
                best_score = score

        if best_topic:
            return {
                "topic": best_topic.get("topic"),
                "subject": best_topic.get("subject", subject),
                "level": best_topic.get("level"),
                "confidence": min(0.99, 0.6 + best_score / 40),
            }

        subject_rows = self.questions_by_subject.get(subject or "", self.questions)
        topic_scores: dict[str, int] = defaultdict(int)
        tokens = [token for token in normalized.split() if len(token) > 2]
        for row in subject_rows:
            row_blob = normalize_text(" ".join([row.topic, row.sub_topic or "", row.chapter or "", row.question_text]))
            hits = sum(1 for token in tokens if token in row_blob)
            if hits:
                topic_scores[row.topic] += hits + min(row.frequency, 5)

        if topic_scores:
            topic = sorted(topic_scores.items(), key=lambda item: item[1], reverse=True)[0][0]
            return {
                "topic": topic,
                "subject": subject,
                "level": None,
                "confidence": 0.75,
            }

        inferred_subject, inferred_level = self.infer_subject_from_topic(text)
        return {
            "topic": text.strip().title(),
            "subject": inferred_subject or subject,
            "level": inferred_level,
            "confidence": 0.4,
        }
