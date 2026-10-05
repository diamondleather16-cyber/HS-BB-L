2026夏 県階層 47都道府県 自動収集

対象:
- 2026年夏の地方大会
- 47都道府県すべて
- note に level=prefecture を付与

北海道:
- 北北海道大会 + 南北海道大会 = 県階層
- 支部予選はこのZIPでは収集しない（branch階層なので別扱い）

東京:
- 東東京大会 + 西東京大会 = 県階層

その他:
- 各都道府県の選手権大会を自動探索

出力:
- 各 data/<region>/<pref>_2026.csv の summer 行を更新
- master/collection_report_2026_summer.csv
- master/sources.csv
- output/all_matches.csv（merge.py）

検証:
- 47都道府県
- F/SF/QF の最低試合数
- score/date/team/source_url/round の空欄
- level=prefecture の有無

実行:
GitHub Actions → Build 2026 Summer Prefecture Data → Run workflow

注意:
workflow_dispatch のみ。pushでは自動実行しない。
