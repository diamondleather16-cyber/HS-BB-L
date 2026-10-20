#!/usr/bin/env python3
from __future__ import annotations
import csv, json, re
from pathlib import Path

REGION_CANONICAL={"hokkaido":"北海道","tohoku":"東北","kanto_tokyo":"関東・東京","kanto":"関東・東京","tokyo":"東京","hokushinetsu":"北信越","tokai":"東海","kinki":"近畿","chugoku":"中国","shikoku":"四国","kyushu":"九州","national":"全国"}
def normalize_region(v):
    s=str(v or "").strip()
    return REGION_CANONICAL.get(s,s)

def clean_school_name(v):
    s=re.sub(r"\s+"," ",str(v or "")).strip()
    s=re.sub(r"^[\s　]*(?:[■□▪▫●○◆◇▲△▼▽★☆◎◉◯・･▶▷▸▹►▻✓✔☑☐☒※]+[\s　]*)+","",s)
    return s.strip()

MATCHES=Path("output/all_matches.csv")
EDITS=Path("master/match_edits_shared.json")
LEVEL_OVERRIDES=Path("master/level_overrides.csv")

def read_csv(path):
    if not path.exists(): return []
    with path.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def score_key(v):
    try:
        n=float(v)
        return str(int(n)) if n.is_integer() else str(n)
    except Exception:
        return str(v or "").strip()

def edit_key(r):
    if str(r.get("edit_key") or "").strip(): return str(r["edit_key"]).strip()
    if str(r.get("manual_id") or "").strip(): return str(r["manual_id"]).strip()
    return "¦".join([
        str(r.get("year") or "").strip(),str(r.get("season") or "").strip(),
        str(r.get("date") or "").strip(),str(r.get("tournament") or "").strip(),
        str(r.get("round") or "").strip(),str(r.get("team1") or "").strip(),
        score_key(r.get("score1")),str(r.get("team2") or "").strip(),score_key(r.get("score2"))
    ])

def normalize_date(v):
    s=str(v or "").strip().replace("年","-").replace("月","-").replace("日","")
    parts=[x for x in re.split(r"[^0-9]+",s) if x]
    if len(parts)>=3:
        try:
            y,m,d=map(int,parts[:3])
            return f"{y:04d}-{m:02d}-{d:02d}"
        except Exception:
            pass
    return str(v or "").strip()

def authority_pair(r):
    a=(clean_school_name(r.get("team1","")),score_key(r.get("score1")))
    b=(clean_school_name(r.get("team2","")),score_key(r.get("score2")))
    return tuple(sorted((a,b),key=lambda x:(x[0],x[1])))

def authority_snapshot_matches(row,snap):
    """Match one exact ledger record, not every row from the same source page.

    A single result page can yield both a correct row and a malformed duplicate
    with a blank tournament name. source_url/_source_file therefore corroborate
    identity but must never override tournament/round differences.
    """
    if not isinstance(snap,dict): return False
    mid=str(snap.get("manual_id") or "").strip()
    if mid and str(row.get("manual_id") or "").strip()==mid:
        return True

    if str(row.get("year") or "").strip()!=str(snap.get("year") or "").strip(): return False
    if str(row.get("season") or "").strip()!=str(snap.get("season") or "").strip(): return False
    if normalize_date(row.get("date"))!=normalize_date(snap.get("date")): return False
    if authority_pair(row)!=authority_pair(snap): return False

    norm=lambda v: re.sub(r"[\s　]+","",str(v or "")).strip().lower()
    if norm(row.get("tournament"))!=norm(snap.get("tournament")): return False
    if norm(row.get("round"))!=norm(snap.get("round")): return False

    sf=str(snap.get("_source_file") or "").strip()
    rsf=str(row.get("_source_file") or "").strip()
    if sf and rsf and rsf!=sf: return False

    su=str(snap.get("source_url") or "").strip()
    rsu=str(row.get("source_url") or "").strip()
    if su and rsu and rsu!=su: return False

    return True

