#!/usr/bin/env python3
from __future__ import annotations
import csv, json, re, shutil, hashlib
from pathlib import Path
from collections import defaultdict

CURRENT=Path("output/all_matches.csv")
HIST=Path("docs/data/historical_ledger_2017_2024.csv")
OUT=Path("output/ledger_shards")
LATEST_LIMIT=1200

REGION_KEYS={
    "北海道":"hokkaido",
    "東北":"tohoku",
    "関東・東京":"kanto_tokyo",
    "関東":"kanto_tokyo",
    "東京":"kanto_tokyo",
    "北信越":"hokushinetsu",
    "東海":"tokai",
    "近畿":"kinki",
    "中国":"chugoku",
    "四国":"shikoku",
    "九州":"kyushu",
    "全国":"national",
}

def read_csv(path):
    if not path.exists(): return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def score(v):
    try:
        n=float(v)
        return str(int(n)) if n.is_integer() else str(n)
    except Exception:
        return str(v or "").strip()

def date_key(v):
    s=str(v or "").strip()
    p=[x for x in re.split(r"[^0-9]+",s) if x]
    if len(p)>=3:
        try:
            y,m,d=map(int,p[:3]); return f"{y:04d}-{m:02d}-{d:02d}"
        except Exception: pass
    return s

def row_key(r):
    return "|".join([
        str(r.get("year") or "").strip(),
        str(r.get("season") or "").strip(),
        date_key(r.get("date")),
        str(r.get("tournament") or "").strip(),
        str(r.get("round") or "").strip(),
        str(r.get("team1") or "").strip(),
        score(r.get("score1")),
        str(r.get("team2") or "").strip(),
        score(r.get("score2")),
    ])

def region_key(r):
    raw=str(r.get("region") or "").strip()
    return REGION_KEYS.get(raw,"other")

def region_label(key):
    rev={
        "hokkaido":"北海道","tohoku":"東北","kanto_tokyo":"関東・東京",
        "hokushinetsu":"北信越","tokai":"東海","kinki":"近畿",
        "chugoku":"中国","shikoku":"四国","kyushu":"九州",
        "national":"全国","other":"不明"
    }
    return rev.get(key,key)

def main():
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True,exist_ok=True)

    merged={}
    # Historical first; generated/current rows win when exact duplicates exist.
    # Blank-tournament rows are malformed and never enter display shards.
    for r in read_csv(HIST):
        if not str(r.get("tournament") or "").strip():
            continue
        if not str(r.get("match_id") or "").strip():
            r["match_id"]="HIST-"+hashlib.sha1(row_key(r).encode("utf-8")).hexdigest()[:20].upper()
        merged[row_key(r)]=r
    for r in read_csv(CURRENT):
        if not str(r.get("tournament") or "").strip():
            continue
        if not str(r.get("match_id") or "").strip():
            r["match_id"]="CUR-"+hashlib.sha1(row_key(r).encode("utf-8")).hexdigest()[:20].upper()
        merged[row_key(r)]=r

    groups=defaultdict(list)
    year_region_groups=defaultdict(list)
    field_order=[]
    seen_fields=set()
    for r in merged.values():
        y=str(r.get("year") or "").strip()
        if not y: continue
        groups[y].append(r)
        year_region_groups[(y,region_key(r))].append(r)
        for k in r.keys():
            if k not in seen_fields:
                seen_fields.add(k); field_order.append(k)

    preferred=[
        "year","season","region","prefecture","tournament","round","date",
        "team1","score1","team2","score2","source_url","note","innings","finish_type",
        "edit_key","manual_id","match_id","team1_school_id","team1_canonical",
        "team1_type","team1_union_id","team2_school_id","team2_canonical",
        "team2_type","team2_union_id","_source_file"
    ]
    fields=[x for x in preferred if x in seen_fields]+[x for x in field_order if x not in preferred]

    # Small first-paint snapshot. It is generated after apply_match_edits.py,
    # so user DELETE/UPDATE state is already materialized here.
    latest_rows=sorted(
        merged.values(),
        key=lambda r:(date_key(r.get("date")),row_key(r)),
        reverse=True
    )[:LATEST_LIMIT]
    latest_path=OUT/"latest.csv"
    with latest_path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(latest_rows)

    manifest={"version":3,"years":[],"total":0,"latest_file":"latest.csv","latest_count":len(latest_rows)}
    for y in sorted(groups,key=lambda x:int(x) if x.isdigit() else -1,reverse=True):
        rows=groups[y]
        rows.sort(key=lambda r:(date_key(r.get("date")),row_key(r)),reverse=True)
        p=OUT/f"{y}.csv"
        with p.open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
            w.writeheader(); w.writerows(rows)
        dates=[date_key(r.get("date")) for r in rows if date_key(r.get("date"))]

        region_entries=[]
        year_dir=OUT/y
        year_dir.mkdir(parents=True,exist_ok=True)
        region_keys=sorted(
            {rk for yy,rk in year_region_groups if yy==y},
            key=lambda k:["hokkaido","tohoku","kanto_tokyo","hokushinetsu","tokai","kinki","chugoku","shikoku","kyushu","national","other"].index(k)
            if k in ["hokkaido","tohoku","kanto_tokyo","hokushinetsu","tokai","kinki","chugoku","shikoku","kyushu","national","other"] else 99
        )
        for rk in region_keys:
            rr=year_region_groups[(y,rk)]
            rr.sort(key=lambda r:(date_key(r.get("date")),row_key(r)),reverse=True)
            rp=year_dir/f"{rk}.csv"
            with rp.open("w",encoding="utf-8-sig",newline="") as f:
                w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
                w.writeheader(); w.writerows(rr)
            rdates=[date_key(r.get("date")) for r in rr if date_key(r.get("date"))]
            region_entries.append({
                "key":rk,
                "label":region_label(rk),
                "count":len(rr),
                "first_date":min(rdates) if rdates else "",
                "last_date":max(rdates) if rdates else "",
                "file":f"{y}/{rk}.csv"
            })

        manifest["years"].append({
            "year":y,"count":len(rows),
            "first_date":min(dates) if dates else "",
            "last_date":max(dates) if dates else "",
            "file":f"{y}.csv",
            "regions":region_entries
        })
        manifest["total"]+=len(rows)

    (OUT/"manifest.json").write_text(
        json.dumps(manifest,ensure_ascii=False,separators=(",",":")),encoding="utf-8"
    )
    print(f"Ledger shards: years={len(groups)} total={manifest['total']} latest={len(latest_rows)} year-region={len(year_region_groups)}")

if __name__=="__main__":
    main()
