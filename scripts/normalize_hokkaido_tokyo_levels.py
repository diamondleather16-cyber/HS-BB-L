"""2021+ Hokkaido/Tokyo tournament layer normalization (idempotent)."""
import re

def classify(r):
    try: year=int(r.get("year") or 0)
    except ValueError: return None
    if year<2021: return None
    season=str(r.get("season") or "").lower()
    text=str(r.get("tournament") or "")
    note=str(r.get("note") or "")
    pref=str(r.get("prefecture") or "")
    region=str(r.get("region") or "")
    loc="hokkaido" if ("北海道" in pref or region in ("hokkaido","北海道")) else ("tokyo" if ("東京" in pref or region=="kanto_tokyo" and ("東京" in text or "東京" in pref)) else "")
    if not loc or season not in ("spring","autumn","summer"): return None
    round_=str(r.get("round") or "").strip().upper()
    words=text+" "+note
    prelim=bool(re.search(r"支庁|支部|支庁大会|地区予選|一次予選|１次予選|1次予選|ブロック予選|予選ブロック",text))
    if loc=="hokkaido":
        if season in ("spring","autumn"):
            # Legacy 2021-24 files explicitly call subprefecture games 地区大会.
            # That is a qualifying round, not the all-Hokkaido main event.
            if round_=="QUAL" or "stage=district_qualifier" in note:
                return ("prefecture",f"{year}{'春季' if season=='spring' else '秋季'}北海道支庁")
            if round_ in ("地区大会","支部予選","支庁予選","地区予選"):
                return ("prefecture",f"{year}{'春季' if season=='spring' else '秋季'}北海道支庁")
            # An explicit final-tournament round is an all-Hokkaido fixture,
            # even if a duplicated source incorrectly calls it 支庁.
            # For example, 2026 autumn's first 16 main-bracket games were
            # duplicated under 秋季北海道支庁2026 and wrongly downgraded.
            source=str(r.get("_source_file") or "")
            if (year==2025 and season=="autumn"
                and "data/recovered/2025_2026_pre_dedupe_missing.csv" in source):
                return ("prefecture","2025秋季北海道支庁")
            main_round=bool(re.fullmatch(
                r"(?:[1-9][0-9]*(?:回戦|R)|準々決勝|準決勝|決勝|[1-9][0-9]*位決定戦|QF|SF|F|FINAL)",
                round_,re.I))
            if main_round:
                return ("regional",f"{year}{'春季' if season=='spring' else '秋季'}北海道")
            if prelim:
                return ("prefecture",f"{year}{'春季' if season=='spring' else '秋季'}北海道支庁")
            if re.search(r"全道|北海道大会|道大会|北海道$|北海道\\s*\\d{4}|北海道\\s*本",text):
                return ("regional",f"{year}{'春季' if season=='spring' else '秋季'}北海道")
            return None
        side="北" if "北北海道" in words or "北北海道" in pref else ("南" if "南北海道" in words or "南北海道" in pref else "")
        if not side: return None
        if prelim:return ("district_qualifier",f"{year}選手権{side}北海道支庁")
        return ("prefecture",f"{year}選手権{side}北海道")
    if season=="summer": return ("prefecture",f"選手権{'東' if '東東京' in words or '東東京' in pref else '西' if '西東京' in words or '西東京' in pref else ''}東京{year}")
    if season=="spring":
        if (prelim or round_ in ("地区大会","地区予選","ブロック予選","支部予選","一次予選","予選")) and not re.search(r"都大会|本大会|本戦",text):return ("district_qualifier",f"春季関東東京地区予選{year}")
        return ("prefecture",f"春季関東東京{year}")
    if season=="autumn":
        # Raw stage is essential: 3R+ at Tokyo final tournament is regional.
        if round_ in ("地区大会","地区予選","ブロック予選") or (prelim or re.search(r"序盤|一次|１次|1次|ブロック",text)) and not re.search(r"都大会|本戦",text):
            return ("prefecture",f"秋季東京序盤{year}")
        m=re.match(r"^(\d+)(?:R|回戦)$",round_,re.I)
        n=int(m.group(1)) if m else 0
        regional=n>=3 or round_ in ("QF","SF","F","3RD","3位決定戦") or bool(re.search(r"準々決勝|準決勝|決勝|３回戦|3回戦|４回戦|4回戦",round_))
        if regional:return ("regional",f"秋季東京{year}")
        if n in (1,2) or round_ in ("1R","2R") or re.search(r"序盤|予選",text):
            return ("prefecture",f"秋季東京序盤{year}")
        return None
    return None

def canonicalize(r):
    result=classify(r)
    if result is None:return False
    level,name=result
    original=(r.get("tournament"),r.get("note"))
    # Keep original provenance to distinguish mislabeled tournament rounds.
    if not str(r.get("tournament") or "").strip():return False
    # Never reclassify national games as local.
    if re.search(r"(?:^|;)level=national(?:;|$)",str(r.get("note") or "")):return False
    r["tournament"]=name
    parts=[p.strip() for p in str(r.get("note") or "").split(";") if p.strip() and not p.strip().startswith("level=")]
    parts.append("level="+level)
    r["note"]=";".join(parts)
    if str(r.get("level") or "").strip():r["level"]=level
    if level=="prefecture" and "北海道" in name and not str(r.get("prefecture") or "").strip():r["prefecture"]="北海道"
    if level in ("prefecture","district_qualifier") and "東京" in name and not str(r.get("prefecture") or "").strip():r["prefecture"]="東京"
    return original!=(r["tournament"],r["note"])
