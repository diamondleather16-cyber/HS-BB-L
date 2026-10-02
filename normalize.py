from pathlib import Path
import csv

SCHOOLS_FILE = Path("master/schools.csv")

def load_school_aliases():
    aliases = {}
    with SCHOOLS_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            canonical = (row.get("canonical_name") or "").strip()
            if not canonical:
                continue
            aliases[canonical] = canonical
            for key, value in row.items():
                if key.startswith("alias"):
                    alias = (value or "").strip()
                    if alias:
                        aliases[alias] = canonical
    return aliases

def normalize_school_name(name, aliases):
    name = (name or "").strip()
    return aliases.get(name, name)

if __name__ == "__main__":
    aliases = load_school_aliases()
    print(f"aliases: {len(aliases)}")
