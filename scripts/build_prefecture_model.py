#!/usr/bin/env python3
from pathlib import Path
from collections import defaultdict
import csv, json, math, re

HIST = Path("docs/data/historical_ledger_2017_2024.csv")
HIST_COMPAT_ROOT = Path("data/historical_compat")
CUR = Path("output/all_matches.csv")
MASTER = Path("master/school_master_shared.json")

OUT_PRIOR = Path("master/prefecture_strength_prior.csv")
OUT_MATCHUPS = Path("master/prefecture_matchups.csv")
OUT_RATINGS = Path("output/prefecture_ratings.csv")
OUT_EVENTS = Path("output/prefecture_rating_events.csv")
OUT_CONTEXT = Path("output/prefecture_match_context.csv")

BASE = 1000.0
K_PREF = 8.0
K_MATCHUP = 6.0
ALPHA_PREF = 0.25
BETA_MATCHUP = 0.50

SEASON_W = {
    "spring":0.95, "summer":1.15, "autumn":1.00,
    "senbatsu":0.95, "koshien":1.15, "jingu":1.00
}
LEVEL_W = {
    "branch":0.60, "district_qualifier":0.55, "first_qualifier":0.55,
    "preliminary":0.55, "qualifier_league":0.50, "repechage":0.50,
    "prefecture":0.60, "regional":1.00, "national":1.20
}
NATIONAL_W = {"senbatsu":1.20, "koshien":1.30, "jingu":1.15}

def read_csv(p):
    if not p.exists(): return []
    with p.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

def write_csv(p, fields, rows):
    p.parent.mkdir(parents=True,exist_ok=True)
    with p.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

def load_master():
    if not MASTER.exists(): return {},{}
    try:
        data=json.loads(MASTER.read_text(encoding="utf-8"))
    except Exception:
        return {},{}
    by_name=defaultdict(list); by_id={}
    for s in data.get("schools",[]):
        sid=str(s.get("school_id") or "").strip()
        if sid: by_id[sid]=s
        for name in [str(s.get("canonical_name") or "").strip(), *[str(a).strip() for a in (s.get("aliases") or [])]]:
            if name and not any(str(x.get("school_id") or "")==sid for x in by_name[name]):
                by_name[name].append(s)
    return by_name,by_id


def note_value(note,key):
    m=re.search(r"(?:^|;)"+re.escape(key)+r"=([^;]+)",str(note or ""))
    return m.group(1).strip() if m else ""

def raw_level(r):
    return note_value(r.get("note",""),"level")

def season_norm(s):
    return {"senbatsu":"spring","koshien":"summer","jingu":"autumn"}.get(str(s or ""),str(s or ""))

def round_key(v):
    t=re.sub(r"[\s　・･]","",str(v or "")).upper()
    if "代表決定" in t: return "representative"
    if "3位" in t or "三位" in t: return "third"
    if "準々決勝" in t or "QF" in t: return "qf"
    if "準決勝" in t or "SF" in t: return "sf"
    if ("決勝" in t or t in {"F","FINAL"}) and "準" not in t and "代表" not in t: return "f"
    if "3回戦" in t or "４回戦" in t or "4回戦" in t or "R16" in t or "ROUND16" in t: return "r16"
    if "2回戦" in t: return "r32"
    if "1回戦" in t or "１回戦" in t: return "r64"
    return "other"

