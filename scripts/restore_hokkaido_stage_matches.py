#!/usr/bin/env python3
"""Restore independently verified 2021+ Hokkaido spring/autumn fixtures removed by obsolete bulk DELETEs.

Never restore legacy/archive phantom rounds; use only curated imported results.
Preserve existing edited ledger records and avoid changing user input/DELETE history.
"""
import csv
import hashlib
import json
from pathlib import Path
from normalize import load_school_aliases, normalize_school_name
from normalize_hokkaido_tokyo_levels import canonicalize

OUT=Path("output/all_matches.csv")
def pair(row):
    return tuple(sorted(((str(row.get("team1") or "").strip(),str(row.get("score1") or "").strip()),
                         (str(row.get("team2") or "").strip(),str(row.get("score2") or "").strip()))))
def key(row):
    return (str(row.get("year") or ""),str(row.get("season") or ""),pair(row))
def load(path):
    with path.open(encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))
def main():
    existing=load(OUT)
    if not existing:raise SystemExit("Empty match ledger; cannot restore Hokkaido fixtures")
    # Some manually edited/historical rows survive with the old year-first
    # display name although their actual stage is already regional.
    # Canonicalize existing 2021+ Hokkaido fixtures as well as restored rows.
    normalized=0
    for row in existing:
        try:year=int(row.get("year") or 0)
        except (ValueError,TypeError):continue
        if year>=2021 and row.get("season") in ("spring","autumn") and (
                "北海道" in str(row.get("prefecture") or "") or
                str(row.get("region") or "") in ("北海道","hokkaido")):
            if canonicalize(row):normalized+=1
    aliases=load_school_aliases()
    # The legacy snapshot misdated 137 verified 2025 autumn branch games to
    # Oct 12 and relabeled them "1R" (all-Hokkaido main tournament).
    # Remove only when the curated imported file proves the same two teams
    # and score belong to a branch qualifying game on a different date.
    official_2025=load(Path("data/imported/2025/autumn/北海道.csv"))
    branch_2025=set()
    for row in official_2025:
        if str(row.get("round") or "") not in ("地区予選","地区大会"):continue
        row["team1"]=normalize_school_name(row.get("team1") or "",aliases)
        row["team2"]=normalize_school_name(row.get("team2") or "",aliases)
        branch_2025.add(pair(row))
    obsolete=[]
    retained=[]
    for row in existing:
        if (row.get("year")=="2025" and row.get("season")=="autumn"
            and row.get("date")=="2025-10-12"
            and row.get("round") in ("1R","1回戦")
            and pair(row) in branch_2025
            and str(row.get("_source_file") or "") not in ("data/imported/2025/autumn/北海道.csv",)):
            obsolete.append(row)
        else:retained.append(row)
    existing=retained
    known={key(row) for row in existing}
    known_new=set()
    restored=[]
    report={}
    for year in range(2021,2027):
        for season in ("spring","autumn"):
            path=Path(f"data/imported/{year}/{season}/北海道.csv")
            if not path.is_file():raise SystemExit(f"Required authoritative Hokkaido source missing: {path}")
            source=load(path)
            added=0
            for source_line,row in enumerate(source,start=2):
                row=dict(row)
                if not row.get("tournament") or not row.get("team1") or not row.get("team2"):continue
                row["team1"]=normalize_school_name(row["team1"],aliases)
                row["team2"]=normalize_school_name(row["team2"],aliases)
                if key(row) in known or key(row) in known_new:continue
                if not str(row.get("score1") or "").isdigit() or not str(row.get("score2") or "").isdigit():continue
                row["_source_file"]=str(path)
                row["_source_row"]=str(source_line)
                # ID deliberately differs from earlier intentionally deleted source
                # variants; it identifies a newly restored verified fixture only.
                signature="|".join(map(str,(year,season,*pair(row)[0],*pair(row)[1])))
                row["match_id"]="HOKREST-"+hashlib.sha1(signature.encode("utf-8")).hexdigest()[:20].upper()
                canonicalize(row)
                row["note"]=(row.get("note") or "")+";verified_hokkaido_source_restore=1"
                known_new.add(key(row))
                restored.append(row)
                added+=1
            report[f"{year}_{season}"]={"curated_source_rows":len(source),"missing_fixtures_restored":added}
    fields=list(existing[0].keys())
    for row in restored:
        for field in row:
            if field not in fields:fields.append(field)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        writer.writeheader();writer.writerows(existing);writer.writerows(restored)
    p=Path("output/audit/hokkaido_restored_fixtures.json")
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("HOKKAIDO_FIXTURES_RESTORED",json.dumps(report,ensure_ascii=False),"existing_rows_reclassified",normalized,"obsolete_2025_branch_date_duplicates_removed",len(obsolete),flush=True)
if __name__=="__main__":main()
