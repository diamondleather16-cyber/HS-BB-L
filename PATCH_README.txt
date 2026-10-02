Rating Preview v1 commit error patch

原因:
旧 data/history/2017_2024_regional_national.csv をWorkflow途中で削除していたが、
Commit step の git add 対象に data/history が入っていなかった。

そのため commit 後も削除差分が unstaged のまま残り、
git pull --rebase origin main が
"You have unstaged changes"
で停止していた。

修正:
git add -A data/history master output history docs/data
として削除差分もcommit対象に含める。
