#!/usr/bin/env python3
"""Fetch source-dated 2019 tournament games and conservatively fill undated rows."""
import csv,json,re,time,urllib.request,urllib.parse
from pathlib import Path
from collections import defaultdict
from bs4 import BeautifulSoup

MANIFEST=Path("data/date_sources/2019_tournament_source_manifest.csv")
TARGETS=[Path("output/all_matches.csv"),Path("docs/data/historical_ledger_2017_2024.csv")]
OUT=Path("output/audit/2019_omyutech_dates.json")
ALIASES={"市呉":"市立呉","駒大高":"駒大","東京成徳大高":"東京成徳大","東京都市大等々力":"都市大等々力"}
def norm(s):
 s=re.sub(r"[\s　・･（）()]+","",str(s or ""))
 return ALIASES.get(s,s)
def pair(r):return tuple(sorted((norm(r.get("team1")),norm(r.get("team2")))))
def get(url):
 request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; historical-sports-data-research/1.0)"})
 with urllib.request.urlopen(request,timeout=24) as resp:return resp.read().decode("utf-8","replace")
def rows(path):
 with path.open(encoding="utf-8-sig",newline="") as f:
  reader=csv.DictReader(f);return reader.fieldnames,list(reader)
def save(path,fields,items):
 with path.open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");writer.writeheader();writer.writerows(items)
def parse_day(html,day):
 soup=BeautifulSoup(html,"html.parser");out=[]
 # Each completed scoreboard table has two teamGames links, once per team.
 for table in soup.find_all("table"):
  trs=[]
  for tr in table.find_all("tr"):
   link=tr.find("a",href=re.compile(r"teamGames\.action"))
   if not link:continue
   cells=tr.find_all(["td","th"],recursive=False)
   nums=[c.get_text(" ",strip=True) for c in cells]
   score=nums[-1] if nums else ""
   if re.fullmatch(r"\d{1,3}",score):
    trs.append((link.get_text(" ",strip=True),score))
  if len(trs)!=2:continue
  a,b=trs
  if norm(a[0])==norm(b[0]):continue
  out.append({"date":f"{day[:4]}-{day[4:6]}-{day[6:]}","team1":a[0],"score1":a[1],"team2":b[0],"score2":b[1]})
 return out
def main():
 fields,manifest=rows(MANIFEST)
 sources=[];errors=[];dates_seen={}
 # Verified local fixtures remain usable when OmyuTech HTTP access fails.
 local=Path("data/date_sources/2019_spring_kanto_verified.csv")
 if local.exists():
  _,verified=rows(local)
  for v in verified:
   v.update({"season":"spring","region":"kanto_tokyo","cup_id":"spring_kanto_verified"})
   sources.append(v)
 local_extra=Path("data/date_sources/2019_spring_kinki_chugoku_verified.csv")
 if local_extra.exists():
  _,verified_extra=rows(local_extra)
  for v in verified_extra:
   v.update({"season":"spring","cup_id":"spring_verified_local"})
   sources.append(v)
 kyushu_local=Path("data/date_sources/2019_spring_kyushu_verified.csv")
 if kyushu_local.exists():
  _,kyushu_rows=rows(kyushu_local)
  for v in kyushu_rows:
   v.update({"season":"spring","region":"kyushu","cup_id":"spring_kyushu_verified","source_url":"https://www.baseball-station.com/memories/spring-2019-kyushu/"})
   sources.append(v)
 for entry in manifest:
  cid=entry["cup_id"]
  if not cid:continue
  base=f"https://baseball.omyutech.com/CupHomePageMain.action?cupId={cid}"
  try:
   html=get(base)
   dates=sorted(set(re.findall(r"(?:\?|&amp;|&)date=(2019\d{4})",html)))
   if not dates:errors.append({"cup_id":cid,"error":"no_dates"});continue
   dates_seen[cid]=dates
   for d in dates:
    try:
     page=parse_day(get(base+"&date="+d),d)
     for r in page:r.update({"season":entry["season"],"region":entry["region"],"cup_id":cid,"source_url":base+"&date="+d})
     sources.extend(page)
    except Exception as e:
     errors.append({"cup_id":cid,"date":d,"error":str(e)[:200]})
     print("2019_FETCH_ERROR",cid,d,repr(e),flush=True)
    time.sleep(.15)
  except Exception as e:
   errors.append({"cup_id":cid,"error":str(e)[:200]})
   print("2019_FETCH_ERROR",cid,repr(e),flush=True)
  print("2019 cup",cid,"games",sum(x["cup_id"]==cid for x in sources),flush=True)
 # Individual game unique pairing within season+region. Scored match resolves homonyms.
 idx=defaultdict(list)
 for r in sources:idx[(r["season"],r["region"],pair(r))].append(r)
 updated={}
 unresolved=[]
 for target in TARGETS:
  if not target.exists():continue
  fields,data=rows(target);n=0
  for row in data:
   if str(row.get("year"))!="2019" or row.get("season") not in ("spring","autumn") or row.get("date"):continue
   region=row.get("region","")
   # Tokyo is represented in kanto_tokyo region; use tournament to distinguish autumn Tokyo and Kanto.
   candidates=idx.get((row["season"],region,pair(row)),[])
   if region=="kanto_tokyo":
    label=str(row.get("tournament",""))
    cid=("spring_kanto_verified" if row["season"]=="spring" else ("20190018707" if "東京" in label else "20190018706"))
    candidates=[x for x in candidates if x["cup_id"]==cid]
   score=[]
   for x in candidates:
    same=norm(row.get("team1"))==norm(x["team1"])
    a,b=(x["score1"],x["score2"]) if same else (x["score2"],x["score1"])
    if a==str(row.get("score1")) and b==str(row.get("score2")):score.append(x)
   dates={x["date"] for x in score}
   if len(dates)==1:
    x=score[0]
    row["date"]=x["date"]
    if "source_url" in fields and not row.get("source_url"):row["source_url"]=x["source_url"]
    n+=1
   elif candidates:
    unresolved.append({"target":str(target),"tournament":row.get("tournament"),"teams":[row.get("team1"),row.get("team2")],"score":[row.get("score1"),row.get("score2")],"reason":"score_or_alias_mismatch"})
  if n:save(target,fields,data)
  updated[str(target)]=n
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps({"source_games":len(sources),"by_cup":{cid:sum(x["cup_id"]==cid for x in sources) for cid in dates_seen},"updated":updated,"errors":errors,"unresolved":unresolved[:200]},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("2019_SOURCED_DATE_SYNC",json.dumps({"source_games":len(sources),"updated":updated,"errors":len(errors),"unresolved":len(unresolved)},ensure_ascii=False),flush=True)
 if not sources:
  print("2019_SOURCE_FETCH_FAILED: no fixture was retrieved; cannot claim date completion.",flush=True)
if __name__=="__main__":main()
