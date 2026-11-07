#!/usr/bin/env python3
"""Compare prefecture rating and prefecture matchup separately on fall regional games.

Read-only diagnostic. The pre-match R and context components are sourced from
the historical rating replay, and are NOT recomputed from the 2025 games to
fit weights. Fit optional shrink factors using 2017-2024 only, evaluate on
2025 matches. Raw pre-match prefecture components may themselves have been
replayed retrospectively using recovered historic data, so this is a temporal
holdout of the CALIBRATION COEFFICIENTS, not a proof of true live out-of-sample
accuracy. No existing rating or probability file is changed.
"""
from __future__ import annotations
import csv, json, math, re
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[1]
IN=ROOT/"output/rating_events.csv"
OUT=ROOT/"docs/data/audit/prefecture_ablation_2025_v1.json"
REGION_NAME={"hokkaido":"北海道","tohoku":"東北","kanto":"関東","kanto_tokyo":"関東","hokushinetsu":"北信越",
"tokai":"東海","kinki":"近畿","chugoku":"中国","shikoku":"四国","kyushu":"九州"}
REGIONS=["北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州"]

def num(v):
 try:
  n=float(v)
  return n if math.isfinite(n) else None
 except (ValueError,TypeError):return None

def region(row):
 t=str(row.get("tournament") or "")
 if "東京" in t and "関東" not in t:return "東京"
 if "関東" in t:return "関東"
 for name in REGIONS:
  if name in ("東京","関東"):continue
  if name in t:return name
 return REGION_NAME.get(str(row.get("region") or "").lower())

def elo(a,b):
 z=max(-12,min(12,(b-a)/400.))
 return 1/(1+10**z)

def predicted(x,pref_weight=1.,match_weight=1.,school_bias=False):
 p=elo(x["r1"]+pref_weight*x["pref1"]+match_weight*x["match1"],
       x["r2"]+pref_weight*x["pref2"]+match_weight*x["match2"])
 if school_bias:p=max(.03,min(.97,p+x["head_to_head_bias"]))
 return p

def metrics(rows,model):
 if not rows:return {"n":0,"brier":None,"log_loss":None,"favorite_actual":None,"favorite_expected":None}
 errors=[]; losses=[]; favorites=[]; fav_probs=[]
 for x in rows:
  p=predicted(x,*model[:2],school_bias=model[2])
  y=x["y"]
  errors.append((p-y)**2)
  losses.append(-y*math.log(max(1e-12,p))-(1-y)*math.log(max(1e-12,1-p)))
  favorites.append(y if p>=.5 else 1-y)
  fav_probs.append(max(p,1-p))
 return {"n":len(rows),"brier":round(sum(errors)/len(errors),6),
         "log_loss":round(sum(losses)/len(losses),6),
         "favorite_actual":round(sum(favorites)/len(rows),5),
         "favorite_expected":round(sum(fav_probs)/len(rows),5)}

def best_weight(train,param):
 # Tune one additional coefficient at a time. Fixed deterministic grid.
 candidates=[0,.25,.5,.75,1.,1.25,1.5]
 scores=[]
 for w in candidates:
  model=(w,0,False) if param=="pref" else (1,w,False)
  result=metrics(train,model)
  scores.append((result["brier"],abs(w-1.),w))
 return min(scores)[2],scores

