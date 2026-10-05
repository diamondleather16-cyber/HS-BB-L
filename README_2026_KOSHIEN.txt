2026 全国高校野球選手権（第108回）収集ZIP

対象:
- 2026 夏の甲子園
- 49代表
- 全48試合
  1R=17 / 2R=16 / 3R=8 / QF=4 / SF=2 / F=1

ソース:
https://koshien89.com/blog-entry-3810.html

出力:
- data/national/2026_koshien.csv
- master/collection_report_2026_koshien.csv
- output/all_matches.csv（merge.py）

学校名:
全国大会ページの「学校名(都道府県)」から、
team1/team2 は学校名だけにして県名は note の
team1_pref / team2_pref に保持。
県大会データとの学校名照合をしやすくする。

実行:
Actions → Build 2026 Koshien → Run workflow

workflow_dispatchのみ。
commit競合対策入り。
