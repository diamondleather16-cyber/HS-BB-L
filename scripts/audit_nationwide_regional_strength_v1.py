#!/usr/bin/env python3
"""Nationwide autumn regional-tournament strength and regional/prefecture prediction diagnostics.

READ ONLY: Use actual pre-match rating events. Avoid future-match leakage.
Measure (a) school-rating entrant distributions at first regional appearance,
(b) held-out-style pre-match calibration by region and prefecture, and
(c) changes in Brier/log-loss between school-only, school+pref, current full.
No coefficient adjustments / no re-rating / no assumed match results.
"""
from __future__ import annotations
import csv, json, math, re, statistics
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
SRC=BASE/"output/rating_events.csv"
MASTER=BASE/"master/school_master_shared.json"
OUT=BASE/"docs/data/audit/nationwide_regional_strength_v1.json"
YEARS=range(2017,2026)
REGIONS={"hokkaido":"北海道","tohoku":"東北","kanto":"関東","kanto_tokyo":"関東","hokushinetsu":"北信越",
"tokai":"東海","kinki":"近畿","chugoku":"中国","shikoku":"四国","kyushu":"九州"}
REGION_ORDER=["北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州"]

def val(x):
 try:
  y=float(x)
  return y if math.isfinite(y) else None
 except (ValueError,TypeError): return None
def prob(a,b):
 z=max(-600,min(600,(b-a)/400))
 return 1/(1+10**z)
def brief(rows):
 n=len(rows)
 if not n:return {"matches":0,"brier":None,"log_loss":None,"observed_favorite_win_rate":None,"predicted_favorite_win_rate":None}
 # All models predict team1 win: consistent outcome orientation.
 return {"matches":n,"brier":round(sum((x["actual"]-x["p"])**2 for x in rows)/n,6),
  "log_loss":round(-sum(x["actual"]*math.log(max(1e-12,x["p"]))+(1-x["actual"])*math.log(max(1e-12,1-x["p"])) for x in rows)/n,6)}
