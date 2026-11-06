#!/usr/bin/env python3
"""Regression checks for actual Hokkaido spring/autumn tournament levels."""
from normalize_hokkaido_tokyo_levels import classify

def check(year,season,round_name,title,expected):
    row={"year":str(year),"season":season,"region":"hokkaido","prefecture":"北海道",
         "round":round_name,"tournament":title,"note":"level=prefecture"}
    got=classify(row)
    assert got is not None and got[0]==expected,(row,got,expected)
    return got

# 2026 fall source duplicated the regional main bracket under a 支庁 title.
for stage in ("1回戦","2回戦","準々決勝","準決勝","決勝"):
    check(2026,"autumn",stage,"秋季北海道支庁2026","regional")
for stage in ("地区予選","地区大会","支部予選","支庁予選"):
    check(2026,"autumn",stage,"秋季北海道北海道2026","prefecture")
check(2026,"spring","決勝","春季北海道北海道2026","regional")
check(2025,"spring","地区予選","春季北海道2025","prefecture")
check(2023,"autumn","1回戦","秋季北海道北海道2023","regional")
check(2023,"autumn","地区予選","秋季北海道北海道2023","prefecture")
# Summer is a distinct North/South Hokkaido prefecture tier.
check(2026,"summer","決勝","選手権南北海道2026","prefecture")
check(2026,"summer","決勝","選手権北北海道2026","prefecture")
print("HOKKAIDO_STAGE_CLASSIFICATION_OK")
