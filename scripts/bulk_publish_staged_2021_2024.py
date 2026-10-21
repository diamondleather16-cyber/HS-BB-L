#!/usr/bin/env python3
"""Publish validated 2021-24 staged games only. Keep source exceptions quarantined.

This bulk import is additive: it never deletes existing games. Each accepted game
must match an identified 89 category-article URL, prefecture, year and season.
"""
import csv,json,re,collections
from pathlib import Path
from datetime import datetime,timezone
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

STAGE=Path("master/staging_2021_2024/staged_matches.csv")
REPORT=Path("master/staging_2021_2024/bulk_publish_report.json")
EXCEPTIONS=Path("master/staging_2021_2024/bulk_publish_exceptions.csv")
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def key(r):
 y=str(r.get("year") or "").strip();s=str(r.get("season") or "").strip()
 d=str(r.get("date") or "").strip()
 a=sorted([(str(r.get("team1") or "").strip(),str(r.get("score1") if r.get("score1") is not None else "").strip()),
           (str(r.get("team2") or "").strip(),str(r.get("score2") if r.get("score2") is not None else "").strip())])
 return (y,s,d,tuple(a))
def main():
 allow={}
 for year in range(2021,2025):
  for r in read(Path(f"master/priority_{year}_article_links.csv")):
   label=r.get("link_title") or ""
   if r["prefecture"] in label and r["year"] in label:
    allow[(r["year"],r["season"],r["prefecture"],r["source_url"])]=label
 src=read(STAGE)
 known=set();counts=collections.Counter()
 for path in Path("data").rglob("*.csv"):
  if path.name=="template.csv":continue
  try:
   for r in read(path):
    if str(r.get("year") or "") not in ("2021","2022","2023","2024"):continue
    known.add(key(r))
  except (OSError,UnicodeError,csv.Error):continue
 eligible=collections.defaultdict(list);quarantine=[];staged_seen=set()
 for r in src:
  y=r["year"];s=r["season"];p=r["prefecture"];u=r["article_url"]
  reason=""
  if (y,s,p,u) not in allow:reason="source_title_not_verified"
  elif not re.fullmatch(r"202[1-4]-\d{2}-\d{2}",r.get("date") or ""):reason="missing_or_invalid_date"
  elif not (r.get("round") or "").strip():reason="missing_round"
  elif not all((r.get(c) or "").strip() for c in ("team1","team2")):reason="missing_team"
  elif any(re.search(r"[\u0400-\u04FF]",r.get(c) or "") for c in ("team1","team2")):reason="possible_mojibake"
  elif not all(str(r.get(c) or "").isdigit() for c in ("score1","score2")):reason="invalid_score"
  k=key(r)
  if not reason and k in staged_seen:reason="staging_duplicate"
  if not reason and k in known:reason="already_exists"
  if reason:
   counts[reason]+=1;quarantine.append({**r,"reason":reason})
   continue
  staged_seen.add(k)
  tour=allow[(y,s,p,u)].strip()
  item={"year":y,"season":s,"region":imp.PREF_TO_REGION.get(p,""),"prefecture":p,
        "tournament":tour,"round":r["round"],"date":r["date"],
        "team1":r["team1"],"score1":r["score1"],"team2":r["team2"],"score2":r["score2"],
        "source_url":u,"note":"level=prefecture;historical_staging_2021_2024"}
  eligible[(y,s,p)].append(item)
 totals=collections.Counter()
 for (y,s,p),items in sorted(eligible.items()):
  dest=Path("data/imported")/y/s/(p+".csv")
  added,_,_=imp.merge_csv(dest,items,mode="append")
  totals["newly_registered"]+=added;totals["eligible"]+=len(items)
  totals["target_csv_files"]+=1
  if added!=len(items):totals["skipped_by_import_guard"]+=len(items)-added
 EXCEPTIONS.parent.mkdir(parents=True,exist_ok=True)
 with EXCEPTIONS.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=["year","season","prefecture","article_url","round","date","team1","score1","team2","score2","raw_line","reason"]);w.writeheader();w.writerows(quarantine)
 report={"timestamp":datetime.now(timezone.utc).isoformat(),"stage_rows":len(src),
        "counts":dict(counts),"register":dict(totals),"exception_rows":len(quarantine),
        "years":"2021-2024","no_deletions":True,
        "caution":"Article category-title checks are not an independent official result audit. Existing games were retained."}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False),flush=True)
 if totals["newly_registered"]<100:raise SystemExit("Suspiciously few games registered; inspect output")
if __name__=="__main__":main()
