from pathlib import Path
import argparse
import csv, json, re
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

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


PREF_TO_REGION={
    "北海道":"北海道","北北海道":"北海道","南北海道":"北海道",
    "青森":"東北","岩手":"東北","秋田":"東北","山形":"東北","宮城":"東北","福島":"東北",
    "茨城":"関東","栃木":"関東","群馬":"関東","埼玉":"関東","千葉":"関東","神奈川":"関東","山梨":"関東",
    "東京":"東京","東東京":"東京","西東京":"東京",
    "新潟":"北信越","長野":"北信越","富山":"北信越","石川":"北信越","福井":"北信越",
    "静岡":"東海","愛知":"東海","岐阜":"東海","三重":"東海",
    "滋賀":"近畿","京都":"近畿","大阪":"近畿","兵庫":"近畿","奈良":"近畿","和歌山":"近畿",
    "岡山":"中国","広島":"中国","鳥取":"中国","島根":"中国","山口":"中国",
    "香川":"四国","徳島":"四国","愛媛":"四国","高知":"四国",
    "福岡":"九州","佐賀":"九州","長崎":"九州","熊本":"九州","大分":"九州","宮崎":"九州","鹿児島":"九州","沖縄":"九州",
}
PREF_SCAN_ORDER=sorted(PREF_TO_REGION,key=len,reverse=True)
REGIONS=["北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州"]

def standardized_tournament_name(year,season,level,prefecture,region):
    y=str(year or "").strip()
    if not y:
        return ""
    if level=="national":
        return {"senbatsu":f"選抜{y}","koshien":f"選手権{y}","jingu":f"神宮{y}"}.get(season,f"全国{y}")
    if level=="regional":
        if season=="spring": return f"春季{region}{y}"
        if season=="autumn": return f"秋季{region}{y}"
        return f"{region}{y}"
    if season=="spring": return f"春季{region}{prefecture}{y}"
    if season=="summer": return f"選手権{prefecture}{y}"
    if season=="autumn": return f"秋季{region}{prefecture}{y}"
    return f"{prefecture}{y}"

def infer_request_metadata(req, html, url):
    """Fill batch-import metadata from page title/text, keeping explicit values as fallback."""
    if not req.get("batch_auto_metadata"):
        return req
    soup=BeautifulSoup(html,"html.parser")
    title=norm(soup.title.get_text(" ",strip=True) if soup.title else "")
    h1=norm(soup.find("h1").get_text(" ",strip=True) if soup.find("h1") else "")
    head=f"{title} {h1}"
    text=norm(soup.get_text(" ",strip=True)[:8000])
    probe=f"{head} {text}"

    # Year: prefer title/header, then body, then form default.
    m=re.search(r"(20\d{2})\s*年?",head) or re.search(r"(20\d{2})\s*年?",probe)
    if m:
        req["year"]=int(m.group(1))

    season=str(req.get("season") or "")
    # Tournament classification must primarily use title/H1. Body text often
    # contains navigation links such as "明治神宮" and caused every page to be
    # misclassified as Jingu.
    if "明治神宮" in head or re.search(r"(^|\s)神宮($|\s)",head):
        season="jingu"
    elif "選抜" in head or "センバツ" in head:
        season="senbatsu"
    elif "全国高等学校野球選手権" in head or "全国高校野球選手権" in head:
        season="koshien"
    elif "秋季" in head:
        season="autumn"
    elif "春季" in head:
        season="spring"
    elif "夏季" in head or "選手権" in head:
        season="summer"
    if season:
        req["season"]=season

    pref=""
    for cand in PREF_SCAN_ORDER:
        if cand in head:
            pref=cand; break
    if not pref:
        for cand in PREF_SCAN_ORDER:
            if cand in probe:
                pref=cand; break

    region=""
    for cand in REGIONS:
        if cand in head:
            region=cand; break

    # National names take priority.
    if season in {"senbatsu","koshien","jingu"}:
        req["level"]="national"
        req["region"]="全国"
        req["prefecture"]=""
    elif pref:
        req["level"]="prefecture"
        req["prefecture"]=pref
        req["region"]=PREF_TO_REGION.get(pref,region or req.get("region",""))
    elif region:
        req["level"]="regional"
        req["region"]=region
        req["prefecture"]=""

    if not req.get("tournament") or req.get("batch_auto_metadata"):
        t=standardized_tournament_name(
            req.get("year"),req.get("season"),req.get("level","prefecture"),
            req.get("prefecture",""),req.get("region","")
        )
        if t:
            req["tournament"]=t
    req["detected_title"]=title or h1
    return req

