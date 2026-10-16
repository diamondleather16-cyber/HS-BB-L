from pathlib import Path
import csv

def read(path):
    with Path(path).open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

cov=read("output/school_rating_history_coverage.csv")
events=read("output/rating_events.csv")
ratings=read("output/current_ratings.csv")
pre=[r for r in events if int(float(r.get("year") or 0)) < 2025]
if not pre:
    raise SystemExit("V64 validation failed: no pre-2025 school Rating events")
levels={}
for r in pre:
    levels[r.get("level","")]=levels.get(r.get("level",""),0)+1
print("V64 historical school replay OK")
print("pre-2025 rating events:",len(pre))
print("pre-2025 levels:",levels)
print("current ratings:",len(ratings))
print("coverage rows:",len(cov))
