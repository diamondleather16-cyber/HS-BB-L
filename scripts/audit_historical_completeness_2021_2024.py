#!/usr/bin/env python3
"""Audit 2021-24 prefecture tournament completeness by rows, rounds and dates."""
import csv,json,collections,re
from pathlib import Path
P=Path("master")
def read(p):
 with p.open(encoding="utf-8-sig",newline="") as f:yield from csv.DictReader(f)
def main():
 groups=collections.defaultdict(list);scanned=0
 for path in Path("data").rglob("*.csv"):
  if path.name in ("template.csv","all_matches.csv","current_ratings.csv"):continue
  try:
   for r in read(path):
    y=str(r.get("year") or "").strip()
    if y not in ("2021","2022","2023","2024"):continue
    if r.get("season") not in ("spring","summer","autumn"):continue
    if not re.search(r"(?:^|;)level=prefecture(?:;|$)",str(r.get("note") or "")) and r.get("level")!="prefecture":continue
    if not r.get("prefecture"):continue
    title=str(r.get("tournament") or "")
    if r["prefecture"]=="岡山" and "鳥取大会" in title:continue
    groups[(y,r["season"],r["prefecture"])].append(r);scanned+=1
  except (OSError,UnicodeError,csv.Error):continue
 coverage=list(read(P/"nationwide_all_data_coverage_2021_2026.csv"))
 out=[]
 for v in coverage:
  if v["year"] not in ("2021","2022","2023","2024"):continue
  key=v["year"],v["season"],v["prefecture"]
  rows=groups[key];rounds=collections.Counter(str(r.get("round") or "") for r in rows)
  dates=[str(r.get("date") or "") for r in rows if re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(r.get("date") or ""))]
  has_final=any(rnd=="F" or ("決勝" in rnd and "準決勝" not in rnd and "準々決勝" not in rnd and "3位" not in rnd) for rnd in rounds)
  has_early=any(re.search(r"[1１2２]回戦|支部|予選",rnd) or rnd in ("1R","2R") for rnd in rounds)
  statuses=[]
  if not rows:statuses.append("no_rows")
  else:
   if not has_final:statuses.append("final_not_seen")
   if not has_early:statuses.append("early_round_not_seen")
   if len(rows)<12:statuses.append("fewer_than_12_games")
   if len(dates)<len(rows):statuses.append("missing_dates")
  out.append({"year":key[0],"season":key[1],"prefecture":key[2],"games":len(rows),
    "first_date":min(dates) if dates else "","last_date":max(dates) if dates else "",
    "final_seen":int(has_final),"early_round_seen":int(has_early),
    "unique_rounds":len(rounds),"flags":";".join(statuses),
    "assessment":"review" if statuses else "no_obvious_gap"})
 dest=P/"historical_completeness_2021_2024.csv"
 with dest.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=list(out[0]));w.writeheader();w.writerows(out)
 report={"total_units":len(out),"rows_scanned":scanned,"no_rows":sum(v["games"]==0 for v in out),
  "flagged_units":sum(v["assessment"]=="review" for v in out),
  "not_flagged":sum(v["assessment"]=="no_obvious_gap" for v in out),
  "caveat":"Heuristic flags are not proof of missing games; absence of flags is not proof of full tournament coverage."}
 (P/"historical_completeness_summary_2021_2024.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
