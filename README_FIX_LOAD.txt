ページが「読込中」のまま止まる不具合 修正

原因:
prefecture_color_bars_v1 の app.js に余分な `});` が1つ入り、
JavaScript全体が SyntaxError で起動していなかった。

症状:
- ページ自体は開く
- ブラウザはフリーズしない
- 「読込中」のまま先へ進まない
- 学校マスタ/ランキング等のJS処理が開始されない

修正:
- 余分な `});` を削除
- node --check で app.js の構文検証済み
- 県別カラーバー、軽量化、地域/代表区分、Rating履歴機能は維持

反映後:
Actions → Build Rating Events v2 & Deploy → Run workflow
