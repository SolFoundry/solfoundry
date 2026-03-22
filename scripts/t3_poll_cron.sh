#!/bin/bash
# T3 Callback Poller — runs via cron every minute
# Processes Telegram inline button presses for T3 claim approvals/denials + PR approvals
set -a
source ~/.solfoundry/.env
set +a
export GITHUB_TOKEN="${SOLFOUNDRY_GITHUB_TOKEN:-${SOLFOUNDRY_GITHUB_PAT}}"
export PATH=/opt/homebrew/bin:/Users/chrono/.local/bin:$PATH

cd /Users/chrono/solfoundry
python3 scripts/t3_callback_handler.py --once >> ~/.wirework/logs/t3_callback.log 2>&1
