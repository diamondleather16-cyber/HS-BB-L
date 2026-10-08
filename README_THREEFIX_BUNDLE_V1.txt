3点まとめ修正版

1. 2026秋など新規登録試合を対戦台帳へ反映
   - 最新 docs/data/all_matches.csv を no-cache で読込
   - Deploy Pages UI は docs/index.html が参照する現行 app/css を自動判定して配信
   - 古い固定 app 名による Pages 停止を解消

2. 学校マスタ文字列検索
   - canonical_name（表示名）のみ検索対象
   - 都道府県・地区・県内地区・ID・別名は文字列ヒットさせない
   - 「福岡」で福岡県所属校が全部出る問題を解消

3. 分岐IDのRating
   - exact display name -> school_id を最優先
   - alias解決より先に分岐後 school_id の current_ratings / rating events を参照
   - 同名校/旧aliasにRatingを奪われて「-」になる問題を防止
   - backend の school_id rating identity 修正も同梱
