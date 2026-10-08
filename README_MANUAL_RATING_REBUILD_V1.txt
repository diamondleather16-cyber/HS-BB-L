ページからRatingを手動再計算できるようにする最小パッチ。

- 学校マスタ上部に「Rating再計算」ボタン追加
- 押すと master/rating_rebuild_request.json をGitHubへ書き込み
- 既存 Build Rating Events v2 & Deploy が自動起動
- output/current_ratings.csv のSHAを監視し、更新を検知するとページ自動再読込
- 自動再計算の仕組みはそのまま残す
- liveデータ（school_master_shared.json / match_edits_shared.json等）はZIPに含めない
