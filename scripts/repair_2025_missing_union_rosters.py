#!/usr/bin/env python3
"""Repair eight user-confirmed 2025 union rosters on GitHub's authoritative master.

Resolve only exact same-prefecture canonical names/aliases. Create distinct
school records for explicit user-named schools genuinely missing in that
prefecture. Never guess ambiguous IDs; abort instead. Idempotent on reruns.
"""
import csv
import json
import hashlib
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path("master/school_master_shared.json")
REPORT=Path("output/repair_2025_union_rosters_report.json")
# (prefecture, season, tournament, union label, explicitly confirmed schools)
SPECS=[
 ("和歌山","autumn","秋季和歌山大会 2025 日程・結果","笠田・紀北農芸",["笠田","紀北農芸"]),
 ("大阪","summer","選手権大阪大会 2025 日程・結果","堺上・和泉総合",["堺上","和泉総合"]),
 ("千葉","summer","選手権千葉大会 2025 日程・結果","旭農業・県銚子",["旭農","銚子"]),
 ("埼玉","summer","選手権埼玉大会 2025 日程・結果","越生・小川・日高",["越生","小川","日高"]),
 ("神奈川","summer","選手権神奈川大会 2025 日程・結果","大和東・相模向陽館",["大和東","相模向陽館"]),
 ("大阪","summer","選手権大阪大会 2025 日程・結果","茨木工科・福井・北摂つばさ・箕面東",["茨木工科","福井","北摂つばさ","箕面東"]),
 ("神奈川","summer","選手権神奈川大会 2025 日程・結果","田奈・釜利谷・永谷・横浜明朋・三浦初声・横須賀南・海洋科学",["田奈","釜利谷","永谷","横浜明朋","三浦初声","横須賀南","海洋科学"]),
 ("神奈川","summer","選手権神奈川大会 2025 日程・結果","麻生総合・高津・横浜旭陵",["麻生総合","高津","横浜旭陵"]),
]
REGIONS={"和歌山":("近畿","06","30","kinki"),"大阪":("近畿","06","27","kinki"),
 "千葉":("関東・東京","03","12","kanto_tokyo"),"埼玉":("関東・東京","03","13","kanto_tokyo"),
 "神奈川":("関東・東京","03","14","kanto_tokyo")}
# The user's names are authoritative. A historic/variant label is a lookup
# candidate, not permission to conflate two distinct schools.
LOOKUPS={
 ("千葉","旭農"):["旭農","旭農業"],
 ("千葉","銚子"):["銚子","県銚子"],
}
def norm(x):
 return re.sub(r"[\s　・･()（）]", "",str(x or "")).casefold()
def identity(s):
 return str(s.get("school_id") or "").strip()
def find_candidates(schools,pref,name):
 forms={norm(x) for x in LOOKUPS.get((pref,name),[name])}
 found=[]
 for row in schools:
  if str(row.get("prefecture") or "").strip()!=pref:continue
  if row.get("kind")=="union" or row.get("status")=="merged":continue
  labels=[row.get("canonical_name"),*(row.get("aliases") or [])]
  if any(norm(label) in forms for label in labels if label):
   found.append(row)
 return list({identity(x):x for x in found if identity(x)}.values())
def new_id(name,pref,used):
 region,rc,pc,_=REGIONS[pref]
 # Stable FNV1a code point hash, consistent with web app for BMP characters.
 h=2166136261
 for ch in name:
  cp=ord(ch)
  if cp>0xffff:
   cp-=0x10000
   units=[0xd800+(cp>>10),0xdc00+(cp&1023)]
  else:units=[cp]
  for n in units:
   h=((h^n)*16777619)&0xffffffff
 base=f"{rc}{pc}00{h&0xffff:04X}"
 if base not in used:return base
 for counter in range(1,100000):
  proposed=f"{rc}{pc}00{hashlib.sha1((name+'#'+str(counter)).encode()).hexdigest()[:4].upper()}"
  if proposed not in used:return proposed
 raise RuntimeError("ID exhaustion")
