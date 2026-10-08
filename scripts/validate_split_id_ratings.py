from pathlib import Path
import csv

RATINGS=Path("output/current_ratings.csv")
MATCHES=Path("output/all_matches.csv")

def read(path):
    if not path.exists():
        return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def main():
    ratings=read(RATINGS)
    matches=read(MATCHES)
    rated={str(r.get("school_id") or "").strip() for r in ratings if str(r.get("school_id") or "").strip()}
    linked=set()
    for r in matches:
        try: year=int(str(r.get("year") or "0"))
        except Exception: year=0
        if year<2025: continue
        for side in ("team1","team2"):
            sid=str(r.get(f"{side}_school_id") or "").strip()
            if sid: linked.add(sid)
    missing=sorted(linked-rated)
    if missing:
        raise SystemExit("Explicit split school_id missing from current_ratings.csv: "+", ".join(missing[:50]))
    print(f"split-ID rating validation OK: {len(linked)} explicit IDs")

if __name__=="__main__":
    main()