def apply_authority_ops(rows, ops):
    """Replay final user intent against one physical ledger row.

    V67 prefers persisted match_id. Snapshot matching remains only as a fallback
    for old rows created before stable IDs existed.
    """
    applied={"ADD":0,"UPDATE":0,"DELETE":0}
    ordered=sorted(
        [x for x in (ops or []) if isinstance(x,dict)],
        key=lambda x:str(x.get("updated_at") or "")
    )

    def matches(r,op,snap):
        oid=str(op.get("match_id") or "").strip()
        rid=str(r.get("match_id") or "").strip()
        if oid and rid:
            return oid==rid
        return authority_snapshot_matches(r,snap)

    for op in ordered:
        action=str(op.get("action") or "").upper()
        snap=op.get("snapshot") or {}
        changes=op.get("changes") or {}
        if action=="DELETE":
            before=len(rows)
            rows=[r for r in rows if not matches(r,op,snap)]
            if len(rows)!=before: applied["DELETE"]+=before-len(rows)
        elif action=="UPDATE":
            hit=False
            for r in rows:
                if matches(r,op,snap):
                    for k,v in changes.items(): r[k]=v
                    hit=True
            if hit: applied["UPDATE"]+=1
        elif action=="ADD":
            candidate=dict(snap)
            if not candidate: continue
            exists=any(matches(r,op,candidate) for r in rows)
            if not exists:
                if candidate.get("manual_id") and not candidate.get("edit_key"):
                    candidate["edit_key"]=candidate["manual_id"]
                if op.get("match_id") and not candidate.get("match_id"):
                    candidate["match_id"]=op["match_id"]
                rows.append(candidate); applied["ADD"]+=1
    return rows,applied

def infer_innings(r):
    note=str(r.get("note") or "")

    cold=re.search(r"(?<!\d)([5-8])回コールド",note)
    if cold:
        return cold.group(1),"cold"

    extra=re.search(r"延長\s*(1\d|2\d|30)回",note)
    if extra:
        return extra.group(1),"extra"

    # Only trust structured values when explicitly consistent.
    try:
        n=int(float(r.get("innings") or 0))
    except Exception:
        n=0
    finish=str(r.get("finish_type") or "").strip().lower()
    if finish=="cold" and 5<=n<=8:
        return str(n),"cold"
    if finish=="extra" and n>=10:
        return str(n),"extra"
    if finish=="normal" and n==9:
        return "9","normal"

    # Round names (2回戦/3回戦) and tournament names (第108回...) are never innings.
    return "9","normal"


def note_level(note):
    for part in str(note or "").split(";"):
        if part.startswith("level="):
            return part.split("=",1)[1].strip()
    return ""

def set_note_level(note, level):
    parts=[p for p in str(note or "").split(";") if p!=""]
    changed=False
    out=[]
    for p in parts:
        if p.startswith("level="):
            if not changed:
                out.append(f"level={level}")
                changed=True
            continue
        out.append(p)
    if not changed:
        out.append(f"level={level}")
    return ";".join(out)

def _regex_match(pattern, value):
    pattern=str(pattern or "").strip()
    if not pattern:
        return True
    try:
        return re.search(pattern, str(value or "")) is not None
    except re.error:
        # If a user writes ordinary text instead of regex, treat it as substring.
        return pattern in str(value or "")

def load_level_overrides():
    if not LEVEL_OVERRIDES.exists():
        return []
    rows=read_csv(LEVEL_OVERRIDES)
    out=[]
    for i,x in enumerate(rows,2):
        enabled=str(x.get("enabled") or "1").strip().lower()
        if enabled in {"0","false","off","no","無効"}:
            continue
        try:
            y1=int(str(x.get("year_from") or "0").strip() or 0)
        except Exception:
            y1=0
        try:
            y2=int(str(x.get("year_to") or "9999").strip() or 9999)
        except Exception:
            y2=9999
        out.append({
            **x,
            "_line":i,
            "_year_from":y1,
            "_year_to":y2,
        })
    return out

def level_override_matches(rule, r):
    try:
        year=int(str(r.get("year") or "0"))
    except Exception:
        year=0
    if year < rule["_year_from"] or year > rule["_year_to"]:
        return False

    exact_fields=("season","region","prefecture")
    for f in exact_fields:
        wanted=str(rule.get(f) or "").strip()
        if wanted and str(r.get(f) or "").strip()!=wanted:
            return False

    current=note_level(r.get("note","")) or str(r.get("level") or "").strip()
    from_level=str(rule.get("from_level") or "").strip()
    if from_level and current!=from_level:
        return False

    if not _regex_match(rule.get("tournament_pattern"), r.get("tournament")):
        return False
    if not _regex_match(rule.get("round_pattern"), r.get("round")):
        return False
    return True

