#!/usr/bin/env python3
"""Bulk fill 2024 spring/summer gaps from nationally discovered source articles.

Preserve existing rows, reject regional sources, and never force source metadata.
"""
import csv,json,re,time,sys
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
DISC=Path("master/nationwide_discovered_articles_2021_2026.csv")
INVENTORY=Path("master/nationwide_2021_2026_inventory.csv")
OUT=Path("master/nationwide_2024_gapfill_report.json")
def main():
 with INVENTORY.open(encoding="utf-8-sig",newline="") as f:
  missing={(r["prefecture"],r["season"]) for r in csv.DictReader(f)
           if r["year"]=="2024" and r["season"] in ("spring","summer")
           and r["status"]!="has_prefecture_rows_not_verified"}
 with DISC.open(encoding="utf-8-sig",newline="") as f:
  candidates=list(csv.DictReader(f))
 chosen=list({(r["category_prefecture"],r["source_url"]):r for r in candidates
              if (r["category_prefecture"],"spring") in missing
              or (r["category_prefecture"],"summer") in missing}.values())
 stats=Counter();items=[];seen=set();added_by_pref=Counter()
 for index,r in enumerate(chosen,1):
  pref=r["category_prefecture"];url=r["source_url"]
  req={"source_url":url,"prefecture":pref,"locked_prefecture":pref,
       "region":imp.PREF_TO_REGION.get(pref,""),"year":"","season":"",
       "level":"prefecture","tournament":"","batch_auto_metadata":True}
  try:
   raw,warnings=imp.analyze(req)
   title=str(req.get("detected_title") or "")
   if pref not in title:continue
   if req.get("year") not in (2024,"2024"):continue
   season=str(req.get("season") or "")
   if (pref,season) not in missing:continue
   if req.get("level")!="prefecture":continue
   if re.search(r"秋季(?:関東|北信越|東海|近畿|中国|四国|九州|東北)大会",title):continue
   if not raw:continue
   rows=imp.normalize_approved_rows(raw,"prefecture")
   bad=[x for x in rows if str(x.get("year"))!="2024" or x.get("season")!=season
        or x.get("prefecture")!=pref or imp._import_identity(x) is None]
   if bad:raise ValueError("incorrect row metadata")
   target=Path("data/imported/2024")/season/(pref+".csv")
   count,_,_=imp.merge_csv(target,rows,mode="append")
   stats["articles_imported"]+=1;stats["parsed"]+=len(rows);stats["added"]+=count
   added_by_pref[pref]+=count
   items.append({"prefecture":pref,"season":season,"article":url,"parsed":len(rows),"added":count,"warnings":warnings[:3]})
   print(f"{index}/{len(chosen)} {pref} {season}: {len(rows)} found, {count} new",flush=True)
  except Exception as e:
   stats["source_failed"]+=1
   if len(items)<500:items.append({"prefecture":pref,"article":url,"error":str(e)[:150]})
  time.sleep(0.3)
 if stats["source_failed"] and not stats["added"]:\n  stats["blocked_no_new_rows"]=1\n result={"run_at":datetime.now(timezone.utc).isoformat(),"year":"2024",
         "target":"previously empty spring/summer prefecture units",
         "missing_units_initial":len(missing),"articles_examined":len(chosen),
         "statistics":dict(stats),"added_by_prefecture":dict(added_by_pref),
         "items":items,"completeness_verified":False}
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"articles_examined":len(chosen),"stats":dict(stats),"prefecture_totals":dict(added_by_pref)},ensure_ascii=False))\n if stats["source_failed"] and not stats["added"]:\n  raise SystemExit("SOURCE BLOCKED: no rows were added; this action must not be marked successful")
if __name__=="__main__":main()
