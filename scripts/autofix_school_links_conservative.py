#!/usr/bin/env python3
"""Conservatively repair school links with an unambiguous, prefecture-confirmed master ID.
Never replace a nonempty ID; never guess when names or prefectures disagree.
Produces complete before/after audit. Source inputs remain in original order.
"""
import csv,json,re,unicodedata
from pathlib import Path
from collections import defaultdict,Counter
from datetime import datetime,timezone
MASTER=Path("master/school_master_shared.json")
PATHS=[Path("data/all_matches.csv"),Path("docs/data/historical_ledger_2017_2024.csv")]
REPORT=Path("master/school_link_autofix_audit.csv")
SUMMARY=Path("master/school_link_autofix_summary.json")
def n(s):return re.sub(r"[\s　・･]+","",unicodedata.normalize("NFKC",str(s or ""))).strip()
def pref(s):
 x=n(s).replace("東京都","東京")
 return {"東東京":"東京","西東京":"東京","北北海道":"北海道","南北海道":"北海道"}.get(x,x)
def level(row):
 m=re.search(r"(?:^|;)\s*level=([^;]+)",str(row.get("note") or ""))
 return (m.group(1).strip() if m else "") or str(row.get("level") or "").strip()
LOCAL={"prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"}
FIELDS=["source","line","year","season","tournament","round","match_id","side","school","prefecture","school_id","reason"]
def main():
 master=json.loads(MASTER.read_text(encoding="utf-8-sig"))
 index=defaultdict(set);byid={}
 for rec in master.get("schools",[]):
  sid=str(rec.get("school_id") or "").strip()
  if not sid or str(rec.get("kind") or "school")=="union" or str(rec.get("status") or "active")=="merged":continue
  byid[sid]=rec
  for alias in [rec.get("canonical_name"),*(rec.get("aliases") or [])]:
   if n(alias):index[(n(alias),pref(rec.get("prefecture")))].add(sid)
 unions={n(x.get("display_name")) for x in master.get("unions",[]) if isinstance(x,dict)}
 saved=json.loads(Path("master/match_edits_shared.json").read_text(encoding="utf-8-sig"))
 # Shared editor links are already authoritative. Do not overlay a different guess.
 editing={str(x.get("edit_key") or "")+"|"+str(x.get("side") or "") for x in saved.get("team_links",[])}
 rows_audit=[];counter=Counter()
 for path in PATHS:
  with path.open(encoding="utf-8-sig",newline="") as f:
   reader=csv.DictReader(f);fields=list(reader.fieldnames or []);rows=list(reader)
  if not "team1_school_id" in fields:fields.append("team1_school_id")
  if not "team2_school_id" in fields:fields.append("team2_school_id")
  dirty=False
  for line,row in enumerate(rows,2):
   if level(row) not in LOCAL:continue
   p=pref(row.get("prefecture"))
   if not p:continue
   for side in ("team1","team2"):
    if row.get(side+"_school_id"):continue
    if row.get(side+"_union_id") or row.get(side+"_type")=="union" or n(row.get(side)) in unions:continue
    school=n(row.get(side));candidates=index.get((school,p),set())
    if len(candidates)!=1:
     counter["no_unique_prefecture_match"]+=1
     continue
    # Source records with explicit saved edit keys are excluded; server-side
    # per-match user overrides must retain priority on rebuild.
    editkey=str(row.get("edit_key") or "")
    if editkey and (editkey+"|"+side) in editing:continue
    sid=next(iter(candidates))
    row[side+"_school_id"]=sid
    rows_audit.append(dict(zip(FIELDS,[str(path),line,row.get("year",""),row.get("season",""),row.get("tournament",""),row.get("round",""),row.get("match_id",""),side,row.get(side,""),p,sid,"unique exact name and matching prefecture"])))
    dirty=True
    counter["linked"]+=1
  if dirty:
   with path.open("w",encoding="utf-8-sig",newline="") as f:
    writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");writer.writeheader();writer.writerows(rows)
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 with REPORT.open("w",encoding="utf-8-sig",newline="") as f:
  writer=csv.DictWriter(f,fieldnames=FIELDS);writer.writeheader();writer.writerows(rows_audit)
 SUMMARY.write_text(json.dumps({"generated_at":datetime.now(timezone.utc).isoformat(),"linked":counter["linked"],"unresolved_or_ambiguous":counter["no_unique_prefecture_match"],"rule":"Only blank school IDs in single-prefecture stages; exact unique master name plus matching prefecture; union excluded; existing school IDs never overwritten."},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("SCHOOL_LINK_AUTOFIX",dict(counter))
if __name__=="__main__":main()
