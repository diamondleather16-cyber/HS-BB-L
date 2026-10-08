from __future__ import annotations

from pathlib import Path
from collections import defaultdict
import csv
import re
import math
import json

MATCHES = Path("output/all_matches.csv")
PREF_STRENGTH = Path("master/prefecture_strength_prior.csv")
PREF_MATCHUPS = Path("master/prefecture_matchups.csv")
PREF_CONTEXT = Path("output/prefecture_match_context.csv")
ALIASES = Path("master/school_aliases.csv")
TEAM_MEMBERS = Path("master/team_members.csv")
SHARED_MASTER = Path("master/school_master_shared.json")
MATCH_EDITS = Path("master/match_edits_shared.json")

OUT_RATINGS = Path("output/current_ratings.csv")
OUT_MATCH_EVENTS = Path("output/rating_events.csv")
OUT_SCHOOL_EVENTS = Path("output/rating_school_events.csv")

BASE_RATING = 1000.0
K_BASE = 20.0
GENERATION_CARRYOVER = 0.65
CURRENT_MIN_YEAR = 2025

LEVEL_WEIGHT = {
    "branch": 0.55,
    "district_qualifier": 0.55,
    "first_qualifier": 0.55,
    "preliminary": 0.55,
    "qualifier_league": 0.50,
    "repechage": 0.50,
    "prefecture": 0.85,
    "regional": 1.15,
    "national": 1.35,
}

# Season axis. National-event season names map back to spring/summer/autumn.
SEASON_WEIGHT = {
    "spring": 0.95,
    "summer": 1.15,
    "autumn": 1.00,
    "senbatsu": 0.95,
    "koshien": 1.15,
    "jingu": 1.00,
}

TOURNAMENT_SIZE_WEIGHT = {
    8: 0.95,
    16: 1.00,
    32: 1.05,
    64: 1.10,
    128: 1.15,
    256: 1.20,
}

WIN_COUNT_WEIGHT = {
    1: 1.00,
    2: 1.02,
    3: 1.04,
    4: 1.06,
    5: 1.08,
    6: 1.10,
    7: 1.12,
}
WIN_COUNT_WEIGHT_CAP = 1.14

# General round/stage importance. Autumn regional tournaments are handled by
# AUTUMN_REGION_ROUND_WEIGHT below.
ROUND_WEIGHT = {
    "default": {
        "round16": 1.00,
        "quarterfinal": 1.05,
        "semifinal": 1.10,
        "final": 1.15,
        "third_place": 1.00,
        "representative_decider": 1.00,
    },
    "prefecture_spring": {
        "round16": 1.00,
        "quarterfinal": 1.05,
        "semifinal": 1.10,
        "final": 1.15,
        "third_place": 1.00,
        "representative_decider": 1.00,
    },
    "prefecture_summer": {
        "round16": 1.00,
        "quarterfinal": 1.15,
        "semifinal": 1.30,
        "final": 1.60,
        "third_place": 1.00,
        "representative_decider": 1.00,
    },
    "prefecture_autumn": {
        "round16": 1.00,
        "quarterfinal": 1.10,
        "semifinal": 1.15,
        "final": 1.20,
        "third_place": 1.20,
        "representative_decider": 1.20,
    },
    "regional": {
        "round16": 1.00,
        "quarterfinal": 1.10,
        "semifinal": 1.20,
        "final": 1.15,
        "third_place": 1.00,
        "representative_decider": 1.00,
    },
    "national": {
        "round16": 1.10,
        "quarterfinal": 1.20,
        "semifinal": 1.30,
        "final": 1.35,
    },
}

# Autumn regional tournament characteristics, based on the selection-border
# pressure unique to each region.
AUTUMN_REGION_ROUND_WEIGHT = {
    "北海道": {"round16":1.00, "quarterfinal":1.05, "semifinal":1.20, "final":1.50},
    "東北":   {"round16":1.00, "quarterfinal":1.35, "semifinal":1.60, "final":1.15},
    "関東":   {"round16":1.30, "quarterfinal":1.60, "semifinal":1.25, "final":1.10},
    "東京":   {"round16":1.00, "quarterfinal":1.05, "semifinal":1.30, "final":1.55},
    "北信越": {"round16":1.00, "quarterfinal":1.20, "semifinal":1.60, "final":1.15},
    "東海":   {"round16":1.00, "quarterfinal":1.30, "semifinal":1.20, "final":1.50},
    "近畿":   {"round16":1.30, "quarterfinal":1.60, "semifinal":1.20, "final":1.10},
    "中国":   {"round16":1.00, "quarterfinal":1.20, "semifinal":1.60, "final":1.15},
    "四国":   {"round16":1.00, "quarterfinal":1.20, "semifinal":1.60, "final":1.15},
    "九州":   {"round16":1.20, "quarterfinal":1.55, "semifinal":1.20, "final":1.10},
}

def normalized_season(season):
    s=str(season or "").strip()
    if s=="senbatsu":
        return "spring"
    if s=="koshien":
        return "summer"
    if s=="jingu":
        return "autumn"
    return s

