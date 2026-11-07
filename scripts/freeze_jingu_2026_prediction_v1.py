#!/usr/bin/env python3
"""Freeze-and-predict protocol for 2026 Meiji Jingu HS tournament.

Uses ONLY immutable docs/data/audit/jingu_2026_frozen_inputs_v1.json.
Does not read live ratings, latest school results or actual 2026 Jingu games.
Both Elo-only and school+prefecture strength+prefecture matchup scenarios are
computed with a seeded 100k bracket Monte Carlo, for later 24 Nov assessment.

Snapshot pair corrections are a FROZEN proxy for current pref components,
not an exact current game-pre-match context replay. School-school rematch
bias, uncertain lineup, pitcher usage and uncalibrated extra upset noise are
explicitly excluded. The main existing HS-BB-L rating engine is untouched.
"""
from __future__ import annotations
import json,math,random,hashlib
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/"docs/data/audit/jingu_2026_frozen_inputs_v1.json"
OUTPUT=ROOT/"docs/data/audit/jingu_2026_prediction_frozen_v1.json"
TRIALS=100000
SEED=20261107
def calc_p(a,b,teams,snapshot,model):
 x=teams[a];y=teams[b]
 ra=x["rating"];rb=y["rating"]
 components={"school_rating1":ra,"school_rating2":rb,"pref_strength1":0.,"pref_strength2":0.,
             "pref_matchup1":0.,"pref_matchup2":0.}
 if model=="pref_pair":
  pref=snapshot["prefecture_rating_snapshot"]
  pa=x["prefecture"];pb=y["prefecture"]
  components["pref_strength1"]=max(-15.,min(15.,.25*(pref.get(pa,1000)-1000)))
  components["pref_strength2"]=max(-15.,min(15.,.25*(pref.get(pb,1000)-1000)))
  key="|".join(sorted([pa,pb]))
  matchup=snapshot["pair_matchup_snapshot"].get(key)
  if matchup and pa!=pb:
   raw=matchup["elo_a"]*(1 if matchup["pref_a"]==pa else -1)
   components["pref_matchup1"]=max(-15.,min(15.,.5*raw))
   components["pref_matchup2"]=-components["pref_matchup1"]
  ra+=components["pref_strength1"]+components["pref_matchup1"]
  rb+=components["pref_strength2"]+components["pref_matchup2"]
 return 1/(1+10**((rb-ra)/400)),components
