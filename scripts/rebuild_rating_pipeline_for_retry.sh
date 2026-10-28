#!/usr/bin/env bash
set -euo pipefail
echo "::notice::START python scripts/apply_shared_school_master.py $(date -u +%FT%TZ)"
python scripts/apply_shared_school_master.py
echo "::notice::DONE python scripts/apply_shared_school_master.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/purge_blank_tournament_rows.py $(date -u +%FT%TZ)"
python scripts/purge_blank_tournament_rows.py
echo "::notice::DONE python scripts/purge_blank_tournament_rows.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/merge.py $(date -u +%FT%TZ)"
python scripts/merge.py
echo "::notice::DONE python scripts/merge.py $(date -u +%FT%TZ)"
echo "::notice::START historical date reconciliation $(date -u +%FT%TZ)"
python scripts/reconcile_historical_match_dates.py
echo "::notice::DONE historical date reconciliation $(date -u +%FT%TZ)"
echo "::notice::START python scripts/apply_match_edits.py $(date -u +%FT%TZ)"
python scripts/apply_match_edits.py
echo "::notice::DONE python scripts/apply_match_edits.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/build_match_delete_index.py $(date -u +%FT%TZ)"
python scripts/build_match_delete_index.py
echo "::notice::DONE python scripts/build_match_delete_index.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/build_prefecture_model.py $(date -u +%FT%TZ)"
python scripts/build_prefecture_model.py
echo "::notice::DONE python scripts/build_prefecture_model.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/build_rating_events_v2.py $(date -u +%FT%TZ)"
/usr/bin/time -p python scripts/build_rating_events_v2.py
echo "::notice::DONE python scripts/build_rating_events_v2.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/validate_historical_school_replay_v64.py $(date -u +%FT%TZ)"
python scripts/validate_historical_school_replay_v64.py
echo "::notice::DONE python scripts/validate_historical_school_replay_v64.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/validate_current_ratings.py $(date -u +%FT%TZ)"
python scripts/validate_current_ratings.py
echo "::notice::DONE python scripts/validate_current_ratings.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/validate_split_id_ratings.py $(date -u +%FT%TZ)"
python scripts/validate_split_id_ratings.py
echo "::notice::DONE python scripts/validate_split_id_ratings.py $(date -u +%FT%TZ)"
echo "::notice::START python scripts/validate_rating_pipeline_v61.py $(date -u +%FT%TZ)"
python scripts/validate_rating_pipeline_v61.py
echo "::notice::DONE python scripts/validate_rating_pipeline_v61.py $(date -u +%FT%TZ)"

mkdir -p docs/data
python - <<'PY'
import json,subprocess
from datetime import datetime,timezone
from pathlib import Path
status={
  "input_revision":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),
  "calculated_at":datetime.now(timezone.utc).isoformat(),
  "status":"calculated_snapshot",
}
Path("docs/data/publication_status.json").write_text(json.dumps(status,ensure_ascii=False,indent=2)+chr(10),encoding="utf-8")
PY
cp output/all_matches.csv docs/data/all_matches.csv
/usr/bin/time -p python scripts/build_ledger_shards.py
rm -rf docs/data/ledger_shards
cp -r output/ledger_shards docs/data/ledger_shards
cp output/current_ratings.csv docs/data/current_ratings.csv
cp output/rating_events.csv docs/data/rating_events.csv
cp output/rating_school_events.csv docs/data/rating_school_events.csv

rm -rf docs/data/school_history
if [ -d output/school_history ]; then cp -r output/school_history docs/data/school_history; fi
if [ -f output/school_rating_history_coverage.csv ]; then cp output/school_rating_history_coverage.csv docs/data/school_rating_history_coverage.csv; fi
if [ -f output/rating_audit_summary.json ]; then cp output/rating_audit_summary.json docs/data/rating_audit_summary.json; fi
if [ -f output/audit/historical_date_reconciliation.json ]; then cp output/audit/historical_date_reconciliation.json docs/data/historical_date_reconciliation.json; fi
if [ -f output/rating_pipeline_audit.csv ]; then cp output/rating_pipeline_audit.csv docs/data/rating_pipeline_audit.csv; fi
if [ -f output/prefecture_ratings.csv ]; then cp output/prefecture_ratings.csv docs/data/prefecture_ratings.csv; fi
if [ -f output/prefecture_rating_events.csv ]; then cp output/prefecture_rating_events.csv docs/data/prefecture_rating_events.csv; fi
if [ -f output/prefecture_history_coverage.csv ]; then cp output/prefecture_history_coverage.csv docs/data/prefecture_history_coverage.csv; fi
if [ -f master/prefecture_strength_prior.csv ]; then cp master/prefecture_strength_prior.csv docs/data/prefecture_strength_prior.csv; fi
if [ -f master/prefecture_matchups.csv ]; then cp master/prefecture_matchups.csv docs/data/prefecture_matchups.csv; fi
if [ -f master/school_master_shared.json ]; then cp master/school_master_shared.json docs/data/school_master_shared.json; fi
if [ -f master/match_edits_shared.json ]; then cp master/match_edits_shared.json docs/data/match_edits_shared.json; fi
if [ -f master/match_delete_index.json ]; then cp master/match_delete_index.json docs/data/match_delete_index.json; fi

test -s docs/data/current_ratings.csv
test -s docs/data/rating_audit_summary.json
test -s docs/data/ledger_shards/manifest.json
