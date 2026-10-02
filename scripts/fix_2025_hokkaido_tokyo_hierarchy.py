from __future__ import annotations

from pathlib import Path
import csv
import re
import requests
from bs4 import BeautifulSoup

YEAR = "2025"
FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0; +https://github.com/)"
}
TIMEOUT = 30

URLS = {
    "summer_north": (
        "選手権北北海道大会 2025 日程・結果",
        "https://koshien89.com/blog-entry-3540.html",
    ),
    "summer_south": (
        "選手権南北海道大会 2025 日程・結果",
        "https://koshien89.com/blog-entry-3541.html",
    ),
    "autumn_hokkaido": (
        "秋季北海道大会 2025 日程・結果",
        "https://koshien89.com/blog-entry-3654.html",
    ),
    "autumn_tokyo": (
        "秋季東京大会 2025 日程・結果",
        "https://koshien89.com/blog-entry-3638.html",
    ),
}

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

MAIN_ROUND_RE = re.compile(
    r"※\s*(3位決定戦|準々決勝|準決勝|決勝|[1-7]回戦)"
    r"\s*\((\d{1,2})/(\d{1,2})(?:,[^)]+)?\)"
)
QUAL_RE = re.compile(
    r"※\s*(地区予選|支部予選|一次予選|1次予選)"
    r"\s*\((\d{1,2})/(\d{1,2})(?:,[^)]+)?\)"
)
GAME_RE = re.compile(
    r"^[■●○]?\s*(.+?[^\d\s])\s*(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)(?:\((\d+)\))?$"
)

