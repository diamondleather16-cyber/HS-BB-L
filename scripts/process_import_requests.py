from pathlib import Path
import csv, json, re
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

REQ=Path("master/import_requests.json")
AUDIT=Path("master/import_audit.json")
DOC_AUDIT=Path("docs/data/import_audit.json")
DATA_ROOT=Path("data/imported")

FIELDS=[
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]

def load_json(p, default):
    if not p.exists(): return default
    return json.loads(p.read_text(encoding="utf-8-sig"))

def save_json(p,obj):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def norm(s):
    return re.sub(r"\s+"," ",str(s or "")).strip()

def clean_team(s):
    s=norm(s)
    s=re.sub(r"^(?:○|●|勝|敗)\s*","",s)
    s=re.sub(r"\s*(?:○|●)$","",s)
    return s.strip(" |｜")

def parse_score(s):
    s=norm(s).replace("－","-").replace("―","-").replace("ー","-").replace("–","-")
    m=re.fullmatch(r"(\d{1,2})\s*[-:]\s*(\d{1,2})",s)
    return (int(m.group(1)),int(m.group(2))) if m else None

def infer_finish(innings, raw_line):
    n=int(innings or 9)
    if n<9:
        return n,"cold"
    if n>9:
        return n,"extra"
    return 9,"normal"

def koshien89_match_line(line):
    # Example:
    # 日本文理 9-1 長岡(7)
    # 上越 10-5 中越(10)
    # 村上・村上桜ヶ丘 names are preserved as-is.
    line=norm(line)
    if not line or "｜" in line or "=" in line:
        return None
    m=re.match(r"^(.+?)\s+(\d{1,2})\s*[-－―–]\s*(\d{1,2})\s+(.+?)\s*$",line)
    if not m:
        return None
    t1=clean_team(m.group(1))
    s1=int(m.group(2))
    s2=int(m.group(3))
    t2raw=clean_team(m.group(4))

    innings=9
    mi=re.search(r"\((\d{1,2})\)\s*$",t2raw)
    if mi:
        innings=int(mi.group(1))
        t2raw=re.sub(r"\((\d{1,2})\)\s*$","",t2raw).strip()

    if not t1 or not t2raw:
        return None
    innings,finish=infer_finish(innings,line)
    return {
        "team1":t1,"score1":s1,"team2":t2raw,"score2":s2,
        "innings":innings,"finish_type":finish,"raw":line
    }

def parse_koshien89(html, req):
    soup=BeautifulSoup(html,"html.parser")
    text=soup.get_text("\n",strip=True)
    year=int(req.get("year") or 0)
    current_round=""
    current_date=""
    rows=[]
    warnings=[]

    heading_pat=re.compile(r"^※\s*(.+?)\s*\((\d{1,2})/(\d{1,2})\)\s*$")
    for raw in text.splitlines():
        line=norm(raw)
        if not line:
            continue

        hm=heading_pat.match(line)
        if hm:
            current_round=hm.group(1).strip()
            month=int(hm.group(2)); day=int(hm.group(3))
            current_date=f"{year:04d}-{month:02d}-{day:02d}"
            continue

        # Stop once page leaves results body.
        if line.startswith("試合の見逃し配信") or line.startswith("コメント"):
            break

        m=koshien89_match_line(line)
        if not m:
            continue
        m["round"]=current_round
        m["date"]=current_date
        rows.append(m)

    # Deduplicate scoreboard lines or repeated content.
    dedup=[]
    seen=set()
    for m in rows:
        k=(m["date"],m["round"],m["team1"],m["score1"],m["team2"],m["score2"])
        rk=(m["date"],m["round"],m["team2"],m["score2"],m["team1"],m["score1"])
        if k in seen or rk in seen:
            continue
        seen.add(k); dedup.append(m)

    if not dedup:
        warnings.append("koshien89専用解析で試合を認識できませんでした。")
    if any(not x["round"] for x in dedup):
        warnings.append("一部試合で回戦見出しを取得できませんでした。")
    if any(not x["date"] for x in dedup):
        warnings.append("一部試合で日付見出しを取得できませんでした。")
    return dedup,warnings

