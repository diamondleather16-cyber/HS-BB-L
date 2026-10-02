#!/usr/bin/env bash
set -e
ZIP="HS-BB-L_2025spring_autofill.zip"
DIR="HS-BB-L_2025spring_autofill"
unzip -o "$ZIP"
cp -a "$DIR"/. .
rm -rf "$DIR" "$ZIP"
git add -A
git commit -m "Install 2025 spring all-prefecture auto collector"
git push
echo
echo "Uploaded. GitHub Actions will now collect all 47 prefectures automatically."
