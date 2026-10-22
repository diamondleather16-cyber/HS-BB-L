#!/usr/bin/env python3
"""Verify 2017-2024 Jingu dates against game-by-game dated archived results."""
import csv,re,json,time
from collections import Counter,defaultdict
from pathlib import Path
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup

path=Path("docs/data/historical_ledger_2017_2024.csv")
audit_path=Path("output/audit/jingu_date_backfill.json")
sources={}
def norm(s):
    s=re.sub(r"[\s　()（）・･]+","",str(s or ""))
    return s.removesuffix("高校").removesuffix("高").replace("商業","商").replace("工業","工").replace("附属","付").replace("國","国")
def key(a,x,b,y):
    return tuple(sorted(((norm(a),int(x)),(norm(b),int(y)))))
def candidate(text):
    # Full-match lists put a date line immediately above a school-score line.
    m=re.search(r"^(.+?)(\d{1,2})\s*[-－ー]\s*(\d{1,2})(.+?)$",text.strip())
    if not m:return None
    a,x,y,b=m.groups()
    if not (1<=len(a.strip())<=25 and 1<=len(b.strip())<=25):return None
    return key(a,x,b,y)
def read(year):
    url=f"https://kouritsu-ouendan.com/jingu/{year}"
    html=urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=25).read()
    soup=BeautifulSoup(html,"html.parser")
    # Result lists are grouped into <li> records containing both date and score.
    heading=next((tag for tag in soup.find_all(["h2","h3"]) if "全試合" in tag.get_text()),None)
    if heading is None:return url,{}
    ans=defaultdict(set)
    for li in heading.find_all_next("li"):
        previous=li.find_previous(["h2","h3"])
        if previous and "全試合" not in previous.get_text() and "回戦" not in previous.get_text():
            # Stops parsing when other sections start.
            if previous.name=="h2":break
        txt=li.get_text(" ",strip=True)
        m=re.search(r"(\\d{1,2})月\\s*(\\d{1,2})日",txt)
        if not m:continue
        day=f"{year:04d}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        scoretext=txt[m.end():].strip()
        k=candidate(scoretext)
        if k:ans[k].add(day)
    return url,ans
def main():
    with path.open(encoding="utf-8-sig",newline="") as f:
        rd=csv.DictReader(f);fields=rd.fieldnames;rows=list(rd)
    n=Counter();links={};data={}
    for yr in [2017,2018,2019,2021,2022,2023,2024]:
        try:
            url,items=read(yr)
            data[str(yr)]=items;links[str(yr)]=url
            n["pages_ok"]+=1;n["source_keys"]+=len(items)
        except Exception as err:
            n["pages_failed"]+=1;links[str(yr)]=str(err)
        time.sleep(.1)
    for row in rows:
        if row.get("season")!="jingu" or row.get("date"):continue
        n["undated_before"]+=1
        year=row["year"]
        try:k=key(row["team1"],row["score1"],row["team2"],row["score2"])
        except Exception:continue
        dates=data.get(year,{}).get(k,set())
        if len(dates)==1:
            d=next(iter(dates))
            row["date"]=d;row["source_url"]=links[year]
            row["source_status"]="実日程とスコア照合済"
            n["recovered"]+=1
        elif len(dates)>1:n["ambiguous"]+=1
        else:n["unresolved"]+=1
    audit_path.parent.mkdir(parents=True,exist_ok=True)
    audit_path.write_text(json.dumps({"counts":dict(n),"sources":links},ensure_ascii=False,indent=2)+"\n")
    if n["recovered"]:
        with path.open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.DictWriter(f,fields);w.writeheader();w.writerows(rows)
    print("JINGU_BACKFILL",dict(n),links,flush=True)
if __name__=="__main__":main()