def parse_html_tables(html):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if len(cells)<3: continue
            for i,c in enumerate(cells):
                sc=parse_score(c)
                if sc and i>0 and i<len(cells)-1:
                    t1=clean_team(cells[i-1]); t2=clean_team(cells[i+1])
                    if t1 and t2 and not t1.isdigit() and not t2.isdigit():
                        out.append({"team1":t1,"score1":sc[0],"team2":t2,"score2":sc[1],
                                    "innings":9,"finish_type":"normal","round":"","date":"",
                                    "raw":" | ".join(cells)})
                        break
    return out, soup.get_text("\n",strip=True)

def parse_text(text):
    out=[]
    pat=re.compile(r"^\s*(.{1,50}?)\s+(\d{1,2})\s*[-－―:]\s*(\d{1,2})\s+(.{1,50}?)\s*$")
    for line in text.splitlines():
        line=norm(line)
        m=pat.match(line)
        if not m: continue
        t1=clean_team(m.group(1)); t2=clean_team(m.group(4))
        innings=9
        mi=re.search(r"\((\d{1,2})\)$",t2)
        if mi:
            innings=int(mi.group(1)); t2=re.sub(r"\((\d{1,2})\)$","",t2).strip()
        innings,finish=infer_finish(innings,line)
        if t1 and t2:
            out.append({"team1":t1,"score1":int(m.group(2)),"team2":t2,"score2":int(m.group(3)),
                        "innings":innings,"finish_type":finish,"round":"","date":"","raw":line})
    return out

def dedupe(matches):
    seen=set(); out=[]
    for m in matches:
        k=(m.get("date",""),m.get("round",""),m["team1"],m["score1"],m["team2"],m["score2"])
        rk=(m.get("date",""),m.get("round",""),m["team2"],m["score2"],m["team1"],m["score1"])
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
        host=(urlparse(url).hostname or "").lower()
        if host.endswith("koshien89.com"):
            matches,warnings=parse_koshien89(r.text,req)
        else:
            table_matches,text=parse_html_tables(r.text)
            matches=table_matches or parse_text(text)
            if not matches:
                warnings.append("自動認識できる試合がありませんでした。別の結果ページURLを試してください。")
            elif len(matches)<4:
                warnings.append("認識試合数が少ないため、取りこぼしがないか必ず確認してください。")

    rows=[]
    for m in dedupe(matches):
        innings=int(m.get("innings") or 9)
        finish=str(m.get("finish_type") or "normal")
        finish_note=""
        if finish=="cold" and innings<9:
            finish_note=f";{innings}回コールド"
        elif finish=="extra" and innings>9:
            finish_note=f";延長{innings}回"

        # Keep innings/finish_type in the audit preview object, but write them
        # into note for the repository CSV. Existing merge.py uses the
        # established 14-column match schema and later scripts infer innings
        # from note.
        rows.append({
            "year":req.get("year",""),
            "season":req.get("season",""),
            "region":req.get("region",""),
            "prefecture":req.get("prefecture",""),
            "tournament":req.get("tournament",""),
            "round":m.get("round",""),
            "date":m.get("date",""),
            "team1":m["team1"],"score1":m["score1"],
            "team2":m["team2"],"score2":m["score2"],
            "innings":innings,
            "finish_type":finish,
            "source_url":url,
            "note":f"level={req.get('level','prefecture')}{finish_note}",
        })
    return rows,warnings

def merge_csv(path, rows):
    existing=[]
    if path.exists():
        with path.open("r",encoding="utf-8-sig",newline="") as f:
            existing=list(csv.DictReader(f))
    def key(r):
        return tuple(str(r.get(k,"")).strip() for k in [
            "year","season","date","tournament","round","team1","score1","team2","score2"
        ])
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

    audit["items"]=items[-100:]
    audit["updated_at"]=datetime.now(timezone.utc).isoformat()
    save_json(AUDIT,audit)
    save_json(DOC_AUDIT,audit)
    print(f"audit items={len(audit['items'])}")

if __name__=="__main__":
    main()
