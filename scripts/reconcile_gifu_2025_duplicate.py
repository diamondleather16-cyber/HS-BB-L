#!/usr/bin/env python3
"""Reconcile one independently confirmed duplicate, preserving full audit evidence.

Canonical record: 2025 Gifu spring semifinal, Chukyo 2 - Gifu Daiichi 1,
article 3447. Only removes the redundant legacy SF row if every strict
assertion passes. Never changes the canonical 116-game source.
"""
import csv, json, os, tempfile
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path("data")
CANONICAL=Path("data/imported/2025/spring/岐阜.csv")
AUDIT=Path("master/import_fixes/gifu_2025_spring_duplicate_reconciliation.json")
URL="https://koshien89.com/blog-entry-3447.html"
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
def clean(v):
 return str(v if v is not None else "").strip().lstrip("■").strip()
def is_game(r):
 if (clean(r.get("year")),clean(r.get("season")),clean(r.get("date")))!=( "2025","spring","2025-04-26"):return False
 return { (clean(r.get("team1")),clean(r.get("score1"))),(clean(r.get("team2")),clean(r.get("score2"))) }=={("中京","2"),("岐阜第一","1")}
def read(path):
 with path.open(encoding="utf-8-sig",newline="") as f:
  reader=csv.DictReader(f)
  if not reader.fieldnames:return [],[]
  if not all(x in reader.fieldnames for x in FIELDS):return [],[]
  return list(reader.fieldnames),list(reader)
def main():
 grouped=[]
 for p in sorted(ROOT.rglob("*.csv")):
  fields,rows=read(p)
  for i,r in enumerate(rows):
   if is_game(r):
    grouped.append((p,i,r,fields))
 def report_item(t):
  p,i,r,_=t
  return {"source_file":str(p),"line":i+2,"record":{k:r.get(k,"") for k in FIELDS}}
 report={"checked_at":datetime.now(timezone.utc).isoformat(),
         "fixture":"2025-04-26 中京 2-1 岐阜第一","matches_before":[report_item(t) for t in grouped],
         "modified":False}
 canonical=[t for t in grouped if t[0]==CANONICAL and clean(t[2].get("round"))=="準決勝" and clean(t[2].get("source_url"))==URL]
 legacy=[t for t in grouped if t[0]!=CANONICAL and clean(t[2].get("round"))=="SF" and clean(t[2].get("source_url"))==URL]
 if len(canonical)==1 and len(legacy)==0 and len(grouped)==1:
  report["status"]="already_reconciled"
 elif len(canonical)==1 and len(legacy)==1 and len(grouped)==2:
  p,i,r,fields=legacy[0]
  current_fields, current_rows=read(p)
  assert fields==current_fields and current_rows[i]==r
  remaining=current_rows[:i]+current_rows[i+1:]
  # Atomic source write. Git retains history of the original source record.
  with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8-sig",newline="",dir=p.parent,delete=False) as f:
   w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
   w.writeheader();w.writerows(remaining)
   tmp=Path(f.name)
  os.replace(tmp,p)
  report["status"]="duplicate_legacy_removed"
  report["modified"]=True
  report["removed"]=report_item(legacy[0])
 else:
  report["status"]="manual_review_required"
  AUDIT.parent.mkdir(parents=True,exist_ok=True)
  AUDIT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  raise SystemExit(f"Unexpected matching records: {len(grouped)} canonical={len(canonical)} legacy={len(legacy)}")
 AUDIT.parent.mkdir(parents=True,exist_ok=True)
 AUDIT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"status":report["status"],"matches_before":len(grouped),"modified":report["modified"],"removed_file":str(legacy[0][0]) if report["modified"] else None},ensure_ascii=False))
if __name__=="__main__":main()
