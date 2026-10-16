V61 Rating整合性・全履歴・完全時点スナップショット修正

1. 日付正規化
- YYYY/MM/DD, YYYY-MM-DD, YYYY.M.D を内部YYYY-MM-DDへ統一。
- 学校Rating計算、県Rating計算、UI履歴を同じ時系列で処理。
- 同日はevent_orderで安定順序。

2. 最新Rating
- output/all_matches.csvの最新試合まで学校Rating計算へ投入。
- 履歴の「最新」は配列末尾ではなく正規化時系列の最新イベント。
- 今日の地区大会などもall_matchesに存在すれば再計算対象。

3. 対戦台帳とランキングの整合
- 台帳の試合前R/変動/試合後Rは、通常校ではrating_school_eventsのschool_id+match_keyを優先。
- match-level rating_eventsは期待値・指数用として継続。

4. 2017-2024県Rating履歴
- 県Rating詳細履歴をall_matchesではなくprefecture_rating_eventsから表示。
- historical_ledger_2017_2024の地区/全国イベントも表示対象。
- 歴史試合には既定の年代減衰(2016-20=.75, 2021+=1.0等)を適用。
- 古い元帳で日付が空でも年/季節順で県Rating計算し、履歴から消さない。

5. 日付指定ランキング = 完全スナップショット
- 指定日以前だけでRating、順位、試合数、勝敗、得失点を再構成。
- 学校詳細の現在順位/最高順位/Rating/試合数/グラフ/履歴/最新イベントも指定日で打ち切る。
- 未来の試合を混ぜない。

6. 監査
- output/rating_pipeline_audit.csvを生成。
- 最新all_matchesとrating_events/rating_school_eventsの到達日を比較。
- 2017-2024 historical ledgerの年・季節と県Ratingイベント採用有無を監査。
