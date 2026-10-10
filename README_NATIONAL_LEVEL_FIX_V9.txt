全国大会階層固定 V9

症状:
- 全国大会を台帳で「全国大会」に直しても、ページ更新後に「県大会」へ戻る場合がある。

原因:
- 北海道/東京の特殊階層判定が、note の level=national より後から優先されていた。
- 神宮/選抜/選手権も season を秋/春/夏へ正規化してから判定していたため、
  古い prefecture タグが東京/北海道だと県大会へ降格することがあった。
- 同じロジックがフロントだけでなく Rating/県相性のバックエンドにも存在した。

修正:
1. season=senbatsu/koshien/jingu は常に national。
2. 明示的 level=national / level=regional は北海道・東京の特殊判定より優先。
3. フロント、build_rating_events_v2.py、build_prefecture_model.py を同じルールへ統一。
4. したがって台帳で全国大会へ変更し保存した内容は更新後も全国大会のまま維持される。
