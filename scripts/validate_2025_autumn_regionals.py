from pathlib import Path
import csv
import sys

DIR = Path("data/regionals/2025_autumn")
EXPECTED = {
    "tohoku","kanto","hokushinetsu","tokai",
    "kinki","chugoku","shikoku","kyushu"
}

def main():
    errors = []
    found = set()

    for path in DIR.glob("*.csv"):
        slug = path.stem
        found.add(slug)

        with path.open("r", encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))

        counts = {
            rnd: sum(1 for r in rows if r.get("round") == rnd)
            for rnd in ("F","SF","QF")
        }

        if len(rows) < 7:
            errors.append(f"{slug}: rows={len(rows)}")
        if counts["F"] < 1:
            errors.append(f"{slug}: F={counts['F']}")
        if counts["SF"] < 2:
            errors.append(f"{slug}: SF={counts['SF']}")
        if counts["QF"] < 4:
            errors.append(f"{slug}: QF={counts['QF']}")

        seen = set()
        for i, r in enumerate(rows, start=2):
            for col in (
                "date","team1","score1","team2",
                "score2","source_url","round"
            ):
                if not str(r.get(col, "")).strip():
                    errors.append(f"{slug} row {i}: {col} blank")

            try:
                int(r["score1"])
                int(r["score2"])
            except Exception:
                errors.append(f"{slug} row {i}: invalid score")

            if "level=regional" not in str(r.get("note", "")):
                errors.append(f"{slug} row {i}: level=regional missing")

            key = (
                r.get("date"), r.get("round"),
                r.get("team1"), r.get("score1"),
                r.get("team2"), r.get("score2")
            )
            if key in seen:
                errors.append(f"{slug}: duplicate {key}")
            seen.add(key)

    missing = EXPECTED - found
    extra = found - EXPECTED

    if missing:
        errors.append(f"missing regional files: {sorted(missing)}")
    if extra:
        errors.append(f"unexpected regional files: {sorted(extra)}")

    print(f"2025 autumn inter-prefecture regionals: {len(found)}/8")
    print("Hokkaido + Tokyo are intentionally referenced from prefecture data.")

    if errors:
        for e in errors[:300]:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 autumn regional validation OK")

if __name__ == "__main__":
    main()