def effective_level(r):
    """Tournament hierarchy rules for Hokkaido/Tokyo."""
    season=season_norm(r.get("season",""))
    text=" ".join(str(r.get(k) or "") for k in ("tournament","round","note","prefecture","region"))
    lvl=raw_level(r) or "prefecture"

    # Hokkaido
    if "北海道" in text or "北北海道" in text or "南北海道" in text:
        if season in ("spring","autumn"):
            if re.search(r"全道|北海道大会|道大会",text) and not re.search(r"支部|支庁",text):
                return "regional"
            if re.search(r"支部|支庁",text):
                return "prefecture"
        if season=="summer":
            return "prefecture"

    # Tokyo
    if "東京" in text or "東東京" in text or "西東京" in text:
        if season=="spring":
            if re.search(r"一次|1次|１次|予選",text) and not re.search(r"都大会|本大会",text):
                return "district_qualifier"
            return "prefecture"
        if season=="summer":
            return "prefecture"
        if season=="autumn":
            # First-stage blocks are prefecture hierarchy.
            if re.search(r"一次|1次|１次|ブロック",text) and not re.search(r"都大会|本大会",text):
                return "prefecture"
            # Tokyo main tournament: R16 and later are regional hierarchy.
            return "regional" if round_key(r.get("round","")) in {"r16","qf","sf","f","third","representative"} else "prefecture"
    return lvl

def master_for(r,side,by_name,by_id):
    sid=str(r.get(f"{side}_school_id") or "").strip()
    if sid and sid in by_id:
        return by_id[sid]

    can=str(r.get(f"{side}_canonical") or "").strip()
    raw=str(r.get(side) or "").strip()
    name=can or raw
    candidates=by_name.get(name,[])
    if not candidates and raw!=name:
        candidates=by_name.get(raw,[])
    if not candidates:
        return None

    # Prefer an explicit side prefecture; for prefecture-level rows the row prefecture
    # is a strong identity hint. This prevents e.g. 飯田(石川) from absorbing 飯田(長野).
    pref=str(r.get(f"{side}_prefecture") or note_value(r.get("note",""),f"{side}_pref") or "").strip()
    if not pref and effective_level(r) in {"prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"}:
        pref=str(r.get("prefecture") or "").strip()
    if pref:
        exact=[s for s in candidates if str(s.get("prefecture") or "").strip()==pref]
        if len(exact)==1:
            return exact[0]
    return candidates[0] if len(candidates)==1 else None


def pref_unit(r,side,by_name,by_id):
    s=master_for(r,side,by_name,by_id)
    base=str((s or {}).get("prefecture") or r.get(f"{side}_prefecture") or note_value(r.get("note",""),f"{side}_pref") or r.get("prefecture") or "").strip()
    rep=str((s or {}).get("representative_area") or "").strip()
    text=" ".join(str(r.get(k) or "") for k in ("tournament","note","prefecture","sub_area"))
    if base in ("北海道","北北海道","南北海道"):
        if rep in ("北北海道","南北海道"): return rep
        if "北北海道" in text: return "北北海道"
        if "南北海道" in text: return "南北海道"
        return "北海道"
    if base in ("東京","東東京","西東京"):
        if rep in ("東東京","西東京"): return rep
        if "東東京" in text: return "東東京"
        if "西東京" in text: return "西東京"
        return "東京"
    return base.replace("都","").replace("府","").replace("県","")

def event_key(r):
    return "|".join([
        str(r.get("year","")),str(r.get("season","")),str(r.get("date","")),
        str(r.get("tournament","")),str(r.get("round","")),
        str(r.get("team1","")),str(r.get("score1","")),
        str(r.get("team2","")),str(r.get("score2","")),
    ])

def expected(a,b):
    return 1/(1+10**((b-a)/400))

def matchup_effect(raw,n):
    # Sparse pairs shrink strongly toward zero.
    return raw * (n/(n+8.0)) if n>0 else 0.0

def current_rows():
    out=[]
    for r in read_csv(CUR):
        try:
            y=int(r.get("year") or 0)
            s1=int(float(r.get("score1",""))); s2=int(float(r.get("score2","")))
        except Exception:
            continue
        if y>=2025 and r.get("team1") and r.get("team2"):
            rr=dict(r); rr["_source"]="current"; rr["_order"]=len(out)
            out.append(rr)
    return out

def historical_rows():
    out=[]
    for r in read_csv(HIST):
        try:
            y=int(r.get("year") or 0)
            int(float(r.get("score1",""))); int(float(r.get("score2","")))
        except Exception:
            continue
        rr=dict(r); rr["_source"]="historical"; rr["_order"]=len(out)
        out.append(rr)
    return out


