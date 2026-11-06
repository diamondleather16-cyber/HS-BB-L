#!/usr/bin/env python3
"""HS-BB-L autumn Hokushinetsu out-of-sample-style diagnostic, no rating mutations.

Reads historical PRE-MATCH predictions saved by the rating replay. A 2025
rating may be retrospectively recalculated from early match history, but no
post-match ratings from an evaluated match are used as its predictor.
This is a prototype calibration/round-upset audit, NOT a full bracket Monte Carlo.
"""
from __future__ import annotations
from collections import defaultdict
from pathlib import Path
import csv, json, math, datetime, random, statistics, re

ROOT=Path(__file__).resolve().parents[1]
EVENTS=ROOT/"output/rating_events.csv"
DEST=ROOT/"docs/data/audit/hokushinetsu_prediction_v1.json"
TABLE=ROOT/"docs/data/audit/hokushinetsu_prediction_games_v1.csv"
SEASONS=range(2017,2026)
SEED=20261107

def fval(s,default=None):
 try:
  n=float(s)
  return n if math.isfinite(n) else default
 except (ValueError,TypeError):return default
def rnd(text):
 t=str(text or "").strip().lower()
 if re.search(r"決勝|final|(^|[^a-z])f($|[^a-z])",t) and not re.search(r"準決勝|semi|sf",t):return "F"
 if re.search(r"準決勝|semi|sf|ベスト4",t):return "SF"
 if re.search(r"準々決勝|quarter|qf|ベスト8",t):return "QF"
 if re.search(r"3回戦|三回戦|3rd|r16|16強|ベスト16",t):return "R16"
 if re.search(r"2回戦|二回戦|2nd|r32",t):return "R2"
 if re.search(r"1回戦|一回戦|1st|r64",t):return "R1"
 return "その他"
def frac(n,d):return round(n/d,5) if d else None
def summarize(rows):
 n=len(rows); outcome=sum(x["actual"] for x in rows); predicted=sum(x["p"] for x in rows)
 brier=sum((x["p"]-x["actual"])**2 for x in rows)
 ll=-sum(x["actual"]*math.log(max(1e-9,x["p"]))+(1-x["actual"])*math.log(max(1e-9,1-x["p"])) for x in rows)
 up=[x for x in rows if x["underdog"] is not None]
 return {"games":n,"expected_favorite_wins":round(predicted,3),"actual_favorite_wins":outcome,
  "favorite_win_rate":frac(outcome,n),"predicted_favorite_win_rate":frac(predicted,n),
  "actual_upset_rate":frac(sum(x["underdog"] for x in up),len(up)),
  "expected_upset_rate":frac(sum(x["upset_p"] for x in up),len(up)),
  "brier":frac(brier,n),"log_loss":frac(ll,n),
  "favorite_wins_minus_expected":round(outcome-predicted,3)}
def betabin(x):
 p=x["p"]
 if p<.55:return "50–55%"
 if p<.60:return "55–60%"
 if p<.65:return "60–65%"
 if p<.70:return "65–70%"
 if p<.75:return "70–75%"
 if p<.80:return "75–80%"
 if p<.90:return "80–90%"
 return "90–100%"
