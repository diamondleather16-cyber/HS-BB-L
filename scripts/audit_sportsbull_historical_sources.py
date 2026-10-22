#!/usr/bin/env python3
"""Inspect submitted Sportsbull pages and compare dated result rows with existing ledger; audit only."""
import csv,json,re,urllib.request,urllib.error
from pathlib import Path
from bs4 import BeautifulSoup
SOURCES=Path("master/verified_regional_2017_2024_new_sources.json")
OUT=Path("output/audit/sportsbull_historical_sources.json")
def load():
    records=[]
    for path in [Path("docs/data/historical_ledger_2017_2024.csv"),Path("output/all_matches.csv")]:
        if path.exists():
            with path.open(encoding="utf-8-sig",newline="") as f:
                records.extend(csv.DictReader(f))
    return records
def fetch(url):
    urls=[url,url.replace("/sp/koshien/","/koshien/")]
    for candidate in urls:
        try:
            request=urllib.request.Request(candidate,headers={"User-Agent":"Mozilla/5.0 (compatible; HS-BB-L-audit/1.0)"})
            with urllib.request.urlopen(request,timeout=18) as response:
                html=response.read().decode("utf-8","replace")
                if len(html)>500:return candidate,html,"ok"
        except Exception as e:
            reason=str(e)[:160]
    return urls[-1],"",reason
def main():
    rows=load()
    reports=[]
    for item in json.loads(SOURCES.read_text())["sources"]:
        actual,html,status=fetch(item["url"])
        soup=BeautifulSoup(html,"html.parser") if html else None
        title=(soup.title.get_text(" ",strip=True) if soup and soup.title else "")
        blocks=soup.get_text("\n",strip=True) if soup else ""
        # Avoid guessing season/region from 3-digit Sportsbull event IDs.
        report={**item,"fetched_url":actual,"status":status,"title":title,
                "bytes":len(html),"content_sample":blocks[:400],
                "date_tokens":len(re.findall(r"(?<!\\d)(?:20\\d\\d[/-])?\\d{1,2}[/-]\\d{1,2}(?!\\d)",blocks)),
                "ledger_games_for_year":sum(1 for r in rows if str(r.get("year"))==str(item["year"])),
                "confirmed_matches":0,"applied_dates":0}
        reports.append(report)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"sources":len(reports),"retrieved":sum(x["status"]=="ok" for x in reports),
                              "applied_dates":0,"items":reports},ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"sources":len(reports),"retrieved":sum(x["status"]=="ok" for x in reports),"applied_dates":0},ensure_ascii=False))
if __name__=="__main__":main()
