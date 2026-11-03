#!/usr/bin/env python3
"""Audit the user-defined 2008-2026 national, regional and prefecture hierarchy.

Phase 1: tournament slots that have published fixtures
Phase 2: published counts vs source fixtures (source completeness is NOT official completeness)
Phase 3: pre-restoration published fixtures absent from current publication
Phase 4: Hokkaido/Tokyo stage hierarchy violations
Phase 5: exact-date-score fixture duplicates in published yearly shards
"""
import csv, io, json, re, subprocess, unicodedata
from collections import Counter, defaultdict
from datetime import datetime,timezone
from pathlib import Path

BASE = "9d1c1338292346f41cdeda5be4555121a83d0be4"
PREFS = "北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 山梨 新潟 富山 石川 福井 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split()
REGIONS = "hokkaido tohoku kanto hokushinetsu tokai kinki chugoku shikoku kyushu".split()
REG_MAP = {"北海道":"hokkaido","東北":"tohoku","関東":"kanto",
           "北信越":"hokushinetsu","東海":"tokai","近畿":"kinki",
           "中国":"chugoku","四国":"shikoku","九州":"kyushu",
           "東京":"tokyo","関東・東京":"kanto","kanto_tokyo":"kanto"}
FCSV=Path("master/ledger_completion_audit_2008_2026.csv")
FJSON=Path("master/ledger_completion_audit_2008_2026.json")
FISSUE=Path("master/ledger_quality_issues_2008_2026.csv")

def norm(x):
    return re.sub(r"[\s\u3000・･]+","",unicodedata.normalize("NFKC",str(x or ""))).strip()
def score(x):
    v=norm(x)
    try:return str(int(float(v)))
    except ValueError:return v
def read(path):
    try:
        with Path(path).open("r", encoding="utf-8-sig",newline="") as f:
            return list(csv.DictReader(f))
    except OSError:
        return []
def old_year(y):
    p=f"docs/data/ledger_shards/{y}.csv"
    res=subprocess.run(["git","show",f"{BASE}:{p}"],capture_output=True)
    return list(csv.DictReader(io.StringIO(res.stdout.decode("utf-8-sig")))) if res.returncode==0 else []
def layer(r):
    m=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
    lev=(m.group(1) if m else str(r.get("level") or "")).strip().lower()
    if lev in ("regional","district"):return "regional"
    if lev in ("prefecture","district_qualifier","national"):return lev
    if str(r.get("region") or "") in ("national","全国") or str(r.get("season") or "") in ("senbatsu","koshien","jingu"):return "national"
    t=str(r.get("tournament") or "")
    if "地区大会" in t and (not r.get("prefecture")):return "regional"
    if r.get("prefecture"):return "prefecture"
    if r.get("region"):return "regional"
    return "unknown"
def area(r,lev):
    t=str(r.get("tournament") or "")
    if lev=="national":return "national"
    if lev=="regional":
        if "東京" in t and ("秋季東京" in t or "春季東京" in t or "東京地区大会" in t):
            return "tokyo"
        rv=str(r.get("region") or "").strip()
        return REG_MAP.get(rv,rv)
    if lev=="district_qualifier":return "tokyo" if "東京" in t or "東京" in str(r.get("prefecture") or "") else str(r.get("prefecture") or "")
    p=str(r.get("prefecture") or "").strip()
    if r.get("season")=="summer" and p in ("北海道","東京"):
        if "北北海道" in t:return "北北海道"
        if "南北海道" in t:return "南北海道"
        if "東東京" in t:return "東東京"
        if "西東京" in t:return "西東京"
    if p in ("北北海道","南北海道","東東京","西東京") and str(r.get("season") or "")!="summer":
        return "北海道" if "北海道" in p else "東京"
    return p
def slot(r):
    try:y=int(r.get("year") or 0)
    except (TypeError,ValueError):return None
    s=str(r.get("season") or "").lower()
    l=layer(r)
    return (y,s,l,area(r,l))