def round_key(value):
    t = str(value or "").strip().upper()
    compact = re.sub(r"[\s　・･]", "", t)
    if "代表決定" in compact:
        return "representative_decider"
    if "3位" in compact or "三位" in compact:
        return "third_place"
    if "準々決勝" in compact or "QF" in compact or "QUARTERFINAL" in compact:
        return "quarterfinal"
    if "準決勝" in compact or "SF" in compact or "SEMIFINAL" in compact:
        return "semifinal"
    if ("決勝" in compact or compact in {"F","FINAL"}) and "準" not in compact and "代表" not in compact:
        return "final"
    if "4回戦" in compact or "ROUND16" in compact or "R16" in compact:
        return "round16"
    return "other"

def autumn_region_label(r):
    text=" ".join([
        str(r.get("region") or ""),
        str(r.get("prefecture") or ""),
        str(r.get("tournament") or ""),
        str(r.get("note") or ""),
    ])
    # Order matters: 関東 before 東京 is safe because strings are distinct.
    for name in ("北海道","東北","関東","東京","北信越","東海","近畿","中国","四国","九州"):
        if name in text:
            return name
    reg=str(r.get("region") or "").strip()
    return REGION_LABEL.get(reg, reg)

def round_multiplier(r, level, season):
    # National tournaments use tournament-internal match position, never round text.
    if level == "national":
        rk = str(r.get("_national_stage") or "other")
        return float(ROUND_WEIGHT["national"].get(rk,1.0)), rk, "national_match_count"

    rk = round_key(r.get("round",""))
    if rk == "other":
        return 1.0, rk, "base"

    ns=normalized_season(season)
    if level == "regional" and ns == "autumn":
        region_name=autumn_region_label(r)
        table=AUTUMN_REGION_ROUND_WEIGHT.get(region_name)
        if table:
            return float(table.get(rk,1.0)), rk, f"autumn_region:{region_name}"
        return float(ROUND_WEIGHT["regional"].get(rk,1.0)), rk, "regional_autumn_fallback"

    if level == "regional":
        table, rule = ROUND_WEIGHT["regional"], "regional"
    elif level == "prefecture" and ns == "summer":
        table, rule = ROUND_WEIGHT["prefecture_summer"], "prefecture_summer"
    elif level == "prefecture" and ns == "autumn":
        table, rule = ROUND_WEIGHT["prefecture_autumn"], "prefecture_autumn"
    elif level == "prefecture" and ns == "spring":
        table, rule = ROUND_WEIGHT["prefecture_spring"], "prefecture_spring"
    else:
        table, rule = ROUND_WEIGHT["default"], "default"

    return float(table.get(rk,1.0)), rk, rule

def tournament_group_key(r):
    return (
        str(r.get("year") or "").strip(),
        str(r.get("season") or "").strip(),
        str(r.get("region") or "").strip(),
        str(r.get("prefecture") or "").strip(),
        str(r.get("tournament") or "").strip(),
        get_level(r.get("note","")),
    )

def next_power_tournament_level(team_count):
    n=max(2,int(team_count or 0))
    level=8
    while level<n and level<256:
        level*=2
    return min(max(level,8),256)

def tournament_size_weight(level):
    return float(TOURNAMENT_SIZE_WEIGHT.get(int(level or 16),1.0))

def win_count_weight(next_win_number):
    n=max(1,int(next_win_number or 1))
    if n>=8:
        return WIN_COUNT_WEIGHT_CAP
    return float(WIN_COUNT_WEIGHT.get(n,1.0))

def apply_tournament_metadata(usable):
    """Precompute tournament size and national terminal stages.

    Tournament size uses unique participating teams, rounded up to
    8/16/32/64/128/256. This handles byes better than relying on round names.
    """
    groups=defaultdict(list)
    for pos,item in enumerate(usable):
        date,idx,r,raw1,raw2,s1,s2=item
        groups[tournament_group_key(r)].append((date,idx,pos,r,raw1,raw2))

    for key,items in groups.items():
        teams=set()
        for _,_,_,_,a,b in items:
            if a: teams.add(str(a).strip())
            if b: teams.add(str(b).strip())
        size_level=next_power_tournament_level(len(teams))
        for _,_,_,r,_,_ in items:
            r["_tournament_team_count"]=len(teams)
            r["_tournament_level"]=size_level
            r["_tournament_size_weight"]=tournament_size_weight(size_level)

        # National stage is based only on match position inside that tournament.
        if key[-1]=="national":
            ordered=sorted(items,key=lambda x:(x[0],x[1]))
            total=len(ordered)
            for ordinal,(_,_,_,r,_,_) in enumerate(ordered,1):
                from_end=total-ordinal+1
                if from_end==1:
                    stage="final"
                elif from_end<=3:
                    stage="semifinal"
                elif from_end<=7:
                    stage="quarterfinal"
                elif from_end<=15:
                    stage="round16"
                else:
                    stage="other"
                r["_national_stage"]=stage
                r["_national_match_no"]=ordinal
                r["_national_match_total"]=total
                r["_national_from_end"]=from_end


