V47 Rating表示同期 + ID解決 + 階層一括補正

1) 手入力試合の Rating 表示
- Rating event の照合キーで得点を正規化。
  例: 4 / 4.0 のCSV表記差で一致しない問題を解消。
- rating_events.csv の match_key と、構造化列から再構成したキーの両方を索引化。
- 手入力・CSV由来の同一試合を画面側で拾いやすくした。

2) 学校マスタ一覧と詳細の Rating 不一致
- current_ratings / rating_school_events を後読込したあと、
  ランキング・学校マスタ・対戦台帳をすべて再描画。
- 自動再計算のpollで新Ratingを取得したときも3画面を同時更新。
- 学校IDが存在する学校は school_id を絶対優先。
  IDにRatingが無い場合、同名別校の名前fallbackで誤表示しない。

3) Rating計算側の school_id 解決強化
- 正式表示名の完全一致を alias 一致より優先。
- 北北海道/南北海道→北海道、東東京/西東京→東京として県一致判定。
- 同名・別名が多い学校でも正規IDへ結びつきやすくした。

4) 階層の一括補正
新規: master/level_overrides.csv

列:
enabled,year_from,year_to,season,region,prefecture,
tournament_pattern,round_pattern,from_level,to_level,note

- tournament_pattern / round_pattern は正規表現。
- 空欄は条件指定なし。
- 上から順に判定し、最初に一致したルールを適用。
- match_edits の個別修正後に適用し、Rating計算前の all_matches に反映。
- workflow は level_overrides.csv の変更でも自動起動。

初期ルール:
2024年以前 / 秋 / 東京 / 1R・2R・1回戦・2回戦 /
regional → prefecture

Rating係数そのものは変更なし。
