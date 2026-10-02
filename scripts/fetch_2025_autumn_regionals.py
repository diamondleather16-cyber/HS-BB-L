from __future__ import annotations

from pathlib import Path
import csv
import re
import time
import requests
from bs4 import BeautifulSoup

BASE = "https://koshien89.com/"
YEAR = 2025
SEASON = "autumn"
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0; +https://github.com/)"
}

# 秋の選抜地区は10区分だが、北海道・東京は単独地区で、
# 既に県階層側の秋季大会データと同一大会になるため重複登録しない。
# 新規追加するのは8つの複数都県地区大会。
REGIONS = [
    ("tohoku", "東北"),
    ("kanto", "関東"),
    ("hokushinetsu", "北信越"),
    ("tokai", "東海"),
    ("kinki", "近畿"),
    ("chugoku", "中国"),
    ("shikoku", "四国"),
    ("kyushu", "九州"),
]

KNOWN_URLS = {
    "kanto": "https://koshien89.com/blog-entry-3665.html",
    "tokai": "https://koshien89.com/blog-entry-3663.html",
    "chugoku": "https://koshien89.com/blog-entry-3667.html",
    "shikoku": "https://koshien89.com/blog-entry-3664.html",
    "kyushu": "https://koshien89.com/blog-entry-3669.html",
}

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

def title_of(html):
    soup = BeautifulSoup(html, "html.parser")
    if soup.title:
        return norm(soup.title.get_text(" ", strip=True))
    return ""

def discover_url(session, jp_name):
    # 2025秋季地区大会はこの近辺のentryにまとまっている。
    # 既知URLがあれば最優先。
    slug = next((s for s, n in REGIONS if n == jp_name), None)
    if slug in KNOWN_URLS:
        return KNOWN_URLS[slug]

    needle = f"秋季{jp_name}大会 2025"

    for entry_id in range(3650, 3671):
        url = f"{BASE}blog-entry-{entry_id}.html"
        try:
            html = get(session, url)
        except Exception:
            continue

        title = title_of(html)
        if needle in title:
            return url

        soup = BeautifulSoup(html, "html.parser")
        text = norm(soup.get_text(" ", strip=True)[:1500])
        if needle in text:
            return url

        time.sleep(0.03)

    return None

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article","main","div","section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(
            text.count(k) for k in (
                "※決勝","※準決勝","※準々決勝",
                "※1回戦","※2回戦","※3回戦"
            )
        )
        if markers >= 3:
            candidates.append((markers, len(text), el))

    if candidates:
        max_markers = max(x[0] for x in candidates)
        subset = [x for x in candidates if x[0] == max_markers]
        subset.sort(key=lambda x: x[1])
        return subset[0][2]

    return soup.body or soup

def parse_games(html, slug, jp_name, url):
    soup = BeautifulSoup(html, "html.parser")
    container = best_container(soup)

    page_title = title_of(html)
    tournament = re.sub(r"\s*\|\s*高校野球速報.*$", "", page_title).strip()
    if not tournament:
        tournament = f"秋季{jp_name}大会 2025"

    lines = [
        norm(x)
        for x in container.get_text("\n", strip=True).splitlines()
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

        rows.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": slug,
            "prefecture": "",
            "tournament": tournament,
            "round": current_round,
            "date": current_date,
            "team1": team1,
            "score1": s1,
            "team2": team2,
            "score2": s2,
            "source_url": url,
            "note": ";".join(notes),
        })

    seen = set()
    unique = []
    for r in rows:
        key = (
            r["date"], r["round"], r["team1"], r["score1"],
            r["team2"], r["score2"]
        )
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique, tournament

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
    out_dir = Path("data/regionals/2025_autumn")

    # 北海道・東京は既存データを参照するだけにする。
    # 同一試合をregional CSVへ複製しない。
    report.append({
        "region": "北海道",
        "article_url": "",
        "match_count": "",
        "F": "",
        "SF": "",
        "QF": "",
        "status": "EXISTING_PREFECTURE_DATA",
        "note": "単独地区。2025秋北海道データと同一大会のため重複登録しない",
    })
    report.append({
        "region": "東京",
        "article_url": "",
        "match_count": "",
        "F": "",
        "SF": "",
        "QF": "",
        "status": "EXISTING_PREFECTURE_DATA",
        "note": "単独地区。2025秋東京データと同一大会のため重複登録しない",
    })

    for slug, jp_name in REGIONS:
        print(f"[{jp_name}] locating article...", flush=True)
        url = discover_url(session, jp_name)

        if not url:
            report.append({
                "region": jp_name,
                "article_url": "",
                "match_count": 0,
                "F": 0,
                "SF": 0,
                "QF": 0,
                "status": "MISSING_ARTICLE",
                "note": "",
            })
            failures.append(f"{jp_name}: article not found")
            continue

        try:
            html = get(session, url)
            rows, tournament = parse_games(html, slug, jp_name, url)
        except Exception as e:
            rows = []
            tournament = f"秋季{jp_name}大会 2025"
            failures.append(f"{jp_name}: fetch/parse error {e}")

        counts = {
            rnd: sum(1 for r in rows if r["round"] == rnd)
            for rnd in ("F","SF","QF")
        }

        status = "OK" if (
            len(rows) >= 7
            and counts["F"] >= 1
            and counts["SF"] >= 2
            and counts["QF"] >= 4
        ) else "CHECK"

        if status != "OK":
            failures.append(
                f"{jp_name}: matches={len(rows)} "
                f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
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
            "note": tournament,
        })

        source_rows.append({
            "region": slug,
            "prefecture": "",
            "year": YEAR,
            "season": SEASON,
            "tournament_name": tournament,
            "source_url": url,
            "status": status.lower(),
            "note": "regional;2025_autumn",
        })

        print(
            f"  {status}: {len(rows)} matches "
            f"F={counts['F']} SF={counts['SF']} QF={counts['QF']} "
            f"{url}",
            flush=True
        )
        time.sleep(0.15)

    report_path = Path("master/collection_report_2025_autumn_regionals.csv")
    fields = [
        "region","article_url","match_count",
        "F","SF","QF","status","note"
    ]
    with report_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    update_sources(source_rows)

    ok_new = sum(1 for r in report if r["status"] == "OK")
    existing = sum(
        1 for r in report if r["status"] == "EXISTING_PREFECTURE_DATA"
    )
    print(f"\nRegional coverage: {ok_new + existing}/10 "
          f"(new regional CSVs={ok_new}, existing single-region={existing})")

    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
