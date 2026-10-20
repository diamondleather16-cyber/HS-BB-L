#!/usr/bin/env python3
"""Second-pass triage of suspicious same-day pairings. Read only."""
import csv,json,re,collections,datetime,pathlib
P=pathlib.Path("output/all_matches.csv")
O=pathlib.Path("output/audit");O.mkdir(parents=True,exist_ok=True)
def n(v):return re.sub(r"[\s　■□▪▫●○◆◇]+","",str(v or "")).strip()
def level(r):
 m=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
 return m.group(1) if m else str(r.get("level") or "")
def base(r):
 a=(n(r.get("team1")),str(r.get("score1") or ""))
 b=(n(r.get("team2")),str(r.get("score2") or ""))
 return tuple(sorted((a,b)))
def broad(r):return (str(r.get("year") or ""),str(r.get("season") or ""),str(r.get("date") or ""),tuple(sorted((n(r.get("team1")),n(r.get("team2"))))))
rows=list(csv.DictReader(P.open(encoding="utf-8-sig",newline="")))
groups=collections.defaultdict(list)
for i,r in enumerate(rows):
 if all(broad(r)[0:3]) and all(broad(r)[3]):groups[broad(r)].append((i,r))
counts=collections.Counter(); examples=collections.defaultdict(list); lines=[]
for key,g in groups.items():
 if len(g)<2:continue
 sigs={base(r) for _,r in g}
 tour={n(r.get("tournament")) for _,r in g}
 areas={(n(r.get("region")),n(r.get("prefecture")),level(r)) for _,r in g}
 srcs={(n(r.get("_source_file")),n(r.get("_source_row"))) for _,r in g}
 scores_same=len(sigs)==1
 if len(sigs)>1:category="different_scores_review"
 elif len(tour)==1 and len(areas)==1:category="same_tournament_same_score"
 elif len(areas)>1:category="cross_level_or_region_same_score"
 else:category="different_tournament_same_score"
 counts[category+"_groups"]+=1;counts[category+"_rows"]+=len(g)
 if len(examples[category])<12:examples[category].append({"year":key[0],"season":key[1],"date":key[2],"teams":key[3],"count":len(g),"tournaments":list(tour)[:5],"areas":[list(v) for v in list(areas)[:5]],"scores":[list(v) for v in list(sigs)[:5]]})
 for _,r in g:
  lines.append({"category":category,"year":r.get("year"),"season":r.get("season"),"date":r.get("date"),"team1":r.get("team1"),"score1":r.get("score1"),"team2":r.get("team2"),"score2":r.get("score2"),"region":r.get("region"),"prefecture":r.get("prefecture"),"tournament":r.get("tournament"),"level":level(r),"source_url":r.get("source_url"),"source_file":r.get("_source_file"),"source_row":r.get("_source_row"),"match_id":r.get("match_id")})
with (O/"phase1_duplicate_triage.csv").open("w",encoding="utf-8-sig",newline="") as f:
 w=csv.DictWriter(f,fieldnames=list(lines[0]) if lines else ["category"]);w.writeheader();w.writerows(lines)
result={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"total_rows":len(rows),"suspected_groups":sum(v for k,v in counts.items() if k.endswith("_groups")),"counts":dict(counts),"examples":dict(examples),"status":"triage_not_source_verified","data_mutated":False}
(O/"phase1_duplicate_triage.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"total_rows":len(rows),"counts":dict(counts)},ensure_ascii=False))
