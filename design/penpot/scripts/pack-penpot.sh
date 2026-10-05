#!/usr/bin/env bash
# Réemballe un export .penpot (zip) sans les vignettes, en zip non compressé puis xz.
# Usage : scripts/pack-penpot.sh ~/Downloads/Kibo.penpot   → design/penpot/kibo.penpot.xz
set -euo pipefail
src="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
unzip -q "$src" -d "$tmp/x"
# Vignettes des boards : Penpot les régénère à l'ouverture ; sans elles l'archive passe sous la limite de 100 Mo de GitHub.
python3 - "$tmp/x" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for t in root.glob("files/*/thumbnails/**/*.json"):
    media = json.loads(t.read_text()).get("mediaId")
    for f in root.glob(f"objects/{media}.*"): f.unlink()
    t.unlink()
PY
(cd "$tmp/x" && zip -q -0 -r -X "$tmp/kibo.penpot" .)
xz -9 -T0 -f "$tmp/kibo.penpot"
mv "$tmp/kibo.penpot.xz" "$here/kibo.penpot.xz"
echo "$here/kibo.penpot.xz"
