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
set -euo pipefail

APP="$(cd "$(dirname "$0")/../app" && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$APP"
PAGES_BASE_PATH=/societee npm run build:pages

cp -R "$APP/out/." "$STAGE/"
cd "$STAGE"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@societee.local" commit -qm "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q --force https://github.com/tomwilliams92-hue/societee.git gh-pages
echo "deployed: https://tomwilliams92-hue.github.io/societee/"
