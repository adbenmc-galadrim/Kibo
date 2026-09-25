#!/usr/bin/env bash
# Réemballe un export .penpot (zip) en zip non compressé puis xz : ~22 Mo au lieu de ~56 Mo.
# Usage : scripts/pack-penpot.sh ~/Downloads/Kibo.penpot   → design/penpot/kibo.penpot.xz
set -euo pipefail
src="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
unzip -q "$src" -d "$tmp/x"
(cd "$tmp/x" && zip -q -0 -r -X "$tmp/kibo.penpot" .)
xz -9 -T0 -f "$tmp/kibo.penpot"
mv "$tmp/kibo.penpot.xz" "$here/kibo.penpot.xz"
echo "$here/kibo.penpot.xz"
