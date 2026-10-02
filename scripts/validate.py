from pathlib import Path
import csv
from collections import Counter

DATA_DIR = Path("data")

REQUIRED_COLUMNS = [
    "year",
    "season",
    "region",
    "prefecture",
    "tournament",
    "round",
    "date",
    "team1",
    "score1",
    "team2",
    "score2",
    "source_url",
    "note",
]

VALID_SEASONS = {
    "spring",
    "summer",
    "autumn",
    "senbatsu",
    "koshien",
    "jingu",
}

VALID_ROUNDS = {
    "1R",
    "2R",
    "3R",
    "4R",
    "5R",
    "QF",
    "SF",
    "F",
}


def validate_file(path):
    errors = []
    warnings = []

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        if reader.fieldnames is None:
            return ["CSVヘッダーがありません"], []

        missing_columns = [
            col for col in REQUIRED_COLUMNS
            if col not in reader.fieldnames
        ]

        if missing_columns:
            errors.append("不足列: " + ", ".join(missing_columns))
            return errors, warnings

        rows = list(reader)

    seen_games = Counter()

    for line_no, row in enumerate(rows, start=2):
        required_values = [
            "year",
            "season",
            "region",
            "prefecture",
            "tournament",
            "round",
            "team1",
            "score1",
            "team2",
            "score2",
        ]

        for col in required_values:
            if not row[col].strip():
                errors.append(f"{line_no}行目: {col} が空欄")

        if row["year"].strip():
            try:
                year = int(row["year"])
                if year < 1900 or year > 2100:
                    warnings.append(f"{line_no}行目: year={year} を確認")
            except ValueError:
                errors.append(f"{line_no}行目: year が数値ではありません")

        season = row["season"].strip()
        if season and season not in VALID_SEASONS:
            warnings.append(f"{line_no}行目: season={season} は標準値ではありません")

        round_name = row["round"].strip()
        if round_name and round_name not in VALID_ROUNDS:
            warnings.append(f"{line_no}行目: round={round_name} は標準値ではありません")

        for score_col in ["score1", "score2"]:
            value = row[score_col].strip()
            if not value:
                continue

            try:
                score = int(value)
                if score < 0:
                    errors.append(f"{line_no}行目: {score_col} がマイナス")
                if score > 50:
                    warnings.append(f"{line_no}行目: {score_col}={score} は高得点なので確認")
            except ValueError:
                errors.append(f"{line_no}行目: {score_col}={value} が整数ではありません")

        if row["team1"].strip() and row["team1"].strip() == row["team2"].strip():
            errors.append(f"{line_no}行目: team1 と team2 が同じ学校")

        if not row["source_url"].strip():
            warnings.append(f"{line_no}行目: source_url が空欄")

        game_key = (
            row["year"].strip(),
            row["season"].strip(),
            row["prefecture"].strip(),
            row["tournament"].strip(),
            row["round"].strip(),
            row["date"].strip(),
            row["team1"].strip(),
            row["team2"].strip(),
        )

        seen_games[game_key] += 1

    for game, count in seen_games.items():
        if count > 1:
            errors.append(f"重複試合 {count}件: {game}")

    return errors, warnings


def main():
    csv_files = [
        p for p in DATA_DIR.rglob("*.csv")
        if p.name != "template.csv"
    ]

    if not csv_files:
        print("試合CSVがありません。")
        return

    total_errors = 0
    total_warnings = 0

    print("=" * 60)
    print("高校野球データ検査")
    print("=" * 60)

    for path in sorted(csv_files):
        errors, warnings = validate_file(path)

        print()
        print(f"[{path}]")

        if not errors and not warnings:
            print("OK")

        for error in errors:
            print("ERROR:", error)

        for warning in warnings:
            print("WARNING:", warning)

        total_errors += len(errors)
        total_warnings += len(warnings)

    print()
    print("=" * 60)
    print(f"検査終了: ERROR {total_errors}件 / WARNING {total_warnings}件")
    print("=" * 60)

    if total_errors == 0:
        print("致命的なデータエラーはありません。")
    else:
        print("ERRORを修正してください。")


if __name__ == "__main__":
    main()
