#!/usr/bin/env python3
"""Restore fixtures present in Nov 2 published yearly ledger, absent from today's published and computed ledgers."""
import csv, io, json, re, subprocess
from collections import Counter
from pathlib import Path
BASE="9d1c1338292346f41cdeda5be4555121a83d0be4"
YEARS=range(2008,2027)
def parse(data):
    return list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
def read_file(path):
    if not path.exists(): return []
    return parse(path.read_bytes())
def old_year(year):
    p=f"docs/data/ledger_shards/{year}.csv"
    proc=subprocess.run(["git","show",f"{BASE}:{p}"],capture_output=True)
    if proc.returncode:raise RuntimeError(f"Missing baseline {p}")
    return parse(proc.stdout)
def norm(value):return re.sub(r"[\\s　■●○◆◇・]","",str(value or "")).replace("（","(").replace("）",")")
def score(value):
    try:return str(int(float(value)))
    except (ValueError,TypeError):return norm(value)
def signature(r):
    a=(norm(r.get("team1")),score(r.get("score1")))
    b=(norm(r.get("team2")),score(r.get("score2")))
    return (str(r.get("year") or ""),str(r.get("season") or ""),tuple(sorted((a,b))))
def valid(r):
    return all(str(r.get(x) or "").strip() for x in ["year","season","team1","team2","score1","score2","tournament"])
def main():
    baseline={};current={};baseline_counts={};current_counts={}
    for y in YEARS:
        old=old_year(y)
        new=read_file(Path(f"docs/data/ledger_shards/{y}.csv"))
        baseline_counts[str(y)]=len(old);current_counts[str(y)]=len(new)
        for r in old:
            if valid(r):baseline.setdefault(signature(r),r)
        for r in new:
            if valid(r):current.setdefault(signature(r),r)
    # Avoid reintroducing matches already present in the freshly calculated ledger.
    computed=read_file(Path("output/all_matches.csv"))
    for r in computed:
        if valid(r):current.setdefault(signature(r),r)
    state=json.loads(Path("master/match_edits_shared.json").read_text(encoding="utf-8-sig"))
    deleted={signature(o.get("snapshot") or {}) for o in state.get("authority_ops",[]) if o.get("action")=="DELETE"}
    missing=[r for key,r in baseline.items() if key not in current and key not in deleted]
    missing.sort(key=lambda r:(r.get("year",""),r.get("date",""),r.get("tournament","")))
    dest=Path("data/recovered/nov02_true_missing.csv");dest.parent.mkdir(parents=True,exist_ok=True)
    headers=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
    with dest.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=headers,extrasaction="ignore");w.writeheader();w.writerows(missing)
    report={"baseline":BASE,"baseline_counts":baseline_counts,"current_counts":current_counts,"count_differences":{y:baseline_counts[y]-current_counts[y] for y in baseline_counts if baseline_counts[y]!=current_counts[y]},"missing_fixtures_recovered":len(missing),"recovered_by_year":dict(Counter(r["year"] for r in missing)),"note":"Compared published yearly shards and computed ledger directly, not registry."}
    Path("master/nov02_direct_ledger_recovery.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
