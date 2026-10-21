#!/usr/bin/env python3
"""Repair one corrupted 2024 Yamaguchi article with explicit UTF-8 decoding."""
import csv,json,re
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
URL="https://koshien89.com/blog-entry-3237.html"
def main():
 response=imp.http_get(URL,timeout=(5,20));response.raise_for_status()
 raw=response.content
 html=raw.decode("utf-8")
 matches,warnings=imp.parse_koshien89(html,{"year":2024})
 clean=[g for g in matches if g["date"] and g["round"] and
        not re.search(r"[\u0400-\u04ff]",g["team1"]+g["team2"])]
 rows=[{"year":"2024","season":"spring","region":"中国","prefecture":"山口",
   "tournament":"春季山口大会2024","round":g["round"],"date":g["date"],
   "team1":g["team1"],"score1":g["score1"],"team2":g["team2"],"score2":g["score2"],
   "source_url":URL,"note":"level=prefecture;corrected_utf8_html"} for g in clean]
 dest=Path("data/imported/2024/spring/山口.csv")
 added=0
 if len(rows)>=20:added,_,_=imp.merge_csv(dest,rows,mode="append")
 result={"article":URL,"parsed":len(matches),"validated":len(rows),
   "added":added,"warnings":warnings,"saved":bool(added),"source_encoding":"utf-8"}
 out=Path("master/staging_2021_2024/yamaguchi_2024_repair.json")
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(result,ensure_ascii=False))
 if len(rows)<20:raise SystemExit("Article parsing still incomplete; did not publish")
if __name__=="__main__":main()
