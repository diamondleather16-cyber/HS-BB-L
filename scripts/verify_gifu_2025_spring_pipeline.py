#!/usr/bin/env python3
"""Read-only end-to-end receipt for corrected Gifu 2025 spring semifinal."""
import csv,json,sys
from pathlib import Path
from datetime import datetime,timezone
TARGET={"year":"2025","season":"spring","date":"2025-04-26","team1":"中京","score1":"2","team2":"岐阜第一","score2":"1"}
SOURCE="https://koshien89.com/blog-entry-3447.html"
FILES={
 "imported":Path("data/imported/2025/spring/岐阜.csv"),
 "merged":Path("output/all_matches.csv"),
 "published":Path("docs/data/all_matches.csv"),
 "rating_events":Path("docs/data/rating_events.csv"),
}
OUT=Path("output/audit/gifu_2025_spring_publication_receipt.json")
def norm(v):return str(v if v is not None else "").strip().lstrip("■")
def same(row):
 if any(norm(row.get(x))!=TARGET[x] for x in ("year","season","date")):return False
 a={(norm(row.get("team1")),norm(row.get("score1"))),(norm(row.get("team2")),norm(row.get("score2")))}
 b={(TARGET["team1"],TARGET["score1"]),(TARGET["team2"],TARGET["score2"])}
 return a==b
def scan(path):
 if not path.exists():return {"exists":False,"matching_games":0}
 n=0;rows=[]
 with path.open(encoding="utf-8-sig",newline="") as stream:
  for row in csv.DictReader(stream):
   if same(row):
    n+=1
    if len(rows)<3:rows.append({k:row.get(k) for k in ("region","prefecture","tournament","round","source_url","match_key","level","note")})
 return {"exists":True,"matching_games":n,"examples":rows}
def main():
 result={"time":datetime.now(timezone.utc).isoformat(),"game":TARGET,"source":SOURCE,
         "datasets":{name:scan(path) for name,path in FILES.items()},"mutated":False}
 imported=result["datasets"]["imported"]
 merged=result["datasets"]["merged"]
 published=result["datasets"]["published"]
 rating=result["datasets"]["rating_events"]
 result["pass_import"]=imported["matching_games"]==1
 result["pass_merged"]=merged["matching_games"]==1
 result["pass_published"]=published["matching_games"]==1
 # Rating events may have multiple records depending on replay; never infer
 # correctness only from the mere existence of the event.
 result["pass_rating_present"]=rating["matching_games"]>=1
 result["pass"]=all(result[x] for x in ("pass_import","pass_merged","pass_published","pass_rating_present"))
 result["caution"]="Presence proves pipeline inclusion, not numerical rating impact or source completeness."
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({k:result[k] for k in ("datasets","pass_import","pass_merged","pass_published","pass_rating_present","pass")},ensure_ascii=False))
 if not result["pass"]:sys.exit(1)
if __name__=="__main__":main()
