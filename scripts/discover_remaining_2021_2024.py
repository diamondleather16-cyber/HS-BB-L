#!/usr/bin/env python3
"""Discover source article links for only the remaining uncovered 2021-24 units."""
import csv,json,re,time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from collections import Counter
from bs4 import BeautifulSoup
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
M=Path("master")
def read(path):
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 missing={(r["year"],r["season"],r["prefecture"]) for r in read(M/"nationwide_all_data_coverage_2021_2026.csv")
          if r["year"] in ("2021","2022","2023","2024") and r["status"]!="explicit_prefecture_records"}
 discovered=read(M/"nationwide_discovered_articles_2021_2026.csv")
 categories={(r["category_prefecture"],r["category_number"]) for r in discovered
             if any(p==r["category_prefecture"] for _,_,p in missing)}
 found={};stats=Counter();errors=[]
 for pref,cat in sorted(categories):
  for page in range(18):
   suffix="" if page==0 else "-"+str(page)
   url=f"https://koshien89.com/blog-category-{cat}{suffix}.html"
   try:
    res=imp.http_get(url,timeout=(5,18));res.raise_for_status()
    res.encoding=res.apparent_encoding or res.encoding
   except Exception as e:
    errors.append({"url":url,"error":str(e)[:160]});break
   soup=BeautifulSoup(res.text,"html.parser")
   for link in soup.find_all("a",href=True):
    u=urljoin(url,link["href"]);label=link.get_text(" ",strip=True)
    if not re.search(r"/blog-entry-\d+\.html",urlparse(u).path):continue
    for y,season,place in missing:
     if place!=pref or y not in label or place not in label:continue
     words={"spring":"春季","summer":"選手権","autumn":"秋季"}
     if words[season] not in label:continue
     found[(y,season,place,u)]={"year":y,"season":season,"prefecture":place,
       "source_url":u,"link_title":label,"validation":"category_title_only"}
   stats["pages_read"]+=1
   time.sleep(0.3)
 rows=list(found.values())
 out=M/"remaining_2021_2024_source_urls.csv"
 with out.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=["year","season","prefecture","source_url","link_title","validation"])
  w.writeheader();w.writerows(rows)
 covered={(r["year"],r["season"],r["prefecture"]) for r in rows}
 summary={"missing_before":len(missing),"candidate_units":len(covered),"still_without_candidate":len(missing-covered),
  "uncovers":[{"year":y,"season":s,"prefecture":p} for y,s,p in sorted(missing-covered)],
  "scanned_pages":stats["pages_read"],"errors":errors[:30],
  "official_ledger_updated":False}
 (M/"remaining_2021_2024_source_urls_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(summary,ensure_ascii=False))
 if not stats["pages_read"]:raise SystemExit("Could not access category pages")
if __name__=="__main__":main()
