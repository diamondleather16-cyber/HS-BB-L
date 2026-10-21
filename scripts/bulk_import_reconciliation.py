#!/usr/bin/env python3
"""Bulk, read-only review across all imported games.

Group source-identical games across CSVs, preserve all records, and identify
conflicting metadata. No manual one-tournament pipeline or automatic deletion.
"""
import csv,json,re,collections,datetime
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import process_import_requests as imp
ROOT=Path("data/imported");OUT=Path("output/audit/bulk_import_reconciliation.json")
def main():
 groups=collections.defaultdict(list);stats=collections.Counter()
 for p in sorted(ROOT.rglob("*.csv")):
  with p.open(encoding="utf-8-sig",newline="") as f:
   rd=csv.DictReader(f)
   if not rd.fieldnames or not {"source_url","team1","team2"}.issubset(rd.fieldnames):continue
   for line,r in enumerate(rd,2):
    stats["source_rows"]+=1
    k=imp._import_identity(r)
    if not k:
     stats["not_identifiable"]+=1;continue
    groups[k].append({"file":str(p),"line":line,"prefecture":r.get("prefecture") or "",
                     "tournament":r.get("tournament") or "","round":r.get("round") or "",
                     "note":r.get("note") or ""})
 issues=[];groups_by_pref=collections.Counter()
 for k,g in groups.items():
  if len(g)<2:continue
  stats["duplicate_candidate_groups"]+=1
  stats["duplicate_candidate_rows"]+=len(g)
  different_files=len(set(x["file"] for x in g))>1
  metadata_conflict=len(set((x["prefecture"],x["tournament"],x["round"]) for x in g))>1
  if different_files:stats["cross_file_groups"]+=1
  if metadata_conflict:stats["metadata_conflict_groups"]+=1
  if not different_files and not metadata_conflict:stats["same_file_metadata_identical_groups"]+=1
  for x in g:groups_by_pref[x["prefecture"]]+=1
  issues.append({"source_url":k[0],"year":k[1],"season":k[2],"date":k[3],
                 "team_results":k[4],"copies":len(g),"cross_file":different_files,
                 "metadata_conflict":metadata_conflict,"records":g})
 stats["unique_identifiable_games"]=len(groups)
 OUT.parent.mkdir(parents=True,exist_ok=True)
 payload={"run_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "status":"review_only","data_modified":False,
          "statistics":dict(stats),"affected_prefecture_rows":dict(groups_by_pref),
          "groups":issues,
          "warning":"Groupings rely on identical source URL, date, schools and score. Do not auto-delete without resolving source and level."}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"statistics":payload["statistics"],"most_affected":groups_by_pref.most_common(12)},ensure_ascii=False))
if __name__=="__main__":main()
