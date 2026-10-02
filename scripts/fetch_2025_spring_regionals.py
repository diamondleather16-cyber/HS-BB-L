from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin, quote_plus
import csv
import re
import time
import requests
from bs4 import BeautifulSoup

BASE = "https://koshien89.com/"
YEAR = 2025
SEASON = "spring"
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0; +https://github.com/)"
}

# 東京は春の「地区大会」では関東大会に含まれるため、独立地区大会としては扱わない。
REGIONS = [
    {
        "region": "hokkaido",
        "name": "北海道",
        "query": "春季北海道大会 2025",
        "expected_min": 15,
        "require_qf": True,
        "known_url": "https://koshien89.com/blog-entry-3506.html",
    },
    {
        "region": "tohoku",
        "name": "東北",
        "query": "春季東北大会 2025",
        "expected_min": 13,
        "require_qf": True,
        "known_url": "https://koshien89.com/blog-entry-3514.html",
    },
    {
        "region": "kanto",
        "name": "関東",
        "query": "春季関東大会 2025",
        "expected_min": 15,
        "require_qf": True,
        "known_url": "https://koshien89.com/blog-entry-3508.html",
    },
    {
        "region": "hokushinetsu",
        "name": "北信越",
        "query": "春季北信越大会 2025",
        "expected_min": 7,
        "require_qf": False,
        "known_url": None,
    },
    {
        "region": "tokai",
        "name": "東海",
        "query": "春季東海大会 2025",
        "expected_min": 7,
        "require_qf": False,
        "known_url": None,
    },
    {
        "region": "kinki",
        "name": "近畿",
        "query": "春季近畿大会 2025",
        "expected_min": 7,
        "require_qf": False,
        "known_url": "https://koshien89.com/blog-entry-3513.html",
    },
    {
        "region": "chugoku",
        "name": "中国",
        "query": "春季中国大会 2025",
        "expected_min": 7,
        "require_qf": False,
        "known_url": "https://koshien89.com/blog-entry-3510.html",
    },
    {
        "region": "shikoku",
        "name": "四国",
        "query": "春季四国大会 2025",
        "expected_min": 7,
        "require_qf": False,
        "known_url": None,
    },
    {
        "region": "kyushu",
        "name": "九州",
        "query": "春季九州大会 2025",
        "expected_min": 15,
        "require_qf": True,
        "known_url": "https://koshien89.com/blog-entry-3491.html",
    },
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

def page_title(html):
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    if h1:
        return norm(h1.get_text(" ", strip=True))
    if soup.title:
        return norm(soup.title.get_text(" ", strip=True))
    return ""

def find_article(session, cfg):
    if cfg.get("known_url"):
        try:
            html = get(session, cfg["known_url"])
            title = page_title(html)
            if "2025" in title and "春季" in title and cfg["name"] in title:
                return title, cfg["known_url"]
        except Exception:
            pass

    # 1) WordPress/search page
    search_url = f"{BASE}?s={quote_plus(cfg['query'])}"
    try:
        html = get(session, search_url)
        soup = BeautifulSoup(html, "html.parser")
        candidates = []
        for a in soup.find_all("a", href=True):
            title = norm(a.get_text(" ", strip=True))
            href = urljoin(search_url, a["href"]).split("#")[0]
            if "blog-entry-" not in href:
                continue
            if "2025" in title and "春季" in title and cfg["name"] in title and "大会" in title:
                candidates.append((len(title), title, href))
        if candidates:
            candidates.sort()
            _, title, href = candidates[0]
            return title, href
    except Exception:
        pass

    # 2) 2025春の地区大会記事が集中している範囲を直接探索
    for entry_id in range(3488, 3517):
        url = f"{BASE}blog-entry-{entry_id}.html"
        try:
            html = get(session, url)
        except Exception:
            continue
        title = page_title(html)
        if (
            "2025" in title
            and "春季" in title
            and cfg["name"] in title
            and "大会" in title
        ):
            return title, url
        time.sleep(0.05)

    return None, None

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

def parse_games(html, cfg, article_url, article_title):
    soup = BeautifulSoup(html, "html.parser")
    container = best_container(soup)
    lines = [
        norm(x)
        for x in container.get_text("\n", strip=True).splitlines()
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
        if team1.startswith("http") or team2.startswith("http"):
            continue

        note = ["level=regional"]
        if x1:
            note.append("team1_sayonara")
        if x2:
            note.append("team2_sayonara")
        if innings:
            note.append(f"{innings}innings")

        games.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": cfg["region"],
            "prefecture": "北海道" if cfg["name"] == "北海道" else "",
            "tournament": article_title,
            "round": current_round,
            "date": current_date,
            "team1": team1,
            "score1": s1,
            "team2": team2,
            "score2": s2,
            "source_url": article_url,
            "note": ";".join(note),
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

    for cfg in REGIONS:
        name = cfg["name"]
        print(f"[{name}] searching...", flush=True)
        title, url = find_article(session, cfg)

        if not url:
            report.append({
                "region": name,
                "article_url": "",
                "match_count": 0,
                "F": 0,
                "SF": 0,
                "QF": 0,
                "status": "MISSING_ARTICLE",
                "note": "",
            })
            failures.append(f"{name}: article not found")
            continue

        try:
            html = get(session, url)
            games = parse_games(html, cfg, url, title)
        except Exception as e:
            games = []
            failures.append(f"{name}: fetch/parse error {e}")

        counts = {
            r: sum(1 for g in games if g["round"] == r)
            for r in ("F","SF","QF")
        }

        complete = (
            len(games) >= cfg["expected_min"]
            and counts["F"] >= 1
            and counts["SF"] >= 2
            and (
                counts["QF"] >= 4
                if cfg["require_qf"]
                else True
            )
        )
        status = "OK" if complete else "CHECK"

        if not games:
            failures.append(f"{name}: 0 matches parsed")
        elif status != "OK":
            failures.append(
                f"{name}: matches={len(games)} "
                f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        write_csv(
            out_dir / f"{cfg['region']}.csv",
            games
        )

        report.append({
            "region": name,
            "article_url": url,
            "match_count": len(games),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "status": status,
            "note": title or "",
        })

        source_rows.append({
            "region": cfg["region"],
            "prefecture": "北海道" if name == "北海道" else "",
            "year": YEAR,
            "season": SEASON,
            "tournament_name": title or f"春季{name}大会 2025",
            "source_url": url,
            "status": status.lower(),
            "note": "regional;2025_spring",
        })

        print(f"  {status}: {len(games)} matches {url}", flush=True)

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
