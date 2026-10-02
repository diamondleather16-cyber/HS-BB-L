from pathlib import Path
import csv

SCHOOLS_FILE = Path("master/schools.csv")


def load_school_aliases():
    aliases = {}

    with SCHOOLS_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            canonical = row["canonical_name"].strip()
            if not canonical:
                continue

            aliases[canonical] = canonical

            for key, value in row.items():
                if not key.startswith("alias"):
                    continue

                alias = (value or "").strip()
                if alias:
                    aliases[alias] = canonical

    return aliases


def normalize_school_name(name, aliases):
    name = (name or "").strip()
    if not name:
        return ""

    return aliases.get(name, name)


if __name__ == "__main__":
    aliases = load_school_aliases()

    test_names = [
        "星稜",
        "星稜高",
        "星稜高校",
        "金沢高校",
        "富山商業",
        "敦賀気比高",
        "日本文理高校",
        "上田西高",
        "未登録高校",
    ]

    for name in test_names:
        print(f"{name} -> {normalize_school_name(name, aliases)}")