def historical_compat_rows():
    """Optional 2000+ regional/national archive used only for pair compatibility.
    CSV schema may match normal ledger. It does not alter current prefecture Rating directly.
    """
    out=[]
    if not HIST_COMPAT_ROOT.exists(): return out
    for p in sorted(HIST_COMPAT_ROOT.rglob("*.csv")):
        for r in read_csv(p):
            try:
                y=int(r.get("year") or 0); int(float(r.get("score1",""))); int(float(r.get("score2","")))
            except Exception: continue
            lvl=effective_level(r)
            if y>=2000 and lvl in {"regional","national"} and r.get("team1") and r.get("team2"):
                rr=dict(r);rr["_source"]="compat_history";rr["_file"]=str(p);out.append(rr)
    return out

def history_decay(year):
    y=int(year or 0)
    if y>=2021:return 1.00
    if y>=2016:return 0.75
    if y>=2011:return 0.55
    if y>=2006:return 0.40
    return 0.30

def sort_key(r):
    try: y=int(r.get("year") or 0)
    except: y=0
    season_order={"spring":1,"senbatsu":2,"summer":3,"koshien":4,"autumn":5,"jingu":6}.get(str(r.get("season") or ""),9)
    return (y,str(r.get("date") or ""),season_order,int(r.get("_order") or 0))

