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

# Verified scorecards, 2019 spring Hokushinetsu (2019/6/1-6/4).
# https://yugakubaseball.com/archives/11709
# https://www.toyama-hbf.jp/wp-content/uploads/2019/06/433a0a1fb92e9989ae11726c9f4da1a5.pdf
VERIFIED_2019_SPRING = [
 ("2019-06-01","砺波工","0","星稜","6"),
 ("2019-06-01","富山第一","5","三条","1"),
 ("2019-06-01","都市大塩尻","10","富山国際大付","11"),
 ("2019-06-01","日本航空石川","0","敦賀気比","1"),
 ("2019-06-02","東海大諏訪","2","星稜","4"),
 ("2019-06-02","富山第一","5","福井工大福井","2"),
 ("2019-06-02","日本文理","8","富山国際大付","3"),
 ("2019-06-02","敦賀気比","5","高岡第一","3"),
 ("2019-06-03","星稜","5","富山第一","2"),
 ("2019-06-03","日本文理","3","敦賀気比","8"),
 ("2019-06-04","星稜","3","敦賀気比","1"),
]

def normalize(s):
    s = unicodedata.normalize("NFKC", s or "").replace("髙","高").replace("﨑","崎")
    # Nikkan includes seeding labels e.g. 花咲徳栄（埼玉2位）; not part of school name.
    s = re.sub(r"[（(][^()（）]*(?:都|道|府|県|位|推薦|招待|地区)[^()（）]*[）)]$", "", s)
    s = re.sub(r"[\s・･\.．（）()\-]", "", s)
    s=ALIASES.get(s,s)
    return {"砺波工業":"砺波工","工大福井":"福井工大福井","富山国際大":"富山国際大付","富山国際大附":"富山国際大付","東京都市大塩尻":"都市大塩尻","高崎健康福祉大高崎":"健大高崎","高崎健大高崎":"健大高崎","高崎健康福祉大学高崎":"健大高崎","東海大付相模":"東海大相模","日大第三":"日大三"}.get(s,s)

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

KOSHIEN89_HOKUSHINETSU = {
    (2023,"autumn"):"https://koshien89.com/blog-entry-3165.html",
    (2024,"spring"):"https://koshien89.com/blog-entry-3261.html",
    (2024,"autumn"):"https://koshien89.com/blog-entry-3416.html",
}
def extract_koshien89_games(html, year):
    """Read only match headings in the article body, not comments or box scores."""
    soup=BeautifulSoup(html,"html.parser")
    article=soup.select_one(".entry_body, .entry-body, .article-body, .entry-content, .main_body")
    if article is None:
        article=soup
    text=article.get_text("\n",strip=True)
    text=text.split("試合の見逃し配信")[0].split("コメントの投稿")[0]
    current_date=None
    found=[]
    heading=re.compile(r"※[^\n]*?\((\d{1,2})/(\d{1,2})\)")
    match=re.compile(r"^■\s*(.+?)\s+(\d{1,2})[xX]?\s*[-－−]\s*(\d{1,2})[xX]?\s+(.+?)\s*$")
    for line in text.splitlines():
        line=line.strip()
        h=heading.search(line)
        if h:
            try:current_date=date(year,int(h.group(1)),int(h.group(2))).isoformat()
            except ValueError:current_date=None
            continue
        m=match.match(line)
        if m and current_date:
            clean=lambda s:re.sub(r"\([^()]*\)","",s).strip()
            found.append((normalize(clean(m.group(1))),int(m.group(2)),
                          normalize(clean(m.group(4))),int(m.group(3)),current_date))
    return found

