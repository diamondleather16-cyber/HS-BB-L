V62.1 県Rating歴史層 監査強化版

V62で2000-2016の履歴が画面に出ない原因をActions上で確実に切り分ける。

- build_prefecture_model.pyが年別採用数を必ずログ出力。
- legacy / historical_compat / established の読込件数を表示。
- output/prefecture_history_coverage.csv を必ず生成。
- CSV生成に失敗したらBuild失敗。
- Actionsに Verify prefecture history coverage ステップ追加。
- coverage CSV全文をActionsログへ表示。
- 2000-2016の17年分の監査行がなければBuild失敗。
- 0件の年は missing years として明示。
- coverageをdocs/dataへコピー。
- V62の2000-2016補完ロジック、V61.3までの台帳安定化を継承。
