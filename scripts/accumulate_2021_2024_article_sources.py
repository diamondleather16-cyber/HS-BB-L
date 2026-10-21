#!/usr/bin/env python3
"""Accumulate historical URL evidence and sample article text without modifying ratings.

Conservatively try just one article to test FC2 access. Source URL inventory
is saved even if article fetch returns 403. Future archival can scale only
when source access is confirmed.
"""
import csv,json,hashlib,time,os
from pathlib import Path
from datetime import datetime,timezone
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
ROOT=Path("master")
def main():
 rows={}
 for year in range(2021,2025):
  path=ROOT/f"priority_{year}_article_links.csv"
  if not path.exists():raise SystemExit(f"Missing validated category-link inventory: {path}")
  with path.open(encoding="utf-8-sig",newline="") as f:
   for r in csv.DictReader(f):
    k=(r["year"],r["season"],r["prefecture"],r["source_url"])
    rows[k]={"year":r["year"],"season":r["season"],"prefecture":r["prefecture"],
             "url":r["source_url"],"category_title":r["link_title"],"status":"URL_identified_article_not_archived"}
 ordered=sorted(rows.values(),key=lambda r:(-int(r["year"]),r["season"],r["prefecture"]))
 out=ROOT/"raw_article_intake_2021_2024"
 out.mkdir(parents=True,exist_ok=True)
 probe={"status":"not_attempted"}
 attempt_limit=int(os.getenv("MAX_ARTICLE_FETCHES","172"))
 consecutive_403=0
 probes=[]
 for candidate in ordered[:attempt_limit]:
  try:
   response=imp.http_get(candidate["url"],timeout=(5,18))
   response.raise_for_status()
   response.encoding=response.apparent_encoding or response.encoding
   html=response.text
   name=hashlib.sha256(candidate["url"].encode()).hexdigest()[:20]+".html"
   (out/name).write_text(html,encoding="utf-8")
   candidate["status"]="full_HTML_archived"
   probes.append({"status":"archived","url":candidate["url"],"file":name,"bytes":len(html.encode())})
   consecutive_403=0
  except Exception as exc:
   error=str(exc)
   candidate["status"]="fetch_failed"
   probes.append({"status":"failed","url":candidate["url"],"error":error[:250]})
   consecutive_403=consecutive_403+1 if "403" in error else 0
  if consecutive_403>=3:
   print("Stopping after three consecutive FC2 403 responses",flush=True)
   break
  time.sleep(1)
 probe={"status":"batch_attempted","attempts":len(probes),"archived":sum(x["status"]=="archived" for x in probes),
        "errors":sum(x["status"]=="failed" for x in probes),"stopped_on_403":consecutive_403>=3}
 (out/"fetch_log.json").write_text(json.dumps(probes,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
 with (out/"source_manifest.csv").open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=["year","season","prefecture","url","category_title","status"])
  writer.writeheader();writer.writerows(ordered)
 report={"time":datetime.now(timezone.utc).isoformat(),"candidates":len(ordered),
   "units_with_urls":len({(r["year"],r["season"],r["prefecture"]) for r in ordered}),
   "full_html_archived":sum(r["status"]=="full_HTML_archived" for r in ordered),
   "probe":probe,"published_matches":0,
   "note":"Unverified article body remains separate from canonical ledger; 403 must not be misreported as import success."}
 (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
