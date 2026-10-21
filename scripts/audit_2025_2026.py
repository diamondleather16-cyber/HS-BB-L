#!/usr/bin/env python3
"""2025-26 national prefecture-ledger integrity audit; read-only to source CSVs."""
import csv,collections,re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"master"
PREFS=["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","山梨","新潟","長野","富山","石川","福井","静岡","愛知","岐阜","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"]
SPLIT={"東東京":"東京","西東京":"東京","北北海道":"北海道","南北海道":"北海道"}
ROUNDS={"F":"F","決勝":"F","SF":"SF","準決勝":"SF","QF":"QF","準々決勝":"QF","1R":"1R","1回戦":"1R","2R":"2R","2回戦":"2R"}
def read(path):
 with path.open(encoding="utf-8-sig",newline="") as f:yield from csv.DictReader(f)
def norm(v):return re.sub(r"[\s　■●○]+","",str(v or ""))
def main():
 rows=[];issues=[];source_count=collections.Counter()
 for path in sorted((ROOT/"data").rglob("*.csv")):
  if path.name in ("template.csv","all_matches.csv","current_ratings.csv"):continue
  try:
   for r in read(path):
    if str(r.get("year")) not in ("2025","2026") or r.get("season") not in ("spring","summer","autumn"):continue
    level=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
    if level and level.group(1) in ("regional","national","branch","district_qualifier"):continue
    if not (r.get("prefecture") and r.get("team1") and r.get("team2")):continue
    r["_file"]=str(path.relative_to(ROOT))
    rows.append(r);source_count[r["_file"]]+=1
  except (UnicodeError,OSError,csv.Error):continue
 groups=collections.defaultdict(list);keys=collections.defaultdict(list)
 for r in rows:
  y,se,p=str(r["year"]),r["season"],SPLIT.get(r["prefecture"],r["prefecture"])
  groups[(y,se,p)].append(r)
  title=norm(r.get("tournament"))
  other=[q for q in PREFS if q != p and (q+"大会" in title or q+"県大会" in title or q+"府大会" in title or q+"都大会" in title)]
  if other:
   issues.append({"issue":"wrong_prefecture_tournament","year":y,"season":se,"prefecture":p,"file":r["_file"],"detail":r.get("tournament",""),"source_url":r.get("source_url","")})
  try:
   int(r["score1"]);int(r["score2"])
  except (ValueError,TypeError):
   issues.append({"issue":"invalid_score","year":y,"season":se,"prefecture":p,"file":r["_file"],"detail":str(r.get("score1"))+"-"+str(r.get("score2")),"source_url":r.get("source_url","")})
  if not re.fullmatch(r"20\d\d-\d\d-\d\d",r.get("date","")):
   issues.append({"issue":"invalid_date","year":y,"season":se,"prefecture":p,"file":r["_file"],"detail":r.get("date",""),"source_url":r.get("source_url","")})
  key=(y,se,p,r.get("date"),tuple(sorted((norm(r["team1"]),norm(r["team2"])))),tuple(sorted((str(r.get("score1")),str(r.get("score2"))))))
  keys[key].append(r)
 for k,rr in keys.items():
  if len(rr)>1:
   issues.append({"issue":"duplicate_game","year":k[0],"season":k[1],"prefecture":k[2],"file":";".join(sorted(set(v["_file"] for v in rr))),"detail":str(len(rr))+" records: "+"/".join(k[4]),"source_url":rr[0].get("source_url","")})
 summaries=[]
 for y in ("2025","2026"):
  for se in ("spring","summer","autumn"):
   for p in PREFS:
    rr=groups[(y,se,p)]
    dedup=set()
    for r in rr:
     dedup.add((r.get("date"),norm(r.get("team1")),norm(r.get("team2")),r.get("score1"),r.get("score2")))
    rounds=collections.Counter(ROUNDS.get(r.get("round"),r.get("round")) for r in rr)
    wrong=sum(1 for a in issues if a["issue"]=="wrong_prefecture_tournament" and (a["year"],a["season"],a["prefecture"])==(y,se,p))
    flags=[]
    if not rr:flags.append("no_rows")
    if rr and not rounds["F"]:flags.append("final_not_found")
    if rr and not rounds["1R"] and not rounds["2R"]:flags.append("early_round_not_found")
    if wrong:flags.append("wrong_prefecture_article")
    if len(rr)!=len(dedup):flags.append("duplicates_or_repeated_records")
    summaries.append({"year":y,"season":se,"prefecture":p,"rows":len(rr),"unique_rows":len(dedup),"final_rows":rounds["F"],"early_rows":rounds["1R"]+rounds["2R"],"wrong_pref_rows":wrong,"flags":";".join(flags)})
 def write(path,items,cols):
  with path.open("w",encoding="utf-8-sig",newline="") as f:
   w=csv.DictWriter(f,fieldnames=cols);w.writeheader();w.writerows(items)
 write(OUT/"audit_2025_2026_units.csv",summaries,list(summaries[0]))
 write(OUT/"audit_2025_2026_issues.csv",issues,["issue","year","season","prefecture","file","detail","source_url"])
 summary={"units":len(summaries),"rows_scanned":len(rows),"without_rows":sum(x["rows"]==0 for x in summaries),"flagged_units":sum(bool(x["flags"]) for x in summaries),"duplicates":sum(x["issue"]=="duplicate_game" for x in issues),"wrong_prefecture_rows":sum(x["issue"]=="wrong_prefecture_tournament" for x in issues),"caveats":"Heuristic only; article name checks can false-positive; 2026 autumn may be ongoing. Prefecture stages only approximate where level omitted. Do not auto-delete."}
 (OUT/"audit_2025_2026_summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(summary,ensure_ascii=False))
if __name__=="__main__":main()
