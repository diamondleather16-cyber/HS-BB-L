#!/usr/bin/env python3
"""Edit source CSVs in-place: 2021+ prefecture-level rows with 地区予選 in round.
Tokyo/Hokkaido explicitly excluded. No rows deleted or reordered: stable row IDs remain.
Idempotent. Emits audit with before/after and locations.
"""
import csv,json,re
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone

ROOT=Path("data")
REPORT=Path("master/round_district_qualifier_2021_audit.json")
DETAIL=Path("master/round_district_qualifier_2021_changes.csv")
FIELDS=("source_file","source_line","year","season","prefecture","round","tournament","team1","team2","old_level","new_level")
def level(note):
 m=re.search(r"(?:^|;)\s*level=([^;]+)",str(note or ""))
 return m.group(1).strip() if m else ""
def change_level(note):
 parts=[v for v in str(note or "").split(";") if v and not v.strip().startswith("level=")]
 return ";".join(["level=district_qualifier",*parts])
def target(row):
 try: year=int(str(row.get("year") or "").strip())
 except ValueError:return False
 if year<2021:return False
 pref=str(row.get("prefecture") or "").strip()
 if not pref or "東京" in pref or "北海道" in pref:return False
 round_=str(row.get("round") or "").replace(" ","").replace("　","")
 if "地区予選" not in round_:return False
 current=level(row.get("note")) or str(row.get("level") or "").strip()
 return current=="prefecture"
def main():
 changes=[];scanned=0;files_changed=[]
 for path in sorted(ROOT.rglob("*.csv")):
  if path.name=="template.csv":continue
  with path.open("r",encoding="utf-8-sig",newline="") as f:
   reader=csv.DictReader(f);fields=reader.fieldnames or []
   if not {"year","season","prefecture","round","note","team1","team2"}.issubset(fields):continue
   rows=list(reader)
  dirty=False
  for line,row in enumerate(rows,2):
   scanned+=1
   if not target(row):continue
   old=level(row.get("note")) or str(row.get("level") or "").strip()
   changes.append(dict(zip(FIELDS,[str(path),line,row.get("year",""),row.get("season",""),row.get("prefecture",""),row.get("round",""),row.get("tournament",""),row.get("team1",""),row.get("team2",""),old,"district_qualifier"])))
   row["note"]=change_level(row.get("note"))
   if "level" in fields:row["level"]="district_qualifier"
   dirty=True
  if dirty:
   with path.open("w",encoding="utf-8-sig",newline="") as f:
    w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");w.writeheader();w.writerows(rows)
   files_changed.append(str(path))
 DETAIL.parent.mkdir(parents=True,exist_ok=True)
 with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(changes)
 report={"generated_at":datetime.now(timezone.utc).isoformat(),"scope":"2021+ source CSV, prefecture tier, round contains 地区予選, except Tokyo and Hokkaido","scanned":scanned,"changed":len(changes),"files_changed":files_changed,"by_year":dict(sorted(Counter(x["year"] for x in changes).items())),"by_prefecture":dict(sorted(Counter(x["prefecture"] for x in changes).items()))}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"scanned":scanned,"changed":len(changes),"files":len(files_changed)},ensure_ascii=False))
if __name__=="__main__": main()
