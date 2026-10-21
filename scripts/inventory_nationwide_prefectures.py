#!/usr/bin/env python3
"""Create national 2021-26 prefecture-season gap inventory; read-only."""
import csv,json,re
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime,timezone
PREFS="北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
MANIFEST=Path("master/sources.csv");ROOT=Path("data/imported");OUT=Path("master/nationwide_2021_2026_inventory.csv");SUMMARY=Path("master/nationwide_2021_2026_inventory_summary.json")
def main():
 urls=defaultdict(set);csvrows=Counter();article_count=Counter()
 with MANIFEST.open(encoding="utf-8-sig",newline="") as f:
  for r in csv.DictReader(f):
   p=str(r.get("prefecture") or "").strip();y=str(r.get("year") or "").strip();s=str(r.get("season") or "").strip();u=str(r.get("source_url") or "").strip();title=str(r.get("tournament_name") or "")
   if p in PREFS and y in {str(y) for y in range(2021,2027)} and s in ("spring","summer","autumn") and u.startswith("https://koshien89.com/blog-entry-") and p in title:
    urls[(p,y,s)].add(u)
 for path in ROOT.rglob("*.csv"):
  if path.parent.name not in ("spring","summer","autumn"):continue
  y=path.parent.parent.name;s=path.parent.name;p=path.stem
  if p not in PREFS or y not in {str(n) for n in range(2021,2027)}:continue
  try:
   with path.open(encoding="utf-8-sig",newline="") as f:
    for r in csv.DictReader(f):
     if str(r.get("prefecture") or "")==p and "level=prefecture" in str(r.get("note") or ""):
      csvrows[(p,y,s)]+=1
  except (OSError,UnicodeError,csv.Error):
   pass
 results=[];counts=Counter()
 for y in range(2021,2027):
  for s in ("spring","summer","autumn"):
   for p in PREFS:
    k=(p,str(y),s); n=csvrows[k]; u=urls[k]
    if n: state="has_prefecture_rows_not_verified"
    elif u:state="source_known_missing_rows"
    else:state="source_unknown_missing_rows"
    counts[state]+=1
    results.append({"year":y,"season":s,"prefecture":p,"imported_prefecture_rows":n,
      "source_article_count":len(u),"source_urls":";".join(sorted(u)),"status":state})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=list(results[0]));w.writeheader();w.writerows(results)
 summary={"generated_at":datetime.now(timezone.utc).isoformat(),"expected_47x6x3":len(results),"statuses":dict(counts),
          "year_season":[{"year":y,"season":s,"present":sum(bool(csvrows[(p,str(y),s)]) for p in PREFS),
           "source_known_missing":sum(not csvrows[(p,str(y),s)] and bool(urls[(p,str(y),s)]) for p in PREFS),
           "source_unknown_missing":sum(not csvrows[(p,str(y),s)] and not urls[(p,str(y),s)] for p in PREFS)}
             for y in range(2021,2027) for s in ("spring","summer","autumn")],
          "warning":"Presence is not source completeness. Some earlier imported records may be mislabeled, duplicated, or missing rounds."}
 SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(summary,ensure_ascii=False))
if __name__=="__main__":main()
