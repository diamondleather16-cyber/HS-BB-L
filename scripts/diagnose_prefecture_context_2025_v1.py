#!/usr/bin/env python3
"""Debug missing 2025 prefecture contexts without touching ratings or source ledger."""
import csv,json
from collections import defaultdict
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
EV=ROOT/"output/rating_events.csv"
CTX=ROOT/"output/prefecture_match_context.csv"
ALL=ROOT/"output/all_matches.csv"
OUT=ROOT/"docs/data/audit/prefecture_context_coverage_2025_v1.json"
def read(path):
 with path.open(encoding="utf-8-sig",newline="") as f:
  yield from csv.DictReader(f)
def key(r):
 return "|".join(str(r.get(k) or "") for k in ("year","season","date","tournament","round","team1","score1","team2","score2"))
def main():
 if not all(x.exists() for x in (EV,CTX,ALL)):raise SystemExit("Missing one or more rating/prefecture input CSVs")
 contexts={x["match_key"]:x for x in read(CTX) if x.get("match_key","").startswith("2025|")}
 matches={key(x):x for x in read(ALL) if str(x.get("year"))=="2025"}
 regions=defaultdict(lambda:{"rated_games":0,"with_context":0,"without_context":0,"sample_no_context":[],"sample_context":[]})
 absent=[];context_keys=set()
 for x in read(EV):
  if str(x.get("year"))!="2025" or x.get("level") not in {"regional","national"}:continue
  k=x.get("match_key") or ""
  region=str(x.get("region") or "?")
  st=regions[region];st["rated_games"]+=1
  found=contexts.get(k);context_keys.add(k)
  if found:
   st["with_context"]+=1
   if len(st["sample_context"])<3:st["sample_context"].append({"key":k,"pref1":found.get("pref1"),"pref2":found.get("pref2"),"strength1":found.get("pref_strength_component1")})
  else:
   st["without_context"]+=1
   if len(st["sample_no_context"])<5:
    st["sample_no_context"].append({"key":k,"present_in_all_matches":k in matches,
     "same_tournament_in_context":sum(1 for c in contexts.values() if c.get("match_key","").split("|")[3:4]==k.split("|")[3:4])})
 report={"generated_at":datetime.now(timezone.utc).isoformat(),"scope":"2025 regional+national",
  "context_records_2025":len(contexts),"source_matches_2025":len(matches),
  "regions":dict(regions),"notes":["Find which 2025 rating fixture keys lack a matching prefecture match_context entry.",
  "Source and context key differences or missing prefecture school identities may cause the failure.",
  "Only a diagnostic; does not change the rating."],"context_absent_from_rating_count":len(context_keys-set(contexts))}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("PREF_CONTEXT_COVERAGE_2025",json.dumps(report,ensure_ascii=False)[:12000])
if __name__=="__main__":main()
