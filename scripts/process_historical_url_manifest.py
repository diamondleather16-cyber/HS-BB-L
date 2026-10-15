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
    # Wikipedia uses "1x - 0" / "2× - 1" for walk-off wins.
    m=re.fullmatch(r"(\d{1,2})\s*[xX×]?\s*[-:]\s*(\d{1,2})",s)
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


def wikipedia_expected_match_count(soup, req):
    """Best-effort expected count from article text. Used only as a validation hint."""
    text=norm(soup.get_text(" ",strip=True))
    candidates=[]
    for m in re.finditer(r"(?:全|計)?\s*(\d{1,3})\s*試合",text):
        n=int(m.group(1))
        if 1 <= n <= 100:
            candidates.append(n)
    # For elimination tournaments, school count N implies N-1 games.
    for m in re.finditer(r"(?:出場|参加)(?:校|チーム)?\s*[:：]?\s*(\d{1,3})\s*校",text):
        n=int(m.group(1))
        if 2 <= n <= 100:
            candidates.append(n-1)
    return max(candidates) if candidates else None

def wiki_section_name(table):
    h=table.find_previous(["h2","h3","h4"])
    return norm(h.get_text(" ",strip=True)) if h else ""

def numeric_cell(s):
    s=norm(s)
    return int(s) if re.fullmatch(r"\d{1,2}",s) else None


def wiki_finish_note(remarks):
    s=norm(remarks)
    if not s:
        return ""
    m=re.search(r"延長\s*(\d{1,2})\s*回",s)
    if m:
        return f";延長{int(m.group(1))}回"
    m=re.search(r"(\d{1,2})\s*回(?:裏)?\s*(?:コールド|降雨コールド|日没コールド)",s)
    if m:
        return f";{int(m.group(1))}回コールド"
    m=re.search(r"(\d{1,2})\s*回コールド",s)
    if m:
        return f";{int(m.group(1))}回コールド"
    if "コールド" in s:
        return ";コールド"
    return ""

def parse_wikipedia_result_tables(html, req):
    """Parse the standard Japanese Wikipedia tournament result tables.

    Typical columns:
      試合日 | 試合順 | 勝利 | スコア | 敗戦 | 備考 | ...
    The date cell is omitted on subsequent games of the same day, so the last
    explicit date is carried forward. Round is taken from the enclosing h3/h4.
    """
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        rows=table.find_all("tr")
        if not rows:
            continue
        headers=[norm(x.get_text(" ",strip=True)) for x in rows[0].find_all(["th","td"])]
        if not headers:
            continue

        def idx_for(*names):
            for name in names:
                for i,h in enumerate(headers):
                    if name in h:
                        return i
            return None

        i_date=idx_for("試合日")
        i_win=idx_for("勝利","勝者")
        i_score=idx_for("スコア")
        i_lose=idx_for("敗戦","敗者")
        i_note=idx_for("備考")
        if i_win is None or i_score is None or i_lose is None:
            continue

        heading=table.find_previous(["h3","h4","h2"])
        round_name=detect_round(norm(heading.get_text(" ",strip=True)) if heading else "")
        current_date=""

        for tr in rows[1:]:
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if not cells:
                continue

            # MediaWiki rowspans can make later rows physically shorter.
            # For the standard result tables, infer whether the date cell is present
            # by checking whether the first cell looks like a date.
            has_date=bool(parse_date_text(cells[0],req.get("year"))) if cells else False
            if has_date:
                current_date=parse_date_text(cells[0],req.get("year"))

            # Build a logical row aligned to the header.
            if i_date is not None and not has_date and len(cells)==len(headers)-1:
                cells=cells[:i_date]+[""]+cells[i_date:]

            if max(i_win,i_score,i_lose) >= len(cells):
                continue

            win=clean_team(cells[i_win])
            lose=clean_team(cells[i_lose])
            sc=score_pair(cells[i_score])
            if not win or not lose or not sc:
                continue

            remarks=cells[i_note] if i_note is not None and i_note<len(cells) else ""
            row=row_from_match(req,win,sc[0],lose,sc[1],
                               raw=" | ".join(cells),
                               round_name=round_name,
                               date=current_date)
            extra=wiki_finish_note(remarks)
            if extra and extra not in row["note"]:
                row["note"] += extra
            out.append(row)
    return dedupe(out)

