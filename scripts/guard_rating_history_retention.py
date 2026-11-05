#!/usr/bin/env python3
"""Prevent disappearance of previously rated fixtures that still exist in the ledger."""
import csv,re,json
from pathlib import Path
from dedupe_ledger_physical_fixtures import team,score

def date(x):
    raw=str(x or "").strip()
    parts=re.findall(r"\d+",raw)
    if len(parts)>=3:
        y,m,d=(int(v) for v in parts[:3])
        if 2000<=y<=2100 and 1<=m<=12 and 1<=d<=31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    return raw

def key(r):
    return (str(r.get("year") or ""),str(r.get("season") or ""),date(r.get("date")),
            tuple(sorted(((team(r.get("team1")),score(r.get("score1"))),
                          (team(r.get("team2")),score(r.get("score2")))))))

def rows(path):
    with Path(path).open(encoding="utf-8-sig",newline="") as f:
        yield from csv.DictReader(f)

def main():
    old=Path("docs/data/rating_events.csv")
    if not old.is_file():
        print("RATING_HISTORY_RETENTION initial snapshot; no previous rating")
        return
    previous={key(r):r for r in rows(old)}
    current={key(r) for r in rows("output/rating_events.csv")}
    ledger={key(r) for r in rows("output/all_matches.csv")
            if "exclude_from_rating=1" not in str(r.get("note") or "")}
    missing=(set(previous)&ledger)-current
    print("RATING_HISTORY_RETENTION",json.dumps({
        "previous_rated_fixtures":len(previous),
        "current_rated_fixtures":len(current),
        "still_in_ledger_but_now_missing":len(missing)},ensure_ascii=False),flush=True)
    for k in sorted(missing)[:20]:
        row=previous[k]
        print("LOST_RATING_GAME",json.dumps(
            {x:row.get(x) for x in ("year","season","date","tournament","round",
                                   "team1","score1","team2","score2")},ensure_ascii=False),flush=True)
    if missing:
        raise SystemExit("BLOCKED: previously rated ledger fixtures vanished from rating history")

if __name__=="__main__":
    main()
