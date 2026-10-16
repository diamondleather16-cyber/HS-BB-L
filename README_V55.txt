V55 Rating再計算後のPages自動反映

症状:
対戦台帳で試合を追加すると、Rating再計算完了直後は新Ratingが見えるが、
ブラウザ更新するとランキング・学校マスタが再計算前へ戻る。

原因:
- 画面内の再計算監視は GitHub の output/current_ratings.csv を直接読み、
  最新Ratingを一時的に表示する。
- 通常のページ再読込は GitHub Pages の docs/data/current_ratings.csv を読む。
- Rating workflow が docs/data/* をbot commitしても、
  GitHub Actionsのtokenによるpushでは別のpush workflowが通常起動しない。
- そのため Deploy Pages UI が走らず、Pagesだけ古いデータのまま残ることがある。

修正:
Deploy Pages UI に workflow_run トリガーを追加。
「Build Rating Events v2 & Deploy」が成功したら、
最新mainをcheckoutして必ずPagesを再deployする。

これにより:
試合追加 → Rating再計算 → generated output/docs更新 → Pages再deploy
まで一連で追従し、更新後に古いRatingへ戻らないようにする。

Rating式・県Rating・県相性・学校相性は変更なし。
