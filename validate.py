from pathlib import Path
import csv
from collections import Counter

DATA_DIR = Path("data")

REQUIRED_COLUMNS = [
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

VALID_SEASONS = {"spring","summer","autumn","senbatsu","koshien","jingu"}
VALID_ROUNDS = {"1R","2R","3R","4R","5R","QF","SF","F"}

def validate_file(path):
    errors, warnings = [], []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return ["CSVヘッダーがありません"], []
        missing = [c for c in REQUIRED_COLUMNS if c not in reader.fieldnames]
        if missing:
            return ["不足列: " + ", ".join(missing)], []
        rows = list(reader)

    seen = Counter()
    for line_no, row in enumerate(rows, start=2):
        # Skip completely blank rows
        if not any((row.get(c) or "").strip() for c in REQUIRED_COLUMNS):
            continue

        for c in ["year","season","region","prefecture","tournament","round","team1","score1","team2","score2"]:
            if not (row.get(c) or "").strip():
                errors.append(f"{line_no}行目: {c} が空欄")

        y = (row.get("year") or "").strip()
        if y:
            try:
                int(y)
            except ValueError:
                errors.append(f"{line_no}行目: year が数値ではありません")

        s = (row.get("season") or "").strip()
        if s and s not in VALID_SEASONS:
            warnings.append(f"{line_no}行目: season={s} は標準値ではありません")

        r = (row.get("round") or "").strip()
        if r and r not in VALID_ROUNDS:
            warnings.append(f"{line_no}行目: round={r} は標準値ではありません")

        for c in ["score1","score2"]:
            v = (row.get(c) or "").strip()
            if v:
                try:
                    sc = int(v)
                    if sc < 0:
                        errors.append(f"{line_no}行目: {c} がマイナス")
                except ValueError:
                    errors.append(f"{line_no}行目: {c}={v} が整数ではありません")

        if (row.get("team1") or "").strip() == (row.get("team2") or "").strip() and (row.get("team1") or "").strip():
            errors.append(f"{line_no}行目: team1 と team2 が同じ学校")

        if not (row.get("source_url") or "").strip():
            warnings.append(f"{line_no}行目: source_url が空欄")

        key = tuple((row.get(c) or "").strip() for c in [
            "year","season","prefecture","tournament","round","date","team1","team2"
        ])
        seen[key] += 1

    for game, count in seen.items():
        if count > 1:
            errors.append(f"重複試合 {count}件: {game}")
    return errors, warnings

def main():
    files = [p for p in DATA_DIR.rglob("*.csv") if p.name != "template.csv"]
    total_e = total_w = 0
    if not files:
        print("試合CSVがありません。")
        return
    for p in sorted(files):
        e, w = validate_file(p)
        print(f"\n[{p}]")
        if not e and not w:
            print("OK")
        for x in e:
            print("ERROR:", x)
        for x in w:
            print("WARNING:", x)
        total_e += len(e); total_w += len(w)
    print(f"\n検査終了: ERROR {total_e}件 / WARNING {total_w}件")
    if total_e:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
