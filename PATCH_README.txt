School merge persistence patch v2

不具合:
学校を統合しても、画面遷移/再読込後に統合元の学校が再生成されることがあった。

原因:
初期化時に all_matches.csv の raw team name を全件走査し、
localStorage の canonical key に存在しない名称を新規学校として作り直していた。
統合元名称は alias に保存されているが key ではないため復活していた。

修正:
1. 保存済み schoolMaster を先に canonical 単位で復元
2. canonical + aliases を「既に所属済み名称」として索引化
3. raw match name が alias に含まれていれば新規学校を作らない
4. 同じ端末/同じブラウザ内では統合状態を維持
5. ローカル統合がある時は precomputed server rating を一時的に使わず、
   alias-aware のブラウザ再計算でランキングへ統合を即反映

注意:
PCとスマホ間の同期はまだ未実装。
正式なGitHub school master永続化は次段階。
