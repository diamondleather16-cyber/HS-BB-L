登録失敗修正 v3

原因:
process_import_requests.py が data/imported CSV に innings / finish_type 列を追加したが、
既存 scripts/merge.py は従来14列スキーマのみを許可していたため
ValueError: dict contains fields not in fieldnames: 'innings', 'finish_type'
で停止していた。

修正:
- data/imported CSV は既存14列スキーマを維持
- 7回コールド -> note に「;7回コールド」
- 延長10回 -> note に「;延長10回」
- apply_match_edits.py / build_rating_events_v2.py が note から innings を復元
- 解析プレビューでは innings / finish_type 表示を維持
- importer workflow の Pages deploy を configure-pages + environment 付きに修正
- live状態ファイル import_requests.json / import_audit.json はZIPに含めない
