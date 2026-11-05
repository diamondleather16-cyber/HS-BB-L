#!/usr/bin/env python3
"""Read-only diagnostic for 2026-10-10 Teikyo Nagaoka vs Seiryo ledger/rating mismatch."""
import csv,json,re
from pathlib import Path
TARGET="2026-10-10"
def scan(path):
    n=0;hits=[]
    with open(path,encoding="utf-8-sig",newline="") as f:
        for r in csv.DictReader(f):
            n+=1
            if str(r.get("date") or "")!=TARGET:continue
            s=" ".join(str(r.get(k) or "") for k in ("team1","team2","school","raw_team","opponent"))
            if "帝京長岡" not in s and "星稜" not in s:continue
            hits.append({k:r.get(k) for k in ("year","season","date","tournament","round","level","team1","score1","team2","score2","school","school_id","raw_team","opponent","match_key","event_type","_source_file") if k in r})
    return {"file":str(path),"rows":n,"on_target_date":hits[:30],"target_count":len(hits)}
def main():
    files=["docs/data/all_matches.csv","docs/data/rating_events.csv","docs/data/rating_school_events.csv",
           "output/all_matches.csv","output/rating_events.csv","output/rating_school_events.csv"]
    reports=[]
    for p in files:
        if Path(p).exists():reports.append(scan(p))
    root=Path("docs/data/school_history/0515.json")
    if root.exists():
        j=json.loads(root.read_text(encoding="utf-8-sig"))
        raw=json.dumps(j,ensure_ascii=False)
        reports.append({"file":str(root),"tei_present":"帝京長岡" in raw,
                        "seiryo_present":"星稜" in raw,
                        "target_date_occurrences":raw.count(TARGET),
                        "target_window":[raw[max(0,m.start()-200):m.start()+380] for m in list(re.finditer(TARGET,raw))[:12]]})
    from build_rating_events_v2 import build_full_rating_input, read_csv
    rebuilt=build_full_rating_input(read_csv(Path("output/all_matches.csv")))
    hits=[r for r in rebuilt if r.get("date")==TARGET and "帝京長岡" in str(r) and "星稜" in str(r)]
    reports.append({"stage":"rating-input-merged","count":len(hits),"rows":[{k:r.get(k) for k in ("date","tournament","team1","team2","note","_rating_source","team1_school_id","team2_school_id","team1_type","team2_type","team1_union_id","team2_union_id","score1","score2","match_id")} for r in hits]})
    result={"target":"帝京長岡 vs 星稜 / 2026-10-10","reports":reports}
    print(json.dumps(result,ensure_ascii=False),flush=True)
    Path("output/audit").mkdir(parents=True,exist_ok=True)
    Path("output/audit/diagnose_rating_oct10.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if __name__=="__main__":main()
