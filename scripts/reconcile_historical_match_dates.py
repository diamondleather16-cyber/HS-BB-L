#!/usr/bin/env python3
"""Recover verified historical dates from dated ledger games before rating replay.

No estimated dates. No guessing across ambiguous candidates. Writes an audit.
"""
import csv
import json
import re
from collections import defaultdict, Counter
from datetime import datetime, timezone, date
from pathlib import Path

TARGET=Path("docs/data/historical_ledger_2017_2024.csv")
SOURCES=[Path("output/all_matches.csv")]
REPORT=Path("output/audit/historical_date_reconciliation.json")
DETAIL=Path("output/audit/historical_date_reconciliation.csv")

def name(v):
    return re.sub(r"[\s　・･■●○]+","",str(v or "")).strip()

def score(v):
    try:return str(int(float(v)))
    except (ValueError,TypeError):return ""

def norm_date(v):
    parts=re.findall(r"\d+",str(v or ""))
    if len(parts)<3:return ""
    y,m,d=map(int,parts[:3])
    try:return date(y,m,d).isoformat()
    except ValueError:return ""

def pair(row):
    return tuple(sorted(((name(row.get("team1")),score(row.get("score1"))),
                         (name(row.get("team2")),score(row.get("score2"))))))
def key(row):
    return (str(row.get("year") or "").strip(),str(row.get("season") or "").strip(),pair(row))

def load(path):
    with path.open(encoding="utf-8-sig",newline="") as f:
        rd=csv.DictReader(f)
        return rd.fieldnames,list(rd)

def main():
    fields,rows=load(TARGET)
    observed=defaultdict(lambda:defaultdict(set))
    for p in SOURCES:
        if not p.exists():continue
        _,source_rows=load(p)
        for r in source_rows:
            y=str(r.get("year") or "")
            if not y.isdigit() or not 2017<=int(y)<=2024:continue
            d=norm_date(r.get("date"))
            if not d or not d.startswith(y+"-"):continue
            if not all(v[0] and v[1] for v in pair(r)):continue
            observed[key(r)][d].add(str(r.get("tournament") or ""))
    counts=Counter();audit=[]
    for r in rows:
        y=str(r.get("year") or "")
        if not y.isdigit() or not 2017<=int(y)<=2024:continue
        counts["examined"]+=1
        original=norm_date(r.get("date"))
        dates=observed.get(key(r),{})
        # Preserve existing valid dates and never replace with a conflicting candidate.
        if original:
            status="already_dated"
        elif len(dates)==1:
            d=next(iter(dates))
            # Only source-verified, matching-score, same-season games.
            r["date"]=d
            status="recovered"
        elif len(dates)>1:
            status="ambiguous_multiple_dates"
        else:
            status="unresolved"
        counts[status]+=1
        audit.append({"year":y,"season":r.get("season",""),"region":r.get("region",""),
                      "tournament":r.get("tournament",""),"round":r.get("round",""),
                      "team1":r.get("team1",""),"score1":r.get("score1",""),
                      "team2":r.get("team2",""),"score2":r.get("score2",""),
                      "old_date":original,"new_date":r.get("date",""),
                      "status":status,"matching_source_dates":";".join(sorted(dates))})
    TARGET.parent.mkdir(parents=True,exist_ok=True)
    with TARGET.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        writer.writeheader();writer.writerows(rows)
    DETAIL.parent.mkdir(parents=True,exist_ok=True)
    with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(audit[0]))
        writer.writeheader();writer.writerows(audit)
    REPORT.write_text(json.dumps({"timestamp":datetime.now(timezone.utc).isoformat(),
        "counts":dict(counts),"method":"unique year+season+school-pair+scores match to dated official ledger",
        "guessed_dates":0},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("HISTORICAL_DATE_RECONCILIATION",dict(counts),flush=True)

if __name__=="__main__":main()
