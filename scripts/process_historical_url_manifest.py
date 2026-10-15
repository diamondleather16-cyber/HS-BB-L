#!/usr/bin/env python3
from __future__ import annotations

import csv, re, sys
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

MANIFEST=Path("master/historical_url_manifest.csv")
PREVIEW=Path("output/historical_url_matches.csv")
REPORT=Path("output/historical_url_report.csv")
DATA_ROOT=Path("data/historical_compat/url_imported")

MATCH_FIELDS=[
    "year","season","region","prefecture","tournament","round","date",
    "team1","score1","team2","score2","source_url","note"
]
REPORT_FIELDS=[
    "enabled","approved","year","season","region","prefecture","tournament",
    "level","source_url","parser","status","match_count","warning"
]

def read_csv(path):
    if not path.exists():
        return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

def norm(v):
    return re.sub(r"\s+"," ",str(v or "")).strip()

def enabled(v):
    return str(v or "1").strip().lower() not in {"0","false","off","no","無効"}

def approved(v):
    return str(v or "").strip().lower() in {"1","true","on","yes","承認"}

def clean_team(v):
    s=norm(v)
    s=re.sub(r"^(?:○|●|勝|敗)\s*","",s)
    s=re.sub(r"\s*(?:○|●)$","",s)
    s=re.sub(r"^\d{1,2}:\d{2}\s*","",s)
    return s.strip(" |｜")

def score_pair(v):
    s=norm(v).translate(str.maketrans("－―ー–—：","------"))
    m=re.fullmatch(r"(\d{1,2})\s*[-:]\s*(\d{1,2})",s)
    return (int(m.group(1)),int(m.group(2))) if m else None

def parse_date_text(text, year):
    s=norm(text)
    m=re.search(r"(?:(\d{4})[./年-])?\s*(\d{1,2})[./月-]\s*(\d{1,2})日?",s)
    if not m:
        return ""
    y=int(m.group(1) or year or 0)
    if not y:
        return ""
    return f"{y:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

ROUND_WORDS=[
    "決勝","準決勝","準々決勝","3位決定戦","３位決定戦","代表決定戦",
    "1回戦","１回戦","2回戦","２回戦","3回戦","３回戦","4回戦","４回戦",
    "5回戦","５回戦","1R","2R","3R","4R","R16","QF","SF"
]
def detect_round(text):
    s=norm(text)
    for x in ROUND_WORDS:
        if x.lower() in s.lower():
            return x
    return ""

def finish_note(raw):
    s=norm(raw)
    m=re.search(r"(?:\(|（)(\d{1,2})(?:\)|）)\s*$",s)
    if not m:
        return "",s
    inn=int(m.group(1))
    clean=re.sub(r"(?:\(|（)\d{1,2}(?:\)|）)\s*$","",s).strip()
    if 5<=inn<=8:
        return f";{inn}回コールド",clean
    if inn>=10:
        return f";延長{inn}回",clean
    return "",clean

def row_from_match(req, team1, s1, team2, s2, raw="", round_name="", date=""):
    fnote,team2=finish_note(team2)
    level=req.get("level") or ("national" if req.get("season") in {"senbatsu","koshien","jingu"} else "regional")
    return {
        "year":req.get("year",""),
        "season":req.get("season",""),
        "region":req.get("region",""),
        "prefecture":req.get("prefecture",""),
        "tournament":req.get("tournament",""),
        "round":round_name or detect_round(raw),
        "date":date or parse_date_text(raw,req.get("year")),
        "team1":clean_team(team1),
        "score1":int(s1),
        "team2":clean_team(team2),
        "score2":int(s2),
        "source_url":req.get("source_url",""),
        "note":f"level={level}{fnote}",
    }

def parse_koshien89(html, req):
    soup=BeautifulSoup(html,"html.parser")
    current_round=""
    current_date=""
    out=[]
    hp=re.compile(r"^※\s*(.+?)\s*\((\d{1,2})/(\d{1,2})\)\s*$")
    mp=re.compile(r"^(.+?)\s+(\d{1,2})\s*[-－―–]\s*(\d{1,2})\s+(.+?)\s*$")
    for raw in soup.get_text("\n",strip=True).splitlines():
        line=norm(raw)
        hm=hp.match(line)
        if hm:
            current_round=hm.group(1).strip()
            current_date=f"{int(req['year']):04d}-{int(hm.group(2)):02d}-{int(hm.group(3)):02d}"
            continue
        m=mp.match(line)
        if m:
            out.append(row_from_match(req,m.group(1),m.group(2),m.group(4),m.group(3),
                                      raw=line,round_name=current_round,date=current_date))
    return out

