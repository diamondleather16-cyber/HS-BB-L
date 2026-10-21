#!/usr/bin/env python3
"""Lossless 2021-24 intake archive: preserve raw matches and URLs before normalization.

No canonical CSVs, ratings or deletions are modified. Stores gzip JSONL source rows
including row provenance and verbatim original columns, plus 2024 source candidates.
"""
import csv,gzip,json,hashlib,collections,datetime
from pathlib import Path
ROOT=Path("data");OUT=Path("output/intake_2021_2024")
YEARS={"2021","2022","2023","2024"}
def csvrows(p):
 with p.open(encoding="utf-8-sig",newline="") as f:
  yield from enumerate(csv.DictReader(f),start=2)
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 totals=collections.Counter();per=collections.Counter();provenance={}
 archive=OUT/"source_rows.jsonl.gz"
 with gzip.open(archive,"wt",encoding="utf-8",compresslevel=6) as w:
  for p in sorted(ROOT.rglob("*.csv")):
   if p.name=="template.csv":continue
   try:
    n=0
    for line,row in csvrows(p):
     if str(row.get("year") or "").strip() not in YEARS:continue
     season=str(row.get("season") or "").strip()
     if season not in ("spring","summer","autumn"):continue
     record={"file":str(p),"line":line,"raw":row}
     w.write(json.dumps(record,ensure_ascii=False,separators=(",",":"))+"\n")
     n+=1;totals["raw_match_rows"]+=1
     per[(str(row.get("year")),season,str(row.get("prefecture") or ""))]+=1
    if n:
     provenance[str(p)]=n;totals["source_csv_files"]+=1
   except (UnicodeError,csv.Error,OSError) as exc:
    totals["files_failed"]+=1
    print("READ ERROR",p,exc,flush=True)
 with (OUT/"all_source_links.csv").open("w",encoding="utf-8-sig",newline="") as out:
  fields=["year","season","prefecture","source_url","link_title","category","source_status"]
  writer=csv.DictWriter(out,fieldnames=fields);writer.writeheader()
  p=Path("master/priority_2024_article_links.csv")
  if p.exists():
   with p.open(encoding="utf-8-sig",newline="") as f:
    for r in csv.DictReader(f):
     writer.writerow({**r,"source_status":"article_url_only_unverified"})
     totals["unverified_2024_article_urls"]+=1
 manifest={"created_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "scope":"2021-2024 spring summer autumn","raw_archive":str(archive),
           "statistics":dict(totals),"source_files":provenance,
           "units_with_raw_rows":[{"year":y,"season":s,"prefecture":p,"raw_rows":n}
                for (y,s,p),n in sorted(per.items())],
           "policy":"Raw archive is a lossless snapshot. Duplicates, conflicts and unlabeled levels remain; do not use for direct rating input."}
 (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"statistics":dict(totals),"covered_year_season_prefecture_buckets":len(per)},ensure_ascii=False))
 if totals["raw_match_rows"]<10000:raise SystemExit("Unusually few historical rows: validate archive source tree")
if __name__=="__main__":main()
