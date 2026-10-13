V22 大会取込 Fast Path

以前の軽い使用感へ戻すため、大会取込から重い処理を切り離した。

解析:
- URL取得 → HTML解析 → master/import_audit.json保存だけ。
- Rating再計算なし。
- mergeなし。
- Pages deploymentなし。
- UIはGitHubのauditを直接1.5秒間隔で確認。

登録:
- 承認済み試合をdata/importedへ保存してauditをcompletedにするだけ。
- Rating再計算はdata/** pushで既存 Build Rating Events v2 が別Actionとして実行。
- 登録画面はRating終了を待たず完了表示。

その他:
- latest requestのaction(analyze/approve)だけを処理。
- 古いrequest再解析防止(V21)は維持。
- workflow自体からPages deployを削除。
- workflow自体からRating rebuildを削除。
- import URL timeoutはconnect 5秒/read 12秒。

狙い:
koshien89の通常HTMLページなら解析結果表示をActions起動待ち込みでも30〜60秒程度へ戻す。
