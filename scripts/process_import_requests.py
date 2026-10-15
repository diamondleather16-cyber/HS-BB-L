from pathlib import Path
import argparse
import csv, json, re
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

REQ=Path("master/import_requests.json")
REQ_DIR=Path("master/import_queue")
AUDIT=Path("master/import_audit.json")
DOC_AUDIT=Path("docs/data/import_audit.json")
DATA_ROOT=Path("data/imported")
MATCH_EDITS=Path("master/match_edits_shared.json")

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
    s=norm(s).replace("－","-").replace("―","-").replace("ー","-").replace("–","-").replace("—","-")
    m=re.fullmatch(r"(\d{1,2})\s*[xX×]?\s*[-:]\s*(\d{1,2})",s)
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


def parse_date_text(text, year):
    s=norm(text)
    m=re.search(r"(?:(\d{4})[./年-])?\s*(\d{1,2})[./月-]\s*(\d{1,2})日?",s)
    if not m:
        return ""
    y=int(m.group(1) or year or 0)
    return f"{y:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if y else ""

def detect_round(text):
    s=norm(text)
    for x in ["3位決定戦","３位決定戦","準々決勝","準決勝","決勝",
              "1回戦","１回戦","2回戦","２回戦","3回戦","３回戦","4回戦","４回戦",
              "5回戦","５回戦","R16","QF","SF"]:
        if x.lower() in s.lower():
            return x
    return ""

def wiki_finish(remarks):
    s=norm(remarks)
    m=re.search(r"延長\s*(\d{1,2})\s*回",s)
    if m:
        n=int(m.group(1)); return n,"extra"
    m=re.search(r"(\d{1,2})\s*回(?:裏)?\s*(?:コールド|降雨コールド|日没コールド)",s)
    if m:
        n=int(m.group(1)); return n,"cold"
    m=re.search(r"(\d{1,2})\s*回コールド",s)
    if m:
        n=int(m.group(1)); return n,"cold"
    return 9,"normal"

def wikipedia_expected_match_count(soup, req):
    text=norm(soup.get_text(" ",strip=True))
    vals=[]
    for m in re.finditer(r"(?:全|計)?\s*(\d{1,3})\s*試合",text):
        n=int(m.group(1))
        if 1<=n<=100: vals.append(n)
    if vals:
        # tournament summary typically contains the largest relevant count
        return max(vals)
    for m in re.finditer(r"(?:出場校|出場)\s*[:：]?\s*(\d{1,3})\s*校",text):
        n=int(m.group(1))
        if 2<=n<=100: vals.append(n-1)
    return max(vals) if vals else None

def _wiki_table_placements(table):
    """Return cell placements with expanded row/column coordinates."""
    occupied={}
    placements=[]
    max_col=0
    for r,tr in enumerate(table.find_all("tr")):
        c=0
        cells=tr.find_all(["th","td"],recursive=False)
        for cell in cells:
            while occupied.get((r,c)):
                c+=1
            text=norm(cell.get_text(" ",strip=True))
            try: rs=max(1,int(cell.get("rowspan",1) or 1))
            except Exception: rs=1
            try: cs=max(1,int(cell.get("colspan",1) or 1))
            except Exception: cs=1
            placements.append({"r":r,"c":c,"rs":rs,"cs":cs,"text":text})
            for rr in range(r,r+rs):
                for cc in range(c,c+cs):
                    occupied[(rr,cc)]=True
            c+=cs
            max_col=max(max_col,c)
    return placements,max_col

def _wiki_score_token(s):
    s=norm(s)
    m=re.fullmatch(r"(\d{1,2})\s*[xX×]?",s)
    return int(m.group(1)) if m else None

def _wiki_team_token(s):
    s=clean_team(s)
    if not s or len(s)>32:
        return ""
    if _wiki_score_token(s) is not None:
        return ""
    if parse_date_text(s,2000):
        return ""
    if detect_round(s):
        return ""
    bad={"","R","H","E","計","得点","合計","学校","チーム","勝利","敗戦","勝者","敗者","スコア"}
    if s in bad:
        return ""
    if re.fullmatch(r"[\d\s()（）:：./年月日時分-]+",s):
        return ""
    return s

