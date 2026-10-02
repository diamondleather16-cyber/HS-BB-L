from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin
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

PREFS = [
    (6,"北海道","hokkaido","hokkaido","data/01_hokkaido"),
    (7,"青森","aomori","tohoku","data/02_tohoku"),
    (8,"岩手","iwate","tohoku","data/02_tohoku"),
    (9,"宮城","miyagi","tohoku","data/02_tohoku"),
    (10,"秋田","akita","tohoku","data/02_tohoku"),
    (11,"山形","yamagata","tohoku","data/02_tohoku"),
    (12,"福島","fukushima","tohoku","data/02_tohoku"),
    (13,"茨城","ibaraki","kanto_tokyo","data/03_kanto_tokyo"),
    (14,"栃木","tochigi","kanto_tokyo","data/03_kanto_tokyo"),
    (15,"群馬","gunma","kanto_tokyo","data/03_kanto_tokyo"),
    (16,"埼玉","saitama","kanto_tokyo","data/03_kanto_tokyo"),
    (17,"千葉","chiba","kanto_tokyo","data/03_kanto_tokyo"),
    (18,"神奈川","kanagawa","kanto_tokyo","data/03_kanto_tokyo"),
    (19,"山梨","yamanashi","kanto_tokyo","data/03_kanto_tokyo"),
    (20,"東京","tokyo","kanto_tokyo","data/03_kanto_tokyo"),
    (21,"新潟","niigata","hokushinetsu","data/05_hokushinetsu"),
    (22,"長野","nagano","hokushinetsu","data/05_hokushinetsu"),
    (23,"富山","toyama","hokushinetsu","data/05_hokushinetsu"),
    (24,"石川","ishikawa","hokushinetsu","data/05_hokushinetsu"),
    (25,"福井","fukui","hokushinetsu","data/05_hokushinetsu"),
    (26,"静岡","shizuoka","tokai","data/04_tokai"),
    (27,"愛知","aichi","tokai","data/04_tokai"),
    (28,"岐阜","gifu","tokai","data/04_tokai"),
    (29,"三重","mie","tokai","data/04_tokai"),
    (30,"滋賀","shiga","kinki","data/06_kinki"),
    (31,"京都","kyoto","kinki","data/06_kinki"),
    (32,"大阪","osaka","kinki","data/06_kinki"),
    (33,"兵庫","hyogo","kinki","data/06_kinki"),
    (34,"奈良","nara","kinki","data/06_kinki"),
    (35,"和歌山","wakayama","kinki","data/06_kinki"),
    (36,"鳥取","tottori","chugoku","data/07_chugoku"),
    (37,"島根","shimane","chugoku","data/07_chugoku"),
    (38,"岡山","okayama","chugoku","data/07_chugoku"),
    (39,"広島","hiroshima","chugoku","data/07_chugoku"),
    (40,"山口","yamaguchi","chugoku","data/07_chugoku"),
    (41,"徳島","tokushima","shikoku","data/08_shikoku"),
    (42,"香川","kagawa","shikoku","data/08_shikoku"),
    (43,"愛媛","ehime","shikoku","data/08_shikoku"),
    (44,"高知","kochi","shikoku","data/08_shikoku"),
    (45,"福岡","fukuoka","kyushu","data/09_kyushu"),
    (46,"佐賀","saga","kyushu","data/09_kyushu"),
    (47,"長崎","nagasaki","kyushu","data/09_kyushu"),
    (48,"熊本","kumamoto","kyushu","data/09_kyushu"),
    (49,"大分","oita","kyushu","data/09_kyushu"),
    (50,"宮崎","miyazaki","kyushu","data/09_kyushu"),
    (51,"鹿児島","kagoshima","kyushu","data/09_kyushu"),
    (52,"沖縄","okinawa","kyushu","data/09_kyushu"),
]

CSV_FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

