#!/usr/bin/env python3
"""Apply dated OmyuTech fixtures to 2018 autumn regional rows, uniquely only."""
import csv,glob,json,re
from collections import defaultdict
from pathlib import Path
from datetime import date
SOURCE_FILES=sorted(Path("data/date_sources").glob("2018_autumn_*_omyutech.csv"))
TARGETS=[Path("output/all_matches.csv"),Path("docs/data/historical_ledger_2017_2024.csv")]
REPORT=Path("output/audit/2018_autumn_omyutech_date_sync.json")
ALIASES={"東京成徳大高":"東京成徳大","東京都市大等々力":"都市大等々力","駒大高":"駒大"}
def norm(x):
    s=re.sub(r"[\s　・･]+","",str(x or ""))
    return ALIASES.get(s,s)
def pair(x):
    return tuple(sorted([norm(x.get("team1")),norm(x.get("team2"))]))
def load(path):
    with path.open(encoding="utf-8-sig",newline="") as f:
        reader=csv.DictReader(f);return reader.fieldnames,list(reader)
def save(path,cols,rows):
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=cols,extrasaction="ignore")
        writer.writeheader();writer.writerows(rows)
def main():
    sources=[]
    for p in SOURCE_FILES:
        _,rr=load(p)
        for r in rr:
            assert r.get("year")=="2018" and r.get("season")=="autumn"
            date.fromisoformat(r["date"])
            sources.append(r)
    by_tournament=defaultdict(list)
    for r in sources:
        by_tournament[(norm(r["tournament"]),pair(r))].append(r)
    stats={}
    unresolved=[]
    for p in TARGETS:
        if not p.exists():continue
        cols,rows=load(p)
        changes=0;corrected=0;considered=0
        for r in rows:
            if str(r.get("year"))!="2018" or str(r.get("season"))!="autumn":continue
            # Preserve manually confirmed dates.
            if str(r.get("date") or "").strip():continue
            matches=by_tournament.get((norm(r.get("tournament")),pair(r)),[])
            if not matches:continue
            considered+=1
            if len(matches)!=1:
                unresolved.append({"target":str(p),"reason":"ambiguous","team1":r.get("team1"),"team2":r.get("team2")})
                continue
            m=matches[0]
            same=norm(r.get("team1"))==norm(m["team1"])
            score1=m["score1"] if same else m["score2"]
            score2=m["score2"] if same else m["score1"]
            # A match whose scores differ needs an explicit, reviewed exception.
            differs=(str(r.get("score1"))!=score1 or str(r.get("score2"))!=score2)
            if differs and not (norm(r.get("team1"))=="正則学園" and norm(r.get("team2"))=="田無" and str(r.get("score1"))=="5" and str(r.get("score2"))=="1" and score1=="5" and score2=="0"):
                unresolved.append({"target":str(p),"reason":"score_mismatch","team1":r.get("team1"),"team2":r.get("team2")})
                continue
            r["date"]=m["date"]
            if differs:
                r["score1"],r["score2"]=score1,score2
                corrected+=1
            if "source_url" in cols and not r.get("source_url"):r["source_url"]=m["source_url"]
            changes+=1
        if changes:save(p,cols,rows)
        stats[str(p)]={"dated":changes,"score_corrections":corrected,"candidates":considered}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps({"source_games":len(sources),"sources":[str(p) for p in SOURCE_FILES],
      "targets":stats,"unresolved":unresolved},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("OMYUTECH_2018_DATE_SYNC",json.dumps(stats,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
