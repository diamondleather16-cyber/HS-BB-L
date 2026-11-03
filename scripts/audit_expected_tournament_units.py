#!/usr/bin/env python3
"""Inventory entire published ledger by expected tournament unit, contrasting Nov 2 snapshot."""
import csv,io,json,subprocess,re
from collections import defaultdict,Counter
from pathlib import Path
from datetime import datetime,timezone
BASE="9d1c1338292346f41cdeda5be4555121a83d0be4"
PREFS="北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
REGIONS="hokkaido tohoku kanto_tokyo hokushinetsu tokai kinki chugoku shikoku kyushu".split()
def load(b):return list(csv.DictReader(io.StringIO(b.decode("utf-8-sig"))))
def past(y):
    p=f"docs/data/ledger_shards/{y}.csv"
    o=subprocess.run(["git","show",f"{BASE}:{p}"],capture_output=True)
    return load(o.stdout) if o.returncode==0 else []
def current(y):
    p=Path(f"docs/data/ledger_shards/{y}.csv")
    return load(p.read_bytes()) if p.exists() else []
def season(s):
    s=str(s or "").lower()
    return {"spring":"spring","summer":"summer","autumn":"autumn","senbatsu":"senbatsu","koshien":"koshien","jingu":"jingu"}.get(s,s)
def level(r):
    note=str(r.get("note") or "")
    m=re.search(r"(?:^|;)level=([^;]+)",note)
    if m:return m.group(1).strip()
    region=str(r.get("region") or "").strip()
    if region=="national":return "national"
    if str(r.get("prefecture") or "").strip():return "prefecture"
    if region in REGIONS:return "regional"
    return "unknown"
def pref(r):
    p=str(r.get("prefecture") or "").strip()
    return {"北北海道":"北海道","南北海道":"北海道","東東京":"東京","西東京":"東京"}.get(p,p)
def k(r):
    y=str(r.get("year") or "");s=season(r.get("season"));lev=level(r)
    if lev=="prefecture":return (y,s,lev,pref(r))
    if lev in ("regional","district"):return(y,s,"regional",str(r.get("region") or ""))
    return (y,s,lev,"national" if lev=="national" else str(r.get("region") or ""))
def analyze(rows):
    units=Counter();tournaments=defaultdict(set)
    for r in rows:
        if not r.get("team1") or not r.get("team2"):continue
        key=k(r);units[key]+=1
        t=str(r.get("tournament") or "").strip()
        if t:tournaments[key].add(t)
    return units,tournaments
def main():
    a=[];b=[]
    for y in range(2008,2027):
        a.extend(past(y));b.extend(current(y))
    old,oldnames=analyze(a);new,newnames=analyze(b)
    expected=set(old)|set(new)
    # Expected seasonal prefecture competitions, including those absent on both days.
    for y in range(2021,2027):
        for s in ("spring","summer","autumn"):
            for p in PREFS:expected.add((str(y),s,"prefecture",p))
    for y in range(2018,2027):
        for s in ("spring","autumn"):
            for region in REGIONS:expected.add((str(y),s,"regional",region))
    for y in range(2008,2027):
        for s in ("senbatsu","koshien","jingu"):expected.add((str(y),s,"national","national"))
    out=[]
    for key in sorted(expected):
        x=old[key];z=new[key]
        if x and not z:status="VANISHED_SINCE_NOV02"
        elif not x and not z:status="MISSING_BOTH"
        elif x>z:status="FEWER_ROWS_NOW"
        elif not x and z:status="NEW_NOW"
        else:status="PRESENT"
        out.append(dict(zip(["year","season","level","area"],key),nov02_rows=x,current_rows=z,delta=z-x,status=status,nov02_tournaments=" | ".join(sorted(oldnames[key])),current_tournaments=" | ".join(sorted(newnames[key]))))
    p=Path("master/expected_tournament_inventory_2008_2026.csv")
    with p.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(out[0]));w.writeheader();w.writerows(out)
    report={"baseline":BASE,"generated_at":datetime.now(timezone.utc).isoformat(),"baseline_rows":len(a),"current_rows":len(b),"statuses":dict(Counter(x["status"] for x in out)),"vanished": [x for x in out if x["status"]=="VANISHED_SINCE_NOV02"],"missing_both_examples":[x for x in out if x["status"]=="MISSING_BOTH"][:60],"less_rows":[x for x in out if x["status"]=="FEWER_ROWS_NOW"],"specific_examples":[x for x in out if (x["year"],x["season"],x["area"]) in [("2026","autumn","宮城"),("2025","summer","石川"),("2026","spring","shikoku")]]}
    Path("master/expected_tournament_inventory_summary.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"statuses":report["statuses"],"specific_examples":report["specific_examples"],"vanished":len(report["vanished"]),"less_rows":len(report["less_rows"])},ensure_ascii=False))
if __name__=="__main__":main()