def discover_result_urls(source_url, limit=120, year_from=None, year_to=None, seasons=None, follow_pagination=True):
    """Expand a list/category URL into tournament result articles.

    koshien89 category pages are paginated (blog-category-N.html,
    blog-category-N-1.html, ...).  Crawl same-category pagination pages and
    collect article links, optionally filtering by year and season from the
    article-link title.  Other sites keep the previous single-page behavior.
    """
    host=(urlparse(source_url).hostname or "").lower()
    seasons=set(seasons or [])
    try: y_from=int(year_from) if str(year_from or "").strip() else None
    except Exception: y_from=None
    try: y_to=int(year_to) if str(year_to or "").strip() else None
    except Exception: y_to=None

    def title_meta(label):
        text=norm(label)
        ym=re.search(r"(?:19|20)\d{2}",text)
        year=int(ym.group(0)) if ym else None
        season=None
        if "秋季" in text: season="autumn"
        elif "春季" in text: season="spring"
        elif "選手権" in text or "夏季" in text: season="summer"
        elif "選抜" in text or "センバツ" in text: season="senbatsu"
        elif "神宮" in text: season="jingu"
        return year,season

    def allowed(label):
        y,s=title_meta(label)
        if (y_from is not None or y_to is not None) and y is None: return False
        if y_from is not None and y < y_from: return False
        if y_to is not None and y > y_to: return False
        if seasons and s is None: return False
        if seasons and s not in seasons: return False
        return True

    pages=[source_url]
    page_seen=set()
    urls=[]; url_seen=set()
    category_match=re.search(r"/blog-category-(\d+)(?:-\d+)?\.html",urlparse(source_url).path)
    category_id=category_match.group(1) if category_match else ""

    while pages and len(page_seen)<40 and len(urls)<limit:
        page=pages.pop(0)
        if page in page_seen: continue
        page_seen.add(page)
        try:
            r=requests.get(page,timeout=(5,15),headers={"User-Agent":"Mozilla/5.0 HS-BB-L importer"})
            # Numbered FC2 category pages eventually end in 404. That is the
            # normal pagination terminator, not an error for the whole import.
            if r.status_code in {404,410} and page != source_url:
                break
            r.raise_for_status()
        except requests.RequestException:
            if page != source_url:
                break
            raise
        r.encoding=r.apparent_encoding or r.encoding
        soup=BeautifulSoup(r.text,"html.parser")
        for a in soup.find_all("a",href=True):
            u=urljoin(page,a.get("href")); pu=urlparse(u)
            if pu.scheme not in {"http","https"}: continue
            h=(pu.hostname or "").lower()
            label=norm(a.get_text(" ",strip=True))
            clean=u.split("#",1)[0]
            if host.endswith("koshien89.com"):
                if not h.endswith("koshien89.com"): continue
                if "/blog-entry-" in pu.path:
                    if clean not in url_seen and allowed(label):
                        url_seen.add(clean); urls.append(clean)
                        if len(urls)>=limit: break
                    continue
                if follow_pagination and category_id:
                    m=re.search(rf"/blog-category-{re.escape(category_id)}(?:-\d+)?\.html",pu.path)
                    if m and clean not in page_seen and clean not in pages:
                        pages.append(clean)
                continue
            elif host.endswith("wikipedia.org"):
                if h.endswith("wikipedia.org") and "/wiki/" in pu.path and clean not in url_seen:
                    url_seen.add(clean); urls.append(clean)
            else:
                if h==host and clean not in url_seen:
                    url_seen.add(clean); urls.append(clean)
            if len(urls)>=limit: break

        # Safety net for FC2 category pages where only adjacent pagination is
        # rendered: probe numbered pages sequentially until two empty pages.
        if host.endswith("koshien89.com") and follow_pagination and category_id and not pages and len(page_seen)<40:
            base=f"{urlparse(source_url).scheme}://{urlparse(source_url).netloc}/blog-category-{category_id}"
            existing_numbers=[]
            for q in page_seen:
                mm=re.search(rf"blog-category-{re.escape(category_id)}-(\d+)\.html",q)
                if mm: existing_numbers.append(int(mm.group(1)))
            nxt=(max(existing_numbers)+1) if existing_numbers else 1
            candidate=f"{base}-{nxt}.html"
            if candidate not in page_seen:
                pages.append(candidate)

    return urls[:limit], len(page_seen)

