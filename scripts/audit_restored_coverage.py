#!/usr/bin/env python3
"""Read-only post-build audit of the 2008-2026 published match ledger.

This audit does NOT turn a mere nonzero match count into an assertion of
completeness.  It checks expected tournament units, historical fixture
retention, obvious duplicate fixtures, and level tagging.
"""
import csv
import io
import json
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE = "6c8903f6aef69707fe52365d0df527d3dca70f60"
PREFS = "北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
REGIONS = "hokkaido tohoku kanto_tokyo hokushinetsu tokai kinki chugoku shikoku kyushu".split()
REGION_MAP = dict(zip("北海道 東北 関東 北信越 東海 近畿 中国 四国 九州".split(), REGIONS))
REGION_MAP.update({"東京":"kanto_tokyo","関東東京":"kanto_tokyo","関東・東京":"kanto_tokyo"})
PREF_MAP = {"北北海道":"北海道","南北海道":"北海道","東東京":"東京","西東京":"東京"}
FIELDS = ["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
OUT = Path("docs/data")
AUDIT = OUT / "audit"
AUDIT.mkdir(parents=True,exist_ok=True)

def load(path):
    with Path(path).open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))
def history(path):
    p=subprocess.run(["git","show",f"{BASE}:{path}"],capture_output=True)
    if p.returncode:return []
    return list(csv.DictReader(io.StringIO(p.stdout.decode("utf-8-sig"))))
def norm(s):
    return re.sub(r"[\s　■●○]+","",unicodedata.normalize("NFKC",str(s or "")))
def lvl(row):
    x=str(row.get("note") or "")
    m=re.search(r"(?:^|;)level=([^;]+)",x)
    t=(row.get("level") or (m.group(1) if m else "")).strip().lower()
    if t in ("national","regional","prefecture","district_qualifier"):return t
    if t=="district":return "regional"
    reg=row.get("region") or ""
    if reg in ("全国","national"):return "national"
    if row.get("prefecture"):return "prefecture"
    if REGIONS and (reg in REGION_MAP or reg in REGIONS):return "regional"
    return "unknown"
def unit(row):
    season=str(row.get("season") or "")
    level=lvl(row)
    p=PREF_MAP.get(str(row.get("prefecture") or ""),str(row.get("prefecture") or ""))
    r=REGION_MAP.get(str(row.get("region") or ""),str(row.get("region") or ""))
    return (str(row.get("year") or ""),season,level,p if level=="prefecture" else (r if level=="regional" else "national"))
def fixture(row):
    teams=tuple(sorted(((norm(row.get("team1")),norm(row.get("score1"))),(norm(row.get("team2")),norm(row.get("score2"))))))
    return (str(row.get("year") or ""),str(row.get("season") or ""),PREF_MAP.get(str(row.get("prefecture") or ""),str(row.get("prefecture") or "")),teams)
def expected():
    s=set()
    for y in range(2008,2027):
        for seas in ("senbatsu","koshien","jingu"):
            if y==2020 or (y==2026 and seas=="jingu"):continue
            s.add((str(y),seas,"national","national"))
    for y in range(2017,2027):
        for seas in ("spring","autumn"):
            if y==2020 and seas=="spring":continue
            for region in REGIONS:s.add((str(y),seas,"regional",region))
    for y in range(2021,2027):
        for seas in ("spring","summer","autumn"):
            for pref in PREFS:s.add((str(y),seas,"prefecture",pref))
    return s

