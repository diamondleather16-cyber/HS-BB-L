V29 大会取込 push競合修正

ログで原因確定:
- fast-path result のcommit自体は成功
- push時に main が先へ進んで fetch first
- retryで git fetch 後に git rebase origin/main
- しかし working tree に unstaged changes が残っており
  "cannot rebase: You have unstaged changes" で終了

未stageの主因:
process_import_requests.py は docs/data/import_audit.json も更新するが、
workflowの最初の git add に docs/data/import_audit.json が入っていなかった。

V29:
- docs/data/import_audit.json も最初からstage。
- push競合時に rebase をやめる。
- 最新 origin/main へ hard reset + clean。
- 最新main上で該当 mode(analyze/approve)を再実行。
- 再stage・再commit・push。
- これでdirty treeによるrebase失敗を防ぐ。

解析ロジックではなく、解析結果をmainへ戻す最後のpush工程の不具合。
