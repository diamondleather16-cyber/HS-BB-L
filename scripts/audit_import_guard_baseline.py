#!/usr/bin/env python3
"""Read-only regression test for safer import identities on the existing ledger.

Never deletes, filters, or edits registered games. An existing import may be
identified across CSVs only when its source article, season, date, teams, and
scores all agree. Article URL is provenance, not itself a match identifier.
"""
from collections import Counter,defaultdict
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode
import csv,json,re,datetime,hashlib

SOURCE=Path("output/all_matches.csv")
REPORT=Path("output/audit/import_guard_baseline.json")
EXAMPLES=Path("output/audit/import_guard_candidates.csv")

def team(s):
 s=re.sub(r"^[\s　■□▪▫●○◆◇▲△▼▽★☆◎◉◯・･▶▷▸▹►▻✓✔☑☐☒※]+","",str(s or ""))
 return re.sub(r"[\s　]+","",s)

def source(s):
 s=str(s or "").strip()
 if not s.startswith(("https://","http://")):return ""
 p=urlsplit(s)
 return urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path.rstrip("/"),"", ""))

def signed_result(r):
 return tuple(sorted(((team(r.get("team1")),str(r.get("score1") or "").strip()),(team(r.get("team2")),str(r.get("score2") or "").strip()))))

def key(r):
 url=source(r.get("source_url"))
 fields=(str(r.get("year") or "").strip(),str(r.get("season") or "").strip(),str(r.get("date") or "").strip())
 sides=signed_result(r)
 if not url or not all(fields) or not all(k and re.fullmatch(r"\d{1,3}",v) for k,v in sides):return None
 if sides[0][0]==sides[1][0]:return None
 return (url,*fields,sides)

def pair(r):
 return (str(r.get("year") or "").strip(),str(r.get("season") or "").strip(),str(r.get("date") or "").strip(),tuple(sorted((team(r.get("team1")),team(r.get("team2"))))))

def main():
 if not SOURCE.exists():raise SystemExit("output/all_matches.csv unavailable")
 collisions=defaultdict(list); pairs=defaultdict(set); stats=Counter()
 with SOURCE.open(encoding="utf-8-sig",newline="") as f:
  for row_idx,r in enumerate(csv.DictReader(f),start=2):
   stats["all_rows"]+=1
   k=key(r)
   if k is None:
    stats["no_confident_key"]+=1
    continue
   stats["with_confident_key"]+=1
   collisions[k].append({"match_id":r.get("match_id") or "","file":r.get("_source_file") or "","row":r.get("_source_row") or "",
     "prefecture":r.get("prefecture") or "","tournament":r.get("tournament") or "","round":r.get("round") or "","note":r.get("note") or ""})
   pairs[(k[0],pair(r))].add(k[-1])
 report_rows=[]
 for k,group in collisions.items():
  if len(group)<2:continue
  stats["candidate_groups"]+=1
  stats["candidate_rows"]+=len(group)
  locations={x["file"] for x in group}
  if len(locations)>1:stats["cross_file_groups"]+=1
  if len({x["tournament"] for x in group})>1:stats["cross_tournament_groups"]+=1
  if len({x["prefecture"] for x in group})>1:stats["cross_prefecture_groups"]+=1
  if len({x["note"] for x in group})>1:stats["different_notes_groups"]+=1
  if len({x["round"] for x in group})>1:stats["different_round_groups"]+=1
  for item in group:
   report_rows.append({"source_url":k[0],"year":k[1],"season":k[2],"date":k[3],
      "game":json.dumps(k[4],ensure_ascii=False),"copies":len(group),**item})
 stats["source_same_day_team_score_conflict_groups"]=sum(len(score_versions)>1 for score_versions in pairs.values())
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 with EXAMPLES.open("w",encoding="utf-8-sig",newline="") as f:
  cols=["source_url","year","season","date","game","copies","match_id","file","row","prefecture","tournament","round","note"]
  w=csv.DictWriter(f,fieldnames=cols);w.writeheader();w.writerows(report_rows)
 payload={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "source_sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  "statistics":dict(stats),"candidate_csv":str(EXAMPLES),
  "rule":"source URL + year/season/date + unordered (team, score) pair",
  "caution":"Matching key is evidence for an import warning, not automatic deletion; same URL can cover multiple games and provenance is not independently verified.",
  "changes_to_data":False}
 REPORT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(payload["statistics"],ensure_ascii=False))
if __name__=="__main__":main()
