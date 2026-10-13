V18 ランキング同名校・連合除外

- ランキング絞り込みを学校名ではなくschool_idで判定。
- 北信越フィルタに「福岡」という名前があっても、岩手の福岡高校school_idは許可されない。
- Rating行はschool_id優先で学校マスタへ解決。
- school_idがない同名校は、名前だけでは解決しない。
- prefecture/regionで一意になる場合だけ補助解決。
- 連合マスタdisplay_name、kind=union、status=mergedはランキング対象外。
- fallback Ratingも同名曖昧校を除外。
- backend current_ratings.csvも実在校school_idだけを出力。
