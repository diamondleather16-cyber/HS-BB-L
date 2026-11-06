#!/usr/bin/env python3
"""Experimental 16-school Hokushinetsu autumn BRACKET simulator.

Unlike the historical calibration report, this uses a frozen school Rating
from each entrant's first-round appearance and does not add in-tournament wins
to Rating. It reconstructs the bracket layout from actual recorded fixtures
but never assumes future match outcomes in Monte Carlo simulation.

A reference to actual round-2 pairings determines the bracket TOPOLOGY only,
not who wins the simulated first round. This requires a complete 16-team
single-elimination bracket (8+4+2+1 games). Any incomplete tournament is skipped.
Only the SCHOOL-RATING-ONLY model is simulated here, not the current combined
school/prefecture/matchup model: that needs historically frozen cross-prefecture
context for each hypothetical pair. Never mislabel this as the live model.
"""
from __future__ import annotations
from pathlib import Path
from collections import defaultdict
import csv,json,math,random,datetime,hashlib

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"docs/data/audit/hokushinetsu_prediction_games_v1.csv"
DEST=ROOT/"docs/data/audit/hokushinetsu_bracket_simulation_v1.json"
TRIALS=50000
SEED=20261107

def elo(p,q):
 return 1/(1+10**((q-p)/400))
def winner(r):
 return r["favorite"] if int(r["actual"]) else r["opponent"]
def contestants(r):
 return [r["favorite"],r["opponent"]]
def build_tournament(rows):
 groups=defaultdict(list)
 for r in rows:groups[r["round_group"]].append(r)
 if any(len(groups[g])!=n for g,n in [("R1",8),("QF",4),("SF",2),("F",1)]):
  raise ValueError("Expected exactly 8 first round, 4 QF, 2 SF, 1 final")
 starts={};levels={}
 for i,r in enumerate(groups["R1"]):
  for school,field in [(r["favorite"],"favorite_rating"),(r["opponent"],"opponent_rating")]:
   if school in starts:raise ValueError("Entrant repeated in opening round: "+school)
   starts[school]=float(r[field])
  levels[winner(r)]=("R1",i)
 if len(starts)!=16:raise ValueError("Expected exactly 16 unique entrants")
 graph={"R1":[tuple(contestants(r)) for r in groups["R1"]]}
 for upper,lower in [("QF","R1"),("SF","QF"),("F","SF")]:
  links=[];used=set();next_levels={}
  for r in groups[upper]:
   child_ids=[]
   for team in contestants(r):
    ref=levels.get(team)
    if not ref or ref[0]!=lower:raise ValueError(f"Missing prior winner: {upper}/{team}")
    if ref[1] in used:raise ValueError("Prior bracket match is reused")
    used.add(ref[1]);child_ids.append(ref[1])
   links.append(tuple(child_ids))
   next_levels[winner(r)]=(upper,len(links)-1)
  if len(used)!=len(graph[lower]):raise ValueError("Incomplete bracket links "+upper)
  graph[upper]=links
  levels=next_levels
 return graph,starts,winner(groups["F"][0])
def simulate(graph,ratings,rng):
 won={}
 for i,(a,b) in enumerate(graph["R1"]):
  won["R1",i]=a if rng.random()<elo(ratings[a],ratings[b]) else b
 round_upsets=defaultdict(int)
 round_games=defaultdict(int)
 # First-round upsets
 for i,(a,b) in enumerate(graph["R1"]):
  underdog=a if ratings[a]<ratings[b] else b
  if ratings[a]!=ratings[b]:
   round_games["R1"]+=1
   round_upsets["R1"]+=int(won["R1",i]==underdog)
 for group,prior in [("QF","R1"),("SF","QF"),("F","SF")]:
  for i,(j,k) in enumerate(graph[group]):
   a,b=won[prior,j],won[prior,k]
   won[group,i]=a if rng.random()<elo(ratings[a],ratings[b]) else b
   if ratings[a]!=ratings[b]:
    round_games[group]+=1
    round_upsets[group]+=int(won[group,i]==(a if ratings[a]<ratings[b] else b))
 return won,round_upsets,round_games
