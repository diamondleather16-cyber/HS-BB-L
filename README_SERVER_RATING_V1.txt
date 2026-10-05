PC・スマホ共通 GitHub確定Rating v1

変更:
- ブラウザでのRating再計算を通常運用から廃止
- current_ratings.csv（GitHub Actions生成）をRatingの唯一の正本にする
- PC / スマホ / Chrome / Safari等で同じRating
- 年代 / 季節 / 地区 / 県 / 階層フィルタは該当校を絞るだけ
- フィルタしてもRating値そのものは変えない
- current_ratings.csvが欠損した場合だけ緊急fallbackでブラウザ計算

反映確認:
表示方式 = GitHub確定Rating
画面タグ = UI-SERVER-RATING-V1

注意:
学校マスタの編集・統合情報は、現時点ではlocalStorage部分が残る。
「学校統合・地域・連合編集までPC/スマホ完全共通」にするには、
次に学校マスタ自体をGitHub CSV正本化する。
