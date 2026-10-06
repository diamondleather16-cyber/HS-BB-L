学校詳細・試合履歴からID分岐 v1

目的:
同名校（例: 石川の金沢 / 神奈川の金沢）を、対戦台帳のraw名やglobal aliasではなく
学校詳細の「実際の試合履歴」から直接分岐する。

操作:
1. 学校マスタで対象校の詳細を開く
2. 「対戦履歴・ID割当」で試合を選択
   - 県チップ（石川 21、神奈川 12等）で県単位一括選択可
   - 個別チェックも可
3-A. 既存IDへ移す:
   移動先を選択 → 「選択試合を既存IDへ移動」
3-B. 新IDを作る:
   「選択試合から新ID分岐」
   → 表示名と県を確認
   → 新school_id作成
   → 選択した試合だけ新IDへmatch-specific link

重要:
- 選択していない同名試合は動かない
- team_linksは edit_key + team1/team2 + school_id で保持
- 元学校と新学校の履歴はその場で分離して見える
- GitHubへ shared school master + match_edits_shared.json を保存
- 約45秒後にRating自動再計算
- Rating履歴はAction完了後に新IDへ反映
