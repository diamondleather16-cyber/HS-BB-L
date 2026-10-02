from pathlib import Path
import csv
import sys

def read(path):
    with Path(path).open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=",1)[1]
    return ""

def main():
    errors = []

    # 8地区CSV
    expected = {
        "tohoku","kanto","hokushinetsu","tokai",
        "kinki","chugoku","shikoku","kyushu"
    }
    folder = Path("data/regionals/2025_autumn")
    found = {p.stem for p in folder.glob("*.csv")}

    if found != expected:
        errors.append(f"regional files mismatch found={sorted(found)}")

    for slug in sorted(expected):
        p = folder / f"{slug}.csv"
        if not p.exists():
            continue
        rows = read(p)
        counts = {r: sum(1 for x in rows if x.get("round") == r) for r in ("F","SF","QF")}
        if counts["F"] < 1 or counts["SF"] < 2 or counts["QF"] < 4:
            errors.append(f"{slug}: F={counts['F']} SF={counts['SF']} QF={counts['QF']}")
        for i, x in enumerate(rows, 2):
            if level(x.get("note")) != "regional":
                errors.append(f"{slug} row {i}: level not regional")
            try:
                int(x["score1"]); int(x["score2"])
            except Exception:
                errors.append(f"{slug} row {i}: invalid score")

    # 北海道・東京は既存県ファイル内で regional
    singles = [
        ("北海道", "data/01_hokkaido/hokkaido_2025.csv"),
        ("東京", "data/03_kanto_tokyo/tokyo_2025.csv"),
    ]
    for name, path in singles:
        rows = [
            x for x in read(path)
            if x.get("year") == "2025"
            and x.get("season") == "autumn"
            and level(x.get("note")) == "regional"
        ]
        counts = {r: sum(1 for x in rows if x.get("round") == r) for r in ("F","SF","QF")}
        if counts["F"] < 1 or counts["SF"] < 2 or counts["QF"] < 4:
            errors.append(f"{name}: regional F={counts['F']} SF={counts['SF']} QF={counts['QF']}")

    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 autumn regional hierarchy validation OK: 10/10")

if __name__ == "__main__":
    main()
