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
    raise SystemExit(f"FAILED 2026 Hokushinetsu first round: expected one canonical rating event; got {len(target)}")
key=target[0]["match_key"]
school_events=load("output/rating_school_events.csv")
observed=[r for r in school_events if r.get("match_key")==key and r.get("event_type")=="match"]
if len(observed)<2:
    raise SystemExit(f"FAILED rating history: match_key {key} only has {len(observed)} match event sides")
print("FIRST_ROUND_RATING_HISTORY_VERIFIED",key,"school_sides",len(observed))
