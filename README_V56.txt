V56 ページ軽量化（遅延読込）

主な原因:
初期ランキング表示後すぐ、rating_events / rating_school_events / historical_ledger を
全件ダウンロード・CSV parse・index化し、非表示の学校マスタ/対戦台帳まで再描画していた。
スマホではこのバックグラウンド処理中もページ全体が重くなる。

修正:
- 初期表示では current_ratings + all_matches + school master の必要最小限のみ。
- rating_events / rating_school_events は学校マスタ/学校相性を開いた時に遅延読込。
- historical_ledger は対戦台帳を初めて開いた時だけ遅延読込。
- 初期起動50ms後の巨大CSV一括読込を廃止。
- render()ごとの全試合 buildSchoolMeta 再計算をキャッシュ利用へ変更。
- 対戦台帳のsource件数集計を3走査→1走査。
- Rating再計算監視も、通常は current_ratings だけ更新。重いevent CSVは既読時のみ更新。

期待効果:
ランキングの起動・検索・ページ送りが軽くなり、スマホでの初期フリーズを大きく削減。
対戦台帳などを初めて開いた瞬間だけ「台帳データ読込中…」が出る。2回目以降はキャッシュ済み。

Rating式・データ内容・県Rating/相性ロジックは変更なし。
