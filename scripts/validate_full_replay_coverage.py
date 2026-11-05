#!/usr/bin/env python3
"""Audit chronological 2008+ replay with per-year match coverage and a concrete 2023 case."""
import csv,json,re
from pathlib import Path
from collections import Counter,defaultdict
def read(p):
 with Path(p).open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
from dedupe_ledger_physical_fixtures import team as fixture_team, score as fixture_score
def sig(r):
 return (str(r.get("year") or ""),str(r.get("season") or ""),
         tuple(sorted(((fixture_team(r.get("team1")),fixture_score(r.get("score1"))),
                       (fixture_team(r.get("team2")),fixture_score(r.get("score2")))))))
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

# Examine every distinct recorded fixture, not only the 2023 example.
source_index={}
for r in ledger+hist:
 k=sig(r)
 source_index.setdefault(k, r)
missing=[]
by_tournament=defaultdict(lambda: {"source":0,"not_rated":0,"missing_school_history":0,"date_blank":0})
for k,r in source_index.items():
 group=(str(r.get("year") or ""),str(r.get("season") or ""),str(r.get("tournament") or ""))
 agg=by_tournament[group]
 agg["source"]+=1
 if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(r.get("date") or "")):agg["date_blank"]+=1
 found=by_event.get(k,[])
 if not found:
  agg["not_rated"]+=1
  missing.append({"year":k[0],"season":k[1],"tournament":group[2],"team1":r.get("team1"),"team2":r.get("team2"),"issue":"no_rating_event"})
 elif not any(all(e.get(side+"_school_id") and by_school[(e.get("match_key"),e.get(side+"_school_id"))]>0 for side in ("team1","team2")) for e in found):
  agg["missing_school_history"]+=1
  missing.append({"year":k[0],"season":k[1],"tournament":group[2],"team1":r.get("team1"),"team2":r.get("team2"),"issue":"missing_both_sided_school_history"})
payload["all_tournaments"]=[{"year":k[0],"season":k[1],"tournament":k[2],**v} for k,v in sorted(by_tournament.items())]
payload["global"]={"distinct_source_fixtures":len(source_index),"unrated_fixtures":sum(v["not_rated"] for v in by_tournament.values()),"missing_both_sided_school_history":sum(v["missing_school_history"] for v in by_tournament.values()),"undated_fixtures":sum(v["date_blank"] for v in by_tournament.values())}
audit_dir=Path("output/audit");audit_dir.mkdir(parents=True,exist_ok=True)
with (audit_dir/"full_replay_missing_fixtures.csv").open("w",encoding="utf-8-sig",newline="") as f:
 w=csv.DictWriter(f,fieldnames=["year","season","tournament","team1","team2","issue"]);w.writeheader();w.writerows(missing)
print("ALL_TOURNAMENT_REPLAY_AUDIT",json.dumps(payload["global"],ensure_ascii=False),flush=True)

out=Path("output/audit/full_replay_coverage_2008_2026.json")
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("FULL_REPLAY_COVERAGE",json.dumps({"spring_hokushinetsu_2023":payload["spring_hokushinetsu_2023"]},ensure_ascii=False),flush=True)
if len(expected)!=7 or payload["spring_hokushinetsu_2023"]["rated_games"]!=7 or payload["spring_hokushinetsu_2023"]["both_school_histories"]!=7:
 raise SystemExit("REPLAY_VALIDATION_FAILED: 2023 spring Hokushinetsu 7 fixtures must be rated and linked to both school histories")
