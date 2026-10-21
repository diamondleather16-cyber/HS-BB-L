#!/usr/bin/env python3
"""Parallel source acquisition, sequential conservative ledger reconciliation."""
import csv,json,re,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from collections import defaultdict
from datetime import datetime,timezone
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

MANIFEST=Path("master/targeted_89_2025_2026.json")
LEDGER=Path("output/all_matches.csv")
REPORT=Path("master/targeted_89_2025_2026_report.json")
def name(s):
    return re.sub(r"[\s　■●○]", "",imp.clean_team(str(s or ""))).replace("（","(").replace("）",")")
def date(s):
    s=str(s or "").replace("/","-").strip()
    m=re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})",s)
    return f"{int(m[1]):04d}-{int(m[2]):02d}-{int(m[3]):02d}" if m else s
def key(r):
    return (str(r.get("year") or ""),str(r.get("season") or ""),str(r.get("prefecture") or ""),
            date(r.get("date")),tuple(sorted((name(r.get("team1")),name(r.get("team2"))))))
def sides(r):
    return sorted([(name(r.get("team1")),str(r.get("score1"))),(name(r.get("team2")),str(r.get("score2")))])
def read(path):
    if not path.exists():return []
    with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def acquire(t):
    req={**t,"locked_prefecture":t["prefecture"],"region":imp.PREF_TO_REGION.get(t["prefecture"],""),
         "batch_auto_metadata":False}
    try:
        rows,warnings=imp.analyze(req)
        rows=imp.normalize_approved_rows(rows,t["level"])
        if not rows:raise ValueError("No complete match rows parsed")
        accepted=[]
        for r in rows:
            if str(r.get("year"))!=t["year"] or str(r.get("season"))!=t["season"] or r.get("prefecture")!=t["prefecture"]:
                raise ValueError("Period/prefecture mismatch in parsed data")
            if not r.get("date") or not r.get("round") or not r.get("tournament"):
                raise ValueError("Unlabeled date/round/tournament")
            if not date(r["date"]).startswith(t["year"]+"-"):
                raise ValueError("Date year mismatch")
            if not r.get("team1") or not r.get("team2") or name(r["team1"])==name(r["team2"]):
                raise ValueError("Invalid teams")
            accepted.append(r)
        if warnings:raise ValueError("Parser warnings: "+"; ".join(warnings[:4]))
        return t,accepted,None
    except Exception as e:return t,[],str(e)[:500]
def main():
    targets=json.loads(MANIFEST.read_text(encoding="utf-8"))["targets"]
    original=read(LEDGER)
    existing=defaultdict(list)
    for r in original:existing[key(r)].append(r)
    reports=[];all_new=defaultdict(list)
    # Fetch 9 pages concurrently. Only publish source-verified, missing matches.
    with ThreadPoolExecutor(max_workers=5) as pool:
        completed=list(pool.map(acquire,targets))
    for t,rows,error in completed:
        stats={"year":t["year"],"season":t["season"],"prefecture":t["prefecture"],
               "source_url":t["source_url"],"source_games":len(rows),"already_present":0,
               "new_games":0,"conflicts":[],"status":"ok" if not error else "fetch_or_parse_failed"}
        if error:stats["error"]=error;reports.append(stats);continue
        local=set()
        for r in rows:
            k=key(r)
            if (k,tuple(map(tuple,sides(r)))) in local:continue
            local.add((k,tuple(map(tuple,sides(r)))))
            known=existing.get(k,[])
            if any(sides(x)==sides(r) for x in known):
                stats["already_present"]+=1;continue
            if known:
                stats["conflicts"].append({"date":r["date"],"round":r["round"],"teams":[r["team1"],r["team2"]],
                  "source_score":[r["score1"],r["score2"]],"ledger":[{"teams":[v["team1"],v["team2"]],
                  "score":[v["score1"],v["score2"]]} for v in known[:3]]})
                continue
            # Do not recopy the regional Hokkaido finals into the prefecture level.
            if t["level"]=="regional":
                stats["conflicts"].append({"date":r["date"],"teams":[r["team1"],r["team2"]],
                                           "reason":"regional hierarchy: preserve separately for review"})
                continue
            all_new[(t["year"],t["season"],t["prefecture"])].append(r)
            existing[k].append(r)
            stats["new_games"]+=1
        if stats["conflicts"]:stats["status"]="review_conflicts"
        reports.append(stats)
    for (year,season,pref),rows in all_new.items():
        dest=Path("data/imported")/year/season/(pref+".csv")
        added,_,_=imp.merge_csv(dest,rows,mode="append")
        if added!=len(rows):
            for s in reports:
                if (s["year"],s["season"],s["prefecture"])==(year,season,pref):
                    s["actually_written"]=added;s["status"]="partial_guard"
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),"sources":len(targets),
             "total_proposed_new":sum(x["new_games"] for x in reports),
             "total_conflicts":sum(len(x["conflicts"]) for x in reports),
             "note":"Score conflicts are review-only; no automatic overwrite. Exact matches are skipped. Regional Hokkaido remains review-only.",
             "tournaments":reports}
    REPORT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"new":payload["total_proposed_new"],"conflicts":payload["total_conflicts"],
                      "tournaments":[{k:x[k] for k in ("prefecture","source_games","new_games","status")} for x in reports]},ensure_ascii=False))
if __name__=="__main__":main()
