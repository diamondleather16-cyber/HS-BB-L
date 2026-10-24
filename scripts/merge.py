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
                # The 2025 Tokyo source CSV incorrectly tagged eight round-of-16
                # games as QF. The article explicitly lists these games as 3回戦.
                # Match by teams, not date: CSV dates need separate reconciliation.
                if (str(r.get("year"))=="2025" and r.get("season")=="autumn"
                    and r.get("prefecture")=="東京"
                    and "blog-entry-3638.html" in str(r.get("source_url") or "")
                    and str(r.get("round") or "").upper()=="QF"):
                    actual_qf_scores={
                        frozenset((("成立学園","0"),("国士舘","8"))),
                        frozenset((("帝京","3"),("日大三","0"))),
                        frozenset((("関東一","10"),("東海大高輪台","2"))),
                        frozenset((("関東第一","10"),("東海大高輪台","2"))),
                        frozenset((("日野","1"),("桜美林","5"))),
                    }
                    fixture=frozenset(((r["team1"],str(r["score1"])),(r["team2"],str(r["score2"]))))
                    if fixture not in actual_qf_scores:
                        r["round"]="3R"
                        # Source groups these 8 games on Oct 27/28.
                        # Their precise per-fixture dates still require verification.
                        r["note"]=str(r.get("note") or "").rstrip(";")+";date_audit=source_2025-10-27_or_28"
                canonicalize(r)
                rows.append(r)

    # 2025 Hokkaido autumn recovered rows: 137 qualifying fixtures occur
    # twice, once on the real September/October date as "地区予選",
    # and once spuriously dated October 12 as "1R".
    # Remove only precisely matching fixtures; leave source CSV untouched.
    def fixture_signature(r):
        return tuple(sorted((
            (str(r.get("team1") or "").strip(),str(r.get("score1") or "").strip()),
            (str(r.get("team2") or "").strip(),str(r.get("score2") or "").strip())
        )))
    def hokkaido_recovered_autumn(r):
        return (str(r.get("year"))=="2025" and str(r.get("season"))=="autumn"
                and str(r.get("prefecture") or "")=="北海道"
                and "data/recovered/2025_2026_pre_dedupe_missing.csv" in str(r.get("_source_file") or ""))
    authentic={
        fixture_signature(r)
        for r in rows
        if hokkaido_recovered_autumn(r)
        and str(r.get("round") or "")=="地区予選"
        and str(r.get("date") or "")!="2025-10-12"
    }
    before=len(rows)
    rows=[
        r for r in rows if not (
            hokkaido_recovered_autumn(r)
            and str(r.get("date") or "")=="2025-10-12"
            and str(r.get("round") or "")=="1R"
            and fixture_signature(r) in authentic
        )
    ]
    print(f"2025 Hokkaido false-date duplicate qualifiers removed: {before-len(rows)}; verified authentic qualifying fixtures: {len(authentic)}")

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
        a=(re.sub(r"[\s　■●○]+","",str(r.get("team1") or "")),str(r.get("score1") or ""))
        b=(re.sub(r"[\s　■●○]+","",str(r.get("team2") or "")),str(r.get("score2") or ""))
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
        if not re.fullmatch(r"20\d{2}-\d{2}-\d{2}",date): return None
        a,b=sorted(((re.sub(r"[\s　■●○]+","",str(r.get("team1") or "")),str(r.get("score1") or "").strip()),(re.sub(r"[\s　■●○]+","",str(r.get("team2") or "")),str(r.get("score2") or "").strip())))
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

    # Across all 2025/2026 prefectures: recovered snapshots can repeat a
    # curated game under a different tournament title and round notation.
    # Restrict to exact date + both teams + scores + prefecture + season.
    # Prefer curated sources over recovered or legacy snapshots. Preserve raw CSVs.
    def exact_fixture_key(r):
        y=str(r.get("year") or "")
        if y not in ("2025","2026"): return None
        date=normalized_date(r.get("date"))
        if not re.fullmatch(r"20\\d{2}-\\d{2}-\\d{2}",date): return None
        sides=tuple(sorted((
            (re.sub(r"[\\s　■●○]+","",str(r.get("team1") or "")),str(r.get("score1") or "").strip()),
            (re.sub(r"[\\s　■●○]+","",str(r.get("team2") or "")),str(r.get("score2") or "").strip())
        )))
        if any(not name or not score.isdigit() for name,score in sides): return None
        pref=str(r.get("prefecture") or "").strip()
        if not pref or pref in ("全国","national"): return None
        return (y,str(r.get("season") or ""),date,pref,sides)
    def source_priority(r):
        path=str(r.get("_source_file") or "")
        return (0 if "data/recovered/" in path else 1 if path=="data/all_matches.csv" else 2,
                1 if r.get("source_url") else 0)
    winners={}
    duplicate_by_source={}
    for row in rows:
        key=exact_fixture_key(row)
        if key is None: continue
        if key not in winners:
            winners[key]=row
        else:
            current=winners[key]
            if source_priority(row)>source_priority(current):
                winners[key]=row
    retained=[]
    removed=0
    for row in rows:
        key=exact_fixture_key(row)
        if key is not None and winners[key] is not row:
            removed+=1
            src=str(row.get("_source_file") or "")
            duplicate_by_source[src]=duplicate_by_source.get(src,0)+1
            continue
        retained.append(row)
    rows=retained
    print(f"Cross-source 2025/26 exact fixture duplicates suppressed: {removed}; by source: {duplicate_by_source}")

    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields=FIELDS+["_source_file","_source_row","match_id"]
        w=csv.DictWriter(f,fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"{len(rows)} matches -> {OUT}; blank tournament removed={skipped_blank_tournament}")

if __name__=="__main__":
    main()