ROUND_MAP = {
    "決勝": "F",
    "代表決定戦": "REP",
    "3位決定戦": "3P",
    "準決勝": "SF",
    "準々決勝": "QF",
    "1回戦": "1R",
    "2回戦": "2R",
    "3回戦": "3R",
    "4回戦": "4R",
    "5回戦": "5R",
    "6回戦": "6R",
    "7回戦": "7R",
}

LEVEL_PATTERNS = [
    ("district_qualifier", ("地区予選", "地区大会予選")),
    ("branch", ("支部予選", "支部大会")),
    ("first_qualifier", ("一次予選", "1次予選")),
    ("qualifier_league", ("予選リーグ",)),
    ("repechage", ("敗者復活",)),
]

# 前回春版で東京だけ記事探索が不安定だったため固定。
ARTICLE_OVERRIDES = {
    "東京": ("春季東京大会 2025 日程・結果", "https://koshien89.com/blog-entry-3426.html"),
}

ROUND_RE = re.compile(
    r"※\s*(代表決定戦|3位決定戦|準々決勝|準決勝|決勝|[1-7]回戦)\s*\((\d{1,2})/(\d{1,2})\)"
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

def find_article(session, category_id, pref):
    if pref in ARTICLE_OVERRIDES:
        return ARTICLE_OVERRIDES[pref]

    candidates = []
    for page in range(0, 8):
        suffix = "" if page == 0 else f"-{page}"
        url = f"{BASE}blog-category-{category_id}{suffix}.html"

        try:
            html = get(session, url)
        except Exception:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            title = norm(a.get_text(" ", strip=True))
            href = urljoin(url, a["href"]).split("#")[0]

            if "blog-entry-" not in href:
                continue
            if "2025" not in title or "春季" not in title:
                continue

            score = 0
            if pref in title:
                score += 4
            if "大会" in title:
                score += 1
            if "日程" in title or "結果" in title:
                score += 1

            candidates.append((score, len(title), title, href))

        if candidates:
            break

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: (-x[0], x[1]))
    _, _, title, href = candidates[0]
    return title, href

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article", "main", "div", "section"]):
        text = el.get_text("\n", strip=True)
        marker_count = sum(
            text.count(k) for k in (
                "※決勝","※準決勝","※準々決勝",
                "※1回戦","※2回戦","※3回戦"
            )
        )
        if marker_count >= 3:
            candidates.append((marker_count, len(text), el))

    if candidates:
        max_marker = max(x[0] for x in candidates)
        subset = [x for x in candidates if x[0] == max_marker]
        subset.sort(key=lambda x: x[1])
        return subset[0][2]

    return soup.body or soup

def detect_level_heading(line, current_level):
    if not line.startswith("※"):
        return current_level

    for level, words in LEVEL_PATTERNS:
        if any(w in line for w in words):
            return level

    if ROUND_RE.search(line):
        return "prefecture"

    if (
        "県大会" in line
        or "本大会" in line
        or "全道大会" in line
        or "東京都大会" in line
    ):
        return "prefecture"

    return current_level

def parse_games(html, pref, region, article_url, article_title):
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
    current_level = "prefecture"

    for line in lines:
        current_level = detect_level_heading(line, current_level)

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

        notes = [f"level={current_level}"]
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
            "prefecture": pref,
            "tournament": article_title or f"{pref}春季大会",
            "round": current_round,
            "date": current_date,
            "team1": team1,
            "score1": s1,
            "team2": team2,
            "score2": s2,
            "source_url": article_url,
            "note": ";".join(notes),
        })

    # exact dedupe by level as well
    seen = set()
    unique = []
    for g in games:
        level = g["note"].split(";")[0]
        key = (
            g["date"], g["round"], g["team1"], g["score1"],
            g["team2"], g["score2"], level
        )
        if key not in seen:
            seen.add(key)
            unique.append(g)

    return unique

def read_existing(path):
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader) if reader.fieldnames else []

