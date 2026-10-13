V24 大会取込 runner 修正

原因:
V22で process_import_requests.yml の setup-python に
  cache: pip
を追加していた。

しかしこのrepoには requirements.txt / pyproject.toml / setup.py 等の
pip依存ファイルが存在しない。

actions/setup-python の pip cache は依存ファイルを探すため、
対象ファイルがないrepoでは Python setup step 自体が失敗し得る。
その場合 importer は1行も実行されず、UIだけが request_id の結果を
延々待つ状態になる。

今回の症状:
- request IDは表示される
- 古いreviewは消える
- 300秒以上待っても新しいauditが出ない
はこの失敗と一致する。

修正:
- setup-python の `cache: pip` を削除。
- 依存導入は `python -m pip install requests beautifulsoup4` に戻す。
- import jobに timeout-minutes: 5 を設定。
- UIの待機上限を180秒へ戻し、超過時は「まだ処理中」ではなく
  Actions起動失敗/停止の可能性を明示。
- V23のrequest_id判定修正は維持。