def _wiki_bracket_matches(table, req):
    """Read MediaWiki bracket tables by round columns.

    Unlike summer result tables, many Senbatsu articles store all pre-final
    games only in a bracket.  We reconstruct each round by pairing the
    vertically ordered team/score atoms inside each round column.
    """
    placements,max_col=_wiki_table_placements(table)
    if not placements:
        return []

    round_names=["1回戦","１回戦","2回戦","２回戦","3回戦","３回戦",
                 "4回戦","４回戦","準々決勝","準決勝"]
    headers=[]
    for p in placements:
        txt=norm(p["text"])
        rr=""
        for cand in round_names:
            if txt==cand:
                rr=detect_round(txt)
                break
        if rr:
            headers.append({**p,"round":rr})
    # Bracket tables normally expose at least 2 round headers.
    if len(headers)<2:
        return []

    # Prefer the top header row that contains the most round names.
    by_row={}
    for h in headers:
        by_row.setdefault(h["r"],[]).append(h)
    header_row=max(by_row, key=lambda r: len(by_row[r]))
    hs=sorted(by_row[header_row], key=lambda x:x["c"])
    if len(hs)<2:
        return []

    year=int(req.get("year") or 0)
    out=[]

    for i,h in enumerate(hs):
        seg_start=h["c"]
        seg_end=(hs[i+1]["c"] if i+1<len(hs) else max_col)
        # Keep only cells below the selected header and in this round segment.
        seg=[p for p in placements if p["r"]>header_row and seg_start<=p["c"]<seg_end]

        # Gather date/remarks cells for this round.
        dates=[]
        for p in seg:
            d=parse_date_text(p["text"],year)
            if d:
                innings,finish=wiki_finish(p["text"])
                dates.append((p["r"],d,innings,finish,p["text"]))

        # Team/score atoms: a team cell and a numeric score cell on the same row.
        by_r={}
        for p in seg:
            by_r.setdefault(p["r"],[]).append(p)
        atoms=[]
        for r,cells in sorted(by_r.items()):
            cells=sorted(cells,key=lambda x:x["c"])
            for a in cells:
                team=_wiki_team_token(a["text"])
                if not team:
                    continue
                # Score is normally the next cell to the right, but allow a small gap
                # caused by connector/spacer columns.
                candidates=[]
                for b in cells:
                    if b["c"]<=a["c"] or b["c"]>a["c"]+3:
                        continue
                    sc=_wiki_score_token(b["text"])
                    if sc is not None:
                        candidates.append((b["c"],sc))
                if candidates:
                    candidates.sort()
                    atoms.append((r,a["c"],team,candidates[0][1]))
                    break

        # Remove immediate duplicate atoms created by row/col spans.
        cleaned=[]
        for atom in atoms:
            if cleaned and atom[2:]==cleaned[-1][2:]:
                continue
            cleaned.append(atom)
        atoms=cleaned

        # Every game contributes two vertically ordered team-score atoms.
        # Ignore a trailing unpaired atom rather than inventing a game.
        for j in range(0,len(atoms)-1,2):
            a,b=atoms[j],atoms[j+1]
            if a[2]==b[2]:
                continue
            mid=(a[0]+b[0])/2
            date=""
            innings=9
            finish="normal"
            raw=""
            if dates:
                dr, date, innings, finish, raw=min(dates,key=lambda x:abs(x[0]-mid))
            out.append({
                "team1":a[2],"score1":a[3],
                "team2":b[2],"score2":b[3],
                "innings":innings,"finish_type":finish,
                "round":h["round"],"date":date,
                "raw":raw or f"{h['round']} bracket"
            })
    return dedupe(out)


