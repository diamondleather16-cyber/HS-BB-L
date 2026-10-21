#!/usr/bin/env python3
"""Conservative Wikipedia bracket date backfill for 2017–2024 nationals.

Only save dates when a Wikipedia bracket yields BOTH teams, BOTH exact scores,
and one unique calendar date. Ambiguities remain blank. Audit all candidates.
"""
import csv, json, re, sys, time
from collections import defaultdict,Counter
from datetime import date,datetime,timezone
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup

SRC=Path("docs/data/historical_ledger_2017_2024.csv")
AUDIT=Path("output/audit/wikipedia_national_date_audit.json")
DETAIL=Path("output/audit/wikipedia_national_date_matches.csv")
UA="HS-BB-L public historical game date verifier (wikimedia attributed)"
DAY=re.compile(r"(\d{1,2})月\s*(\d{1,2})日\s*[（(]\s*\d+\s*[)）]")
SCORE=re.compile(r"^(.{1,40}?)\s+(\d{1,2})(?:x|X)?$")
ALIASES={"市呉":"呉","帝京五":"帝京第五","早稲田実":"早実",
         "大坂桐蔭":"大阪桐蔭"}

def normalized(s):
    s=re.sub(r"[\s　・･（）()]+","",str(s or ""))
    return ALIASES.get(s,s)

def scored(s):
    s=str(s).strip().replace("\u00a0"," ")
    m=SCORE.match(s)
    if not m:return None
    return normalized(m.group(1)),int(m.group(2))

def key(year,season,t1,s1,t2,s2):
    return str(year),season,tuple(sorted(((normalized(t1),int(s1)),(normalized(t2),int(s2)))))

def make_grid(table):
    grid=[]; spans={}
    for tr in table.select("tr"):
        cells={}
        col=0
        for el in tr.find_all(["th","td"],recursive=False):
            while col in spans:col+=1
            try:span=int(el.get("colspan",1))
            except ValueError:span=1
            try:height=int(el.get("rowspan",1))
            except ValueError:height=1
            txt=el.get_text(" ",strip=True)
            for n in range(col,col+span):
                cells[n]=txt
                if height>1:spans[n]=(height-1,txt)
            col+=span
        for n,(left,txt) in list(spans.items()):
            if n not in cells: cells[n]=txt
            if left<=1:del spans[n]
            else:spans[n]=(left-1,txt)
        grid.append(cells)
    return grid

def date_and_scores(table,year):
    grid=make_grid(table);out=[]
    for i,row in enumerate(grid):
        for col,txt in row.items():
            if not DAY.search(txt) or len(txt)>100:continue
            m=DAY.search(txt)
            try:d=date(year,int(m.group(1)),int(m.group(2))).isoformat()
            except ValueError:continue
            found=[]
            for nextrow in grid[i+1:i+11]:
                dt=nextrow.get(col,"")
                if DAY.search(dt):break
                # Dates label the team's column; score is typically next column.
                for offset in [0,1,-1,2]:
                    label=nextrow.get(col+offset,"")
                    p=scored(label)
                    if not p and label and len(label)<35:
                        n=normalized(label)
                        v=nextrow.get(col+offset+1,"").strip()
                        if re.fullmatch(r"\d{1,2}[xX]?",v):
                            p=(n,int(re.match(r"\d+",v).group()))
                    if p and p[0] and p not in found:
                        found.append(p)
                        break
                if len(found)>=2:break
            if len(found)==2 and found[0][0]!=found[1][0]:
                out.append((d,found[0],found[1]))
    return out

def pages():
    for year in range(2017,2025):
        # Senbatsu #92 (2020) was cancelled.
        if year!=2020:
            yield year,"senbatsu",f"第{year-1928}回選抜高等学校野球大会"
        # Koshien #102 (2020) was cancelled.
        if year!=2020:
            yield year,"koshien",f"第{year-1918}回全国高等学校野球選手権大会"

def main():
    with SRC.open(encoding="utf-8-sig",newline="") as f:
        reader=csv.DictReader(f); fields=reader.fieldnames;rows=list(reader)
    candidates=defaultdict(lambda:defaultdict(set))
    meta=[];stat=Counter()
    for year,season,title in pages():
        url="https://ja.wikipedia.org/wiki/"+quote(title)
        try:
            req=Request(url,headers={"User-Agent":UA})
            with urlopen(req,timeout=25) as response:html=response.read()
            soup=BeautifulSoup(html,"html.parser")
            matches=[]
            for table in soup.find_all("table"):
                # Source tables include team lists; accept only those with dated bracket entries.
                if len(DAY.findall(table.get_text(" ",strip=True)))<2:continue
                matches.extend(date_and_scores(table,year))
            for d,a,b in matches:
                candidates[key(year,season,a[0],a[1],b[0],b[1])][d].add(url)
            stat["pages_ok"]+=1
            meta.append({"page":url,"status":"ok","candidate_match_count":len(matches)})
        except Exception as e:
            stat["pages_failed"]+=1
            meta.append({"page":url,"status":"error","reason":str(e)[:250]})
        time.sleep(.25)
    audit=[]
    for row in rows:
        if row.get("season") not in ("senbatsu","koshien","jingu"):continue
        if row.get("date","").strip():continue
        stat["national_missing_before"]+=1
        try:k=key(row["year"],row["season"],row["team1"],row["score1"],row["team2"],row["score2"])
        except (KeyError,ValueError):continue
        dates=candidates.get(k,{})
        status="unresolved"
        if len(dates)==1:
            d=next(iter(dates))
            row["date"]=d
            row["source_url"]=next(iter(dates[d]))
            status="verified"
        elif len(dates)>1:
            status="ambiguous"
        stat[status]+=1
        audit.append({"year":row["year"],"season":row["season"],"tournament":row["tournament"],
                      "team1":row["team1"],"score1":row["score1"],"team2":row["team2"],"score2":row["score2"],
                      "status":status,"date":row["date"],"candidate_dates":";".join(sorted(dates))})
    AUDIT.parent.mkdir(parents=True,exist_ok=True)
    AUDIT.write_text(json.dumps({"counts":dict(stat),"pages":meta,"method":"same-year, same-season, two exact teams and scores in same dated Wikipedia bracket"},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
        fieldnames=["year","season","tournament","team1","score1","team2","score2","status","date","candidate_dates"]
        writer=csv.DictWriter(f,fieldnames=fieldnames);writer.writeheader();writer.writerows(audit)
    if stat["verified"]:
        with SRC.open("w",encoding="utf-8-sig",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
            writer.writeheader();writer.writerows(rows)
    print("WIKIPEDIA_NATIONAL_DATE_BACKFILL",dict(stat),flush=True)
    print("WIKIPEDIA_NATIONAL_PAGES",json.dumps(meta,ensure_ascii=False),flush=True)
    if not stat["pages_ok"]:sys.exit("No Wikipedia source pages loaded, no dates changed")

if __name__=="__main__":main()
