#!/usr/bin/env python3
"""Trial a missing prefectural tournament against live source, but never publish rows.

Validates provenance, tournament identity, dates and scores; tests dedupe in a
temporary directory. Successful trial only authorizes subsequent review.
"""
import csv,json,re,sys,tempfile
from pathlib import Path
from collections import Counter
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

URL="https://koshien89.com/blog-entry-3447.html"
YEAR="2025"
SEASON="spring"
PREF="岐阜"
OUT=Path("output/audit/pilot_new_gifu_2025_spring.json")

def main():
 report={"url":URL,"expected":{"prefecture":PREF,"year":YEAR,"season":SEASON},
         "source_status":"not_fetched","published":False,"data_changed":False}
 try:
  req={"source_url":URL,"year":YEAR,"season":SEASON,"prefecture":PREF,
       "locked_prefecture":PREF,"region":"東海","level":"prefecture",
       "tournament":"春季岐阜大会2025","batch_auto_metadata":False}
  raw,warnings=imp.analyze(req)
  rows=imp.normalize_approved_rows(raw,"prefecture")
  report["source_status"]="parsed"
  report["parsed_count"]=len(rows)
  report["warnings"]=warnings[:20]
  report["metadata"]={k:req.get(k) for k in ("year","season","prefecture","level","tournament","detected_title")}
  problems=[]
  seen=set()
  for i,row in enumerate(rows):
   if str(row.get("year"))!=YEAR or row.get("season")!=SEASON:problems.append([i,"wrong_period"])
   if str(row.get("prefecture"))!=PREF:problems.append([i,"wrong_prefecture"])
   if imp._import_identity(row) is None:problems.append([i,"unidentifiable_game"])
   sig=imp._import_identity(row)
   if sig in seen:problems.append([i,"duplicate_in_article"])
   if sig:seen.add(sig)
  report["problems"]=problems[:100]
  report["problem_count"]=len(problems)
  report["rounds"]=dict(Counter(str(r.get("round") or "") for r in rows))
  report["final_round_samples"]=[{k:r.get(k) for k in ("round","date","team1","score1","team2","score2")} for r in rows if str(r.get("round") or "") in ("決勝","準決勝","3位決定戦","準々決勝")]
  # A normal single-elimination semifinal has two matches.
  required={"決勝":1,"準決勝":2,"準々決勝":4}
  report["round_shortfalls"]={round_name:{"expected_minimum":minimum,"parsed":report["rounds"].get(round_name,0)} for round_name,minimum in required.items() if report["rounds"].get(round_name,0)<minimum}
  with tempfile.TemporaryDirectory(prefix="hsbbl-gifu-2025-trial-") as temp, patch.object(imp,"DATA_ROOT",Path(temp)):
   imp._IMPORT_IDENTITIES=None
   dest=Path(temp)/YEAR/SEASON/(PREF+".csv")
   added,_,_=imp.merge_csv(dest,rows)
   repeat,_,_=imp.merge_csv(dest,rows)
   report["dry_run_first_additions"]=added
   report["dry_run_repeat_additions"]=repeat
  report["accepted_for_review"]=bool(rows) and not problems and repeat==0 and added==len(rows) and not report["round_shortfalls"]
  report["note"]="A green run does not publish data; verify original source completeness and league hierarchy first."
 except Exception as exc:
  report["error"]=f"{type(exc).__name__}: {exc}"
  report["source_status"]="failed"
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
 if not report.get("accepted_for_review"):raise SystemExit(1)

if __name__=="__main__":main()
