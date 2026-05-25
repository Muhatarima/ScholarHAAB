from __future__ import annotations

from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PIPELINE_ROOT / "raw"
EXTRACTED_DIR = PIPELINE_ROOT / "extracted"
VALIDATED_DIR = PIPELINE_ROOT / "validated"
EMBEDDINGS_DIR = PIPELINE_ROOT / "embeddings"
LOGS_DIR = PIPELINE_ROOT / "logs"
REPORTS_DIR = PIPELINE_ROOT / "reports"

CAMBRIDGE_O_LEVEL_SUBJECTS = {
    "Physics": "5054",
    "Chemistry": "5070",
    "Mathematics": "4024",
    "Additional Mathematics": "4037",
    "Biology": "5090",
    "English Language": "1123",
    "English Literature": "2010",
    "Economics": "2281",
    "Geography": "2217",
    "History": "2147",
    "Computer Science": "2210",
    "Islamiyat": "2058",
    "Accounting": "7707",
    "Commerce": "7100",
    "Business Studies": "7115",
    "Sociology": "2251",
    "Bangladesh Studies": "7094",
    "Combined Science": "5129",
    "Co-ordinated Sciences": "5265",
    "Environmental Management": "0680",
}

CAMBRIDGE_A_LEVEL_SUBJECTS = {
    "Physics": "9702",
    "Chemistry": "9701",
    "Mathematics": "9709",
    "Further Mathematics": "9231",
    "Biology": "9700",
    "English Language": "9093",
    "English Literature": "9695",
    "Economics": "9708",
    "Computer Science": "9618",
    "Accounting": "9706",
    "Geography": "9696",
    "History": "9489",
    "Business": "9609",
    "Psychology": "9990",
    "Sociology": "9699",
    "Law": "9084",
    "Media Studies": "9607",
    "Physical Education": "9396",
}

EDEXCEL_O_LEVEL_SUBJECTS = {
    "Physics": "4PH1",
    "Chemistry": "4CH1",
    "Mathematics": "4MA1",
    "Biology": "4BI1",
    "English Language": "4EA1",
    "Additional Mathematics": "4AM1",
    "Commerce": "4CM1",
    "Economics": "4EC1",
    "Accounting": "4AC1",
    "Business Studies": "4BS1",
    "Computer Science": "4IT1",
    "Geography": "4GE1",
    "History": "4HI1",
}

EDEXCEL_A_LEVEL_SUBJECTS = {
    "Physics": "8PH0",
    "Chemistry": "8CH0",
    "Mathematics": "8MA0",
    "Further Mathematics": "8FM0",
    "Biology": "8BI0",
    "English Language": "8EN0",
    "Economics": "8EC0",
    "Computer Science": "8CP0",
    "Accounting": "8AC0",
    "Business": "8BS0",
    "Geography": "8GE0",
    "History": "8HI0",
    "Psychology": "8PS0",
    "Sociology": "8SO0",
}

YEARS = list(range(2014, 2025))
SESSIONS = ["May_June", "Oct_Nov", "Feb_Mar"]
PAPER_TYPES = ["qp", "ms"]

CAMBRIDGE_LEVELS = {
    "o-level": CAMBRIDGE_O_LEVEL_SUBJECTS,
    "a-level": CAMBRIDGE_A_LEVEL_SUBJECTS,
}

EDEXCEL_LEVELS = {
    "o-level": EDEXCEL_O_LEVEL_SUBJECTS,
    "a-level": EDEXCEL_A_LEVEL_SUBJECTS,
}

PAPER_NUMBERS = {
    ("cambridge", "o-level"): ["1", "2", "3", "4"],
    ("cambridge", "a-level"): ["1", "2", "3", "4", "5"],
    ("edexcel", "o-level"): ["1", "2", "3"],
    ("edexcel", "a-level"): ["1", "2", "3", "4"],
}

CAMBRIDGE_SESSION_CODES = {
    "May_June": ["s", "m"],
    "Oct_Nov": ["w"],
    "Feb_Mar": ["m"],
}

EDEXCEL_SESSION_CODES = {
    "May_June": ["June", "Jun"],
    "Oct_Nov": ["October", "Oct", "November", "Nov"],
    "Feb_Mar": ["January", "Jan"],
}


def safe_name(value: str) -> str:
    return (
        value.lower()
        .replace("&", "and")
        .replace("/", "-")
        .replace(" ", "-")
        .replace("(", "")
        .replace(")", "")
    )


def iter_targets():
    for board, levels in (("cambridge", CAMBRIDGE_LEVELS), ("edexcel", EDEXCEL_LEVELS)):
        for level, subjects in levels.items():
            for subject, code in subjects.items():
                for year in YEARS:
                    for session in SESSIONS:
                        for paper in PAPER_NUMBERS[(board, level)]:
                            for paper_type in PAPER_TYPES:
                                yield {
                                    "board": board,
                                    "level": level,
                                    "subject": subject,
                                    "code": code,
                                    "year": year,
                                    "session": session,
                                    "paper": paper,
                                    "paper_type": paper_type,
                                }
