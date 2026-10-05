学校マスタ PC/スマホ共通化 v1

仕組み:
- GitHubの master/school_master_shared.json を学校マスタ共有正本にする
- Pages起動時はGitHub rawの共有マスタを優先読込
- localStorageはバックアップ/未設定時fallbackのみ
- 学校編集で保存すると、同期設定済みならGitHub Contents APIへ直接commit
- 他端末はページ再読込/「共有マスタ再読込」で同じ内容になる
- Rating Action実行時は共有マスタから
  school_aliases.csv / school_lineage.csv / local_areas.csv / representative_areas.csv
  を生成してRating計算にも利用

初回設定（編集する端末ごと）:
学校マスタ → GitHub同期設定
1. owner
2. repository = HS-BB-L
3. branch = main
4. Fine-grained Personal Access Token
   Repository permissions: Contents = Read and write
を入力。
トークンをChatGPTへ送る必要はない。UI内に自分で入力する。

閲覧だけの端末:
トークン不要。GitHub rawの共有マスタを読む。

注意:
- GitHub Pages単体にはrepo書込権限がないため、編集端末だけGitHub認証が必要。
- トークンはrepoへ保存しない。
- 「この端末にトークンを記憶」をOFFにするとsessionStorageのみ。
- 競合時はGitHub側の最新shaを取得して保存するため、通常の連続編集には対応。
- ActionはRating再計算時に手動実行。
