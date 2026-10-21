#!/usr/bin/env python3
"""Backfill missing 2021-24 prefectural tournaments from koshien89.com.

Run: python scripts/backfill_missing_2021_2024.py --year 2022
Never replaces populated CSVs. Parse only one confidently matched article per unit.
"""
from __future__ import annotations
import argparse,csv,re,sys,collections
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import fetch_2025_spring as parser

ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/"master/historical_backfill_queue_2021_2024.csv"
SEASONS={"spring":("春季","春"),"summer":("夏","選手権"),"autumn":("秋季","秋")}
CAT={p[1]:(p[0],p[3]) for p in parser.PREFS}

def find_matches(s,year,season,pref,max_pages):
    category,region=CAT[pref]
    hits={}
    for page in range(max_pages):
        suffix=f"-{page}" if page else ""
        url=f"https://koshien89.com/blog-category-{category}{suffix}.html"
        try:
            soup=BeautifulSoup(parser.get(s,url),"html.parser")
        except requests.RequestException:
            continue
        for a in soup.select("a[href]"):
            href=urljoin(url,a["href"]).split("#")[0]
            title=parser.normalize_text(a.get_text(" ",strip=True))
            if "blog-entry-" not in href or str(year) not in title:continue
            if not any(x in title for x in SEASONS[season]):continue
            score=int(pref in title)*5+int("大会" in title)*2+int("結果" in title)+int("日程" in title)
            if any(x in title for x in ("地区大会","中国大会","四国大会","九州大会","全国大会","甲子園")):score-=8
            if score>=2 and (href not in hits or score>hits[href][0]):hits[href]=(score,title)
        if hits and page>=2:break
    return sorted([(score,title,url) for url,(score,title) in hits.items()],reverse=True)

def main():
    a=argparse.ArgumentParser()
    a.add_argument("--year",type=int,choices=[2021,2022,2023,2024],default=2022)
    a.add_argument("--max-pages",type=int,default=30)
    a.add_argument("--apply",action="store_true",help="write verified new CSVs")
    args=a.parse_args()
    with QUEUE.open(encoding="utf-8-sig",newline="") as f:queue=list(csv.DictReader(f))
    s=requests.Session();summary=collections.Counter()
    for item in queue:
        if int(item["year"])!=args.year:continue
        year,season,pref=int(item["year"]),item["season"],item["prefecture"]
        path=ROOT/"data"/"imported"/str(year)/season/f"{pref}.csv"
        if path.exists() and path.stat().st_size>100:
            print(f"SKIP existing: {path.relative_to(ROOT)}");summary["existing"]+=1;continue
        candidates=find_matches(s,year,season,pref,args.max_pages)
        if not candidates:
            print(f"NOT_FOUND {year} {season} {pref}");summary["not_found"]+=1;continue
        # An ambiguous top-scoring article is not safe to import automatically.
        if len(candidates)>1 and candidates[0][0]==candidates[1][0]:
            print(f"AMBIGUOUS {year} {season} {pref}: "+repr(candidates[:4]));summary["ambiguous"]+=1;continue
        _,title,url=candidates[0]
        try:html=parser.get(s,url)
        except requests.RequestException as e:
            print(f"FETCH_ERROR {pref}: {e}");summary["fetch_error"]+=1;continue
        parser.YEAR=year
        rows=parser.parse_games(html,pref,CAT[pref][1],url,title)
        for row in rows:
            row["season"]=season
            row["note"]=";".join(x for x in (row.get("note",""),"level=prefecture") if x)
        # Parser should never silently import incomplete/misidentified tournaments.
        if len(rows)<12 or len({r["date"] for r in rows})<2 or len({r["team1"] for r in rows})<8:
            print(f"REVIEW {year} {season} {pref}: {len(rows)} rows {url}");summary["review"]+=1;continue
        print(f"{'IMPORT' if args.apply else 'DRY_RUN'} {year} {season} {pref}: {len(rows)} rows {url}")
        summary["qualified"]+=1
        if args.apply:
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open("x",encoding="utf-8-sig",newline="") as f:
                w=csv.DictWriter(f,fieldnames=parser.CSV_FIELDS);w.writeheader();w.writerows(rows)
            summary["written"]+=1
    print("SUMMARY",dict(summary))
if __name__=="__main__":main()
