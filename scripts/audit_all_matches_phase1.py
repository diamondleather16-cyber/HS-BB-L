#!/usr/bin/env python3
"""Non-destructive, repository-wide match ledger health check.

Reads the generated authoritative match CSV, never edits matches, master or
ratings. Flags likely errors for review, rather than deleting any games.
"""
from __future__ import annotations
import csv, hashlib, json, re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE=Path("output/all_matches.csv")
OUT=Path("output/audit/phase1_match_health.json")
ISSUES=Path("output/audit/phase1_match_issues.csv")
MAX_EXAMPLES=30

SEASONS={"spring","summer","autumn","senbatsu","koshien","jingu"}
AREAS={
 "北海道":"北海道","青森":"東北","岩手":"東北","秋田":"東北","宮城":"東北","山形":"東北","福島":"東北",
 "茨城":"関東・東京","栃木":"関東・東京","群馬":"関東・東京","埼玉":"関東・東京","千葉":"関東・東京",
 "東京":"関東・東京","東東京":"関東・東京","西東京":"関東・東京","神奈川":"関東・東京","山梨":"関東・東京",
 "新潟":"北信越","富山":"北信越","石川":"北信越","福井":"北信越","長野":"北信越",
 "静岡":"東海","愛知":"東海","岐阜":"東海","三重":"東海",
 "滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
 "鳥取":"中国","島根":"中国","岡山":"中国","広島":"中国","山口":"中国",
 "香川":"四国","徳島":"四国","愛媛":"四国","高知":"四国",
 "福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州",
 "宮崎":"九州","鹿児島":"九州","沖縄":"九州",
}
ALIASES={"hokkaido":"北海道","tohoku":"東北","kanto_tokyo":"関東・東京","kanto":"関東・東京",
 "tokyo":"関東・東京","hokushinetsu":"北信越","tokai":"東海","kinki":"近畿",
 "chugoku":"中国","shikoku":"四国","kyushu":"九州","national":"全国",
 "関東":"関東・東京"}
def clean(value):
 return re.sub(r"\s+","",str(value or "").replace("　","")).strip("■●○□")

def level(row):
 match=re.search(r"(?:^|;)level=([^;]+)",str(row.get("note") or ""))
 return match.group(1).strip() if match else str(row.get("level") or "").strip()

