UI Stable Load v3

今回の方針:
「全部読み終わるまで画面を待たせる」方式をやめた。

初期ロード:
1. current_ratings.csv
2. all_matches.csv
まででランキングと学校マスタを起動

後回し:
- rating_events.csv
- rating_school_events.csv
- historical_ledger_2017_2024.csv
は初期画面を表示した後に非同期読込

効果:
- 大きい補助CSVで止まってもランキング/学校マスタは操作可能
- fetchにタイムアウトを追加
- 読込段階を画面に表示
- app.js/styles.cssを新しいファイル名に変更してブラウザキャッシュを強制回避

反映確認:
上部に UI-STABLE-V3 と表示される。

重要:
index.html が app-stable-v3.js / styles-stable-v3.css を参照するため、
古いapp.jsがブラウザに残っていても影響しない。

node --check 済み。
