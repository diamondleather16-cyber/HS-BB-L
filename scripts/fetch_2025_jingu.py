from __future__ import annotations

from pathlib import Path
import csv
import re
import requests
from bs4 import BeautifulSoup

YEAR = 2025
SEASON = "jingu"
URL = "https://koshien89.com/blog-entry-3670.html"
TITLE = "明治神宮野球大会 2025"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HS-BB-L/1.0)"}
TIMEOUT = 30

FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

ROUND_MAP = {
    "決勝":"F",
    "準決勝":"SF",
    "準々決勝":"QF",
    "1回戦":"1R",
}

ROUND_RE = re.compile(
    r"※\s*(準々決勝|準決勝|決勝|1回戦)\s*\((\d{1,2})/(\d{1,2})\)"
)

GAME_RE = re.compile(
    r"^[■●○]?\s*(.+?)\s+(\d+)(x?)\s*-\s*(\d+)(x?)\s+(.+?)$"
)

def norm(s):
    s = s.replace("\u3000", " ")
    return re.sub(r"[ \t]+", " ", s).strip()

def get():
    r = requests.get(URL, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    return r.text

def best_container(soup):
    candidates = []
    for el in soup.find_all(["article","main","div","section"]):
        text = el.get_text("\n", strip=True)
        markers = sum(text.count(k) for k in ("※決勝","※準決勝","※準々決勝","※1回戦"))
        if markers >= 4:
            candidates.append((markers, len(text), el))
    if candidates:
        m = max(x[0] for x in candidates)
        xs = [x for x in candidates if x[0] == m]
        xs.sort(key=lambda x: x[1])
        return xs[0][2]
    return soup.body or soup

def parse_games(html):
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

        team1, s1, x1, s2, x2, team2 = gm.groups()
        notes = ["level=national"]
        if x1:
            notes.append("team1_sayonara")
        if x2:
            notes.append("team2_sayonara")

        rows.append({
            "year": str(YEAR),
            "season": SEASON,
            "region": "national",
            "prefecture": "",
            "tournament": TITLE,
            "round": current_round,
            "date": current_date,
            "team1": norm(team1),
            "score1": s1,
            "team2": norm(team2),
            "score2": s2,
            "source_url": URL,
            "note": ";".join(notes),
        })

    seen = set()
    unique = []
    for r in rows:
        key = (r["date"], r["round"], r["team1"], r["score1"], r["team2"], r["score2"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique

def main():
    rows = parse_games(get())

    out = Path("data/national/2025_jingu.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    counts = {
        rnd: sum(1 for r in rows if r["round"] == rnd)
        for rnd in ("F","SF","QF","1R")
    }

    # 10校トーナメント = 9試合
    status = "OK" if (
        len(rows) == 9
        and counts["F"] == 1
        and counts["SF"] == 2
        and counts["QF"] == 4
        and counts["1R"] == 2
    ) else "CHECK"

    report = Path("master/collection_report_2025_jingu.csv")
    fields = ["tournament","source_url","match_count","F","SF","QF","1R","status","note"]
    with report.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerow({
            "tournament": TITLE,
            "source_url": URL,
            "match_count": len(rows),
            "F": counts["F"],
            "SF": counts["SF"],
            "QF": counts["QF"],
            "1R": counts["1R"],
            "status": status,
            "note": "10地区優勝校・高校の部",
        })

    print(
        f"2025 Jingu: rows={len(rows)} "
        f"F={counts['F']} SF={counts['SF']} "
        f"QF={counts['QF']} 1R={counts['1R']} status={status}"
    )

    if status != "OK":
        raise SystemExit(2)

if __name__ == "__main__":
    main()
