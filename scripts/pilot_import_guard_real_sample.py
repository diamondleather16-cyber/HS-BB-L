#!/usr/bin/env python3
"""Dry-run a real-CSV import through merge_csv against an isolated temporary root.

Never reads/writes live importer queue or modifies registered data.
"""
import csv, json, tempfile, sys
from pathlib import Path
from unittest.mock import patch
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

def read_sample(limit=30):
    for path in sorted(Path("data/imported").rglob("*.csv")):
        if "/2021/" not in "/"+str(path).replace("\\\\","/") and not any("/"+str(y)+"/" in "/"+str(path) for y in range(2022,2027)):
            continue
        if path.stem in ("全国", "日本") or path.parent.name not in ("spring","summer","autumn"):
            continue
        with path.open(encoding="utf-8-sig",newline="") as f:
            rows=[{k:r.get(k,"") for k in imp.FIELDS} for r in csv.DictReader(f)]
        usable=[r for r in rows if imp._import_identity(r) and "level=prefecture" in r.get("note","")]
        if len(usable)>=limit:
            return path,usable[:limit]
    raise RuntimeError("No real CSV contains enough identifiable games for the pilot")

def count_rows(path):
    with path.open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def main():
    source,rows=read_sample()
    with tempfile.TemporaryDirectory(prefix="hsbbl-import-pilot-") as d, patch.object(imp,"DATA_ROOT",Path(d)):
        imp._IMPORT_IDENTITIES=None
        first=Path(d)/"pilot/first.csv"
        second=Path(d)/"pilot/second.csv"
        first_count,_,_=imp.merge_csv(first,rows)
        # A rerun with different metadata must never copy identical games.
        renamed=[dict(r,tournament="再取得・大会名相違",round="別回戦",
                       prefecture="別県") for r in rows]
        second_count,_,_=imp.merge_csv(second,renamed)
        # A source or score conflict must not be silently treated as a duplicate.
        score_variant=dict(rows[0],score1=str(int(rows[0]["score1"])+1),
                           tournament="要確認・スコア不一致")
        source_variant=dict(rows[1],source_url="https://example.org/independent-record",
                            tournament="要確認・別ソース")
        variant_count,_,_=imp.merge_csv(second,[score_variant,source_variant])
        actual_first=len(count_rows(first))
        actual_second=len(count_rows(second))
        expected={"first_added":len(rows),"renamed_added":0,"variants_added":2,
                  "first_file_rows":len(rows),"second_file_rows":2}
        actual={"first_added":first_count,"renamed_added":second_count,
                "variants_added":variant_count,"first_file_rows":actual_first,
                "second_file_rows":actual_second}
        passed=actual==expected
    report={"sample_source":str(source),"sample_size":len(rows),"expected":expected,
            "actual":actual,"passed":passed,"live_data_modified":False,
            "description":"All writes occurred inside a temporary directory and were discarded."}
    p=Path("output/audit/import_guard_pilot.json")
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False))
    if not passed:raise SystemExit(1)
if __name__=="__main__":main()
