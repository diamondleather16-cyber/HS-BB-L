#!/usr/bin/env python3
from __future__ import annotations
import csv
from pathlib import Path

ROOT=Path("data")

def clean_file(path: Path):
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        rd=csv.DictReader(f)
        fields=list(rd.fieldnames or [])
        if "tournament" not in fields:
            return 0,0
        rows=list(rd)
    kept=[r for r in rows if str(r.get("tournament") or "").strip()]
    removed=len(rows)-len(kept)
    if not removed:
        return len(rows),0
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(kept)
    return len(kept),removed

def main():
    files=0; removed=0
    for p in sorted(ROOT.rglob("*.csv")):
        if p.name=="template.csv":
            continue
        kept,n=clean_file(p)
        if n:
            files+=1; removed+=n
            print(f"{p}: removed={n} kept={kept}")
    print(f"blank tournament cleanup: files={files} removed={removed}")

if __name__=="__main__":
    main()
