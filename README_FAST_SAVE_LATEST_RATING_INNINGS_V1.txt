4点改修 v1

1. 対戦台帳・紐づけの高速化
- 操作は即時画面反映
- GitHub保存は3.2秒デバウンスでまとめて後追い
- 連続10操作でも基本1回のPUT
- 起動時取得済みSHAを使うfast path。409/422時だけ最新SHAを再取得
- 保存中の追加編集を消さない
- 未保存match editsはlocalStorageへ退避し、次回起動で復元

2. ランキングは常に最新
- CSV取得ごとに `_fresh=timestamp` を付与
- cache=no-store + Cache-Control:no-cache
- current_ratings.csvをページ起動ごとに最新取得

3. イニングのデフォルト
- 未指定は innings=9 / finish_type=normal / multiplier=1.00
- 9回通常は台帳上のイニング表示を省略
- 入力が必要なのはコールド・延長など例外だけ
- apply_match_edits.py / build_rating_events_v2.pyも同仕様

4. 校名変更など学校マスタ書込みの高速化
- 学校名変更は画面へ即時反映
- GitHub保存を3.2秒まとめ保存
- 保存ダイアログ待ちを廃止し、右下に「保存待ち/保存中/保存済み」
- 連続編集時の競合と通信回数を削減

Deploy安定化:
- Rating workflow自身はPages deployしない
- Rating生成→docs/data commit→専用 Deploy Pages UI が1回だけPages配信
- Pages同時deploy競合を避ける
