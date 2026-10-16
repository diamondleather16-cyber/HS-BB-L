V62 県Rating 2000-2016歴史層補完

目的
- 2000年秋季地区大会以降の地区大会・神宮・選抜・選手権を
  県Ratingと県相性へ反映する。
- 2016年以前の履歴が県Rating詳細から消える問題を解消する。

追加
- data/historical_compat/**/*.csv に加え、
  history/**/*.csv / data/imported/**/*.csv を補助ソースとして走査。
- 補助ソースから拾うのは2000-2016の regional / national のみ。
- prefecture以下の試合はこの経路では県Ratingへ入れない。
- 同一試合は event_key で重複排除。
  curated historical_compat、2017-2024 established/current が優先。
- 年代減衰は既存仕様を維持:
  2000-05=0.30 / 2006-10=0.40 / 2011-15=0.55 /
  2016-20=0.75 / 2021+=1.00
- output/prefecture_history_coverage.csv を生成。
  2000-2016でregional+nationalが0件の年は NO_HISTORY。
- workflowでcoverageをdocs/dataへコピー。
- history/**変更でもRating再計算workflowを起動。

継承
- V61 Rating整合性・完全時点スナップショット
- V61.3 対戦台帳ページ送り安定化

注意
repo内に元データ自体が存在しない年は、V62でも作り出しません。
その場合はcoverageにNO_HISTORYが出ます。
