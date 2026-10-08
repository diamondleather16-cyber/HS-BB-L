3点まとめ修正版

1) 大会・試合指数をRatingへ反映
K = 20 × 階層 × 季節 × ラウンド × 得失点差 × イニング

主なラウンド指数:
- 秋地区大会: QF 1.75 / SF 2.00 / F 1.25
- 夏県大会: QF 1.10 / SF 1.20 / F 1.30
- 秋県大会: QF 1.08 / SF 1.15 / F 1.20
- 春県大会: QF 1.04 / SF 1.08 / F 1.10
- その他地区: QF 1.10 / SF 1.20 / F 1.15
- 全国: QF 1.20 / SF 1.30 / F 1.35
- 神宮: QF 1.10 / SF 1.20 / F 1.25
- その他ラウンド: 1.00
対戦台帳に「指数」列を追加し、L/S/R/D/Iを表示。

2) ページからRating手動再計算
学校マスタ上部の「Rating再計算」から既存workflowを起動。
自動更新はそのまま残す。

3) 分岐ID Rating
build_rating_events_v2.py自身がmaster/match_edits_shared.jsonのteam_linksを直接再適用。
school_idを最優先で計算し、明示school_idがcurrent_ratings.csvから欠落した場合はvalidatorで失敗扱い。

安全対策:
共有マスタ、match_edits、import状態などの生データはZIPに含めていない。
