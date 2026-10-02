from __future__ import annotations

from pathlib import Path
import csv
import math
from collections import defaultdict

SOURCE = Path("history/2017_2024_regional_national.csv")
CONFIG = Path("master/history_model_config.csv")
MATCHUP_OUT = Path("master/prefecture_matchups.csv")
STRENGTH_OUT = Path("master/prefecture_strength_prior.csv")

TOURNEY_KEY = {
    "春季地区": "spring_regional_weight",
    "秋季地区": "autumn_regional_weight",
    "明治神宮": "jingu_weight",
    "選抜": "senbatsu_weight",
    "選手権": "koshien_weight",
}

def load_config():
    with CONFIG.open("r",encoding="utf-8-sig",newline="") as f:
        rows = list(csv.DictReader(f))
    return {r["key"]: float(r["value"]) for r in rows}

def game_weight(row, cfg):
    year = int(row["year"])
    decay = cfg["decay_per_year"] ** (2024 - year)
    t = cfg[TOURNEY_KEY[row["tournament_type"]]]
    return decay * t

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def main():
    cfg = load_config()

    with SOURCE.open("r",encoding="utf-8-sig",newline="") as f:
        rows = list(csv.DictReader(f))

    # canonical unordered prefecture pair
    pair = defaultdict(lambda: {
        "games":0, "weighted_games":0.0,
        "wins_a":0, "draws":0, "wins_b":0,
        "weighted_points_a":0.0,
        "run_diff_a":0, "weighted_run_diff_a":0.0,
    })

    pref_total = defaultdict(lambda: {
        "games":0, "weighted_games":0.0,
        "points":0.0, "weighted_points":0.0,
        "run_diff":0, "weighted_run_diff":0.0,
    })

    excluded = 0
    cross_pref = 0

    for r in rows:
        if str(r.get("exclude_from_rating","0")).strip() == "1":
            excluded += 1
            continue

        p1 = r["team1_prefecture"].strip()
        p2 = r["team2_prefecture"].strip()
        if not p1 or not p2 or p1 == p2:
            continue

        cross_pref += 1
        s1 = int(r["score1"])
        s2 = int(r["score2"])
        result1 = 1.0 if s1 > s2 else 0.0 if s1 < s2 else 0.5
        w = game_weight(r, cfg)

        a, b = sorted((p1, p2))
        d = pair[(a,b)]
        d["games"] += 1
        d["weighted_games"] += w

        if p1 == a:
            ra = result1
            diff_a = s1 - s2
        else:
            ra = 1.0 - result1
            diff_a = s2 - s1

        if ra == 1:
            d["wins_a"] += 1
        elif ra == 0:
            d["wins_b"] += 1
        else:
            d["draws"] += 1

        d["weighted_points_a"] += w * ra
        d["run_diff_a"] += diff_a
        d["weighted_run_diff_a"] += w * diff_a

        # prefecture aggregate
        for pref, res, diff in (
            (p1, result1, s1-s2),
            (p2, 1-result1, s2-s1),
        ):
            x = pref_total[pref]
            x["games"] += 1
            x["weighted_games"] += w
            x["points"] += res
            x["weighted_points"] += w * res
            x["run_diff"] += diff
            x["weighted_run_diff"] += w * diff

    prior = cfg["bayes_prior_games"]
    matchup_cap = cfg["matchup_elo_cap"]

    MATCHUP_OUT.parent.mkdir(parents=True, exist_ok=True)
    with MATCHUP_OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields = [
            "pref_a","pref_b","games","weighted_games",
            "wins_a","draws","wins_b",
            "weighted_winrate_a","run_diff_a","weighted_run_diff_a",
            "compatibility_elo_a","compatibility_elo_b"
        ]
        wri = csv.DictWriter(f,fieldnames=fields)
        wri.writeheader()

        for (a,b), d in sorted(pair.items()):
            shrunk = (
                d["weighted_points_a"] + prior * 0.5
            ) / (
                d["weighted_games"] + prior
            )

            # Thin adjustment: 50% -> 0, 75% -> +20, 25% -> -20
            elo = clamp((shrunk - 0.5) * 80.0, -matchup_cap, matchup_cap)

            wri.writerow({
                "pref_a":a,
                "pref_b":b,
                "games":d["games"],
                "weighted_games":round(d["weighted_games"],4),
                "wins_a":d["wins_a"],
                "draws":d["draws"],
                "wins_b":d["wins_b"],
                "weighted_winrate_a":round(shrunk,6),
                "run_diff_a":d["run_diff_a"],
                "weighted_run_diff_a":round(d["weighted_run_diff_a"],4),
                "compatibility_elo_a":round(elo,2),
                "compatibility_elo_b":round(-elo,2),
            })

    pref_cap = cfg["pref_strength_elo_cap"]
    with STRENGTH_OUT.open("w",encoding="utf-8-sig",newline="") as f:
        fields = [
            "prefecture","games","weighted_games",
            "weighted_winrate","run_diff","weighted_run_diff",
            "history_strength_elo"
        ]
        wri = csv.DictWriter(f,fieldnames=fields)
        wri.writeheader()

        for pref, d in sorted(pref_total.items()):
            shrunk = (
                d["weighted_points"] + prior * 0.5
            ) / (
                d["weighted_games"] + prior
            )
            elo = clamp((shrunk - 0.5) * 48.0, -pref_cap, pref_cap)

            wri.writerow({
                "prefecture":pref,
                "games":d["games"],
                "weighted_games":round(d["weighted_games"],4),
                "weighted_winrate":round(shrunk,6),
                "run_diff":d["run_diff"],
                "weighted_run_diff":round(d["weighted_run_diff"],4),
                "history_strength_elo":round(elo,2),
            })

    print(f"Historical rows: {len(rows)}")
    print(f"Excluded walkovers: {excluded}")
    print(f"Cross-prefecture rated games: {cross_pref}")
    print(f"Prefecture matchup pairs: {len(pair)}")
    print(f"Prefecture strength rows: {len(pref_total)}")
    print("Historical prior build OK")

if __name__ == "__main__":
    main()
