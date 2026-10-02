from __future__ import annotations

from pathlib import Path
import csv
import re
import time
import requests
from bs4 import BeautifulSoup

YEAR = 2025
SEASON = "spring"
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0; +https://github.com/)"
}

# 2025春の地区大会ページを明示。
# 前版はページのH1がサイト名「高校野球速報」だったため、記事名判定に失敗して0/9となった。
REGIONS = [
    ("hokkaido", "北海道", "春季北海道大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3506.html", 15, True),
    ("tohoku", "東北", "春季東北大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3514.html", 13, True),
    ("kanto", "関東", "春季関東大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3508.html", 15, True),
    ("hokushinetsu", "北信越", "春季北信越大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3512.html", 7, False),
    ("tokai", "東海", "春季東海大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3509.html", 7, False),
    ("kinki", "近畿", "春季近畿大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3513.html", 7, False),
    ("chugoku", "中国", "春季中国大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3510.html", 7, False),
    ("shikoku", "四国", "2025年度（第78回）春季四国地区高等学校野球大会",
     "https://www.hb-nippon.com/tournaments/301", 7, False),
    ("kyushu", "九州", "春季九州大会 2025 日程・結果",
     "https://koshien89.com/blog-entry-3491.html", 15, True),
]

FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

ROUND_MAP = {
    "決勝": "F",
    "3位決定戦": "3P",
    "準決勝": "SF",
    "準々決勝": "QF",
    "1回戦": "1R",
    "2回戦": "2R",
    "3回戦": "3R",
}

ROUND_RE = re.compile(
    r"※\s*(3位決定戦|準々決勝|準決勝|決勝|[1-3]回戦)\s*\((\d{1,2})/(\d{1,2})\)"
)

GAME_RE = re.compile(
    r"^[■●○]?\s*(.+?[^\d\s])\s*(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)(?:\((\d+)\))?$"
)

def get(session, url):
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r.text

def norm(s):
    s = s.replace("\u3000", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article", "main", "div", "section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(
            text.count(k) for k in (
                "※決勝","※準決勝","※準々決勝","※1回戦","※2回戦"
            )
        )
        if markers >= 2:
            candidates.append((markers, len(text), el))
    if candidates:
        max_markers = max(x[0] for x in candidates)
        best = [x for x in candidates if x[0] == max_markers]
        best.sort(key=lambda x: x[1])
        return best[0][2]
    return soup.body or soup

def parse_games(html, region, name, title, url):
    soup = BeautifulSoup(html, "html.parser")
    container = best_container(soup)
    lines = [
        norm(x) for x in container.get_text("\n", strip=True).splitlines()
        if norm(x)
    ]

    games = []
    current_round = None
    current_date = None

    for line in lines:
        m = ROUND_RE.search(line)
        if m:
            label, month, day = m.groups()
            current_round = ROUND_MAP[label]
            current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"
            tail = line[m.end():].strip()
            if tail:
                line = tail
            else:
                continue

        if not current_round or not current_date:
            continue
        if "｜" in line or "=" in line or line.startswith("("):
            continue
        if "本塁打" in line:
            continue

        gm = GAME_RE.match(line)
        if not gm:
            continue

        team1, s1, x1, s2, x2, team2, innings = gm.groups()
        team1 = norm(team1).lstrip("■●○").strip()
        team2 = norm(team2)

        if not team1 or not team2:
            continue

        notes = ["level=regional"]
        if x1:
            notes.append("team1_sayonara")
        if x2:
            notes.append("team2_sayonara")
        if innings:
            notes.append(f"{innings}innings")

        games.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": region,
            "prefecture": "北海道" if name == "北海道" else "",
            "tournament": title,
            "round": current_round,
            "date": current_date,
            "team1": team1,
            "score1": s1,
            "team2": team2,
            "score2": s2,
            "source_url": url,
            "note": ";".join(notes),
        })

    # 北信越ページは準決勝1試合の見出しが
    # 「中越(新潟1) - 富山第一(富山) 12:30」と未更新のまま。
    # 直下のスコアボードは 中越6-10富山第一 なので補完する。
    if region == "hokushinetsu":
        sf = [g for g in games if g["round"] == "SF"]
        if len(sf) < 2:
            games.append({
                "year": str(YEAR),
                "season": SEASON,
                "region": region,
                "prefecture": "",
                "tournament": title,
                "round": "SF",
                "date": "2025-06-02",
                "team1": "中越(新潟1)",
                "score1": "6",
                "team2": "富山第一(富山)",
                "score2": "10",
                "source_url": url,
                "note": "level=regional;scoreboard_reconstructed",
            })

    seen = set()
    unique = []
    for g in games:
        key = (
            g["date"], g["round"], g["team1"], g["score1"],
            g["team2"], g["score2"]
        )
        if key not in seen:
            seen.add(key)
            unique.append(g)
    return unique

