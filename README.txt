school_geo_rep_ids_v3 rating-counts patch

今回の原因:
school_geo_rep_ids_v3 を作る際、ベースにした rating_lineage_union_v2 が
「連合の games/wins/losses を 1/3, 1/2 で出す旧版」だったため、
前回直した修正版が v3 に引き継がれていなかった。

そのため Validate current ratings で
  row xx: invalid numeric field
が再発した。

修正:
- v3 に、前回の union game counts 修正版 build_rating_events_v2.py を再適用
- Rating変動だけ weight 分配
- games/wins/losses/draws は整数
- v3 の地域/代表区分UIはそのまま維持

導入後:
Actions → Build Rating Events v2 & Deploy → Run workflow
