V23 大会取込 request_id 判定修正

V21/V22で入れた「audit.updated_atより古いrequestは再解析しない」判定に欠陥があった。

競合例:
1. request A を15:50:00に送信
2. AのActionsが待機
3. 別の取込Actionsが15:50:10にauditを更新
4. AのActions開始
5. A.created_at <= audit.updated_at なので「古い依頼」と誤判定
6. Aを解析せず handled 扱い
7. UIはAのrequest_idを永遠に待ち続ける

スクリーンショットで、下に105試合の旧reviewが見えているのに
上では238秒解析中だったのはこの症状と一致する。

V23:
- 処理済み判定は request_id のみ。
- audit.updated_at は通常処理の判定に一切使わない。
- 旧形式からの初回移行時だけtimestampを使用。
- 新規requestは他のActionsがauditを更新しても絶対に飛ばさない。
- polling中は該当request_idの結果だけを表示。
- 新規解析開始時に古い解析結果を一旦隠す。
- 進行表示に依頼ID末尾を表示。