def main():
 if not EVENTS.exists():raise SystemExit("Missing output/rating_events.csv; run full rating replay first.")
 selected=[]; excluded=defaultdict(int)
 with EVENTS.open(encoding="utf-8-sig",newline="") as fh:
  for row in csv.DictReader(fh):
   if row.get("level")!="regional" or row.get("season")!="autumn":continue
   year=str(row.get("year") or "")
   if not year.isdecimal() or int(year) not in SEASONS:continue
   if row.get("region") not in {"hokushinetsu","北信越"}:
    # Some region labels differ; accept a precise tournament name only.
    if "北信越" not in row.get("tournament",""):continue
   tournament=row.get("tournament","")
   if "北信越" not in tournament:continue
   a=fval(row.get("score1")); b=fval(row.get("score2"))
   p1=fval(row.get("team1_expected"))
   r1=fval(row.get("team1_rating_before"));r2=fval(row.get("team2_rating_before"))
   if a is None or b is None or p1 is None or r1 is None or r2 is None:
    excluded["missing_score_prediction_or_rating"]+=1;continue
   if a==b:
    excluded["draw"]+=1;continue
   if not 0<p1<1:
    excluded["invalid_probability"]+=1;continue
   # Rating favorite, not the team who actually won. For consistency
   # use predicted probability to define favorites after prefectural bias.
   if abs(p1-.5)<.0000001:
    excluded["even_odds"]+=1;continue
   favorite_is_first=p1>.5
   p=p1 if favorite_is_first else 1-p1
   won=(a>b) if favorite_is_first else (b>a)
   direction=1 if favorite_is_first else 2
   record={"year":int(year),"date":row.get("date",""),"tournament":tournament,
     "round":row.get("round",""),"round_group":rnd(row.get("round","")),
     "favorite":row.get(f"team{direction}",""),"opponent":row.get(f"team{3-direction}",""),
     "favorite_rating":r1 if favorite_is_first else r2,
     "opponent_rating":r2 if favorite_is_first else r1,
     "p":p,"actual":int(won),"underdog":int(not won),"upset_p":1-p,
     "match_key":row.get("match_key",""),"score":f"{int(a)}-{int(b)}"}
   selected.append(record)
 if not selected:raise SystemExit("No eligible Hokushinetsu autumn regional match predictions (2017–2025).")
 # Physical match duplicates could artificially improve or worsen calibration.
 unique={}; duplicates=[]
 for x in selected:
  k=x["match_key"] or (x["year"],x["tournament"],x["date"],x["round"],x["favorite"],x["opponent"],x["score"])
  if k in unique:
   duplicates.append(k)
  else:unique[k]=x
 selected=list(unique.values())
 by_tournament=defaultdict(list);by_round=defaultdict(list);by_year=defaultdict(list);by_bin=defaultdict(list)
 for x in selected:
  by_tournament[(x["year"],x["tournament"])].append(x)
  by_year[x["year"]].append(x)
  by_round[x["round_group"]].append(x)
  by_bin[betabin(x)].append(x)
 rng=random.Random(SEED)
 # Independent Bernoulli with observed match cards FIXED: detects discrepancies
 # in upset frequencies, not full tournament champion probabilities.
 simulated_upsets=[]
 for iteration in range(10000):
  simulated_upsets.append(sum(1 for x in selected if rng.random()<x["upset_p"]))
 simulated_upsets.sort()
 observed_upsets=sum(x["underdog"] for x in selected)
 n=len(selected)
 report={"title":"HS-BB-L 北信越秋季大会・現行予測モデル診断（試作版）",
  "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "source":"output/rating_events.csv / team1_expected (pre-match; school Rating+prefecture+matchup)",
  "scope":{"years":"2017–2025","hierarchy":"regional","season":"autumn","region":"北信越"},
  "method":"Retrospective pre-match probability calibration; observed fixtures only. NOT tournament bracket simulation.",
  "caveats":["Same-tournament earlier games may already influence subsequent pre-match ratings.",
   "This is not a pre-tournament frozen-rating championship simulation.",
   "2025 and earlier replay uses presently restored ledger; time-correctness and dataset coverage must be audited.",
   "Monte Carlo below fixes all observed cards and independently draws their winners; not a valid simulation of advancement.",
   "Favorite is defined by the CURRENT predicted probability, including prefecture compatibility.",
   "A match with missing scores, ratings or expected probability is excluded."],
  "overall":summarize(selected),
  "by_year":[{"year":yr,**summarize(rows)} for yr,rows in sorted(by_year.items())],
  "by_tournament":[{"year":yr,"tournament":name,**summarize(rows),
     "round_coverage":dict(sorted((k,sum(x["round_group"]==k for x in rows)) for k in {x["round_group"] for x in rows}))}
     for (yr,name),rows in sorted(by_tournament.items())],
  "by_round":[{"round":k,**summarize(v)} for k,v in sorted(by_round.items())],
  "calibration":[{"predicted_favorite_probability_bin":k,**summarize(v)} for k,v in sorted(by_bin.items())],
  "fixed_cards_monte_carlo":{"draws":10000,"seed":SEED,"actual_upsets":observed_upsets,
    "predicted_median_upsets":simulated_upsets[5000],
    "prediction_interval_95_upsets":[simulated_upsets[249],simulated_upsets[9750]],
    "note":"Fixed observed matchups: not a bracket or championship forecast."},
  "coverage":{"tournaments":len(by_tournament),"years":len(by_year),
    "discarded":dict(excluded),"duplicate_match_keys":len(duplicates)}}
 DEST.parent.mkdir(parents=True,exist_ok=True)
 DEST.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 cols=["year","date","tournament","round","round_group","favorite","opponent","favorite_rating","opponent_rating","p","actual","underdog","upset_p","score","match_key"]
 with TABLE.open("w",encoding="utf-8-sig",newline="") as fh:
  w=csv.DictWriter(fh,fieldnames=cols,extrasaction="ignore");w.writeheader();w.writerows(selected)
 print("PREDICTION_AUDIT",json.dumps({"overall":report["overall"],"coverage":report["coverage"],
  "by_round":report["by_round"],"monte_carlo":report["fixed_cards_monte_carlo"]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
