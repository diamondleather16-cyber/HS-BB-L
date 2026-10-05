学校ID / 地域 / 代表区分 管理 v3

今回の変更
- 学校マスタ一覧では「地区00 / 県00 / 地域00」ではなく
  例:
    地区 東北
    県 青森
    地域 八戸
  のように人が読める名称を表示
- 県以下の地域数は固定しない
- UIの「地域マスタ」で県ごとに地域を自由に追加・削除
- 学校ごとに local_district_id を保持
- 北海道・東京の通常2枠を permanent local area と別の representative area ID で管理
- 記念大会の増枠県（埼玉・千葉・神奈川・愛知・大阪・福岡）も代表区分IDを別管理
- 東東京/西東京のように大会年で境界が変わる可能性がある区分は、
  学校の恒久属性に埋め込まず representative_area_assignments.csv で年別割当する設計
- master/local_areas.csv
- master/representative_areas.csv
- master/representative_area_assignments.csv
  を追加

設計原則
1. school_id = 学校そのものの恒久ID
2. local_district_id = 日常的な県内地域/支部
3. representative_area_id = その大会の代表区分
この3つを分離する。

特に東京は「西東京/東東京」をschool_idや県内地域IDへ固定しない。
年ごとに representative_area_assignments で割り当てる。

初期代表区分ID
- 北海道: HKD-N / HKD-S
- 東京: TKY-E / TKY-W
- 埼玉: STM-E / STM-W
- 千葉: CHB-E / CHB-W
- 神奈川: KNG-N / KNG-S
- 愛知: AIC-E / AIC-W
- 大阪: OSK-N / OSK-S
- 福岡: FUK-N / FUK-S

県以下の地域マスタは初期例だけ。実際の区分数はUIから人手で増減可能。
