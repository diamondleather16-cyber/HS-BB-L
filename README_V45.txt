V45 Rating再計算 KeyError 修正

失敗ログ:
KeyError: 'U2025-AU-北海道-012'
scripts/build_rating_events_v2.py / infer_affiliation。

原因:
古い対戦台帳行に union_id が残っている一方、
現在の連合構成データにはそのIDが存在せず、
raw連合名では解決できるケースがあった。

旧コードは「union_idがある OR raw名がある」で判定した後、
実際の参照keyではunion_idを無条件優先していたためKeyError。

V45:
- 現在のunionsに存在するunion_idだけ使用。
- stale union_idでraw連合名が解決できる場合はraw名へフォールバック。
- infer_affiliationと本計算team_membersの両方を防御。
- stale IDはwarningとしてログに残す。
- 未解決連合は従来通りRating対象外としてskipし、全体計算を落とさない。

Rating計算式は変更なし。