def main():
 if not ROOT.exists():raise SystemExit("Shared master missing")
 state=json.loads(ROOT.read_text(encoding="utf-8-sig"))
 schools=state["schools"]
 unions=state.setdefault("unions",[])
 used={identity(s) for s in schools}
 report={"when":datetime.now(timezone.utc).isoformat(),"rosters":[],"created_schools":[],"conflicts":[]}
 planned=[]
 for pref,season,tournament,label,names in SPECS:
  entries=[]
  for name in names:
   candidates=find_candidates(schools,pref,name)
   if len(candidates)>1:
    report["conflicts"].append({"prefecture":pref,"name":name,
     "candidates":[{"school_id":identity(x),"name":x.get("canonical_name")} for x in candidates]})
    continue
   if candidates:
    school=candidates[0]
    entries.append({"school_id":identity(school),"school_name":school["canonical_name"],"lookup":name,"source":"existing"})
   else:
    # Do not create a second local copy when there is already a provisional
    # school with this exact name but different status or missing province.
    questionable=[x for x in schools if norm(x.get("canonical_name"))==norm(name)
                  and (not x.get("prefecture") or x.get("prefecture")==pref)]
    if questionable:
     report["conflicts"].append({"prefecture":pref,"name":name,"reason":"inactive or invalid existing record",
       "candidates":[{"school_id":identity(x),"name":x.get("canonical_name"),"status":x.get("status")} for x in questionable]})
     continue
    sid=new_id(name,pref,used)
    used.add(sid)
    region,rc,pc,_=REGIONS[pref]
    school={"school_id":sid,"canonical_name":name,"furigana":"",
       "district":region,"prefecture":pref,"local_district":"",
       "local_district_id":"","representative_area":pref,
       "representative_area_id":"","aliases":[name],"kind":"school",
       "status":"active","established_year":"","closed_year":"","successor_id":""}
    schools.append(school)
    report["created_schools"].append({"prefecture":pref,"name":name,"school_id":sid})
    entries.append({"school_id":sid,"school_name":name,"lookup":name,"source":"created"})
  planned.append((pref,season,tournament,label,names,entries))
 if report["conflicts"]:
  REPORT.parent.mkdir(parents=True,exist_ok=True)
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
  print("AMBIGUOUS_SCHOOLS",json.dumps(report["conflicts"],ensure_ascii=False),flush=True)
  raise SystemExit("Aborted ambiguous identity resolution; master not written")
 for pref,season,tournament,label,names,entries in planned:
  if len(entries)!=len(names):raise AssertionError(label)
  existing=[u for u in unions if str(u.get("year"))=="2025"
    and u.get("season")==season and u.get("prefecture")==pref
    and u.get("display_name")==label]
  if len(existing)>1:
   report["conflicts"].append({"union":label,"reason":"duplicate year/season/pref/label","ids":[u.get("union_id") for u in existing]})
   continue
  if existing:row=existing[0]
  else:
   uidprefix=f"U2025-{'AU' if season=='autumn' else 'SU'}-{pref}-"
   nums=[int(str(u.get("union_id","")).removeprefix(uidprefix)) for u in unions
         if str(u.get("union_id","")).startswith(uidprefix) and str(u.get("union_id","")).removeprefix(uidprefix).isdigit()]
   uid=uidprefix+str(max(nums,default=0)+1).zfill(3)
   row={"union_id":uid}
   unions.append(row)
  row.update({"year":2025,"season":season,"prefecture":pref,
     "region":REGIONS[pref][3],"tournament":tournament,"display_name":label,
     "status":"active","updated_at":datetime.now(timezone.utc).isoformat(),
     "members":[{"school_id":e["school_id"],"school_name":e["school_name"],
                 "weight":1/len(entries)} for e in entries]})
  report["rosters"].append({"union_id":row["union_id"],"prefecture":pref,
       "label":label,"members":entries,"count":len(entries)})
 if report["conflicts"]:
  REPORT.parent.mkdir(parents=True,exist_ok=True)
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
  print("AMBIGUOUS_UNIONS",json.dumps(report["conflicts"],ensure_ascii=False),flush=True)
  raise SystemExit("Aborted ambiguous unions; master not written")
 assert len(report["rosters"])==8
 ROOT.write_text(json.dumps(state,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
 for u in report["rosters"]:
  print("CONFIRMED_ROSTER",json.dumps(u,ensure_ascii=False),flush=True)
 print(f"REPAIRED_UNION_ROSTERS 8 new_schools={len(report['created_schools'])}",flush=True)
if __name__=="__main__":main()
