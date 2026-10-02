from pathlib import Path
import csv
import sys

DATA_DIR = Path("data")
YEAR = "2025"
SEASON = "autumn"

def main():
    errors = []
    prefecture_rows = {}

    for path in DATA_DIR.rglob("*_2025.csv"):
        if not path.is_file():
            continue

        with path.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as f:

            reader = csv.DictReader(f)

            for row in reader:
                if (
                    str(row.get("year", "")).strip() == YEAR
                    and str(row.get("season", "")).strip() == SEASON
                    and "level=regional" not in str(row.get("note", ""))
                ):
                    pref = str(row.get("prefecture", "")).strip()

                    if pref:
                        prefecture_rows.setdefault(
                            pref,
                            []
                        ).append(row)

    if len(prefecture_rows) != 47:
        errors.append(
            f"秋データが47都道府県に揃っていません: "
            f"{len(prefecture_rows)}/47"
        )

    for pref, rows in sorted(prefecture_rows.items()):
        counts = {
            round_name: sum(
                1
                for row in rows
                if row.get("round") == round_name
            )
            for round_name in ("F", "SF", "QF")
        }

        if counts["F"] < 1:
            errors.append(
                f"{pref}: F={counts['F']}"
            )

        if counts["SF"] < 2:
            errors.append(
                f"{pref}: SF={counts['SF']}"
            )

        if counts["QF"] < 4:
            errors.append(
                f"{pref}: QF={counts['QF']}"
            )

        seen = set()

        for row_no, row in enumerate(
            rows,
            start=1,
        ):
            for column in (
                "date",
                "team1",
                "score1",
                "team2",
                "score2",
                "source_url",
                "round",
            ):
                if not str(
                    row.get(column, "")
                ).strip():
                    errors.append(
                        f"{pref} autumn row {row_no}: "
                        f"{column} blank"
                    )

            try:
                int(row["score1"])
                int(row["score2"])

            except Exception:
                errors.append(
                    f"{pref} autumn row {row_no}: "
                    "invalid score"
                )

            key = (
                row.get("date"),
                row.get("round"),
                row.get("team1"),
                row.get("score1"),
                row.get("team2"),
                row.get("score2"),
            )

            if key in seen:
                errors.append(
                    f"{pref} autumn duplicate: {key}"
                )

            seen.add(key)

    print(
        f"2025 autumn prefectures: "
        f"{len(prefecture_rows)}/47"
    )

    if errors:
        for error in errors[:300]:
            print(
                "ERROR:",
                error,
            )

        sys.exit(1)

    print(
        "2025 autumn prefecture validation OK"
    )

if __name__ == "__main__":
    main()
