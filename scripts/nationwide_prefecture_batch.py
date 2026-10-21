#!/usr/bin/env python3
"""Bulk gap-fill from independently listed 89 article URLs, not category links.

A source manifest is advisory and can contain a mis-assigned prefecture; require
prefecture in its tournament title and validate parsed season, year and level.
Only append when it is absent across the pre-existing master ledger and imported CSV.
"""
import argparse,csv,json,re,time,sys
from pathlib import Path
from datetime import datetime,timezone
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

SOURCE=Path("master/sources.csv")
MASTER=Path("output/all_matches.csv")
REPORT=Path("master/nationwide_prefecture_ingest_report.json")
VALID="北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
def load_ledger():
 out=set()
 if MASTER.exists():
  with MASTER.open(encoding="utf-8-sig",newline="") as f:
   for r in csv.DictReader(f):
    k=imp._import_identity(r)
    if k:out.add(k)
 return out
def main():
 a=argparse.ArgumentParser()
 a.add_argument("--year",default="2025")
 a.add_argument("--season",default="autumn")
 args=a.parse_args()
 records=list(csv.DictReader(SOURCE.open(encoding="utf-8-sig",newline="")))
 selected={}
 for r in records:
  year=str(r.get("year") or "")
  season=str(r.get("season") or "")
  pref=str(r.get("prefecture") or "")
  title=str(r.get("tournament_name") or "")
  url=str(r.get("source_url") or "")
  if year!=args.year or season!=args.season or pref not in VALID:continue
  if pref not in title or not url.startswith("https://koshien89.com/blog-entry-"):
   continue
  selected.setdefault((pref,url),r)
 seen=load_ledger()
 stats=Counter();issues=[];entries=[]
 for (pref,url),source in selected.items():
  req={"source_url":url,"year":args.year,"season":args.season,"prefecture":pref,
       "locked_prefecture":pref,"region":imp.PREF_TO_REGION.get(pref,""),
       "level":"prefecture","tournament":source["tournament_name"],
       "batch_auto_metadata":False}
  try:
   raw,warnings=imp.analyze(req)
   rows=imp.normalize_approved_rows(raw,"prefecture")
   if warnings:raise ValueError("Parser warnings: "+repr(warnings[:4]))
   if not rows:raise ValueError("no games parsed")
   unique=[];within=set();conflicts=[]
   for row in rows:
    if str(row.get("year"))!=args.year or str(row.get("season"))!=args.season:
     conflicts.append("period");continue
    if str(row.get("prefecture"))!=pref:conflicts.append("prefecture");continue
    if "level=prefecture" not in str(row.get("note") or ""):conflicts.append("level");continue
    k=imp._import_identity(row)
    if not k:conflicts.append("identity");continue
    if k in within:continue
    within.add(k)
    if k not in seen:unique.append(row)
   if conflicts:
    raise ValueError("Unparseable/misassigned rows: "+str(Counter(conflicts)))
   p=Path("data/imported")/args.year/args.season/(pref+".csv")
   if unique:
    added,_,_=imp.merge_csv(p,unique,mode="append")
   else:added=0
   if added>len(unique):raise RuntimeError("inconsistent additions")
   seen.update(within)
   stats["registered_articles"]+=1;stats["parsed"]+=len(rows);stats["new_rows"]+=added
   entries.append({"prefecture":pref,"url":url,"parsed":len(rows),"new":added})
   print(f"{pref}: parsed {len(rows)}, added {added}",flush=True)
  except Exception as e:
   stats["failed_articles"]+=1
   issues.append({"prefecture":pref,"url":url,"problem":str(e)[:300]})
   print(f"{pref} failed: {str(e)[:120]}",flush=True)
  time.sleep(0.8)
 payload={"timestamp":datetime.now(timezone.utc).isoformat(),"year":args.year,"season":args.season,
          "prefectures_in_manifest":len(set(p for p,u in selected)),
          "source_articles":len(selected),"statistics":dict(stats),
          "articles":entries,"errors":issues,
          "completeness_verified":False,
          "note":"Batch imports validated rows and avoids same-source duplicates. A complete official tournament game inventory still needs checking."}
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 REPORT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"source_articles":len(selected),"statistics":dict(stats)},ensure_ascii=False))
if __name__=="__main__":main()
