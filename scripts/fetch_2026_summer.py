from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin
import csv
import re
import time
import requests
from bs4 import BeautifulSoup

BASE = "https://koshien89.com/"
YEAR = 2026
SEASON = "summer"
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
    "7回戦": "7R",
}

SKIP_HEADING_WORDS = (
    "地区予選", "支部予選", "予選リーグ", "敗者復活",
)

# 夏は北海道・東京が2大会制なので、検証済みURLを明示。
ARTICLE_OVERRIDES = {
    "北海道": [
        ("選手権北北海道大会 2026 日程・結果", "https://koshien89.com/blog-entry-3762.html"),
        ("選手権南北海道大会 2026 日程・結果", "https://koshien89.com/blog-entry-3761.html"),
    ],
    "東京": [
        ("選手権東東京大会 2026 日程・結果", "https://koshien89.com/blog-entry-3769.html"),
        ("選手権西東京大会 2026 日程・結果", "https://koshien89.com/blog-entry-3770.html"),
    ],
}

ROUND_RE = re.compile(
    r"(?:※\s*)?(3位決定戦|準々決勝|準決勝|決勝|[1-7]回戦)\s*\((\d{1,2})/(\d{1,2})\)"
)


# koshien89側の表記揺れ/更新崩れで2026夏の終盤戦が欠落した3県のみ、
# 別ソースでも照合した確定結果で F/SF/QF を置換する。
LATE_ROUND_FIXES = {
    "兵庫": {
        "source_url": "https://koshien89.com/blog-entry-3773.html",
        "games": [
            ("F","2026-07-26","社",3,"明石商",2),
            ("SF","2026-07-24","明石商",6,"神戸国際大附",5),
            ("SF","2026-07-24","社",10,"須磨学園",0),
            ("QF","2026-07-22","須磨学園",3,"西脇工",2),
            ("QF","2026-07-22","東播磨",0,"社",2),
            ("QF","2026-07-22","神戸国際大附",7,"三田松聖",0),
            ("QF","2026-07-22","明石商",9,"加古川西",3),
        ],
    },
    "岡山": {
        "source_url": "https://www.hb-nippon.com/tournaments/1608",
        "games": [
            ("F","2026-07-27","岡山学芸館",5,"倉敷商",4),
            ("SF","2026-07-25","倉敷商",9,"関西",5),
            ("SF","2026-07-25","岡山学芸館",3,"おかやま山陽",2),
            ("QF","2026-07-23","倉敷商",11,"岡山東商",1),
            ("QF","2026-07-23","関西",8,"倉敷工",1),
            ("QF","2026-07-22","岡山学芸館",3,"岡山理大付",2),
            ("QF","2026-07-22","おかやま山陽",4,"笠岡商",1),
        ],
    },
    "宮崎": {
        "source_url": "https://www.hb-nippon.com/tournaments/1577",
        "games": [
            ("F","2026-07-20","日南学園",11,"小林西",0),
            ("SF","2026-07-18","日南学園",2,"佐土原",0),
            ("SF","2026-07-18","小林西",9,"都城",1),
            ("QF","2026-07-16","小林西",6,"妻",0),
            ("QF","2026-07-16","佐土原",6,"宮崎第一",3),
            ("QF","2026-07-16","都城",8,"宮崎日大",4),
            ("QF","2026-07-16","日南学園",3,"高鍋",1),
        ],
    },
}

def apply_late_round_fix(pref, region, article_title, games):
    fix = LATE_ROUND_FIXES.get(pref)
    if not fix:
        return games

    kept = [g for g in games if g["round"] not in ("F","SF","QF")]
    for rnd, date, t1, s1, t2, s2 in fix["games"]:
        kept.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": region,
            "prefecture": pref,
            "tournament": article_title,
            "round": rnd,
            "date": date,
            "team1": t1,
            "score1": str(s1),
            "team2": t2,
            "score2": str(s2),
            "source_url": fix["source_url"],
            "note": "level=prefecture;late_round_verified_fix=1",
        })
    return kept

GAME_RE = re.compile(
    # 1文字校名（例: 社）や学校名と得点の間の空白揺れにも対応。
    r"^[■●○]?\s*(.+?)\s*(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)(?:\((\d+)\))?$"
)

