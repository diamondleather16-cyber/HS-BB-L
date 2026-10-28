#!/usr/bin/env python3
"""Restore exact 1R rounds mistakenly assigned district_qualifier in source CSV.
All available years; Tokyo/Hokkaido held for their special tournament rules.
Stable source line positions preserved; audit all changes.
"""
import csv,json,re,unicodedata
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
ROOT=Path("data")
DETAIL=Path("master/restore_1r_prefecture_changes.csv")
REPORT=Path("master/restore_1r_prefecture_audit.json")
COLS=["source_file","source_line","year","season","prefecture","tournament","round","team1","score1","team2","score2","previous_level","new_level"]
def level(row):
 m=re.search(r"(?:^|;)\s*level=([^;]+)",str(row.get("note") or ""))
 return (m.group(1).strip() if m else "") or str(row.get("level") or "").strip()
def exact_1r(value):
 return re.sub(r"[\s　]+","",unicodedata.normalize("NFKC",str(value or ""))).upper()=="1R"
def target(r):
 p=str(r.get("prefecture") or "").strip()
 return bool(p and p not in ("東京","東東京","西東京","北海道","北北海道","南北海道")
             and exact_1r(r.get("round")) and level(r)=="district_qualifier")
def rewrite_note(s):
 parts=[x for x in str(s or "").split(";") if x and not x.strip().startswith("level=")]
 return ";".join(["level=prefecture",*parts])
def main():
 scanned=0;matches=[];changed_files=[];held=Counter()
 for p in sorted(ROOT.rglob("*.csv")):
  if p.name=="template.csv":continue
  with p.open(encoding="utf-8-sig",newline="") as f:
   rd=csv.DictReader(f);cols=rd.fieldnames or []
   if not {"year","season","prefecture","round","note","team1","team2"}.issubset(cols):continue
   rows=list(rd)
  modified=False
  for line,r in enumerate(rows,2):
   scanned+=1
   if exact_1r(r.get("round")) and level(r)=="district_qualifier" and str(r.get("prefecture") or "").strip() in ("東京","東東京","西東京","北海道","北北海道","南北海道"):
    held[str(r.get("prefecture"))]+=1
   if not target(r):continue
   matches.append(dict(zip(COLS,[str(p),line,r.get("year",""),r.get("season",""),r.get("prefecture",""),r.get("tournament",""),r.get("round",""),r.get("team1",""),r.get("score1",""),r.get("team2",""),r.get("score2",""),level(r),"prefecture"])))
   r["note"]=rewrite_note(r.get("note"))
   if "level" in cols:r["level"]="prefecture"
   modified=True
  if modified:
   with p.open("w",encoding="utf-8-sig",newline="") as f:
    wr=csv.DictWriter(f,fieldnames=cols,extrasaction="ignore");wr.writeheader();wr.writerows(rows)
   changed_files.append(str(p))
 DETAIL.parent.mkdir(parents=True,exist_ok=True)
 with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
  wr=csv.DictWriter(f,fieldnames=COLS);wr.writeheader();wr.writerows(matches)
 report={"created_at":datetime.now(timezone.utc).isoformat(),"rule":"round exactly 1R (NFKC), level district_qualifier -> prefecture; Tokyo/Hokkaido excluded","scanned":scanned,"changed":len(matches),"by_year":dict(sorted(Counter(x["year"] for x in matches).items())),"by_prefecture":dict(sorted(Counter(x["prefecture"] for x in matches).items())),"files_changed":changed_files,"tokyo_hokkaido_review_counts":dict(held)}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"scanned":scanned,"changed":len(matches),"files_changed":len(changed_files),"exempt":dict(held)},ensure_ascii=False))
if __name__=="__main__":main()
