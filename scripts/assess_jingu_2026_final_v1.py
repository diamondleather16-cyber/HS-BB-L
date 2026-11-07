#!/usr/bin/env python3
"""Evaluate frozen Nov-07 Jingu 2026 forecasts AFTER 9 verified games.

Require manually confirmed match-ID, opponents and winner for all 9 fixtures,
in master/jingu_2026_verified_results.json. Never use match results to change
the baseline prediction or the frozen snapshot. Do not publish partial
results as a completed assessment.

Metrics:
  * Proper multiclass champion Brier score and champion negative log-loss.
  * Conditional game probabilities for each observed pair (school-only vs
    frozen pref-context approximation), mean Brier/log-loss across nine matches.
  * Semifinal/final progression calibration can be viewed against the immutable
    frozen pre-tournament probabilities; nine games is too small to tune K/volatility.
"""
from __future__ import annotations
import json, math, hashlib
from pathlib import Path
from datetime import datetime,timezone
from freeze_jingu_2026_prediction_v1 import calc_p

ROOT=Path(__file__).resolve().parents[1]
SNAP=ROOT/"docs/data/audit/jingu_2026_frozen_inputs_v1.json"
PRED=ROOT/"docs/data/audit/jingu_2026_prediction_frozen_v1.json"
RESULT=ROOT/"master/jingu_2026_verified_results.json"
OUT=ROOT/"docs/data/audit/jingu_2026_final_assessment_v1.json"
def main():
 if not RESULT.exists():raise SystemExit("No verified 9-game final results. Refusing to assess pre-tournament probabilities early.")
 snapshot=json.loads(SNAP.read_text(encoding="utf-8"))
 predictions=json.loads(PRED.read_text(encoding="utf-8"))
 actual=json.loads(RESULT.read_text(encoding="utf-8"))
 assert hashlib.sha256(SNAP.read_bytes()).hexdigest()==predictions["snapshot_sha256"],"Snapshot fingerprint mismatch"
 games=actual.get("games") or []
 if len(games)!=9:raise SystemExit(f"Require exactly nine games; received {len(games)}")
 fixtures={x["id"]:x for group in ("R1","QF","SF","F") for x in snapshot["fixture"][group]}
 if set(x.get("id") for x in games)!=set(fixtures):raise SystemExit("Fixture ID mismatch or duplicate")
 by_id={x["id"]:x for x in games}
 team={x["name"]:x for x in snapshot["teams"]}
 passed={}
 for group in ("R1","QF","SF","F"):
  for fx in snapshot["fixture"][group]:
   res=by_id[fx["id"]]
   a=passed.get(fx["a"],fx["a"]);b=passed.get(fx["b"],fx["b"])
   if set(res.get("teams") or [])!={a,b}:
    raise SystemExit(f"Opponents for {fx['id']} inconsistent with earlier winners: {res.get('teams')} vs {a}, {b}")
   w=res.get("winner")
   if w not in (a,b):raise SystemExit("Missing or invalid winner: "+fx["id"])
   passed[fx["id"]]=w
 champion=passed["F-1"]
 evaluations={};tables=[]
 for model in ("school","pref_pair"):
  byname={x["school"]:x for x in predictions["models"][model]["schools"]}
  pwin=max(1e-12,byname[champion]["champion_probability"])
  multiclass_brier=sum((byname[name]["champion_probability"]-int(champion==name))**2 for name in team)
  losses=[];bs=[];upsets=0;expected_upsets=0
  for fx in [x for group in ("R1","QF","SF","F") for x in snapshot["fixture"][group]]:
   res=by_id[fx["id"]]
   a,b=res["teams"]
   p,_=calc_p(a,b,team,snapshot,model)
   y=int(res["winner"]==a)
   bs.append((p-y)**2);losses.append(-y*math.log(max(1e-12,p))-(1-y)*math.log(max(1e-12,1-p)))
   upsets+=int(y!=(p>=.5));expected_upsets+=min(p,1-p)
   tables.append({"model":model,"fixture":fx["id"],"date":fx["date"],"team1":a,"team2":b,
                  "winner":res["winner"],"prob_team1":round(p,6),"winner_probability":round(p if y else 1-p,6),
                  "brier":round(bs[-1],6)})
  evaluations[model]={"champion":champion,"champion_ex_ante_probability":round(pwin,6),
   "champion_multiclass_brier":round(multiclass_brier,6),
   "champion_log_loss":round(-math.log(pwin),6),
   "game_mean_brier":round(sum(bs)/9,6),"game_mean_log_loss":round(sum(losses)/9,6),
   "actual_upset_games":upsets,"expected_upset_games_conditional":round(expected_upsets,4),
   "n_games":9}
 outcome={"title":"第57回明治神宮大会 事前予測と実結果の照合",
    "created_at_utc":datetime.now(timezone.utc).isoformat(),
    "snapshot_sha256":predictions["snapshot_sha256"],"source_result_provenance":actual.get("sources",[]),
    "freeze_date_jst":snapshot["frozen_on_jst"],
    "actual_champion":champion,"metrics":evaluations,"games":tables,
    "interpretation_limitations":["Nine games are insufficient for definitive conclusions about a volatility coefficient.",
       "Conditional game Brier evaluates the actual observed pair, whereas ex-ante champion score evaluates original bracket forecast.",
       "This is a model comparison. Actual results are prohibited from updating the saved prediction.",
       "The pref_pair model omits school's direct head-to-head rematch adjustment." ]}
 if OUT.exists():raise SystemExit("Final assessment already exists: refuse unreviewed overwrite")
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(outcome,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("JINGU_2026_FINAL_ASSESSMENT",json.dumps(evaluations,ensure_ascii=False))
if __name__=="__main__":main()
