from pathlib import Path
import csv
SCHOOLS_FILE = Path("master/schools.csv")
def load_school_aliases():
    aliases = {}
    if not SCHOOLS_FILE.exists():
        return aliases
    with SCHOOLS_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            canonical = (row.get("canonical_name") or "").strip()
            if not canonical:
                continue
            aliases[canonical] = canonical
            for k,v in row.items():
                if k.startswith("alias") and (v or "").strip():
                    aliases[v.strip()] = canonical
    return aliases
def normalize_school_name(name, aliases):
    name = (name or "").strip()
    return aliases.get(name, name)
