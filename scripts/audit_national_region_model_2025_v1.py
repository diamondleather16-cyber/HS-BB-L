#!/usr/bin/env python3
"""National inter-region games: decompose existing corrections and test regional offsets.

No rating, match ledger or model coefficients are changed. Uses replay-saved,
pre-match rating and prefecture-context components. Fits a regularized regional
offset ONLY on 2017-2024 national inter-region games and tests on 2025.
This is a retrospective coefficient holdout, NOT a live/pure future-blind
replay: historic inputs were rebuilt from today's restored ledger.
"""
from __future__ import annotations
import csv, json, math, re
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
EVENTS=ROOT/"output/rating_events.csv"
MASTER=ROOT/"master/school_master_shared.json"
OUT=ROOT/"docs/data/audit/national_region_model_2025_v1.json"
REGIONS=["北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州"]
PREFS={
"北海道":"北海道","北北海道":"北海道","南北海道":"北海道",
"青森":"東北","岩手":"東北","宮城":"東北","秋田":"東北","山形":"東北","福島":"東北",
"茨城":"関東","栃木":"関東","群馬":"関東","埼玉":"関東","千葉":"関東","神奈川":"関東","山梨":"関東",
"東京":"東京","東東京":"東京","西東京":"東京",
"新潟":"北信越","富山":"北信越","石川":"北信越","福井":"北信越","長野":"北信越",
"静岡":"東海","愛知":"東海","岐阜":"東海","三重":"東海",
"滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
"鳥取":"中国","島根":"中国","岡山":"中国","広島":"中国","山口":"中国",
"徳島":"四国","香川":"四国","愛媛":"四国","高知":"四国",
"福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州","宮崎":"九州","鹿児島":"九州","沖縄":"九州"}
def number(v):
 try:
  x=float(v)
  return x if math.isfinite(x) else None
 except (ValueError,TypeError):return None
def pref_clean(s):
 s=str(s or "").strip()
 return s[:-1] if s.endswith(("県","府")) else s
def region_for(pref,from_master):
 p=pref_clean(pref)
 if p in PREFS:return PREFS[p]
 r=str(from_master or "")
 if "関東" in r:return "関東"
 if "北信越" in r:return "北信越"
 for k in REGIONS:
  if k in r:return k
 return None
def load_master():
 obj=json.loads(MASTER.read_text(encoding="utf-8-sig"))
 return {str(s["school_id"]):s for s in obj.get("schools",[]) if s.get("school_id")}
def elo(a,b):
 z=max(-12,min(12,(b-a)/400))
 return 1/(1+10**z)
def p_for(x,mode,offsets=None):
 r1=x["r1"];r2=x["r2"]
 if mode in ("pref","pair","full","region"):
  r1+=x["pc1"];r2+=x["pc2"]
 if mode in ("pair","full","region"):
  r1+=x["mc1"];r2+=x["mc2"]
 if mode=="region" and offsets:
  r1+=offsets[x["g1"]];r2+=offsets[x["g2"]]
 p=elo(r1,r2)
 if mode in ("full","region"):
  p=max(.03,min(.97,p+x["school_bias"]))
 return p
def metrics(rows,mode,offsets=None):
 if not rows:return {"n":0,"brier":None,"log_loss":None,"winner_accuracy":None,"actual_favorite_wins":None,"expected_favorite_wins":None}
 bs=ll=fw=fe=0.
 for x in rows:
  p=p_for(x,mode,offsets);y=x["y"]
  bs+=(p-y)**2;ll-=y*math.log(max(1e-12,p))+(1-y)*math.log(max(1e-12,1-p))
  fw+=int((p>=.5)==bool(y));fe+=max(p,1-p)
 n=len(rows)
 return {"n":n,"brier":round(bs/n,6),"log_loss":round(ll/n,6),"winner_accuracy":round(fw/n,5),
         "actual_favorite_wins":round(fw,2),"expected_favorite_wins":round(fe,2)}
def bundle(rows,offsets):
 return {k:metrics(rows,k,offsets) for k in ("school","pref","pair","full","region")}
def train_offsets(train,prior_sd):
 """Penalized log-loss = sum log-loss + sum(offset²)/(2*prior_sd²).

 Use full pref/pair/school-bias baseline and fit only *new* regional offsets.
 Equivalent to a regularized logistic intercept per region, in Elo pts.
 """
 d={g:0. for g in REGIONS};slope=math.log(10)/400.
 if not train:return d
 for _ in range(1000):
  grads={g:d[g]/(prior_sd*prior_sd) for g in REGIONS}
  for x in train:
   p=p_for(x,"region",d)
   err=(p-x["y"])*slope
   grads[x["g1"]]+=err;grads[x["g2"]]-=err
  # Limited gradient-descent step; numerically stable over 10 regions.
  for g in REGIONS:d[g]=max(-100.,min(100.,d[g]-100.*grads[g]))
  m=sum(d.values())/len(d)
  for g in REGIONS:d[g]-=m
 return d
