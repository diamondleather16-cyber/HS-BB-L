#!/usr/bin/env python3
"""Produce a deterministic, reviewable correction plan for exact CSV duplicates.

Exact means ALL fields in the same source CSV match after BOM parsing; do not
infer which of two records with different tournament/level metadata is right.
This command does not change any source files or ratings.
"""
import csv,json,hashlib,collections,datetime
from pathlib import Path
ROOT=Path("data/imported")
OUT=Path("output/audit/bulk_exact_duplicate_plan.json")
FIELDS=("year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note")
def main():
 totals=collections.Counter();safe=[];conflicts=[]
 for p in sorted(ROOT.rglob("*.csv")):
  try:
   with p.open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
  except Exception as e:
   conflicts.append({"file":str(p),"reason":"unreadable","detail":str(e)});continue
  seen={}
  for i,r in enumerate(rows,start=2):
   totals["rows"]+=1
   k=tuple(str(r.get(c) or "").strip() for c in FIELDS)
   if not all(k[j] for j in (0,1,4,7,9,11)):
    totals["incomplete_row"]+=1
   if k in seen:
    totals["exact_duplicate_rows"]+=1
    safe.append({"file":str(p),"retain_line":seen[k],"duplicate_line":i,
                 "source_url":r.get("source_url"),"date":r.get("date"),
                 "teams":[r.get("team1"),r.get("team2")],"sha256":hashlib.sha256(repr(k).encode()).hexdigest()})
   else:seen[k]=i
  totals["files"]+=1
 report={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
         "statistics":dict(totals),"exact_same_file_duplicate_removal_plan":safe,
         "unreadable_files":conflicts,"source_data_modified":False,
         "policy":"Only byte-equivalent field values in the SAME CSV qualify. Cross-file and metadata conflicts require separate resolution."}
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"statistics":dict(totals),"plan_count":len(safe),"unreadable":len(conflicts)},ensure_ascii=False))
if __name__=="__main__":main()
