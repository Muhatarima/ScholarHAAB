from __future__ import annotations

import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from pipeline.utils import logger

CAMBRIDGE_SYLLABUS_BASE = "https://www.cambridgeinternational.org/programmes-and-qualifications"


def _qualification_slug(level: str) -> str:
    return "cambridge-international-as-and-a-level" if "A Level" in level else "cambridge-o-level"


def _find_syllabus_pdf_links(html: str, base_url: str, subject_code: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        text = anchor.get_text(" ", strip=True).lower()
        if subject_code.lower() in href.lower() or subject_code.lower() in text:
            if href.lower().endswith(".pdf") or "syllabus" in text:
                links.append(urljoin(base_url, href))
    return sorted(set(links))


def _extract_topics_from_pdf(pdf_path: Path) -> list[dict]:
    try:
        import fitz  # type: ignore
    except Exception as exc:
        logger.warning(f"PyMuPDF unavailable for syllabus parsing: {exc}")
        return []

    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc[:12])
    topic_lines = re.findall(r"(?:Topic|Unit|\d+\.\d+)\s+([A-Z][A-Za-z0-9 ,()/&-]{4,80})", text)
    seen: set[str] = set()
    topics: list[dict] = []
    for line in topic_lines:
        topic = re.sub(r"\s+", " ", line).strip(" -")
        if topic.lower() in seen:
            continue
        seen.add(topic.lower())
        topics.append({"topic": topic, "subtopics": [], "weight": "unknown"})
    return topics


def get_syllabus_topics(subject_code: str, level: str) -> list[dict]:
    qualification_slug = _qualification_slug(level)
    url = f"{CAMBRIDGE_SYLLABUS_BASE}/{qualification_slug}/"
    try:
        response = requests.get(url, timeout=25)
        response.raise_for_status()
    except Exception as exc:
        logger.warning(f"Failed to fetch Cambridge syllabus index: {exc}")
        return []

    pdf_links = _find_syllabus_pdf_links(response.text, url, subject_code)
    if not pdf_links:
        return []

    try:
        pdf_response = requests.get(pdf_links[0], timeout=30)
        pdf_response.raise_for_status()
    except Exception as exc:
        logger.warning(f"Failed to download syllabus PDF for {subject_code}: {exc}")
        return []

    with NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
        handle.write(pdf_response.content)
        temp_path = Path(handle.name)
    try:
        return _extract_topics_from_pdf(temp_path)
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
