#!/usr/bin/env python3
"""Regenerate dashboard's match ledger and ratings from repository CSV sources.
Rating formula mirrors app.js calcRatings: Elo 1500, K=24*level weight.
Do not treat these as independently validated official rankings.
"""
import csv,collections,re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
WEIGHTS={"branch":.65,"district_qualifier":.65,"first_qualifier":.65,"qualifier_league":.60,"repechage":.60,"prefecture":.90,"regional":1.15,"national":1.35}
def main():
    unique={}
    total=0
    for path in sorted((ROOT/"data").rglob("*.csv")):
        if path.name in ("all_matches.csv","current_ratings.csv","template.csv"):continue
        try:
            with path.open(encoding="utf-8-sig",newline="") as f:
                reader=csv.DictReader(f)
                if not reader.fieldnames or not {"team1","team2","score1","score2","date"}.issubset(reader.fieldnames):continue
                for row in reader:
                    try:
                        r={k:str(row.get(k) or "").strip() for k in FIELDS}
                        r["score1"]=str(int(r["score1"]))
                        r["score2"]=str(int(r["score2"]))
                        if not (r["team1"] and r["team2"] and re.fullmatch(r"20\d\d-\d\d-\d\d",r["date"])):continue
                    except (ValueError,TypeError):continue
                    key=(r["date"],r["team1"],r["team2"],r["score1"],r["score2"])
                    total+=1
                    if key not in unique or ("level=" not in unique[key].get("note","") and "level=" in r["note"]):
                        unique[key]=r
        except (OSError,UnicodeError,csv.Error):continue
    rows=sorted(unique.values(),key=lambda r:(r["date"],r["year"],r["season"],r["prefecture"],r["team1"],r["team2"]))
    ratings=collections.defaultdict(lambda:{"rating":1500.0,"games":0,"wins":0,"losses":0,"draws":0,"runs_for":0,"runs_against":0,"prefecture":"","region":""})
    for r in rows:
        a,b=ratings[r["team1"]],ratings[r["team2"]]
        for st in (a,b):
            if not st["prefecture"] and r["prefecture"]:st["prefecture"]=r["prefecture"]
            if not st["region"] and r["region"]:st["region"]=r["region"]
        expected=1/(1+10**((b["rating"]-a["rating"])/400))
        result=1 if int(r["score1"])>int(r["score2"]) else (0 if int(r["score1"])<int(r["score2"]) else .5)
        m=re.search(r"(?:^|;)level=([^;]+)",r["note"])
        weight=WEIGHTS.get(m.group(1),.9) if m else .9
        change=24*weight*(result-expected)
        a["rating"]+=change;b["rating"]-=change
        a["games"]+=1;b["games"]+=1
        a["runs_for"]+=int(r["score1"]);a["runs_against"]+=int(r["score2"])
        b["runs_for"]+=int(r["score2"]);b["runs_against"]+=int(r["score1"])
        if result==1:a["wins"]+=1;b["losses"]+=1
        elif result==0:b["wins"]+=1;a["losses"]+=1
        else:a["draws"]+=1;b["draws"]+=1
    def write(path,fields,data):
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open("w",encoding="utf-8-sig",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(data)
    write(ROOT/"data/all_matches.csv",FIELDS,rows)
    rating_fields=["school","rating","games","wins","losses","draws","runs_for","runs_against","prefecture","region","history_prior"]
    out=[{"school":team,**{k:(f"{v:.3f}" if k=="rating" else v) for k,v in st.items()},"history_prior":0} for team,st in ratings.items()]
    out.sort(key=lambda r:-float(r["rating"]))
    write(ROOT/"data/current_ratings.csv",rating_fields,out)
    report={"source_rows":total,"unique_games":len(rows),"duplicates_removed":total-len(rows),"schools":len(out),"calculation":"app.js compatible raw-name Elo v1","known_limitations":"No alias normalization, no historical priors; coverage not certified."}
    (ROOT/"master/rating_build_status.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
