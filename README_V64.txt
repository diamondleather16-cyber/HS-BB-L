V64 学校Rating 過去シーズン完全再計算

過去データを時代逆行で追加しても、毎回年代順に並べ直して現在まで再計算します。

例:
- 2024秋県大会を追加 -> 2024秋以降から2026最新まで再計算
- 次に2024選手権を追加 -> 2024夏が秋より前へ挿入され、秋の世代交代以降も再計算
- 次に2024春、2023秋… -> 同様に現在まで伝播

仕様:
- 学校Rating対象開始年を2025 -> 2000。
- prefecture / regional / national は2025以降と同じRating係数。
- output/all_matchesを優先。
- 既存 historical_ledger_2017_2024 / historical_compat / history も補助入力。
- 同一試合は重複排除。
- 各校の世代交代は従来どおり、その年最初の秋公式戦で1000からの乖離を65%持越し。
- full replayのため旧historical matchup seedは停止し二重計上を防止。
- 初期Ratingは1000。歴史試合を直接再生するため旧prefecture strength priorは学校Rating初期値へ足さない。
- 日付欠損は季節に応じた仮月で並び順を保持。
- output/school_rating_history_coverage.csv を生成。
- Actionsでpre-2025のRating event生成を検証。

このため過去大会を追加するたび、現在Rating・現在ランキングも変化するのが正常です。
