V17 対戦台帳データ整合性修正

今回の根本原因:
1. match_edits_shared.json が大きくなると GitHub Contents API が本文を省略する。
   保存照合(V14.2)はblob対応済みだったが、ページ更新時の読込は未対応だった。
   そのため最新GitHubデータを読めず、古い docs/data/match_edits_shared.json を読む場合があった。

2. 保存は match_edits_shared.json 全体を書き戻す方式だが、
   remote/local mergeが常にlocal優先だった。
   古いブラウザ状態・pending状態が、新しいGitHub上の紐づけや編集を後の保存で巻き戻せた。

V17:
- 通常読込も大容量時はGit blob APIへ自動フォールバック。
- GitHub同期設定中は、API読込失敗時に古いPagesコピーへフォールバックしない。
- 保存前に毎回最新GitHubファイルを取得してからmerge。
- override/manual/team_link/deleted/generation overrideをupdated_at単位で比較。
- 新しいレコードだけが勝つ。時刻が同じ/旧形式はGitHub remote優先。
- team_linksにもupdated_atを付与。
- 新規manual試合にもupdated_atを付与。
- stale localStorage pendingが後から最新GitHubデータを巻き戻さない。
- 409/422競合時も最新remoteから作り直して最大5回再試行。

これにより
「1回目の修正は残ったが、2回目の別修正を保存すると以前の修正まで元に戻る」
という全体巻き戻りを防ぐ。
