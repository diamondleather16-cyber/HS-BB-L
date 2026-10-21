#!/usr/bin/env python3
"""Discover 2021-2026 prefectural tournament article URLs nationwide.

Read-only source discovery, never publish match rows or overwrite the original
source manifest. Homepage category extraction is followed by article label
classification. Review candidates before a later import.
"""
import csv,json,re,time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from datetime import datetime,timezone
from collections import Counter
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
from bs4 import BeautifulSoup
PREFS="北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
OUT=Path("master/nationwide_discovered_articles_2021_2026.csv")
REPORT=Path("master/nationwide_discovery_report.json")
def main():
 r=imp.http_get("https://koshien89.com/",timeout=(8,24));r.raise_for_status()
 r.encoding=r.apparent_encoding or r.encoding
 soup=BeautifulSoup(r.text,"html.parser")
 cats={}
 for a in soup.find_all("a",href=True):
  href=urljoin("https://koshien89.com/",a["href"])
  m=re.search(r"blog-category-(\d+)(?:-\d+)?\.html",urlparse(href).path)
  if not m:continue
  label=a.get_text(" ",strip=True)
  matched=[p for p in PREFS if p in label]
  if len(matched)==1:
   cats.setdefault((matched[0],m.group(1)),f"https://koshien89.com/blog-category-{m.group(1)}.html")
 # Supplement 10 category numbers already verified by older backfill.
 from backfill_10pref_2021_2026 import CATEGORIES
 for p,n in CATEGORIES.items():cats[(p,str(n))]=f"https://koshien89.com/blog-category-{n}.html"
 discovered=[];fail=[];stats=Counter()
 for (pref,cat),url in sorted(cats.items()):
  try:
   articles,pages=imp.discover_result_urls(url,limit=500,year_from=2021,year_to=2026,
              seasons=("spring","summer","autumn"),follow_pagination=True)
   stats["category_success"]+=1
   for article in articles:
    discovered.append({"category_prefecture":pref,"category_number":cat,"source_url":article})
   print(f"{pref} category {cat}: {len(articles)} URLs",flush=True)
  except Exception as e:
   fail.append({"prefecture":pref,"category":cat,"error":str(e)[:250]})
   stats["category_failed"]+=1
  time.sleep(0.5)
 unique=list({(a["category_prefecture"],a["source_url"]):a for a in discovered}.values())
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=["category_prefecture","category_number","source_url"])
  writer.writeheader();writer.writerows(unique)
 report={"generated_at":datetime.now(timezone.utc).isoformat(),"categories":len(cats),
         "prefectures_with_categories":len(set(p for p,c in cats)),
         "candidate_articles":len(unique),"stats":dict(stats),"errors":fail,
         "imported_games":0,"review_required":True,
         "warning":"Category affiliation is NOT proof the article describes a prefectural tournament; validate title, year and level before importing."}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
