#!/usr/bin/env python3
"""Stop genuine disappearance of a 2025+ tournament, not mere renaming.

Use identity of actual played fixtures, not title strings. Source restoration and
Hokkaido/Tokyo layer normalization can rename the same matches on rebuild.
"""
import csv,re,unicodedata
from collections import Counter,defaultdict
from pathlib import Path

def n(x):
    return re.sub(r"[\s\u3000]+","",unicodedata.normalize("NFKC",str(x or "")))
def score(x):
    x=n(x)
    try:return str(int(float(x)))
    except ValueError:return x
def game(r):
    t=tuple(sorted(((n(r.get("team1")),score(r.get("score1"))),(n(r.get("team2")),score(r.get("score2"))))))
    return (str(r.get("year") or ""),str(r.get("season") or ""),t)
def rows(root):
    for p in root.rglob("*.csv"):
        if not p.parent.name.isdigit() or p.parent.parent!=root:continue
        with p.open(encoding="utf-8-sig",newline="") as f:
            for r in csv.DictReader(f):
                if int(r.get("year") or 0)>=2025 and r.get("tournament") and r.get("team1") and r.get("team2"):
                    yield r
old=list(rows(Path("docs/data/ledger_shards")))
new=list(rows(Path("output/ledger_shards")))
old_by=defaultdict(set)
new_by=defaultdict(set)
new_titles=Counter()
for r in old:old_by[(r["year"],r["season"],r["tournament"])].add(game(r))
for r in new:
    new_by[(r["year"],r["season"])].add(game(r))
    new_titles[(r["year"],r["season"],r["tournament"])]+=1
vanished=[]
renamed=[]
for k,games in old_by.items():
    if len(games)<3 or new_titles[k]:continue
    count=len(games & new_by[(k[0],k[1])])
    if count==0:vanished.append((k,len(games)))
    else:renamed.append((k,len(games),count))
print("PUBLICATION_PRESERVATION",
      f"previous_tournaments={len(old_by)}",
      f"new_tournaments={len(new_titles)}",
      f"renamed_tournaments_with_fixtures={len(renamed)}",
      f"genuinely_vanished={len(vanished)}",flush=True)
for k,num in vanished[:80]:
    print("VANISHED_TOURNAMENT",*k,"previous_games",num,flush=True)
if vanished:raise SystemExit("BLOCKED: previously published tournaments have no surviving matching fixture.")
