V46 Rating split-ID validation 修正

診断:
V45でRating本計算は完走し、
  Rating validation OK: 3896 schools
まで到達した。

その後の validate_split_id_ratings.py が
  Explicit split school_id missing from current_ratings.csv:
  01010044FA, 0733004EFF, 073300D635, 0940009EE9, 09470084D9
でworkflowを失敗扱いにしていた。

ユーザー確認では、この5IDは現在の
- master/school_master_shared.json
- output/all_matches.csv（ローカルmain）
のどちらにも存在しなかった。

原因:
workflow生成途中のall_matchesに残った古いschool_idまで
「現在Ratingに必ず存在すべきID」として検証していた。

V46:
- split-ID検証対象を、現在のSchool Masterに存在するactive school IDだけに限定。
- status=merged / kind=union / 現School Masterに存在しないIDはstaleとしてwarningのみ。
- active school IDなのにcurrent_ratings.csvに無い場合は従来通り失敗させる。
- Rating計算式は変更なし。
