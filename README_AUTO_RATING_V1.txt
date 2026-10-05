学校マスタ保存 → Rating自動再計算 v1

仕組み:
- PC/スマホで学校マスタをGitHub共有保存
- master/school_master_shared.json のpushをGitHub Actionsが検知
- 45秒待機
- その間に次の学校編集が来たら古いActionを自動キャンセル
- 最後の編集から約45秒後に1回だけRating再計算
- current_ratings.csv / rating_events.csv / rating_school_events.csv を更新
- Pagesも自動Deploy

負荷対策:
- push対象は master/school_master_shared.json だけ
- concurrency cancel-in-progress=true
- 連続10校編集でも基本的に最後の1回だけ本計算まで進む
- 手動 workflow_dispatch も引き続き利用可能
- Action自身が生成ファイルをpushしても shared JSON が変わらないため再帰起動しない

UI:
- 学校マスタに「共有保存後 約45秒でRating自動更新」と表示
- GitHub保存成功ダイアログにも自動再計算を表示

反映確認:
UI-AUTO-RATING-V1
