#!/usr/bin/env python3
"""Audit missing final-round matches and retrieve source evidence conservatively."""
import csv,json,collections,re,time
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
ROOT=Path("master")
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 flagged=[r for r in read(ROOT/"historical_completeness_2021_2024.csv")
          if r["games"]!="0" and "final_not_seen" in r["flags"]]
 sources=collections.defaultdict(set)
 for p in Path("data").rglob("*.csv"):
  if p.name=="template.csv":continue
  try:
   for r in read(p):
    k=(str(r.get("year") or ""),str(r.get("season") or ""),str(r.get("prefecture") or ""))
    if r.get("source_url") and any(k==(z["year"],z["season"],z["prefecture"]) for z in flagged):
     if "koshien89.com/blog-entry-" in r["source_url"]:sources[k].add(r["source_url"])
  except (OSError,UnicodeError,csv.Error):continue
 results=[];candidates=[];visited={}
 for row in flagged:
  k=row["year"],row["season"],row["prefecture"]
  urls=sorted(sources[k]);result={**{t:row[t] for t in ("year","season","prefecture","games")}, "urls":urls[:8],
         "article_final_candidates":0,"fetch_errors":[]}
  for url in urls[:2]:
   try:
    if url not in visited:
     response=imp.http_get(url,timeout=(5,18));response.raise_for_status()
     response.encoding="utf-8"
     visited[url]=response.text
    games,warnings=imp.parse_koshien89(visited[url],{"year":int(row["year"])})
    for g in games:
     rnd=str(g.get("round") or "")
     if "決勝" in rnd and not any(s in rnd for s in ("準決勝","準々決勝")):
      result["article_final_candidates"]+=1
      candidates.append({**{z:row[z] for z in ("year","season","prefecture")}, "article_url":url,
        **{z:g.get(z,"") for z in ("date","round","team1","score1","team2","score2")}})
   except Exception as exc:result["fetch_errors"].append(str(exc)[:120])
   time.sleep(0.6)
  results.append(result)
 dest=ROOT/"missing_finals_source_candidates_2021_2024.csv"
 fields=["year","season","prefecture","article_url","date","round","team1","score1","team2","score2"]
 with dest.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(candidates)
 report={"flagged_units":len(flagged),"units_with_candidates":sum(x["article_final_candidates"]>0 for x in results),
   "candidate_rows":len(candidates),"units_without_source_url":sum(not x["urls"] for x in results),
   "units_with_fetch_errors":sum(bool(x["fetch_errors"]) for x in results),
   "results":results,"official_ledger_edited":False,
   "note":"Diagnostic source candidates, not authoritative new results; verify against matching tournament and dates before insertion."}
 (ROOT/"missing_finals_source_report_2021_2024.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({k:v for k,v in report.items() if k!="results"},ensure_ascii=False))
if __name__=="__main__":main()
