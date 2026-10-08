県Ratingタブ試作

追加:
- 「県Rating」タブ
- 県を選択して、年度・季節・大会で県外対戦履歴を絞り込み
- 現在の県マスタRating = 1000 + history_strength_elo を表示
- 対外戦勝敗・勝率・得失点を表示
- 履歴の参考折れ線を表示（勝+12/敗-12の見通し用。県マスタRatingそのものではない）
- 県A/県Bを選び、prefecture_matchups.csv の現在相性Eloを確認
- 県Rating + 相性補正から参考期待値を表示
- 選択県を基準に、全県を「相手県Rating × 相性補正」の座標マップで表示

Workflow:
master/prefecture_strength_prior.csv と master/prefecture_matchups.csv を docs/data へコピー。

注意:
県履歴の折れ線は現時点では「対外戦の見通し用参考推移」。
既存の県マスタRatingの過去時点系列をでっち上げないよう、現在値とは明確に分離している。

安全:
shared school master / match edits / import state 等のライブデータはZIPに含めない。
