HS-BB-L UI performance patch v1

重くなった主因
- 対戦台帳を全試合一括DOM描画
- 学校マスタを全校一括DOM描画
- 試合ごとのRatingイベント検索が毎行 Array.find
- 学校Rating / Rating履歴も毎回全配列検索
- 学校名検索が1文字入力ごとに即再描画

改善
1. 対戦台帳を100件ずつページング（50/100/200切替）
2. 学校マスタも100校ずつページング
3. RatingイベントをMap索引化
4. 学校RatingをMap索引化
5. 学校別RatingイベントもMap索引化
6. 学校・台帳検索を180ms debounce
7. table wrapperにcontent-visibility / contain
8. v3の地域/代表区分機能を維持
9. union game counts修正版も同梱

大量データ自体はブラウザへ読み込むが、
一度に数千～1万行のtableを生成しなくなるため、
表示・スクロール・タブ切替の負荷が大幅に下がる想定。

次段階の候補:
データがさらに数万試合へ増えたら、
年度単位CSV分割 + 必要年だけfetchする方式へ移行する。