def main():
 if not SOURCE.exists():raise SystemExit(f"Missing {SOURCE}; do not audit stale source!")
 data=SOURCE.read_bytes()
 sha=hashlib.sha256(data).hexdigest()
 issues=[]
 counts=Counter()
 levels=Counter()
 year_season=Counter()
 sources=Counter()
 identity=defaultdict(list)
 exact=defaultdict(list)
 records=0
 with SOURCE.open(encoding="utf-8-sig",newline="") as f:
  for i,r in enumerate(csv.DictReader(f),start=2):
   records+=1
   year=str(r.get("year") or "").strip()
   season=str(r.get("season") or "").strip()
   pref=str(r.get("prefecture") or "").strip()
   region=ALIASES.get(str(r.get("region") or "").strip(),str(r.get("region") or "").strip())
   tag=level(r)
   counts["records"]+=1
   counts["with_source_url"]+=bool((r.get("source_url") or "").strip())
   counts["with_source_file"]+=bool((r.get("_source_file") or "").strip())
   levels[tag or "unknown"]+=1
   year_season[f"{year}/{season}"]+=1
   src=str(r.get("_source_file") or "")
   sources[src.split("/")[0] if src else "missing"]+=1
   ident=str(r.get("match_id") or f"row-{i}")
   def flag(code,details):
    counts["issue_"+code]+=1
    issues.append({"issue":code,"match_id":ident,"source_file":src,"source_row":r.get("_source_row") or "",
                   "year":year,"season":season,"prefecture":pref,"tournament":r.get("tournament") or "",
                   "date":r.get("date") or "","team1":r.get("team1") or "","score1":r.get("score1") or "",
                   "team2":r.get("team2") or "","score2":r.get("score2") or "","details":str(details)})
   if not re.fullmatch(r"(?:19|20)\d{2}",year):flag("bad_year",year)
   if season not in SEASONS:flag("bad_season",season)
   if not str(r.get("tournament") or "").strip():flag("missing_tournament","")
   if not (r.get("round") or "").strip():flag("missing_round","")
   if not (r.get("team1") or "").strip() or not (r.get("team2") or "").strip():flag("missing_team","")
   if clean(r.get("team1"))==clean(r.get("team2")):flag("self_match","")
   if not re.fullmatch(r"\d{1,3}",str(r.get("score1") or "")) or not re.fullmatch(r"\d{1,3}",str(r.get("score2") or "")):
    flag("invalid_score",f"{r.get('score1')}:{r.get('score2')}")
   d=str(r.get("date") or "").strip()
   if d:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",d):flag("invalid_date_format",d)
    elif year and not d.startswith(year+"-"):flag("date_year_mismatch",d)
   else:flag("missing_date","")
   if tag in {"prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"}:
    expected=AREAS.get(pref)
    if expected and region and region!=expected:
     flag("prefecture_region_mismatch",f"{pref}: {region} != {expected}")
    if not pref:flag("prefecture_missing","")
   teams=tuple(sorted((clean(r.get("team1")),clean(r.get("team2")))))
   if all(teams) and year and season and d:
    identity[(year,season,d,teams)].append((i,r))
    scores=tuple(sorted(((clean(r.get("team1")),str(r.get("score1") or "")),(clean(r.get("team2")),str(r.get("score2") or "")))))
    exact[(year,season,d,teams,scores)].append((i,r))
 for key,group in identity.items():
  if len(group)<2:continue
  # Matches in different competitions or same day can be distinct; flag only,
  # never delete. Distinct scores imply a particularly important conflict.
  variants={tuple(sorted(((clean(r.get("team1")),str(r.get("score1"))),(clean(r.get("team2")),str(r.get("score2")))))) for _,r in group}
  same_tournament={clean(r.get("tournament")) for _,r in group}
  code="same_day_score_conflict" if len(variants)>1 else "potential_duplicate"
  if len(same_tournament)>1:code="cross_tournament_"+code
  counts["groups_"+code]+=1
  for i,r in group:
   issues.append({"issue":code,"match_id":r.get("match_id") or f"row-{i}",
                  "source_file":r.get("_source_file") or "","source_row":r.get("_source_row") or "",
                  "year":r.get("year") or "","season":r.get("season") or "",
                  "prefecture":r.get("prefecture") or "","tournament":r.get("tournament") or "",
                  "date":r.get("date") or "","team1":r.get("team1") or "","score1":r.get("score1") or "",
                  "team2":r.get("team2") or "","score2":r.get("score2") or "",
                  "details":f"copies={len(group)}, score_versions={len(variants)}, tournaments={len(same_tournament)}"})
  counts["rows_"+code]+=len(group)
 OUT.parent.mkdir(parents=True,exist_ok=True)
 fields=["issue","match_id","source_file","source_row","year","season","prefecture","tournament","date","team1","score1","team2","score2","details"]
 with ISSUES.open("w",encoding="utf-8-sig",newline="") as f:
  wr=csv.DictWriter(f,fieldnames=fields);wr.writeheader();wr.writerows(issues)
 by_type=Counter(x["issue"] for x in issues)
 report={"generated_at":datetime.now(timezone.utc).isoformat(),
         "source":"output/all_matches.csv","source_sha256":sha,"source_size_bytes":len(data),
         "total_rows":records,"distinct_year_seasons":len(year_season),
         "year_season_counts":dict(sorted(year_season.items())),
         "levels":dict(levels),"source_roots":dict(sources),
         "counts":dict(counts),"issue_total":len(issues),
         "issue_types":dict(by_type),
         "issue_examples":{kind:[r for r in issues if r["issue"]==kind][:MAX_EXAMPLES] for kind in sorted(by_type)},
         "classification":"All input rows preserved; issues flagged for review only.",
         "source_article_validation":"NOT PERFORMED",
         "rating_event_match_validation":"NOT PERFORMED"}
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"total_rows":records,"issues":len(issues),"by_type":dict(by_type),"sha256":sha},ensure_ascii=False))
if __name__=="__main__":main()
