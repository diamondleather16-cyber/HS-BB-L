HS-BB-L Rating Preview v1

反映内容
- 2025以降に output/all_matches.csv へ格納されている実試合
- 初期Rating 1000
- 県大会 / 地区大会 / 全国大会の階層係数
- 春 / 夏 / 秋 / 選抜 / 選手権 / 神宮の大会係数
- 点差補正（最大1.55）
- 2017〜2024 春秋地区 + 神宮 + 選抜 + 選手権から作る県歴史地力 prior
- 県別相性を期待勝率へ薄く反映
- 不戦勝 exclude_from_rating=1 は除外

歴史層
- 県地力 prior 最大 ±12 Elo
- 県別相性 最大 ±20 Elo相当
- 古い年度ほど減衰
- history/ に保存し data/ 配下へ置かない
  （merge.py に異種CSVを混ぜないため）

UI
- フィルタなし: Pythonで事前計算済みの正式Rating Preview v1
- 年度/季節/地域/県/階層フィルタあり: 従来のフィルタ内暫定Elo
- 学校マスタ/スマホ統合/UI v6機能は維持

注意
- まだ学校名ベースRating。阿南光などの重複school_idはB（GitHubマスタ永続化）前なので別校扱いになる。
- v6のブラウザ内統合は使用感確認用であり、この正式Rating CSVにはまだ書き戻さない。