def parse_tables(html, req):
    """Recognize several common old-result table layouts."""
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        context=norm((table.find_previous(["h1","h2","h3","h4","strong","b"]) or "").get_text(" ",strip=True) if table.find_previous(["h1","h2","h3","h4","strong","b"]) else "")
        round_ctx=detect_round(context)
        date_ctx=parse_date_text(context,req.get("year"))
        for tr in table.find_all("tr"):
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if len(cells)<3:
                continue
            joined=" | ".join(cells)
            round_name=detect_round(joined) or round_ctx
            date=parse_date_text(joined,req.get("year")) or date_ctx

            # A | 5-3 | B
            found=False
            for i,c in enumerate(cells):
                sc=score_pair(c)
                if sc and i>0 and i<len(cells)-1:
                    t1=clean_team(cells[i-1]); t2=clean_team(cells[i+1])
                    if t1 and t2 and not t1.isdigit() and not t2.isdigit():
                        out.append(row_from_match(req,t1,sc[0],t2,sc[1],joined,round_name,date))
                        found=True
                        break
            if found:
                continue

            # A | 5 | 3 | B
            for i in range(len(cells)-3):
                a,b,c,d=cells[i:i+4]
                if a and d and re.fullmatch(r"\d{1,2}",b) and re.fullmatch(r"\d{1,2}",c):
                    if not a.isdigit() and not d.isdigit():
                        out.append(row_from_match(req,a,int(b),d,int(c),joined,round_name,date))
                        found=True
                        break
            if found:
                continue

            # A 5 - 3 B spread over five cells
            for i in range(len(cells)-4):
                a,b,sep,c,d=cells[i:i+5]
                if a and d and re.fullmatch(r"\d{1,2}",b) and re.fullmatch(r"\d{1,2}",c) and sep in {"-","－","―",":"}:
                    out.append(row_from_match(req,a,int(b),d,int(c),joined,round_name,date))
                    break
    return out

def parse_text(html, req):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    # conservative line parser; avoids matching ordinary prose.
    pat=re.compile(r"^\s*(.{1,40}?)\s+(\d{1,2})\s*[-－―–:]\s*(\d{1,2})\s+(.{1,40}?)\s*$")
    current_round=""
    current_date=""
    for raw in soup.get_text("\n",strip=True).splitlines():
        line=norm(raw)
        rr=detect_round(line)
        if rr and len(line)<=30:
            current_round=rr
        dd=parse_date_text(line,req.get("year"))
        if dd and len(line)<=40:
            current_date=dd
        m=pat.match(line)
        if m:
            out.append(row_from_match(req,m.group(1),m.group(2),m.group(4),m.group(3),
                                      line,current_round,current_date))
    return out

def dedupe(rows):
    seen=set(); out=[]
    for r in rows:
        a=(r["date"],r["round"],r["team1"],str(r["score1"]),r["team2"],str(r["score2"]))
        b=(r["date"],r["round"],r["team2"],str(r["score2"]),r["team1"],str(r["score1"]))
        if a in seen or b in seen:
            continue
        seen.add(a); out.append(r)
    return out

def fetch_and_parse(req):
    url=req.get("source_url","").strip()
    if not url:
        return [],"URL未入力"
    try:
        res=requests.get(url,timeout=(6,18),headers={"User-Agent":"Mozilla/5.0 HS-BB-L historical importer"})
        res.raise_for_status()
    except Exception as e:
        return [],f"取得失敗: {e}"
    ctype=(res.headers.get("content-type") or "").lower()
    if "pdf" in ctype or url.lower().endswith(".pdf"):
        return [],"PDFはV49では自動解析対象外"
    res.encoding=res.apparent_encoding or res.encoding
    html=res.text
    parser=(req.get("parser") or "auto").strip().lower()
    host=(urlparse(url).hostname or "").lower()

    attempts=[]
    if parser=="koshien89" or (parser=="auto" and host.endswith("koshien89.com")):
        attempts.append(("koshien89",parse_koshien89))
    if parser in {"auto","table","generic"}:
        attempts.append(("table",parse_tables))
    if parser in {"auto","text","generic"}:
        attempts.append(("text",parse_text))

    best=[]; used=""
    for name,fn in attempts:
        try:
            rows=dedupe(fn(html,req))
        except Exception as e:
            rows=[]
        if len(rows)>len(best):
            best=rows; used=name
    if not best:
        return [],f"自動解析不可 parser={parser}"
    warn=f"parser={used}"
    if len(best)<4:
        warn += " / 認識数が少ないため要確認"
    return best,warn

def safe_name(v):
    s=re.sub(r'[\\/:*?"<>|]+',"_",str(v or "").strip())
    return s[:80] or "unknown"

def write_approved_group(req, rows):
    year=safe_name(req.get("year"))
    season=safe_name(req.get("season"))
    region=safe_name(req.get("region") or req.get("prefecture") or "national")
    tournament=safe_name(req.get("tournament"))
    path=DATA_ROOT/year/season/f"{region}_{tournament}.csv"
    write_csv(path,MATCH_FIELDS,rows)
    return path

def main():
    reqs=read_csv(MANIFEST)
    if not reqs:
        raise SystemExit(f"{MANIFEST} がありません、または空です")

    preview=[]
    report=[]
    ok=partial=failed=0

    for req in reqs:
        if not enabled(req.get("enabled")):
            continue
        rows,warn=fetch_and_parse(req)
        preview.extend(rows)
        if rows:
            status="ok" if len(rows)>=4 else "partial"
            ok += status=="ok"
            partial += status=="partial"
            if approved(req.get("approved")):
                path=write_approved_group(req,rows)
                warn=(warn+" / " if warn else "")+f"承認済→{path.as_posix()}"
        else:
            status="failed"; failed+=1

        report.append({
            **{k:req.get(k,"") for k in REPORT_FIELDS},
            "status":status,
            "match_count":len(rows),
            "warning":warn,
        })
        print(f"[{status:7}] {req.get('year')} {req.get('tournament')} : {len(rows)} {warn}")

    preview=dedupe(preview)
    write_csv(PREVIEW,MATCH_FIELDS,preview)
    write_csv(REPORT,REPORT_FIELDS,report)
    print(f"\nHistorical URL batch complete: {len(preview)} matches / ok={ok} partial={partial} failed={failed}")
    print(f"preview: {PREVIEW}")
    print(f"report : {REPORT}")

if __name__=="__main__":
    main()
