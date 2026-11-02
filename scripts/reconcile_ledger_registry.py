#!/usr/bin/env python3
"""Audit and restore missing previously published matches from a persistent registry."""
import csv,io,json,re,subprocess
from pathlib import Path
from collections import defaultdict,Counter
ROOT=Path("docs/data")
REG=ROOT/"ledger_registry.csv"
OUT=Path("output/all_matches.csv")
BASE="9c86efb37720a4b0ca0f28e57628a4d5fe684d4d"
def parse(s):return list(csv.DictReader(io.StringIO(s.lstrip("\ufeff"))))
def read(p):return parse(p.read_text(encoding="utf-8-sig")) if p.exists() else []
def sig(r):
 def norm(x):return re.sub(r"\s+","",str(x or ""))
 def sc(x):
  try:return str(int(float(x)))
  except:return str(x or "")
 return (str(r.get("year") or ""),str(r.get("season") or ""),tuple(sorted(((norm(r.get("team1")),sc(r.get("score1"))),(norm(r.get("team2")),sc(r.get("score2")))))))
def valid(r):return bool(r.get("year") and r.get("tournament") and r.get("team1") and r.get("team2"))
def main():
 live=read(OUT)
 archive=read(REG)
 archive+=sum((read(p) for p in (ROOT/"ledger_shards").glob("20??/*.csv")),[])
 paths=subprocess.check_output(["git","ls-tree","-r","--name-only",BASE,"docs/data/ledger_shards"],text=True).splitlines()
 for p in paths:
  if re.search(r"/20\d\d/[^/]+\.csv$",p):
   archive+=parse(subprocess.check_output(["git","show",BASE+":"+p]).decode("utf-8-sig"))
 state=json.loads(Path("master/match_edits_shared.json").read_text(encoding="utf-8-sig"))
 deleted={sig(o.get("snapshot") or {}) for o in state.get("authority_ops",[]) if o.get("action")=="DELETE"}
 known=defaultdict(list)
 for r in live:
  if valid(r):known[sig(r)].append(r)
 restored=[];seen=set()
 for r in archive:
  if not valid(r) or sig(r) in deleted:continue
  key=(sig(r),r.get("tournament"))
  if key in seen:continue
  seen.add(key)
  if any(x.get("tournament")==r.get("tournament") or (x.get("date") and x.get("date")==r.get("date") and x.get("prefecture")==r.get("prefecture")) for x in known[sig(r)]):continue
  restored.append(r);known[sig(r)].append(r)
 combined=live+restored
 fields=list(dict.fromkeys(k for r in combined for k in r))
 for p in (OUT,REG):
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open("w",encoding="utf-8-sig",newline="") as f:
   w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");w.writeheader();w.writerows(combined)
 report={"baseline":BASE,"before":len(live),"archive":len(archive),"restored":len(restored),"after":len(combined),"by_year":dict(Counter(str(r.get("year")) for r in restored))}
 p=Path("output/audit/ledger_registry_reconciliation.json");p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print("LEDGER_REGISTRY",json.dumps(report,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
