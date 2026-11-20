#!/usr/bin/env python3
"""Publish a small, verifiable receipt for manually entered match -> rating -> both school histories."""
import csv, json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

def read_csv(path):
    if not Path(path).exists():
        raise FileNotFoundError(path)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def val(x):
    return str(x if x is not None else "").strip()

def score(x):
    try:
        return str(int(float(x)))
    except (TypeError, ValueError):
        return val(x)

def match_key(x):
    return "|".join([val(x.get(k)) for k in ("year","season","date","tournament","round","team1")]
                    +[score(x.get("score1")),val(x.get("team2")),score(x.get("score2"))])

def main():
    state_path=Path("master/match_edits_shared.json")
    state=json.loads(state_path.read_text(encoding="utf-8-sig")) if state_path.exists() else {}
    manual={val(m.get("manual_id") or m.get("match_id")):m for m in state.get("manual_matches",[]) if m.get("manual_id") or m.get("match_id")}
    # Authoritative ADD/DELETE entries may modify the manual_matches array.
    for op in state.get("authority_ops",[]):
        action=val(op.get("action")).upper()
        snapshot=op.get("snapshot") or op.get("row") or {}
        mid=val(snapshot.get("manual_id") or op.get("match_id"))
        if not mid.startswith("MAN-"):
            continue
        if action=="DELETE":
            manual.pop(mid,None)
        elif action=="ADD" and mid not in manual and snapshot:
            manual[mid]=snapshot
    events=read_csv("output/rating_events.csv")
    school=read_csv("output/rating_school_events.csv")
    ledger=read_csv("output/all_matches.csv")
    events_by_key=defaultdict(list)
    for e in events:
        events_by_key[val(e.get("match_key")) or match_key(e)].append(e)
    school_pairs={(val(e.get("match_key")),val(e.get("school_id"))) for e in school if val(e.get("event_type"))=="match"}
    ledger_keys={match_key(r) for r in ledger}
    results=[]
    for mid,m in manual.items():
        k=match_key(m)
        selected=events_by_key.get(k,[])
        if not k in ledger_keys:
            status="missing_ledger"
        elif not selected:
            status="missing_rating"
        else:
            ev=selected[0]
            ids=[val(ev.get("team1_school_id")),val(ev.get("team2_school_id"))]
            if not all(ids):
                status="unlinked_school"
            elif not all((val(ev.get("match_key")) or k,sid) in school_pairs for sid in ids):
                status="missing_school_history"
            else:
                status="reflected"
        ev=selected[0] if selected else {}
        results.append({
            "manual_id":mid,"date":val(m.get("date")),"tournament":val(m.get("tournament")),
            "team1":val(m.get("team1")),"score1":score(m.get("score1")),
            "team2":val(m.get("team2")),"score2":score(m.get("score2")),
            "match_key":k,"status":status,
            "school_ids":[val(ev.get("team1_school_id")),val(ev.get("team2_school_id"))] if ev else []
        })
    # Never declare all manual entries reflected based on a sampled audit.
    counts={s:sum(x["status"]==s for x in results) for s in
        ("reflected","missing_ledger","missing_rating","unlinked_school","missing_school_history")}
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),"total":len(results),
             "counts":counts,"matches":sorted(results,key=lambda r:r["manual_id"],reverse=True)}
    dest=Path("output/manual_rating_reflection.json")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("MANUAL_RATING_REFLECTION",json.dumps({"total":payload["total"],"counts":counts},ensure_ascii=False),flush=True)
    # Findings are reported, never silently disguised as successful propagation.

if __name__=="__main__":
    main()
