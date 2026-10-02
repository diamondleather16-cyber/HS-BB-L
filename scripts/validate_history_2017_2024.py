from pathlib import Path
import csv
import sys

SOURCE = Path("data/history/2017_2024_regional_national.csv")
MATCHUPS = Path("master/prefecture_matchups.csv")
STRENGTH = Path("master/prefecture_strength_prior.csv")

EXPECTED_TOURNEYS = {"春季地区","秋季地区","明治神宮","選抜","選手権"}

def main():
    errors = []

    if not SOURCE.exists():
        errors.append("historical source missing")
    else:
        with SOURCE.open("r",encoding="utf-8-sig",newline="") as f:
            rows = list(csv.DictReader(f))

        if len(rows) != 2890:
            errors.append(f"historical rows={len(rows)} expected=2890")

        years = {int(r["year"]) for r in rows}
        if min(years) != 2017 or max(years) != 2024:
            errors.append(f"year range={min(years)}-{max(years)}")

        tours = {r["tournament_type"] for r in rows}
        if not EXPECTED_TOURNEYS.issubset(tours):
            errors.append(f"missing tournament types: {EXPECTED_TOURNEYS - tours}")

        for i,r in enumerate(rows,2):
            for c in (
                "team1","team1_id","team1_prefecture",
                "team2","team2_id","team2_prefecture",
                "tournament_type","year"
            ):
                if not str(r.get(c,"")).strip():
                    errors.append(f"row {i}: {c} blank")
                    break

    for p in (MATCHUPS, STRENGTH):
        if not p.exists():
            errors.append(f"{p} missing")

    if errors:
        for e in errors[:100]:
            print("ERROR:", e)
        sys.exit(1)

    print("2017-2024 historical layer validation OK")

if __name__ == "__main__":
    main()