def _wiki_table_in_scope(table, req):
    """Limit Meiji Jingu parsing to the high-school division.

    Jingu Wikipedia articles contain both 高校の部 and 大学の部 in the same page.
    Other national tournaments do not need this section filter.
    """
    season=str(req.get("season") or "").strip().lower()
    tournament=str(req.get("tournament") or "")
    if season!="jingu" and "神宮" not in tournament:
        return True

    h2=table.find_previous("h2")
    if h2 is None:
        return False
    section=norm(h2.get_text(" ",strip=True))
    if "高校" in section:
        return True
    if "大学" in section:
        return False

    # Some older pages nest the division one level deeper.
    h3=table.find_previous("h3")
    if h3 is not None:
        s3=norm(h3.get_text(" ",strip=True))
        if "高校" in s3:
            return True
        if "大学" in s3:
            return False
    return False

def parse_wikipedia_tournament(html, req):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    warnings=[]
    year=int(req.get("year") or 0)

    # A) Standard result tables, used by many Summer Koshien articles.
    for table in soup.find_all("table"):
        if not _wiki_table_in_scope(table,req):
            continue
        trs=table.find_all("tr")
        if not trs: continue
        headers=[norm(x.get_text(" ",strip=True)) for x in trs[0].find_all(["th","td"])]
        if not headers: continue

        def find_idx(*names):
            for nm in names:
                for i,h in enumerate(headers):
                    if nm in h: return i
            return None

        i_date=find_idx("試合日")
        i_win=find_idx("勝利","勝者")
        i_score=find_idx("スコア")
        i_lose=find_idx("敗戦","敗者")
        i_note=find_idx("備考")
        if i_win is None or i_score is None or i_lose is None:
            continue

        heading=table.find_previous(["h3","h4","h2"])
        round_name=detect_round(norm(heading.get_text(" ",strip=True)) if heading else "")
        current_date=""

        for tr in trs[1:]:
            cells=[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if not cells: continue
            d=parse_date_text(cells[0],year)
            if d: current_date=d
            if i_date is not None and not d and len(cells)==len(headers)-1:
                cells=cells[:i_date]+[""]+cells[i_date:]
            if max(i_win,i_score,i_lose)>=len(cells):
                continue
            sc=parse_score(cells[i_score])
            if not sc:
                continue
            win=clean_team(cells[i_win]); lose=clean_team(cells[i_lose])
            if not win or not lose:
                continue
            remarks=cells[i_note] if i_note is not None and i_note<len(cells) else ""
            innings,finish=wiki_finish(remarks)
            out.append({
                "team1":win,"score1":sc[0],"team2":lose,"score2":sc[1],
                "innings":innings,"finish_type":finish,
                "round":round_name,"date":current_date,
                "raw":" | ".join(cells)
            })

    # B) Senbatsu and some older Summer articles use only a bracket for
    #    1R-through-SF.  Parse it even when a standard table also exists;
    #    dedupe() below removes overlaps.
    for table in soup.find_all("table"):
        if not _wiki_table_in_scope(table,req):
            continue
        heading=table.find_previous(["h3","h4","h2"])
        heading_text=norm(heading.get_text(" ",strip=True)) if heading else ""
        if "組み合わせ" in heading_text or "準決勝" in heading_text or "1回戦" in heading_text or "１回戦" in heading_text:
            out.extend(_wiki_bracket_matches(table,req))
        else:
            # Some bracket templates are headed simply "1回戦 - 準決勝".
            txt=norm(table.get_text(" ",strip=True))[:300]
            if ("1回戦" in txt or "１回戦" in txt) and "準決勝" in txt:
                out.extend(_wiki_bracket_matches(table,req))

    # C) Final is frequently a separate inning-by-inning box score.
    for table in soup.find_all("table"):
        if not _wiki_table_in_scope(table,req):
            continue
        heading=table.find_previous(["h3","h4","h2"])
        heading_text=norm(heading.get_text(" ",strip=True)) if heading else ""
        if detect_round(heading_text)!="決勝":
            continue
        matrix=[[norm(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])] for tr in table.find_all("tr")]
        matrix=[r for r in matrix if r]
        if len(matrix)<3: continue
        hdr=matrix[0]
        total_idx=None
        inning_cols=[]
        for i,c in enumerate(hdr):
            cc=re.sub(r"\s+","",c)
            if re.fullmatch(r"\d{1,2}",cc):
                inning_cols.append(int(cc))
            if cc in {"R","計","得点","合計"} and total_idx is None:
                total_idx=i
        if total_idx is None: continue
        teams=[]
        for r in matrix[1:]:
            if total_idx>=len(r): continue
            team=clean_team(r[0])
            sval=re.sub(r"[xX×]","",r[total_idx])
            try: score=int(sval)
            except Exception: continue
            if team: teams.append((team,score))
        if len(teams)>=2:
            prev=table.find_previous(string=re.compile(r"\d{1,2}月\d{1,2}日"))
            date=parse_date_text(prev,year) if prev else ""
            inn=max(inning_cols) if inning_cols else 9
            finish="extra" if inn>9 else "normal"
            out.append({
                "team1":teams[0][0],"score1":teams[0][1],
                "team2":teams[1][0],"score2":teams[1][1],
                "innings":inn,"finish_type":finish,
                "round":"決勝","date":date,"raw":"決勝イニング表"
            })

    out=dedupe(out)
    expected=wikipedia_expected_match_count(soup,req)
    if expected is not None:
        warnings.append(f"Wikipedia期待試合数={expected} / 抽出={len(out)}")
        if len(out)!=expected:
            warnings.append("Wikipedia記載の試合数と抽出数が一致しません。登録前に確認してください。")
    if any(not m.get("date") for m in out):
        warnings.append("一部試合で日付を取得できませんでした。")
    if any(not m.get("round") for m in out):
        warnings.append("一部試合で回戦を取得できませんでした。")
    return out,warnings

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
    r=requests.get(url,timeout=(5,12),headers={"User-Agent":"Mozilla/5.0 HS-BB-L importer"})
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
        elif host.endswith("wikipedia.org"):
            matches,warnings=parse_wikipedia_tournament(r.text,req)
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

