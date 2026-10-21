#!/usr/bin/env python3
"""Parse archived 2021-24 article HTML into staging rows, never modify canonical data."""
import csv, json, hashlib, collections
from pathlib import Path
import process_import_requests as imp
ROOT=Path("master/raw_article_intake_2021_2024")
FIELDS=["year","season","prefecture","article_url","round","date","team1","score1","team2","score2","raw_line"]
def main():
 with (ROOT/"source_manifest.csv").open(encoding="utf-8-sig",newline="") as f:
  sources=list(csv.DictReader(f))
 stats=collections.Counter();issues=[]
 with (ROOT/"staged_matches.csv").open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=FIELDS);writer.writeheader()
  for source in sources:
   path=ROOT/(hashlib.sha256(source["url"].encode()).hexdigest()[:20]+".html")
   if not path.exists():stats['html_missing']+=1;continue
   req={"year":source["year"]}
   games,warnings=imp.parse_koshien89(path.read_text(encoding='utf-8'),req)
   stats['articles_parsed']+=1
   if warnings:issues.append({"url":source["url"],"warnings":warnings})
   for game in games:
    writer.writerow({"year":source["year"],"season":source["season"],"prefecture":source["prefecture"],"article_url":source["url"],"round":game["round"],"date":game["date"],"team1":game["team1"],"score1":game["score1"],"team2":game["team2"],"score2":game["score2"],"raw_line":game.get("raw","")})
    stats['matches_staged']+=1
 report={"statistics":dict(stats),"warnings":issues,"published_to_ledger":False}
 (ROOT/"staging_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({'statistics':dict(stats),'warning_articles':len(issues)},ensure_ascii=False))
 if stats['matches_staged']==0:raise SystemExit('No parsed matches')
if __name__=="__main__":main()
