#!/usr/bin/env python3
"""Suppress actual duplicate match rows in generated ledgers, not source CSVs.

A physical game is identified by year, season, confirmed match date, and both
team-score pairs. Never fold two rows when both claim different prefectures:
identically named schools in different prefectures can be different teams.
"""
import csv, json, re, unicodedata
from collections import Counter
from pathlib import Path

def txt(v):
    return re.sub(r"[\s\u3000・･]+", "", unicodedata.normalize("NFKC", str(v or ""))).strip()
SEED_SUFFIX = re.compile(r"\((?:北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|山梨|新潟|富山|石川|福井|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)[1-9][0-9]*\)$")
def team(v):
    return SEED_SUFFIX.sub("", txt(v))

def score(v):
    s=txt(v)
    try:return str(int(float(s)))
    except ValueError:return s
def prefecture(r):
    p=txt(r.get("prefecture"))
    return {"北北海道":"北海道","南北海道":"北海道",
            "東東京":"東京","西東京":"東京"}.get(p,p)
def key(r):
    date=str(r.get("date") or "").strip()
    if not re.fullmatch(r"20\d\d-\d\d-\d\d",date):return None
    pairs=tuple(sorted(((team(r.get("team1")),score(r.get("score1"))),
                        (team(r.get("team2")),score(r.get("score2"))))))
    if not all(name and scr for name,scr in pairs):return None
    return (str(r.get("year") or ""),str(r.get("season") or "").strip(),date,pairs)
def quality(r):
    note=str(r.get("note") or "")
    source=str(r.get("_source_file") or "")
    return (
        bool(r.get("manual_id"))*20,
        "verified_match_date=1" in note,
        "level=" in note,
        bool(r.get("round")),
        bool(r.get("source_url")),
        not (SEED_SUFFIX.search(txt(r.get("team1"))) or SEED_SUFFIX.search(txt(r.get("team2")))),
        source.startswith("data/imported/"),
        source.startswith("data/recovered/"),
        bool(r.get("team1_school_id"))+bool(r.get("team2_school_id")),
        bool(r.get("match_id")),
    )
def dedupe(rows):
    keep=[]
    locations={}
    removed=0
    examples=[]
    for row in rows:
        k=key(row)
        if k is None:
            keep.append(row)
            continue
        indices=locations.setdefault(k,[])
        # Different explicit prefectures mean this could be two distinct schools.
        matched=None
        p=prefecture(row)
        for idx in indices:
            other=prefecture(keep[idx])
            if not p or not other or p==other:
                matched=idx
                break
        if matched is None:
            indices.append(len(keep))
            keep.append(row)
            continue
        prev=keep[matched]
        if quality(row)>quality(prev):
            keep[matched]=row
        removed+=1
        if len(examples)<30:
            examples.append({
                "year":str(row.get("year") or ""),"season":str(row.get("season") or ""),
                "date":str(row.get("date") or ""),
                "team1":str(row.get("team1") or ""),"team2":str(row.get("team2") or ""),
                "prefecture_before":prefecture(prev),"prefecture_new":p,
            })
    return keep, {"input_rows":len(rows),"output_rows":len(keep),
                  "duplicates_suppressed":removed,
                  "examples":examples}

def main():
    source=Path("output/all_matches.csv")
    with source.open("r",encoding="utf-8-sig",newline="") as f:
        reader=csv.DictReader(f)
        fields=list(reader.fieldnames or [])
        rows=list(reader)
    retained,report=dedupe(rows)
    if report["duplicates_suppressed"]:
        with source.open("w",encoding="utf-8-sig",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
            writer.writeheader();writer.writerows(retained)
    p=Path("output/audit/physical_fixture_dedupe.json")
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PHYSICAL_MATCH_DEDUPE",json.dumps({k:v for k,v in report.items() if k!="examples"},ensure_ascii=False),flush=True)
if __name__=="__main__":
    main()