REGION_LABEL = {
    "hokkaido":"北海道",
    "tohoku":"東北",
    "kanto":"関東・東京",
    "kanto_tokyo":"関東・東京",
    "hokushinetsu":"北信越",
    "tokai":"東海",
    "kinki":"近畿",
    "chugoku":"中国",
    "shikoku":"四国",
    "kyushu":"九州",
}

def read_csv(path):
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

def get_level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=", 1)[1]
    return ""


def inning_info(r):
    # Explicit columns are trusted only when they are plausible and were not
    # inferred from round/tournament text. Otherwise, inspect note only.
    try:
        n = int(float(r.get("innings") or 0))
    except Exception:
        n = 0
    finish = (r.get("finish_type") or "").strip().lower()
    note = str(r.get("note") or "")

    # Explicit finish annotations in note are authoritative.
    cold = re.search(r"(?<!\d)([5-8])回コールド", note)
    extra = re.search(r"延長\s*(1\d|2\d|30)回", note)
    if cold:
        return int(cold.group(1)), "cold"
    if extra:
        return int(extra.group(1)), "extra"

    # If explicit structured fields are present, accept only consistent values.
    if finish == "cold" and 5 <= n <= 8:
        return n, "cold"
    if finish == "extra" and n >= 10:
        return n, "extra"
    if finish == "normal" and n == 9:
        return 9, "normal"

    # Never read "2回戦", "3回戦" or "第108回大会" as innings.
    return 9, "normal"

def inning_multiplier(r):
    n, finish = inning_info(r)
    if finish == "cold" and 5 <= n <= 8:
        return 1.0 + (9-n)*0.02
    if n > 9:
        return max(0.80, 1.0-(n-9)*0.02)
    return 1.0



def _score_key(v):
    try:
        return str(int(float(v)))
    except Exception:
        return str(v or "").strip()

def _edit_key(r):
    if str(r.get("edit_key") or "").strip():
        return str(r.get("edit_key") or "").strip()
    if str(r.get("manual_id") or "").strip():
        return str(r.get("manual_id") or "").strip()
    return "¦".join([
        str(r.get("year") or "").strip(),
        str(r.get("season") or "").strip(),
        str(r.get("date") or "").strip(),
        str(r.get("tournament") or "").strip(),
        str(r.get("round") or "").strip(),
        str(r.get("team1") or "").strip(),
        _score_key(r.get("score1")),
        str(r.get("team2") or "").strip(),
        _score_key(r.get("score2")),
    ])

def load_match_team_links():
    links={}
    if not MATCH_EDITS.exists():
        return links
    try:
        state=json.loads(MATCH_EDITS.read_text(encoding="utf-8-sig"))
        for x in state.get("team_links",[]) or []:
            key=str(x.get("edit_key") or "").strip()
            side=str(x.get("side") or "").strip()
            if key and side in {"team1","team2"}:
                links[(key,side)]={
                    "school_id":str(x.get("school_id") or "").strip(),
                    "canonical_name":str(x.get("canonical_name") or "").strip(),
                }
    except Exception as e:
        print(f"warning: match edit links load failed: {e}")
    return links

def force_match_link_identity(r, side, links):
    link=links.get((_edit_key(r),side))
    if not link:
        return
    if link.get("school_id"):
        r[f"{side}_school_id"]=link["school_id"]
    if link.get("canonical_name"):
        r[f"{side}_canonical"]=link["canonical_name"]

MASTER_NAME_INDEX = defaultdict(list)

def load_shared_master():
    global MASTER_NAME_INDEX
    by_id = {}
    MASTER_NAME_INDEX = defaultdict(list)
    if not SHARED_MASTER.exists():
        return by_id
    try:
        data = json.loads(SHARED_MASTER.read_text(encoding="utf-8-sig"))
        for s in data.get("schools", []):
            sid = str(s.get("school_id") or "").strip()
            if not sid:
                continue
            meta = {
                "school_id": sid,
                "canonical_name": str(s.get("canonical_name") or "").strip(),
                "prefecture": str(s.get("prefecture") or "").strip(),
                "region": str(s.get("district") or "").strip(),
                "aliases": [str(a).strip() for a in (s.get("aliases") or []) if str(a).strip()],
            }
            by_id[sid] = meta
            for name in [meta["canonical_name"], *meta["aliases"]]:
                if name and not any(x.get("school_id")==sid for x in MASTER_NAME_INDEX[name]):
                    MASTER_NAME_INDEX[name].append(meta)
    except Exception as e:
        print(f"warning: shared master load failed: {e}")
    return by_id

def row_pref_hint(r, side):
    p=str(r.get(f"{side}_prefecture") or "").strip()
    if p:
        return p
    note=str(r.get("note") or "")
    m=re.search(rf"(?:^|;){re.escape(side)}_pref=([^;]+)",note)
    if m:
        return m.group(1).strip()
    lvl=effective_level(r)
    if lvl in {"prefecture","branch","district_qualifier","first_qualifier","preliminary","qualifier_league","repechage"}:
        return str(r.get("prefecture") or "").strip()
    return ""

