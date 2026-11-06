#!/usr/bin/env python3
"""Fail any rating publish missing curated Hokkaido fixtures or misclassifying stages."""
import csv
import re
from pathlib import Path
from collections import Counter
from normalize import load_school_aliases,normalize_school_name
from normalize_hokkaido_tokyo_levels import classify
def load(path):
    with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def pair(r):
    return tuple(sorted(((str(r.get("team1") or "").strip(),str(r.get("score1") or "").strip()),
                         (str(r.get("team2") or "").strip(),str(r.get("score2") or "").strip()))))
def key(r):return str(r.get("year") or ""),str(r.get("season") or ""),pair(r)
def main():
    ledger=load(Path("output/all_matches.csv"))
    events=load(Path("output/rating_events.csv"))
    ls={key(r) for r in ledger}
    rs={key(r) for r in events}
    aliases=load_school_aliases()
    failed=[];stats={}
    for year in range(2021,2027):
        for season in ("spring","autumn"):
            label="春季" if season=="spring" else "秋季"
            main_name=f"{label}北海道{year}"
            branch_name=f"{label}北海道支庁{year}"
            p=Path(f"data/imported/{year}/{season}/北海道.csv")
            src=load(p)
            expected={}
            for r in src:
                r["team1"]=normalize_school_name(r.get("team1") or "",aliases)
                r["team2"]=normalize_school_name(r.get("team2") or "",aliases)
                if not r.get("team1") or not r.get("team2"):continue
                if not str(r.get("score1") or "").isdigit() or not str(r.get("score2") or "").isdigit():continue
                expected[key(r)]=r
            missing_ledger=set(expected)-ls
            missing_rating=set(expected)-rs
            target=[r for r in ledger if str(r.get("year"))==str(year) and r.get("season")==season and r.get("prefecture")=="北海道"]
            wrong=[]
            for r in target:
                round_=str(r.get("round") or "")
                main=bool(re.fullmatch(r"(?:[1-9][0-9]*(?:回戦|R)|準々決勝|準決勝|決勝|QF|SF|F|FINAL)",round_,re.I))
                branch=round_ in {"地区大会","地区予選","支部予選","支庁予選"}
                if main and (r.get("tournament")!=main_name or classify(r)[0]!="regional"):
                    wrong.append((r.get("date"),round_,r.get("tournament"),r.get("team1")))
                if branch and (r.get("tournament")!=branch_name or classify(r)[0]!="prefecture"):
                    wrong.append((r.get("date"),round_,r.get("tournament"),r.get("team1")))
            stats[f"{year}_{season}"]={"source_unique":len(expected),"not_in_ledger":len(missing_ledger),"not_in_rating":len(missing_rating),"wrong_level":len(wrong)}
            if missing_ledger or missing_rating or wrong:
                failed.append((year,season,len(missing_ledger),len(missing_rating),wrong[:3]))
    print("HOKKAIDO_FULL_REPLAY_STAGE_AUDIT",stats,flush=True)
    if failed:raise SystemExit(f"HOKKAIDO_SOURCE_REPLAY_FAILED: {failed}")
if __name__=="__main__":main()
