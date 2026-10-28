#!/usr/bin/env python3
"""Conservative all-year source-CSV dedup. Never removes uncertain matches."""
import csv,json,re
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime,timezone

ROOT=Path("data")
AUDIT=Path("master/dedupe_all_years_safe_report.json")
def n(v):return re.sub(r"[\s　■●○◆◇・･]","",str(v or "").strip()).replace("（","(").replace("）",")")
def date(v):
 s=str(v or "").strip().replace("/","-")
 m=re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})",s)
 return f"{int(m[1]):04d}-{int(m[2]):02d}-{int(m[3]):02d}" if m else ""
def score(v):
 try:return str(int(v)) if str(int(v))==str(v).strip() else ""
 except Exception:return ""
def lev(r):
 m=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
 return n(r.get("level") or (m.group(1) if m else ""))
def identity(r):
 d=date(r.get("date"))
 if not d:return None
 a,b=n(r.get("team1")),n(r.get("team2"))
 x,y=score(r.get("score1")),score(r.get("score2"))
 year=n(r.get("year"));season=n(r.get("season"));tour=n(r.get("tournament"))
 pref=n(r.get("prefecture"));level=lev(r)
 if not all((year,season,tour,a,b,x,y)) or a==b:return None
 return (year,season,d,tuple(sorted(((a,x),(b,y)))),tour,pref,level)
def quality(item):
 p,i,r=item
 return (bool(r.get("source_url") or r.get("source_ref")),bool(r.get("round")),
         bool(r.get("match_id")),bool(r.get("note")),-len(str(p)),-i)
def main():
 files={};groups=defaultdict(list);counts=Counter()
 for p in sorted(ROOT.rglob("*.csv")):
  with p.open(encoding="utf-8-sig",newline="") as f:
   rd=csv.DictReader(f);head=rd.fieldnames or []
   if not {"year","season","date","team1","team2","score1","score2"}.issubset(head):continue
   rows=list(rd);files[p]=(head,rows)
  for i,r in enumerate(rows):
   counts["scanned"]+=1
   k=identity(r)
   if k:groups[k].append((p,i,r))
   else:counts["unverifiable"]+=1
 removes=defaultdict(set);examples=[]
 for k,g in groups.items():
  if len(g)<2:continue
  # Never modify records with manual IDs or a distinct stable match ID.
  if any(x[2].get("manual_id") for x in g):counts["manual_review"]+=1;continue
  ids={x[2].get("match_id") for x in g if x[2].get("match_id")}
  if len(ids)>1:counts["identity_conflict_review"]+=1;continue
  # Different rounds may denote different events or source defects. Preserve.
  rounds={n(x[2].get("round")) for x in g if x[2].get("round")}
  if len(rounds)>1:counts["round_conflict_review"]+=1;continue
  keep=max(g,key=quality)
  for x in g:
   if x is keep:continue
   removes[x[0]].add(x[1]);counts["removed"]+=1
  counts["groups_cleaned"]+=1
  if len(examples)<20:examples.append({"year":k[0],"season":k[1],"date":k[2],"teams":k[3],"kept":str(keep[0]),"copies":len(g)})
 for p,indices in removes.items():
  head,rows=files[p]
  with p.open("w",encoding="utf-8-sig",newline="") as f:
   w=csv.DictWriter(f,fieldnames=head,extrasaction="ignore");w.writeheader()
   w.writerows(r for i,r in enumerate(rows) if i not in indices)
 report={"generated_at":datetime.now(timezone.utc).isoformat(),"mode":"safe_exact_all_years",
         "counts":dict(counts),"modified_files":[str(x) for x in removes],"examples":examples,
         "caveat":"Unknown dates, different tournament/level, mismatched scores, ID conflicts and ambiguous records are retained."}
 AUDIT.parent.mkdir(parents=True,exist_ok=True)
 AUDIT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report["counts"],ensure_ascii=False))
if __name__=="__main__":main()
