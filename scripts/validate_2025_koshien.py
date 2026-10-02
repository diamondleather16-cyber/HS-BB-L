from pathlib import Path
import csv
import sys

PATH = Path("data/national/2025_koshien.csv")

def main():
    if not PATH.exists():
        print("ERROR: file missing")
        sys.exit(1)

    with PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    errors = []
    counts = {
        rnd: sum(1 for r in rows if r.get("round") == rnd)
        for rnd in ("F","SF","QF","3R","2R","1R")
    }

    expected = {
        "F": 1, "SF": 2, "QF": 4,
        "3R": 8, "2R": 16, "1R": 17
    }

    if len(rows) != 48:
        errors.append(f"rows={len(rows)} expected=48")

    for rnd, n in expected.items():
        if counts[rnd] != n:
            errors.append(f"{rnd}={counts[rnd]} expected={n}")

    walkovers = 0
    for i, r in enumerate(rows, start=2):
        for c in ("date","team1","team2","source_url","round"):
            if not str(r.get(c, "")).strip():
                errors.append(f"row {i}: {c} blank")

        is_walkover = "walkover" in str(r.get("note", ""))
        if is_walkover:
            walkovers += 1
            if r.get("score1") or r.get("score2"):
                errors.append(f"row {i}: walkover should have blank scores")
        else:
            try:
                int(r["score1"])
                int(r["score2"])
            except Exception:
                errors.append(f"row {i}: invalid score")

    if walkovers != 1:
        errors.append(f"walkovers={walkovers} expected=1")

    print(
        f"rows={len(rows)} F={counts['F']} SF={counts['SF']} "
        f"QF={counts['QF']} 3R={counts['3R']} "
        f"2R={counts['2R']} 1R={counts['1R']} "
        f"walkovers={walkovers}"
    )

    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 Koshien validation OK")

if __name__ == "__main__":
    main()