def summary(rows):
 if not rows:return {"games":0}
 allratings=[t["rating"] for t in rows]
 sr=sorted(allratings,reverse=True)
 return {"entrants":len(rows),"mean":round(statistics.mean(allratings),2),
  "median":round(statistics.median(allratings),2),
  "top4_mean":round(statistics.mean(sr[:4]),2),
  "top8_mean":round(statistics.mean(sr[:8]),2),
  "bottom_quartile_mean":round(statistics.mean(sorted(sr)[:max(1,len(sr)//4)]),2),
  "stddev":round(statistics.pstdev(sr),2)}
def region_of(row):
 t=str(row.get("tournament") or "")
 raw=str(row.get("region") or "").lower().strip()
 # Tokyo is an independent competition; do not confuse '関東・東京' region with Tokyo event.
 if re.search("東京",t) and not re.search("関東",t):return "東京"
 if "関東" in t:return "関東"
 for v in REGION_ORDER:
  if v in ("関東","東京"):continue
  if v in t:return v
 if raw in REGIONS:return REGIONS[raw]
 return None
def load_schools():
 if not MASTER.exists():return {}
 obj=json.loads(MASTER.read_text(encoding="utf-8-sig"))
 return {str(s.get("school_id")):s.get("prefecture") for s in obj.get("schools",[]) if s.get("school_id")}
def main():
 if not SRC.exists():raise SystemExit("Need output/rating_events.csv; run main rating workflow first")
 schools=load_schools()
 matches=[]; entrants={}; missing=defaultdict(int);seen=set()
 with SRC.open(encoding="utf-8-sig",newline="") as f:
  for row in csv.DictReader(f):
   if str(row.get("season"))!="autumn" or str(row.get("level"))!="regional":continue
   try:y=int(row.get("year") or "0")
   except ValueError:continue
   if y not in YEARS:continue
   region=region_of(row)
   if not region:
    missing["unclassified_region"]+=1;continue
   t=row.get("tournament") or ""
   # Exclude prefectural tournaments even if they contain region-name words.
   if not any(w in t for w in ("北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州")):
    missing["unrecognized_tournament_name"]+=1;continue
   ident=row.get("match_key") or (str(y)+"|"+t+"|"+row.get("team1","")+"|"+row.get("team2",""))
   if ident in seen:
    missing["duplicate_fixture"]+=1;continue
   seen.add(ident)
   s1=val(row.get("score1"));s2=val(row.get("score2"));r1=val(row.get("team1_rating_before"));r2=val(row.get("team2_rating_before"))
   pfull=val(row.get("team1_expected"))
   if None in (s1,s2,r1,r2,pfull):
    missing["missing_score_or_rating"]+=1;continue
   if s1==s2:
    missing["draw"]+=1;continue
   if not 0<pfull<1:
    missing["bad_probability"]+=1;continue
   pschool=prob(r1,r2)
   pc1=val(row.get("pref_strength_component1")) or 0.
   pc2=val(row.get("pref_strength_component2")) or 0.
   ppref=prob(r1+pc1,r2+pc2)
   p1=schools.get(str(row.get("team1_school_id") or ""))
   p2=schools.get(str(row.get("team2_school_id") or ""))
   # Historical school IDs can be absent; never guess prefectures.
   record={"year":y,"region":region,"tournament":t,"date":str(row.get("date") or ""),
      "team1":row.get("team1") or "","team2":row.get("team2") or "",
      "school1":str(row.get("team1_school_id") or ""), "school2":str(row.get("team2_school_id") or ""),
      "pref1":p1,"pref2":p2,"r1":r1,"r2":r2,"actual":1 if s1>s2 else 0,
      "p_school":pschool,"p_pref":ppref,"p_full":pfull,
      "match_key":ident}
   matches.append(record)
   # Distinct schools by school ID; fallback to exact name WITHIN tournament.
   key=(y,region,t)
   for ix in (1,2):
    team=record[f"team{ix}"]
    if not team:continue
    sid=record[f"school{ix}"] or "name:"+team
    eid=(key,sid)
    candidate={"team":team,"school_id":sid,"prefecture":record[f"pref{ix}"],
      "rating":record[f"r{ix}"],"date":record["date"],"first_seen_match":ident}
    if eid not in entrants or (record["date"] and record["date"]<entrants[eid]["date"]):
     entrants[eid]=candidate
 if not matches:raise SystemExit("No eligible nationwide autumn regional matches")
 annual=defaultdict(list);by_region=defaultdict(list);by_pref=defaultdict(list);cross_pref=defaultdict(list)
 for x in matches:
  annual[x["year"],x["region"],x["tournament"]].append(x)
  by_region[x["region"]].append(x)
  if x["pref1"] and x["pref2"] and x["pref1"]!=x["pref2"]:
   cross_pref[x["region"]].append(x)
   by_pref[x["pref1"]].append((x,x["actual"]))
   by_pref[x["pref2"]].append((x,1-x["actual"]))
  else:missing["cannot_compare_inter_pref"]+=1
 entrants_by=defaultdict(list)
 for (event,sid),v in entrants.items():entrants_by[event].append(v)
 tournaments=[]
 for key,ev in sorted(annual.items()):
  participants=entrants_by[key]
  dist=summary(participants)
  tournaments.append({"year":key[0],"region":key[1],"tournament":key[2],
    "games":len(ev),**dist,
    "school_only_brier":brief([{"p":x["p_school"],"actual":x["actual"]} for x in ev])["brier"],
    "current_brier":brief([{"p":x["p_full"],"actual":x["actual"]} for x in ev])["brier"],
    "coverage_note":"Tournament participant ratings are captured at FIRST recorded regional match; not necessarily frozen simultaneously before opening."})
 regions=[]
 for region in REGION_ORDER:
  rows=by_region.get(region,[])
  if not rows:continue
  tr=[t for t in tournaments if t["region"]==region]
  school=brief([{"p":x["p_school"],"actual":x["actual"]} for x in rows])
  pref=brief([{"p":x["p_pref"],"actual":x["actual"]} for x in rows])
  full=brief([{"p":x["p_full"],"actual":x["actual"]} for x in rows])
  cr=cross_pref.get(region,[])
  crossS=brief([{"p":x["p_school"],"actual":x["actual"]} for x in cr])
  crossP=brief([{"p":x["p_pref"],"actual":x["actual"]} for x in cr])
  crossF=brief([{"p":x["p_full"],"actual":x["actual"]} for x in cr])
  regions.append({"region":region,"games":len(rows),"inter_pref_games":len(cr),"tournaments":len(tr),
    "mean_entrant_rating":round(statistics.mean(t["mean"] for t in tr),2) if tr else None,
    "mean_top4_rating":round(statistics.mean(t["top4_mean"] for t in tr),2) if tr else None,
    "mean_top8_rating":round(statistics.mean(t["top8_mean"] for t in tr),2) if tr else None,
    "school_only":school,"school_plus_pref":pref,"full_current":full,
    "inter_pref":{"school_only":crossS,"school_plus_pref":crossP,"full_current":crossF},
    "full_minus_school_brier":round(full["brier"]-school["brier"],6),
    "full_minus_school_inter_pref_brier":round(crossF["brier"]-crossS["brier"],6) if cr else None})
 prefectures=[]
 for p,entries in sorted(by_pref.items()):
  n=len(entries)
  if n==0:continue
  residual=sum(a-x["p_full"] if x["pref1"]==p else a-(1-x["p_full"]) for x,a in entries)
  variance=sum((x["p_full"] if x["pref1"]==p else 1-x["p_full"])*(1-(x["p_full"] if x["pref1"]==p else 1-x["p_full"])) for x,a in entries)
  prefectures.append({"prefecture":p,"inter_pref_games":n,
    "actual_wins":sum(a for x,a in entries),
    "expected_wins":round(sum(x["p_full"] if x["pref1"]==p else 1-x["p_full"] for x,a in entries),3),
    "win_residual":round(residual,3),
    "z_reference":round(residual/math.sqrt(variance),3) if variance else None,
    "note":"Z is a heuristic (opponents/events are dependent), NOT a significance test."})
 report={"title":"全国秋季地区大会・競争水準と県補正の予測寄与（診断版）",
  "generated_at":datetime.now(timezone.utc).isoformat(),
  "scope":{"years":"2017-2025","season":"autumn","level":"regional","region_count":len(regions)},
  "method":{"strength":"School Rating at first recorded game per tournament; averages of tournament means, not team-strength estimates corrected for seeding.",
    "A":"Rating-only expected win probability",
    "B":"School Rating + prefecture strength component, no matchup component",
    "C":"Current saved pre-match expected win probability, including prefecture matchup and school rematch if active",
    "prediction_metric":"Brier score and log-loss (lower is better). Positive full_minus_school_brier means full model worse.",
    "validation":"In-sample retrospective pre-match replay, NOT genuinely held-out seasons; no causal claims. Historical match and prior coverage varies.",
    "inter_pref":"Only opposing schools mapped to distinct prefectures; incomplete school IDs are excluded.",
    "area_notes":"Tokyo competitions separated when tournament title denotes Tokyo; Kanto is a separate group. Hokkaido treated as a single region."},
  "regions":regions,"tournaments":tournaments,"prefectures":prefectures,
  "coverage":{"matches":len(matches),"tournaments":len(tournaments),"regions":len(regions),
    "inter_pref_matches":sum(len(a) for a in cross_pref.values()),"discarded_or_unmapped":dict(missing)}}
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("NATIONAL_REGION_AUDIT",json.dumps({"coverage":report["coverage"],"regions":[{"region":r["region"],"games":r["games"],"mean_entrant_rating":r["mean_entrant_rating"],"mean_top4_rating":r["mean_top4_rating"],"brier_school":r["school_only"]["brier"],"brier_full":r["full_current"]["brier"]} for r in regions]},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
