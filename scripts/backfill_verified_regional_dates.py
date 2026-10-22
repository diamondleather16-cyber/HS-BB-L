#!/usr/bin/env python3
"""Conservative historical regional date recovery. Never infer a date from round alone."""
import csv
import io
import json
import re
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

LEDGER = Path("docs/data/historical_ledger_2017_2024.csv")
REPORT = Path("output/audit/regional_date_backfill.json")
BASE = "https://www.nikkansports.com/baseball/highschool/{season}/{year}/result/{area}.html"
REGION_MAP = {
    "hokkaido": ("hokkaido",), "tohoku": ("tohoku",),
    "kanto_tokyo": ("kanto", "tokyo"),
    "hokushinetsu": ("hokushin",), "tokai": ("tokai",),
    "kinki": ("kinki",), "chugoku": ("chugoku",),
    "shikoku": ("shikoku",), "kyushu": ("kyusyu", "kyushu"),
}
SCORE = re.compile(r"^([0-9０-９]+)\s*[-－−ー―–]\s*([0-9０-９]+)$")
DAY = re.compile(r"(?:(\d{1,2})月)?(\d{1,2})日")
ALIASES = {"愛産大三河": "愛知産大三河", "工大福井": "福井工大福井",
           "航空石川": "日本航空石川", "金沢学院東": "金沢学院",
           "ウェルネス": "日本ウェルネス筑北"}
def normalize(s):
    s = unicodedata.normalize("NFKC", s or "").replace("髙","高").replace("﨑","崎")
    s = re.sub(r"[\s・･\.．（）()\-]", "", s)
    return ALIASES.get(s, s)

def extract_games(html, year):
    soup = BeautifulSoup(html, "html.parser")
    body = soup.get_text("\n", strip=True)
    start = body.find("地区大会日程・結果はこちら")
    if start < 0:
        start = body.find("日程・結果はこちら")
    if start < 0:
        return []
    body = body[start:]
    end = body.find("プロ野球球団別ページ")
    if end >= 0:
        body = body[:end]
    tokens = [x.strip() for x in body.splitlines() if x.strip()]
    matches = []
    month = None
    day = None
    for i, token in enumerate(tokens):
        hit = DAY.search(token)
        if hit and ("月" in token or month is not None):
            if hit.group(1):
                month = int(hit.group(1))
            day = int(hit.group(2))
        score = SCORE.fullmatch(token)
        if score and month and day and 0 < i < len(tokens)-1:
            a, b = tokens[i-1], tokens[i+1]
            if a.isdecimal() or b.isdecimal() or "月" in a or "月" in b:
                continue
            try:
                match_day = date(year, month, day).isoformat()
            except ValueError:
                continue
            matches.append((normalize(a), int(score.group(1)),
                            normalize(b), int(score.group(2)), match_day))
    return matches

def download(url):
    req = Request(url, headers={"User-Agent":"Mozilla/5.0 (compatible; HS-BB-L-date-audit/1.0)"})
    try:
        with urlopen(req, timeout=22) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception as e:
        return None

def key(a,s1,b,s2):
    x = (normalize(a),int(s1)); y = (normalize(b),int(s2))
    return tuple(sorted((x,y)))

def main():
    with LEDGER.open("r",encoding="utf-8-sig",newline="") as fp:
        original = fp.read()
    rows = list(csv.DictReader(io.StringIO(original)))
    fields = list(rows[0].keys())
    targets = defaultdict(list)
    for row in rows:
        if row.get("region") in REGION_MAP and not row.get("date") and row.get("season") in ("spring","autumn"):
            targets[(int(row["year"]),row["season"],row["region"])].append(row)
    pages, failures, ambiguous = [], [], []
    filled = 0
    for (year,season,region), group in sorted(targets.items()):
        found = defaultdict(set)
        source = {}
        for area in REGION_MAP[region]:
            season_dir = "syunki" if season == "spring" else "syuuki"
            url = BASE.format(season=season_dir,year=year,area=area)
            html = download(url)
            if not html:
                failures.append(url)
                continue
            games = extract_games(html,year)
            pages.append({"url":url,"games":len(games)})
            for a,s1,b,s2,dt in games:
                k = key(a,s1,b,s2)
                found[k].add(dt)
                source[(k,dt)] = url
            time.sleep(0.2)
        for row in group:
            try:
                k=key(row["team1"],row["score1"],row["team2"],row["score2"])
            except (ValueError,TypeError):
                continue
            dates=found.get(k,set())
            if len(dates)==1:
                dt=next(iter(dates))
                row["date"]=dt
                row["source_url"]=source[(k,dt)]
                row["source_status"]="試合日・対戦・スコア照合済み"
                row["note"]=(row.get("note") or "")+";verified_match_date=1"
                filled+=1
            elif len(dates)>1:
                ambiguous.append({"year":year,"season":season,"region":region,
                                  "team1":row["team1"],"team2":row["team2"],"dates":sorted(dates)})
    remaining=sum(1 for r in rows if r.get("region") in REGION_MAP and not r.get("date"))
    report={"filled":filled,"remaining":remaining,"source_pages":pages,
            "fetch_failures":failures,"ambiguous":ambiguous,
            "method":"exact team pair and exact score; unique dated match; no guessed dates"}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    if filled:
        with LEDGER.open("w",encoding="utf-8-sig",newline="") as fp:
            w=csv.DictWriter(fp,fieldnames=fields,lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
    print(json.dumps({"filled":filled,"remaining":remaining,"pages":len(pages),
                      "failed_pages":len(failures),"ambiguous":len(ambiguous)},ensure_ascii=False))
if __name__=="__main__":
    main()
