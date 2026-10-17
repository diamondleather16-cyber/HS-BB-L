HS-BB-L V64.5 SUMMARY

1. 手入力試合の永続化を二重化
- match_edits_shared 全体のlocalStorageミラーとは別に、手入力試合だけの小型バックアップを新設。
- 全体ミラーがlocalStorage容量超過などで保存失敗しても、手入力試合は残る。
- 手入力追加直後、GitHub保存前にも専用バックアップへ即保存。
- 起動時はGitHub/Pages/端末ミラーに加え、手入力専用バックアップを必ず再合流。

2. GitHub main の直接読込を修正
- raw.githubusercontent.com のパスで slash を誤って %2F 化する可能性を修正。
- GitHubトークンを記憶していない再読込でも public main の match_edits_shared.json を直接確認可能。

3. 「手入力保存監査」ボタン追加
- 対戦台帳上部に追加。
- 画面/共有状態、端末専用バックアップ、GitHub main の手入力件数を比較。
- GitHub main に存在しない manual_id があれば件数と先頭IDを警告。

4. Web由来の学校名装飾を自動除去
- 「■仙台育英」「●仙台育英」「□仙台育英」等の先頭装飾を学校名から除去。
- koshien89等のURL解析時点で除去してから候補表示・登録。
- 記号は先頭だけを対象とし、学校名内部の文字には触れない。

5. 既存の汚染データも自動補正
- UI読込時に team1/team2 の先頭装飾を除去。
- 学校マスタに「■学校名」と「学校名」が共存する場合、clean名へalias統合して別学校表示を防ぐ。
- apply_match_edits.pyでも出力CSVの学校名をclean化。
- Rating計算でも同じclean化を実施し、「■仙台育英」と「仙台育英」を別校として計算しない。

6. ビルド表示
UI-MANUAL-INTEGRITY-NAMECLEAN-V64.5
