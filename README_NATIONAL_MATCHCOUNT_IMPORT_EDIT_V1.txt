2点修正版

1. 全国大会のラウンド指数
- 全国大会（level=national）は round 文字列では判定しない。
- 同一 年度×season×大会名 の全試合を日付順に並べ、後ろから試合数で判定。
  最後の1試合 = 決勝
  その前2試合 = 準決勝
  その前4試合 = 準々決勝
  それ以前 = 通常指数
- 対戦台帳の指数詳細に「全国 x/総試合数」を表示。
- rating_events.csv に national_match_no / national_match_total / national_from_end を追加。

2. 大会取込の検証画面で編集
- 登録前に各試合の「回戦」「イニング」「決着（通常/コールド/延長）」を直接編集。
- 「全試合を9回通常」ボタン付き。
- 承認時に edited_matches をGitHubへ送り、その修正内容を本番CSVへ保存。
- コールド/延長は既存14列CSVを壊さず note に 7回コールド / 延長10回 の形で保存。

このZIPには school_master_shared.json / match_edits_shared.json 等の生データを含めない。
