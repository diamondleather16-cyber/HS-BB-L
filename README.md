# 高校野球 全国レーティングデータベース

全国高校野球の試合結果を蓄積し、検査・統合・レーティング計算を行うためのリポジトリです。

## 方針
- GitHub上のCSVを正本とする
- Excelは確認・分析・出力用
- 収集 → 検査 → 統合 → レーティング の順で処理する

## 主なフォルダ
- `data/` : 地区別の試合データ
- `master/` : 学校名・大会名・出典URLのマスター
- `scripts/` : 検査・正規化・統合処理
- `output/` : 統合結果
- `.github/workflows/` : GitHub Actions

## 試合CSV列
`year,season,region,prefecture,tournament,round,date,team1,score1,team2,score2,source_url,note`