def normalize_approved_rows(rows, level_default="prefecture"):
    out=[]
    for src in rows:
        r=dict(src)
        try:
            innings=int(float(r.get("innings") or 9))
        except Exception:
            innings=9
        innings=max(1,min(30,innings))
        finish=str(r.get("finish_type") or "normal").strip().lower()
        if finish not in {"normal","cold","extra"}:
            finish="normal"
        if finish=="normal":
            innings=9
        elif finish=="extra" and innings<=9:
            innings=10
        elif finish=="cold" and innings>=9:
            innings=7

        # Remove any old finish annotation while preserving other note items.
        note_parts=[]
        for p in str(r.get("note") or "").split(";"):
            p=p.strip()
            if not p:
                continue
            if re.fullmatch(r"\d{1,2}回コールド",p):
                continue
            if re.fullmatch(r"延長\d{1,2}回",p):
                continue
            note_parts.append(p)
        if not any(p.startswith("level=") for p in note_parts):
            note_parts.insert(0,f"level={level_default}")
        if finish=="cold":
            note_parts.append(f"{innings}回コールド")
        elif finish=="extra":
            note_parts.append(f"延長{innings}回")

        r["innings"]=innings
        r["finish_type"]=finish
        r["note"]=";".join(note_parts)
        out.append(r)
    return out

def edit_key(r):
    vals=[r.get("year",""),r.get("season",""),r.get("date",""),r.get("tournament",""),r.get("round",""),
          r.get("team1",""),r.get("score1",""),r.get("team2",""),r.get("score2","")]
    return "¦".join(str(v).strip() for v in vals)

def pair_key(r):
    teams=sorted([str(r.get("team1","")).strip(),str(r.get("team2","")).strip()])
    return (str(r.get("year","")).strip(),str(r.get("season","")).strip(),str(r.get("tournament","")).strip(),*teams)

