#!/usr/bin/env python3
"""Audit and cautiously remove identical duplicate 2025–2026 source CSV rows.
Only exact same year/season/date/teams/scores/level can be automatic removals.
Rows with altered scores, dates, school identities or levels are review-only.
Never edit output/, docs/, master/ or any hand-entered shared edits.
"""
import argparse,csv,json,re,hashlib
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime,timezone

ROOT=Path("data")
REPORT=Path("master/duplicate_source_2025_2026_report.json")
DETAIL=Path("master/duplicate_source_2025_2026_candidates.csv")
FIELDS=["class","year","season","date","team1","score1","team2","score2","level","keep_file","keep_line","remove_file","remove_line","reason"]
def norm(s):
    return re.sub(r"[\s　■●○◆◇・]", "",str(s or "")).replace("（","(").replace("）",")")
def dt(v):
    t=str(v or "").replace("/","-").strip()
    m=re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})",t)
    return f"{int(m[1]):04d}-{int(m[2]):02d}-{int(m[3]):02d}" if m else t
def score(v):
    try:return str(int(float(v)))
    except:return str(v or "").strip()
def level(r):
    m=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
    return str(r.get("level") or (m.group(1) if m else "")).strip()
def sides(r,with_scores=True):
    return tuple(sorted([(norm(r.get("team1")),score(r.get("score1")) if with_scores else ""),
                         (norm(r.get("team2")),score(r.get("score2")) if with_scores else "")]))
def idkey(r,with_scores=True):
    return (str(r.get("year")),str(r.get("season")),dt(r.get("date")),sides(r,with_scores))
def quality(rec):
    r=rec["row"];p=rec["path"]
    # Prefer curated/imported files over historical raw duplicates, but keep
    # source-rich rows and permanent provenance whenever possible.
    return (bool(r.get("manual_id")),bool(r.get("match_id")),bool(r.get("source_url")),
            bool(r.get("tournament")),bool(r.get("round")),
            "data/imported/" not in str(p),len(str(r.get("note") or "")),-len(str(p)))
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--apply",action="store_true");args=ap.parse_args()
    data=defaultdict(list);raw_files={};collisions=defaultdict(list);count=Counter()
    for p in sorted(ROOT.rglob("*.csv")):
        with p.open(encoding="utf-8-sig",newline="") as f:
            rd=csv.DictReader(f);headers=rd.fieldnames
            if not headers or not {"year","season","date","team1","team2","score1","score2"}.issubset(headers):continue
            rows=list(rd)
        raw_files[p]=(headers,rows)
        for idx,r in enumerate(rows):
            if r.get("year") not in ("2025","2026") or r.get("season") not in ("spring","summer","autumn"):continue
            rec={"path":p,"line":idx+2,"idx":idx,"row":r}
            data[idkey(r)].append(rec)
            collisions[idkey(r,False)].append(rec)
            count["scanned"]+=1
    removals=defaultdict(set);decisions=[];review=[]
    for key,group in data.items():
        if len(group)<2:continue
        # A match can legitimately appear in separate competition tiers,
        # or be sourced from a historical review table. Those need inspection.
        by_level=defaultdict(list)
        for x in group:by_level[level(x["row"])].append(x)
        for lvl,part in by_level.items():
            if len(part)<2:continue
            authoritative=sorted(part,key=quality,reverse=True)
            keep=authoritative[0]
            for candidate in authoritative[1:]:
                a,b=keep["row"],candidate["row"]
                # Automatic physical deletion requires same date, two teams,
                # scores AND same tournament, round and prefecture. A differing
                # provenance URL is allowed only if source is not ambiguous.
                metadata=all(norm(a.get(f))==norm(b.get(f)) for f in ("tournament","round","prefecture"))
                provenance=(not a.get("manual_id") and not b.get("manual_id")
                    and not a.get("match_id") and not b.get("match_id"))
                if metadata and provenance and a.get("source_url") and b.get("source_url") and a.get("source_url")==b.get("source_url"):
                    removals[candidate["path"]].add(candidate["idx"])
                    classification="auto_exact"
                else:
                    classification="review_same_result"
                line={"class":classification,"year":key[0],"season":key[1],"date":key[2],
                    "team1":a.get("team1"),"score1":a.get("score1"),
                    "team2":a.get("team2"),"score2":a.get("score2"),
                    "level":lvl,"keep_file":str(keep["path"]),"keep_line":keep["line"],
                    "remove_file":str(candidate["path"]),"remove_line":candidate["line"],
                    "reason":"same score and teams; "+("exact metadata+URL" if classification=="auto_exact" else "metadata/URL/provenance differ")}
                decisions.append(line)
    # Score conflict: same dated game but mismatched scores; NEVER auto delete.
    for key,part in collisions.items():
        scores={sides(v["row"]) for v in part}
        if len(scores)<2:continue
        review.append({"year":key[0],"season":key[1],"date":key[2],
            "teams":[x[0] for x in key[3]],"records":[{"file":str(v["path"]),"line":v["line"],
            "score":[v["row"].get("score1"),v["row"].get("score2")],
            "tournament":v["row"].get("tournament")} for v in part[:10]]})
    changed=0
    if args.apply:
        for p,indices in removals.items():
            fields,rows=raw_files[p]
            if not indices:continue
            with p.open("w",encoding="utf-8-sig",newline="") as f:
                w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");w.writeheader()
                w.writerows(r for i,r in enumerate(rows) if i not in indices)
            changed+=len(indices)
    DETAIL.parent.mkdir(parents=True,exist_ok=True)
    with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(decisions)
    summary={"generated_at":datetime.now(timezone.utc).isoformat(),"mode":"apply" if args.apply else "audit",
        "scanned":count["scanned"],"duplicated_candidate_pairs":len(decisions),
        "auto_exact_candidates":sum(x["class"]=="auto_exact" for x in decisions),
        "review_same_result":sum(x["class"]=="review_same_result" for x in decisions),
        "review_score_conflicts":len(review),"physical_rows_removed":changed,
        "source_files_modified":[str(p) for p in removals if removals[p]] if args.apply else [],
        "score_conflicts":review[:1000],
        "warning":"Near matches and different-source/layer records are retained for review; no fuzzy deletes."}
    REPORT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:summary[k] for k in ("scanned","duplicated_candidate_pairs","auto_exact_candidates","review_same_result","review_score_conflicts","physical_rows_removed")},ensure_ascii=False))
if __name__=="__main__":main()
