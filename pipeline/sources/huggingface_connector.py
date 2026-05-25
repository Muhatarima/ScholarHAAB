from __future__ import annotations

from typing import Any

from pipeline.schema import normalize_question_record
from pipeline.utils import logger, safe_fix_text

HUGGINGFACE_DATASETS = [
    "cais/mmlu",
    "allenai/sciq",
    "derek-thomas/ScienceQA",
    "lighteval/MATH",
    "EleutherAI/hendrycks_math",
    "aqua_rat",
    "math_qa",
    "competition_math",
    "gsm8k",
    "openai/grade-school-math",
]


def search_huggingface_for_subject(subject_name: str) -> list[str]:
    try:
        from huggingface_hub import HfApi  # type: ignore
    except Exception as exc:
        logger.warning(f"HuggingFace search unavailable: {exc}")
        return []

    api = HfApi()
    try:
        results = api.list_datasets(search=f"{subject_name} exam", limit=20)
    except Exception as exc:
        logger.warning(f"HuggingFace search failed for {subject_name}: {exc}")
        return []

    relevant: list[str] = []
    for dataset in results:
        if any(
            token in dataset.id.lower()
            for token in ["exam", "question", "level", "cambridge", "gcse", "alevel"]
        ):
            relevant.append(dataset.id)
    return relevant


def normalize_hf_item(
    item: dict[str, Any], source: str, subject: str, board: str, level: str
) -> dict[str, Any] | None:
    question = (
        item.get("question")
        or item.get("problem")
        or item.get("input")
        or item.get("Q")
        or ""
    )
    answer = item.get("answer") or item.get("solution") or item.get("output") or item.get("A") or ""
    context = item.get("context") or item.get("explanation") or item.get("rationale") or ""
    if not question or not answer:
        return None

    return normalize_question_record(
        {
            "question": safe_fix_text(str(question)),
            "answer": safe_fix_text(str(answer)),
            "worked_solution": safe_fix_text(str(context)),
            "subject": subject,
            "board": board,
            "level": level,
            "topic": "General",
            "question_type": "hf_dataset",
            "source": f"huggingface:{source}",
            "verified": False,
            "verification_score": 0.25,
            "ocr_quality": 1.0,
        }
    )


def _pick_split(dataset: Any):
    if hasattr(dataset, "keys"):
        for split in ("train", "validation", "test"):
            if split in dataset:
                return dataset[split]
        first_key = next(iter(dataset.keys()))
        return dataset[first_key]
    return dataset


def download_hf_dataset(
    dataset_id: str, subject: str, board: str, level: str, limit: int = 500
) -> list[dict[str, Any]]:
    try:
        from datasets import load_dataset  # type: ignore
    except Exception as exc:
        logger.warning(f"HuggingFace datasets unavailable: {exc}")
        return []

    try:
        dataset = load_dataset(dataset_id, trust_remote_code=True)
        split = _pick_split(dataset)
    except Exception as exc:
        logger.warning(f"HF dataset {dataset_id} failed: {exc}")
        return []

    rows: list[dict[str, Any]] = []
    try:
        for index, item in enumerate(split):
            if index >= limit:
                break
            row = normalize_hf_item(item, dataset_id, subject, board, level)
            if row:
                rows.append(row)
    except Exception as exc:
        logger.warning(f"HF dataset iteration failed for {dataset_id}: {exc}")
    return rows
