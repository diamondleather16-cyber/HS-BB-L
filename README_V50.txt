V50 Wikipedia過去全国大会対応 + 歴史データ反映強化

1) Wikipedia parser
- wikipedia.org を parser=auto / wikipedia で専用解析
- 1試合ごとのイニング表を最優先
- ブラケット表をフォールバック解析
- 記事内の「○試合」「出場○校」から期待試合数を推定
- output/historical_url_report.csv に
  Wikipedia期待試合数 / 抽出数 / 件数不一致警告 を表示
- 件数不一致なら approved=1 にしない運用を推奨

試験URLをmanifestへ投入済み:
- 2000 神宮（第31回）
- 2001 選抜（第73回）
- 2001 選手権（第83回）

2) 県Rating / 県相性
V49までは data/historical_compat の2000+データは県同士の相性だけに使用。
V50では、承認済みのregional/national歴史試合を
- 県Rating
- 県同士相性
の両方へ反映。
古い年度は既存history_decayを適用:
2000-05=.30 / 2006-10=.40 / 2011-15=.55 / 2016-20=.75 / 2021+=1.00

既存historical_ledger/currentと同一試合なら、既存側を優先して二重計上しない。

3) 学校同士の相性
data/historical_compat のregional/national/prefecture試合を
学校間H2H相性の事前履歴にも投入。
古い試合は同じhistory decayで実効試合数を減衰。
歴史データは現在School Ratingそのものには直接加算せず、相性信号にのみ利用。

4) Rating formula本体
現行K式・大会係数・回戦係数・県補正上限等は変更なし。
