#!/usr/bin/env bash
#
# Full automation pipeline — mirrors .github/workflows/run-tests.yml
# Run on the dedicated automation machine (from your clone, e.g. under $HOME).
#
# Prerequisites: Node 20+, git, .env (see .env.example), clone on branch main,
#                git remote with push access to origin (SSH key or token).
#
# Optional env:
#   AUTOMATION_SKIP_GIT_PUSH=true  — run tests + dashboard + email only
#   PLAYWRIGHT_WITH_DEPS=true      — run install --with-deps (needs sudo on Linux)
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT — copy .env.example and fill in secrets."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository — clone the repo first."
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [[ "$BRANCH" != "main" ]]; then
  echo "Checking out main (was on: $BRANCH)"
  git checkout main
fi

echo "==> Sync to latest origin/main (discard accidental local edits on this clone)"
git fetch origin main
git reset --hard origin/main

export CI=true

echo "==> npm ci"
npm ci

if [[ "${PLAYWRIGHT_WITH_DEPS:-}" == "true" ]]; then
  echo "==> Playwright Chromium + OS deps (sudo may be required)"
  npx playwright install --with-deps chromium
else
  echo "==> Playwright Chromium only (no sudo). Set PLAYWRIGHT_WITH_DEPS=true if an admin pre-installed OS deps."
  npx playwright install chromium
fi

echo "==> Playwright tests (failures do not stop the pipeline)"
set +e
npx playwright test
set -e

echo "==> Generate dashboard data"
node scripts/generate-dashboard.js

if [[ "${AUTOMATION_SKIP_GIT_PUSH:-}" == "true" ]]; then
  echo "==> Skipping git push (AUTOMATION_SKIP_GIT_PUSH=true)"
else
  echo "==> Commit and push dashboard data"
  git fetch origin main
  git reset --mixed origin/main
  git add docs/data/ docs/history/ docs/exports/ docs/artifacts/
  if git diff --cached --quiet; then
    echo "No dashboard changes to commit."
  else
    git commit -m "Update dashboard data — $(TZ='Asia/Kolkata' date '+%b %d, %Y %I:%M %p IST')"
    git push origin HEAD:main
    echo "Dashboard data pushed."
  fi
fi

echo "==> Failure email (script no-ops when there are no failures / env missing)"
node scripts/send-email-report.js

echo "==> Done"
