V35 対戦台帳 GitHub main直読みに変更

調査:
岡山は
- data/imported/2026/autumn/岡山.csv に存在
- output/all_matches.csv に存在
- docs/data/all_matches.csv に存在しない状態が繰り返された。

V34ではPages用CSVを強制同期したが、表示状況が変わらなかったため、
対戦台帳の読込元そのものを変更。

V35:
- GitHub同期設定がある場合、起動時のall_matchesを
  output/all_matches.csv (main) から直接読む。
- GitHub直接読込に失敗した場合だけ
  docs/data/all_matches.csv (Pages) へフォールバック。
- 画面上部ステータスに読込元を表示。
- これによりPagesのdeploy遅延・docs/data同期抜けの影響を受けない。

データ生成・Rating計算ロジックは変更なし。
