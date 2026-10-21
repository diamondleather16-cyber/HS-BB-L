#!/usr/bin/env python3
"""Accumulate historical URL evidence and sample article text without modifying ratings.

Conservatively try just one article to test FC2 access. Source URL inventory
is saved even if article fetch returns 403. Future archival can scale only
when source access is confirmed.
"""
import csv,json,hashlib
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
 if ordered:
  # A single representative live probe prevents 100s of known 403 requests.
  candidate=ordered[0]
  try:
   response=imp.http_get(candidate["url"],timeout=(5,18))
   response.raise_for_status()
   response.encoding=response.apparent_encoding or response.encoding
   html=response.text
   # Preserve full HTML verbatim for future parsing, never overwrite authoritative CSV.
   name=hashlib.sha256(candidate["url"].encode()).hexdigest()[:20]+".html"
   (out/name).write_text(html,encoding="utf-8")
   candidate["status"]="full_HTML_archived"
   probe={"status":"archived","url":candidate["url"],"file":name,"bytes":len(html.encode())}
  except Exception as exc:
   probe={"status":"source_blocked","url":candidate["url"],"error":str(exc)[:300]}
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