def identity(r):
    sides=tuple(sorted(((norm(r.get("team1")),score(r.get("score1"))),
                        (norm(r.get("team2")),score(r.get("score2"))))))
    if not sides[0][0] or not sides[1][0]:return None
    return (str(r.get("year") or ""),str(r.get("season") or ""),
            norm(r.get("prefecture")).replace("北北海道","北海道").replace("南北海道","北海道").replace("東東京","東京").replace("西東京","東京"),sides)
def duplication_key(r):
    date=str(r.get("date") or "")
    if not re.fullmatch(r"20\d{2}-\d\d-\d\d",date):return None
    ident=identity(r)
    if ident is None:return None
    # A repeat fixture with identical date and scores represents the same game
    return (ident[0],ident[1],date,ident[3])
def expected_slots():
    units=set()
    for y in range(2008,2027):
        for s in ("senbatsu","koshien","jingu"):
            if y==2020 or (y==2026 and s=="jingu"):continue
            units.add((y,s,"national","national"))
    for y in range(2017,2027):
        for s in ("spring","autumn"):
            if (y,s)==(2020,"spring"):continue
            for a in REGIONS:
                if y==2021 and s=="spring" and a=="tohoku":continue # JHBF announced cancellation on May 13, 2021
                units.add((y,s,"regional",a))
        units.add((y,"autumn","regional","tokyo"))
    for y in range(2021,2027):
        for s in ("spring","summer","autumn"):
            for p in PREFS:
                if s=="summer" and p in ("北海道","東京"):
                    for part in (("北北海道","南北海道") if p=="北海道" else ("東東京","西東京")):
                        units.add((y,s,"prefecture",part))
                else:units.add((y,s,"prefecture",p))
        if y!=2021:units.add((y,"spring","district_qualifier","tokyo")) # Tokyo Federation canceled 2021 first round qualifiers
    return units

def stage_issue(r):
    y=int(r.get("year") or 0)
    if y<2021:return None
    s=str(r.get("season") or "")
    pref=str(r.get("prefecture") or "")
    tournament=str(r.get("tournament") or "")
    round_=str(r.get("round") or "").strip().upper()
    lv=layer(r)
    if "北海道" in pref or ("北海道" in tournament and s in ("spring","autumn")):
        if s in ("spring","autumn"):
            if re.search(r"支庁|支部|地区予選|予選ブロック",tournament) and lv!="prefecture":
                return "hokkaido_subprefecture_must_be_prefecture"
            if re.search(r"全道",tournament) and lv!="regional":
                return "hokkaido_all_prefecture_must_be_regional"
    if "東京" in pref or ("東京" in tournament and s in ("spring","autumn")):
        if s=="spring":
            if re.search(r"地区予選|ブロック予選|一次予選",tournament) and not re.search(r"都大会",tournament) and lv!="district_qualifier":
                return "tokyo_spring_preliminary_must_be_district_qualifier"
        if s=="autumn":
            if "予選" in tournament and "都大会" not in tournament and lv!="prefecture":
                return "tokyo_autumn_preliminary_must_be_prefecture"
            m=re.match(r"^(\d+)(?:R|回戦)$",round_,re.I)
            no=int(m.group(1)) if m else 0
            if no>=3 or round_ in ("QF","SF","F"):
                if lv!="regional":return "tokyo_autumn_round3_plus_must_be_regional"
            elif no in (1,2) and lv!="prefecture":
                return "tokyo_autumn_round1_2_must_be_prefecture"
    return None

