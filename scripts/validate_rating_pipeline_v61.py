from pathlib import Path
import csv,re
from collections import Counter,defaultdict

ALL=Path("output/all_matches.csv")
RE=Path("output/rating_events.csv")
SE=Path("output/rating_school_events.csv")
PE=Path("output/prefecture_rating_events.csv")
HIST=Path("docs/data/historical_ledger_2017_2024.csv")
OUT=Path("output/rating_pipeline_audit.csv")

def rows(p):
    if not p.exists(): return []
    with p.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))

def normdate(s):
    s=str(s or "").strip().replace("/","-").replace(".","-")
    m=re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$",s)
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else s

def main():
    allr,rer,ser,per,hist=map(rows,[ALL,RE,SE,PE,HIST])
    report=[]
    # Current recency check.
    latest_all=max((normdate(r.get("date")) for r in allr if normdate(r.get("date"))),default="")
    latest_re=max((normdate(r.get("date")) for r in rer if normdate(r.get("date"))),default="")
    latest_se=max((normdate(r.get("date")) for r in ser if normdate(r.get("date"))),default="")
    report.append({"check":"latest_current","scope":"all_matches","expected":latest_all,"actual":latest_re,"status":"OK" if latest_re>=latest_all else "WARN"})
    report.append({"check":"latest_school_event","scope":"rating_school_events","expected":latest_all,"actual":latest_se,"status":"OK" if latest_se>=latest_all else "WARN"})
    # Historical national/regional coverage by year+season.
    hc=Counter((r.get("year",""),r.get("season","")) for r in hist if "level=regional" in r.get("note","") or "level=national" in r.get("note",""))
    pc=Counter((r.get("year",""),r.get("season","")) for r in per if str(r.get("source","")) in {"historical","compat_history"})
    for k,n in sorted(hc.items()):
        got=pc.get(k,0)
        report.append({"check":"historical_pref_coverage","scope":"/".join(k),"expected":n,"actual":got,"status":"OK" if got>0 else "MISSING"})
    OUT.parent.mkdir(parents=True,exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["check","scope","expected","actual","status"]);w.writeheader();w.writerows(report)
    bad=[r for r in report if r["status"] in {"MISSING","WARN"}]
    print(f"Rating pipeline audit: {len(report)} checks / {len(bad)} warnings")
    for r in bad[:30]: print("warning:",r)

if __name__=="__main__":main()
