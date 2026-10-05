HS-BB-L 対戦台帳 Explorer v1

追加内容
- 対戦台帳をランキング用フィルタから独立
- 年代 / 季節 / 階層 / 地区 / 県 / 県以下の地区 / 学校 / ソース状態で絞り込み
- 年代新旧・日付・学校名で並べ替え
- 2017～2024の地区大会以上を参考台帳として追加
- 2017～2024参考台帳: 2890試合
- 既存2025以降: data/all_matches.csvをそのまま使用
- 学校統合後のcanonical名と元表記を両方表示
- Web URLがある試合はその場で元ページを開ける
- 過去元帳しかない行は「v1_3_workcopy.xlsx / 試合元帳」と明示

重要
2017～2024の抽出元データにはWebのsource_url列がありません。
したがって、今ある情報だけで「Web URLを全2890試合へ復元」することはできません。
このZIPではソースを捏造せず、
  Web URLあり
  元帳あり・Web URL未登録
  ソース未登録
を区別して見えるようにしています。
後からURLを補完すれば同じUIで確認できます。

ファイル
- docs/index.html
- docs/styles.css
- docs/app.js
- docs/data/historical_ledger_2017_2024.csv
- docs/data/historical_source_audit_2017_2024.csv
- scripts/build_historical_ledger_reference.py

インストール後に Build & Deploy Rating Preview v1 を実行してください。
