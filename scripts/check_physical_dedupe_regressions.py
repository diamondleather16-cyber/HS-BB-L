#!/usr/bin/env python3
"""Regression tests for fixture dedupe: alternate competition names and prefecture-seed school labels."""
from dedupe_ledger_physical_fixtures import dedupe

def row(t1,t2,score1="4",score2="1",pref="",date="2026-10-11",source="data/imported/2026/autumn/北信越.csv"):
    return dict(year="2026",season="autumn",region="北信越",prefecture=pref,date=date,
                tournament="2026秋季北信越地区大会",round="準々決勝",
                team1=t1,score1=score1,team2=t2,score2=score2,
                note="level=regional",source_url="https://koshien89.com/blog-entry-3909.html",
                _source_file=source)
a=row("帝京長岡(新潟1)","松商学園(長野2)",source="data/imported/2026/autumn/北信越.csv")
b=row("帝京長岡","松商学園",source="data/imported/2026/autumn/hokushinetsu.csv")
kept,stats=dedupe([a,b])
assert len(kept)==1 and stats["duplicates_suppressed"]==1, stats
assert kept[0]["team1"]=="帝京長岡" and kept[0]["team2"]=="松商学園", kept
# Different scores/dates or distinct explicit prefectures must NOT collapse.
for other in (row("帝京長岡","松商学園","5","1"),
              row("帝京長岡","松商学園",date="2026-10-12"),
              row("帝京長岡","松商学園",pref="長野")):
    baseline=row("帝京長岡","松商学園",pref="新潟")
    retained,_=dedupe([baseline,other])
    assert len(retained)==2, (baseline,other)
print("Physical fixture deduplication regression tests passed")
