from __future__ import annotations

from pathlib import Path
from collections import defaultdict
import csv
import re
import math

MATCHES = Path("output/all_matches.csv")
PREF_STRENGTH = Path("master/prefecture_strength_prior.csv")
PREF_MATCHUPS = Path("master/prefecture_matchups.csv")
ALIASES = Path("master/school_aliases.csv")
TEAM_MEMBERS = Path("master/team_members.csv")

OUT_RATINGS = Path("output/current_ratings.csv")
OUT_MATCH_EVENTS = Path("output/rating_events.csv")
OUT_SCHOOL_EVENTS = Path("output/rating_school_events.csv")

BASE_RATING = 1000.0
K_BASE = 20.0
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

SEASON_WEIGHT = {
    "spring": 0.95,
    "summer": 1.00,
    "autumn": 1.05,
    "senbatsu": 1.15,
    "koshien": 1.25,
    "jingu": 1.10,
}

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
    try:
        n = int(float(r.get("innings") or 0))
    except Exception:
        n = 0
    finish = (r.get("finish_type") or "").strip().lower()
    text = f"{r.get('note','')} {r.get('round','')} {r.get('tournament','')}"
    if not n:
        m = re.search(r"(?:延長|タイブレーク)?\s*(\d{1,2})回", text)
        if m:
            n = int(m.group(1))
    if not finish:
        if "コールド" in text:
            finish = "cold"
        elif "タイブレーク" in text:
            finish = "tiebreak"
        elif "延長" in text or n > 9:
            finish = "extra"
        else:
            finish = "normal"
    if not n:
        n = 9
    return n, finish or "normal"

def inning_multiplier(r):
    n, finish = inning_info(r)
    if finish == "cold" and 5 <= n <= 8:
        return 1.0 + (9-n)*0.02
    if n > 9:
        return max(0.80, 1.0-(n-9)*0.02)
    return 1.0

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
    # team_label,school,weight
    # Blank/non-positive weights are treated as equal weights.
    groups = defaultdict(list)
    for r in read_csv(TEAM_MEMBERS):
        label = (r.get("team_label") or r.get("team") or "").strip()
        school = canonical((r.get("school") or r.get("canonical_name") or "").strip(), aliases)
        if not label or not school:
            continue
        try:
            weight = float(r.get("weight") or 0)
        except Exception:
            weight = 0.0
        groups[label].append([school, weight])

    out = {}
    for label, members in groups.items():
        positive = [x[1] for x in members if x[1] > 0]
        if len(positive) != len(members):
            weights = [1.0] * len(members)
        else:
            weights = [x[1] for x in members]
        total = sum(weights) or 1.0
        out[label] = [(members[i][0], weights[i] / total) for i in range(len(members))]
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

def infer_affiliation(rows, aliases, unions):
    pref_votes = defaultdict(lambda: defaultdict(float))
    region_votes = defaultdict(lambda: defaultdict(float))

    def members_for(raw):
        if raw in unions:
            return [school for school,_ in unions[raw]]
        return [canonical(raw, aliases)]

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
        lvl = get_level(r.get("note",""))
        weight = 5.0 if lvl == "prefecture" else 2.0 if pref else 0.5

        for key in ("team1","team2"):
            raw = (r.get(key) or "").strip()
            forced = (r.get(f"{key}_canonical") or "").strip()
            if not raw and not forced:
                continue
            teams = [forced] if forced else members_for(raw)
            for team in teams:
                if pref:
                    pref_votes[team][pref] += weight
                if region:
                    region_votes[team][region] += weight

    pref_map = {
        team:max(v.items(), key=lambda kv:kv[1])[0]
        for team,v in pref_votes.items() if v
    }
    region_map = {
        team:max(v.items(), key=lambda kv:kv[1])[0]
        for team,v in region_votes.items() if v
    }
    return pref_map, region_map

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

