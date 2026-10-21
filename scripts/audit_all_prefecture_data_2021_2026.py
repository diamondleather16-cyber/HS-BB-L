#!/usr/bin/env python3
"""Nationwide 2021-2026 coverage audit across ALL data CSV trees, not just imported.

Read-only: separate strong prefectural evidence from ambiguous region-level
records and reveal which supposed gaps already have matches in other roots.
"""
import csv,json,re,collections,datetime
from pathlib import Path
PREFS="北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
SEASONS=("spring","summer","autumn")
OUT=Path("master/nationwide_all_data_coverage_2021_2026.csv")
SUMMARY=Path("master/nationwide_all_data_coverage_summary.json")
def level(row):
 note=str(row.get("note") or "")
 m=re.search(r"(?:^|;)level=([a-z]+)",note)
 return m.group(1) if m else str(row.get("level") or "")
def main():
 units=collections.defaultdict(lambda:collections.Counter())
 locations=collections.defaultdict(set)
 files=0;allrows=0;unassigned=0
 for p in sorted(Path("data").rglob("*.csv")):
  if p.name=="template.csv":continue
  try:
   with p.open(encoding="utf-8-sig",newline="") as f:
    rd=csv.DictReader(f)
    if not rd.fieldnames or not {"year","season","team1","team2","prefecture"}.issubset(rd.fieldnames):continue
    files+=1
    for row in rd:
     y=str(row.get("year") or "").strip();s=str(row.get("season") or "").strip()
     if y not in {str(i) for i in range(2021,2027)} or s not in SEASONS:continue
     allrows+=1
     pref=str(row.get("prefecture") or "").strip()
     if pref not in PREFS:unassigned+=1;continue
     key=(y,s,pref); lev=level(row)
     units[key]["all_pref_tagged_rows"]+=1
     if lev=="prefecture":units[key]["explicit_prefecture_rows"]+=1
     elif lev=="regional":units[key]["explicit_regional_rows"]+=1
     elif lev=="national":units[key]["explicit_national_rows"]+=1
     else:units[key]["level_unknown_rows"]+=1
     locations[key].add(str(p))
  except (OSError,UnicodeError,csv.Error) as exc:
   print(f"Skipped unreadable {p}: {exc}",flush=True)
 previous={}
 old=Path("master/nationwide_2021_2026_inventory.csv")
 if old.exists():
  with old.open(encoding="utf-8-sig",newline="") as f:
   for r in csv.DictReader(f):previous[(r["year"],r["season"],r["prefecture"])]=r
 rows=[];counts=collections.Counter();recovered=[]
 for y in range(2021,2027):
  for s in SEASONS:
   for pref in PREFS:
    k=(str(y),s,pref);x=units[k];prev=previous.get(k,{})
    status=("explicit_prefecture_records" if x["explicit_prefecture_rows"] else
            "prefecture_tagged_level_unclear" if x["level_unknown_rows"] else
            "no_prefecture_level_evidence")
    counts[status]+=1
    if not int(prev.get("imported_prefecture_rows") or 0) and x["explicit_prefecture_rows"]:
     recovered.append({"year":y,"season":s,"prefecture":pref,"games":x["explicit_prefecture_rows"]})
    rows.append({"year":y,"season":s,"prefecture":pref,"status":status,
       **{k:x[k] for k in ("explicit_prefecture_rows","level_unknown_rows","explicit_regional_rows","explicit_national_rows","all_pref_tagged_rows")},
       "source_csv_count":len(locations[k]),"source_csv_paths":";".join(sorted(locations[k])),
       "previous_imported_rows":prev.get("imported_prefecture_rows","0"),
       "known_article_urls":prev.get("source_article_count","0")})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
 report={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
         "total_units":len(rows),"data_csv_files":files,"scanned_rows_2021_2026":allrows,
         "rows_without_prefecture":unassigned,"unit_status_counts":dict(counts),
         "previously_missing_but_found_elsewhere":recovered,
         "strict_coverage_percent":round(counts["explicit_prefecture_records"]*100/len(rows),2),
         "note":"Existence does not prove full round coverage or correctness. No source data changed."}
 SUMMARY.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"unit_status_counts":dict(counts),"strict_coverage_percent":report["strict_coverage_percent"],
                   "previously_missing_but_found_elsewhere_count":len(recovered),
                   "scanned_rows":allrows},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
