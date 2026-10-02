
from __future__ import annotations

from pathlib import Path
from collections import defaultdict
import csv
import math

MATCHES = Path("output/all_matches.csv")
PREF_STRENGTH = Path("master/prefecture_strength_prior.csv")
PREF_MATCHUPS = Path("master/prefecture_matchups.csv")
OUT = Path("output/current_ratings.csv")

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

def get_level(note):
    for p in str(note or "").split(";"):
        if p.startswith("level="):
            return p.split("=", 1)[1]
    return ""

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

def infer_affiliation(rows):
    pref_votes = defaultdict(lambda: defaultdict(float))
    region_votes = defaultdict(lambda: defaultdict(float))

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
        # prefecture-level rows are strongest evidence of school affiliation
        weight = 5.0 if lvl == "prefecture" else 2.0 if pref else 0.5

        for key in ("team1","team2"):
            team = (r.get(key) or "").strip()
            if not team:
                continue
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

def main():
    rows = read_csv(MATCHES)
    if not rows:
        raise SystemExit("output/all_matches.csv missing or empty")

    pref_strength = load_pref_strength()
    matchup_table = load_matchups()
    pref_map, region_map = infer_affiliation(rows)

    state = {}

    def ensure(team):
        if team not in state:
            pref = pref_map.get(team,"")
            hist_prior = pref_strength.get(pref,0.0)
            state[team] = {
                "rating":BASE_RATING + hist_prior,
                "history_prior":hist_prior,
                "games":0,"wins":0,"losses":0,"draws":0,
                "pf":0,"pa":0,
                "prefecture":pref,
                "region":region_map.get(team,""),
                "first_date":"","last_date":"",
            }
        return state[team]

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

        t1 = (r.get("team1") or "").strip()
        t2 = (r.get("team2") or "").strip()
        if not t1 or not t2 or t1 == t2:
            continue
        try:
            s1 = int(float(r.get("score1","")))
            s2 = int(float(r.get("score2","")))
        except Exception:
            continue

        usable.append((r.get("date",""), i, r, t1,t2,s1,s2))

    usable.sort(key=lambda x:(x[0],x[1]))

    for date,_,r,t1,t2,s1,s2 in usable:
        a = ensure(t1)
        b = ensure(t2)

        # Historical prefecture-vs-prefecture compatibility:
        # max ±20 Elo in the historical table, applied only to expected score.
        bias_a = matchup_bias(a["prefecture"], b["prefecture"], matchup_table)
        ea = expected(a["rating"] + bias_a, b["rating"] - bias_a)

        score_a = 1.0 if s1>s2 else 0.0 if s1<s2 else 0.5
        level_w = LEVEL_WEIGHT.get(get_level(r.get("note","")),0.85)
        season_w = SEASON_WEIGHT.get((r.get("season") or "").strip(),1.0)
        k = K_BASE * level_w * season_w * mov_multiplier(s1-s2)
        delta = k * (score_a-ea)

        a["rating"] += delta
        b["rating"] -= delta

        for st,for_,against,result in (
            (a,s1,s2,score_a),
            (b,s2,s1,1.0-score_a),
        ):
            st["games"] += 1
            st["pf"] += for_
            st["pa"] += against
            if result == 1:
                st["wins"] += 1
            elif result == 0:
                st["losses"] += 1
            else:
                st["draws"] += 1
            if not st["first_date"]:
                st["first_date"] = date
            st["last_date"] = date

    ranked = sorted(
        state.items(),
        key=lambda kv:(-kv[1]["rating"],-kv[1]["games"],kv[0])
    )

    OUT.parent.mkdir(parents=True,exist_ok=True)
    fields = [
        "rank","school","rating","base_rating","history_prior",
        "prefecture","region","games","wins","losses","draws",
        "win_pct","runs_for","runs_against","run_diff",
        "first_date","last_date"
    ]
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        w = csv.DictWriter(f,fieldnames=fields)
        w.writeheader()
        for rank,(team,s) in enumerate(ranked,1):
            games = s["games"]
            w.writerow({
                "rank":rank,
                "school":team,
                "rating":round(s["rating"],2),
                "base_rating":BASE_RATING,
                "history_prior":round(s["history_prior"],2),
                "prefecture":s["prefecture"],
                "region":s["region"],
                "games":games,
                "wins":s["wins"],
                "losses":s["losses"],
                "draws":s["draws"],
                "win_pct":round(s["wins"]/games,4) if games else 0,
                "runs_for":s["pf"],
                "runs_against":s["pa"],
                "run_diff":s["pf"]-s["pa"],
                "first_date":s["first_date"],
                "last_date":s["last_date"],
            })

    print(f"Rated matches: {len(usable)}")
    print(f"Rated schools: {len(state)}")
    print("Current Rating v1 build OK")

if __name__ == "__main__":
    main()
