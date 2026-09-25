#!/usr/bin/env bash
# Fusionne les PDF reçus (exports/pages) en design/pdf/kibo-design-{sombre,clair}.pdf. Requiert pdfunite (poppler).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
pages="${KIBO_EXPORT_DIR:-$here/exports/pages}"
out="$here/../pdf"
mkdir -p "$out"
pdfunite $(ls "$pages"/dark-*.pdf | sort) "$out/kibo-design-sombre.pdf"
pdfunite $(ls "$pages"/light-*.pdf | sort) "$out/kibo-design-clair.pdf"
echo "$out/kibo-design-sombre.pdf $out/kibo-design-clair.pdf"
