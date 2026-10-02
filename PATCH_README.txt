2026春季 県大会階層

基本:
- 47都道府県の2026春季大会を収集
- 既存の他年度・他seasonは保持

特例:
【北海道】
- 支部大会/地区予選 = level=prefecture
- 全道大会本戦 = level=regional
- 県大会階層としては支部のみ

【東京】
- 予備選/一次予選/地区予選 = level=prefecture
- 東京都大会本戦 = level=prefecture
- 春は予備選 + 都大会の両方を県大会階層として扱う

その他:
- 県大会本戦 = level=prefecture
- 下位予選は従来all-levelタグを維持

生成:
- master/collection_report_2026_spring_prefecture_hierarchy.csv