def analyze_many(children, max_workers=4):
    results=[]
    def one(child):
        try:
            matches,warnings=analyze(child)
            return {**child,"status":"review","processed_at":datetime.now(timezone.utc).isoformat(),
                    "matches":matches,"warnings":warnings}
        except Exception as e:
            return {**child,"status":"error","processed_at":datetime.now(timezone.utc).isoformat(),
                    "matches":[],"warnings":[f"取得/解析エラー: {e}"]}
    with ThreadPoolExecutor(max_workers=max(1,min(4,int(max_workers or 4)))) as ex:
        futs={ex.submit(one,c):i for i,c in enumerate(children)}
        tmp={}
        for fut in as_completed(futs):
            tmp[futs[fut]]=fut.result()
    for i in range(len(children)):
        results.append(tmp[i])
    return results

def analyze(req):
    url=req["source_url"]
    r=requests.get(url,timeout=(5,12),headers={"User-Agent":"Mozilla/5.0 HS-BB-L importer"})
    r.raise_for_status()
    ctype=(r.headers.get("content-type") or "").lower()
    warnings=[]
    matches=[]

    if "pdf" not in ctype and not url.lower().endswith(".pdf"):
        r.encoding=r.apparent_encoding or r.encoding
        infer_request_metadata(req,r.text,url)

    if "pdf" in ctype or url.lower().endswith(".pdf"):
        warnings.append("PDFはv1では自動解析対象外です。HTML結果ページURLを使用してください。")
    else:
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

    # Analyze every unhandled request ID. Batch requests are expanded and
    # fetched with at most four concurrent HTTP workers.
    if want("analyze"):
        # Ordinary analyze requests can also run in parallel in groups of 4.
        pending=[]
        for req in reqs:
            if req.get("action")!="analyze":
                continue
            rid=str(req.get("request_id") or "")
            if rid and rid not in handled:
                pending.append(req)
        if pending:
            for item in analyze_many(pending,4):
                rid=str(item.get("request_id") or "")
                items.append(item); byid[rid]=item; handled.add(rid); processed+=1

        for req in reqs:
            action=req.get("action")
            if action not in {"batch_analyze","discover"}:
                continue
            parent_id=str(req.get("request_id") or "")
            if not parent_id or parent_id in handled:
                continue

            urls=[]
            warnings=[]
            if action=="batch_analyze":
                raw=req.get("urls") or []
                if isinstance(raw,str):
                    raw=re.split(r"[\r\n]+",raw)
                for u in raw:
                    u=norm(u)
                    if not re.match(r"^https?://",u):
                        continue
                    # V64.2: a prefecture/category upstream URL in the ordinary
                    # multi-URL box is a collection, not a tournament page.
                    # Expand it automatically instead of trying to parse the
                    # category page itself as one tournament (which produced 0 games).
                    if re.search(r"/blog-category-\d+(?:-\d+)?\.html(?:$|[?#])",u):
                        try:
                            discovered,pages_scanned=discover_result_urls(
                                u,limit=120,
                                year_from=req.get("year_from") or 2021,
                                year_to=req.get("year_to"),
                                seasons=req.get("discover_seasons") or ["spring","summer","autumn"],
                                follow_pagination=True,
                            )
                            for du in discovered:
                                if du not in urls: urls.append(du)
                            warnings.append(f"カテゴリURLを自動展開: {u} / {pages_scanned}ページ / {len(discovered)}大会URL")
                        except Exception as e:
                            warnings.append(f"カテゴリURL自動展開エラー: {u} / {e}")
                        continue
                    if u not in urls:
                        urls.append(u)
            else:
                try:
                    urls,pages_scanned=discover_result_urls(
                        str(req.get("source_url") or ""),
                        limit=int(req.get("limit") or 120),
                        year_from=req.get("year_from"),year_to=req.get("year_to"),
                        seasons=req.get("discover_seasons") or [],
                        follow_pagination=bool(req.get("follow_pagination",True)),
                    )
                    warnings.append(f"一覧ページ {pages_scanned}ページを確認しました。")
                except Exception as e:
                    warnings.append(f"一覧ページ展開エラー: {e}")

            if len(urls)>120:
                urls=urls[:120]
                warnings.append("URLは120件までに制限しました。")

            children=[]
            for i,u in enumerate(urls):
                child={
                    "request_id":f"{parent_id}:{i+1:03d}",
                    "parent_request_id":parent_id,
                    "batch_id":parent_id,
                    "action":"analyze",
                    "created_at":req.get("created_at") or datetime.now(timezone.utc).isoformat(),
                    "source_url":u,
                    "year":req.get("year",""),
                    "season":req.get("season",""),
                    "prefecture":req.get("prefecture",""),
                    "region":req.get("region",""),
                    "level":req.get("level","prefecture"),
                    "tournament":req.get("tournament",""),
                    "import_mode":req.get("import_mode","replace"),
                    "batch_auto_metadata":bool(req.get("batch_auto_metadata",True)),
                }
                children.append(child)

            child_items=analyze_many(children,4) if children else []
            child_ids=[]
            for item in child_items:
                cid=str(item.get("request_id") or "")
                items.append(item); byid[cid]=item; child_ids.append(cid)
            parent_item={
                **req,
                "status":"batch_review" if child_items else "error",
                "processed_at":datetime.now(timezone.utc).isoformat(),
                "matches":[],
                "warnings":warnings + ([] if child_items else ["解析対象URLが見つかりませんでした。"]),
                "child_request_ids":child_ids,
                "discovered_count":len(urls),
                "review_count":sum(1 for x in child_items if x.get("status")=="review"),
                "error_count":sum(1 for x in child_items if x.get("status")=="error"),
            }
            items.append(parent_item); byid[parent_id]=parent_item
            handled.add(parent_id)
            processed+=1+len(child_items)

    # Approval also uses request ID only.
    if want("approve"):
        completed_targets=set()

        # One request can approve all successful items from a batch. Writes are
        # intentionally sequential to avoid races within data/imported.
        for req in reqs:
            if req.get("action")!="batch_approve":
                continue
            approval_id=str(req.get("request_id") or "")
            if not approval_id or approval_id in handled:
                continue
            targets=[str(x) for x in (req.get("target_request_ids") or []) if str(x)]
            metadata_overrides=req.get("metadata_overrides") or {}
            done=0; failed=0; total_added=0; total_removed=0; completed_ids=[]
            for target in targets:
                item=byid.get(target)
                if not item or item.get("status")!="review":
                    failed+=1; continue

                meta=metadata_overrides.get(target) or {}
                year=str(meta.get("year") or item.get("year") or "").strip()
                season=str(meta.get("season") or item.get("season") or "").strip()
                level=str(meta.get("level") or item.get("level") or "prefecture").strip()
                pref=str(meta.get("prefecture") if meta.get("prefecture") is not None else item.get("prefecture") or "").strip()
                region=str(meta.get("region") if meta.get("region") is not None else item.get("region") or "").strip()
                tournament=str(meta.get("tournament") or item.get("tournament") or "").strip()

                if not year or not season or not tournament:
                    item.setdefault("warnings",[]).append("年・季節・大会名が未設定のため一括登録しませんでした。")
                    failed+=1; continue
                if level=="prefecture" and not pref:
                    item.setdefault("warnings",[]).append("県大会なのに都道府県が未設定です。")
                    failed+=1; continue
                if level=="regional" and not region:
                    item.setdefault("warnings",[]).append("地区大会なのに地区が未設定です。")
                    failed+=1; continue
                if level=="national":
                    pref=""
                    region="全国"

                rows=[]
                for src in item.get("matches") or []:
                    r=dict(src)
                    r["year"]=year
                    r["season"]=season
                    r["region"]=region
                    r["prefecture"]=pref
                    r["tournament"]=tournament
                    note_parts=[x.strip() for x in str(r.get("note") or "").split(";") if x.strip() and not x.strip().startswith("level=")]
                    note_parts.insert(0,f"level={level}")
                    r["note"]=";".join(note_parts)
                    rows.append(r)
                rows=normalize_approved_rows(rows,level)
                if not rows:
                    item.setdefault("warnings",[]).append("登録対象試合が0件のため登録しませんでした。")
                    item["status"]="error"; failed+=1; continue
                unit=(pref if pref else (region if region else ("全国" if level=="national" else "上位大会"))).replace("/","_")
                path=DATA_ROOT/year/season/f"{unit}.csv"
                mode=str(item.get("import_mode") or req.get("import_mode") or "replace")
                added,removed,migrated=merge_csv(path,rows,mode=mode,tournament=tournament)
                item.update({
                    "year":year,"season":season,"level":level,"prefecture":pref,"region":region,"tournament":tournament,
                    "matches":rows,"edited_metadata_before_approval":bool(meta),
                    "status":"completed","approved_at":datetime.now(timezone.utc).isoformat(),
                    "data_file":str(path),"added_matches":added,"removed_matches":removed,
                    "migrated_match_edits":migrated,"import_mode":mode
                })
                total_added+=added; total_removed+=removed; completed_ids.append(target)
                done+=1
            items.append({
                **req,"status":"completed" if done else "error",
                "processed_at":datetime.now(timezone.utc).isoformat(),
                "completed_targets":done,"failed_targets":failed,
                "completed_target_ids":completed_ids,
                "added_matches":total_added,"removed_matches":total_removed,
                "matches":[],"warnings":[] if done else ["一括登録できる解析結果がありませんでした。"]
            })
            handled.add(approval_id); processed+=1

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
