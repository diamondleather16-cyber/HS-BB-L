#!/usr/bin/env python3
"""Correct demonstrable Chugoku prefecture swaps from explicit tournament names, 2021-26.
No score, date or school names are changed. Idempotent, keeps original source paths.
"""
import csv,re,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PREFS=("鳥取","島根","岡山","広島","山口")
def title_pref(t):
 t=str(t or "")
 found=[p for p in PREFS if re.search(re.escape(p)+r"(?:県|府)?大会",t)]
 return found[0] if len(found)==1 else None
def main():
 changed=collections.Counter()
 for file in sorted((ROOT/"data").rglob("*.csv")):
  if file.name in ("all_matches.csv","current_ratings.csv","template.csv"):continue
  try:
   with file.open(encoding="utf-8-sig",newline="") as f:
    reader=csv.DictReader(f);fields=reader.fieldnames or []
    if not {"year","prefecture","tournament","team1","team2"}.issubset(fields):continue
    rows=list(reader)
   dirty=False
   for r in rows:
    if str(r["year"]) not in ("2021","2022","2023","2024","2025","2026"):continue
    origin=r.get("prefecture")
    if origin not in PREFS:continue
    target=title_pref(r.get("tournament"))
    if not target or target==origin:continue
    r["prefecture"]=target
    changed[(str(r["year"]),origin,target)]+=1;dirty=True
   if dirty:
    with file.open("w",encoding="utf-8-sig",newline="") as f:
     w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
  except (UnicodeError,OSError,csv.Error):continue
 for (year,old,new),n in sorted(changed.items()):
  print(year,old,"=>",new,n)
 print("TOTAL_CORRECTED_ROWS",sum(changed.values()))
if __name__=="__main__":main()
