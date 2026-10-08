#!/usr/bin/env python3
from __future__ import annotations
import csv, json, re
from pathlib import Path

MATCHES=Path("output/all_matches.csv")
EDITS=Path("master/match_edits_shared.json")

def read_csv(path):
    if not path.exists(): return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def score_key(v):
    try:
        n=float(v)
        return str(int(n)) if n.is_integer() else str(n)
    except Exception:
        return str(v or "").strip()

def edit_key(r):
    if str(r.get("edit_key") or "").strip(): return str(r["edit_key"]).strip()
    if str(r.get("manual_id") or "").strip(): return str(r["manual_id"]).strip()
    return "¦".join([
        str(r.get("year") or "").strip(),str(r.get("season") or "").strip(),
        str(r.get("date") or "").strip(),str(r.get("tournament") or "").strip(),
        str(r.get("round") or "").strip(),str(r.get("team1") or "").strip(),
        score_key(r.get("score1")),str(r.get("team2") or "").strip(),score_key(r.get("score2"))
    ])

def infer_innings(r):
    note=str(r.get("note") or "")

    cold=re.search(r"(?<!\d)([5-8])回コールド",note)
    if cold:
        return cold.group(1),"cold"

    extra=re.search(r"延長\s*(1\d|2\d|30)回",note)
    if extra:
        return extra.group(1),"extra"

    # Only trust structured values when explicitly consistent.
    try:
        n=int(float(r.get("innings") or 0))
    except Exception:
        n=0
    finish=str(r.get("finish_type") or "").strip().lower()
    if finish=="cold" and 5<=n<=8:
        return str(n),"cold"
    if finish=="extra" and n>=10:
        return str(n),"extra"
    if finish=="normal" and n==9:
        return "9","normal"

    # Round names (2回戦/3回戦) and tournament names (第108回...) are never innings.
    return "9","normal"

def main():
    rows=read_csv(MATCHES)
    if not rows:
        raise SystemExit("output/all_matches.csv missing or empty")
    state={"manual_matches":[],"overrides":[],"team_links":[]}
    if EDITS.exists():
        state.update(json.loads(EDITS.read_text(encoding="utf-8")) or {})

    # Original stable keys are assigned before modifications.
    for r in rows:
        r["edit_key"]=edit_key(r)

    overrides={x.get("edit_key"):x.get("changes",{}) for x in state.get("overrides",[]) if x.get("edit_key")}
    links={(x.get("edit_key"),x.get("side")):x for x in state.get("team_links",[]) if x.get("edit_key") and x.get("side")}

    by_manual={str(r.get("manual_id") or "") for r in rows if r.get("manual_id")}
    for m in state.get("manual_matches",[]):
        mid=str(m.get("manual_id") or "").strip()
        if not mid or mid in by_manual: continue
        x=dict(m)
        x["edit_key"]=mid
        rows.append(x)
        by_manual.add(mid)

    for r in rows:
        key=edit_key(r)
        r["edit_key"]=key
        if key in overrides:
            for k,v in overrides[key].items():
                r[k]=v
        for side in ("team1","team2"):
            link=links.get((key,side))
            if link:
                r[f"{side}_school_id"]=link.get("school_id","")
                r[f"{side}_canonical"]=link.get("canonical_name","")
        innings,finish=infer_innings(r)
        r["innings"]=innings
        r["finish_type"]=finish

    # Deterministic field order: old schema first, then new edit fields, then any unexpected fields.
    preferred=[
        "year","season","region","prefecture","tournament","round","date",
        "team1","score1","team2","score2","source_url","note",
        "innings","finish_type","edit_key","manual_id",
        "team1_school_id","team1_canonical","team2_school_id","team2_canonical"
    ]
    seen=set()
    fields=[]
    for f in preferred:
        if any(f in r for r in rows):
            fields.append(f);seen.add(f)
    for r in rows:
        for f in r:
            if f not in seen:
                fields.append(f);seen.add(f)

    with MATCHES.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

    print(f"Applied match edits: {len(overrides)} overrides, {len(links)} links, {len(state.get('manual_matches',[]))} manual matches")

if __name__=="__main__":
    main()
