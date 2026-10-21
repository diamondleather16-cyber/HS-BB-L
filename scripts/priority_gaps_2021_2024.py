#!/usr/bin/env python3
"""Prioritize missing 2021–24 prefectural units and 89 category article candidates.
Read-only, do not infer season/year from an article number or category membership.
"""
import csv,json,collections
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path("master")
def load(path):
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 coverage=load(ROOT/"nationwide_all_data_coverage_2021_2026.csv")
 discovered=load(ROOT/"nationwide_discovered_articles_2021_2026.csv")
 bypref=collections.defaultdict(set)
 for r in discovered:
  bypref[r["category_prefecture"]].add(r["source_url"])
 rows=[];annual=collections.defaultdict(lambda:collections.Counter())
 for r in coverage:
  y=int(r["year"])
  if y<2021 or y>2024:continue
  pref=r["prefecture"]
  done=r["status"]=="explicit_prefecture_records"
  annual[y]["with_prefecture_rows" if done else "missing_prefecture_rows"]+=1
  if done:continue
  urls=sorted(bypref[pref])
  rows.append({"year":y,"season":r["season"],"prefecture":pref,
    "existing_prefecture_rows":r["explicit_prefecture_rows"],
    "uncertain_level_rows":r["level_unknown_rows"],
    "candidate_article_urls_in_prefecture_category":len(urls),
    "category_article_urls":";".join(urls),
    "verification_status":"needs_article_title_year_season_validation",
    "imported":0})
 rows.sort(key=lambda z:(-z["year"],{"spring":0,"summer":1,"autumn":2}[z["season"]],z["prefecture"]))
 out=ROOT/"priority_gaps_2021_2024.csv"
 with out.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 report={"generated_at":datetime.now(timezone.utc).isoformat(),"scope":"2021-2024 prefecture levels only",
   "total_units":4*47*3,"present":sum(c["with_prefecture_rows"] for c in annual.values()),
   "missing":len(rows),"by_year":{str(k):dict(v) for k,v in sorted(annual.items(),reverse=True)},
   "prefectures_with_source_category_candidates":len(set(r["prefecture"] for r in rows if r["candidate_article_urls_in_prefecture_category"])),
   "note":"Article candidates still need title/season/year verification. Not proof of completeness; no games were added."}
 (ROOT/"priority_gaps_2021_2024_summary.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
