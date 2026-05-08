#!/bin/sh
set -eu

npm test
npm run typecheck
./scripts/docs-build.sh
npm run build
npm run smoke
npm run e2e
git diff --check
