#!/usr/bin/env python3
"""Prioritize all 2021-26 coverage gaps using existing repository evidence only."""
import csv,json,collections,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path("master");COVER=ROOT/"nationwide_all_data_coverage_2021_2026.csv"
OUT=ROOT/"nationwide_2021_2026_gap_queue.csv";SUMMARY=ROOT/"nationwide_2021_2026_gap_queue_summary.json"
def read(p):
 if not p.exists():return []
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 rows=read(COVER);source_map=collections.defaultdict(set)
 for r in read(ROOT/"sources.csv"):
  p=r.get("prefecture","");y=r.get("year","");s=r.get("season","");t=r.get("tournament_name","");u=r.get("source_url","")
  if p and p in t and u.startswith("https://koshien89.com/blog-entry-"):
   source_map[(y,s,p)].add(u)
 queue=[];stats=collections.Counter();period=collections.defaultdict(collections.Counter)
 for r in rows:
  if r["status"]=="explicit_prefecture_records":continue
  k=(r["year"],r["season"],r["prefecture"])
  urls=source_map[k]
  unclear=r["status"]=="prefecture_tagged_level_unclear"
  if unclear: action="review_existing_level"
  elif urls:action="import_from_known_article"
  else:action="find_source_article"
  stats[action]+=1;period[(r["year"],r["season"])][action]+=1
  queue.append({"year":r["year"],"season":r["season"],"prefecture":r["prefecture"],
    "priority":1 if unclear else 2 if urls else 3,"next_action":action,
    "existing_unknown_level_rows":r.get("level_unknown_rows",0),
    "all_pref_tagged_rows":r.get("all_pref_tagged_rows",0),
    "source_urls":";".join(sorted(urls)),
    "source_files":r.get("source_csv_paths","")})
 queue.sort(key=lambda r:(int(r["priority"]),int(r["year"]),r["season"],r["prefecture"]))
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=queue[0].keys());writer.writeheader();writer.writerows(queue)
 result={"generated_at":datetime.now(timezone.utc).isoformat(),"unresolved_units":len(queue),
         "by_action":dict(stats),
         "by_year_season":[{"year":y,"season":s,**dict(v)} for (y,s),v in sorted(period.items())],
         "note":"Known source URL does not certify the tournament is complete. Classification is a work queue, not an import success."}
 SUMMARY.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(result,ensure_ascii=False))
if __name__=="__main__":main()
