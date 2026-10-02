# 高校野球 全国レーティングデータベース

全国高校野球の試合結果を蓄積し、検査・統合・レーティング計算を行うためのリポジトリです。

## 基本方針

GitHub上のCSVを正本とし、Excelは確認・分析・出力用とします。

処理順は以下です。

1. 収集
2. 検査
3. 統合
4. レーティング

## ディレクトリ構成

- `data/` : 地区別の試合CSV
- `master/` : 学校名・大会名・出典URLのマスター
- `scripts/` : 検査・正規化・統合コード
- `output/` : 統合CSVや将来のExcel出力
- `.github/workflows/` : GitHub上での自動検査

## 試合CSVの列

`year,season,region,prefecture,tournament,round,date,team1,score1,team2,score2,source_url,note`

## season

- spring
- summer
- autumn
- senbatsu
- koshien
- jingu

## round

- 1R
- 2R
- 3R
- 4R
- 5R
- QF
- SF
- F

## 最初の使い方

まず `data/05_hokushinetsu/ishikawa_2025.csv` に実データを追加してください。
その後、ローカル環境で以下を実行します。

```bash
python scripts/validate.py
python scripts/merge.py
```

