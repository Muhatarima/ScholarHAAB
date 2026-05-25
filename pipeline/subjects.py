from __future__ import annotations

from typing import Iterator

SUBJECT_REGISTRY = {
    "cambridge": {
        "o_level": [
            {"code": "5070", "name": "Chemistry", "type": "science"},
            {"code": "5090", "name": "Biology", "type": "science"},
            {"code": "5054", "name": "Physics", "type": "science"},
            {"code": "4024", "name": "Mathematics", "type": "math"},
            {"code": "2281", "name": "Economics", "type": "humanities"},
            {"code": "2058", "name": "Islamiyat", "type": "humanities"},
            {"code": "2059", "name": "Pakistan Studies", "type": "humanities"},
            {"code": "1123", "name": "English Language", "type": "language"},
            {"code": "2210", "name": "Computer Science", "type": "stem"},
            {"code": "5129", "name": "Combined Science", "type": "science"},
            {"code": "4040", "name": "Statistics", "type": "math"},
            {"code": "2048", "name": "Bangladesh Studies", "type": "humanities"},
        ],
        "a_level": [
            {"code": "9701", "name": "Chemistry", "type": "science"},
            {"code": "9700", "name": "Biology", "type": "science"},
            {"code": "9702", "name": "Physics", "type": "science"},
            {"code": "9709", "name": "Mathematics", "type": "math"},
            {"code": "9231", "name": "Further Math", "type": "math"},
            {"code": "9708", "name": "Economics", "type": "humanities"},
            {"code": "9093", "name": "English Language", "type": "language"},
            {"code": "9608", "name": "Computer Science", "type": "stem"},
            {"code": "9706", "name": "Accounting", "type": "business"},
            {"code": "9395", "name": "Physical Education", "type": "other"},
        ],
    },
    "edexcel": {
        "o_level": [
            {"code": "4CH1", "name": "Chemistry", "type": "science"},
            {"code": "4BI1", "name": "Biology", "type": "science"},
            {"code": "4PH1", "name": "Physics", "type": "science"},
            {"code": "4MA1", "name": "Mathematics", "type": "math"},
        ],
        "a_level": [
            {"code": "9CH0", "name": "Chemistry", "type": "science"},
            {"code": "9BI0", "name": "Biology", "type": "science"},
            {"code": "9PH0", "name": "Physics", "type": "science"},
            {"code": "9MA0", "name": "Mathematics", "type": "math"},
            {"code": "9FM0", "name": "Further Math", "type": "math"},
            {"code": "9EC0", "name": "Economics", "type": "humanities"},
            {"code": "9EN0", "name": "English Language", "type": "language"},
        ],
    },
}

YEARS = list(range(2014, 2025))
SESSIONS = ["march", "may_june", "october_november"]


def canonical_level_name(level_key: str) -> str:
    return "O Level" if "o_level" in level_key else "A Level"


def iter_subjects(
    board: str | None = None,
    level_key: str | None = None,
    subject_name: str | None = None,
) -> Iterator[tuple[str, str, dict]]:
    for board_key, levels in SUBJECT_REGISTRY.items():
        if board and board_key != board.lower():
            continue
        for current_level, subjects in levels.items():
            if level_key and current_level != level_key:
                continue
            for subject in subjects:
                if subject_name and subject["name"].lower() != subject_name.lower():
                    continue
                yield board_key, current_level, subject

