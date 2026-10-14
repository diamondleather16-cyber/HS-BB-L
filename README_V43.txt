V43 旧連合校の完全整理

問題:
連合マスタへ移した表示名が、学校マスタに1校として残ることがあった。

原因:
従来 syncUnionComponentsToSchoolMaster はローカルの schoolMaster から削除するだけで、
deleted_schools の tombstone を残していなかった。
そのため GitHub共有マスタとの次回mergeで古い学校レコードが復活することがあった。

V43:
- 連合display_nameと完全一致する学校レコード（構成校IDを除く）を旧連合校と判定。
- kind=union の旧レコードも同様に対象。
- ローカル削除だけでなく deleted_schools tombstone を自動作成。
- GitHub共有マスタのmergeでも復活しない。
- 構成校そのものは実在校なので学校マスタに残す。
- 学校マスタ上部に「旧連合校を整理」ボタンを追加。
- 手動整理時は対象名を確認してから即GitHub保存。

Rating計算式や連合構成校の扱いは変更なし。
