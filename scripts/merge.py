from pathlib import Path
import csv, hashlib
from normalize import load_school_aliases, normalize_school_name

DATA_DIR=Path("data")
OUT=Path("output/all_matches.csv")
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]

def stable_source_match_id(path,row_no,row):
    src=str(path).replace("\\","/")
    body="¦".join([
        src,str(row_no),
        *[str(row.get(k) or "").strip() for k in FIELDS]
    ])
    return "SRCROW-"+hashlib.sha1(body.encode("utf-8")).hexdigest()[:20].upper()

def main():
    aliases=load_school_aliases()
    rows=[]
    skipped_blank_tournament=0

    for p in sorted(DATA_DIR.rglob("*.csv")):
        if p.name=="template.csv":
            continue
        with p.open("r",encoding="utf-8-sig",newline="") as f:
            rd=csv.DictReader(f)
            if not rd.fieldnames or any(x not in rd.fieldnames for x in FIELDS):
                continue
            for source_row,r in enumerate(rd,start=2):
                if not any((r.get(x) or "").strip() for x in FIELDS):
                    continue

                # V67: a match without a tournament name is malformed ledger data.
                # Keep it out of generated ledger/rating output permanently even if
                # an old source CSV still contains it.
                if not str(r.get("tournament") or "").strip():
                    skipped_blank_tournament+=1
                    continue

                r["team1"]=normalize_school_name(r["team1"],aliases)
                r["team2"]=normalize_school_name(r["team2"],aliases)
                r["_source_file"]=str(p)
                r["_source_row"]=str(source_row)
                r["match_id"]=stable_source_match_id(p,source_row,r)
                rows.append(r)

    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields=FIELDS+["_source_file","_source_row","match_id"]
        w=csv.DictWriter(f,fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"{len(rows)} matches -> {OUT}; blank tournament removed={skipped_blank_tournament}")

if __name__=="__main__":
    main()
