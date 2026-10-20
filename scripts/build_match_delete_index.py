#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

SRC=Path("master/match_edits_shared.json")
OUT=Path("master/match_delete_index.json")

KEEP=("year","season","prefecture","date","tournament","round","team1","score1","team2","score2","manual_id","source_url","_source_file")

def main():
    if not SRC.exists():
        raise SystemExit("master/match_edits_shared.json missing")
    state=json.loads(SRC.read_text(encoding="utf-8")) or {}
    deletes=[]
    for op in state.get("authority_ops",[]) or []:
        if str(op.get("action") or "").upper()!="DELETE":
            continue
        mid=str(op.get("match_id") or "").strip()
        if not mid:
            continue
        snap=op.get("snapshot") or {}
        deletes.append({
            "match_id":mid,
            "updated_at":op.get("updated_at") or "",
            "snapshot":{k:snap.get(k,"") for k in KEEP}
        })
    payload={"version":1,"updated_at":state.get("updated_at") or "","deletes":deletes}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"match delete index: {len(deletes)}")

if __name__=="__main__":
    main()
