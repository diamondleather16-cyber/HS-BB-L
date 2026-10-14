V28 手入力試合 Rating自動反映

症状:
手入力した試合は対戦台帳に即表示されるが、
試合前R・期待・指数・増減・試合後Rが "-" のまま。

原因:
台帳は master/match_edits_shared.json の manual_matches を即時表示する一方、
Rating欄は output/rating_events.csv のGitHub再計算結果だけを参照していた。
ブラウザはRating Actions完了後の新しいCSVを自動再読込していなかった。

V28:
- 手入力試合のGitHub保存完了後、その試合を「Rating再計算待ち」にする。
- build_rating_events_v2 workflowをbest effortで直接起動。
  直接起動できなくても既存push triggerがあるため処理は継続。
- output/rating_events.csv/current_ratings.csv/rating_school_events.csvを
  GitHub mainから直接ポーリング。
- 該当match_keyがrating_events.csvに現れたら自動で台帳再描画。
- "-" の代わりに「再計算待ち / 待機中」を表示。
- pending match keyをlocalStorageへ保持するため、途中でページ更新しても
  再計算待ち状態を復元し、自動確認を再開。
- 通常の試合内容編集もRating再計算対象として同じ処理を行う。

計算式自体は変更していない。
