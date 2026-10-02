Rating Preview v1 pathspec fix

今回のエラー:
fatal: pathspec 'data/history' did not match any files

原因:
前回の修正版で
git add -A data/history master output history docs/data
としていたが、Action冒頭で data/history 自体を削除しているため、
存在しない pathspec を git add に渡してエラーになった。

修正:
git add -A
に変更し、生成物・削除差分を全部安全にステージする。

これで data/history が存在してもしなくても動く。
