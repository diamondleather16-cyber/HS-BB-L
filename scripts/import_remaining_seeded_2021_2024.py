#!/usr/bin/env python3
"""Add carefully sourced missing prefecture tournament games from known 89 articles."""
import csv,json,re
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
ROOT=Path("master")
def main():
 with (ROOT/"remaining_source_seeds_2021_2024.csv").open(encoding="utf-8-sig",newline="") as f:
  seeds=list(csv.DictReader(f))
 counts=[]
 for item in seeds:
  response=imp.http_get(item["source_url"],timeout=(5,20));response.raise_for_status()
  response.encoding="utf-8"
  games,warnings=imp.parse_koshien89(response.text,{"year":int(item["year"])})
  clean=[];rejected=0
  for g in games:
   if not g.get("date") or not g.get("round") or "地区大会" in g["round"]:
    rejected+=1;continue
   if not re.fullmatch(item["year"]+r"-\d{2}-\d{2}",g["date"]):
    rejected+=1;continue
   if re.search(r"[\u0400-\u04ff]",g["team1"]+g["team2"]):
    rejected+=1;continue
   clean.append({"year":item["year"],"season":item["season"],
      "region":imp.PREF_TO_REGION.get(item["prefecture"],""),
      "prefecture":item["prefecture"],
      "tournament":("春季" if item["season"]=="spring" else "秋季" if item["season"]=="autumn" else "選手権")+item["prefecture"]+"大会"+item["year"],
      "round":g["round"],"date":g["date"],"team1":g["team1"],"score1":g["score1"],
      "team2":g["team2"],"score2":g["score2"],"source_url":item["source_url"],
      "note":"level=prefecture;web_exact_url_2021_2024"})
  added=0
  if len(clean)>=12:
   dest=Path("data/imported")/item["year"]/item["season"]/(item["prefecture"]+".csv")
   added,_,_=imp.merge_csv(dest,clean,mode="append")
  counts.append({**item,"parsed":len(games),"eligible":len(clean),"rejected":rejected,"added":added,"warnings":warnings})
 report={"results":counts,"added":sum(i["added"] for i in counts),"successful_units":sum(i["added"]>0 for i in counts),"no_existing_deletions":True}
 (ROOT/"remaining_source_seeds_import_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
 if report["successful_units"]<3:raise SystemExit("Too few imports; inspect source pages")
if __name__=="__main__":main()
