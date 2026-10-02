from pathlib import Path
import csv

from normalize import load_school_aliases, normalize_school_name

DATA_DIR = Path("data")
OUTPUT_DIR = Path("output")
OUTPUT_FILE = OUTPUT_DIR / "all_matches.csv"

FIELDNAMES = [
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


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    aliases = load_school_aliases()

    csv_files = [
        p for p in DATA_DIR.rglob("*.csv")
        if p.name != "template.csv"
    ]

    rows = []

    for path in sorted(csv_files):
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            if reader.fieldnames is None:
                print(f"SKIP: ヘッダーなし {path}")
                continue

            missing = [field for field in FIELDNAMES if field not in reader.fieldnames]
            if missing:
                print(f"SKIP: 必須列不足 {path} -> " + ", ".join(missing))
                continue

            for row in reader:
                if not any((row.get(field) or "").strip() for field in FIELDNAMES):
                    continue

                row["team1"] = normalize_school_name(row["team1"], aliases)
                row["team2"] = normalize_school_name(row["team2"], aliases)
                row["_source_file"] = str(path)
                rows.append(row)

    unique_rows = []
    seen = set()

    for row in rows:
        game_key = (
            row["year"],
            row["season"],
            row["prefecture"],
            row["tournament"],
            row["round"],
            row["date"],
            row["team1"],
            row["score1"],
            row["team2"],
            row["score2"],
        )

        if game_key in seen:
            continue

        seen.add(game_key)
        unique_rows.append(row)

    unique_rows.sort(
        key=lambda r: (
            r["year"],
            r["season"],
            r["region"],
            r["prefecture"],
            r["tournament"],
            r["date"],
            r["round"],
            r["team1"],
            r["team2"],
        )
    )

    output_fields = FIELDNAMES + ["_source_file"]

    with OUTPUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=output_fields)
        writer.writeheader()

        for row in unique_rows:
            writer.writerow({field: row.get(field, "") for field in output_fields})

    print("=" * 60)
    print("全国試合データ統合完了")
    print(f"読込CSV数: {len(csv_files)}")
    print(f"読込試合数: {len(rows)}")
    print(f"重複除去後: {len(unique_rows)}")
    print(f"出力先: {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
