from pathlib import Path
import csv
import sys

YEAR = "2026"
SEASON = "spring"

def level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=",1)[1]
    return ""

def stage(note):
    for p in str(note or "").split(";"):
        if p.startswith("stage="):
            return p.split("=",1)[1]
    return ""

def main():
    by_pref = {}
    for p in Path("data").rglob("*_2026.csv"):
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("year")==YEAR and r.get("season")==SEASON and r.get("prefecture"):
                    by_pref.setdefault(r["prefecture"],[]).append(r)

    errors = []
    if len(by_pref) != 47:
        errors.append(f"47 prefectures expected, found={len(by_pref)}")

    for pref, rows in sorted(by_pref.items()):
        pref_rows = [r for r in rows if level(r.get("note"))=="prefecture"]

        if pref == "北海道":
            branch = [
                r for r in pref_rows
                if stage(r.get("note")) in ("branch","district_qualifier")
            ]
            if not branch:
                errors.append("北海道: prefecture hierarchy branch games missing")

            main_regional = [
                r for r in rows
                if level(r.get("note"))=="regional" and stage(r.get("note"))=="main"
            ]
            if not main_regional:
                errors.append("北海道: all-Hokkaido main should exist as regional")
            continue

        counts = {
            rnd:sum(1 for r in pref_rows if r.get("round")==rnd)
            for rnd in ("F","SF","QF")
        }
        if counts["F"] < 1 or counts["SF"] < 2 or counts["QF"] < 4:
            errors.append(
                f"{pref}: prefecture F={counts['F']} SF={counts['SF']} QF={counts['QF']}"
            )

        if pref == "東京":
            prelim = [
                r for r in pref_rows
                if stage(r.get("note")) in ("preliminary","first_qualifier","district_qualifier")
            ]
            if not prelim:
                errors.append("東京: spring preliminary/qualifier games missing from prefecture hierarchy")

    print(f"2026 spring prefecture hierarchy: {len(by_pref)}/47")

    if errors:
        for e in errors[:300]:
            print("ERROR:", e)
        sys.exit(1)

    print("2026 spring prefecture hierarchy validation OK")

if __name__ == "__main__":
    main()
