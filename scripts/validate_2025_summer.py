from pathlib import Path
import csv
import sys

DATA_DIR = Path("data")
YEAR = "2025"
SEASON = "summer"

EXPECTED = {
    "北海道": {"F": 2, "SF": 4, "QF": 8},
    "東京": {"F": 2, "SF": 4, "QF": 8},
}
DEFAULT = {"F": 1, "SF": 2, "QF": 4}

def main():
    errors = []
    prefecture_rows = {}

    for p in DATA_DIR.rglob("*_2025.csv"):
        if not p.is_file():
            continue
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            rd = csv.DictReader(f)
            for r in rd:
                if (
                    str(r.get("year", "")).strip() == YEAR
                    and str(r.get("season", "")).strip() == SEASON
                ):
                    pref = str(r.get("prefecture", "")).strip()
                    prefecture_rows.setdefault(pref, []).append(r)

    if len(prefecture_rows) != 47:
        errors.append(
            f"夏データが47都道府県に揃っていません: "
            f"{len(prefecture_rows)}/47"
        )

    for pref, rows in sorted(prefecture_rows.items()):
        expected = EXPECTED.get(pref, DEFAULT)
        counts = {
            r: sum(1 for x in rows if x.get("round") == r)
            for r in ("F","SF","QF")
        }
        for rnd in ("F","SF","QF"):
            if counts[rnd] < expected[rnd]:
                errors.append(
                    f"{pref}: {rnd}={counts[rnd]} "
                    f"(expected {expected[rnd]})"
                )

        seen = set()
        for i, r in enumerate(rows, start=1):
            for col in (
                "date","team1","score1","team2",
                "score2","source_url","round"
            ):
                if not str(r.get(col, "")).strip():
                    errors.append(
                        f"{pref} summer row {i}: {col} blank"
                    )
            try:
                int(r["score1"])
                int(r["score2"])
            except Exception:
                errors.append(
                    f"{pref} summer row {i}: invalid score"
                )
            key = (
                r.get("date"), r.get("round"),
                r.get("team1"), r.get("score1"),
                r.get("team2"), r.get("score2"),
                r.get("source_url")
            )
            if key in seen:
                errors.append(
                    f"{pref} summer duplicate: {key}"
                )
            seen.add(key)

    print(
        f"2025 summer prefectures: "
        f"{len(prefecture_rows)}/47"
    )

    if errors:
        for e in errors[:300]:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 summer validation OK")

if __name__ == "__main__":
    main()
