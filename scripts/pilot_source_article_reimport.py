#!/usr/bin/env python3
"""Source article dry run: analyze actual 2021 Mie autumn results and compare with ledger.

The script will NEVER commit newly parsed matches. It writes a JSON evidence
report and runs the guard against an isolated temporary copy of the existing CSV.
"""
import csv,json,sys,tempfile,shutil
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
SOURCE="https://koshien89.com/blog-entry-2571.html"
CSV=Path("data/imported/2021/autumn/三重.csv")
OUT=Path("output/audit/source_reimport_dry_run_mie2021_autumn.json")
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 if not CSV.exists():raise RuntimeError("Source CSV missing")
 existing=read(CSV)
 req={"source_url":SOURCE,"year":"2021","season":"autumn","prefecture":"三重","locked_prefecture":"三重",
      "region":"東海","level":"prefecture","tournament":"秋季東海三重2021","batch_auto_metadata":False}
 raw,warnings=imp.analyze(req)
 parsed=imp.normalize_approved_rows(raw,"prefecture")
 if not parsed:raise RuntimeError("Parser produced zero matches")
 before=len(existing)
 existing_keys={imp._import_identity(r) for r in existing}
 matches=sum(imp._import_identity(r) in existing_keys and imp._import_identity(r) is not None for r in parsed)
 missing_identity=[r for r in parsed if imp._import_identity(r) is None]
 distinct_identity=[r for r in parsed if imp._import_identity(r) is not None and imp._import_identity(r) not in existing_keys]
 invalid_dates=[{"date":r.get("date"),"round":r.get("round"),"team1":r.get("team1"),"team2":r.get("team2")} for r in missing_identity][:20]
 unknown=len(parsed)-matches
 with tempfile.TemporaryDirectory(prefix="hsbbl-source-dry-run-") as d, patch.object(imp,"DATA_ROOT",Path(d)):
  dest=Path(d)/"2021/autumn/三重.csv"
  dest.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(CSV,dest)
  imp._IMPORT_IDENTITIES=None
  added,removed,migrated=imp.merge_csv(dest,parsed,mode="append")
  after=len(read(dest))
 report={"source_url":SOURCE,"existing_csv":str(CSV),"existing_rows":before,
  "parsed_article_rows":len(parsed),"already_same_source_match":matches,
  "unmatched_candidate_rows":unknown,"dry_run_additions":added,"isolated_csv_rows_after":after,
  "warnings":warnings[:20], "not_identifiable":len(missing_identity), "identifiable_but_not_found":len(distinct_identity), "missing_identity_examples":invalid_dates, "distinct_identity_examples":distinct_identity[:5], "original_data_modified":False,
  "requires_manual_review":bool(unknown),
  "pass":after==before+added and removed==0}
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
 if not report["pass"]:raise SystemExit(1)
if __name__=="__main__":main()
