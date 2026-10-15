V49 過去大会URL一括CSV化

目的:
2000～2019の秋季地区大会・神宮・選抜・選手権を、
複数サイト混在でも「URLを一覧表へ入れるだけ」でCSV化しやすくする。

追加:
1. master/historical_url_manifest.csv
   - 2000～2019をあらかじめ260行用意
     秋季地区 10地区 × 20年 = 200
     神宮/選抜/選手権 3大会 × 20年 = 60
   - source_url列へURLを貼る
   - parserは基本 auto のままでよい
   - approved=0: プレビューのみ
   - approved=1: data/historical_compat/url_imported/ に正式CSVを出力

2. scripts/process_historical_url_manifest.py
   - koshien89形式
   - HTML表: A | 5-3 | B
   - HTML表: A | 5 | 3 | B
   - HTML表: A | 5 | - | 3 | B
   - 本文: A 5-3 B
   を自動試行。
   - PDFはV49では対象外。
   - URL取得不能/解析不能は他行を止めず report に残す。

3. 出力
   output/historical_url_matches.csv  全プレビュー
   output/historical_url_report.csv   URLごとの成功/部分取得/失敗
   data/historical_compat/url_imported/...  approved=1だけ

4. GitHub Actions
   historical_url_manifest.csvをpushすると自動解析。
   reportを見て試合数が妥当なら approved を1にして再push。

注意:
古いWebページのHTML構造は一定ではないため「どんなURLでも100%」ではない。
V49はまず自動解析し、失敗URLだけ個別パーサーを追加できる土台。