def apply_level_overrides(rows):
    rules=load_level_overrides()
    if not rules:
        return 0,{}
    total=0
    hits={}
    for r in rows:
        for rule in rules:
            if not level_override_matches(rule,r):
                continue
            to_level=str(rule.get("to_level") or "").strip()
            if not to_level:
                continue
            before=note_level(r.get("note","")) or str(r.get("level") or "").strip()
            if before==to_level:
                continue
            r["note"]=set_note_level(r.get("note",""),to_level)
            if "level" in r:
                r["level"]=to_level
            total+=1
            label=str(rule.get("note") or "").strip() or f"line {rule['_line']}"
            hits[label]=hits.get(label,0)+1
            # First matching rule wins; make rules deterministic and auditable.
            break
    return total,hits

def main():
    rows=read_csv(MATCHES)
    if not rows:
        raise SystemExit("output/all_matches.csv missing or empty")
    state={"manual_matches":[],"overrides":[],"team_links":[],"deleted_matches":[]}
    if EDITS.exists():
        state.update(json.loads(EDITS.read_text(encoding="utf-8")) or {})

    # Original stable keys are assigned before modifications.
    for r in rows:
        r["edit_key"]=edit_key(r)

    overrides={x.get("edit_key"):x.get("changes",{}) for x in state.get("overrides",[]) if x.get("edit_key")}
    links={(x.get("edit_key"),x.get("side")):x for x in state.get("team_links",[]) if x.get("edit_key") and x.get("side")}
    # Old tombstones had no match_id and therefore can only be replayed by edit_key.
    # New deletes are applied exactly by authority_ops / match_id below.
    deleted={
        str(x.get("edit_key") or "").strip()
        for x in state.get("deleted_matches",[])
        if x.get("edit_key") and not str(x.get("match_id") or "").strip()
    }

    rows=[r for r in rows if edit_key(r) not in deleted]

    by_manual={str(r.get("manual_id") or "") for r in rows if r.get("manual_id")}
    for m in state.get("manual_matches",[]):
        mid=str(m.get("manual_id") or "").strip()
        if not mid or mid in by_manual or mid in deleted: continue
        x=dict(m)
        x["edit_key"]=mid
        rows.append(x)
        by_manual.add(mid)

    # Replay modern ADD/UPDATE/DELETE after manual rows are present, so a
    # manually entered match can also be deleted reliably on rebuild.
    rows,authority_applied=apply_authority_ops(rows,state.get("authority_ops",[]))

    for r in rows:
        key=edit_key(r)
        r["edit_key"]=key
        r["region"]=normalize_region(r.get("region",""))
        if key in overrides:
            for k,v in overrides[key].items():
                r[k]=v
        for side in ("team1","team2"):
            r[side]=clean_school_name(r.get(side,""))
            if r.get(f"{side}_canonical"):
                r[f"{side}_canonical"]=clean_school_name(r.get(f"{side}_canonical",""))
            link=links.get((key,side))
            if link:
                r[f"{side}_school_id"]=link.get("school_id","")
                r[f"{side}_canonical"]=link.get("canonical_name","")
        innings,finish=infer_innings(r)
        r["innings"]=innings
        r["finish_type"]=finish

    # Bulk hierarchy corrections are applied after ordinary match edits.
    # This allows one auditable CSV rule to repair an entire tournament/year range.
    level_changed,level_hits=apply_level_overrides(rows)
    if level_changed:
        print(f"Applied level overrides: {level_changed} matches")
        for label,count in sorted(level_hits.items()):
            print(f"  {count:5d}  {label}")

    # Deterministic field order: old schema first, then new edit fields, then any unexpected fields.
    preferred=[
        "year","season","region","prefecture","tournament","round","date",
        "team1","score1","team2","score2","source_url","note",
        "innings","finish_type","edit_key","manual_id",
        "team1_school_id","team1_canonical","team1_type","team1_union_id","team2_school_id","team2_canonical","team2_type","team2_union_id"
    ]
    seen=set()
    fields=[]
    for f in preferred:
        if any(f in r for r in rows):
            fields.append(f);seen.add(f)
    for r in rows:
        for f in r:
            if f not in seen:
                fields.append(f);seen.add(f)

    with MATCHES.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

    print(
        f"Applied match edits: {len(overrides)} overrides, {len(links)} links, "
        f"{len(state.get('manual_matches',[]))} manual matches, {len(deleted)} legacy deleted matches, "
        f"authority DELETE={authority_applied['DELETE']} UPDATE={authority_applied['UPDATE']} ADD={authority_applied['ADD']}, "
        f"{level_changed} level corrections"
    )

if __name__=="__main__":
    main()
