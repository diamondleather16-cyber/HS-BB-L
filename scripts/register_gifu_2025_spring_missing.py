#!/usr/bin/env python3
"""Add only a verified missing walk-off semifinal to 2025 Gifu spring ledger.

Preserve 115 existing games. No changes if unexpected source counts or
conflicting copies are encountered. GitHub Actions commits only the target CSV.
"""
import csv,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

URL="https://koshien89.com/blog-entry-3447.html"
DEST=Path("data/imported/2025/spring/岐阜.csv")
REPORT=Path("master/import_fixes/gifu_2025_spring_walkoff.json")
EXPECTED={"year":"2025","season":"spring","prefecture":"岐阜"}
def rows(path):
 if not path.exists():return []
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 original=rows(DEST)
 if len(original) not in (115,116):
  raise SystemExit(f"Unexpected Gifu CSV row count {len(original)}; review required")
 req={"source_url":URL,**EXPECTED,"locked_prefecture":"岐阜","region":"東海",
      "level":"prefecture","tournament":"春季東海岐阜2025",
      "batch_auto_metadata":False}
 extracted,warnings=imp.analyze(req)
 parsed=imp.normalize_approved_rows(extracted,"prefecture")
 if warnings or len(parsed)!=116:
  raise SystemExit(f"Source failed tournament validation: rows={len(parsed)} warnings={warnings[:3]}")
 by_round={}
 for r in parsed:by_round[r["round"]]=by_round.get(r["round"],0)+1
 if (by_round.get("決勝"),by_round.get("準決勝"),by_round.get("準々決勝"))!=(1,2,4):
  raise SystemExit(f"Unexpected bracket: {by_round}")
 for r in parsed:
  if any(str(r.get(k))!=v for k,v in EXPECTED.items()) or imp._import_identity(r) is None:
   raise SystemExit(f"Invalid parsed game: {r}")
 oldkeys={imp._import_identity(r) for r in original}
 newkeys={imp._import_identity(r) for r in parsed}
 if len(newkeys)!=116:raise SystemExit("Duplicate within parsed source")
 missing=[r for r in parsed if imp._import_identity(r) not in oldkeys]
 if len(missing)>1:raise SystemExit(f"More than one missing: {len(missing)}")
 if missing:
  r=missing[0]
  if (r["round"],r["date"],r["team1"],r["score1"],r["team2"],r["score2"])!=("準決勝","2025-04-26","中京",2,"岐阜第一",1):
   raise SystemExit(f"Unexpected missing fixture: {r}")
  before=len(original)
  added,_,_=imp.merge_csv(DEST,missing,mode="append")
  if added!=1 or len(rows(DEST))!=before+1:raise SystemExit("Insert did not add exactly one row")
 else:
  added=0
 result={"article":URL,"expected_source_games":116,"existing_before":len(original),
         "added":added,"after":len(rows(DEST)),"semifinals":2,
         "status":"registered" if added else "already_complete"}
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(result,ensure_ascii=False))
if __name__=="__main__":main()
