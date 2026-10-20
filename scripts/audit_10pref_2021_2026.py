#!/usr/bin/env python3
"""Deterministic audit of 10-prefecture historical source rows and published ratings.

Never label a tournament complete merely because a page was fetched. This
audit checks expected units, source provenance, duplicate/conflicting games,
display shards and rating calculation. Report outstanding issues explicitly.
"""
from __future__ import annotations
import csv, json, re
from collections import defaultdict, Counter
from pathlib import Path
from datetime import datetime, timezone

CATS={"石川":24,"富山":23,"福井":25,"長野":22,"新潟":21,
      "北海道":6,"東京":20,"岐阜":28,"三重":29,"大阪":32}
YEARS=range(2021,2027)
SEASONS=("spring","summer","autumn")
REPORT=Path("master/backfill_10pref_2021_2026_audit.json")
SOURCE=Path("master/backfill_10pref_2021_2026_status.json")
DATA=Path("data/imported")
SHARDS=Path("docs/data/ledger_shards")
RATINGS=Path("docs/data/rating_events.csv")

def load_rows(p):
    if not p.exists(): return []
    with p.open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def clean(s):
    return str(s or "").strip()

def game_key(r):
    teams=tuple(sorted((clean(r.get("team1")),clean(r.get("team2")))))
    return (clean(r.get("year")),clean(r.get("season")),clean(r.get("date")),teams)

def canonical_key(r):
    a=(clean(r.get("team1")),clean(r.get("score1")))
    b=(clean(r.get("team2")),clean(r.get("score2")))
    return (clean(r.get("year")),clean(r.get("season")),clean(r.get("date")),tuple(sorted((a,b))))

def unit_list(pref,season):
    if season=="summer" and pref=="北海道": return ("北北海道","南北海道")
    if season=="summer" and pref=="東京": return ("東東京","西東京")
    return (pref,)

def detect_unit(r,pref,season):
    if season!="summer" or pref not in ("北海道","東京"): return pref
    t=clean(r.get("tournament"))+" "+clean(r.get("note"))
    for name in unit_list(pref,season):
        if name in t:return name
    return "未分類"

def main():
    status=json.loads(SOURCE.read_text(encoding="utf-8")) if SOURCE.exists() else {}
    known={}
    for pref,info in (status.get("prefectures") or {}).items():
        for url,rec in (info.get("articles") or {}).items():
            if rec.get("status")=="registered":
                known.setdefault((pref,url),rec)
    units=[]
    issues=[]
    csv_total=0
    all_rows=[]
    shard_cache={}
    for pref in CATS:
        for year in YEARS:
            for season in SEASONS:
                path=DATA/str(year)/season/f"{pref}.csv"
                rows=load_rows(path)
                if rows:
                    all_rows.extend((pref,r) for r in rows)
                    csv_total+=len(rows)
                if year not in shard_cache:
                    # Do not assume a single shard: match CSVs can be published
                    # under the fallback 'other' key after a bad import.
                    shard_cache[year]=[
                      r for p in (SHARDS/str(year)).glob("*.csv")
                      for r in load_rows(p)
                    ]
                for unit in unit_list(pref,season):
                    subset=[r for r in rows if detect_unit(r,pref,season)==unit]
                    published=[r for r in shard_cache[year]
                               if clean(r.get("prefecture"))==pref
                               and clean(r.get("season"))==season
                               and detect_unit(r,pref,season)==unit
                               and clean(r.get("note")).find("level=prefecture")>=0]
                    unique={canonical_key(r) for r in subset}
                    missing_sources=sum(not clean(r.get("source_url")) for r in subset)
                    bad_dates=sum(not re.fullmatch(rf"{year}-\\d{{2}}-\\d{{2}}",clean(r.get("date"))) for r in subset)
                    missing_round=sum(not clean(r.get("round")) for r in subset)
                    published_keys={canonical_key(r) for r in published}
                    unpublished=len(unique-published_keys)
                    entry={"prefecture":pref,"unit":unit,"year":year,"season":season,
                           "csv_rows":len(subset),"unique_games":len(unique),
                           "published_rows":len(published),"unpublished_unique":unpublished,
                           "missing_source":missing_sources,"missing_round":missing_round,
                           "invalid_date":bad_dates,
                           "status":"verified_in_pipeline" if subset and not unpublished and not missing_sources and not missing_round and not bad_dates else "needs_attention"}
                    if not subset: issues.append({"type":"missing_tournament_unit","unit":unit,"year":year,"season":season})
                    if unpublished:issues.append({"type":"unpublished_matches","unit":unit,"year":year,"season":season,"count":unpublished})
                    if bad_dates or missing_round:issues.append({"type":"incomplete_metadata","unit":unit,"year":year,"season":season,"bad_dates":bad_dates,"missing_round":missing_round})
                    units.append(entry)

    # A game recorded twice across source CSV files or with conflicting scores
    # must be reviewed before its rating effects can be trusted.
    by_game=defaultdict(list)
    for pref,r in all_rows:
        by_game[(pref,game_key(r))].append(r)
    duplicates=[]
    for (pref,k),rows in by_game.items():
        if len(rows)<2:continue
        score_versions={canonical_key(r) for r in rows}
        if len(duplicates)<250:
            duplicates.append({"prefecture":pref,"year":k[0][0],"season":k[0][1],
                               "date":k[0][2],"teams":list(k[0][3]),
                               "copies":len(rows),"conflicting_scores":len(score_versions)>1,
                               "source_urls":list(set(clean(r.get("source_url")) for r in rows))[:8]})
    # Fix serialization in duplicate record using source key tuple.
    for item in duplicates:
        if isinstance(item["year"],str) and len(item["year"])==1:
            item["year"]=""
    rated_count=0
    rating_available=RATINGS.exists()
    if rating_available:
        # Stream for low memory use.
        with RATINGS.open(encoding="utf-8-sig",newline="") as f:
            for row in csv.DictReader(f):
                if clean(row.get("year")) in {str(y) for y in YEARS}:rated_count+=1
    missing_units=sum(u["csv_rows"]==0 for u in units)
    unpublished_units=sum(u["unpublished_unique"]>0 for u in units)
    result={"version":1,"updated_at":datetime.now(timezone.utc).isoformat(),
            "expected_units":len(units),"present_units":len(units)-missing_units,
            "missing_units":missing_units,"unpublished_units":unpublished_units,
            "total_csv_rows_scanned":csv_total,
            "source_articles_registered":len(known),
            "rating_events_file_exists":rating_available,
            "rating_events_2021_2026":rated_count,
            "duplicate_groups_preview":duplicates,
            "units":units,"issues":issues,
            "complete":False,
            "coverage_verified":False,
            "note":"Pipeline checks cannot prove source tournament completeness; verify each article's every result and category inventory independently."}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:result[k] for k in ("expected_units","present_units","missing_units","unpublished_units","total_csv_rows_scanned","rating_events_file_exists","rating_events_2021_2026")},ensure_ascii=False))
    for issue in issues[:25]:print("AUDIT",issue)

if __name__=="__main__":main()
