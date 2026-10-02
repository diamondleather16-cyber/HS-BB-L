from pathlib import Path
import csv
import sys

DATA_DIR = Path("data")
FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]
ROUNDS = {"1R","2R","3R","4R","5R","6R","QF","SF","F","3P"}

def main():
    errors = []
    spring_files = [p for p in DATA_DIR.rglob("*_2025.csv") if p.is_file()]
    if len(spring_files) < 47:
        errors.append(f"47都道府県分に不足: {len(spring_files)} files")

    nonempty = 0
    for p in sorted(spring_files):
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            rd = csv.DictReader(f)
            if rd.fieldnames != FIELDS:
                errors.append(f"{p}: header mismatch")
                continue
            rows = list(rd)
        if rows:
            nonempty += 1
        seen = set()
        for i, r in enumerate(rows, start=2):
            for c in FIELDS[:-1]:
                if c == "note":
                    continue
                if not (r.get(c) or "").strip():
                    errors.append(f"{p}:{i} {c} blank")
            for c in ("score1","score2"):
                try:
                    int(r[c])
                except Exception:
                    errors.append(f"{p}:{i} {c} not integer")
            if r["round"] not in ROUNDS:
                errors.append(f"{p}:{i} unknown round {r['round']}")
            key = (r["date"],r["round"],r["team1"],r["score1"],r["team2"],r["score2"])
            if key in seen:
                errors.append(f"{p}:{i} duplicate {key}")
            seen.add(key)

    print(f"2025 spring files: {len(spring_files)} / non-empty: {nonempty}")
    if errors:
        print("\n".join("ERROR: "+e for e in errors[:200]))
        sys.exit(1)
    print("Validation OK")

if __name__ == "__main__":
    main()
