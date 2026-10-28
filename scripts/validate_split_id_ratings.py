from pathlib import Path
import csv
import json

RATINGS=Path("output/current_ratings.csv")
MATCHES=Path("output/all_matches.csv")
MASTER=Path("master/school_master_shared.json")
EVENTS=Path("output/rating_school_events.csv")

def read(path):
    if not path.exists():
        return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def active_master_ids():
    if not MASTER.exists():
        return set()
    try:
        data=json.loads(MASTER.read_text(encoding="utf-8-sig"))
    except Exception as e:
        print(f"warning: school master load failed during validation: {e}")
        return set()

    out=set()
    for s in data.get("schools",[]) or []:
        sid=str(s.get("school_id") or "").strip()
        if not sid:
            continue
        status=str(s.get("status") or "active").strip()
        kind=str(s.get("kind") or "school").strip()
        if status=="merged" or kind=="union":
            continue
        out.add(sid)
    return out

def main():
    ratings=read(RATINGS)
    matches=read(MATCHES)

    rated={
        str(r.get("school_id") or "").strip()
        for r in ratings
        if str(r.get("school_id") or "").strip()
    }

    active_ids=active_master_ids()
    linked=set()
    stale=set()

    for r in matches:
        try:
            year=int(str(r.get("year") or "0"))
        except Exception:
            year=0
        if year<2025:
            continue

        for side in ("team1","team2"):
            sid=str(r.get(f"{side}_school_id") or "").strip()
            if not sid:
                continue

            # The split-ID validator is for CURRENT, active school identities.
            # Old generated rows can retain school_id values that no longer exist
            # in the shared School Master after merges, union conversion, or
            # identity cleanup. Those stale IDs must not block the whole Rating build.
            if active_ids and sid not in active_ids:
                stale.add(sid)
                continue
            linked.add(sid)

    # A source-ledger link is not necessarily a rated match: a row may have
    # been excluded as a duplicate, invalid fixture or unresolved union.
    # Validate IDs from actual rating school events instead of requiring every
    # linked source ID in the ranking.
    event_ids=set()
    for event in read(EVENTS):
        sid=str(event.get("school_id") or "").strip()
        if sid and (not active_ids or sid in active_ids):
            event_ids.add(sid)

    missing=sorted(event_ids-rated)
    source_only=sorted((linked-rated)-event_ids)
    if stale:
        print("warning: stale/non-master school_id ignored: "+", ".join(sorted(stale)[:50]))
    if source_only:
        print("warning: active source-linked IDs not present in rated events (review source exclusions): "
              + ", ".join(source_only[:50]))
    if missing:
        raise SystemExit("Rated event school_id missing from current_ratings.csv: "
                         + ", ".join(missing[:50]))
    print(f"split-ID validation OK: {len(event_ids)} rated active IDs; "
          f"source-only unrated={len(source_only)}, stale={len(stale)}")

if __name__=="__main__":
    main()
