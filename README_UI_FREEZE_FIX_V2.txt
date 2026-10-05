UI freeze/loading fix v2

今回確認できた問題:
1. 初期ランキングはまだ全学校を一括DOM描画していた
   → 読込完了表示を書き換えてもブラウザが描画できず「読込中」に見える
2. 学校マスタは performance patch の途中状態で
   pagedRows を使うのに pagedRows 自体を作っていなかった
   → 学校マスタをクリックすると ReferenceError
3. master pager HTMLも入っていなかった

修正:
- ランキングも100校ページング（50/100/200）
- 学校マスタの100校ページングを正しく実装
- master pagerを追加
- 検索をdebounce
- 読込完了表示を先にpaintしてから表を描画
- タブ描画エラーを画面上に表示
- 反映確認タグ UI-FREEZE-FIX-2 を表示
- node --check 構文検証済み
- 県別カラーバー等の既存機能は維持

反映確認:
公開ページ上部の読込表示横に UI-FREEZE-FIX-2 が出る。
