#!/usr/bin/env python3
"""Fill only unambiguous undated historical rows from authoritative edited ledger."""
import csv,json,re
from pathlib import Path
from collections import defaultdict,Counter
from datetime import date
TARGET=Path("docs/data/historical_ledger_2017_2024.csv")
SOURCE=Path("output/all_matches.csv")
REPORT=Path("output/audit/verified_historical_date_sync.json")
def load(p):
    with p.open(encoding="utf-8-sig",newline="") as f:
        r=csv.DictReader(f);return r.fieldnames,list(r)
def dvalid(v):
    a=re.findall(r"\d+",str(v or ""))
    if len(a)!=3:return ""
    try:return date(*(int(x) for x in a)).isoformat()
    except ValueError:return ""
def signature(r):
    def name(x):return re.sub(r"[\s　・･■●○]+","",str(x or ""))
    def score(x):
        try:return str(int(float(x)))
        except (ValueError,TypeError):return ""
    sides=tuple(sorted(((name(r.get("team1")),score(r.get("score1"))),
                        (name(r.get("team2")),score(r.get("score2"))))))
    if any(not n or not s for n,s in sides):return None
    return (str(r.get("year") or ""),str(r.get("season") or ""),sides)
def main():
    fields,rows=load(TARGET)
    _,authoritative=load(SOURCE)
    by_sig=defaultdict(list)
    for r in authoritative:
        sig=signature(r);d=dvalid(r.get("date"))
        if sig and d and d[:4]==sig[0]:by_sig[sig].append((d,r))
    history_count=Counter(signature(r) for r in rows if signature(r))
    count=Counter();sample=[]
    for r in rows:
        old=dvalid(r.get("date"))
        if old:continue
        sig=signature(r)
        if not sig or history_count[sig]!=1:
            count["ambiguous_historical_fixture"]+=1;continue
        candidate=by_sig.get(sig,[])
        dates={d for d,_ in candidate}
        if len(dates)!=1:
            count["no_unique_verified_date"]+=1;continue
        # Do not substitute a date from an obviously different tournament
        # when both records specify a nonempty tournament label.
        eligible=[(d,x) for d,x in candidate if not r.get("tournament") or
          not x.get("tournament") or r["tournament"]==x["tournament"]]
        if not eligible:
            count["tournament_mismatch_review"]+=1;continue
        new_date=next(iter(dates))
        r["date"]=new_date
        count["recovered"]+=1
        if len(sample)<50:sample.append({"year":sig[0],"season":sig[1],"tournament":r.get("tournament"),"teams":sig[2],"new_date":new_date})
    if count["recovered"]:
        with TARGET.open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");w.writeheader();w.writerows(rows)
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps({"counts":dict(count),"examples":sample},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("VERIFIED_HISTORICAL_DATES",dict(count),flush=True)
if __name__=="__main__":main()
