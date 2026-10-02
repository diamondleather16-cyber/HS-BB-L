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

def count(rows, season, lvl, rnd=None, source_contains=None):
    xs = [
        r for r in rows
        if r.get("year") == "2025"
        and r.get("season") == season
        and level(r.get("note")) == lvl
    ]
    if rnd is not None:
        xs = [r for r in xs if r.get("round") == rnd]
    if source_contains is not None:
        xs = [r for r in xs if source_contains in r.get("source_url","")]
    return len(xs)

def main():
    h = read("data/01_hokkaido/hokkaido_2025.csv")
    t = read("data/03_kanto_tokyo/tokyo_2025.csv")
    errors = []

    # Summer Hokkaido main two tournaments
    for rnd, expected in (("F",2),("SF",4),("QF",8)):
        n = count(h, "summer", "prefecture", rnd)
        if n < expected:
            errors.append(f"summer Hokkaido {rnd}={n} expected>={expected}")

    nb = count(h, "summer", "branch", source_contains="3540")
    sb = count(h, "summer", "branch", source_contains="3541")
    if nb <= 0:
        errors.append("summer North Hokkaido branch qualifiers missing")
    if sb <= 0:
        errors.append("summer South Hokkaido branch qualifiers missing")

    # Autumn Hokkaido regional main + prefecture-level branch qualifiers
    for rnd, expected in (("F",1),("SF",2),("QF",4)):
        n = count(h, "autumn", "regional", rnd)
        if n < expected:
            errors.append(f"autumn Hokkaido regional {rnd}={n} expected>={expected}")
    if count(h, "autumn", "prefecture", "QUAL") <= 0:
        errors.append("autumn Hokkaido prefecture-level branch qualifiers missing")

    # Autumn Tokyo regional main + prefecture-level first qualifiers
    for rnd, expected in (("F",1),("SF",2),("QF",4)):
        n = count(t, "autumn", "regional", rnd)
        if n < expected:
            errors.append(f"autumn Tokyo regional {rnd}={n} expected>={expected}")
    if count(t, "autumn", "prefecture", "QUAL") <= 0:
        errors.append("autumn Tokyo prefecture-level first qualifiers missing")

    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)

    print("2025 Hokkaido/Tokyo special hierarchy validation OK")

if __name__ == "__main__":
    main()
