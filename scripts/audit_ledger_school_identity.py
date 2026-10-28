#!/usr/bin/env python3
"""Read-only geographic and school-master identity audit of authoritative ledger."""
import csv,json,re,unicodedata
from pathlib import Path
from collections import Counter,defaultdict
from datetime import datetime,timezone
MASTER=Path("master/school_master_shared.json")
SOURCES=[Path("output/all_matches.csv"),Path("docs/data/historical_ledger_2017_2024.csv")]
OUT=Path("docs/data/ledger_school_identity_audit.csv")
SUMMARY=Path("docs/data/ledger_school_identity_audit_summary.json")
GROUPS={
"北海道":"北海道","青森":"東北","岩手":"東北","宮城":"東北","秋田":"東北","山形":"東北","福島":"東北",
"茨城":"関東・東京","栃木":"関東・東京","群馬":"関東・東京","埼玉":"関東・東京","千葉":"関東・東京","東京":"関東・東京","神奈川":"関東・東京","山梨":"関東・東京",
"新潟":"北信越","富山":"北信越","石川":"北信越","福井":"北信越","長野":"北信越",
"静岡":"東海","愛知":"東海","岐阜":"東海","三重":"東海",
"滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
"鳥取":"中国","島根":"中国","岡山":"中国","広島":"中国","山口":"中国",
"徳島":"四国","香川":"四国","愛媛":"四国","高知":"四国",
"福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州","宮崎":"九州","鹿児島":"九州","沖縄":"九州"}
GROUPS.update({"東東京":"関東・東京","西東京":"関東・東京","北北海道":"北海道","南北海道":"北海道"})
REGION={"kanto_tokyo":"関東・東京","kanto":"関東・東京","tokyo":"関東・東京","hokkaido":"北海道","tohoku":"東北","hokushinetsu":"北信越","tokai":"東海","kinki":"近畿","chugoku":"中国","shikoku":"四国","kyushu":"九州","national":"全国"}
REGION.update({v:v for v in GROUPS.values()})
def norm(s):
 return re.sub(r"[\s　・･]+","",unicodedata.normalize("NFKC",str(s or ""))).strip()
def pref(s):
 s=norm(s).replace("東京都","東京").replace("北海道","北海道")
 if s in ("東東京","西東京"):return "東京"
 if s in ("北北海道","南北海道"):return "北海道"
 return s
def level(r):
 m=re.search(r"(?:^|;)\s*level=([^;]+)",str(r.get("note") or ""))
 return (m.group(1).strip() if m else "") or str(r.get("level") or "").strip()
def read(path):
 if not path.exists():return []
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def main():
 master=json.loads(MASTER.read_text(encoding="utf-8-sig"))
 byid={str(r.get("school_id") or "").strip():r for r in master.get("schools",[]) if r.get("school_id")}
 byname=defaultdict(set)
 for sid,rec in byid.items():
  for n in [rec.get("canonical_name"),*(rec.get("aliases") or [])]:
   if norm(n):byname[norm(n)].add(sid)
 fields=["classification","severity","source","match_id","year","season","region","prefecture","level","tournament","round","date","side","school","school_id","master_school","master_prefecture","expected_prefecture","expected_region","details"]
 findings=[];counts=Counter();seen=set();scanned=0
 unionnames={norm(u.get("display_name")) for u in master.get("unions",[]) if isinstance(u,dict)}
 for path in SOURCES:
  for r in read(path):
   if not r.get("tournament"):continue
   scanned+=1
   lev=level(r)
   expected=pref(r.get("prefecture"))
   reg=REGION.get(norm(r.get("region")),norm(r.get("region")))
   base=[r.get("year"),r.get("season"),r.get("tournament"),r.get("round"),r.get("date"),r.get("team1"),r.get("score1"),r.get("team2"),r.get("score2")]
   for side in ("team1","team2"):
    school=str(r.get(side) or "").strip()
    sid=str(r.get(side+"_school_id") or "").strip()
    if str(r.get(side+"_type") or "").lower()=="union" or r.get(side+"_union_id") or norm(school) in unionnames:continue
    rec=byid.get(sid) if sid else None
    candidates=byname.get(norm(school),set())
    issues=[]
    if sid and not rec:issues.append(("unknown_school_id","high","ID absent from school master"))
    if not sid:
     if len(candidates)==0:issues.append(("unlinked_school","review","No school ID and no exact master-name candidate"))
     elif len(candidates)>1:issues.append(("ambiguous_same_name","review","Multiple master entries share school name"))
     else:issues.append(("missing_school_id","review","One candidate by name, but no ID linked"))
    if rec and norm(school) not in {norm(rec.get("canonical_name")),*[norm(x) for x in rec.get("aliases",[])]}:
     issues.append(("id_name_mismatch","high","Linked ID name differs from match name; possible same-name mix-up"))
    mp=pref(rec.get("prefecture")) if rec else ""
    if rec and mp:
     if lev in ("prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage") and expected and mp!=expected:
      issues.append(("outside_prefecture","high","Master prefecture is different from match prefecture"))
     if lev=="regional" and reg in GROUPS.values() and GROUPS.get(mp) and GROUPS[mp]!=reg:
      issues.append(("outside_region","high","Master prefecture falls outside tournament region"))
    if not rec and len(candidates)==1:
     m=byid.get(next(iter(candidates)));mp2=pref(m.get("prefecture")) if m else ""
     if lev in ("prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage") and expected and mp2 and mp2!=expected:
      issues.append(("possible_same_name_other_pref","review","Name-only candidate belongs to a different prefecture"))
    for kind,severity,detail in issues:
     key=tuple(base)+(side,kind)
     if key in seen:continue
     seen.add(key);counts[kind]+=1
     findings.append(dict(zip(fields,[kind,severity,str(path),r.get("match_id",""),r.get("year",""),r.get("season",""),r.get("region",""),r.get("prefecture",""),lev,r.get("tournament",""),r.get("round",""),r.get("date",""),side,school,sid,rec.get("canonical_name","") if rec else "",mp,expected,reg,detail])))
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open("w",encoding="utf-8-sig",newline="") as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(findings)
 SUMMARY.write_text(json.dumps({"generated_at":datetime.now(timezone.utc).isoformat(),"scanned_matches":scanned,"findings":len(findings),"by_type":dict(counts),"note":"Read-only audit; union entries excluded. High=direct linked ID conflict, review=unlinked or ambiguous candidate. No automatic school-link changes."},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("IDENTITY_AUDIT",scanned,len(findings),dict(counts))
if __name__=="__main__":main()
