V61.2 対戦台帳 即時表示化

症状:
V61では対戦台帳を開くと、rating補助CSVとhistorical_ledgerの両方を待ってから
初めて台帳を表示するため、数十秒〜かなり待つケースがあった。

変更:
- 台帳を開いた瞬間、allMatchesだけで即時表示。
- rating_school_events / rating_events / historical_ledger はバックグラウンド読込。
- 履歴データ取得後に、台帳を開いたままなら自動で再描画して過去分を追加。
- historical ledger取得失敗でも現在台帳は使用可能。
- 重複キーへdateを含める。
- V61のRating整合性・県Rating歴史修復・完全スナップショットは維持。

狙い:
「忘れた頃に台帳が出る」状態をやめ、まず即座に現在台帳を操作できるようにする。