def main():
    by_name,by_id=load_master()
    rows=historical_rows()+current_rows()
    rows.sort(key=sort_key)

    ratings=defaultdict(lambda:BASE)
    pair_raw=defaultdict(float)
    pair_n=defaultdict(int)
    pair_eff_n=defaultdict(float)

    # 2000+ archive is pair-compatibility-only, with older games decayed.
    for r in historical_compat_rows():
        try:
            y=int(r.get("year") or 0);s1=int(float(r.get("score1","")));s2=int(float(r.get("score2","")))
        except Exception: continue
        a=pref_unit(r,"team1",by_name,by_id);b=pref_unit(r,"team2",by_name,by_id)
        if not a or not b or a==b: continue
        pair=tuple(sorted((a,b)));score=1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        decay=history_decay(y);lvl=effective_level(r);sw=SEASON_W.get(str(r.get("season") or ""),1.0)
        lw=NATIONAL_W.get(str(r.get("season") or ""),1.20) if lvl=="national" else LEVEL_W.get(lvl,1.0)
        md=K_MATCHUP*decay*sw*lw*(score-0.5)
        if a==pair[0]:pair_raw[pair]+=md
        else:pair_raw[pair]-=md
        pair_n[pair]+=1;pair_eff_n[pair]+=decay

    events=[]; contexts=[]
    prior_snapshot=None

    for r in rows:
        try:
            y=int(r.get("year") or 0)
            s1=int(float(r.get("score1",""))); s2=int(float(r.get("score2","")))
        except Exception:
            continue
        a=pref_unit(r,"team1",by_name,by_id)
        b=pref_unit(r,"team2",by_name,by_id)
        if not a or not b or a==b:
            continue

        # Snapshot end-2024 prior before first 2025 game.
        if y>=2025 and prior_snapshot is None:
            prior_snapshot=dict(ratings)

        pair=tuple(sorted((a,b)))
        raw=pair_raw[pair]
        n=pair_n[pair]
        n_eff=pair_eff_n[pair]
        eff=matchup_effect(raw,n_eff)
        bias_a=eff if a==pair[0] else -eff
        bias_b=-bias_a

        ra,rb=ratings[a],ratings[b]
        e=expected(ra+bias_a,rb+bias_b)
        score=1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        lvl=effective_level(r)
        sw=SEASON_W.get(str(r.get("season") or ""),1.0)
        lw=LEVEL_W.get(lvl,0.60)
        if lvl=="national":
            lw=NATIONAL_W.get(str(r.get("season") or ""),1.20)
        k=K_PREF*sw*lw
        delta=k*(score-e)

        before_a,before_b=ra,rb
        ratings[a]+=delta; ratings[b]-=delta

        # Pair compatibility learns residual after general prefecture strength.
        e_pair=expected(ra+bias_a,rb+bias_b)
        md=K_MATCHUP*sw*lw*(score-e_pair)
        if a==pair[0]: pair_raw[pair]+=md
        else: pair_raw[pair]-=md
        pair_n[pair]+=1
        pair_eff_n[pair]+=1.0

        events.append({
            "event_key":event_key(r),"year":y,"season":r.get("season",""),"date":r.get("date",""),
            "tournament":r.get("tournament",""),"round":r.get("round",""),"level":lvl,
            "pref_a":a,"pref_b":b,"score_a":s1,"score_b":s2,
            "rating_a_before":round(before_a,4),"rating_b_before":round(before_b,4),
            "expected_a":round(e,6),"k":round(k,4),"delta_a":round(delta,4),
            "rating_a_after":round(ratings[a],4),"rating_b_after":round(ratings[b],4),
            "matchup_a_before":round(bias_a,4),"matchup_b_before":round(bias_b,4),
            "pair_games_before":n,"source":r.get("_source","")
        })
        if r.get("_source")=="current":
            contexts.append({
                "match_key":event_key(r),"pref1":a,"pref2":b,
                "pref1_rating":round(before_a,4),"pref2_rating":round(before_b,4),
                "pref1_matchup":round(bias_a,4),"pref2_matchup":round(bias_b,4),
                "pref_strength_component1":round(max(-15,min(15,ALPHA_PREF*(before_a-BASE))),4),
                "pref_strength_component2":round(max(-15,min(15,ALPHA_PREF*(before_b-BASE))),4),
                "matchup_component1":round(max(-15,min(15,BETA_MATCHUP*bias_a)),4),
                "matchup_component2":round(max(-15,min(15,BETA_MATCHUP*bias_b)),4),
                "level":lvl
            })

    if prior_snapshot is None: prior_snapshot=dict(ratings)

    # Historical prior for school-rating initialization is frozen at end of 2024.
    prior_rows=[]
    all_units=sorted(set(ratings)|set(prior_snapshot))
    for p in all_units:
        prior_rows.append({"prefecture":p,"history_strength_elo":round(prior_snapshot.get(p,BASE)-BASE,4)})
    write_csv(OUT_PRIOR,["prefecture","history_strength_elo"],prior_rows)

    rating_rows=[{
        "prefecture":p,"rating":round(ratings[p],2),
        "rating_from_1000":round(ratings[p]-BASE,2),
        "historical_prior":round(prior_snapshot.get(p,BASE)-BASE,2)
    } for p in sorted(ratings,key=lambda p:(-ratings[p],p))]
    write_csv(OUT_RATINGS,["prefecture","rating","rating_from_1000","historical_prior"],rating_rows)

    matchup_rows=[]
    for pair in sorted(pair_n):
        a,b=pair; n=pair_n[pair]; n_eff=pair_eff_n[pair]; eff=matchup_effect(pair_raw[pair],n_eff)
        matchup_rows.append({
            "pref_a":a,"pref_b":b,"games":n,"effective_games":round(n_eff,2),
            "compatibility_elo_a":round(eff,4),"compatibility_elo_b":round(-eff,4),
            "raw_pair_elo":round(pair_raw[pair],4),"shrinkage":round(n_eff/(n_eff+8.0),4)
        })
    write_csv(OUT_MATCHUPS,["pref_a","pref_b","games","effective_games","compatibility_elo_a","compatibility_elo_b","raw_pair_elo","shrinkage"],matchup_rows)
    write_csv(OUT_EVENTS, list(events[0].keys()) if events else ["event_key"], events)
    write_csv(OUT_CONTEXT, list(contexts[0].keys()) if contexts else ["match_key"], contexts)
    print(f"Prefecture model: {len(events)} interstate games / {len(ratings)} units / {len(matchup_rows)} pairs")

if __name__=="__main__":
    main()