def simulate(snapshot,model):
 teams={x["name"]:x for x in snapshot["teams"]}
 fixture=snapshot["fixture"]
 groups=["R1","QF","SF","F"]
 fixtures=[x for level in groups for x in fixture[level]]
 expected_n={"R1":2,"QF":4,"SF":2,"F":1}
 for level,n in expected_n.items():
  if len(fixture[level])!=n:raise ValueError("Unexpected 10-team bracket "+level)
 ids={x["id"] for x in fixtures}
 if len(ids)!=9:raise ValueError("Duplicate bracket fixture id")
 for fx in fixtures:
  for side in (fx["a"],fx["b"]):
   if side not in ids and side not in teams:raise ValueError("Unknown bracket node "+side)
 outcomes={name:{"win":0,"final":0,"semifinal":0,"quarterfinal":0,
                  "first_round_win":0} for name in teams}
 pred={}
 for a in teams:
  for b in teams:
   if a!=b:pred[a,b]=calc_p(a,b,teams,snapshot,model)[0]
 first_pairs={}
 for fx in fixture["R1"]+fixture["QF"]:
  if fx["a"] in teams and fx["b"] in teams:
   pa,_=calc_p(fx["a"],fx["b"],teams,snapshot,model)
   first_pairs[fx["id"]]={"date":fx["date"],"team1":fx["a"],"team2":fx["b"],"p_team1":round(pa,7)}
 rng=random.Random(SEED)
 matchups={fx["id"]:defaultdict(int) for fx in fixtures}
 for _ in range(TRIALS):
  wins={}
  for level in groups:
   for game in fixture[level]:
    a=wins.get(game["a"],game["a"])
    b=wins.get(game["b"],game["b"])
    if a not in teams or b not in teams or a==b:raise ValueError("Inconsistent bracket")
    w=a if rng.random()<pred[a,b] else b
    wins[game["id"]]=w
    matchups[game["id"]][w]+=1
    if level=="R1":outcomes[w]["first_round_win"]+=1
    elif level=="QF":outcomes[w]["semifinal"]+=1
    elif level=="SF":outcomes[w]["final"]+=1
    else:outcomes[w]["win"]+=1
  # "reach quarterfinal" includes automatic byes
  for game in fixture["QF"]:
   for side in (game["a"],game["b"]):
    if side in teams:outcomes[side]["quarterfinal"]+=1
    else:outcomes[wins[side]]["quarterfinal"]+=1
 results=[]
 for name,t in teams.items():
  o=outcomes[name]
  results.append({"school":name,"district":t["district"],"school_id":t["school_id"],
    "school_rank":t["rank"],"rating":t["rating"],
    "champion_probability":round(o["win"]/TRIALS,6),
    "reach_final_probability":round(o["final"]/TRIALS,6),
    "reach_sf_probability":round(o["semifinal"]/TRIALS,6),
    "reach_qf_probability":round(o["quarterfinal"]/TRIALS,6)})
 results.sort(key=lambda x:(-x["champion_probability"],x["school"]))
 if abs(sum(x["champion_probability"] for x in results)-1)>0.00001:raise ValueError("Champion totals do not sum to 1")
 return {"model":model,"trials":TRIALS,"seed":SEED,
         "schools":results,"known_first_games":list(first_pairs.values()),
         "game_winner_probabilities":{k:{w:round(n/TRIALS,6) for w,n in vals.items()} for k,vals in matchups.items()}}
def main():
 raw=INPUT.read_bytes();snap=json.loads(raw)
 if snap.get("frozen_on_jst")!="2026-11-07":raise ValueError("Unexpected freeze date")
 if len(snap["teams"])!=10:raise ValueError("Require exactly 10 schools")
 if len({x["school_id"] for x in snap["teams"]})!=10:raise ValueError("Duplicate school id")
 out={"title":"2026年明治神宮大会・事前固定予測（11/7スナップショット）",
   "created_at_utc":datetime.now(timezone.utc).isoformat(),
   "snapshot_date_jst":snap["frozen_on_jst"],"snapshot_sha256":hashlib.sha256(raw).hexdigest(),
   "snapshot_source_blobs":snap["sources"],"num_games":9,"competition_start":"2026-11-19",
   "competition_end":"2026-11-24",
   "scenarios":{
     "school":"学校Ratingのみ。地域補正なし。",
     "pref_pair":"学校Rating＋11月7日固定の県Rating/県相性を利用した近似。学校同士の相性補正は含まない。"
   },
   "exclusions":["Wave/upset coefficient not tuned or added; Elo stochastic winners only.",
     "Does not update school rating after each simulated win.",
     "Pair context is derived from frozen cumulative prefecture ratings, not live historical pre-match prefecture match contexts.",
     "No pitcher-usage, weather, school matchup, home-field or injury variables.",
     "Do NOT refresh frozen input or overwrite baseline after the event begins."],
   "bracket":snap["fixture"],
   "models":{"school":simulate(snap,"school"),"pref_pair":simulate(snap,"pref_pair")}}
 if OUTPUT.exists():
  prior=json.loads(OUTPUT.read_text(encoding="utf-8-sig"))
  if prior.get("snapshot_sha256")!=out["snapshot_sha256"] or prior.get("models")!=out["models"]:
   raise SystemExit("Refusing to overwrite already frozen pre-tournament prediction.")
  print("JINGU_2026_FROZEN_PREDICTION already generated and unchanged")
  return
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 OUTPUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("JINGU_2026_FROZEN_PREDICTION",json.dumps({"snapshot_sha256":out["snapshot_sha256"],
 "school_top3":out["models"]["school"]["schools"][:3],
 "pref_pair_top3":out["models"]["pref_pair"]["schools"][:3]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
