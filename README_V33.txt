V33 大会取込→対戦台帳 即時同期

岡山の調査結果:
- data/imported/2026/autumn/岡山.csv に存在
- output/all_matches.csv にも存在
- docs/data/all_matches.csv には存在しない

つまり解析・登録は成功しており、GitHub Pages用の対戦台帳データだけ更新されていなかった。

V33:
- 大会登録で data/imported が変わったときだけ、
  merge.py → apply_match_edits.py を実行
- output/all_matches.csv を docs/data/all_matches.csv へ即時コピー
- import workflow自身のcommitに両方を含める
- push競合で最新mainへ戻した場合も同じ再構築を実行
- analyzeだけのときは再構築しない

Rating計算は従来の Build Rating Events workflow に任せる。
そのため大会登録直後にまず対戦台帳へ試合が見え、
その後Rating/指数が追随する構成。
