from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from requests import Response
from requests.exceptions import SSLError

from pipeline.schema import normalize_formula_record
from pipeline.utils import logger, looks_like_formula_candidate, safe_fix_text

SOURCES = {
    "papers_xtremepapers": {
        "base": "https://papers.xtremepapersco.com",
        "pattern": "/cambridge/{level}/{subject}/{year}/",
        "robots": True,
    },
    "revision_world": {
        "base": "https://revisionworld.com",
        "pattern": "/a2-level-level-revision/{subject}/",
        "robots": True,
    },
    "save_my_exams": {
        "base": "https://www.savemyexams.com",
        "pattern": "/{level}/{subject}/",
        "robots": True,
        "rate_limit": 3,
    },
    "znotes": {
        "base": "https://znotes.org",
        "pattern": "/cambridge-as-a-level/{subject}/",
        "robots": True,
    },
    "physics_and_maths_tutor": {
        "base": "https://www.physicsandmathstutor.com",
        "pattern": "/{subject}/",
        "robots": True,
        "rate_limit": 5,
    },
}

FORMULA_SOURCES = {
    "chemguide": "https://www.chemguide.co.uk",
    "physicsnet": "https://physics.net/formulas",
    "s_cool": "https://www.s-cool.co.uk",
    "mathsisfun": "https://www.mathsisfun.com/algebra/",
}

USER_AGENT = "ScholarHAAB Educational Bot/1.0 (educational dataset, contact: haab@scholarhaab.com)"
REQUEST_TIMEOUT_SECONDS = 20


async def scrape_with_playwright(url: str, wait_selector: str | None = None) -> str:
    try:
        from playwright.async_api import async_playwright  # type: ignore
    except Exception as exc:
        raise RuntimeError(f"Playwright unavailable: {exc}") from exc

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_extra_http_headers({"User-Agent": USER_AGENT})
        try:
            await page.goto(url, timeout=30000)
            if wait_selector:
                await page.wait_for_selector(wait_selector, timeout=10000)
            return await page.content()
        finally:
            await browser.close()


def _request_url(url: str, timeout: int = REQUEST_TIMEOUT_SECONDS, verify: bool = True) -> Response:
    return requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT},
        allow_redirects=True,
        verify=verify,
    )


def _fetch_html(url: str, timeout: int = REQUEST_TIMEOUT_SECONDS) -> str:
    try:
        response = _request_url(url, timeout=timeout, verify=True)
    except SSLError:
        logger.warning(f"SSL verification failed for {url}; retrying without certificate validation.")
        response = _request_url(url, timeout=timeout, verify=False)
    response.raise_for_status()
    return response.text


def _subject_slug(subject_name: str) -> str:
    return subject_name.lower().replace(" ", "-")


def _build_candidate_urls(board: str, level: str, subject: dict[str, Any], year: int) -> list[str]:
    level_slug = level.lower().replace(" ", "-")
    subject_slug = _subject_slug(subject["name"])
    urls: list[str] = []
    for source in SOURCES.values():
        pattern = source["pattern"].format(level=level_slug, subject=subject_slug, year=year)
        urls.append(urljoin(source["base"], pattern))
    if board.lower() == "cambridge":
        urls.append(
            f"https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/{subject['code']}_*.pdf"
        )
    return urls


def _extract_pdf_links(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    found: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if href.lower().endswith(".pdf"):
            found.append(urljoin(base_url, href))
    return sorted(set(found))


def _looks_like_subject_mismatch(html: str, subject_name: str) -> bool:
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()
    subject_tokens = set(subject_name.lower().split())
    if not subject_tokens:
        return False
    hits = sum(1 for token in subject_tokens if token in text)
    return hits == 0


async def scrape_subject_papers(board: str, level: str, subject: dict[str, Any], year: int) -> list[dict[str, Any]]:
    candidates = _build_candidate_urls(board, level, subject, year)
    records: list[dict[str, Any]] = []
    for url in candidates:
        if "*" in url:
            continue
        try:
            html = await asyncio.to_thread(_fetch_html, url)
        except Exception as exc:
            logger.warning(f"Web scrape failed for {url}: {exc}")
            continue
        if _looks_like_subject_mismatch(html, subject["name"]):
            logger.warning(f"Skipping redirected or mismatched source page for {subject['name']}: {url}")
            continue
        links = _extract_pdf_links(url, html)
        for link in links:
            records.append(
                {
                    "board": board,
                    "level": level,
                    "subject": subject["name"],
                    "subject_code": subject["code"],
                    "topic": "Past paper source",
                    "subtopic": "",
                    "year": year,
                    "session": "",
                    "paper_number": None,
                    "question_number": None,
                    "question": f"Source PDF discovered for {subject['name']} {year}",
                    "answer": "Refer to the official PDF source for extracted questions.",
                    "worked_solution": "",
                    "marks": None,
                    "question_type": "source_link",
                    "source": link,
                    "verified": False,
                    "verification_score": 0.1,
                    "ocr_quality": 1.0,
                }
            )
        if links:
            break
    return records


def scrape_formulas(subject: str) -> list[dict[str, Any]]:
    formulas: list[dict[str, Any]] = []
    subject_key = subject.lower()
    for name, url in FORMULA_SOURCES.items():
        try:
            html = _fetch_html(url)
        except Exception as exc:
            logger.warning(f"Formula scrape failed for {name}: {exc}")
            continue
        text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
        matches = re.findall(r"\b[A-Za-z][A-Za-z0-9]*\s*=\s*[^.]{1,40}", text)
        for formula in matches[:10]:
            formula_text = safe_fix_text(formula)
            if subject_key not in text.lower() and subject_key not in formula_text.lower():
                continue
            if not looks_like_formula_candidate(formula_text):
                continue
            formulas.append(
                normalize_formula_record(
                    {
                        "subject": subject,
                        "topic": "Formula bank",
                        "formula_text": formula_text,
                        "latex": formula_text,
                        "variables": {},
                        "conditions": "",
                        "level": "A Level",
                        "board": "General",
                        "source": f"web:{url}",
                        "verified": False,
                    }
                )
            )
    return formulas
