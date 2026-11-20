#!/usr/bin/env python3
"""Require each known 2026 Jingu game exactly once in ledger, match events, and both school histories."""
import csv
import json
from pathlib import Path

EXPECTED = [
    ("2026-11-19", (("鹿児島城西", "6"), ("仙台育英", "7"))),
    ("2026-11-19", (("創志学園", "5"), ("北海", "7"))),
    ("2026-11-20", (("明徳義塾", "1"), ("二松学舎大付", "4"))),
]

def rows(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def fixture(row):
    date = str(row.get("date") or "").strip()
    sides = sorted([
        (str(row.get("team1") or "").strip(), str(row.get("score1") or "").strip()),
        (str(row.get("team2") or "").strip(), str(row.get("score2") or "").strip()),
    ])
    return (date, tuple(sides))

def main():
    ledger = rows("output/all_matches.csv")
    events = rows("output/rating_events.csv")
    history = rows("output/rating_school_events.csv")
    by_match = {}
    for e in history:
        if str(e.get("event_type") or "match") == "match":
            key = str(e.get("match_key") or "").strip()
            by_match.setdefault(key, set()).add(str(e.get("school_id") or "").strip())
    results = []
    errors = []
    for date, sides in EXPECTED:
        k = (date, tuple(sorted(sides)))
        ledger_found = [r for r in ledger if fixture(r) == k and str(r.get("season") or "") == "jingu"]
        rated = [r for r in events if fixture(r) == k and str(r.get("season") or "") == "jingu"]
        school_count = 0
        if len(rated) == 1:
            e = rated[0]
            ids = [str(e.get("team1_school_id") or "").strip(), str(e.get("team2_school_id") or "").strip()]
            logged = by_match.get(str(e.get("match_key") or "").strip(), set())
            school_count = sum(bool(sid) and sid in logged for sid in ids)
        ok = len(ledger_found) == 1 and len(rated) == 1 and school_count == 2
        result = {
            "date": date,
            "teams": [f"{name} {score}" for name, score in sides],
            "ledger_count": len(ledger_found),
            "rating_match_count": len(rated),
            "school_history_sides": school_count,
            "status": "ok" if ok else "error",
        }
        results.append(result)
        if not ok:
            errors.append(result)
    report = {"fixture_count": len(EXPECTED), "verified": len(EXPECTED)-len(errors),
              "matches": results}
    target = Path("output/audit/jingu_2026_fixture_consistency.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("JINGU_2026_MATCH_CONSISTENCY",json.dumps(report,ensure_ascii=False),flush=True)
    if errors:
        raise SystemExit(f"Jingu fixture consistency failed for {len(errors)} games")

if __name__=="__main__":
    main()
