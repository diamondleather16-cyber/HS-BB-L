#!/usr/bin/env python3
"""Undo the one obsolete deletion that suppressed the genuine 2026 Hokushinetsu first-round game.

The exact same physical fixture is kept by the deduper, and the user has
confirmed that this game must remain in school rating histories. Preserve
all unrelated edits and user deletions.
"""
import json
from pathlib import Path

p=Path("master/match_edits_shared.json")
data=json.loads(p.read_text(encoding="utf-8-sig"))
ops=data.get("authority_ops")
if not isinstance(ops,list):
    raise SystemExit("authority_ops list missing; no changes made")

def target(op):
    if str(op.get("action") or "").upper()!="DELETE":
        return False
    r=op.get("snapshot") or {}
    return (str(r.get("year"))=="2026"
            and r.get("season")=="autumn"
            and r.get("date")=="2026-10-10"
            and r.get("tournament")=="2026秋季北信越地区大会"
            and r.get("round")=="1回戦"
            and str(r.get("team1") or "")=="星稜"
            and str(r.get("score1") or "")=="3"
            and str(r.get("team2") or "")=="帝京長岡"
            and str(r.get("score2") or "")=="5")

hits=[op for op in ops if target(op)]
print("OCT10_RESTORE_MATCHED_AUTHORITY_DELETES",len(hits))
for h in hits:
    print("OCT10_RESTORE_DELETION_ID",h.get("match_id",""))
if len(hits)!=1:
    raise SystemExit("Expected exactly one obsolete deletion for this physical game; no changes made")

data["authority_ops"]=[op for op in ops if not target(op)]
p.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
from build_match_delete_index import main as rebuild_index
rebuild_index()
idx=json.loads(Path("master/match_delete_index.json").read_text(encoding="utf-8"))
assert not any(target(dict(item,action="DELETE")) for item in idx.get("deletes",[])), "delete index still excludes fixture"
print("OCT10_RESTORE_COMMITTED_SOURCE_READY",len(data["authority_ops"]))
