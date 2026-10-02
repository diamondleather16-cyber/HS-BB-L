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
    "決勝":"F",
    "代表決定戦":"REP",
    "3位決定戦":"3P",
    "準決勝":"SF",
    "準々決勝":"QF",
    "1回戦":"1R",
    "2回戦":"2R",
    "3回戦":"3R",
    "4回戦":"4R",
    "5回戦":"5R",
    "6回戦":"6R",
    "7回戦":"7R",
}

QUAL_LABELS = {
    "地区予選":"district_qualifier",
    "地区大会予選":"district_qualifier",
    "支部予選":"branch",
    "支部大会":"branch",
    "一次予選":"first_qualifier",
    "1次予選":"first_qualifier",
    "予備選":"preliminary",
    "予備予選":"preliminary",
    "予選リーグ":"qualifier_league",
    "敗者復活":"repechage",
}

ROUND_RE = re.compile(
    r"^\s*※?\s*(代表決定戦|3位決定戦|準々決勝|準決勝|決勝|[1-7]回戦)"
    r"\s*\((\d{1,2})/(\d{1,2})(?:,[^)]+)?\)"
)

QUAL_RE = re.compile(
    r"^\s*※?\s*(地区大会予選|地区予選|支部予選|支部大会|一次予選|1次予選|予備予選|予備選|予選リーグ|敗者復活)"
    r"\s*\((\d{1,2})/(\d{1,2})(?:,[^)]+)?\)"
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
    s = s.replace("\u3000"," ")
    return re.sub(r"[ \t]+"," ",s).strip()

def find_article(session, category_id, pref):
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
            if "2026" not in title or "春季" not in title:
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
    for el in soup.find_all(["article","main","div","section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(
            text.count(k) for k in (
                "※決勝","※準決勝","※準々決勝","※1回戦",
                "※地区予選","※支部","※一次予選","※予備選"
            )
        )
        if markers >= 3:
            candidates.append((markers, len(text), el))
    if candidates:
        m = max(x[0] for x in candidates)
        xs = [x for x in candidates if x[0] == m]
        xs.sort(key=lambda x: x[1])
        return xs[0][2]
    return soup.body or soup

def classify_level(pref, stage, is_main):
    # 2026春の特例
    # 北海道: 県大会階層は支部のみ。全道大会は後で regional に回す。
    if pref == "北海道":
        if not is_main and stage in ("branch","district_qualifier"):
            return "prefecture"
        return "regional"

    # 東京: 春は予備選/一次予選も都大会本戦も、すべて県大会階層。
    if pref == "東京":
        if is_main or stage in ("preliminary","first_qualifier","district_qualifier","branch"):
            return "prefecture"

    # 他県は従来のall-level方式を保持。
    if is_main:
        return "prefecture"
    return stage

def parse_games(html, pref, region, title, url):
    soup = BeautifulSoup(html, "html.parser")
    container = best_container(soup)
    lines = [
        norm(x) for x in container.get_text("\n", strip=True).splitlines()
        if norm(x)
    ]

    rows = []
    current_round = None
    current_date = None
    current_stage = None
    current_level = None

    for line in lines:
        qm = QUAL_RE.search(line)
        if qm:
            label, month, day = qm.groups()
            stage = QUAL_LABELS[label]
            current_stage = stage
            current_level = classify_level(pref, stage, False)
            current_round = "QUAL"
            current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"

            tail = line[qm.end():].strip()
            if tail:
                line = tail
            else:
                continue
        else:
            rm = ROUND_RE.search(line)
            if rm:
                label, month, day = rm.groups()
                current_stage = "main"
                current_level = classify_level(pref, "main", True)
                current_round = ROUND_MAP[label]
                current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"

                tail = line[rm.end():].strip()
                if tail:
                    line = tail
                else:
                    continue

        if not current_round or not current_date or not current_level:
            continue
        if "｜" in line or "=" in line or line.startswith("(") or "本塁打" in line:
            continue

        gm = GAME_RE.match(line)
        if not gm:
            continue

        team1, s1, x1, s2, x2, team2, innings = gm.groups()
        team1 = norm(team1).lstrip("■●○").strip()
        team2 = norm(team2)

        notes = [f"level={current_level}", f"stage={current_stage}"]
        if x1:
            notes.append("team1_sayonara")
        if x2:
            notes.append("team2_sayonara")
        if innings:
            notes.append(f"{innings}innings")

        rows.append({
            "year":str(YEAR),
            "season":SEASON,
            "region":region,
            "prefecture":pref,
            "tournament":title or f"{pref}春季大会",
            "round":current_round,
            "date":current_date,
            "team1":team1,
            "score1":s1,
            "team2":team2,
            "score2":s2,
            "source_url":url,
            "note":";".join(notes),
        })

    seen = set()
    unique = []
    for r in rows:
        key = (
            r["date"], r["round"], r["team1"], r["score1"],
            r["team2"], r["score2"], r["note"].split(";")[0],
            next((p for p in r["note"].split(";") if p.startswith("stage=")),"")
        )
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique

def read_existing(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rd = csv.DictReader(f)
        return list(rd) if rd.fieldnames else []

def write_preserving(path, new_rows):
    existing = read_existing(path)
    kept = [
        r for r in existing
        if not (
            str(r.get("year","")).strip() == str(YEAR)
            and str(r.get("season","")).strip() == SEASON
        )
    ]
    rows = kept + new_rows
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k:r.get(k,"") for k in CSV_FIELDS})

def level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=",1)[1]
    return ""

def stage(note):
    for p in str(note or "").split(";"):
        if p.startswith("stage="):
            return p.split("=",1)[1]
    return ""

def main():
    session = requests.Session()
    report = []
    failures = []

    for category_id, pref, slug, region, folder in PREFS:
        print(f"[{pref}] searching...", flush=True)
        title, url = find_article(session, category_id, pref)

        if not url:
            report.append({
                "prefecture":pref,"article_url":"","total":0,
                "prefecture_level":0,"regional_level":0,
                "qualifier_level":0,"F":0,"SF":0,"QF":0,
                "status":"MISSING_ARTICLE","note":""
            })
            failures.append(f"{pref}: article not found")
            continue

        try:
            rows = parse_games(get(session,url), pref, region, title, url)
        except Exception as e:
            rows = []
            failures.append(f"{pref}: fetch/parse error {e}")

        pref_rows = [r for r in rows if level(r["note"]) == "prefecture"]
        regional_rows = [r for r in rows if level(r["note"]) == "regional"]
        qualifier_rows = [
            r for r in rows
            if level(r["note"]) not in ("prefecture","regional")
        ]

        # 県大会階層のQF/SF/Fは通常県のみ検証。
        # 北海道は支部だけなのでQF/SF/F本大会チェックをしない。
        # 東京は都大会本戦がprefectureなので通常チェック。
        counts = {
            rnd:sum(1 for r in pref_rows if r["round"] == rnd)
            for rnd in ("F","SF","QF")
        }

        if pref == "北海道":
            branch_pref = sum(
                1 for r in pref_rows
                if stage(r["note"]) in ("branch","district_qualifier")
            )
            status = "OK" if branch_pref > 0 else "CHECK"
        else:
            status = "OK" if (
                counts["F"] >= 1
                and counts["SF"] >= 2
                and counts["QF"] >= 4
            ) else "CHECK"

        if status != "OK":
            failures.append(
                f"{pref}: pref={len(pref_rows)} regional={len(regional_rows)} "
                f"F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        out = Path(folder) / f"{slug}_2026.csv"
        write_preserving(out, rows)

        report.append({
            "prefecture":pref,
            "article_url":url,
            "total":len(rows),
            "prefecture_level":len(pref_rows),
            "regional_level":len(regional_rows),
            "qualifier_level":len(qualifier_rows),
            "F":counts["F"],
            "SF":counts["SF"],
            "QF":counts["QF"],
            "status":status,
            "note":title or "",
        })

        print(
            f"  {status}: total={len(rows)} "
            f"pref={len(pref_rows)} regional={len(regional_rows)} "
            f"qualifier={len(qualifier_rows)}",
            flush=True
        )
        time.sleep(0.15)

    rp = Path("master/collection_report_2026_spring_prefecture_hierarchy.csv")
    fields = [
        "prefecture","article_url","total","prefecture_level",
        "regional_level","qualifier_level","F","SF","QF","status","note"
    ]
    with rp.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report)

    ok = sum(1 for r in report if r["status"]=="OK")
    print(f"\nComplete: {ok}/47")

    if failures:
        print("\nNeeds check:")
        for x in failures:
            print(" -", x)
        raise SystemExit(2)

if __name__ == "__main__":
    main()
