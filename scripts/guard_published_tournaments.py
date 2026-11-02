#!/usr/bin/env python3
"""Reject publication that silently drops an already-published 2025+ tournament."""
import csv
from collections import Counter
from pathlib import Path

def count(root):
    counts=Counter()
    if not root.exists():return counts
    for p in root.rglob("*.csv"):
        # Year shards and region shards contain the same matches; read region shards only.
        if not p.parent.name.isdigit() or p.parent.parent != root:continue
        with p.open(encoding="utf-8-sig",newline="") as f:
            for r in csv.DictReader(f):
                try:y=int(r.get("year") or 0)
                except ValueError:continue
                if y<2025:continue
                k=(str(y),r.get("season",""),r.get("tournament",""))
                if k[2]:counts[k]+=1
    return counts

old=count(Path("docs/data/ledger_shards"))
new=count(Path("output/ledger_shards"))
missing=[(k,n,new.get(k,0)) for k,n in old.items() if n>=3 and new.get(k,0)==0]
print("PUBLICATION_PRESERVATION",f"previous_tournaments={len(old)}",f"new_tournaments={len(new)}",f"vanished={len(missing)}",flush=True)
for k,before,after in missing[:80]:
    print("VANISHED_TOURNAMENT",*k,"previous",before,"new",after,flush=True)
if missing:
    raise SystemExit("BLOCKED: previously published tournaments vanished from rebuild. Restore original source CSV or investigate authorized deletion.")
