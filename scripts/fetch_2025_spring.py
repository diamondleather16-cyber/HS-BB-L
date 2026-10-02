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
    "3位決定戦": "3P",
    "準決勝": "SF",
    "準々決勝": "QF",
    "1回戦": "1R",
    "2回戦": "2R",
    "3回戦": "3R",
    "4回戦": "4R",
    "5回戦": "5R",
    "6回戦": "6R",
}

SKIP_HEADING_WORDS = ("地区予選", "支部予選", "予選リーグ", "敗者復活")

# カテゴリ一覧から記事を見つけにくい県は、検証済みURLを明示する。
ARTICLE_OVERRIDES = {
    "東京": ("春季東京大会 2025 日程・結果", "https://koshien89.com/blog-entry-3426.html"),
}

def get(session, url):
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r.text

def normalize_text(s):
    s = s.replace("\u3000", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def find_article(session, category_id, pref):
    if pref in ARTICLE_OVERRIDES:
        return ARTICLE_OVERRIDES[pref]

    # 0=current, then older category pages
    candidates = []
    for page in range(0, 5):
        suffix = "" if page == 0 else f"-{page}"
        url = f"{BASE}blog-category-{category_id}{suffix}.html"
        try:
            html = get(session, url)
        except Exception:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            title = normalize_text(a.get_text(" ", strip=True))
            href = urljoin(url, a["href"])
            if "blog-entry-" not in href:
                continue
            if "2025" not in title or "春季" not in title:
                continue
            # Prefer the prefecture name, but allow generic Tokyo/Hokkaido wording.
            score = 0
            if pref in title:
                score += 3
            if "大会" in title:
                score += 1
            if "日程" in title or "結果" in title:
                score += 1
            candidates.append((score, title, href.split("#")[0]))
        if candidates:
            break

    if not candidates:
        return None, None

    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    _, title, url = candidates[0]
    return title, url

def best_article_container(soup):
    # Find the smallest element that still contains most round markers.
    candidates = []
    for el in soup.find_all(["article", "main", "div", "section"]):
        text = el.get_text("\n", strip=True)
        marker_count = sum(text.count(k) for k in ("※決勝", "※準決勝", "※準々決勝", "※1回戦", "※2回戦", "※3回戦"))
        if marker_count >= 3:
            candidates.append((marker_count, len(text), el))
    if candidates:
        max_marker = max(x[0] for x in candidates)
        subset = [x for x in candidates if x[0] == max_marker]
        subset.sort(key=lambda x: x[1])
        return subset[0][2]
    return soup.body or soup

ROUND_RE = re.compile(
    r"※\s*(3位決定戦|準々決勝|準決勝|決勝|[1-6]回戦)\s*\((\d{1,2})/(\d{1,2})\)"
)
# Match summary only. Lines with box-score separator ｜ are rejected beforehand.
GAME_RE = re.compile(
    # 学校名と得点の間の空白がない例（「神島6 -7 日高」）にも対応。
    # team1 の末尾は数字以外とすることで、得点との境界を安定させる。
    r"^[■●○]?\s*(.+?[^\d\s])\s*(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)(?:\((\d+)\))?$"
)

def parse_games(html, pref, region, article_url, article_title):
    soup = BeautifulSoup(html, "html.parser")
    container = best_article_container(soup)
    raw_lines = container.get_text("\n", strip=True).splitlines()
    lines = [normalize_text(x) for x in raw_lines if normalize_text(x)]

    games = []
    current_round = None
    current_date = None
    skip_mode = False

    for line in lines:
        # stop/skip section when lower-level qualifiers begin
        if any(w in line for w in SKIP_HEADING_WORDS) and line.startswith("※"):
            skip_mode = True
            current_round = None
            current_date = None
            continue

        m = ROUND_RE.search(line)
        if m:
            skip_mode = False
            label, month, day = m.groups()
            current_round = ROUND_MAP[label]
            current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"
            # The same line can occasionally contain the match after the heading.
            tail = line[m.end():].strip()
            if tail:
                line = tail
            else:
                continue

        if skip_mode or not current_round or not current_date:
            continue

        if "｜" in line or "=" in line or line.startswith("("):
            continue
        if "本塁打" in line or "試合" in line and "-" not in line:
            continue

        gm = GAME_RE.match(line)
        if not gm:
            continue

        team1, s1, x1, s2, x2, team2, innings = gm.groups()
        team1 = normalize_text(team1).lstrip("■●○").strip()
        team2 = normalize_text(team2)
        if not team1 or not team2:
            continue
        # Avoid accidental captures from dates/links.
        if team1.startswith("http") or team2.startswith("http"):
            continue

        note_parts = []
        if x1:
            note_parts.append("team1_sayonara")
        if x2:
            note_parts.append("team2_sayonara")
        if innings:
            note_parts.append(f"{innings}innings")

        games.append({
            "year": str(YEAR),
            "season": "spring",
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
            "note": ";".join(note_parts),
        })

    # Exact dedupe while keeping order.
    seen = set()
    unique = []
    for g in games:
        key = (g["date"], g["round"], g["team1"], g["score1"], g["team2"], g["score2"])
        if key not in seen:
            seen.add(key)
            unique.append(g)
    return unique

def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)

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
                "prefecture": pref, "category_id": category_id, "article_url": "",
                "match_count": 0, "F": 0, "SF": 0, "QF": 0,
                "status": "MISSING_ARTICLE", "note": ""
            })
            failures.append(f"{pref}: article not found")
            continue

        try:
            html = get(session, article_url)
            games = parse_games(html, pref, region, article_url, title)
        except Exception as e:
            games = []
            failures.append(f"{pref}: fetch/parse error {e}")

        counts = {r: sum(1 for g in games if g["round"] == r) for r in ("F","SF","QF")}
        status = "OK" if counts["F"] >= 1 and counts["SF"] >= 2 and counts["QF"] >= 4 else "CHECK"

        if not games:
            failures.append(f"{pref}: 0 matches parsed")
        elif status != "OK":
            failures.append(f"{pref}: completeness F={counts['F']} SF={counts['SF']} QF={counts['QF']}")

        out = Path(folder) / f"{slug}_2025.csv"
        write_csv(out, games)

        report.append({
            "prefecture": pref, "category_id": category_id, "article_url": article_url,
            "match_count": len(games), "F": counts["F"], "SF": counts["SF"], "QF": counts["QF"],
            "status": status, "note": title or ""
        })
        source_rows.append({
            "region": region,
            "prefecture": pref,
            "year": YEAR,
            "season": "spring",
            "tournament_name": title or f"{pref}春季大会",
            "source_url": article_url,
            "status": status.lower(),
            "note": f"{len(games)} matches"
        })
        print(f"  {status}: {len(games)} matches {article_url}", flush=True)
        time.sleep(0.25)

    report_path = Path("master/collection_report_2025_spring.csv")
    with report_path.open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["prefecture","category_id","article_url","match_count","F","SF","QF","status","note"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    with Path("master/sources.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["region","prefecture","year","season","tournament_name","source_url","status","note"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(source_rows)

    ok_count = sum(1 for r in report if r["status"] == "OK")
    print(f"\nComplete: {ok_count}/47")
    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