def write_preserving_other_seasons(path, spring_rows):
    existing = read_existing(path)

    kept = [
        row
        for row in existing
        if not (
            str(row.get("year", "")).strip() == str(YEAR)
            and str(row.get("season", "")).strip() == SEASON
        )
    ]

    rows = kept + spring_rows

    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()

        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})

def update_sources(new_rows):
    path = Path("master/sources.csv")
    old = []

    if path.exists():
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            old = list(reader) if reader.fieldnames else []

    kept = [
        row
        for row in old
        if not (
            str(row.get("year", "")).strip() == str(YEAR)
            and str(row.get("season", "")).strip() == SEASON
            and "prefecture_all_levels" in str(row.get("note", "")).lower()
        )
    ]

    fields = [
        "region","prefecture","year","season",
        "tournament_name","source_url","status","note"
    ]

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()

        for row in kept + new_rows:
            writer.writerow({field: row.get(field, "") for field in fields})

def main():
    session = requests.Session()

    report = []
    source_rows = []
    failures = []

    for category_id, pref, slug, region, folder in PREFS:
        print(f"[{pref}] searching...", flush=True)

        title, article_url = find_article(session, category_id, pref)

        if not article_url:
            report.append({
                "prefecture": pref,
                "category_id": category_id,
                "article_url": "",
                "match_count": 0,
                "prefecture_count": 0,
                "qualifier_count": 0,
                "F": 0,
                "SF": 0,
                "QF": 0,
                "status": "MISSING_ARTICLE",
                "note": "",
            })
            failures.append(f"{pref}: article not found")
            continue

        try:
            html = get(session, article_url)
            games = parse_games(
                html, pref, region, article_url, title
            )
        except Exception as exc:
            games = []
            failures.append(f"{pref}: fetch/parse error {exc}")

        main_rows = [
            g for g in games
            if "level=prefecture" in g["note"]
        ]

        counts = {
            rnd: sum(1 for g in main_rows if g["round"] == rnd)
            for rnd in ("F","SF","QF")
        }

        prefecture_count = len(main_rows)
        qualifier_count = len(games) - prefecture_count

        status = (
            "OK"
            if (
                counts["F"] >= 1
                and counts["SF"] >= 2
                and counts["QF"] >= 4
            )
            else "CHECK"
        )

        if not games:
            failures.append(f"{pref}: 0 matches parsed")
        elif status != "OK":
            failures.append(
                f"{pref}: prefecture completeness "
                f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        output_path = Path(folder) / f"{slug}_2025.csv"
        write_preserving_other_seasons(output_path, games)

        report.append({
            "prefecture": pref,
            "category_id": category_id,
            "article_url": article_url,
            "match_count": len(games),
            "prefecture_count": prefecture_count,
            "qualifier_count": qualifier_count,
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "status": status,
            "note": title or "",
        })

        source_rows.append({
            "region": region,
            "prefecture": pref,
            "year": YEAR,
            "season": SEASON,
            "tournament_name": title or f"{pref}春季大会",
            "source_url": article_url,
            "status": status.lower(),
            "note": (
                f"prefecture_all_levels;"
                f"prefecture={prefecture_count};"
                f"qualifier={qualifier_count}"
            ),
        })

        print(
            f"  {status}: total={len(games)} "
            f"prefecture={prefecture_count} "
            f"qualifier={qualifier_count} "
            f"{article_url}",
            flush=True,
        )

        time.sleep(0.2)

    report_path = Path(
        "master/collection_report_2025_spring_all_levels.csv"
    )

    fields = [
        "prefecture","category_id","article_url",
        "match_count","prefecture_count","qualifier_count",
        "F","SF","QF","status","note"
    ]

    with report_path.open(
        "w", encoding="utf-8-sig", newline=""
    ) as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(report)

    update_sources(source_rows)

    ok_count = sum(1 for r in report if r["status"] == "OK")
    print(f"\nComplete: {ok_count}/47")

    if failures:
        print("\nNeeds check:")
        for item in failures:
            print(" -", item)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
