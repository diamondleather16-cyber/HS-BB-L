GitHub共有マスタ 409競合対策 v1

症状:
GitHub 409: master/school_master_shared.json does not match <sha>

意味:
PC/スマホ/Actionなどで、読み取った時点から保存時点までにmainまたは共有マスタが更新された。
Token権限エラーではない。

対策:
- 保存直前に必ず最新の shared JSON + SHA を取得
- GitHub側の最新内容をベースに、この端末の内容をマージ
- 409/422時は 0.45 / 0.9 / 1.8 / 3.2秒間隔で最大5回再試行
- 別端末の学校情報をできるだけ保持して上書き事故を防止
- 最後まで競合した場合だけ再保存を案内

Rating自動再計算の45秒デバウンスはそのまま維持。