def main():
 master=load_master()
 chosen=[];discard=defaultdict(int);seen=set();years=defaultdict(int)
 with EVENTS.open(encoding="utf-8-sig",newline="") as f:
  for r in csv.DictReader(f):
   if str(r.get("level"))!="national":continue
   try:year=int(r.get("year") or 0)
   except ValueError:continue
   if not 2017<=year<=2025:continue
   key=str(r.get("match_key") or "")
   if key in seen:discard["duplicate_match_key"]+=1;continue
   seen.add(key)
   keys=["score1","score2","team1_rating_before","team2_rating_before",
         "pref_strength_component1","pref_strength_component2",
         "matchup_component1","matchup_component2","school_matchup_bias_prob","team1_expected"]
   vs={k:number(r.get(k)) for k in keys}
   if any(vs[k] is None for k in keys):discard["missing_required_field"]+=1;continue
   if vs["score1"]==vs["score2"]:discard["draw"]+=1;continue
   names=[]
   for i in (1,2):
    meta=master.get(str(r.get(f"team{i}_school_id") or ""),{})
    p=str(meta.get("prefecture") or r.get(f"team{i}_prefecture") or "").strip()
    names.append(region_for(p,meta.get("region")))
   if not all(names):discard["unmapped_region"]+=1;continue
   if names[0]==names[1]:discard["same_region"]+=1;continue
   x={"year":year,"tournament":str(r.get("tournament") or ""),"season":str(r.get("season") or ""),
      "round":str(r.get("round") or ""),"g1":names[0],"g2":names[1],
      "y":int(vs["score1"]>vs["score2"]),"r1":vs["team1_rating_before"],"r2":vs["team2_rating_before"],
      "pc1":vs["pref_strength_component1"],"pc2":vs["pref_strength_component2"],
      "mc1":vs["matchup_component1"],"mc2":vs["matchup_component2"],
      "school_bias":vs["school_matchup_bias_prob"],"saved_p":vs["team1_expected"]}
   predicted=p_for(x,"full")
   if abs(predicted-x["saved_p"])>.00015:
    raise SystemExit(f"Expected-probability replay mismatch: {key}: {predicted}, {x['saved_p']}")
   chosen.append(x);years[year]+=1
 if not chosen:raise SystemExit("No national inter-region games")
 train=[x for x in chosen if x["year"]<2025];test=[x for x in chosen if x["year"]==2025]
 if len(test)<10:raise SystemExit(f"Insufficient 2025 national interregion coverage ({len(test)} games)")
 # Keep tuning fully independent of 2025; train strength chosen on train only.
 sd_grid=(8.,12.,20.,30.)
 fits=[]
 for sd in sd_grid:
  offsets=train_offsets(train,sd)
  fits.append((metrics(train,"region",offsets)["brier"],sd,offsets))
 fits.sort(key=lambda x:(x[0],x[1]))
 training_brier,prior_sd,offsets=fits[0]
 by_year=[];by_region=[];by_tournament=[];by_pair=[]
 for yr in sorted(years):
  rr=[x for x in chosen if x["year"]==yr]
  by_year.append({"year":yr,"models":bundle(rr,offsets)})
 for g in REGIONS:
  tr=[x for x in train if g in (x["g1"],x["g2"])]
  te=[x for x in test if g in (x["g1"],x["g2"])]
  if tr or te:
   base_err=sum((x["y"] if x["g1"]==g else 1-x["y"])-(x["saved_p"] if x["g1"]==g else 1-x["saved_p"]) for x in te)
   by_region.append({"region":g,"fit_offset_points":round(offsets[g],3),
      "train_games":len(tr),"test_2025_games":len(te),
      "test_actual_minus_expected_wins":round(base_err,3),
      "train":bundle(tr,offsets),"test_2025":bundle(te,offsets)})
 grouped=defaultdict(list)
 for x in test:grouped[x["season"],x["tournament"]].append(x)
 for (season,tourn),rows in sorted(grouped.items()):
  by_tournament.append({"season":season,"tournament":tourn,"games":len(rows),"models":bundle(rows,offsets)})
 pairs=defaultdict(list)
 for x in chosen:pairs[tuple(sorted([x["g1"],x["g2"]]))].append(x)
 for (g1,g2),rows in sorted(pairs.items()):
  tr=[x for x in rows if x["year"]<2025];te=[x for x in rows if x["year"]==2025]
  by_pair.append({"region1":g1,"region2":g2,"train_games":len(tr),"test_2025_games":len(te),
      "test":bundle(te,offsets)})
 result={"title":"全国大会での地区間水準差・県補正・県相性の検証",
    "generated_at":datetime.now(timezone.utc).isoformat(),
    "scope":"2017–2024: region correction training; 2025: validation. National games between distinct regions.",
    "models":{"school":"学校Ratingのみ","pref":"学校Rating＋県水準",
      "pair":"学校Rating＋県水準＋県同士の相性",
      "full":"現行式（＋学校相性）",
      "region":"現行式＋地区別レーティング偏差（試験的・ランキング変更なし）"},
    "limitations":["Current rating-event history was retrospectively replayed from recovered source; calibration year-split is NOT a fully prospective prediction.",
      "Region offsets are estimated only from past national inter-region contests and cannot assert intrinsic historical region strengths.",
      "Full model components were frozen at each actual game; hypothetical bracket pairings need separately frozen contexts.",
      "If regional sample is sparse, penalized offsets shrink toward zero. Any improvement must be reproduced across years.",
      "Tokyo is separate from Kanto by school prefecture. Hokkaido is one geographic region despite northern/southern representative areas.",
      "Scores are on the same games for every model, with no changes to the school-rating calculations."],
    "coverage":{"total_games":len(chosen),"train_games":len(train),"test_2025_games":len(test),
      "year_counts":dict(sorted(years.items())),"excluded":dict(discard)},
    "region_fit":{"regularization_prior_sd_points":prior_sd,
      "prior_sd_candidates":list(sd_grid),"offset_points":{g:round(offsets[g],4) for g in REGIONS},
      "training_brier":training_brier},
    "total":{"train":bundle(train,offsets),"test_2025":bundle(test,offsets)},
    "years":by_year,"regions":by_region,"tournaments_2025":by_tournament,
    "region_pairs":by_pair}
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("NATIONAL_REGION_MODEL",json.dumps({"coverage":result["coverage"],"total":result["total"],
   "fit":result["region_fit"],"regions":[{"region":r["region"],"n":r["test_2025_games"],
    "err":r["test_actual_minus_expected_wins"]} for r in by_region]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
