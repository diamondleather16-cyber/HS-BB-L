"""Normalize lower-stage tournament levels without altering original source fixtures.

Nagano spring/autumn district rounds are qualifiers to the final prefectural
tournament, not main-bracket prefectural games.  Preserve the original input
CSV and stable source match_id; annotate only replay/merged ledger records.
"""
import re


def lower_stage_level(row, current_level):
    level = str(current_level or "prefecture").strip()
    if level in {"regional", "national"}:
        return level
    if str(row.get("season") or "") not in {"spring", "autumn"}:
        return level
    stage = "".join(str(row.get("round") or "").split())
    if "敗者復活" in stage:
        return "repechage"
    if str(row.get("prefecture") or "").strip() == "長野" and stage in {"地区大会", "地区予選"}:
        return "district_qualifier"
    return level


def retag_lower_stage(row):
    old_note = str(row.get("note") or "")
    match = re.search(r"(?:^|;)level=([^;]+)", old_note)
    old = (match.group(1) if match else str(row.get("level") or "")).strip() or "prefecture"
    new = lower_stage_level(row, old)
    if new == old:
        return False
    parts = [p for p in old_note.split(";") if p and not p.startswith("level=")]
    parts.insert(0, f"level={new}")
    row["note"] = ";".join(parts)
    if str(row.get("level") or "").strip():
        row["level"] = new
    return True
