履歴からID分岐 UI 再設計 v2

旧方式は既存の学校詳細rendererを書き換えていたため、配信/キャッシュ/旧描画との切り分けが難しかった。
v2は学校詳細ヘッダーに静的な「履歴からID分岐」ボタンを追加し、
独立した専用モーダルを開く方式に変更。

確認ポイント:
学校詳細の右上に「履歴からID分岐」ボタンが必ず見える。
これが見えなければ新UIが配信されていないと即判断できる。

操作:
1. 学校マスタ → 対象校 → 詳細
2. 右上「履歴からID分岐」
3. 県チップまたは各試合チェックで選択
4-A. 既存IDへ移動
4-B. 選択試合から新ID分岐
5. 選択試合だけ edit_key + side + school_id で保存

GitHub保存:
master/match_edits_shared.json の team_links
新ID作成時は master/school_master_shared.json も更新。

Workflow:
docs/** と scripts/** のpushでも自動Deployするよう変更。
UI更新時のデバウンス待機は10秒。
