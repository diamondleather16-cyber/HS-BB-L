from pathlib import Path
import csv, json, re, sys, hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

REQ=Path("master/import_requests.json")
AUDIT=Path("master/import_audit.json")
DOC_AUDIT=Path("docs/data/import_audit.json")
DATA_ROOT=Path("data/imported")

FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]

def load_json(p, default):
    if not p.exists(): return default
    return json.loads(p.read_text(encoding="utf-8-sig"))

def save_json(p,obj):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def norm(s):
    return re.sub(r"\s+"," ",str(s or "")).strip()

def parse_score(s):
    s=norm(s).replace("－","-").replace("―","-").replace("ー","-").replace("–","-")
    m=re.fullmatch(r"(\d{1,2})\s*[-:]\s*(\d{1,2})",s)
    return (int(m.group(1)),int(m.group(2))) if m else None

def clean_team(s):
    s=norm(s)
    s=re.sub(r"^(?:○|●|勝|敗)\s*","",s)
    s=re.sub(r"\s*(?:○|●)$","",s)
    return s.strip(" |｜")

def parse_html_tables(html):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if len(cells)<3: continue
            # Pattern A: team, score, team
            for i,c in enumerate(cells):
                sc=parse_score(c)
                if sc and i>0 and i<len(cells)-1:
                    t1=clean_team(cells[i-1]); t2=clean_team(cells[i+1])
                    if t1 and t2 and not t1.isdigit() and not t2.isdigit():
                        out.append({"team1":t1,"score1":sc[0],"team2":t2,"score2":sc[1],"raw":" | ".join(cells)})
                        break
            else:
                # Pattern B: team, score1, score2, team
                for i in range(len(cells)-3):
                    if cells[i+1].isdigit() and cells[i+2].isdigit():
                        t1=clean_team(cells[i]); t2=clean_team(cells[i+3])
                        if t1 and t2:
                            out.append({"team1":t1,"score1":int(cells[i+1]),"team2":t2,"score2":int(cells[i+2]),"raw":" | ".join(cells)})
                            break
    return out, soup.get_text("\n",strip=True)

def parse_text(text):
    out=[]
    # Conservative line parser. Avoid inventing games.
    pat=re.compile(r"^\s*(.{1,28}?)\s+(\d{1,2})\s*[-－―:]\s*(\d{1,2})\s+(.{1,28}?)\s*$")
    for line in text.splitlines():
        line=norm(line)
        m=pat.match(line)
        if not m: continue
        t1=clean_team(m.group(1)); t2=clean_team(m.group(4))
        if not t1 or not t2: continue
        out.append({"team1":t1,"score1":int(m.group(2)),"team2":t2,"score2":int(m.group(3)),"raw":line})
    return out

def dedupe(matches):
    seen=set(); out=[]
    for m in matches:
        k=(m["team1"],m["score1"],m["team2"],m["score2"])
        rk=(m["team2"],m["score2"],m["team1"],m["score1"])
        if k in seen or rk in seen: continue
        seen.add(k); out.append(m)
    return out

def analyze(req):
    url=req["source_url"]
    r=requests.get(url,timeout=30,headers={"User-Agent":"Mozilla/5.0 HS-BB-L importer"})
    r.raise_for_status()
    ctype=(r.headers.get("content-type") or "").lower()
    warnings=[]
    matches=[]
    if "pdf" in ctype or url.lower().endswith(".pdf"):
        warnings.append("PDFはv1では自動解析対象外です。HTML結果ページURLを使用してください。")
    else:
        r.encoding=r.apparent_encoding or r.encoding
        table_matches,text=parse_html_tables(r.text)
        matches=table_matches or parse_text(text)
        if not matches:
            warnings.append("自動認識できる試合がありませんでした。別の結果ページURLを試してください。")
        elif len(matches)<4:
            warnings.append("認識試合数が少ないため、取りこぼしがないか必ず確認してください。")

    rows=[]
    for m in dedupe(matches):
        rows.append({
            "year":req.get("year",""),
            "season":req.get("season",""),
            "region":req.get("region",""),
            "prefecture":req.get("prefecture",""),
            "tournament":req.get("tournament",""),
            "round":"",
            "date":"",
            "team1":m["team1"],"score1":m["score1"],
            "team2":m["team2"],"score2":m["score2"],
            "source_url":url,
            "note":f"level={req.get('level','prefecture')}",
        })
    return rows,warnings

def merge_csv(path, rows):
    existing=[]
    if path.exists():
        with path.open("r",encoding="utf-8-sig",newline="") as f:
            existing=list(csv.DictReader(f))
    def key(r):
        return tuple(str(r.get(k,"")).strip() for k in ["year","season","date","tournament","round","team1","score1","team2","score2"])
    seen={key(r) for r in existing}
    added=0
    for r in rows:
        if key(r) not in seen:
            existing.append(r); seen.add(key(r)); added+=1
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS,extrasaction="ignore")
        w.writeheader(); w.writerows(existing)
    return added

def main():
    reqs=load_json(REQ,{"requests":[]}).get("requests",[])
    audit=load_json(AUDIT,{"version":1,"items":[]})
    items=audit.setdefault("items",[])
    byid={x.get("request_id"):x for x in items if x.get("request_id")}

    # Handle all unseen analyze requests, oldest first.
    for req in reqs:
        if req.get("action")!="analyze": continue
        rid=req.get("request_id")
        if not rid or rid in byid: continue
        try:
            matches,warnings=analyze(req)
            item={**req,"status":"review","processed_at":datetime.now(timezone.utc).isoformat(),
                  "matches":matches,"warnings":warnings}
        except Exception as e:
            item={**req,"status":"error","processed_at":datetime.now(timezone.utc).isoformat(),
                  "matches":[],"warnings":[f"取得/解析エラー: {e}"]}
        items.append(item); byid[rid]=item

    # Handle approvals.
    completed=set()
    for req in reqs:
        if req.get("action")!="approve": continue
        target=req.get("target_request_id")
        if not target or target in completed: continue
        item=byid.get(target)
        if not item or item.get("status")=="completed": continue
        rows=item.get("matches") or []
        if not rows:
            item.setdefault("warnings",[]).append("登録対象試合が0件のため登録しませんでした。")
            continue
        year=str(item.get("year",""))
        season=str(item.get("season",""))
        pref=str(item.get("prefecture","")).replace("/","_")
        path=DATA_ROOT/year/season/f"{pref}.csv"
        added=merge_csv(path,rows)
        item["status"]="completed"
        item["approved_at"]=datetime.now(timezone.utc).isoformat()
        item["data_file"]=str(path)
        item["added_matches"]=added
        completed.add(target)

    # keep recent 100
    audit["items"]=items[-100:]
    audit["updated_at"]=datetime.now(timezone.utc).isoformat()
    save_json(AUDIT,audit)
    save_json(DOC_AUDIT,audit)
    print(f"audit items={len(audit['items'])}")

if __name__=="__main__":
    main()
