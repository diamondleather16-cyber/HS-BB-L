HS-BB-L Rating / School Lineage / Union v2

今回の追加
1. 対戦台帳に正式Ratingの試合前・期待勝率・変動・試合後を表示
2. 学校マスタのRatingを押すと学校ごとのRating推移表＋簡易グラフ
3. 学校マスタを
   地区 / 都道府県 / 県以下地区 / 状態 で絞り込み
   地区→県→県以下地区 / Rating / 学校名 / フリガナ等でソート
4. 学校のライフサイクル管理
   - active 現存
   - closed 廃校
   - merged 統合
   - planned 新設予定/準備
   - 新設年 / 廃校・統合年 / 後継学校ID
5. 改名・統合・廃校履歴を学校ごとに編集・確認
6. 名寄せ（同一校の重複ID統合）と、実際の学校統廃合を区別
7. 連合チームRating
   - 連合Rating = 構成校Ratingの加重平均
   - 試合で生じたRating変動総量を構成比で分配
   - weight未設定なら均等
   - 例: 3校連合 +10 → 各校約+3.33、合計+10
8. school_aliases.csv / team_members.csv / school_lineage.csv の雛形追加

学校IDの基本方針
- IDは一度発行したら再利用しない
- 単純な改名は同じschool_idのまま
- 廃校してもschool_idは残す
- 別法人/別学校として新設された学校は新しいschool_id
- 複数校統合で「新しい学校」が設置された場合は新IDを発行し、
  旧校IDから successor_id / lineage で接続する
- 表記揺れの名寄せと、学校制度上の統合は別操作

参考サイト
高校野球データベース bibijr.vivian.jp は長期の地方大会参加校データを継続管理し、
学校の統廃合情報も明示的に扱っている。
本パッチではその考え方を参考に、学校名だけでなく「学校の系譜」を保存できる設計にした。

重要
- ブラウザの学校マスタ/履歴編集は当面localStorage。
- 正式Rating計算で alias / 連合を反映するには
  master/school_aliases.csv
  master/team_members.csv
  をGitHub側へ反映してから Action を実行。
- 2017-2024の歴史層は現行通りprefecture prior / matchup補正。
  rating_events.csv は2025以降の正式Rating対象試合を出力する。

インストール後
Actions → Build Rating Events v2 & Deploy → Run workflow