def row_identity(r, side, aliases, master_by_id):
    raw = str(r.get(side) or "").strip()
    sid = str(r.get(f"{side}_school_id") or "").strip()
    forced = str(r.get(f"{side}_canonical") or "").strip()

    if sid:
        meta = master_by_id.get(sid, {})
        display = meta.get("canonical_name") or forced or raw or sid
        return f"@SID:{sid}", display, sid

    if forced:
        # Per-match canonical assignment is authoritative.
        forced_candidates=MASTER_NAME_INDEX.get(forced,[])
        if len(forced_candidates)==1:
            meta=forced_candidates[0]
            return f"@SID:{meta['school_id']}", meta.get("canonical_name") or forced, meta["school_id"]
        return forced, forced, ""

    candidates=MASTER_NAME_INDEX.get(raw,[])
    pref=row_pref_hint(r,side)
    if pref and candidates:
        exact=[m for m in candidates if str(m.get("prefecture") or "").strip()==pref]
        if len(exact)==1:
            meta=exact[0]
            return f"@SID:{meta['school_id']}", meta.get("canonical_name") or raw, meta["school_id"]

    if len(candidates)==1:
        meta=candidates[0]
        return f"@SID:{meta['school_id']}", meta.get("canonical_name") or raw, meta["school_id"]

    # Ambiguous same-name aliases must not globally inherit another prefecture's school.
    if len(candidates)>1:
        return raw, raw, ""

    display = canonical(raw, aliases)
    return display, display, ""


def identity_meta(identity, display, school_id, master_by_id):
    if school_id:
        m = master_by_id.get(school_id, {})
        return {
            "school_id": school_id,
            "school": m.get("canonical_name") or display,
            "prefecture": m.get("prefecture") or "",
            "region": m.get("region") or "",
        }
    return {"school_id":"", "school":display, "prefecture":"", "region":""}

def load_aliases():
    # Accepted columns:
    # alias,canonical_name
    # alias,school
    out = {}
    for r in read_csv(ALIASES):
        alias = (r.get("alias") or r.get("raw_name") or "").strip()
        canonical = (r.get("canonical_name") or r.get("school") or "").strip()
        if alias and canonical:
            out[alias] = canonical
    return out

def canonical(name, aliases):
    name = (name or "").strip()
    return aliases.get(name, name)

def load_team_members(aliases):
    groups = defaultdict(list)
    for r in read_csv(TEAM_MEMBERS):
        uid=(r.get("union_id") or "").strip(); label=(r.get("team_label") or r.get("team") or "").strip()
        sid=(r.get("school_id") or "").strip(); school=canonical((r.get("school") or r.get("canonical_name") or "").strip(),aliases)
        key=uid or label
        if not key or not (sid or school): continue
        try: weight=float(r.get("weight") or 0)
        except Exception: weight=0.0
        groups[key].append([school,weight,sid])
        if label and label!=key: groups[label].append([school,weight,sid])
    out={}
    for key,members in groups.items():
        weights=[x[1] for x in members]
        if not all(w>0 for w in weights): weights=[1.0]*len(members)
        total=sum(weights) or 1.0
        out[key]=[(members[i][0],weights[i]/total,members[i][2]) for i in range(len(members))]
    return out


def load_pref_strength():
    out = {}
    for r in read_csv(PREF_STRENGTH):
        pref = (r.get("prefecture") or "").strip()
        if pref:
            try:
                out[pref] = float(r.get("history_strength_elo") or 0)
            except Exception:
                out[pref] = 0.0
    return out

def load_matchups():
    out = {}
    for r in read_csv(PREF_MATCHUPS):
        a = (r.get("pref_a") or "").strip()
        b = (r.get("pref_b") or "").strip()
        if not a or not b:
            continue
        try:
            out[(a,b)] = (
                float(r.get("compatibility_elo_a") or 0),
                float(r.get("compatibility_elo_b") or 0),
            )
        except Exception:
            out[(a,b)] = (0.0, 0.0)
    return out

def matchup_bias(pref1, pref2, table):
    if not pref1 or not pref2 or pref1 == pref2:
        return 0.0
    a,b = sorted((pref1,pref2))
    vals = table.get((a,b))
    if not vals:
        return 0.0
    return vals[0] if pref1 == a else vals[1]


def load_pref_context():
    out={}
    for r in read_csv(PREF_CONTEXT):
        k=(r.get("match_key") or "").strip()
        if k: out[k]=r
    return out

def effective_level(r):
    season=normalized_season(r.get("season",""))
    text=" ".join(str(r.get(k) or "") for k in ("tournament","round","note","prefecture","region"))
    lvl=get_level(r.get("note","")) or "prefecture"
    if "北海道" in text or "北北海道" in text or "南北海道" in text:
        if season in ("spring","autumn"):
            if re.search(r"全道|北海道大会|道大会",text) and not re.search(r"支部|支庁",text):
                return "regional"
            if re.search(r"支部|支庁",text):
                return "prefecture"
        if season=="summer": return "prefecture"
    if "東京" in text or "東東京" in text or "西東京" in text:
        if season=="spring":
            if re.search(r"一次|1次|１次|予選",text) and not re.search(r"都大会|本大会",text):
                return "district_qualifier"
            return "prefecture"
        if season=="summer": return "prefecture"
        if season=="autumn":
            if re.search(r"一次|1次|１次|ブロック",text) and not re.search(r"都大会|本大会",text):
                return "prefecture"
            rk=round_key(r.get("round",""))
            return "regional" if rk in ("round16","quarterfinal","semifinal","final","third_place","representative_decider") else "prefecture"
    return lvl

