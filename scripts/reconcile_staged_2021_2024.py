#!/usr/bin/env python3
"""Compare 2021-24 staged matches against all existing data CSVs without edits."""
import csv,json,collections
from pathlib import Path
STAGE=Path("master/staging_2021_2024/staged_matches.csv")
OUT=Path("master/staging_2021_2024/reconciliation_summary.json")
DETAIL=Path("master/staging_2021_2024/reconciliation_by_unit.csv")
def key(r):
 y=str(r.get("year") or "").strip();s=str(r.get("season") or "").strip();d=str(r.get("date") or "").strip()
 a=sorted([(str(r.get("team1") or "").strip(),str(r.get("score1") or "").strip()),(str(r.get("team2") or "").strip(),str(r.get("score2") or "").strip())])
 if not y or not s or not d or not all(t and v for t,v in a):return None
 return (y,s,d,tuple(a))
def rows(p):
 with p.open(encoding="utf-8-sig",newline="") as f:yield from csv.DictReader(f)
def main():
 existing=collections.defaultdict(set);files=0
 for p in Path("data").rglob("*.csv"):
  if p.name=="template.csv":continue
  try:
   n=0
   for r in rows(p):
    if str(r.get("year")) not in ("2021","2022","2023","2024"):continue
    k=key(r)
    if k:existing[k].add((str(r.get("prefecture") or ""),str(r.get("tournament") or ""),str(p)))
    n+=1
   if n:files+=1
  except (OSError,UnicodeError,csv.Error):continue
 seen=set();counts=collections.Counter();units=collections.defaultdict(collections.Counter); examples=[]
 for r in rows(STAGE):
  k=key(r);u=(r["year"],r["season"],r["prefecture"])
  if k is None:status="incomplete_source_row"
  elif k in seen:status="duplicate_within_staging"
  elif k in existing:
   matching=[v for v in existing[k] if v[0]==r["prefecture"]]
   status="already_registered" if matching else "cross_prefecture_conflict"
  else:status="not_in_existing_ledger"
  if k:seen.add(k)
  counts[status]+=1;units[u][status]+=1
  if status in ("cross_prefecture_conflict","incomplete_source_row") and len(examples)<100:examples.append({"status":status,**r})
 with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
  fields=["year","season","prefecture","already_registered","not_in_existing_ledger","duplicate_within_staging","incomplete_source_row","cross_prefecture_conflict"]
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for (y,s,p),c in sorted(units.items()):w.writerow({"year":y,"season":s,"prefecture":p,**{t:c[t] for t in fields[3:]}})
 report={"source_stage_rows":sum(counts.values()),"source_csv_files_checked":files,"statuses":dict(counts),
         "unit_count":len(units),"warnings":examples,
         "source_mutated":False,"official_ledger_mutated":False,
         "note":"Potential new rows are NOT safe to auto-publish without title/level and score consistency validation."}
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({k:report[k] for k in ("source_stage_rows","source_csv_files_checked","statuses","unit_count")},ensure_ascii=False))
 if not report["source_stage_rows"]:raise SystemExit("Staging was empty")
if __name__=="__main__":main()
