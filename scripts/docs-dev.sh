#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")/../docs"
npm run dev
