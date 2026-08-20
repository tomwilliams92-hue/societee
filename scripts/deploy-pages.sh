#!/bin/bash
# Deploy Societee to GitHub Pages (branch-based).
#
# Builds the app with the /societee base path and force-pushes the static
# export to the gh-pages branch, which Pages serves at
#   https://tomwilliams92-hue.github.io/societee/
#
# Branch-based rather than an Actions workflow because the Mac's stored PAT
# has `repo` scope but not `workflow` — it may not create workflow files.
# Run this after every change that should reach phones.
#
# THE GATE: after building, the full end-to-end journey (e2e/run.mjs) runs
# against the freshly built bundle before anything is pushed. If the journey
# fails, nothing deploys — regressions stop here, not on Tom's phone.
# Escape hatch for emergencies only: SKIP_E2E=1 scripts/deploy-pages.sh
set -euo pipefail

APP="$(cd "$(dirname "$0")/../app" && pwd)"
ROOT="$(cd "$APP/.." && pwd)"
STAGE="$(mktemp -d)"
SERVE_PID=""
trap '[ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null; rm -rf "$STAGE"' EXIT

cd "$APP"
PAGES_BASE_PATH=/societee npm run build:pages

if [ "${SKIP_E2E:-0}" != "1" ]; then
  # serve the built bundle under the same /societee prefix Pages uses
  mkdir -p "$STAGE/serve"
  ln -s "$APP/out" "$STAGE/serve/societee"
  (cd "$STAGE/serve" && python3 -m http.server 4173 >/dev/null 2>&1) &
  SERVE_PID=$!
  sleep 1
  echo "— e2e gate —"
  node "$ROOT/e2e/run.mjs" "http://localhost:4173/societee"
  kill "$SERVE_PID" 2>/dev/null; SERVE_PID=""
else
  echo "⚠ SKIP_E2E=1 — deploying without the end-to-end gate"
fi

mkdir -p "$STAGE/site"
cp -R "$APP/out/." "$STAGE/site/"
cd "$STAGE/site"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@societee.local" commit -qm "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q --force https://github.com/tomwilliams92-hue/societee.git gh-pages
echo "deployed: https://tomwilliams92-hue.github.io/societee/"
