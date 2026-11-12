#!/bin/sh
# Copies app/ to dist/ and stamps the git sha into the page (plan R6).
set -e
SHA="${1:-$(git rev-parse HEAD)}"
rm -rf dist && cp -r app dist
sed -i "s/__BUILD_SHA__/$SHA/g" dist/index.html
