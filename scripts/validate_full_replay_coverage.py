#!/usr/bin/env python3
"""Audit chronological 2008+ replay with per-year match coverage and a concrete 2023 case."""
import csv,json,re
from pathlib import Path
from collections import Counter,defaultdict
def read(p):
 with Path(p).open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def score(s):
 try:return str(int(float(s)))
 except (ValueError,TypeError):return str(s or "").strip()
def sig(r):
 return (str(r.get("year") or ""),str(r.get("season") or ""),
         tuple(sorted(((str(r.get("team1") or "").strip(),score(r.get("score1"))),
                       (str(r.get("team2") or "").strip(),score(r.get("score2")))))))
def evsig(r):
 return sig(r)
ledger=read("output/all_matches.csv")
hist=read("docs/data/historical_ledger_2017_2024.csv")
events=read("output/rating_events.csv")
school=read("output/rating_school_events.csv")
by_event=defaultdict(list)
for e in events:by_event[evsig(e)].append(e)
by_school=Counter((e.get("match_key"),e.get("school_id")) for e in school if e.get("event_type")=="match")
summary={}
for year in range(2008,2027):
 rows=[r for r in ledger+hist if str(r.get("year"))==str(year)]
 uniq={sig(r) for r in rows}
 rated={sig(r) for r in events if str(r.get("year"))==str(year)}
 summary[str(year)]={"source_rows":len(rows),"distinct_fixtures":len(uniq),"rated_fixtures":len(rated),
  "source_without_rated_fixture":len(uniq-rated),
  "undated_source_rows":sum(not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(r.get("date") or "")) for r in rows)}
target=[r for r in hist+ledger if str(r.get("year"))=="2023" and r.get("season")=="spring" and r.get("tournament")=="2023春季北信越地区大会"]
expected={sig(r) for r in target}
details=[]
for k in sorted(expected):
 match=by_event.get(k,[])
 has_school=False
 if len(match)==1:
  e=match[0];has_school=all(bool(e.get(side+"_school_id")) and by_school[(e.get("match_key"),e.get(side+"_school_id"))]>0 for side in ("team1","team2"))
 details.append({"teams":k[2],"event_count":len(match),"school_history_both_sides":has_school,
   "rated_dates":sorted({e.get("date") for e in match})})
payload={"years":summary,"spring_hokushinetsu_2023":{"expected_games":len(expected),"games":details,
 "rated_games":sum(bool(x["event_count"]) for x in details),
 "both_school_histories":sum(x["school_history_both_sides"] for x in details)}}
out=Path("output/audit/full_replay_coverage_2008_2026.json")
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("FULL_REPLAY_COVERAGE",json.dumps({"spring_hokushinetsu_2023":payload["spring_hokushinetsu_2023"]},ensure_ascii=False),flush=True)
if len(expected)!=7 or payload["spring_hokushinetsu_2023"]["rated_games"]!=7 or payload["spring_hokushinetsu_2023"]["both_school_histories"]!=7:
 raise SystemExit("REPLAY_VALIDATION_FAILED: 2023 spring Hokushinetsu 7 fixtures must be rated and linked to both school histories")
