from __future__ import annotations

import argparse
import asyncio
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import aiohttp

from config import LOGS_DIR, RAW_DIR, REPORTS_DIR, iter_targets, safe_name

DOWNLOAD_LOG = LOGS_DIR / "download_log.jsonl"
FAILED_LOG = LOGS_DIR / "failed_downloads.jsonl"
REPORT_PATH = REPORTS_DIR / "download_report.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def session_code_candidates(session: str, year: int, board: str) -> list[str]:
    yy = str(year)[-2:]
    if board == "cambridge":
        if session == "May_June":
            return [f"s{yy}", f"m{yy}"]
        if session == "Oct_Nov":
            return [f"w{yy}"]
        return [f"m{yy}", f"sp{yy}"]
    if session == "May_June":
        return [f"June-{year}", f"Summer-{year}", f"Jun-{year}"]
    if session == "Oct_Nov":
        return [f"October-{year}", f"November-{year}", f"Oct-{year}", f"Nov-{year}"]
    return [f"January-{year}", f"Jan-{year}"]


def paper_variant_candidates(paper: str, board: str) -> list[str]:
    if board == "cambridge":
        return [paper, f"{paper}1", f"{paper}2", f"{paper}3"]
    return [paper, f"0{paper}", f"{paper}A", f"{paper}B"]


def build_url_list(target: dict[str, Any]) -> list[str]:
    board = target["board"]
    level = target["level"]
    subject = target["subject"]
    code = target["code"]
    year = int(target["year"])
    session = target["session"]
    paper_type = target["paper_type"]
    paper = target["paper"]
    subject_slug = safe_name(subject)
    urls: list[str] = []

    if board == "cambridge":
        gce_level = "A Levels" if level == "a-level" else "O Levels"
        encoded_subject = quote(f"{subject} ({code})")
        for session_code in session_code_candidates(session, year, board):
            for variant in paper_variant_candidates(paper, board):
                file_name = f"{code}_{session_code}_{paper_type}_{variant}.pdf"
                urls.extend(
                    [
                        f"https://papers.gceguide.com/{quote(gce_level)}/{encoded_subject}/{file_name}",
                        f"https://papers.gceguide.com/{quote(gce_level)}/{code}/{year}/{file_name}",
                        f"https://papers.gceguide.com/{quote(gce_level)}/{encoded_subject}/{year}/{file_name}",
                        f"https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/{file_name}",
                    ]
                )
    else:
        # Pearson names are less uniform. These URLs are fallback candidates; real
        # discovery uses Pearson/PapaCambridge index pages when available.
        type_label = "Question-paper" if paper_type == "qp" else "Mark-scheme"
        for session_code in session_code_candidates(session, year, board):
            for variant in paper_variant_candidates(paper, board):
                urls.extend(
                    [
                        f"https://qualifications.pearson.com/content/dam/pdf/{level}/{subject_slug}/{year}/{type_label}-{code}-{session_code}-paper-{variant}.pdf",
                        f"https://pastpapers.papacambridge.com/directories/Edexcel/Edexcel-pastpapers/upload/{code}_{session_code}_{paper_type}_{variant}.pdf",
                        f"https://pastpapers.papacambridge.com/directories/Edexcel/Edexcel-pastpapers/upload/{code}-{session_code}-{paper_type}-{variant}.pdf",
                    ]
                )

    seen: set[str] = set()
    unique: list[str] = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def save_path_for(target: dict[str, Any]) -> Path:
    return (
        RAW_DIR
        / target["board"]
        / target["level"]
        / safe_name(target["subject"])
        / str(target["year"])
        / f"{target['session']}_paper{target['paper']}_{target['paper_type']}.pdf"
    )


async def fetch_pdf(session: aiohttp.ClientSession, url: str) -> bytes | None:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=35)) as response:
            if response.status != 200:
                return None
            content = await response.read()
            if len(content) > 1000 and content[:4] == b"%PDF":
                return content
            return None
    except Exception:
        return None


async def download_single_paper(
    target: dict[str, Any],
    http: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    retries: int = 5,
) -> dict[str, Any]:
    path = save_path_for(target)
    log_base = {**target, "file_path": str(path), "timestamp": now_iso()}

    if path.exists() and path.stat().st_size > 1000:
        row = {**log_base, "status": "SKIPPED", "message": "Already exists"}
        append_jsonl(DOWNLOAD_LOG, row)
        return row

    urls = build_url_list(target)
    async with semaphore:
        for attempt in range(1, retries + 1):
            for url in urls:
                content = await fetch_pdf(http, url)
                if content:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(content)
                    row = {**log_base, "status": "SUCCESS", "url": url, "bytes": len(content), "attempt": attempt}
                    append_jsonl(DOWNLOAD_LOG, row)
                    await asyncio.sleep(1)
                    return row
            await asyncio.sleep(3)

    row = {**log_base, "status": "FAILED", "message": "All URL candidates failed", "url_count": len(urls)}
    append_jsonl(DOWNLOAD_LOG, row)
    append_jsonl(FAILED_LOG, row)
    return row


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(results)
    success = sum(1 for row in results if row["status"] in {"SUCCESS", "SKIPPED"})
    failed = sum(1 for row in results if row["status"] == "FAILED")
    by_board = Counter(row["board"] for row in results if row["status"] in {"SUCCESS", "SKIPPED"})
    by_level = Counter(row["level"] for row in results if row["status"] in {"SUCCESS", "SKIPPED"})
    by_subject: dict[str, int] = defaultdict(int)
    years: set[int] = set()
    for row in results:
        if row["status"] in {"SUCCESS", "SKIPPED"}:
            by_subject[f"{row['board']} {row['level']} {row['subject']}"] += 1
            years.add(int(row["year"]))
    return {
        "total_attempted": total,
        "total_success": success,
        "total_failed": failed,
        "success_rate": f"{(success / total * 100) if total else 0:.2f}%",
        "by_board": dict(by_board),
        "by_level": dict(by_level),
        "by_subject": dict(sorted(by_subject.items())),
        "years_covered": sorted(years),
        "failed_list": [row for row in results if row["status"] == "FAILED"],
        "created_at": now_iso(),
    }


async def download_all_papers(limit: int | None = None, concurrency: int = 5) -> dict[str, Any]:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    targets = list(iter_targets())
    if limit is not None:
        targets = targets[:limit]

    semaphore = asyncio.Semaphore(concurrency)
    headers = {"User-Agent": "ScholarHAAB dataset builder (+educational research; polite rate-limited)"}
    async with aiohttp.ClientSession(headers=headers) as http:
        tasks = [download_single_paper(target, http, semaphore) for target in targets]
        results = await asyncio.gather(*tasks)

    report = summarize(results)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Limit targets for smoke tests.")
    parser.add_argument("--concurrency", type=int, default=5)
    args = parser.parse_args()
    report = asyncio.run(download_all_papers(limit=args.limit, concurrency=args.concurrency))
    rate = float(report["success_rate"].rstrip("%")) if report["total_attempted"] else 0
    return 0 if rate >= 70 or args.limit else 2


if __name__ == "__main__":
    raise SystemExit(main())
