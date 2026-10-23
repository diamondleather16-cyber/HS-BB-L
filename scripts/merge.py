from pathlib import Path
import csv, hashlib
from normalize import load_school_aliases, normalize_school_name
from normalize_hokkaido_tokyo_levels import canonicalize, classify

DATA_DIR=Path("data")
OUT=Path("output/all_matches.csv")
FIELDS=["year","season","region","prefecture","tournament","round","date","team1","score1","team2","score2","source_url","note"]

def stable_source_match_id(path,row_no,row):
    src=str(path).replace("\\","/")
    body="¦".join([
        src,str(row_no),
        *[str(row.get(k) or "").strip() for k in FIELDS]
    ])
    return "SRCROW-"+hashlib.sha1(body.encode("utf-8")).hexdigest()[:20].upper()

def main():
    aliases=load_school_aliases()
    rows=[]
    skipped_blank_tournament=0

    for p in sorted(DATA_DIR.rglob("*.csv")):
        if p.name=="template.csv":
            continue
        with p.open("r",encoding="utf-8-sig",newline="") as f:
            rd=csv.DictReader(f)
            if not rd.fieldnames or any(x not in rd.fieldnames for x in FIELDS):
                continue
            for source_row,r in enumerate(rd,start=2):
                if not any((r.get(x) or "").strip() for x in FIELDS):
                    continue

                # V67: a match without a tournament name is malformed ledger data.
                # Keep it out of generated ledger/rating output permanently even if
                # an old source CSV still contains it.
                if not str(r.get("tournament") or "").strip():
                    skipped_blank_tournament+=1
                    continue

                r["team1"]=normalize_school_name(r["team1"],aliases)
                r["team2"]=normalize_school_name(r["team2"],aliases)
                r["_source_file"]=str(p)
                r["_source_row"]=str(source_row)
                r["match_id"]=stable_source_match_id(p,source_row,r)
                canonicalize(r)
                rows.append(r)

    # Legacy data/all_matches.csv is an old snapshot and can contain copies of
    # independently curated source CSVs. Remove only same-game, same-score,
    # same-competition-layer entries from the generated ledger. Do not edit
    # physical source CSVs here: row-based match IDs and historical user edits
    # must remain stable until a migration is audited.
    import re
    def normalized_date(v):
        parts=re.findall(r"\\d+",str(v or ""))
        if len(parts)>=3:
            return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
        return str(v or "")
    def game_key(r):
        a=(re.sub(r"[\\s　■●○]+","",str(r.get("team1") or "")),str(r.get("score1") or ""))
        b=(re.sub(r"[\\s　■●○]+","",str(r.get("team2") or "")),str(r.get("score2") or ""))
        m=re.search(r"(?:^|;)level=([^;]+)",str(r.get("note") or ""))
        lev=str(r.get("level") or (m.group(1) if m else "")).strip()
        return (str(r.get("year") or ""),str(r.get("season") or ""),normalized_date(r.get("date")),
                tuple(sorted((a,b))),str(r.get("prefecture") or ""),lev)
    modern={game_key(r) for r in rows if r.get("_source_file")!="data/all_matches.csv"
            and str(r.get("year")) in ("2025","2026")}
    before=len(rows)
    rows=[r for r in rows if not (r.get("_source_file")=="data/all_matches.csv"
           and str(r.get("year")) in ("2025","2026") and game_key(r) in modern)]
    print(f"Legacy snapshot duplicated generated rows suppressed: {before-len(rows)}")

    # 2021+ local duplicates, including alternate tournament naming or team order.
    # Deduplicate generated ledger only; source CSVs and their stable match ids remain intact.
    # Require complete date and valid scores to avoid uncertain deletions.
    seen={}
    retained=[]
    suppressed=0
    def local_key(r):
        if classify(r) is None: return None
        date=normalized_date(r.get("date"))
        if not re.fullmatch(r"20\\d{2}-\\d{2}-\\d{2}",date): return None
        a,b=sorted(((re.sub(r"[\\s　■●○]+","",str(r.get("team1") or "")),str(r.get("score1") or "").strip()),(re.sub(r"[\\s　■●○]+","",str(r.get("team2") or "")),str(r.get("score2") or "").strip())))
        if not a[0] or not b[0] or not a[1].isdigit() or not b[1].isdigit(): return None
        return (str(r.get("year") or ""),str(r.get("season") or ""),date,a,b,str(r.get("prefecture") or "").replace("北北海道","北海道").replace("南北海道","北海道").replace("東東京","東京").replace("西東京","東京"))
    for row in rows:
        key=local_key(row)
        if key is None:
            retained.append(row)
        elif key not in seen:
            seen[key]=row
            retained.append(row)
        elif (row.get("note") or "").split("level=")[-1] != (seen[key].get("note") or "").split("level=")[-1]:
            # Conflicting classification: retain until audited.
            retained.append(row)
        else:
            suppressed+=1
    rows=retained
    print(f"2021+ Hokkaido/Tokyo identical game duplicates suppressed: {suppressed}")

    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields=FIELDS+["_source_file","_source_row","match_id"]
        w=csv.DictWriter(f,fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"{len(rows)} matches -> {OUT}; blank tournament removed={skipped_blank_tournament}")

if __name__=="__main__":
    main()
