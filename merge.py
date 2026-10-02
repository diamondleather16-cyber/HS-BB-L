from pathlib import Path
import csv
from normalize import load_school_aliases, normalize_school_name

DATA_DIR = Path("data")
OUTPUT_DIR = Path("output")
OUTPUT_FILE = OUTPUT_DIR / "all_matches.csv"

FIELDS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    aliases = load_school_aliases()
    files = [p for p in DATA_DIR.rglob("*.csv") if p.name != "template.csv"]

    rows = []
    for p in sorted(files):
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames is None:
                continue
            missing = [c for c in FIELDS if c not in reader.fieldnames]
            if missing:
                print(f"SKIP {p}: 必須列不足 {missing}")
                continue

            for row in reader:
                if not any((row.get(c) or "").strip() for c in FIELDS):
                    continue
                row["team1"] = normalize_school_name(row["team1"], aliases)
                row["team2"] = normalize_school_name(row["team2"], aliases)
                row["_source_file"] = str(p)
                rows.append(row)

    seen = set()
    unique = []
    for row in rows:
        key = tuple(row.get(c, "") for c in [
            "year","season","prefecture","tournament","round","date",
            "team1","score1","team2","score2"
        ])
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    out_fields = FIELDS + ["_source_file"]
    with OUTPUT_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader()
        for row in unique:
            w.writerow({c: row.get(c, "") for c in out_fields})

    print(f"CSV数: {len(files)}")
    print(f"読込試合数: {len(rows)}")
    print(f"重複除去後: {len(unique)}")
    print(f"出力: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