def infer_affiliation(rows, aliases, unions, master_by_id):
    pref_votes = defaultdict(lambda: defaultdict(float))
    region_votes = defaultdict(lambda: defaultdict(float))
    display_map = {}
    id_map = {}

    for r in rows:
        try:
            y = int(r.get("year") or 0)
        except Exception:
            continue
        if y < CURRENT_MIN_YEAR:
            continue

        pref = (r.get("prefecture") or "").strip()
        region_raw = (r.get("region") or "").strip()
        region = REGION_LABEL.get(region_raw, "")
        lvl = effective_level(r)
        weight = 5.0 if lvl == "prefecture" else 2.0 if pref else 0.5

        for side in ("team1","team2"):
            raw = (r.get(side) or "").strip()
            identity, display, sid = row_identity(r, side, aliases, master_by_id)
            if not raw and not display:
                continue

            if sid:
                members = [(identity, display, sid)]
            elif (((r.get(f"{side}_union_id") or "").strip() in unions) or raw in unions) and not (r.get(f"{side}_canonical") or "").strip():
                ukey=(r.get(f"{side}_union_id") or "").strip() or raw
                members=[]
                for school,_w,usid in unions[ukey]:
                    ident=f"@SID:{usid}" if usid else canonical(school,aliases)
                    disp=master_by_id.get(usid,{}).get("canonical_name") if usid else canonical(school,aliases)
                    members.append((ident,disp or school,usid))
            else:
                members = [(identity, display, sid)]

            for ident, disp, member_sid in members:
                display_map[ident] = disp
                id_map[ident] = member_sid
                meta = master_by_id.get(member_sid, {}) if member_sid else {}
                p = meta.get("prefecture") or pref
                reg = meta.get("region") or region
                if p:
                    pref_votes[ident][p] += weight
                if reg:
                    region_votes[ident][reg] += weight

    pref_map = {
        team:max(v.items(), key=lambda kv:kv[1])[0]
        for team,v in pref_votes.items() if v
    }
    region_map = {
        team:max(v.items(), key=lambda kv:kv[1])[0]
        for team,v in region_votes.items() if v
    }
    return pref_map, region_map, display_map, id_map

def expected(r1,r2):
    return 1.0 / (1.0 + 10 ** ((r2-r1)/400.0))

def mov_multiplier(diff):
    d = abs(diff)
    if d <= 1:
        return 1.0
    return min(1.55, 1.0 + 0.22 * math.log(d))

def match_key(r, t1, t2, s1, s2):
    return "|".join([
        str(r.get("year","")),
        str(r.get("season","")),
        str(r.get("date","")),
        str(r.get("tournament","")),
        str(r.get("round","")),
        t1, str(s1), t2, str(s2),
    ])


def is_autumn_generation_season(season):
    # jingu is part of the autumn generation; ordinary autumn official games
    # normally occur before it, so the reset will already have happened.
    return normalized_season(season) == "autumn"

def apply_generation_reset_if_needed(members, year, date, season, seen, school_events,
                                     tournament, round_name, level):
    """At each school's first autumn official appearance of the year,
    carry 65% of the deviation from 1000 into the new generation.
    """
    if not is_autumn_generation_season(season):
        return

    for school, weight in members:
        key=(school,int(year))
        if key in seen:
            continue
        st=ensure_for_generation_reset(school)
        before=float(st["rating"])
        after=BASE_RATING + (before-BASE_RATING)*GENERATION_CARRYOVER
        delta=after-before
        st["rating"]=after
        seen.add(key)

        school_events.append({
            "match_key":f"GENRESET|{year}|{school}",
            "year":year,
            "season":season,
            "date":date,
            "tournament":tournament,
            "round":round_name,
            "level":level,
            "tournament_level":"",
            "tournament_size_weight":"",
            "round_weight":"",
            "round_rule":"generation_reset",
            "win_count_weight":"",
            "school_id":st.get("school_id",""),
            "school":st.get("school") or school,
            "raw_team":st.get("school") or school,
            "opponent":"世代交代補正",
            "is_union_member":0,
            "share":1.0,
            "rating_before":round(before,4),
            "rating_delta":round(delta,4),
            "rating_after":round(after,4),
            "score_for":"",
            "score_against":"",
            "event_type":"generation_reset",
            "event_note":f"夏→秋 世代交代：1000からの乖離を65%持越し（{before:.2f}→{after:.2f}）",
        })

