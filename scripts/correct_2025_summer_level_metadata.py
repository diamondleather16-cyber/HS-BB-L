#!/usr/bin/env python3
"""Label existing 2025 summer prefectural CSV rows, without adding/deleting games."""
import csv,json,re,os,tempfile
from pathlib import Path
from collections import Counter
Q=Path("master/nationwide_2021_2026_gap_queue.csv")
OUT=Path("master/2025_summer_level_correction.json")
def main():
 with Q.open(encoding="utf-8-sig",newline="") as f:
  targets=[r for r in csv.DictReader(f) if r["next_action"]=="review_existing_level" and r["year"]=="2025" and r["season"]=="summer"]
 if len(targets)!=15:raise SystemExit(f"Expected 15 existing-unit targets, got {len(targets)}")
 changes=[];files=[]
 for target in targets:
  ps=target["source_files"].split(";")
  if len(ps)!=1:raise SystemExit(f"Unexpected source files for {target['prefecture']}: {ps}")
  path=Path(ps[0])
  with path.open(encoding="utf-8-sig",newline="") as f:
   reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
  if not fields or "note" not in fields:raise SystemExit(f"Missing columns: {path}")
  changed=0;existing=0
  for r in rows:
   if str(r.get("year"))!="2025" or r.get("season")!="summer" or r.get("prefecture")!=target["prefecture"]:continue
   name=r.get("tournament") or ""
   if not ("選手権" in name and target["prefecture"] in name):raise SystemExit(f"Unexpected tournament: {path}: {name}")
   note=str(r.get("note") or "")
   if re.search(r"(?:^|;)level=(?:regional|national)",note):raise SystemExit(f"Conflicting level in {path}")
   if "level=prefecture" in note:existing+=1;continue
   r["note"]="level=prefecture"+(";" + note if note else "")
   changed+=1
  if changed!=int(target["existing_unknown_level_rows"]):raise SystemExit(f"Count mismatch {path} {changed} != {target['existing_unknown_level_rows']}")
  files.append((path,fields,rows))
  changes.append({"prefecture":target["prefecture"],"file":str(path),"rows_labeled":changed})
 for path,fields,rows in files:
  with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8-sig",newline="",dir=path.parent,delete=False) as f:
   w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows);temp=Path(f.name)
  os.replace(temp,path)
 OUT.write_text(json.dumps({"status":"labeled_existing_2025_summer_prefecture_rows","units":len(changes),"rows_labeled":sum(x["rows_labeled"] for x in changes),"details":changes,"games_added":0,"games_deleted":0},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(OUT.read_text(encoding="utf-8"))
if __name__=="__main__":main()
