#!/usr/bin/env python3
"""Identify 2024 missing tournament URLs from 89 category listing link titles.
Never fetch article bodies or change match data. Fail if access blocked.
"""
import argparse,csv,json,re,time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from collections import Counter
from bs4 import BeautifulSoup
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
ROOT=Path("master")
TITLE={"spring":"春季","summer":"選手権","autumn":"秋季"}
def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--year",required=True,choices=["2021","2022","2023","2024"])
 args=parser.parse_args()
 year=args.year
 with (ROOT/"priority_gaps_2021_2024.csv").open(encoding="utf-8-sig",newline="") as f:
  missing={(r["prefecture"],r["season"]) for r in csv.DictReader(f) if r["year"]==year}
 targets=sorted({p for p,s in missing})
 # Existing nationwide listing has established category association but no year/season.
 with (ROOT/"nationwide_discovered_articles_2021_2026.csv").open(encoding="utf-8-sig",newline="") as f:
  discovered=list(csv.DictReader(f))
 cats={(r["category_prefecture"],r["category_number"]) for r in discovered if r["category_prefecture"] in targets}
 candidates={};fail=[];counts=Counter()
 for pref,cat in sorted(cats):
  for page in range(8):
   suffix="" if page==0 else "-"+str(page)
   url=f"https://koshien89.com/blog-category-{cat}{suffix}.html"
   try:
    response=imp.http_get(url,timeout=(5,18));response.raise_for_status()
    response.encoding=response.apparent_encoding or response.encoding
   except Exception as exc:
    fail.append({"prefecture":pref,"category":cat,"page":page,"error":str(exc)[:120]})
    if page==0:counts["category_blocked"]+=1
    break
   soup=BeautifulSoup(response.text,"html.parser")
   matched=0
   for link in soup.find_all("a",href=True):
    article=urljoin(url,link["href"])
    if not re.search(r"/blog-entry-\d+\.html",urlparse(article).path):continue
    label=link.get_text(" ",strip=True)
    if year not in label or pref not in label:continue
    seasons=[s for s,w in TITLE.items() if w in label]
    if len(seasons)!=1 or (pref,seasons[0]) not in missing:continue
    item=(pref,seasons[0],article)
    candidates[item]={"year":year,"season":seasons[0],"prefecture":pref,
       "source_url":article,"link_title":label,"category":cat,
       "validation":"category_link_title_only;article_body_not_verified"}
    matched+=1
   counts["pages_read"]+=1
   print(f"{pref} category {cat} page {page}: {matched} exact-title candidates",flush=True)
   time.sleep(0.4)
 rows=list(candidates.values());out=ROOT/f"priority_{year}_article_links.csv"
 with out.open("w",encoding="utf-8-sig",newline="") as f:
  fields=["year","season","prefecture","source_url","link_title","category","validation"]
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 covered={(r["prefecture"],r["season"]) for r in rows}
 summary={"missing_units":len(missing),"target_prefectures":len(targets),
   "category_count":len(cats),"links_found":len(rows),
   "units_with_url_candidate":len(covered),"units_still_without_url_candidate":len(missing-covered),
   "stats":dict(counts),"errors":fail[:100],"published_games":0,
   "warning":"Only category anchor titles were used. URLs must be validated against actual article content before import."}
 (ROOT/f"priority_{year}_article_links_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(summary,ensure_ascii=False),flush=True)
 if not counts["pages_read"]:raise SystemExit("No category pages accessible; no article links validated")
if __name__=="__main__":main()