def migrate_match_edit_keys(old_rows,new_rows):
    if not MATCH_EDITS.exists(): return 0
    try: state=load_json(MATCH_EDITS,{})
    except Exception: return 0
    old_by={}
    new_by={}
    for r in old_rows: old_by.setdefault(pair_key(r),[]).append(r)
    for r in new_rows: new_by.setdefault(pair_key(r),[]).append(r)
    mapping={}
    for k,olds in old_by.items():
        news=new_by.get(k,[])
        if len(olds)==1 and len(news)==1:
            ok,nk=edit_key(olds[0]),edit_key(news[0])
            if ok!=nk: mapping[ok]=nk
    if not mapping:return 0
    changed=0
    for field in ("overrides","team_links","deleted_matches"):
        for x in state.get(field,[]) or []:
            old=str(x.get("edit_key") or "")
            if old in mapping:
                x["edit_key"]=mapping[old];changed+=1
    if changed:
        state["updated_at"]=datetime.now(timezone.utc).isoformat()
        save_json(MATCH_EDITS,state)
    return changed

def merge_csv(path, rows, mode="append", tournament=""):
    existing=[]
    if path.exists():
        with path.open("r",encoding="utf-8-sig",newline="") as f:
            existing=list(csv.DictReader(f))

    def key(r):
        return tuple(str(r.get(k,"")).strip() for k in [
            "year","season","date","tournament","round","team1","score1","team2","score2"
        ])

    removed=[]
    if mode=="replace" and tournament:
        keep=[]
        for r in existing:
            if str(r.get("tournament","")).strip()==str(tournament).strip():
                removed.append(r)
            else:
                keep.append(r)
        existing=keep

    seen={key(r) for r in existing}
    added=0
    for r in rows:
        if key(r) not in seen:
            existing.append(r);seen.add(key(r));added+=1

    migrated=migrate_match_edit_keys(removed,rows) if removed else 0
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS,extrasaction="ignore")
        w.writeheader();w.writerows(existing)
    return added,len(removed),migrated


def parse_iso_time(v):
    s=str(v or "").strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z","+00:00"))
    except Exception:
        return None

def request_is_new(req, cutoff):
    """Migration-safe filter.

    Older versions kept 200 requests but only 100 audit items. That caused the
    missing older half to be re-analysed on every run. Requests older than the
    previous audit timestamp are legacy/already-handled and must not be replayed.
    """
    if cutoff is None:
        return True
    created=parse_iso_time(req.get("created_at"))
    if created is None:
        return False
    return created > cutoff


def load_requests_all():
    out=[]
    # Legacy shared queue remains readable for backward compatibility.
    try:
        out.extend((load_json(REQ,{"requests":[]}).get("requests",[]) or []))
    except Exception as e:
        print(f"warning: legacy request queue load failed: {e}")

    if REQ_DIR.exists():
        for path in sorted(REQ_DIR.glob("*.json")):
            try:
                obj=load_json(path,{})
                if isinstance(obj,dict) and obj.get("request_id"):
                    out.append(obj)
            except Exception as e:
                print(f"warning: request file load failed {path}: {e}")

    # Deduplicate by request_id, keeping the later occurrence.
    by_id={}
    order=[]
    for req in out:
        rid=str(req.get("request_id") or "").strip()
        if not rid:
            continue
        if rid not in by_id:
            order.append(rid)
        by_id[rid]=req
    return [by_id[rid] for rid in order]