def main():
 if not IN.exists():raise SystemExit("Missing output/rating_events.csv; run the rating replay.")
 rows=[]; seen=set();discard=defaultdict(int); present=defaultdict(int)
 with IN.open(encoding="utf-8-sig",newline="") as f:
  for raw in csv.DictReader(f):
   if raw.get("season")!="autumn" or raw.get("level")!="regional":continue
   try:y=int(raw.get("year") or 0)
   except ValueError:continue
   if not 2017<=y<=2025:continue
   r=region(raw)
   if r not in REGIONS:discard["region_unclassified"]+=1;continue
   tournament=str(raw.get("tournament") or "")
   if not any(k in tournament for k in REGIONS):discard["not_regional_tournament"]+=1;continue
   key=raw.get("match_key") or ("|".join(str(raw.get(k) or "") for k in ("year","tournament","date","team1","score1","team2","score2")))
   if key in seen:discard["duplicate"]+=1;continue
   seen.add(key)
   fields=["team1_rating_before","team2_rating_before","pref_strength_component1",
           "pref_strength_component2","matchup_component1","matchup_component2",
           "team1_expected","school_matchup_bias_prob","score1","score2"]
   values={k:num(raw.get(k)) for k in fields}
   if any(values[k] is None for k in ("team1_rating_before","team2_rating_before","team1_expected","score1","score2")):
    discard["missing_core"]+=1;continue
   if values["score1"]==values["score2"]:discard["draw"]+=1;continue
   if any(values[k] is None for k in fields[2:6]):
    discard["missing_components"]+=1;continue
   x={"year":y,"region":r,"key":key,
      "r1":values["team1_rating_before"],"r2":values["team2_rating_before"],
      "pref1":values["pref_strength_component1"],"pref2":values["pref_strength_component2"],
      "match1":values["matchup_component1"],"match2":values["matchup_component2"],
      "head_to_head_bias":values["school_matchup_bias_prob"] or 0.,
      "saved_current":values["team1_expected"],"y":1 if values["score1"]>values["score2"] else 0}
   rows.append(x);present[y]+=1
 if not rows:raise SystemExit("No eligible fall regional events")
 named_models={"A_school_only":(0,0,False),"B_plus_pref":(1,0,False),
               "C_plus_pref_and_pref_matchup":(1,1,False),"D_saved_current_formula":(1,1,True)}
 def bundle(rr):
  ans={name:metrics(rr,spec) for name,spec in named_models.items()}
  pref_active=sum(1 for x in rr if abs(x["pref1"]-x["pref2"])>1e-8)
  matchup_active=sum(1 for x in rr if abs(x["match1"]-x["match2"])>1e-8)
  school_active=sum(1 for x in rr if abs(x["head_to_head_bias"])>1e-8)
  ans["component_coverage"]={"pref_difference_nonzero_games":pref_active,
                             "matchup_difference_nonzero_games":matchup_active,
                             "school_rematch_nonzero_games":school_active,
                             "pref_difference_nonzero_share":round(pref_active/len(rr),4) if rr else None,
                             "matchup_difference_nonzero_share":round(matchup_active/len(rr),4) if rr else None}
  if rr:
   base=ans["A_school_only"]["brier"]
   for key in named_models:ans[key]["delta_brier_vs_A"]=round(ans[key]["brier"]-base,6)
  return ans
 train=[x for x in rows if x["year"]<=2024]
 test=[x for x in rows if x["year"]==2025]
 wp,trace_pref=best_weight(train,"pref")
 wm,trace_match=best_weight(train,"matchup")
 tuned={"pref_weight":wp,"match_weight":wm,
        "train_pref_weight_only":metrics(train,(wp,0,False)),
        "test_pref_weight_only":metrics(test,(wp,0,False)),
        "train_matchup_weight_only":metrics(train,(1,wm,False)),
        "test_matchup_weight_only":metrics(test,(1,wm,False))}
 # Explicit verification: stored full expected probability may have other mechanics.
 drift=[abs(predicted(x,1,1,True)-x["saved_current"]) for x in rows]
 if max(drift)>.00015:
  raise SystemExit(f"Replay model disagrees with saved expected probability, maximum error {max(drift):.6f}; do not publish a false ablation.")
 result={"title":"県水準補正と県相性の個別寄与・2025年検証",
 "generated_at":datetime.now(timezone.utc).isoformat(),
 "scope":{"train":"2017–2024","holdout":"2025","hierarchy":"regional","season":"autumn"},
 "models":{"A_school_only":"学校Ratingのみ",
   "B_plus_pref":"A＋県レーティング補正のみ",
   "C_plus_pref_and_pref_matchup":"B＋県同士の対戦相性",
   "D_saved_current_formula":"C＋学校個別の過去対戦相性（現行期待勝率）"},
 "methodology":["同一試合の開始直前Ratingと県補正成分を使用し、係数の比較対象を揃える。",
   "2017–2024年の平均Brierが最良の重みを事前に選択し、2025年には再調整せず適用。",
   "2025年の勝敗は補正係数の選択に使用していない。",
   "県補正が0の試合はA・B・Cの比較が無意味になりうる。モデル成分が非ゼロの試合件数を必ず確認する。",
   "県補正成分・県相性成分自体は現行再計算の履歴に依存するため、完全な未来情報遮断を保証するものではない。",
   "対戦相性の補正は既存のモデル値。データの少ない組合せでは既存縮小則が適用される。",
   "2017–2024年の台帳・Rating履歴が未完全の場合、校正結果にはデータ偏りが含まれる。",
   "過去の保存確率との突合せ誤差が0.00015を超えたら失敗して公表しない。"],
 "coverage":{"total_games":len(rows),"train_games":len(train),"holdout_2025_games":len(test),
             "years":dict(sorted(present.items())),"excluded":dict(discard),
             "max_formula_replay_absolute_difference":round(max(drift),8)},
 "total":{"train":bundle(train),"test_2025":bundle(test)},
 "regions":[],
 "tuned_weights_from_train":tuned,
 "tuning_grid":[0,.25,.5,.75,1.,1.25,1.5]}
 for r in REGIONS:
  rr=[x for x in rows if x["region"]==r]
  if not rr:continue
  rt=[x for x in rr if x["year"]<=2024];rv=[x for x in rr if x["year"]==2025]
  result["regions"].append({"region":r,"train":bundle(rt),"test_2025":bundle(rv),
                            "train_games":len(rt),"test_2025_games":len(rv)})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("PREF_ABLATION",json.dumps({"coverage":result["coverage"],"total":result["total"],
       "tuned_weights":tuned,"regions":[{"region":x["region"],"n2025":x["test_2025_games"],
       "A":x["test_2025"]["A_school_only"]["brier"],
       "B":x["test_2025"]["B_plus_pref"]["brier"],
       "C":x["test_2025"]["C_plus_pref_and_pref_matchup"]["brier"],
       "D":x["test_2025"]["D_saved_current_formula"]["brier"]} for x in result["regions"]]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
