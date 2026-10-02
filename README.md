# HS-BB-L

高校野球全国レーティング用データベース。

この版には、**2025年春の47都道府県大会を自動収集するGitHub Actions** が入っています。

## 仕組み

1. `scripts/fetch_2025_spring.py` が koshien89.com の47都道府県カテゴリから2025年春大会の記事を探す
2. 支部予選・地区予選を除外し、都道府県大会本戦の試合をCSV化
3. `scripts/validate.py` で形式とQF/SF/Fの最低限の完全性を検査
4. GitHub Actionsが `data/` と収集レポートを自動commit

## CSV列

`year,season,region,prefecture,tournament,round,date,team1,score1,team2,score2,source_url,note`

## 手動実行

```bash
python scripts/fetch_2025_spring.py
python scripts/validate.py
```

## 注意

- 地区予選・支部予選は収録しません。
- 3位決定戦は `3P` として収録します。
- 取得元ページに記載された校名を原則そのまま保存し、学校名統一は後段のマスターで行います。