def run_group(year,title,rows):
 graph,ratings,champion=build_tournament(rows)
 seed=SEED+year
 rng=random.Random(seed)
 champ=defaultdict(int);finalists=defaultdict(int);semifinalists=defaultdict(int);upsets=defaultdict(int);matches=defaultdict(int)
 for i in range(TRIALS):
  won,up,den=simulate(graph,ratings,rng)
  champ[won["F",0]]+=1
  for j in range(2):finalists[won["SF",j]]+=1
  for j in range(4):semifinalists[won["QF",j]]+=1
  for r in up:upsets[r]+=up[r];matches[r]+=den[r]
 order=sorted(ratings,key=lambda t:(-ratings[t],t))
 predicted_champion_probability=max(1e-8,champ.get(champion,0)/TRIALS)
 return {"year":year,"tournament":title,"trials":TRIALS,"seed":seed,
  "actual_champion":champion,"actual_champion_rating":round(ratings[champion],3),
  "actual_champion_pre_tournament_rating_rank":order.index(champion)+1,
  "actual_champion_simulated_probability":round(predicted_champion_probability,6),
  "actual_champion_log_loss":round(-math.log(predicted_champion_probability),5),
  "top_rating_school":order[0],"top_rating_school_championship_probability":round(champ.get(order[0],0)/TRIALS,6),
  "school_rating_top4_won_actual":champion in order[:4],
  "model_top4_championship_probability":round(sum(champ[t] for t in order[:4])/TRIALS,6),
  "predictions":[{"school":t,"rating_at_opening":round(ratings[t],4),
   "rating_rank":order.index(t)+1,"win_title":round(champ[t]/TRIALS,5),
   "reach_final":round(finalists[t]/TRIALS,5),
   "reach_semifinal":round(semifinalists[t]/TRIALS,5)}
   for t in sorted(ratings,key=lambda t:(-champ[t],t))],
  "model_upsets_by_round":[{"round":r,"simulation_upsets":upsets[r],
     "simulation_non_tied_games":matches[r],"upset_rate":round(upsets[r]/matches[r],5) if matches[r] else None}
     for r in ["R1","QF","SF","F"]]}
def main():
 with SOURCE.open(encoding="utf-8-sig",newline="") as fh:rows=list(csv.DictReader(fh))
 groups=defaultdict(list)
 for r in rows:groups[(int(r["year"]),r["tournament"])].append(r)
 reports=[];skipped=[]
 for (yr,title),values in sorted(groups.items()):
  try:reports.append(run_group(yr,title,values))
  except ValueError as e:skipped.append({"year":yr,"tournament":title,"reason":str(e)})
 doc={"title":"HS-BB-L 北信越秋季 16校トーナメント試作シミュレーション",
  "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "model":"OPENING-FROZEN SCHOOL RATING ONLY (not the current prefecture+matchup full simulator)",
  "method":"Rebuild 16-team bracket topology from historical first-round/quarterfinal/semifinal/final matchups; freeze each school's rating at its R1 opening and independently simulate entire bracket.",
  "warnings":["This is a baseline model for testing bracket mechanics; existing prefecture strength and prefecture compatibility are NOT yet included.",
    "Bracket layout inferred from historical fixture winners; only structure, never future winners, is used in simulation.",
    "Pre-tournament rating is approximated by first-round pre-match Rating; an entrant may have played another tournament earlier that day.",
    "Historical reconstructed ledger is not a fully time-travelled model; historical lineup coverage should be audited.",
    "50,000 runs only reduce Monte Carlo noise; they do not validate the predictive model."],
  "tournaments":reports,"skipped":skipped,"coverage":{"tournaments_simulated":len(reports),"tournaments_skipped":len(skipped),
   "total_simulation_draws":len(reports)*TRIALS},
  "aggregate":{"actual_champions_from_rating_top4":sum(int(x["school_rating_top4_won_actual"]) for x in reports),
   "predicted_champions_from_rating_top4":round(sum(x["model_top4_championship_probability"] for x in reports),3),
   "mean_actual_champion_model_probability":round(sum(x["actual_champion_simulated_probability"] for x in reports)/len(reports),5) if reports else None}}
 DEST.parent.mkdir(parents=True,exist_ok=True)
 DEST.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("HOKUSHINETSU_BRACKET_REPORT",json.dumps({"coverage":doc["coverage"],"aggregate":doc["aggregate"],
  "year_summary":[{"year":r["year"],"champion":r["actual_champion"],"rating_rank":r["actual_champion_pre_tournament_rating_rank"],"chance":r["actual_champion_simulated_probability"]} for r in reports],"skipped":skipped},ensure_ascii=False),flush=True)
 if not reports:raise SystemExit("No complete historical brackets reconstructed. Check round labels and source coverage.")
if __name__=="__main__":main()
