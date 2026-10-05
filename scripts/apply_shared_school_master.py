#!/usr/bin/env python3
import csv, json
from pathlib import Path

SRC=Path("master/school_master_shared.json")
if not SRC.exists():
    print("No shared school master; skip.")
    raise SystemExit(0)

state=json.loads(SRC.read_text(encoding="utf-8"))
schools=state.get("schools") or []
lineage=state.get("lineage") or []
local_areas=state.get("local_areas") or []
rep_areas=state.get("representative_areas") or []

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

aliases=[]
for s in schools:
    canonical=str(s.get("canonical_name") or "").strip()
    if not canonical: continue
    for a in s.get("aliases") or []:
        a=str(a).strip()
        if a and a!=canonical:
            aliases.append({"alias":a,"canonical_name":canonical,"note":"shared school master"})

write_csv(Path("master/school_aliases.csv"),
          ["alias","canonical_name","note"],aliases)

write_csv(Path("master/school_lineage.csv"),
          ["school_id","event_year","event_type","old_name","new_name","related_school_id","status_after","note"],
          lineage)

if local_areas:
    rows=[]
    for x in local_areas:
        y=dict(x)
        active=y.get("active",True)
        y["active"]="1" if active in (True,1,"1","true","True") else "0"
        y.setdefault("note","shared school master")
        rows.append(y)
    write_csv(Path("master/local_areas.csv"),
              ["prefecture","local_area_id","local_area_name","active","note"],rows)

if rep_areas:
    rows=[]
    for x in rep_areas:
        y=dict(x)
        y.setdefault("active_from","")
        y.setdefault("active_to","")
        y.setdefault("note","shared school master")
        rows.append(y)
    write_csv(Path("master/representative_areas.csv"),
              ["rep_area_id","prefecture","rep_area_name","area_type","active_from","active_to","note"],rows)

print(f"Applied shared master: {len(schools)} schools, {len(aliases)} aliases")
