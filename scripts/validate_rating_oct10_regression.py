#!/usr/bin/env python3
"""Ensure a surviving tournament fixture produces exactly one school-rating event."""
import csv
from pathlib import Path

def load(path):
    with Path(path).open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

matches=load("output/rating_events.csv")
target=[r for r in matches
        if r.get("year")=="2026" and r.get("season")=="autumn" and r.get("date")=="2026-10-10"
        and {r.get("team1"),r.get("team2")}=={"星稜","帝京長岡"}
        and {r.get("score1"),r.get("score2")}=={"3","5"}]
if len(target)!=1:
    for path in ("output/all_matches.csv","output/rating_events.csv"):
        rows=load(path)
        matched=[r for r in rows if r.get("year")=="2026" and r.get("season")=="autumn" and (
            ("星稜" in str(r.get("team1",""))+str(r.get("team2","")) and
             "帝京長岡" in str(r.get("team1",""))+str(r.get("team2","")))
            or (r.get("date")=="2026-10-10" and
                ("帝京長岡" in str(r.get("team1",""))+str(r.get("team2","")) or
                 "星稜" in str(r.get("team1",""))+str(r.get("team2","")))))]
        print("FIRST_ROUND_DEBUG",path,"candidates",len(matched),flush=True)
        for r in matched[:15]:
            print("FIRST_ROUND_DEBUG_ROW", {k:r.get(k) for k in ("date","tournament","team1","score1","team2","score2","match_key","note","level")},flush=True)
    from build_rating_events_v2 import build_full_rating_input
    src=load("output/all_matches.csv")
    merged=build_full_rating_input(src)
    entries=[r for r in merged if r.get("year")=="2026" and r.get("date")=="2026-10-10" and "星稜" in str(r) and "帝京長岡" in str(r)]
    print("MERGED_TARGET_COUNT",len(entries),flush=True)
    print("MERGED_TARGET_ROWS",[{k:r.get(k) for k in ("tournament","team1","team2","score1","score2","note","_rating_source")} for r in entries],flush=True)
    raise SystemExit(f"FAILED 2026 Hokushinetsu first round: expected one canonical rating event; got {len(target)}")
key=target[0]["match_key"]
school_events=load("output/rating_school_events.csv")
observed=[r for r in school_events if r.get("match_key")==key and r.get("event_type")=="match"]
if len(observed)<2:
    raise SystemExit(f"FAILED rating history: match_key {key} only has {len(observed)} match event sides")
print("FIRST_ROUND_RATING_HISTORY_VERIFIED",key,"school_sides",len(observed))
