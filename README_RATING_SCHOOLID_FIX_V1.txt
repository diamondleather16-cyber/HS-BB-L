Rating school_id基準化 v1

原因:
Build Rating Events v2 は従来 team1_canonical/team2_canonical（校名）を主キーとして計算していた。
試合履歴のID分岐で team1_school_id/team2_school_id が付いてもRating計算・画面検索がschool_idを見ていなかったため、
「試合履歴はあるのにRatingが '-' / Rating対象試合0」になる学校があった。

修正:
- team1_school_id / team2_school_id がある試合はschool_idを最優先でRating計算
- master/school_master_shared.json からschool_id→表示名/県/地区を取得
- current_ratings.csv に school_id 列を追加
- rating_school_events.csv に school_id 列を追加
- rating_events.csv に team1_school_id/team2_school_id 列を追加
- 学校詳細の現在Ratingはschool_idで検索
- Rating履歴もschool_idで検索
- school_idが無い旧データのみ従来の校名/aliasへフォールバック

導入後:
1) push
2) Actions -> Build Rating Events v2 & Deploy を1回実行
3) Pages deploy完了後に再読込
