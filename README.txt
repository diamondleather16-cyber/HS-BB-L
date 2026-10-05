2026夏 workflow commit競合対策

今回の失敗はデータ収集ではありません。
Collect / Validate / Merge は全て成功しています。

失敗箇所:
Commit generated data
CONFLICT (content): Merge conflict in master/sources.csv

原因:
Actionが収集中の約1分の間にmain側が更新され、
最後の git pull --rebase で生成済み master/sources.csv と競合した。

修正:
- commit直前に origin/main を確認
- mainが更新されていれば最新mainへreset
- その上で collector / validator / merge を再実行
- push直前に競合した場合も1回だけ最新main上で再生成して再試行
- 同じ2026夏workflowの同時実行もconcurrencyで防止

導入後:
Actions → Build 2026 Summer Prefecture Data → Run workflow
