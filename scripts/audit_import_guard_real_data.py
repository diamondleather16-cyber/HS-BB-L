#!/usr/bin/env python3
"""Read-only production-input assessment for the import duplicate guard."""
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
import csv,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import process_import_requests as importer
ROOT=Path("data/imported")
OUTPUT=Path("output/audit/import_guard_real_data.json")
def main():
    paths=sorted(ROOT.rglob("*.csv"))
    first_seen={}
    broad_scores=defaultdict(set)
    stats=Counter()
    examples=[]
    for p in paths:
        with p.open(encoding="utf-8-sig",newline="") as f:
            for n,r in enumerate(csv.DictReader(f),2):
                stats["scanned"]+=1
                k=importer._import_identity(r)
                if k is None:
                    stats["non_identifiable"]+=1
                    continue
                stats["identifiable"]+=1
                coarse=k[:4]+(tuple(sorted((x[0] for x in k[4]))),)
                broad_scores[coarse].add(k[4])
                if k in first_seen:
                    stats["guard_would_block_on_reimport"]+=1
                    origin=first_seen[k]
                    if origin[0]!=str(p):stats["cross_file_guard_matches"]+=1
                    if len(examples)<100:
                        examples.append({"origin_file":origin[0],"origin_line":origin[1],
                          "repeat_file":str(p),"repeat_line":n,"source_url":k[0],
                          "year":k[1],"season":k[2],"date":k[3],
                          "results":k[4]})
                else:first_seen[k]=(str(p),n)
    stats["score_conflict_keys_not_blocked"]=sum(len(v)>1 for v in broad_scores.values())
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),"scope":"existing data/imported CSVs",
     "status":"read_only","statistics":dict(stats),
     "meaning":"Duplicate counts are hypothetical if ingested again, not confirmed corrections or deletions.",
     "duplicate_samples":examples}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload["statistics"],ensure_ascii=False))
if __name__=="__main__":main()