def main():
    with LEDGER.open("r",encoding="utf-8-sig",newline="") as fp:
        original = fp.read()
    rows = list(csv.DictReader(io.StringIO(original)))
    fields = list(rows[0].keys())
    targets = defaultdict(list)
    for row in rows:
        if row.get("region") in REGION_MAP and not row.get("date") and row.get("season") in ("spring","autumn"):
            targets[(int(row["year"]),row["season"],row["region"])].append(row)
    pages, failures, ambiguous, unmatched = [], [], [], []
    filled = 0
    for (year,season,region), group in sorted(targets.items()):
        found = defaultdict(set)
        source = {}
        for area in REGION_MAP[region]:
            season_dir = "syunki" if season == "spring" else "syuuki"
            url = BASE.format(season=season_dir,year=year,area=area)
            html = download(url)
            games = extract_games(html,year) if html else []
            # User-supplied mobile archives are a second source for 2018 spring.
            # Keep original scores/innings unchanged; date only on exact fixture match.
            if year == 2018 and season in ("spring", "autumn") and not games:
                mobile_season = "syunki" if season == "spring" else "syuuki"
                mobile_url = f"https://www.nikkansports.com/m/baseball/highschool/{mobile_season}/2018/result/{area}_m.html"
                mobile_html = download(mobile_url)
                if mobile_html:
                    mobile_games = extract_games(mobile_html,year)
                    if mobile_games:
                        url, games = mobile_url, mobile_games
            if year == 2019 and season in ("spring", "autumn") and not games:
                schedule_season = "syunki" if season == "spring" else "syuuki"
                schedule_area = "hokushinetsu" if season == "autumn" and area == "hokushin" else area
                schedule_url=f"https://www.nikkansports.com/m/baseball/highschool/{schedule_season}/2019/{schedule_area}/schedule/"
                schedule_html=download(schedule_url)
                if schedule_html:
                    schedule_games=extract_games(schedule_html,year)
                    pages.append({"url":schedule_url,"games":len(schedule_games),"provider":"nikkan_2019_mobile_schedule"})
                    if schedule_games:
                        url,games=schedule_url,schedule_games
                else:
                    failures.append(schedule_url)
            if not games:
                failures.append(url)
                continue
            pages.append({"url":url,"games":len(games)})
            for a,s1,b,s2,dt in games:
                k = key(a,s1,b,s2)
                found[k].add(dt)
                source[(k,dt)] = url
            time.sleep(0.2)
        if region=="hokushinetsu":
            url=KOSHIEN89_HOKUSHINETSU.get((year,season))
            if url:
                html=download(url)
                if html:
                    games=extract_koshien89_games(html,year)
                    pages.append({"url":url,"games":len(games),"provider":"koshien89"})
                    for a,s1,b,s2,dt in games:
                        k=key(a,s1,b,s2)
                        found[k].add(dt)
                        source[(k,dt)]=url
                else:
                    failures.append(url)
        if (year,season,region)==(2019,"spring","hokushinetsu"):
            url="https://yugakubaseball.com/archives/11709"
            for dt,a,s1,b,s2 in VERIFIED_2019_SPRING:
                k=key(a,s1,b,s2)
                found[k].add(dt)
                source[(k,dt)]=url
            pages.append({"url":url,"games":len(VERIFIED_2019_SPRING),"provider":"verified dated scorecard"})
        for row in group:
            try:
                k=key(row["team1"],row["score1"],row["team2"],row["score2"])
            except (ValueError,TypeError):
                continue
            dates=found.get(k,set())
            if len(dates)==1:
                dt=next(iter(dates))
                row["date"]=dt
                # Date-only backfill: retain the original score, innings and provenance.
                # The external score is only an exact-match corroboration, not an overwrite.
                row["source_status"]="試合日・対戦・スコア照合済み"
                if "verified_match_date=1" not in (row.get("note") or ""):
                    row["note"]=(row.get("note") or "")+";verified_match_date=1"
                filled+=1
            elif not dates and year in (2018,2019):
                if len(unmatched)<120:
                    unmatched.append({"year":year,"season":season,"region":region,"team1":row["team1"],"score1":row["score1"],"team2":row["team2"],"score2":row["score2"],"available_source_games":len(found)})
            elif len(dates)>1:
                ambiguous.append({"year":year,"season":season,"region":region,
                                  "team1":row["team1"],"team2":row["team2"],"dates":sorted(dates)})
    missing_by_group=Counter((r.get("year",""),r.get("season",""),r.get("region","")) for r in rows if r.get("region") in REGION_MAP and not r.get("date"))
    remaining=sum(missing_by_group.values())
    report={"filled":filled,"remaining":remaining,"source_pages":pages,
            "fetch_failures":failures,"ambiguous":ambiguous,"unmatched_examples":unmatched,
            "missing_by_group":[{"year":y,"season":s,"region":rg,"missing":n} for (y,s,rg),n in sorted(missing_by_group.items(),key=lambda x:(-x[1],x[0]))],
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
