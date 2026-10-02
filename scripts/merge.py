from pathlib import Path
import csv
from normalize import load_school_aliases, normalize_school_name
DATA_DIR=Path("data"); OUT=Path("output/all_matches.csv")
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
def main():
    aliases=load_school_aliases(); rows=[]
    for p in sorted(DATA_DIR.rglob("*.csv")):
        if p.name=="template.csv": continue
        with p.open("r",encoding="utf-8-sig",newline="") as f:
            rd=csv.DictReader(f)
            if not rd.fieldnames or any(x not in rd.fieldnames for x in FIELDS): continue
            for r in rd:
                if not any((r.get(x) or "").strip() for x in FIELDS): continue
                r["team1"]=normalize_school_name(r["team1"],aliases)
                r["team2"]=normalize_school_name(r["team2"],aliases)
                r["_source_file"]=str(p); rows.append(r)
    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields=FIELDS+["_source_file"]; w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    print(f"{len(rows)} matches -> {OUT}")
if __name__=="__main__": main()
