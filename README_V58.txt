V58 ランキング画面の推移表示 + 追加軽量化

1. ランキング推移
- 学校マスタ詳細に埋め込むのではなく、ランキング画面で学校名をクリックすると右側へ表示。
- 全国ランキング推移を折れ線で表示（上ほど上位）。
- Rating推移も同じパネルに表示。
- 現在順位、最高順位、現在Rating、推移点数を表示。
- 「詳細履歴」だけ従来のRating履歴モーダルへ移動。

2. 軽量化
- render()から非表示の対戦台帳renderLedger()を完全に外した。
- フィルタ無しランキングではallMatches.filter()を毎回実行しない。
- 最新日を毎回全件sortせずキャッシュ。
- rankingMasterById/name candidate indexを毎Rating行ごとに再構築していた処理をキャッシュ。
  これは学校数が増えるほど重くなる大きなボトルネックだった。
- boot時のbuildSchoolMeta二重実行を1回削減。
- 保存済み連合の再認識は、連合名に関係する行だけ詳しく照合。
- V56の重いRating event / historical ledger遅延読込を継承。

3. 継承
- V55 Pages自動再deploy
- V57 県Rating季節別ランキング
- V57 連合復旧
- Wikipedia取込/歴史Rating反映