def main():
    rows = read_csv(MATCHES)
    if not rows:
        raise SystemExit("output/all_matches.csv missing or empty")

    aliases = load_aliases()
    unions = load_team_members(aliases)
    master_by_id = load_shared_master()
    match_team_links = load_match_team_links()
    pref_strength = load_pref_strength()
    matchup_table = load_matchups()
    pref_context = load_pref_context()
    pref_map, region_map, display_map, id_map = infer_affiliation(rows, aliases, unions, master_by_id)

    state = {}

    def ensure(team):
        if team not in state:
            sid = id_map.get(team,"")
            master_meta = master_by_id.get(sid,{}) if sid else {}
            pref = master_meta.get("prefecture") or pref_map.get(team,"")
            region = master_meta.get("region") or region_map.get(team,"")
            hist_prior = pref_strength.get(pref,0.0)
            state[team] = {
                "rating":BASE_RATING + hist_prior,
                "history_prior":hist_prior,
                "games":0,"wins":0,"losses":0,"draws":0,
                "pf":0.0,"pa":0.0,
                "prefecture":pref,
                "region":region,
                "school_id":sid,
                "school":master_meta.get("canonical_name") or display_map.get(team,team),
                "first_date":"","last_date":"",
            }
        return state[team]

    # Expose the closure to the generation-reset helper used inside main().
    global ensure_for_generation_reset
    ensure_for_generation_reset = ensure

    def team_members(raw,row=None,side=None):
        union_id=(row.get(f"{side}_union_id") or "").strip() if row is not None and side else ""
        key=union_id if union_id in unions else raw
        is_union=(row is not None and side and (str(row.get(f"{side}_type") or "")=="union" or bool(union_id))) or key in unions
        if key in unions and is_union:
            members=[]
            for school,weight,sid in unions[key]:
                ident=f"@SID:{sid}" if sid else canonical(school,aliases)
                display=master_by_id.get(sid,{}).get("canonical_name") if sid else canonical(school,aliases)
                display_map.setdefault(ident,display or school); id_map.setdefault(ident,sid or "")
                members.append((ident,weight))
            return members,True
        ident=canonical(raw,aliases); display_map.setdefault(ident,ident); id_map.setdefault(ident,"")
        return [(ident,1.0)],False

    def effective_rating(members):
        return sum(ensure(school)["rating"] * weight for school,weight in members)

    def effective_pref(members):
        # Weighted vote; if mixed prefectures, strongest share wins only for compatibility lookup.
        votes = defaultdict(float)
        for school,weight in members:
            pref = ensure(school)["prefecture"]
            if pref:
                votes[pref] += weight
        return max(votes.items(), key=lambda x:x[1])[0] if votes else ""

    usable = []
    for i,r in enumerate(rows):
        try:
            year = int(r.get("year") or 0)
        except Exception:
            continue
        if year < CURRENT_MIN_YEAR:
            continue
        if "exclude_from_rating=1" in str(r.get("note","")):
            continue

        raw1 = (r.get("team1") or "").strip()
        raw2 = (r.get("team2") or "").strip()
        if not raw1 or not raw2 or raw1 == raw2:
            continue
        try:
            s1 = int(float(r.get("score1","")))
            s2 = int(float(r.get("score2","")))
        except Exception:
            continue

        usable.append((r.get("date",""), i, r, raw1,raw2,s1,s2))

    usable.sort(key=lambda x:(x[0],x[1]))
    apply_tournament_metadata(usable)

    match_events = []
    school_events = []
    tournament_wins = defaultdict(int)
    generation_reset_seen = set()

    for date,idx,r,raw1,raw2,s1,s2 in usable:
        force_match_link_identity(r,"team1",match_team_links)
        force_match_link_identity(r,"team2",match_team_links)
        ident1, display1, sid1 = row_identity(r,"team1",aliases,master_by_id)
        ident2, display2, sid2 = row_identity(r,"team2",aliases,master_by_id)
        display_map[ident1]=display1; id_map[ident1]=sid1
        display_map[ident2]=display2; id_map[ident2]=sid2

        if sid1 or (r.get("team1_canonical") or "").strip():
            members1, union1 = [(ident1,1.0)], False
        else:
            members1, union1 = team_members(raw1,r,"team1")
        if sid2 or (r.get("team2_canonical") or "").strip():
            members2, union2 = [(ident2,1.0)], False
        else:
            members2, union2 = team_members(raw2,r,"team2")

        try:
            generation_year=int(r.get("year") or 0)
        except Exception:
            generation_year=0
        level_for_reset=get_level(r.get("note",""))
        season_for_reset=(r.get("season") or "").strip()
        apply_generation_reset_if_needed(
            members1,generation_year,date,season_for_reset,generation_reset_seen,school_events,
            r.get("tournament",""),r.get("round",""),level_for_reset
        )
        apply_generation_reset_if_needed(
            members2,generation_year,date,season_for_reset,generation_reset_seen,school_events,
            r.get("tournament",""),r.get("round",""),level_for_reset
        )

        before1 = effective_rating(members1)
        before2 = effective_rating(members2)
        pref1 = effective_pref(members1)
        pref2 = effective_pref(members2)

        key_for_pref = match_key(r, raw1, raw2, s1, s2)
        pc = pref_context.get(key_for_pref,{})
        try:
            pref_strength1=float(pc.get("pref_strength_component1") or 0)
            pref_strength2=float(pc.get("pref_strength_component2") or 0)
            matchup_component1=float(pc.get("matchup_component1") or 0)
            matchup_component2=float(pc.get("matchup_component2") or 0)
            pref_rating1=float(pc.get("pref1_rating") or 1000)
            pref_rating2=float(pc.get("pref2_rating") or 1000)
            matchup_raw1=float(pc.get("pref1_matchup") or 0)
            matchup_raw2=float(pc.get("pref2_matchup") or 0)
        except Exception:
            pref_strength1=pref_strength2=matchup_component1=matchup_component2=0.0
            pref_rating1=pref_rating2=1000.0
            matchup_raw1=matchup_raw2=0.0
        bias_a = matchup_bias(pref1, pref2, matchup_table) if not pc else matchup_raw1
        adjusted1 = before1 + pref_strength1 + matchup_component1
        adjusted2 = before2 + pref_strength2 + matchup_component2
        ea = expected(adjusted1, adjusted2)

        score_a = 1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        level = effective_level(r)
        level_w = LEVEL_WEIGHT.get(level,0.85)
        season = (r.get("season") or "").strip()
        season_w = SEASON_WEIGHT.get(season,1.0)
        round_w, round_key_name, round_rule = round_multiplier(r, level, season)
        tournament_level = int(r.get("_tournament_level") or 16)
        tournament_team_count = int(r.get("_tournament_team_count") or 0)
        tournament_w = float(r.get("_tournament_size_weight") or 1.0)

        tournament_key = tournament_group_key(r)
        team1_win_key = (tournament_key, ident1)
        team2_win_key = (tournament_key, ident2)
        team1_next_win = tournament_wins[team1_win_key] + 1
        team2_next_win = tournament_wins[team2_win_key] + 1
        team1_win_w = win_count_weight(team1_next_win)
        team2_win_w = win_count_weight(team2_next_win)
        win_w = math.sqrt(team1_win_w * team2_win_w)

        mov = mov_multiplier(s1-s2)
        innings_n, finish_type = inning_info(r)
        inning_w = inning_multiplier(r)
        k = K_BASE * tournament_w * level_w * season_w * round_w * win_w * mov * inning_w
        delta1 = k * (score_a-ea)
        delta2 = -delta1
        key = match_key(r, raw1, raw2, s1, s2)

        # Distribute total team delta among constituent schools.
        # This preserves the match's total rating mass: +delta / -delta.
        before_members1 = {school:ensure(school)["rating"] for school,_ in members1}
        before_members2 = {school:ensure(school)["rating"] for school,_ in members2}

        for school,weight in members1:
            st = ensure(school)
            st["rating"] += delta1 * weight
        for school,weight in members2:
            st = ensure(school)
            st["rating"] += delta2 * weight

        after1 = effective_rating(members1)
        after2 = effective_rating(members2)

        # Individual school bookkeeping is weighted for union appearances.
        # A three-school union counts as 1/3 appearance for each member.
        def apply_bookkeeping(members, fs, ag, result, delta_total, raw_team, opponent):
            for school,weight in members:
                st = ensure(school)
                # 連合出場でも、その学校には「1試合出場」として記録する。
                # Rating変動だけをweightで分配し、games/wins/lossesは整数で保持する。
                st["games"] += 1
                st["pf"] += fs * weight
                st["pa"] += ag * weight
                if result == 1:
                    st["wins"] += 1
                elif result == 0:
                    st["losses"] += 1
                else:
                    st["draws"] += 1
                if not st["first_date"]:
                    st["first_date"] = date
                st["last_date"] = date

                before = before_members1[school] if members is members1 else before_members2[school]
                after = st["rating"]
                school_events.append({
                    "match_key":key,
                    "year":r.get("year",""),
                    "season":season,
                    "date":date,
                    "tournament":r.get("tournament",""),
                    "round":r.get("round",""),
                    "level":level,
                    "tournament_level":tournament_level,
                    "tournament_size_weight":round(tournament_w,4),
                    "round_weight":round(round_w,4),
                    "round_rule":round_rule,
                    "win_count_weight":round(win_w,4),
                    "school_id":st.get("school_id",""),
                    "school":st.get("school") or display_map.get(school,school),
                    "raw_team":raw_team,
                    "opponent":opponent,
                    "is_union_member":1 if len(members)>1 else 0,
                    "share":round(weight,6),
                    "rating_before":round(before,4),
                    "rating_delta":round(delta_total*weight,4),
                    "rating_after":round(after,4),
                    "score_for":fs,
                    "score_against":ag,
                    "event_type":"match",
                    "event_note":"",
                })

        result1 = 1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        result2 = 1.0-result1
        apply_bookkeeping(members1,s1,s2,result1,delta1,raw1,raw2)
        apply_bookkeeping(members2,s2,s1,result2,delta2,raw2,raw1)

        if s1 > s2:
            tournament_wins[team1_win_key] += 1
        elif s2 > s1:
            tournament_wins[team2_win_key] += 1

        match_events.append({
            "match_key":key,
            "year":r.get("year",""),
            "season":season,
            "date":date,
            "region":r.get("region",""),
            "prefecture":r.get("prefecture",""),
            "tournament":r.get("tournament",""),
            "round":r.get("round",""),
            "level":level,
            "team1":raw1,
            "team1_school_id":sid1,
            "score1":s1,
            "team2":raw2,
            "team2_school_id":sid2,
            "score2":s2,
            "team1_is_union":1 if union1 else 0,
            "team2_is_union":1 if union2 else 0,
            "team1_members":"|".join(f"{s}:{w:.6f}" for s,w in members1),
            "team2_members":"|".join(f"{s}:{w:.6f}" for s,w in members2),
            "team1_rating_before":round(before1,4),
            "team2_rating_before":round(before2,4),
            "team1_expected":round(ea,6),
            "team2_expected":round(1-ea,6),
            "k":round(k,4),
            "tournament_team_count":tournament_team_count,
            "tournament_level":tournament_level,
            "tournament_size_weight":round(tournament_w,4),
            "level_weight":level_w,
            "season_weight":season_w,
            "round_weight":round(round_w,4),
            "round_key":round_key_name,
            "round_rule":round_rule,
            "national_match_no":r.get("_national_match_no",""),
            "national_match_total":r.get("_national_match_total",""),
            "national_from_end":r.get("_national_from_end",""),
            "team1_next_win":team1_next_win,
            "team2_next_win":team2_next_win,
            "team1_win_count_weight":round(team1_win_w,4),
            "team2_win_count_weight":round(team2_win_w,4),
            "win_count_weight":round(win_w,4),
            "mov_multiplier":round(mov,6),
            "innings":innings_n or "",
            "finish_type":finish_type,
            "inning_multiplier":round(inning_w,4),
            "pref1_rating":round(pref_rating1,4),
            "pref2_rating":round(pref_rating2,4),
            "pref_strength_component1":round(pref_strength1,4),
            "pref_strength_component2":round(pref_strength2,4),
            "pref1_matchup":round(matchup_raw1,4),
            "pref2_matchup":round(matchup_raw2,4),
            "matchup_component1":round(matchup_component1,4),
            "matchup_component2":round(matchup_component2,4),
            "team1_expected_rating":round(adjusted1,4),
            "team2_expected_rating":round(adjusted2,4),
            "matchup_bias_team1":round(bias_a,4),
            "team1_delta":round(delta1,4),
            "team2_delta":round(delta2,4),
            "team1_rating_after":round(after1,4),
            "team2_rating_after":round(after2,4),
        })

    ranked = sorted(
        state.items(),
        key=lambda kv:(-kv[1]["rating"],-kv[1]["games"],kv[0])
    )

    rating_fields = [
        "rank","school_id","school","rating","base_rating","history_prior",
        "prefecture","region","games","wins","losses","draws",
        "win_pct","runs_for","runs_against","run_diff",
        "first_date","last_date"
    ]
    rating_rows = []
    for rank,(team,s) in enumerate(ranked,1):
        games = s["games"]
        rating_rows.append({
            "rank":rank,
            "school_id":s.get("school_id",""),
            "school":s.get("school") or display_map.get(team,team),
            "rating":round(s["rating"],2),
            "base_rating":BASE_RATING,
            "history_prior":round(s["history_prior"],2),
            "prefecture":s["prefecture"],
            "region":s["region"],
            "games":int(games),
            "wins":int(s["wins"]),
            "losses":int(s["losses"]),
            "draws":int(s["draws"]),
            "win_pct":round(s["wins"]/games,4) if games else 0,
            "runs_for":round(s["pf"],2),
            "runs_against":round(s["pa"],2),
            "run_diff":round(s["pf"]-s["pa"],2),
            "first_date":s["first_date"],
            "last_date":s["last_date"],
        })

    write_csv(OUT_RATINGS, rating_fields, rating_rows)
    write_csv(OUT_MATCH_EVENTS, list(match_events[0].keys()) if match_events else [
        "match_key","year","season","date","region","prefecture","tournament","round","level",
        "team1","team1_school_id","score1","team2","team2_school_id","score2","team1_is_union","team2_is_union",
        "team1_members","team2_members","team1_rating_before","team2_rating_before",
        "team1_expected","team2_expected","k","tournament_team_count","tournament_level","tournament_size_weight","level_weight","season_weight","round_weight","round_key","round_rule","national_match_no","national_match_total","national_from_end","team1_next_win","team2_next_win","team1_win_count_weight","team2_win_count_weight","win_count_weight","mov_multiplier",
        "innings","finish_type","inning_multiplier","pref1_rating","pref2_rating","pref_strength_component1","pref_strength_component2","pref1_matchup","pref2_matchup","matchup_component1","matchup_component2","team1_expected_rating","team2_expected_rating","matchup_bias_team1","team1_delta","team2_delta","team1_rating_after","team2_rating_after"
    ], match_events)
    write_csv(OUT_SCHOOL_EVENTS, list(school_events[0].keys()) if school_events else [
        "match_key","year","season","date","tournament","round","level","tournament_level","tournament_size_weight","round_weight","round_rule","win_count_weight","school_id","school","raw_team","opponent",
        "is_union_member","share","rating_before","rating_delta","rating_after","score_for","score_against","event_type","event_note"
    ], school_events)

    print(f"Rated matches: {len(match_events)}")
    print(f"Rated schools: {len(state)}")
    print(f"Union labels configured: {len(unions)}")
    print("Rating events v2 build OK")

if __name__ == "__main__":
    main()