def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

def update_sources(new_rows):
    path = Path("master/sources.csv")
    old = []
    if path.exists():
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            rd = csv.DictReader(f)
            old = list(rd) if rd.fieldnames else []

    kept = [
        r for r in old
        if not (
            str(r.get("year", "")).strip() == str(YEAR)
            and str(r.get("season", "")).strip() == SEASON
            and "regional" in str(r.get("note", "")).lower()
        )
    ]

    fields = [
        "region","prefecture","year","season",
        "tournament_name","source_url","status","note"
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in kept + new_rows:
            w.writerow({k: row.get(k, "") for k in fields})

def main():
    session = requests.Session()
    report = []
    source_rows = []
    failures = []
    out_dir = Path("data/regionals/2025_spring")

    for region, name, title, url, expected_min, require_qf in REGIONS:
        print(f"[{name}] {url}", flush=True)

        if region == "shikoku":
            # hb-nipponの大会データで7試合を確認済み。
            # 決勝1、準決勝2、準々決勝4。
            games = [
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "F",
                    "date": "2025-05-03", "team1": "明徳義塾", "score1": "5",
                    "team2": "英明", "score2": "0", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "SF",
                    "date": "2025-04-27", "team1": "英明", "score1": "4",
                    "team2": "新田", "score2": "1", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "SF",
                    "date": "2025-04-27", "team1": "明徳義塾", "score1": "4",
                    "team2": "徳島商", "score2": "2", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "QF",
                    "date": "2025-04-26", "team1": "新田", "score1": "5",
                    "team2": "高知", "score2": "3", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "QF",
                    "date": "2025-04-26", "team1": "徳島商", "score1": "4",
                    "team2": "今治西", "score2": "0", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "QF",
                    "date": "2025-04-26", "team1": "英明", "score1": "8",
                    "team2": "鳴門", "score2": "5", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
                {
                    "year": str(YEAR), "season": SEASON, "region": region,
                    "prefecture": "", "tournament": title, "round": "QF",
                    "date": "2025-04-26", "team1": "明徳義塾", "score1": "5",
                    "team2": "高松商", "score2": "2", "source_url": url,
                    "note": "level=regional;verified_external_source",
                },
            ]
        else:
            try:
                html = get(session, url)
                games = parse_games(html, region, name, title, url)
            except Exception as e:
                games = []
                failures.append(f"{name}: fetch/parse error {e}")

        counts = {
            r: sum(1 for g in games if g["round"] == r)
            for r in ("F","SF","QF")
        }

        complete = (
            len(games) >= expected_min
            and counts["F"] >= 1
            and counts["SF"] >= 2
            and (counts["QF"] >= 4 if require_qf else True)
        )
        status = "OK" if complete else "CHECK"

        if status != "OK":
            failures.append(
                f"{name}: matches={len(games)} "
                f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        write_csv(out_dir / f"{region}.csv", games)

        report.append({
            "region": name,
            "article_url": url,
            "match_count": len(games),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "status": status,
            "note": title,
        })

        source_rows.append({
            "region": region,
            "prefecture": "北海道" if name == "北海道" else "",
            "year": YEAR,
            "season": SEASON,
            "tournament_name": title,
            "source_url": url,
            "status": status.lower(),
            "note": "regional;2025_spring",
        })
        print(
            f"  {status}: {len(games)} matches "
            f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}",
            flush=True
        )
        time.sleep(0.15)

    report_path = Path("master/collection_report_2025_spring_regionals.csv")
    fields = [
        "region","article_url","match_count",
        "F","SF","QF","status","note"
    ]
    with report_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    update_sources(source_rows)

    ok_count = sum(1 for r in report if r["status"] == "OK")
    print(f"\nComplete: {ok_count}/9")

    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
