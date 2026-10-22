#!/usr/bin/env python3
"""Backfill historical national game dates from publicly dated tournament result tables.
Cross-check exact year, season, both schools, and final score; reject ambiguous matches.
"""
import csv,json,re,time
from collections import defaultdict,Counter
from datetime import date
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin
from bs4 import BeautifulSoup

ROOT="https://koshien.otodo.net/"
TARGET=Path("docs/data/historical_ledger_2017_2024.csv")
AUDIT=Path("output/audit/otodo_national_dates.json")
def get(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; HS-BB-L research/1.0)"})
    with urlopen(req,timeout=25) as f:return BeautifulSoup(f.read(),"html.parser")
def normal(v):return re.sub(r"[\s　()（）・･]+","",str(v or "")).replace("智辯","智弁").replace("附属","付").replace("大學","大学")
def sig(y,season,a,x,b,z):
    try:return(str(y),season,tuple(sorted(((normal(a),int(x)),(normal(b),int(z))))))
    except(ValueError,TypeError):return None
def get_results(doc,year,season):
    found=[]
    current=""
    for el in doc.select("h2,h3,h4,tr"):
        if el.name in ("h2","h3","h4"):
            t=el.get_text(" ",strip=True)
            m=re.search(r"(\d{1,2})月\s*(\d{1,2})日",t)
            if m:
                try:current=date(year,int(m.group(1)),int(m.group(2))).isoformat()
                except ValueError:current=""
            continue
        if not current:continue
        cells=[c.get_text(" ",strip=True) for c in el.find_all(["th","td"],recursive=False)]
        if len(cells)<5:continue
        # Otodo rows: match index, time, round, school, score, school.
        for i in range(len(cells)-2):
            m=re.fullmatch(r"(\d{1,2})\s*[-－ー]\s*(\d{1,2})",cells[i+1])
            if not m:continue
            a,b=cells[i].strip(),cells[i+2].strip()
            if not a or not b:continue
            a=re.sub(r"\s*[（(](?:北海道|東北|関東|東京|北信越|東海|近畿|中国|四国|九州)[）)]","",a).strip()
            b=re.sub(r"\s*[（(](?:北海道|東北|関東|東京|北信越|東海|近畿|中国|四国|九州)[）)]","",b).strip()
            if len(a)>30 or len(b)>30:continue
            found.append((sig(year,season,a,m.group(1),b,m.group(2)),current))
            break
    return [(k,d) for k,d in found if k]
def main():
    index=get(ROOT)
    observed=defaultdict(lambda:defaultdict(set));pages=[];cnt=Counter()
    for link in index.find_all("a",href=True):
        title=link.get_text(" ",strip=True)
        m=re.search(r"第\d+回.*(?:明治神宮野球大会|選抜高等学校野球大会|全国高等学校野球選手権)",title)
        if not m:continue
        url=urljoin(ROOT,link["href"])
        yr=re.search(r"(?<!\d)(20(?:1[7-9]|2[0-4]))(?!\d)",url)
        # Calendar year from tournament schedule, not index fiscal year.
        if yr:year=int(yr.group(1))
        else:
            short=re.search(r"/(1[7-9]|2[0-4])(?:sum|spr|aut)(?:/|\\.)",url)
            if not short:continue
            year=2000+int(short.group(1))
        season="jingu" if "神宮" in title else "senbatsu" if "選抜" in title else "koshien"
        if season=="jingu":year-=1 # site fiscal-year grouping: preceding November
        if year<2017 or year>2024:continue
        try:
            main=get(url)
            paths=[url] if season=="jingu" else []
            if season!="jingu":
                for a in main.find_all("a",href=True):
                    label=a.get_text(" ",strip=True)
                    if "日程" in label and "結果" in label:paths.append(urljoin(url,a["href"]))
            for p in dict.fromkeys(paths):
                doc=main if p==url else get(p)
                items=get_results(doc,year,season)
                for key,day in items:observed[key][day].add(p)
                cnt["source_games"]+=len(items)
                pages.append({"year":year,"season":season,"url":p,"games":len(items)})
            cnt["pages_ok"]+=1
        except Exception as e:
            cnt["pages_failed"]+=1
            pages.append({"year":year,"season":season,"url":url,"error":str(e)[:180]})
        time.sleep(.2)
    with TARGET.open(encoding="utf-8-sig",newline="") as f:
        rd=csv.DictReader(f);fields=rd.fieldnames;rows=list(rd)
    for row in rows:
        if row["season"] not in ("senbatsu","koshien","jingu"):continue
        if row.get("date"):continue
        cnt["undated_checked"]+=1
        k=sig(row["year"],row["season"],row["team1"],row["score1"],row["team2"],row["score2"])
        dates=observed.get(k,{})
        if len(dates)==1:
            day=next(iter(dates))
            row["date"]=day
            row["source_url"]=sorted(dates[day])[0]
            row["source_status"]="試合日・対戦・スコア照合済み"
            cnt["recovered"]+=1
        elif len(dates)>1:cnt["ambiguous"]+=1
        else:cnt["unresolved"]+=1
    AUDIT.parent.mkdir(parents=True,exist_ok=True)
    AUDIT.write_text(json.dumps({"counts":dict(cnt),"pages":pages},ensure_ascii=False,indent=2)+"\n")
    if cnt["recovered"]:
        with TARGET.open("w",encoding="utf-8-sig",newline="") as f:
            wr=csv.DictWriter(f,fieldnames=fields);wr.writeheader();wr.writerows(rows)
    print("OTODO_NATIONAL_DATE_AUDIT",json.dumps(dict(cnt),ensure_ascii=False),flush=True)
if __name__=="__main__":main()
