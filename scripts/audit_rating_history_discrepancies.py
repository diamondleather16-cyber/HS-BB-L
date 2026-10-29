#!/usr/bin/env python3
"""Audit rating input -> match events -> school events, prioritizing manual date edits."""
import csv, json, re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path("output")
def read(path):
    if not path.exists(): return []
    with path.open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))
def key(r):
    def score(v):
        try: return str(int(float(v)))
        except (ValueError,TypeError): return str(v or "").strip()
    return "|".join([str(r.get("year") or ""),str(r.get("season") or ""),
      str(r.get("date") or ""),str(r.get("tournament") or ""),
      str(r.get("round") or ""),str(r.get("team1") or ""),score(r.get("score1")),
      str(r.get("team2") or ""),score(r.get("score2"))])
def fixture(r):
    sides=sorted([(str(r.get("team1") or "").strip(),str(r.get("score1") or "").strip()),
                  (str(r.get("team2") or "").strip(),str(r.get("score2") or "").strip())])
    return (str(r.get("year") or ""),str(r.get("season") or ""),tuple(sides))
def main():
    ledger=read(ROOT/"all_matches.csv")
    events=read(ROOT/"rating_events.csv")
    school=read(ROOT/"rating_school_events.csv")
    if not ledger or not events or not school:
        raise SystemExit("Audit input missing: ledger, match events or school events")
    event_keys={r.get("match_key","") for r in events}
    event_fixture=defaultdict(list)
    for e in events: event_fixture[fixture(e)].append(e)
    school_pairs={(r.get("match_key",""),r.get("school_id","")) for r in school if r.get("event_type")=="match"}
    school_keys={r.get("match_key","") for r in school if r.get("event_type")=="match"}
    state_path=Path("master/match_edits_shared.json")
    state=json.loads(state_path.read_text(encoding="utf-8-sig")) if state_path.exists() else {}
    manually_edited=set()
    manually_edited_snapshots=[]
    for op in state.get("authority_ops",[]):
        if str(op.get("action") or "").upper()=="UPDATE" and "date" in (op.get("changes") or {}):
            if op.get("match_id"): manually_edited.add(op["match_id"])
            manually_edited_snapshots.append(op.get("snapshot") or {})
    for x in state.get("overrides",[]):
        if "date" in (x.get("changes") or {}):
            manually_edited_snapshots.append(x)
    out=[]
    counts=Counter()
    for r in ledger:
        k=key(r)
        date=str(r.get("date") or "")
        mid=str(r.get("match_id") or "")
        manual=(mid in manually_edited or any(
            s.get("match_id") and s.get("match_id")==mid or
            s.get("team1")==r.get("team1") and s.get("team2")==r.get("team2") and
            s.get("year")==r.get("year") and s.get("season")==r.get("season")
            for s in manually_edited_snapshots))
        reasons=[]
        if k not in event_keys:
            alternatives=event_fixture.get(fixture(r),[])
            if alternatives and any(e.get("date")!=date for e in alternatives):
                reasons.append("date_identity_mismatch")
            else:
                reasons.append("missing_rating_event")
        else:
            e=next((e for e in event_fixture.get(fixture(r),[]) if e.get("match_key")==k),None)
            if e:
                for side in ("team1","team2"):
                    sid=str(e.get(side+"_school_id") or "")
                    if not sid:
                        reasons.append(side+"_unlinked_school_id")
                    elif (k,sid) not in school_pairs:
                        reasons.append(side+"_missing_school_event")
            if k not in school_keys:
                reasons.append("missing_school_history_event")
        if not re.fullmatch(r"20\\d{2}-\\d{2}-\\d{2}",date):
            reasons.append("date_unconfirmed_or_invalid")
        if reasons:
            counts.update(reasons)
            out.append({**{x:str(r.get(x) or "") for x in
                ["year","season","region","prefecture","tournament","round","date",
                 "team1","score1","team2","score2","match_id","_source_file"]},
                "manual_date_edit":"yes" if manual else "no",
                "issues":";".join(reasons)})
    out.sort(key=lambda r:(r["manual_date_edit"]!="yes",
        "missing_rating_event" not in r["issues"],r["year"],r["season"],r["tournament"]))
    audit=ROOT/"audit"
    audit.mkdir(exist_ok=True)
    fields=["year","season","region","prefecture","tournament","round","date",
            "team1","score1","team2","score2","match_id","_source_file","manual_date_edit","issues"]
    with (audit/"rating_history_discrepancies.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),
             "ledger_rows":len(ledger),"rating_events":len(events),
             "school_events":len(school),"flagged_rows":len(out),
             "issues":dict(counts),"manual_date_edits_in_state":len(manually_edited)+len(manually_edited_snapshots),
             "manual_date_edit_flagged":sum(x["manual_date_edit"]=="yes" for x in out),
             "sample":out[:40]}
    (audit/"rating_history_discrepancies.json").write_text(
        json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RATING_HISTORY_AUDIT",json.dumps({k:v for k,v in payload.items() if k!="sample"},ensure_ascii=False),flush=True)
if __name__=="__main__": main()