def main():
    shardpaths=sorted((OUT/"ledger_shards").glob("[12][0-9][0-9][0-9].csv"))
    if len(shardpaths)!=19:raise SystemExit(f"Expected 19 annual shards, found {len(shardpaths)}")
    records=[row for p in shardpaths for row in load(p) if row.get("team1") and row.get("team2")]
    groups=Counter(unit(r) for r in records)
    rows=[]
    for u in sorted(expected()):
        cnt=groups[u]
        rows.append(dict(year=u[0],season=u[1],level=u[2],area=u[3],match_rows=cnt,status="PRESENT_UNVERIFIED" if cnt else "MISSING_CANDIDATE"))
    with (AUDIT/"expected_tournaments.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    # One fixture with the same date and scores in the same level/area is a
    # potential repeat; draw list for manual review, never delete automatically.
    duplicates=[]
    same=defaultdict(list)
    for r in records:
        k=unit(r)+(str(r.get("date") or ""),fixture(r)[-1])
        same[k].append(r)
    for k,arr in same.items():
        if len(arr)<2:continue
        a=arr[0]
        duplicates.append(dict(year=a.get("year"),season=a.get("season"),level=lvl(a),area=unit(a)[-1],date=a.get("date"),team1=a.get("team1"),score1=a.get("score1"),team2=a.get("team2"),score2=a.get("score2"),copies=len(arr),tournament=a.get("tournament")))
    with (AUDIT/"suspected_duplicates.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["year","season","level","area","date","team1","score1","team2","score2","copies","tournament"]);w.writeheader();w.writerows(duplicates)
    # Retention check across the source imported CSVs in the historical Git
    # snapshot and the current sources; this is independent of shard count.
    # The pre-dedupe commit may not be an ancestor of current main after prior rewrites.
    # Explicitly retrieve the historical object before invoking git ls-tree.
    if subprocess.run(["git","cat-file","-e",BASE+"^{commit}"],capture_output=True).returncode:
        fetch=subprocess.run(["git","fetch","--no-tags","origin",BASE],capture_output=True,text=True)
        if fetch.returncode:raise SystemExit(f"Cannot retrieve historical commit {BASE}: {fetch.stderr[-600:]}")
    # git ls-tree quotes paths containing Japanese characters by default.
    # NUL-delimited output prevents those quotes from hiding all source files.
    paths=[p.decode("utf-8") for p in subprocess.check_output(["git","ls-tree","-r","-z","--name-only",BASE]).split(b"\0") if p.startswith(b"data/imported/") and p.endswith(b".csv")]
    if not paths:raise SystemExit(f"Historical source inventory is empty at {BASE}; retention cannot be certified")
    missing=[]
    source_issues=[]
    checked=0
    for path in paths:
        if not path.endswith(".csv"):continue
        before=history(path)
        now=load(path) if Path(path).exists() else []
        keys={fixture(r) for r in now if r.get("team1") and r.get("team2")}
        checked+=1
        lost=[]
        for r in before:
            if not r.get("team1") or not r.get("team2") or not r.get("tournament"):continue
            k=fixture(r)
            if k not in keys:
                lost.append(r)
                keys.add(k) # one row per unique fixture, not historical duplicates
        for r in lost:
            missing.append(dict(source_path=path,**{k:r.get(k,"") for k in FIELDS}))
        if lost:source_issues.append(dict(path=path,previous_rows=len(before),current_rows=len(now),missing_distinct_fixtures=len(lost)))
    with (AUDIT/"missing_historical_source_fixtures.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["source_path"]+FIELDS);w.writeheader();w.writerows(missing)
    with (AUDIT/"source_file_regressions.csv").open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["path","previous_rows","current_rows","missing_distinct_fixtures"]);w.writeheader();w.writerows(source_issues)
    badlevels=Counter((str(r.get("year") or ""),lvl(r)) for r in records if lvl(r)=="unknown")
    summary={
        "generated_utc":datetime.now(timezone.utc).isoformat(),
        "source_revision":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),
        "criteria":"2008-2026 nationals; 2017-2026 9-region spring/autumn; 2021-2026 prefectures spring/summer/autumn with regional special handling",
        "expected_units":len(rows),
        "units_present_not_yet_fixture_verified":sum(x["match_rows"]>0 for x in rows),
        "units_missing_candidates":sum(x["match_rows"]==0 for x in rows),
        "missing_units":[x for x in rows if x["match_rows"]==0],
        "published_rows":len(records),
        "possible_duplicate_fixture_groups":len(duplicates),
        "historical_source_files_checked":checked,
        "historical_source_missing_distinct_fixtures":len(missing),
        "historical_source_files_with_missing_fixtures":len(source_issues),
        "unknown_level_by_year":dict((y,n) for (y,_),n in badlevels.items()),
        "notes":[
            "Nonzero tournament count does not prove all rounds were imported.",
            "Missing-unit candidates can include a level classification error.",
            "Historical source fixture matches intentionally ignore date changes and compare schools and scores.",
            "Potential duplicates need adjudication and are not removed by this audit."
        ]
    }
    (AUDIT/"coverage_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in summary.items() if k!="notes"},ensure_ascii=False))
if __name__=="__main__":main()
