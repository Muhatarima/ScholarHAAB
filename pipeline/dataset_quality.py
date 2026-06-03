"""Production RAG quality gate — reject datasets scoring below 70."""

from __future__ import annotations

PERMITTED_LICENSE_TERMS = (
    "cc0",
    "cc-by",
    "cc by",
    "creative commons",
    "mit",
    "apache",
    "public domain",
    "user_provided",
    "permitted",
)

APPROVED_HF_DATASETS = {
    "cais/mmlu",
    "allenai/sciq",
    "derek-thomas/ScienceQA",
    "gsm8k",
    "lighteval/MATH",
    "EleutherAI/hendrycks_math",
}

PRODUCTION_THRESHOLD = 70


def is_permitted_license(license_name: str) -> bool:
    lower = (license_name or "").lower()
    return any(term in lower for term in PERMITTED_LICENSE_TERMS)


def evaluate_dataset_quality(
    *,
    name: str,
    license_name: str,
    relevance: bool,
    subject_mapped: bool,
    board_supported: bool,
    has_duplicates: bool,
    low_quality: bool = False,
) -> tuple[int, bool]:
    score = 0
    if is_permitted_license(license_name):
        score += 25
    if relevance:
        score += 20
    if subject_mapped:
        score += 20
    if board_supported:
        score += 15
    if not has_duplicates:
        score += 10
    if not low_quality:
        score += 10
    passed = score >= PRODUCTION_THRESHOLD and is_permitted_license(license_name) and not low_quality
    return score, passed


def hf_import_allowed(dataset_id: str) -> bool:
    return dataset_id in APPROVED_HF_DATASETS
