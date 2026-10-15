V52 大会結果取込UIのWikipedia対応

V51で直したのはhistorical_url_manifest側のWikipedia parserだけだったため、
画面の「大会結果取込」→ URLを解析 は従来generic parserのままで44試合だった。

V52:
- scripts/process_import_requests.py にWikipedia専用parserを追加。
- 第98回選手権の標準試合結果表を解析:
  日付、回戦、学校、得点、備考。
- rowspanで省略された日付を引継ぎ。
- 1x - 0 / 2x - 1 / 10x - 9 を認識。
- 延長10回/12回等を innings=10/12, finish_type=extra に設定。
- 決勝はイニング表から追加取得。
- Wikipedia記事の「48試合」と抽出件数を照合してwarningへ表示。
- V50/V51の県Rating・県相性・学校相性への歴史データ反映は継承。

第98回選手権の目標:
48試合、日付あり、回戦あり、延長情報あり。