def main():
    rows = read_csv(MATCHES)
    if not rows:
        raise SystemExit("output/all_matches.csv missing or empty")

    aliases = load_aliases()
    unions = load_team_members(aliases)
    pref_strength = load_pref_strength()
    matchup_table = load_matchups()
    pref_map, region_map = infer_affiliation(rows, aliases, unions)

    state = {}

    def ensure(team):
        if team not in state:
            pref = pref_map.get(team,"")
            hist_prior = pref_strength.get(pref,0.0)
            state[team] = {
                "rating":BASE_RATING + hist_prior,
                "history_prior":hist_prior,
                "games":0,"wins":0,"losses":0,"draws":0,
                "pf":0.0,"pa":0.0,
                "prefecture":pref,
                "region":region_map.get(team,""),
                "first_date":"","last_date":"",
            }
        return state[team]

    def team_members(raw):
        if raw in unions:
            return unions[raw], True
        return [(canonical(raw, aliases), 1.0)], False

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

    match_events = []
    school_events = []

    for date,idx,r,raw1,raw2,s1,s2 in usable:
        forced1 = (r.get("team1_canonical") or "").strip()
        forced2 = (r.get("team2_canonical") or "").strip()
        if forced1:
            members1, union1 = [(forced1,1.0)], False
        else:
            members1, union1 = team_members(raw1)
        if forced2:
            members2, union2 = [(forced2,1.0)], False
        else:
            members2, union2 = team_members(raw2)

        before1 = effective_rating(members1)
        before2 = effective_rating(members2)
        pref1 = effective_pref(members1)
        pref2 = effective_pref(members2)

        bias_a = matchup_bias(pref1, pref2, matchup_table)
        ea = expected(before1 + bias_a, before2 - bias_a)

        score_a = 1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        level = get_level(r.get("note",""))
        level_w = LEVEL_WEIGHT.get(level,0.85)
        season = (r.get("season") or "").strip()
        season_w = SEASON_WEIGHT.get(season,1.0)
        mov = mov_multiplier(s1-s2)
        innings_n, finish_type = inning_info(r)
        inning_w = inning_multiplier(r)
        k = K_BASE * level_w * season_w * mov * inning_w
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
                    "school":school,
                    "raw_team":raw_team,
                    "opponent":opponent,
                    "is_union_member":1 if len(members)>1 else 0,
                    "share":round(weight,6),
                    "rating_before":round(before,4),
                    "rating_delta":round(delta_total*weight,4),
                    "rating_after":round(after,4),
                    "score_for":fs,
                    "score_against":ag,
                })

        result1 = 1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        result2 = 1.0-result1
        apply_bookkeeping(members1,s1,s2,result1,delta1,raw1,raw2)
        apply_bookkeeping(members2,s2,s1,result2,delta2,raw2,raw1)

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
            "score1":s1,
            "team2":raw2,
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
            "level_weight":level_w,
            "season_weight":season_w,
            "mov_multiplier":round(mov,6),
            "innings":innings_n or "",
            "finish_type":finish_type,
            "inning_multiplier":round(inning_w,4),
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
        "rank","school","rating","base_rating","history_prior",
        "prefecture","region","games","wins","losses","draws",
        "win_pct","runs_for","runs_against","run_diff",
        "first_date","last_date"
    ]
    rating_rows = []
    for rank,(team,s) in enumerate(ranked,1):
        games = s["games"]
        rating_rows.append({
            "rank":rank,
            "school":team,
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
        "team1","score1","team2","score2","team1_is_union","team2_is_union",
        "team1_members","team2_members","team1_rating_before","team2_rating_before",
        "team1_expected","team2_expected","k","level_weight","season_weight","mov_multiplier",
        "innings","finish_type","inning_multiplier","matchup_bias_team1","team1_delta","team2_delta","team1_rating_after","team2_rating_after"
    ], match_events)
    write_csv(OUT_SCHOOL_EVENTS, list(school_events[0].keys()) if school_events else [
        "match_key","year","season","date","tournament","round","level","school","raw_team","opponent",
        "is_union_member","share","rating_before","rating_delta","rating_after","score_for","score_against"
    ], school_events)

    print(f"Rated matches: {len(match_events)}")
    print(f"Rated schools: {len(state)}")
    print(f"Union labels configured: {len(unions)}")
    print("Rating events v2 build OK")

if __name__ == "__main__":
    main()
