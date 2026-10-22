#!/usr/bin/env python3
"""Recover missing 2025/2026 source games from the pre-deduplication commit.
Read-only unless --apply. Preserve modern files, manual edits, and score conflicts.
"""
import argparse,csv,io,subprocess,collections,re,json,datetime
from pathlib import Path

BASE="6c8903f6aef69707fe52365d0df527d3dca70f60"
ROOT=Path("data")
REPORT=Path("output/audit/recovery_20261021.json")
def read(b):
    return list(csv.DictReader(io.StringIO(b.decode("utf-8-sig"))))
def norm(x):
    return re.sub(r"[\s　■●○◆◇・]","",str(x or "")).replace("（","(").replace("）",")")
def key(r):
    d=str(r.get("date") or "").replace("/","-")
    p=[x for x in re.split(r"[^0-9]",d) if x]
    if len(p)==3:
        d=f"{int(p[0]):04d}-{int(p[1]):02d}-{int(p[2]):02d}"
    teams=tuple(sorted((norm(r.get("team1")),norm(r.get("team2")))))
    return (str(r.get("year") or ""),str(r.get("season") or ""),d,teams,
            norm(r.get("prefecture")),norm(r.get("tournament")),norm(r.get("round")))
def complete(r):
    return all(str(r.get(k) or "").strip() for k in ("year","season","date","team1","team2","score1","score2","tournament"))
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--apply",action="store_true");args=ap.parse_args()
    paths=[Path(p) for p in subprocess.check_output(["git","ls-tree","-r","--name-only",BASE,"data"],text=True).splitlines() if p.endswith(".csv")]
    old=collections.defaultdict(list);current=collections.defaultdict(list)
    def add(dic,path,rows):
        for r in rows:
            if r.get("year") not in ("2025","2026") or not complete(r):continue
            dic[key(r)].append((path,r))
    for p in paths:
        b=subprocess.run(["git","show",f"{BASE}:{p.as_posix()}"],capture_output=True)
        if b.returncode==0:
            try:add(old,p,read(b.stdout))
            except UnicodeError:pass
    for p in ROOT.rglob("*.csv"):
        try:add(current,p,list(csv.DictReader(p.open(encoding="utf-8-sig",newline=""))))
        except (UnicodeError,csv.Error):pass
    # Protect cases with the same fixtures but differing scores: review manually.
    new=[];conflicts=[];present=0
    for k,records in old.items():
        if k in current:
            present+=1
            old_scores={tuple(sorted((str(r["team1"]),str(r["score1"])),)) for _,r in records}
            # A fixture with different scores must not be reintroduced automatically.
            for p,r in records:
                if not any(str(r.get("score1"))==str(c.get("score1")) and str(r.get("score2"))==str(c.get("score2")) for _,c in current[k]):
                    conflicts.append({"fixture":list(k[:3]),"source":str(p),"teams":[r["team1"],r["team2"]],"scores":[r["score1"],r["score2"]]})
            continue
        # Keep just one missing fixture, favor source provenance and nonlegacy.
        ordered=sorted(records,key=lambda x:(x[0].as_posix()!="data/all_matches.csv",bool(x[1].get("source_url"))),reverse=True)
        new.append(ordered[0])
    destination=ROOT/"recovered"/"2025_2026_pre_dedupe_missing.csv"
    headers=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
    if args.apply:
        destination.parent.mkdir(parents=True,exist_ok=True)
        with destination.open("w",encoding="utf-8-sig",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=headers,extrasaction="ignore");writer.writeheader()
            for p,r in new:writer.writerow(r)
    report={"base":BASE,"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"mode":"apply" if args.apply else "audit","distinct_previous_fixtures":len(old),"present_fixtures":present,"missing_fixtures":len(new),"score_conflict_records":len(conflicts),"missing_by_year_season":dict(collections.Counter(f"{r['year']}/{r['season']}" for _,r in new)),"conflict_examples":conflicts[:100],"destination":str(destination)}
    REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    print(json.dumps({k:v for k,v in report.items() if k!="conflict_examples"},ensure_ascii=False))
if __name__=="__main__":main()
