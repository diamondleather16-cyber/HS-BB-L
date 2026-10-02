from pathlib import Path
import csv
import sys

DATA_DIR = Path("data")
YEAR = "2025"
SEASON = "autumn"

VALID_LEVELS = {
    "prefecture",
    "district_qualifier",
    "branch",
    "first_qualifier",
    "qualifier_league",
    "repechage",
}

def get_level(note):
    for part in str(note or "").split(";"):
        if part.startswith("level="):
            return part.split("=", 1)[1]
    return ""

def main():
    errors = []
    prefectures = {}

    for path in DATA_DIR.rglob("*_2025.csv"):
        if not path.is_file():
            continue

        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                if (
                    str(row.get("year", "")).strip() == YEAR
                    and str(row.get("season", "")).strip() == SEASON
                ):
                    pref = str(row.get("prefecture", "")).strip()
                    if pref:
                        prefectures.setdefault(pref, []).append(row)

    if len(prefectures) != 47:
        errors.append(
            f"秋データが47都道府県に揃っていません: "
            f"{len(prefectures)}/47"
        )

    for pref, rows in sorted(prefectures.items()):
        # 県大会本戦だけでQF/SF/Fチェック
        main_rows = [
            r for r in rows if get_level(r.get("note")) == "prefecture"
        ]

        counts = {
            rnd: sum(1 for r in main_rows if r.get("round") == rnd)
            for rnd in ("F","SF","QF")
        }

        if counts["F"] < 1:
            errors.append(f"{pref}: prefecture F={counts['F']}")
        if counts["SF"] < 2:
            errors.append(f"{pref}: prefecture SF={counts['SF']}")
        if counts["QF"] < 4:
            errors.append(f"{pref}: prefecture QF={counts['QF']}")

        seen = set()

        for row_no, row in enumerate(rows, start=1):
            level = get_level(row.get("note"))

            if level not in VALID_LEVELS:
                errors.append(
                    f"{pref} row {row_no}: invalid/missing level={level}"
                )

            for column in (
                "date","team1","score1","team2",
                "score2","source_url","round"
            ):
                if not str(row.get(column, "")).strip():
                    errors.append(
                        f"{pref} row {row_no}: {column} blank"
                    )

            try:
                int(row["score1"])
                int(row["score2"])
            except Exception:
                errors.append(
                    f"{pref} row {row_no}: invalid score"
                )

            key = (
                row.get("date"), row.get("round"),
                row.get("team1"), row.get("score1"),
                row.get("team2"), row.get("score2"),
                level,
            )

            if key in seen:
                errors.append(
                    f"{pref} duplicate: {key}"
                )
            seen.add(key)

    print(f"2025 autumn prefectures: {len(prefectures)}/47")

    if errors:
        for e in errors[:400]:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 autumn all-level validation OK")

if __name__ == "__main__":
    main()
