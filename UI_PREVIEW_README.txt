HS-BB-L UI Preview v1

目的:
現在までに蓄積したCSVを一度ブラウザUIで確認するための試作版。

表示:
- 年度
- シーズン
- 地域
- 都道府県
- 階層
- 学校検索
- 暫定Eloランキング
- 学校ごとの戦績
- Rating推移
- 直近試合

重要:
このRating式は「最終レーティング」ではない。
UI確認用の暫定Elo。
最終版ではPython側で計算済みrating CSVを生成し、
同じUIへ差し替える想定。

暫定係数:
branch / district / first qualifier = 0.65
qualifier league / repechage = 0.60
prefecture = 0.90
regional = 1.15
national = 1.35
K base = 24

GitHub Pages:
Actions -> Deploy HS-BB-L UI -> Run workflow
初回だけRepository Settings -> Pagesで
SourceがGitHub Actionsになっていることを確認。
