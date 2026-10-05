連合チーム ID分解・大会別紐づけ v1

- 連合チーム専用タブ追加
- 対戦台帳から連合候補を自動検出
- 年度/季節/大会/連合表示名ごとに履歴用team_id
- 構成校を既存school_idへ紐づけ
- weight編集、未調整なら均等化
- 全構成校紐づけ後に「分解・凍結」
- 凍結連合疑似IDは通常学校マスタから非表示
- 連合IDは削除せず履歴保持
- 対戦台帳に構成校を表示
- tournament_teams.csv / tournament_team_members.csv を書き出し可能
- Rating計算は大会別tournament_team_members.csvを優先
- 既存team_members.csvはfallback

注意:
ブラウザ編集はlocalStorage。正式Ratingへ反映する場合は書き出したCSVを
master/tournament_teams.csv
master/tournament_team_members.csv
へ置いてActionを実行。
