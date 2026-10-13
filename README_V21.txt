V21 大会取込高速化・停止修正

主原因:
master/import_requests.json は最大200件保持していた一方、
master/import_audit.json は直近100件しか保持していなかった。

そのため101件目より古い解析依頼は audit から消えると、
次回の大会取込Actionで「未処理」と誤判定され、
古いURLを大量に再取得・再解析していた。

結果:
- 新しい1大会の解析なのに過去100件近くを再解析
- URLごとに最大30秒待つ可能性
- Actionsが数分以上終わらない
- 解析も登録も進まないように見える
- audit 100件が新旧で入れ替わる ping-pong が起こり得る

修正:
1. auditに handled_request_ids を最大500件保持。
2. audit itemsを240件保持し、request queue 200件より大きくした。
3. 旧auditから落ちた古いrequestは audit.updated_at より古ければ再解析しない。
4. 新しく追加されたrequestだけ処理。
5. URL取得timeoutを30秒から connect 5秒/read 12秒へ短縮。
6. tournament-import workflowは cancel-in-progress=true。
   新しい依頼が来たら古い待機runを捨て、最新requestファイルを処理。
7. pip依存導入をquiet化。
8. UIの3分打ち切りを廃止し、最大10分まで結果確認。
