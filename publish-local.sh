#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-../links-document-assembler/Links.DocumentAssembler.Web/vendor}"

cd "$SCRIPT_DIR"

echo "Building libreoffice-web..."
npm run pack

TARBALL="$(ls -1 libreoffice-web-*.tgz | head -1)"

mkdir -p "$DEST"
cp "$TARBALL" "$DEST/"

echo "Copied $TARBALL → $DEST/"
