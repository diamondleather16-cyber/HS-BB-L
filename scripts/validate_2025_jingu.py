from pathlib import Path
import csv
import sys

PATH = Path("data/national/2025_jingu.csv")

def main():
    if not PATH.exists():
        print("ERROR: 2025_jingu.csv missing")
        sys.exit(1)

    with PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    errors = []
    expected = {"F":1,"SF":2,"QF":4,"1R":2}
    counts = {k: sum(1 for r in rows if r.get("round") == k) for k in expected}

    if len(rows) != 9:
        errors.append(f"rows={len(rows)} expected=9")

    for rnd, n in expected.items():
        if counts[rnd] != n:
            errors.append(f"{rnd}={counts[rnd]} expected={n}")

    seen = set()
    for i, r in enumerate(rows, start=2):
        for c in ("date","team1","score1","team2","score2","source_url","round"):
            if not str(r.get(c,"")).strip():
                errors.append(f"row {i}: {c} blank")
        try:
            int(r["score1"]); int(r["score2"])
        except Exception:
            errors.append(f"row {i}: invalid score")
        if "level=national" not in str(r.get("note","")):
            errors.append(f"row {i}: level=national missing")

        key = (r.get("date"),r.get("round"),r.get("team1"),r.get("score1"),r.get("team2"),r.get("score2"))
        if key in seen:
            errors.append(f"duplicate: {key}")
        seen.add(key)

    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 Jingu validation OK")

if __name__ == "__main__":
    main()
