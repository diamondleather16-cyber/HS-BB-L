V14 CSV保存照合修正

スクリーンショットの
「GitHub保存後の照合に失敗しました / overrideなし」
が大量に出るケースを修正。

原因:
GitHub Contents APIで保存直後に main ブランチを読み直すと、
ごく短時間だけ保存前のcommit内容が返ることがある。
旧実装はそれを保存失敗と判定していた。

修正:
- PUT成功時に返るcommit SHAを取得
- mainではなく、その保存commit SHAをrefにして再読込
- content SHAも照合
- 必要時は短時間再試行
- 正確なcommit内容でoverride/manual_matchesを照合
- 成功時は保存commit先頭8桁を表示