def norm(s: str) -> str:
    s = s.replace("\u3000", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def get(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r.text

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article","main","div","section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(
            text.count(k) for k in (
                "※決勝","※準決勝","※準々決勝","※1回戦",
                "※地区予選","※支部予選","※一次予選"
            )
        )
        if markers >= 3:
            candidates.append((markers, len(text), el))
    if candidates:
        mm = max(x[0] for x in candidates)
        subset = [x for x in candidates if x[0] == mm]
        subset.sort(key=lambda x: x[1])
        return subset[0][2]
    return soup.body or soup

def parse_page(
    title: str,
    url: str,
    season: str,
    prefecture: str,
    region: str,
    main_level: str,
    qualifier_level: str,
    qualifier_stage: str,
):
    soup = BeautifulSoup(get(url), "html.parser")
    container = best_container(soup)
    lines = [
        norm(x) for x in container.get_text("\n", strip=True).splitlines()
        if norm(x)
    ]

    rows = []
    current_round = None
    current_date = None
    current_level = None
    current_stage = None

    for line in lines:
        qm = QUAL_RE.search(line)
        if qm:
            label, month, day = qm.groups()
            current_round = "QUAL"
            current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"
            current_level = qualifier_level
            current_stage = qualifier_stage or label
            tail = line[qm.end():].strip()
            if tail:
                line = tail
            else:
                continue
        else:
            mm = MAIN_ROUND_RE.search(line)
            if mm:
                label, month, day = mm.groups()
                current_round = ROUND_MAP[label]
                current_date = f"{YEAR}-{int(month):02d}-{int(day):02d}"
                current_level = main_level
                current_stage = "main"
                tail = line[mm.end():].strip()
                if tail:
                    line = tail
                else:
                    continue

        if not current_round or not current_date or not current_level:
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

        notes = [f"level={current_level}", f"stage={current_stage}"]
        if x1:
            notes.append("team1_sayonara")
        if x2:
            notes.append("team2_sayonara")
        if innings:
            notes.append(f"{innings}innings")

        rows.append({
            "year": YEAR,
            "season": season,
            "region": region,
            "prefecture": prefecture,
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

    seen = set()
    out = []
    for r in rows:
        key = (
            r["season"], r["date"], r["round"], r["team1"], r["score1"],
            r["team2"], r["score2"], r["source_url"], r["note"].split(";")[0]
        )
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out

def read_rows(path: Path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write_rows(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})

def replace_season(rows, season, new_rows):
    kept = [
        r for r in rows
        if not (
            str(r.get("year", "")).strip() == YEAR
            and str(r.get("season", "")).strip() == season
        )
    ]
    return kept + new_rows

def get_level(note):
    for part in str(note or "").split(";"):
        if part.startswith("level="):
            return part.split("=", 1)[1]
    return ""

def counts(rows, level=None):
    if level is not None:
        rows = [r for r in rows if get_level(r.get("note")) == level]
    return {
        rnd: sum(1 for r in rows if r.get("round") == rnd)
        for rnd in ("F","SF","QF","QUAL")
    }

def main():
    hokkaido_path = Path("data/01_hokkaido/hokkaido_2025.csv")
    tokyo_path = Path("data/03_kanto_tokyo/tokyo_2025.csv")

    hokkaido_existing = read_rows(hokkaido_path)
    tokyo_existing = read_rows(tokyo_path)

    # 夏・北海道:
    # 北北海道/南北海道本大会 = prefecture
    # 両大会ページ内の地区予選(支部大会相当) = branch
    summer_rows = []
    for key in ("summer_north", "summer_south"):
        title, url = URLS[key]
        summer_rows.extend(parse_page(
            title=title,
            url=url,
            season="summer",
            prefecture="北海道",
            region="hokkaido",
            main_level="prefecture",
            qualifier_level="branch",
            qualifier_stage="hokkaido_branch",
        ))

    # 秋・北海道:
    # 支部大会(サイト上は地区予選) = prefecture
    # 全道大会 = regional
    title, url = URLS["autumn_hokkaido"]
    autumn_hokkaido_rows = parse_page(
        title=title,
        url=url,
        season="autumn",
        prefecture="北海道",
        region="hokkaido",
        main_level="regional",
        qualifier_level="prefecture",
        qualifier_stage="hokkaido_branch",
    )

    # 秋・東京:
    # 一次予選(サイト上は地区予選) = prefecture
    # 東京都大会 = regional
    title, url = URLS["autumn_tokyo"]
    autumn_tokyo_rows = parse_page(
        title=title,
        url=url,
        season="autumn",
        prefecture="東京",
        region="kanto_tokyo",
        main_level="regional",
        qualifier_level="prefecture",
        qualifier_stage="tokyo_first_qualifier",
    )

    hokkaido_rows = replace_season(
        hokkaido_existing, "summer", summer_rows
    )
    hokkaido_rows = replace_season(
        hokkaido_rows, "autumn", autumn_hokkaido_rows
    )
    tokyo_rows = replace_season(
        tokyo_existing, "autumn", autumn_tokyo_rows
    )

    write_rows(hokkaido_path, hokkaido_rows)
    write_rows(tokyo_path, tokyo_rows)

    report = Path("master/collection_report_2025_hierarchy_special.csv")
    fields = [
        "dataset","source","total","prefecture_level","regional_level",
        "branch_level","F","SF","QF","QUAL","status","note"
    ]

    report_rows = []

    summer_c = counts(summer_rows)
    summer_branch = sum(
        1 for r in summer_rows if get_level(r["note"]) == "branch"
    )
    summer_pref = sum(
        1 for r in summer_rows if get_level(r["note"]) == "prefecture"
    )
    summer_status = (
        "OK"
        if (
            summer_c["F"] >= 2
            and summer_c["SF"] >= 4
            and summer_c["QF"] >= 8
            and summer_branch > 0
        )
        else "CHECK"
    )
    report_rows.append({
        "dataset": "2025 summer Hokkaido",
        "source": "3540 + 3541",
        "total": len(summer_rows),
        "prefecture_level": summer_pref,
        "regional_level": 0,
        "branch_level": summer_branch,
        "F": summer_c["F"],
        "SF": summer_c["SF"],
        "QF": summer_c["QF"],
        "QUAL": summer_c["QUAL"],
        "status": summer_status,
        "note": "North/South main=prefecture; district qualifiers=branch",
    })

    ah_c = counts(autumn_hokkaido_rows, "regional")
    ah_pref = sum(
        1 for r in autumn_hokkaido_rows if get_level(r["note"]) == "prefecture"
    )
    ah_reg = sum(
        1 for r in autumn_hokkaido_rows if get_level(r["note"]) == "regional"
    )
    ah_status = (
        "OK"
        if (
            ah_c["F"] >= 1
            and ah_c["SF"] >= 2
            and ah_c["QF"] >= 4
            and ah_pref > 0
        )
        else "CHECK"
    )
    report_rows.append({
        "dataset": "2025 autumn Hokkaido",
        "source": URLS["autumn_hokkaido"][1],
        "total": len(autumn_hokkaido_rows),
        "prefecture_level": ah_pref,
        "regional_level": ah_reg,
        "branch_level": 0,
        "F": ah_c["F"],
        "SF": ah_c["SF"],
        "QF": ah_c["QF"],
        "QUAL": sum(1 for r in autumn_hokkaido_rows if r["round"] == "QUAL"),
        "status": ah_status,
        "note": "branch qualifiers=prefecture; all-Hokkaido tournament=regional",
    })

    at_c = counts(autumn_tokyo_rows, "regional")
    at_pref = sum(
        1 for r in autumn_tokyo_rows if get_level(r["note"]) == "prefecture"
    )
    at_reg = sum(
        1 for r in autumn_tokyo_rows if get_level(r["note"]) == "regional"
    )
    at_status = (
        "OK"
        if (
            at_c["F"] >= 1
            and at_c["SF"] >= 2
            and at_c["QF"] >= 4
            and at_pref > 0
        )
        else "CHECK"
    )
    report_rows.append({
        "dataset": "2025 autumn Tokyo",
        "source": URLS["autumn_tokyo"][1],
        "total": len(autumn_tokyo_rows),
        "prefecture_level": at_pref,
        "regional_level": at_reg,
        "branch_level": 0,
        "F": at_c["F"],
        "SF": at_c["SF"],
        "QF": at_c["QF"],
        "QUAL": sum(1 for r in autumn_tokyo_rows if r["round"] == "QUAL"),
        "status": at_status,
        "note": "first qualifiers=prefecture; Tokyo main tournament=regional",
    })

    with report.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(report_rows)

    for r in report_rows:
        print(
            f"{r['dataset']}: {r['status']} total={r['total']} "
            f"pref={r['prefecture_level']} reg={r['regional_level']} "
            f"branch={r['branch_level']} F={r['F']} SF={r['SF']} "
            f"QF={r['QF']} QUAL={r['QUAL']}"
        )

    if any(r["status"] != "OK" for r in report_rows):
        raise SystemExit(2)

if __name__ == "__main__":
    main()
