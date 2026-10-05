from pathlib import Path
import csv

SRC = Path("history/2017_2024_regional_national.csv")
OUT = Path("docs/data/historical_ledger_2017_2024.csv")
AUDIT = Path("docs/data/historical_source_audit_2017_2024.csv")

REGION = {
    "北海道":"hokkaido","東北":"tohoku","関東":"kanto_tokyo","東京":"kanto_tokyo",
    "北信越":"hokushinetsu","東海":"tokai","近畿":"kinki",
    "中国":"chugoku","四国":"shikoku","九州":"kyushu"
}

def kind(t):
    return {
        "春季地区":("spring","regional"),
        "秋季地区":("autumn","regional"),
        "選抜":("senbatsu","national"),
        "選手権":("koshien","national"),
        "明治神宮":("jingu","national"),
    }.get(t,("",""))

def main():
    if not SRC.exists():
        print(f"skip: {SRC} not found")
        return

    with SRC.open("r",encoding="utf-8-sig",newline="") as f:
        rows=list(csv.DictReader(f))

    out=[]
    for r in rows:
        season,level=kind(r["tournament_type"])
        district=(r.get("district") or "").strip()
        region="national" if level=="national" else REGION.get(district,district)
        p1=(r.get("team1_prefecture") or "").strip()
        p2=(r.get("team2_prefecture") or "").strip()
        note=[f"level={level}","historical_reference=1"]
        if p1: note.append(f"team1_pref={p1}")
        if p2: note.append(f"team2_pref={p2}")
        if (r.get("note") or "").strip(): note.append(f"legacy_note={r['note'].strip()}")
        if str(r.get("exclude_from_rating","0")).strip() in ("1","1.0"): note.append("exclude_from_rating=1")
        year=str(r["year"]).split(".")[0]
        tournament={
            "春季地区":f"{year}春季{district}地区大会",
            "秋季地区":f"{year}秋季{district}地区大会",
            "選抜":f"{year}選抜",
            "選手権":f"{year}選手権",
            "明治神宮":f"{year}明治神宮大会",
        }.get(r["tournament_type"],f"{year} {r['tournament_type']}")
        out.append({
            "year":year,"season":season,"region":region,"prefecture":"","sub_area":"",
            "tournament":tournament,"round":r.get("round_code",""),"date":"",
            "team1":r.get("team1",""),"score1":r.get("score1",""),
            "team2":r.get("team2",""),"score2":r.get("score2",""),
            "team1_prefecture":p1,"team2_prefecture":p2,"source_url":"",
            "source_ref":"v1_3_workcopy.xlsx / 試合元帳",
            "source_status":"元帳あり・Web URL未登録",
            "source_dataset":r.get("source_dataset","v1_3_workcopy.xlsx"),
            "note":";".join(note),
        })

    OUT.parent.mkdir(parents=True,exist_ok=True)
    fields=list(out[0].keys())
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(out)

    counts={}
    for r in out:
        key=(r["year"],r["season"],r["region"],r["tournament"],r["source_ref"],r["source_status"])
        counts[key]=counts.get(key,0)+1
    with AUDIT.open("w",encoding="utf-8-sig",newline="") as f:
        fields=["year","season","region","tournament","source_ref","source_status","match_count"]
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for key,n in sorted(counts.items()):
            w.writerow(dict(zip(fields[:-1],key),match_count=n))

    print(f"historical ledger: {len(out)} rows")

if __name__=="__main__":
    main()