def get(session, url):
    # 短時間の大量アクセスで後半県が弾かれるのを避ける。
    waits = (0.35, 2, 5, 12)
    last = None
    for attempt, wait_s in enumerate(waits, start=1):
        time.sleep(wait_s)
        try:
            r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            last = r
            if r.status_code in (403, 429) or 500 <= r.status_code < 600:
                print(f"  retry {attempt}/{len(waits)} status={r.status_code} {url}", flush=True)
                continue
            r.raise_for_status()
            r.encoding = r.apparent_encoding or r.encoding
            return r.text
        except requests.RequestException as e:
            print(f"  retry {attempt}/{len(waits)} {type(e).__name__}: {url}", flush=True)
            if attempt == len(waits):
                raise
    if last is not None:
        last.raise_for_status()
    raise RuntimeError(f"failed to fetch {url}")

def normalize_text(s):
    s = s.replace("\u3000", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def find_articles(session, category_id, pref):
    if pref in ARTICLE_OVERRIDES:
        return ARTICLE_OVERRIDES[pref]

    # 2026夏の記事は各県カテゴリの先頭側にある。
    # 旧版の0～6ページ全走査をやめ、見つけ次第即返す。
    for page in range(0, 3):
        suffix = "" if page == 0 else f"-{page}"
        url = f"{BASE}blog-category-{category_id}{suffix}.html"

        try:
            html = get(session, url)
        except Exception as e:
            print(f"  category fetch failed page={page}: {e}", flush=True)
            continue

        soup = BeautifulSoup(html, "html.parser")
        candidates = {}

        for a in soup.find_all("a", href=True):
            title = normalize_text(a.get_text(" ", strip=True))
            href = urljoin(url, a["href"]).split("#")[0]

            if "blog-entry-" not in href:
                continue
            if "2026" not in title:
                continue
            if "選手権" not in title:
                continue
            if "全国高校野球選手権 夏の甲子園" in title:
                continue

            score = 0
            if pref in title:
                score += 4
            if "大会" in title:
                score += 2
            if "日程" in title or "結果" in title:
                score += 1

            if score > 0:
                candidates[href] = (score, title, href)

        if candidates:
            ordered = sorted(candidates.values(), reverse=True)
            best_score = ordered[0][0]
            return [(title, href) for score, title, href in ordered if score == best_score]

    return []

def best_article_container(soup):
    candidates = []
    for el in soup.find_all(["article", "main", "div", "section"]):
        text = el.get_text("\n", strip=True)
        marker_count = sum(
            text.count(k) for k in (
                "※決勝", "※準決勝", "※準々決勝",
                "※1回戦", "※2回戦", "※3回戦"
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

def parse_games(html, pref, region, article_url, article_title):
    soup = BeautifulSoup(html, "html.parser")
    container = best_article_container(soup)
    lines = [
        normalize_text(x)
        for x in container.get_text("\n", strip=True).splitlines()
        if normalize_text(x)
    ]

    games = []
    current_round = None
    current_date = None
    skip_mode = False

    for line in lines:
        if any(w in line for w in SKIP_HEADING_WORDS) and ("予選" in line or "敗者復活" in line):
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
            tail = line[m.end():].strip()
            if tail:
                line = tail
            else:
                continue

        if skip_mode or not current_round or not current_date:
            continue
        if "｜" in line or "=" in line or line.startswith("("):
            continue
        if "本塁打" in line:
            continue

        gm = GAME_RE.match(line)
        if not gm:
            continue

        team1, s1, x1, s2, x2, team2, innings = gm.groups()
        team1 = normalize_text(team1).lstrip("■●○").strip()
        team2 = normalize_text(team2)

        if not team1 or not team2:
            continue
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
            "season": SEASON,
            "region": region,
            "prefecture": pref,
            "tournament": article_title,
            "round": current_round,
            "date": current_date,
            "team1": team1,
            "score1": s1,
            "team2": team2,
            "score2": s2,
            "source_url": article_url,
            "note": ";".join(["level=prefecture"] + note_parts),
        })

    seen = set()
    unique = []
    for g in games:
        key = (
            g["date"], g["round"], g["team1"], g["score1"],
            g["team2"], g["score2"], g["source_url"]
        )
        if key not in seen:
            seen.add(key)
            unique.append(g)
    return unique

def read_existing(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rd = csv.DictReader(f)
        if not rd.fieldnames:
            return []
        return list(rd)

def write_preserving_other_seasons(path, summer_rows):
    existing = read_existing(path)
    kept = [
        r for r in existing
        if not (
            str(r.get("year", "")).strip() == str(YEAR)
            and str(r.get("season", "")).strip() == SEASON
        )
    ]
    rows = kept + summer_rows

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in CSV_FIELDS})

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

    for category_id, pref, slug, region, folder in PREFS:
        print(f"[{pref}] searching...", flush=True)
        articles = find_articles(session, category_id, pref)

        if not articles:
            report.append({
                "prefecture": pref,
                "category_id": category_id,
                "article_urls": "",
                "article_count": 0,
                "match_count": 0,
                "F": 0,
                "SF": 0,
                "QF": 0,
                "expected_F": 2 if pref in ("北海道","東京") else 1,
                "expected_SF": 4 if pref in ("北海道","東京") else 2,
                "expected_QF": 8 if pref in ("北海道","東京") else 4,
                "status": "MISSING_ARTICLE",
                "note": "",
            })
            failures.append(f"{pref}: article not found")
            continue

        all_games = []
        titles = []
        urls = []

        for title, article_url in articles:
            titles.append(title)
            urls.append(article_url)
            try:
                html = get(session, article_url)
                games = parse_games(
                    html, pref, region, article_url, title
                )
                all_games.extend(games)
                print(
                    f"  {len(games)} matches {article_url}",
                    flush=True
                )
            except Exception as e:
                failures.append(
                    f"{pref}: fetch/parse error {article_url} {e}"
                )
            time.sleep(0.2)

        # 2026夏の終盤戦で既知の表記崩れがある県を確定結果で補正。
        if all_games:
            all_games = apply_late_round_fix(
                pref, region, titles[0] if titles else f"選手権{pref}大会 2026", all_games
            )

        # exact dedupe across articles
        seen = set()
        unique_games = []
        for g in all_games:
            key = (
                g["date"], g["round"], g["team1"], g["score1"],
                g["team2"], g["score2"], g["source_url"]
            )
            if key not in seen:
                seen.add(key)
                unique_games.append(g)

        counts = {
            r: sum(1 for g in unique_games if g["round"] == r)
            for r in ("F","SF","QF")
        }

        expected = (
            {"F": 2, "SF": 4, "QF": 8}
            if pref in ("北海道","東京")
            else {"F": 1, "SF": 2, "QF": 4}
        )

        status = (
            "OK"
            if all(counts[k] >= expected[k] for k in expected)
            else "CHECK"
        )

        if not unique_games:
            failures.append(f"{pref}: 0 matches parsed")
        elif status != "OK":
            failures.append(
                f"{pref}: completeness "
                f"F={counts['F']}/{expected['F']} "
                f"SF={counts['SF']}/{expected['SF']} "
                f"QF={counts['QF']}/{expected['QF']}"
            )

        out = Path(folder) / f"{slug}_2026.csv"
        write_preserving_other_seasons(out, unique_games)

        report.append({
            "prefecture": pref,
            "category_id": category_id,
            "article_urls": " | ".join(urls),
            "article_count": len(articles),
            "match_count": len(unique_games),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "expected_F": expected["F"],
            "expected_SF": expected["SF"],
            "expected_QF": expected["QF"],
            "status": status,
            "note": " | ".join(titles),
        })

        for title, article_url in articles:
            source_rows.append({
                "region": region,
                "prefecture": pref,
                "year": YEAR,
                "season": SEASON,
                "tournament_name": title,
                "source_url": article_url,
                "status": status.lower(),
                "note": f"{len(unique_games)} prefecture-total matches",
            })

    report_path = Path("master/collection_report_2026_summer.csv")
    fields = [
        "prefecture","category_id","article_urls","article_count",
        "match_count","F","SF","QF",
        "expected_F","expected_SF","expected_QF",
        "status","note"
    ]
    with report_path.open(
        "w", encoding="utf-8-sig", newline=""
    ) as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    update_sources(source_rows)

    ok_count = sum(1 for r in report if r["status"] == "OK")
    print(f"\nComplete: {ok_count}/47")

    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
