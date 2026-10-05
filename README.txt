Rating Events v2 連合試合数修正

今回のエラー:
Validate current ratings
  ERROR: row xx: invalid numeric field

原因:
連合チームの構成校について games / wins / losses まで
1/3, 1/2 のように分配していたため、
既存 validator の int(games) チェックに失敗した。

修正:
- Rating変動は従来通り構成比で分配
  例: 3校連合 +10 → 各校 約+3.33
- ただし、その学校が連合の一員として出場した試合は
  games = 1試合として数える
- 勝敗も各構成校に1試合分として記録
- runs_for / runs_against は従来通りweight分配
- current_ratings.csv の games/wins/losses/draws は整数出力

これで既存 validate_current_ratings.py と整合する。
