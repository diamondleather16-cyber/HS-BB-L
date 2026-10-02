
from pathlib import Path
import csv, sys

p = Path("output/current_ratings.csv")
if not p.exists():
    print("ERROR: output/current_ratings.csv missing")
    sys.exit(1)

with p.open("r",encoding="utf-8-sig",newline="") as f:
    rows = list(csv.DictReader(f))

errors=[]
if not rows:
    errors.append("rating table empty")
for i,r in enumerate(rows,2):
    try:
        if int(r["games"]) <= 0:
            errors.append(f"row {i}: games <= 0")
        float(r["rating"])
    except Exception:
        errors.append(f"row {i}: invalid numeric field")

if errors:
    for e in errors[:100]:
        print("ERROR:",e)
    sys.exit(1)

print(f"Rating validation OK: {len(rows)} schools")
