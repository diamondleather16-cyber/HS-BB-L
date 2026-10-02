from pathlib import Path
import csv
import sys

DIR = Path("data/regionals/2025_spring")
EXPECTED_FILES = {
    "hokkaido.csv",
    "tohoku.csv",
    "kanto.csv",
    "hokushinetsu.csv",
    "tokai.csv",
    "kinki.csv",
    "chugoku.csv",
    "shikoku.csv",
    "kyushu.csv",
}

def main():
    errors = []
    found = {p.name for p in DIR.glob("*.csv")} if DIR.exists() else set()

    missing = EXPECTED_FILES - found
    if missing:
        errors.append("missing files: " + ", ".join(sorted(missing)))

    for p in sorted(DIR.glob("*.csv")):
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))

        if not rows:
            errors.append(f"{p}: no rows")
            continue

        counts = {
            rnd: sum(1 for r in rows if r.get("round") == rnd)
            for rnd in ("F","SF","QF")
        }

        if counts["F"] < 1:
            errors.append(f"{p}: F={counts['F']}")
        if counts["SF"] < 2:
            errors.append(f"{p}: SF={counts['SF']}")

        for i, r in enumerate(rows, start=2):
            for c in (
                "year","season","region","tournament","round",
                "date","team1","score1","team2","score2","source_url"
            ):
                if not str(r.get(c, "")).strip():
                    errors.append(f"{p}:{i} {c} blank")
            try:
                int(r["score1"]); int(r["score2"])
            except Exception:
                errors.append(f"{p}:{i} invalid score")

    print(f"2025 spring regional files: {len(found)}/9")

    if errors:
        for e in errors[:200]:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 spring regionals validation OK")

if __name__ == "__main__":
    main()
