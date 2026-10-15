V48 対戦台帳 階層表示修正

症状:
output/all_matches.csv / rating_events.csv では level=prefecture なのに、
対戦台帳UIでは「地区大会」と表示される試合があった。

原因:
UIの effectiveMatchLevel() が、CSVの明示的な level=prefecture より
北海道・東京向けの推定ロジックを後から優先していたため。

修正:
- note の level=... または row.level に既知の階層が明示されている場合、
  その値を絶対優先。
- 北海道/東京の推定ロジックは、level が未設定の古い行にだけ使用。
- level_overrides.csv や対戦台帳の手動階層修正が、そのままUI表示に反映される。
- Rating計算式は変更なし。
