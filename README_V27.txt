V27 大会取込 専用キュー化

V26でも「送信失敗」が残るため、共有JSONへの追記方式を廃止。

旧方式:
  master/import_requests.json
1ファイルをブラウザ、Actions、別操作が更新するためSHA競合が頻発。

V27:
- 1依頼=1ファイル
  master/import_queue/<request_id>.json
- 新規ファイル作成なので既存ファイルのSHA競合をほぼ排除。
- workflowは master/import_queue/** のpushで自動起動。
- workflow_dispatch直接起動は通常フローから外した。
- processorは新キューと旧import_requests.jsonを両方読める。
- request_idで重複排除。
- 一時的な409/422/429/5xxは最大6回自動再試行。

これで「送信」は共有キュー全体を書き換えるのではなく、
自分のrequestファイルを1個作るだけになる。
