UI Deploy Fix v1

症状:
GitHub Pagesの右上ビルドタグが UI-MATCH-SPECIFIC-LINK-V1 のままで、
新しい「履歴からID分岐」UIがまったく表示されない。

原因:
Rating用workflowとPages UI配信を同じworkflowに依存していたため、
docs変更が確実にPagesへ反映されていなかった。

対策:
専用workflow `.github/workflows/deploy_pages_ui.yml` を追加。
- docs/** がmainへpushされたら自動Deploy
- Rating再計算はしない
- UIだけを軽く確実に配信
- workflow_dispatchで手動実行も可
- deploy前に `UI-HISTORY-ID-REDESIGN-V2` と新JS参照を検証

確認:
Pages右上のビルドタグが UI-HISTORY-ID-REDESIGN-V2 に変わること。
学校詳細右上に「履歴からID分岐」ボタンが出ること。
