from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin
import csv
import re
import requests
from bs4 import BeautifulSoup

BASE = "https://koshien89.com/"
YEAR = 2025
SEASON = "autumn"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0)"}
TIMEOUT = 30

# 地区大会カテゴリ
REGIONS = [
    ("tohoku", "東北", 57),
    ("kanto", "関東", 58),
    ("hokushinetsu", "北信越", 59),
    ("tokai", "東海", 60),
    ("kinki", "近畿", 61),
    ("chugoku", "中国", 62),
    ("shikoku", "四国", 63),
    ("kyushu", "九州", 64),
]

FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

ROUND_MAP = {
    "決勝":"F","3位決定戦":"3P","準決勝":"SF","準々決勝":"QF",
    "1回戦":"1R","2回戦":"2R","3回戦":"3R",
}

ROUND_RE = re.compile(
    r"※\s*(3位決定戦|準々決勝|準決勝|決勝|[1-3]回戦)"
    r"\s*\((\d{1,2})/(\d{1,2})(?:,[^)]+)?\)"
)

GAME_RE = re.compile(
    r"^[■●○]?\s*(.+?[^\d\s])\s*(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)(?:\((\d+)\))?$"
)

def norm(s):
    s = s.replace("\u3000", " ")
    return re.sub(r"[ \t]+", " ", s).strip()

def get(session, url):
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r.text

def find_article(session, jp_name, category_id):
    url = f"{BASE}blog-category-{category_id}.html"
    html = get(session, url)
    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for a in soup.find_all("a", href=True):
        title = norm(a.get_text(" ", strip=True))
        href = urljoin(url, a["href"]).split("#")[0]
        if "blog-entry-" not in href:
            continue
        if "2025" not in title or "秋季" not in title:
            continue
        if jp_name not in title:
            continue
        score = int("日程" in title) + int("結果" in title)
        candidates.append((score, len(title), title, href))

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: (-x[0], x[1]))
    _, _, title, href = candidates[0]
    return title, href

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article","main","div","section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(
            text.count(x) for x in
            ("※決勝","※準決勝","※準々決勝","※1回戦","※2回戦")
        )
        if markers >= 3:
            candidates.append((markers, len(text), el))
    if not candidates:
        return soup.body or soup
    m = max(x[0] for x in candidates)
    xs = [x for x in candidates if x[0] == m]
    xs.sort(key=lambda x: x[1])
    return xs[0][2]

def parse_games(html, slug, title, url):
    soup = BeautifulSoup(html, "html.parser")
    container = best_container(soup)
    lines = [
        norm(x) for x in container.get_text("\n", strip=True).splitlines()
        if norm(x)
    ]

    rows = []
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
        if "｜" in line or "=" in line or line.startswith("(") or "本塁打" in line:
            continue

        gm = GAME_RE.match(line)
        if not gm:
            continue

        team1, s1, x1, s2, x2, team2, innings = gm.groups()
        notes = ["level=regional"]
        if x1: notes.append("team1_sayonara")
        if x2: notes.append("team2_sayonara")
        if innings: notes.append(f"{innings}innings")

        rows.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": slug,
            "prefecture": "",
            "tournament": title,
            "round": current_round,
            "date": current_date,
            "team1": norm(team1).lstrip("■●○").strip(),
            "score1": s1,
            "team2": norm(team2),
            "score2": s2,
            "source_url": url,
            "note": ";".join(notes),
        })

    seen = set()
    out = []
    for r in rows:
        key = (r["date"],r["round"],r["team1"],r["score1"],r["team2"],r["score2"])
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out

def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

def read_rows(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=",1)[1]
    return ""

def existing_single_region_report():
    result = []
    specs = [
        ("北海道", Path("data/01_hokkaido/hokkaido_2025.csv")),
        ("東京", Path("data/03_kanto_tokyo/tokyo_2025.csv")),
    ]
    for name, path in specs:
        rows = [
            r for r in read_rows(path)
            if r.get("year") == "2025"
            and r.get("season") == "autumn"
            and level(r.get("note")) == "regional"
        ]
        counts = {
            x: sum(1 for r in rows if r.get("round") == x)
            for x in ("F","SF","QF")
        }
        status = "OK" if (
            counts["F"] >= 1 and counts["SF"] >= 2 and counts["QF"] >= 4
        ) else "CHECK"
        result.append({
            "region": name,
            "article_url": rows[0]["source_url"] if rows else "",
            "match_count": len(rows),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "status": status,
            "note": "single-region tournament already stored in prefecture file as level=regional",
        })
    return result

def main():
    session = requests.Session()
    out_dir = Path("data/regionals/2025_autumn")
    report = existing_single_region_report()
    failures = []

    for row in report:
        if row["status"] != "OK":
            failures.append(f"{row['region']}: existing regional data incomplete")

    for slug, jp_name, category_id in REGIONS:
        print(f"[{jp_name}] category={category_id}", flush=True)
        try:
            title, url = find_article(session, jp_name, category_id)
        except Exception as e:
            title, url = None, None
            failures.append(f"{jp_name}: category fetch error {e}")

        if not url:
            report.append({
                "region": jp_name, "article_url": "", "match_count": 0,
                "F": 0, "SF": 0, "QF": 0, "status": "MISSING_ARTICLE",
                "note": "",
            })
            failures.append(f"{jp_name}: article not found")
            continue

        try:
            html = get(session, url)
            rows = parse_games(html, slug, title, url)
        except Exception as e:
            rows = []
            failures.append(f"{jp_name}: fetch/parse error {e}")

        counts = {x: sum(1 for r in rows if r["round"] == x) for x in ("F","SF","QF")}
        status = "OK" if (
            len(rows) >= 7 and counts["F"] >= 1 and counts["SF"] >= 2 and counts["QF"] >= 4
        ) else "CHECK"

        if status != "OK":
            failures.append(
                f"{jp_name}: matches={len(rows)} F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        write_csv(out_dir / f"{slug}.csv", rows)
        report.append({
            "region": jp_name,
            "article_url": url,
            "match_count": len(rows),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "status": status,
            "note": title or "",
        })
        print(f"  {status}: {len(rows)} matches {url}", flush=True)

    rp = Path("master/collection_report_2025_autumn_regionals.csv")
    fields = ["region","article_url","match_count","F","SF","QF","status","note"]
    with rp.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    ok = sum(1 for r in report if r["status"] == "OK")
    print(f"\nRegional coverage: {ok}/10")

    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
