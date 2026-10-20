#!/usr/bin/env python3
"""Incrementally backfill 2021-2026 prefectural results from the ten supplied category pages.

This is a conservative backfill: already existing CSVs are appended to, not replaced.
Coverage is never marked verified merely because a category HTTP request succeeded.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from process_import_requests import (
    PREF_TO_REGION, analyze, discover_result_urls, merge_csv,
    normalize_approved_rows,
)

CATEGORIES = {
    "石川": 24, "富山": 23, "福井": 25, "長野": 22, "新潟": 21,
    "北海道": 6, "東京": 20, "岐阜": 28, "三重": 29, "大阪": 32,
}
SEASONS = ("spring", "summer", "autumn")
YEARS = range(2021, 2027)
REPORT = Path("master/backfill_10pref_2021_2026_status.json")


def now():
    return datetime.now(timezone.utc).isoformat()


def expected_units():
    result = []
    for pref in CATEGORIES:
        for year in YEARS:
            for season in SEASONS:
                if season == "summer" and pref == "北海道":
                    names = ("北北海道", "南北海道")
                elif season == "summer" and pref == "東京":
                    names = ("東東京", "西東京")
                else:
                    names = (pref,)
                for name in names:
                    result.append({"prefecture": pref, "unit": name, "year": year,
                                   "season": season})
    return result


def load_report():
    if REPORT.exists():
        return json.loads(REPORT.read_text(encoding="utf-8"))
    return {"version": 1, "expected_units": expected_units(), "prefectures": {}}


def save_report(report):
    report["updated_at"] = now()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")


def wait(attempt):
    time.sleep(min(25, 5 * (attempt + 1)))


def discover_category(pref, category):
    url = f"https://koshien89.com/blog-category-{category}.html"
    for attempt in range(2):
        try:
            found, pages = discover_result_urls(
                url, limit=100, year_from=2021, year_to=2026,
                seasons=SEASONS, follow_pagination=True,
            )
            if not found:
                raise RuntimeError("no article URLs discovered (not proof of zero tournaments)")
            return found, pages, ""
        except Exception as exc:
            message = str(exc)
            if attempt == 0:
                wait(attempt)
    return [], 0, message


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefectures", nargs="*", default=list(CATEGORIES))
    parser.add_argument("--max-articles", type=int, default=0)
    args = parser.parse_args()
    prefs = [p for p in args.prefectures if p in CATEGORIES]
    report = load_report()
    total_added = 0
    total_processed = 0

    for pref in prefs:
        record = report["prefectures"].setdefault(pref, {})
        record["started_at"] = now()
        record["status"] = "running"
        urls, pages, err = discover_category(pref, CATEGORIES[pref])
        record.update({"category_url": f"https://koshien89.com/blog-category-{CATEGORIES[pref]}.html",
                       "pages_scanned": pages, "article_urls_found": len(urls),
                       "discover_error": err})
        if err:
            record["status"] = "source_unavailable"
            save_report(report)
            print(f"{pref}: category unavailable: {err}", flush=True)
            continue

        # Record a durable article-level audit. Never report a source as complete
        # if HTTP retrieval or metadata recognition failed.
        articles = record.setdefault("articles", {})
        for url in urls:
            if args.max_articles and total_processed >= args.max_articles:
                break
            if articles.get(url, {}).get("status") == "registered":
                continue
            child = {
                "source_url": url, "year": "", "season": "",
                "prefecture": pref, "locked_prefecture": pref,
                "region": PREF_TO_REGION.get(pref, ""),
                "level": "prefecture", "tournament": "",
                "batch_auto_metadata": True,
            }
            try:
                rows, warnings = analyze(child)
                rows = normalize_approved_rows(rows, "prefecture")
                if not rows:
                    raise ValueError("article parsed as zero matches")
                year = str(child.get("year") or "")
                season = str(child.get("season") or "")
                # Metadata must match the requested period and prefecture.
                if not year.isdigit() or int(year) not in YEARS or season not in SEASONS:
                    raise ValueError(f"out-of-scope metadata: year={year} season={season}")
                if child.get("level") != "prefecture":
                    raise ValueError(f"non-prefecture article: {child.get('level')}")
                if not child.get("tournament"):
                    raise ValueError("missing tournament metadata")
                canonical_pref = pref
                path = Path("data/imported") / year / season / (canonical_pref + ".csv")
                count, _, _ = merge_csv(path, rows, mode="append")
                articles[url] = {
                    "status": "registered", "year": year, "season": season,
                    "tournament": child["tournament"],
                    "parsed_rows": len(rows), "new_rows": count,
                    "warnings": warnings, "recorded_at": now(),
                }
                total_added += count
                print(f"{pref} {year} {season} {len(rows)} rows, {count} new: {url}",
                      flush=True)
            except Exception as exc:
                articles[url] = {"status": "error", "error": str(exc),
                                 "recorded_at": now()}
                print(f"{pref} ERROR: {url} {exc}", flush=True)
            total_processed += 1
            # Avoid hammering the source; this importer is intentionally serial.
            time.sleep(1.4)
            save_report(report)

        errors = [u for u in urls if articles.get(u, {}).get("status") != "registered"]
        record["status"] = "needs_coverage_verification" if not errors else "partial"
        record["failed_article_urls"] = errors
        record["registered_article_urls"] = sum(
            articles.get(u, {}).get("status") == "registered" for u in urls
        )
        save_report(report)

    report["summary"] = {
        "expected_units": len(expected_units()),
        "articles_processed_this_run": total_processed,
        "new_csv_rows_this_run": total_added,
        "coverage_verified": False,
        "description": "Only source parsing/CSV append verified, not complete match coverage.",
    }
    save_report(report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
