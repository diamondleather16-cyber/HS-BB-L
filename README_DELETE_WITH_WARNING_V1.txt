削除機能追加

対戦台帳:
- 試合編集画面に「この試合を削除」
- 削除前に赤い警告ダイアログ
- 元CSV由来の試合は master/match_edits_shared.json の deleted_matches に削除記録を保存
- 手入力試合は manual_matches からも除去
- override / team_links も同時整理
- Rating再計算時に削除済み試合を output/all_matches.csv から除外

学校マスタ:
- 学校編集画面に「この学校マスタを削除」
- 削除前に学校名、ID、関連試合数を警告表示
- 対戦履歴そのものは削除しない
- その学校IDへの試合別紐づけは解除
- deleted_schools tombstone を共有マスタに保存し、raw試合名から自動再生成されるのを防止

誤操作防止:
- どちらも警告ダイアログで明示確認しない限り削除しない。

ライブ共有JSONはZIPに含めない。
