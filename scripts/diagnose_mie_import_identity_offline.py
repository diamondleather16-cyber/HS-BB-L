#!/usr/bin/env python3
"""Offline classification of why historical games lack a safe import identity."""
import csv,json,re,sys,collections,datetime
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp

TARGET=Path("data/imported/2021/autumn/三重.csv")
OUT=Path("output/audit/offline_identity_diagnostics.json")
def reason(row):
    if imp._import_identity(row) is not None:return "identifiable"
    if not str(row.get("source_url") or "").startswith(("https://","http://")):return "missing_or_invalid_source_url"
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(row.get("date") or "")):return "invalid_date"
    for side in ("1","2"):
        if not re.fullmatch(r"\d{1,3}",str(row.get("score"+side) or "")):return "invalid_score"
        if not imp.clean_team(row.get("team"+side)):return "missing_team"
    return "other_identity_issue"

def main():
    rows=list(csv.DictReader(TARGET.open(encoding="utf-8-sig",newline="")))
    counts=collections.Counter(reason(r) for r in rows)
    examples=collections.defaultdict(list)
    for r in rows:
        tag=reason(r)
        if len(examples[tag])<12:
            examples[tag].append({k:r.get(k,"") for k in ("date","round","team1","score1","team2","score2","source_url","note")})
    result={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_csv":str(TARGET),"rows":len(rows),"classification":dict(counts),
        "examples":dict(examples),"offline_only":True,
        "disclaimer":"This diagnoses saved rows, not a fresh parser output; the 33 unmatched article rows require access to their parsed source to compare exactly."}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"rows":len(rows),"classification":dict(counts)},ensure_ascii=False))
if __name__=="__main__":main()
