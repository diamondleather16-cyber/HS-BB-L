#!/usr/bin/env python3
"""Conservative bulk date recovery from independently published inning scoreboards.
Accept only exact year/season/region, both team names, and both final scores.
Never derive dates from round schedules, article timestamps, or guesses.
"""
import csv,re,json,time,unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path
import requests
from bs4 import BeautifulSoup,Tag

P=Path("docs/data/historical_ledger_2017_2024.csv")
AUDIT=Path("output/audit/bulk_verified_dates.csv")
SUMMARY=Path("output/audit/bulk_verified_dates.json")
REGIONS={"hokkaido":("hokkaido","北海道"),"tohoku":("tohoku","東北"),"kanto_tokyo":("kanto","関東"),"hokushinetsu":("hokushinetsu","北信越"),"tokai":("tokai","東海"),"kinki":("kinki","近畿"),"chugoku":("chugoku","中国"),"shikoku":("shikoku","四国"),"kyushu":("kyushu","九州")}
def name(v):
 s=unicodedata.normalize("NFKC",str(v or ""))
 s=re.sub(r"[\s　・･（）()\[\]【】「」—－―-]","",s)
 return s.replace("ヶ","ケ").replace("ヵ","カ")
def score(v):
 try:return int(str(v).strip())
 except (ValueError,TypeError):return None
def day(s,year):
 s=unicodedata.normalize("NFKC",s)
 m=re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})(?!\d)",s)
 if not m:return None
 try:return date(year,int(m[1]),int(m[2])).isoformat()
 except ValueError:return None
def parse(html,year,region):
 soup=BeautifulSoup(html,"html.parser")
 if str(year) not in (soup.title.get_text(" ",strip=True) if soup.title else ""):return []
 records=[];entered=False
 for h in soup.find_all(re.compile("^h[2-6]$")):
  label=h.get_text(" ",strip=True)
  if h.name=="h3":
   if REGIONS[region][1] in label and ("地区大会" in label or region=="hokkaido" and "北海道" in label):entered=True
   elif entered:break
   continue
  if not entered or not re.search("決勝|準決勝|準々決勝|回戦|代表決定|3位|３位",label):continue
  d=day(label,year)
  if not d:continue
  for el in h.next_siblings:
   if isinstance(el,Tag) and el.name in ("h2","h3","h4","h5","h6"):break
   if not isinstance(el,Tag):continue
   tables=([el] if el.name=="table" else [])+el.find_all("table")
   for table in tables:
    pair=[]
    for tr in table.find_all("tr"):
     cells=tr.find_all(["th","td"],recursive=False)
     v=[c.get_text(" ",strip=True) for c in cells]
     if len(v)<3:continue
     n=name(re.sub(r"\s*(?:北海道|宮城|東京|栃木|山梨|群馬|埼玉|神奈川|茨城|千葉|福島|青森|岩手|秋田|山形|新潟|石川|富山|福井|長野)\d*$","",v[0]))
     sc=score(v[-1])
     if n and sc is not None:pair.append((n,sc))
    if len(pair)==2:records.append((d,tuple(sorted(pair))))
 return records
def main():
 with P.open(encoding="utf-8-sig",newline="") as f:
  rd=csv.DictReader(f);fields=rd.fieldnames;rows=list(rd)
 groups=defaultdict(list)
 for i,r in enumerate(rows):
  if r.get("date") or r.get("region") not in REGIONS or "地区大会" not in r.get("tournament","") or r.get("season") not in ("spring","autumn"):continue
  try:y=int(r["year"])
  except (ValueError,TypeError):continue
  if 2018<=y<=2024:groups[(y,r["season"],r["region"])].append(i)
 session=requests.Session();session.headers["User-Agent"]="Mozilla/5.0 (compatible; HSB-BB historical verification)"
 audit=[];summary=[]
 for (y,season,region),indices in sorted(groups.items()):
  slug=REGIONS[region][0];prefix="aki" if season=="autumn" else "haru"
  urls=[f"https://zutto-sports.com/{prefix}-{slug}-baseball{y}",f"https://zutto-sports.com/{prefix}-{slug}-high-school-baseball{y}"]
  games=[];url=""
  for candidate in urls:
   try:
    resp=session.get(candidate,timeout=12)
    if resp.status_code!=200:continue
    parsed=parse(resp.text,y,region)
    if parsed:games=parsed;url=candidate;break
   except (requests.RequestException,ValueError) as ex:print("READ_ERROR",candidate,str(ex)[:80],flush=True)
  index=defaultdict(set)
  for d,key in games:index[key].add(d)
  applied=0
  for i in indices:
   r=rows[i]
   key=tuple(sorted([(name(r["team1"]),score(r["score1"])),(name(r["team2"]),score(r["score2"]))]))
   dates=index.get(key,set())
   if len(dates)!=1:continue
   d=next(iter(dates))
   # No single score pair can be matched twice on differing dates.
   r["date"]=d;r["source_url"]=url;r["source_status"]="試合日・対戦校・最終得点を外部記録と照合済み"
   audit.append({k:r.get(k,"") for k in ("year","season","region","tournament","round","team1","score1","team2","score2","date","source_url")})
   applied+=1
  summary.append({"year":y,"season":season,"region":region,"source":url,"scoreboards":len(games),"eligible":len(indices),"applied":applied})
  print("BATCH",y,season,region,"source",len(games),"applied",applied,flush=True)
  time.sleep(.1)
 AUDIT.parent.mkdir(parents=True,exist_ok=True)
 cols=["year","season","region","tournament","round","team1","score1","team2","score2","date","source_url"]
 with AUDIT.open("w",encoding="utf-8-sig",newline="") as f:
  wr=csv.DictWriter(f,fieldnames=cols);wr.writeheader();wr.writerows(audit)
 with P.open("w",encoding="utf-8-sig",newline="") as f:
  wr=csv.DictWriter(f,fieldnames=fields);wr.writeheader();wr.writerows(rows)
 remaining=sum(not r.get("date") for r in rows)
 SUMMARY.write_text(json.dumps({"applied":len(audit),"remaining_undated":remaining,"by_batch":summary},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("TOTAL",len(audit),"REMAINING",remaining,flush=True)
if __name__=="__main__":main()
