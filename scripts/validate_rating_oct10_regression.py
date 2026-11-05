#!/usr/bin/env python3
"""Ensure a surviving tournament fixture produces exactly one school-rating event."""
import csv
from pathlib import Path

def load(path):
    with Path(path).open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

matches=load("output/rating_events.csv")

# The source bracket has eight games on Oct 10, 2026. Compare the actual
# school+score fixture set, rather than merely counting eight arbitrary rows.
def fixture(r):
    def score(s):
        try: return str(int(float(s)))
        except (TypeError,ValueError): return str(s or "").strip()
    return tuple(sorted(((str(r.get("team1") or "").strip(),score(r.get("score1"))),
                         (str(r.get("team2") or "").strip(),score(r.get("score2"))))))
def first_round(r):
    return (r.get("year")=="2026" and r.get("season")=="autumn"
            and r.get("date")=="2026-10-10"
            and r.get("tournament")=="2026秋季北信越地区大会"
            and r.get("round")=="1回戦")
source_round=[r for r in load("output/all_matches.csv") if first_round(r)]
rated_round=[r for r in matches if first_round(r)]
expected={fixture(r) for r in source_round}
observed={fixture(r) for r in rated_round}
if len(source_round)!=8 or len(expected)!=8 or len(rated_round)!=8 or expected!=observed:
    missing=sorted(expected-observed)
    extra=sorted(observed-expected)
    raise SystemExit(
        f"BLOCKED 2026 Hokushinetsu first round: source={len(source_round)} "
        f"rated={len(rated_round)} missing={missing} unexpected={extra}")
print("HOKUSHINETSU_2026_FIRST_ROUND_ALL_EIGHT_RATED",len(rated_round),flush=True)

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