def main():
    present=defaultdict(list)
    old=defaultdict(list)
    current_rows=[]
    for y in range(2008,2027):
        rs=read(f"docs/data/ledger_shards/{y}.csv")
        current_rows += rs
        for row in rs:
            if identity(row) and row.get("tournament"):
                present[slot(row)].append(row)
        for row in old_year(y):
            if identity(row) and row.get("tournament"):
                old[slot(row)].append(row)
    from normalize_hokkaido_tokyo_levels import canonicalize
    sources=defaultdict(list)
    for root in ("data/imported","data/recovered"):
        for p in Path(root).rglob("*.csv"):
            for r in read(p):
                if identity(r) and r.get("tournament"):
                    canonicalize(r)
                    sources[slot(r)].append(r)
    expected=expected_slots()
    cases=[]
    for k in sorted(expected):
        pub=len(present[k]);src=len(sources[k]);base=len(old[k])
        status=("PUBLISHED" if pub else "SOURCE_ONLY" if src else "MISSING_SOURCE_AND_PUBLICATION")
        cases.append(dict(zip(("year","season","level","area"),k),published_matches=pub,source_matches=src,
                          nov02_matches=base,status=status))
    FCSV.parent.mkdir(parents=True,exist_ok=True)
    with FCSV.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(cases[0]));w.writeheader();w.writerows(cases)

    # Complete proof that every previously published score/team fixture is still represented.
    oldids={i for rows in old.values() for r in rows if (i:=identity(r)) is not None}
    nowids={i for r in current_rows if (i:=identity(r)) is not None}
    missing_old=oldids-nowids
    already_live_by_key=defaultdict(list)
    for r in current_rows:
        if (k:=duplication_key(r)) is not None:already_live_by_key[k].append(r)
    duplicates={k:v for k,v in already_live_by_key.items() if len(v)>1}
    violations=[]
    for r in current_rows:
        if (type_:=stage_issue(r)):
            violations.append((type_,r))
    with FISSUE.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["issue","year","season","prefecture","region","tournament","round","date","team1","score1","team2","score2","match_id"])
        w.writeheader()
        for type_,r in violations:
            w.writerow({"issue":type_,**{field:r.get(field,"") for field in w.fieldnames if field!="issue"}})
        for group in duplicates.values():
            for r in group:
                w.writerow({"issue":"duplicate_same_date_teams_score",**{field:r.get(field,"") for field in w.fieldnames if field!="issue"}})
    summary={
        "generated_at":datetime.now(timezone.utc).isoformat(),
        "baseline":BASE,
        "expected_units":len(expected),
        "published_units":sum(x["status"]=="PUBLISHED" for x in cases),
        "source_only_units":sum(x["status"]=="SOURCE_ONLY" for x in cases),
        "missing_source_and_publication_units":sum(x["status"]=="MISSING_SOURCE_AND_PUBLICATION" for x in cases),
        "missing_units":[x for x in cases if x["status"]!="PUBLISHED"],
        "published_rows":len(current_rows),
        "baseline_unique_fixture_signatures":len(oldids),
        "current_unique_fixture_signatures":len(nowids),
        "previously_published_fixture_signatures_missing":len(missing_old),
        "previously_published_missing_examples":[str(x) for x in sorted(missing_old,key=str)[:40]],
        "exact_fixture_duplicate_groups":len(duplicates),
        "exact_fixture_extra_rows":sum(len(rows)-1 for rows in duplicates.values()),
        "exact_fixture_duplicate_examples":[{"year":v[0].get("year"),"season":v[0].get("season"),
                                            "date":v[0].get("date"),"teams":[v[0].get("team1"),v[0].get("team2")],
                                            "scores":[v[0].get("score1"),v[0].get("score2")],
                                            "count":len(v)} for v in list(duplicates.values())[:20]],
        "hokkaido_tokyo_stage_issue_count":len(violations),
        "hokkaido_tokyo_stage_issue_by_type":dict(Counter(type_ for type_,r in violations)),
        "hokkaido_tokyo_stage_issue_examples":[{"type":type_, "year":r.get("year"),
                   "season":r.get("season"),"tournament":r.get("tournament"),"round":r.get("round"),
                   "team1":r.get("team1"),"team2":r.get("team2")} for type_,r in violations[:40]],
        "limitations":["A tournament is marked present after at least one match; full completeness needs comparison to authoritative tournament bracket.",
                       "Exact fixture identity assumes school name and score strings are stable across revisions.",
                       "Source match presence does not prove that the tournament bracket is complete."]
    }
    FJSON.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in summary.items() if not isinstance(v,(list,dict))},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
