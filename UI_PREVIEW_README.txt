HS-BB-L UI Preview v3

追加した骨格:
- 学校ID列をランキングに追加
- 学校マスタ / 名寄せタブ
- school_id / 表示名 / 地区 / 都道府県 / 県内地区 / 代表区分 / aliases を編集
- 別名を登録するとランキング計算時に同じcanonical_nameへ集約
- ブラウザlocalStorageへ保存
- 学校マスタをCSV書き出し/読込
- 連合チームを team_id + members + weight で扱う想定をUI上に表示
- 対戦台帳タブは引き続き保持

重要:
このUIでの編集はGitHubのmaster CSVを直接書き換えない。
まず操作感を固めるための試作。
CSV書き出し後、正式master/schools.csv・school_aliases.csvへ反映するバックエンドを次段階で作る。
