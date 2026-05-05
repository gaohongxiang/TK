#!/bin/sh
set -eu

cd "$(dirname "$0")/../docs"
npm run build
