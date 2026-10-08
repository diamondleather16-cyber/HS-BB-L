Pages deployment stale-version fix.

Cause:
deploy_pages_ui.yml was still checking for the old fixed asset
docs/app-history-id-redesign-v2.js.
After later UI patches renamed the current app asset, normal user pushes could
fail at the Verify step, leaving GitHub Pages on an older build.

Fix:
- Read the current app-*.js and styles-*.css names from docs/index.html.
- Verify those current assets generically.
- Deploy latest docs without depending on an old build filename.
- Includes the display-name-only school-master search fix.
- A fresh deploy also publishes the latest docs/data/all_matches.csv already in main,
  so recently imported matches become visible in the ledger.
