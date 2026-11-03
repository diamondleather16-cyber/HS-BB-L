#!/usr/bin/env python3
"""Conservatively restore historical imported fixtures without overwriting newer rows.

Audit the historical source snapshot and current source universe match-by-match.
Keep explicit DELETE operations deleted; do not append matches already present
in any active source. Persist a machine-readable proof of the source-level comparison.
"""
import csv
import io
import json
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = "6c8903f6aef69707fe52365d0df527d3dca70f60"
FIELDS = ["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]
REPORT = Path("master/historical_source_recovery_report.json")
DETAIL = Path("master/historical_source_recovery_added.csv")

def read_file(path):
    try:
        with Path(path).open("r", encoding="utf-8-sig", newline="") as fp:
            return list(csv.DictReader(fp))
    except (OSError, UnicodeError, csv.Error):
        return []

def old_rows(path):
    p = subprocess.run(["git", "show", BASE + ":" + path], capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"Cannot read historical source: {path}: {p.stderr[:200]!r}")
    return list(csv.DictReader(io.StringIO(p.stdout.decode("utf-8-sig"))))

def norm(s):
    return re.sub(r"[\s\u3000・･]+", "", unicodedata.normalize("NFKC", str(s or ""))).strip()

def score(s):
    v = norm(s)
    try:
        return str(int(float(v)))
    except ValueError:
        return v

def fixture(r):
    y = norm(r.get("year"))
    s = norm(r.get("season")).lower()
    pref = norm(r.get("prefecture"))
    if pref in ("北北海道", "南北海道"):
        pref = "北海道"
    if pref in ("東東京", "西東京"):
        pref = "東京"
    teams = tuple(sorted(((norm(r.get("team1")), score(r.get("score1"))),
                          (norm(r.get("team2")), score(r.get("score2"))))))
    if not y or not s or not teams[0][0] or not teams[1][0]:
        return None
    return (y,s,pref,teams)

def main():
    basenames = subprocess.check_output(
        ["git","-c","core.quotePath=false","ls-tree","-r","--name-only",BASE], text=True
    ).splitlines()
    sources = sorted(p for p in basenames if p.startswith("data/imported/") and p.endswith(".csv") and
                     re.fullmatch(r"20\d\d", p.split("/")[2]))
    assert sources, "Historical source inventory unexpectedly empty; refuse vacuous success"
    current_sources = sorted(Path("data/imported").rglob("*.csv"))
    current_sources += sorted(Path("data/recovered").rglob("*.csv"))
    live = set()
    for path in current_sources:
        for row in read_file(path):
            key = fixture(row)
            if key is not None:
                live.add(key)

    edits = json.loads(Path("master/match_edits_shared.json").read_text(encoding="utf-8-sig"))
    deleted = {k for op in edits.get("authority_ops",[]) if op.get("action")=="DELETE"
               for k in [fixture(op.get("snapshot") or {})] if k is not None}
    before = len(live)
    added_rows = []
    by_file = Counter()
    old_unique = set()
    explicit_deletions = set()
    malformed = 0
    for name in sources:
        path = Path(name)
        existing = read_file(path)
        add = []
        for row in old_rows(name):
            key = fixture(row)
            if key is None:
                malformed += 1
                continue
            old_unique.add(key)
            if key in deleted:
                explicit_deletions.add(key)
                continue
            if key in live:
                continue
            add.append({col:row.get(col,"") for col in FIELDS})
            live.add(key)
            by_file[name] += 1
            added_rows.append({"file":name,**{col:row.get(col,"") for col in FIELDS}})
        if add:
            path.parent.mkdir(parents=True,exist_ok=True)
            fields = list(dict.fromkeys(FIELDS + [k for x in existing for k in x]))
            with path.open("w",encoding="utf-8-sig",newline="") as f:
                writer = csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
                writer.writeheader()
                writer.writerows(existing)
                writer.writerows(add)

    # Re-scan independent of the in-memory additions to prove the resulting files.
    after_keys = set()
    for path in current_sources:
        for row in read_file(path):
            key = fixture(row)
            if key is not None:
                after_keys.add(key)
    residual = old_unique - deleted - after_keys
    DETAIL.parent.mkdir(parents=True, exist_ok=True)
    with DETAIL.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=["file"]+FIELDS)
        w.writeheader();w.writerows(added_rows)
    report = {
        "reference_commit":BASE, "generated_at":datetime.now(timezone.utc).isoformat(),
        "reference_files":len(sources), "current_source_files":len(current_sources),
        "historical_unique_fixture_signatures":len(old_unique),
        "source_unique_before":before, "source_unique_after":len(after_keys),
        "added_historical_fixture_rows":len(added_rows),
        "restored_source_files":len(by_file), "by_file":dict(by_file),
        "explicitly_deleted_historical_signatures_skipped":len(explicit_deletions),
        "malformed_historical_rows_skipped":malformed,
        "unrepresented_reference_signatures":len(residual),
        "residual_examples":list(map(str,list(residual)[:20])),
        "verification":"source-level, based on normalized year/season/prefecture/team-and-score signatures; not independent tournament completeness",
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ("by_file","residual_examples")},ensure_ascii=False),flush=True)
    if residual:
        raise SystemExit(f"Failed historical source-level restoration: {len(residual)} signatures remain")
if __name__=="__main__":
    main()