def main(mode="auto"):
    reqs=load_requests_all()
    audit=load_json(AUDIT,{"version":1,"items":[]})
    items=audit.setdefault("items",[])

    # Request IDs are the only durable processed/not-processed authority.
    # V21/V22 used audit.updated_at as a moving cutoff. If another import run
    # updated audit after a request was created but before its workflow started,
    # that perfectly valid new request could be skipped forever.
    handled=set(str(x) for x in (audit.get("handled_request_ids") or []) if str(x))
    handled.update(str(x.get("request_id")) for x in items if x.get("request_id"))
    byid={str(x.get("request_id")):x for x in items if x.get("request_id")}

    # One-time migration only: if handled_request_ids did not exist in the old
    # audit format, seed it from requests that are older than/equal to that old
    # audit snapshot. After this run, timestamps are never used for eligibility.
    migrated_legacy=0
    if "handled_request_ids" not in audit:
        legacy_cutoff=parse_iso_time(audit.get("updated_at"))
        if legacy_cutoff is not None:
            for req in reqs:
                rid=str(req.get("request_id") or "")
                created=parse_iso_time(req.get("created_at"))
                if rid and created is not None and created <= legacy_cutoff:
                    handled.add(rid)
                    migrated_legacy+=1

    processed=0

    def want(action):
        return mode=="auto" or mode==action

    # Analyze every unhandled request ID. No moving timestamp cutoff.
    if want("analyze"):
        for req in reqs:
            if req.get("action")!="analyze":
                continue
            rid=str(req.get("request_id") or "")
            if not rid or rid in handled:
                continue
            try:
                matches,warnings=analyze(req)
                item={**req,"status":"review","processed_at":datetime.now(timezone.utc).isoformat(),
                      "matches":matches,"warnings":warnings}
            except Exception as e:
                item={**req,"status":"error","processed_at":datetime.now(timezone.utc).isoformat(),
                      "matches":[],"warnings":[f"取得/解析エラー: {e}"]}
            items.append(item)
            byid[rid]=item
            handled.add(rid)
            processed+=1

    # Approval also uses request ID only.
    if want("approve"):
        completed_targets=set()
        for req in reqs:
            if req.get("action")!="approve":
                continue
            approval_id=str(req.get("request_id") or "")
            if not approval_id or approval_id in handled:
                continue

            target=str(req.get("target_request_id") or "")
            if not target or target in completed_targets:
                handled.add(approval_id)
                continue

            item=byid.get(target)
            if not item:
                err_item={
                    "request_id":approval_id,
                    "action":"approve","target_request_id":target,"status":"error",
                    "processed_at":datetime.now(timezone.utc).isoformat(),"matches":[],
                    "warnings":[f"登録元の解析結果が見つかりません: {target}"]
                }
                items.append(err_item)
                handled.add(approval_id)
                processed+=1
                continue

            if item.get("status")=="completed":
                handled.add(approval_id)
                completed_targets.add(target)
                continue

            rows=req.get("edited_matches") or item.get("matches") or []
            rows=normalize_approved_rows(rows,item.get("level") or "prefecture")
            if req.get("edited_matches"):
                item["matches"]=rows
                item["edited_before_approval"]=True

            if not rows:
                item.setdefault("warnings",[]).append("登録対象試合が0件のため登録しませんでした。")
                item["status"]="error"
                item["processed_at"]=datetime.now(timezone.utc).isoformat()
                handled.add(approval_id)
                processed+=1
                continue

            year=str(item.get("year",""))
            season=str(item.get("season",""))
            level=str(item.get("level") or "prefecture")
            pref=str(item.get("prefecture","")).replace("/","_")
            region=str(item.get("region","")).replace("/","_")
            unit=pref if pref else (region if region else ("全国" if level=="national" else "上位大会"))
            path=DATA_ROOT/year/season/f"{unit}.csv"
            import_mode=str(req.get("import_mode") or item.get("import_mode") or "replace")
            added,removed,migrated=merge_csv(
                path,rows,mode=import_mode,tournament=str(item.get("tournament") or "")
            )
            item.update({
                "status":"completed",
                "approved_at":datetime.now(timezone.utc).isoformat(),
                "data_file":str(path),
                "added_matches":added,
                "removed_matches":removed,
                "migrated_match_edits":migrated,
                "import_mode":import_mode
            })
            handled.add(approval_id)
            completed_targets.add(target)
            processed+=1

    if processed==0 and migrated_legacy==0:
        print(f"no-op mode={mode}")
        return 0

    audit["version"]=2
    audit["items"]=items[-240:]
    audit["handled_request_ids"]=list(handled)[-500:]
    audit["updated_at"]=datetime.now(timezone.utc).isoformat()
    audit["last_run_processed"]=processed
    audit["last_run_migrated_legacy"]=migrated_legacy
    audit["last_run_mode"]=mode
    save_json(AUDIT,audit)
    save_json(DOC_AUDIT,audit)
    print(
        f"mode={mode} items={len(audit['items'])} "
        f"processed={processed} migrated_legacy={migrated_legacy}"
    )
    return processed

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--mode",choices=["auto","analyze","approve"],default="auto")
    args=ap.parse_args()
    main(args.mode)
