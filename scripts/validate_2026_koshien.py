from pathlib import Path
import csv
import sys

PATH = Path("data/national/2026_koshien.csv")

EXPECTED = {
    "F": 1,
    "SF": 2,
    "QF": 4,
    "3R": 8,
    "2R": 16,
    "1R": 17,
}

def main():
    if not PATH.exists():
        print("ERROR: file missing")
        sys.exit(1)

    with PATH.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    errors = []
    counts = {
        rnd: sum(1 for r in rows if r.get("round") == rnd)
        for rnd in EXPECTED
    }

    if len(rows) != 48:
        errors.append(f"rows={len(rows)} expected=48")

    for rnd, expected in EXPECTED.items():
        if counts[rnd] != expected:
            errors.append(f"{rnd}={counts[rnd]} expected={expected}")

    seen = set()
    for i, r in enumerate(rows, start=2):
        for c in ("date","team1","team2","source_url","round"):
            if not str(r.get(c, "")).strip():
                errors.append(f"row {i}: {c} blank")

        try:
            int(r["score1"])
            int(r["score2"])
        except Exception:
            errors.append(f"row {i}: invalid score")

        if "level=national" not in str(r.get("note","")):
            errors.append(f"row {i}: missing level=national")

        # 県名付き表記をteam名に残さない。
        if r["team1"].endswith(")") or r["team2"].endswith(")"):
            errors.append(f"row {i}: prefecture suffix still in team name")

        key = (
            r["date"], r["round"], r["team1"],
            r["score1"], r["team2"], r["score2"]
        )
        if key in seen:
            errors.append(f"row {i}: duplicate game")
        seen.add(key)

    print(
        f"rows={len(rows)} "
        f"F={counts['F']} SF={counts['SF']} QF={counts['QF']} "
        f"3R={counts['3R']} 2R={counts['2R']} 1R={counts['1R']}"
    )

    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)

    print("2026 Koshien validation OK")

if __name__ == "__main__":
    main()