def parse_wikipedia_score_tables(html, req):
    """Parse Wikipedia inning/box-score tables.

    National-tournament articles commonly contain one table per game:
    team | 1 | 2 | ... | 9 | R/H/E or 計.
    We take the two team rows and the final run total.
    """
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        rows=table.find_all("tr")
        if len(rows)<3:
            continue
        matrix=[[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])] for tr in rows]
        matrix=[r for r in matrix if r]
        if len(matrix)<3:
            continue
        header=" | ".join(matrix[0])
        if not (re.search(r"(?:^|\|)\s*1\s*(?:\||$)",header) and re.search(r"(?:計|R|得点)",header,re.I)):
            continue

        # Locate total-runs column where possible.
        total_idx=None
        for i,c in enumerate(matrix[0]):
            cc=re.sub(r"\s+","",c)
            if cc in {"計","R","得点","合計"}:
                total_idx=i
                break

        teams=[]
        for r in matrix[1:]:
            if len(r)<2:
                continue
            team=clean_team(r[0])
            if not team or team in {"チーム","学校","高校","校名"}:
                continue
            score=None
            if total_idx is not None and total_idx < len(r):
                score=numeric_cell(r[total_idx])
            if score is None:
                nums=[numeric_cell(c) for c in r[1:]]
                nums=[x for x in nums if x is not None]
                # A box score usually ends with total runs/H/E. First value
                # after inning columns is the safest fallback.
                if len(nums)>=10:
                    score=nums[9]
                elif nums:
                    score=nums[-1]
            if score is not None:
                teams.append((team,score))
        if len(teams)>=2:
            # Some tables may contain headers/subtotals. Use the first two distinct teams.
            a=None;b=None
            for x in teams:
                if a is None:
                    a=x
                elif x[0]!=a[0]:
                    b=x;break
            if a and b:
                section=wiki_section_name(table)
                out.append(row_from_match(req,a[0],a[1],b[0],b[1],
                                          raw=section,round_name=detect_round(section),
                                          date=parse_date_text(section,req.get("year"))))
    return dedupe(out)

def parse_wikipedia_brackets(html, req):
    """Fallback for Wikipedia bracket tables.

    MediaWiki brackets often render each entrant as a school cell immediately
    followed by a numeric score cell. We collect those team-score atoms in DOM
    order inside the tournament result section and pair neighboring atoms.
    """
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for table in soup.find_all("table"):
        section=wiki_section_name(table)
        table_text=norm(table.get_text(" ",strip=True))
        if not re.search(r"(組み合わせ|試合結果|トーナメント|高校の部|決勝|準決勝)",section+" "+table_text):
            continue

        atoms=[]
        for tr in table.find_all("tr"):
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"],recursive=False)]
            if len(cells)<2:
                continue
            for i in range(len(cells)-1):
                team=clean_team(cells[i])
                score=numeric_cell(cells[i+1])
                if score is None or not team:
                    continue
                if re.fullmatch(r"\d+",team):
                    continue
                if team in {"1回戦","2回戦","3回戦","準々決勝","準決勝","決勝","計","R","H","E"}:
                    continue
                if len(team)>30:
                    continue
                atoms.append((team,score,detect_round(" ".join(cells)) or detect_round(section),
                              parse_date_text(" ".join(cells),req.get("year")) or parse_date_text(section,req.get("year"))))

        # Consecutive atoms representing the same match are usually adjacent.
        i=0
        while i+1<len(atoms):
            a,b=atoms[i],atoms[i+1]
            if a[0]!=b[0]:
                out.append(row_from_match(req,a[0],a[1],b[0],b[1],
                                          raw=section,round_name=a[2] or b[2],date=a[3] or b[3]))
                i+=2
            else:
                i+=1
    return dedupe(out)

def parse_wikipedia(html, req):
    soup=BeautifulSoup(html,"html.parser")
    exact=parse_wikipedia_result_tables(html,req)
    expected=wikipedia_expected_match_count(soup,req)

    # The standard "試合日 / 勝利 / スコア / 敗戦" tables are authoritative.
    # Do not mix bracket parsing into them because it can duplicate or mis-pair games.
    if exact:
        return dedupe(exact), expected

    # Older articles sometimes lack the standard result table.
    a=parse_wikipedia_score_tables(html,req)
    b=parse_wikipedia_brackets(html,req)
    return dedupe(a+b), expected

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
    wiki_expected=None
    is_wiki=("wikipedia.org" in host)
    if parser=="wikipedia" or (parser=="auto" and is_wiki):
        try:
            rows,wiki_expected=parse_wikipedia(html,req)
        except Exception:
            rows=[];wiki_expected=None
        attempts.append(("wikipedia",lambda _html,_req, rows=rows: rows))
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
        except Exception:
            rows=[]
        if len(rows)>len(best):
            best=rows; used=name
    if not best:
        return [],f"自動解析不可 parser={parser}"
    warn=f"parser={used}"
    if wiki_expected:
        warn += f" / Wikipedia期待試合数={wiki_expected} / 抽出={len(best)}"
        if len(best)!=wiki_expected:
            warn += " / 件数不一致・承認前に確認"
    elif len(best)<4:
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
