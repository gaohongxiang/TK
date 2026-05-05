#!/bin/sh
set -eu

npm test
./scripts/docs-build.sh
npm run build
npm run smoke
npm run e2e
git diff --check
