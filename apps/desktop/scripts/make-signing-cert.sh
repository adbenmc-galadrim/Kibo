#!/usr/bin/env bash
set -euo pipefail

IDENTITY="Kibo Code Signing"
REPO="adbenmc-galadrim/Kibo"

fail() {
  echo "make-signing-cert: $1" >&2
  exit "${2:-1}"
}

nearest_existing_dir() {
  local dir="$1"
  while [ ! -d "$dir" ]; do dir="$(dirname "$dir")"; done
  (cd "$dir" && pwd -P)
}

read_password() {
  if [ -n "${KIBO_SIGNING_P12_PASSWORD:-}" ]; then
    printf '%s' "$KIBO_SIGNING_P12_PASSWORD"
    return
  fi
  [ -t 0 ] || fail "no terminal to ask the .p12 password; set KIBO_SIGNING_P12_PASSWORD"
  local first second
  read -r -s -p "Mot de passe du .p12 : " first </dev/tty; echo >&2
  read -r -s -p "Confirmation : " second </dev/tty; echo >&2
  [ -n "$first" ] || fail "empty password"
  [ "$first" = "$second" ] || fail "passwords differ"
  printf '%s' "$first"
}

[ $# -eq 1 ] || fail "usage: make-signing-cert.sh <output directory outside any git repository>" 2
command -v openssl >/dev/null || fail "openssl not found"

OUT="$1"
ANCESTOR="$(nearest_existing_dir "$OUT")"
if git -C "$ANCESTOR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "refusing to write the private key inside a git repository: $ANCESTOR"
fi
if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT")" ]; then
  fail "output directory is not empty: $OUT"
fi

PASSWORD="$(read_password)"
umask 077
mkdir -p "$OUT"
KEY="$OUT/kibo-signing.key"
CERT="$OUT/kibo-signing.crt"
P12="$OUT/kibo-signing.p12"
trap 'rm -f "$KEY"' EXIT

openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -sha256 -days 3650 \
  -subj "/CN=$IDENTITY" \
  -addext "keyUsage=digitalSignature" \
  -addext "extendedKeyUsage=codeSigning" \
  -keyout "$KEY" -out "$CERT" 2>/dev/null

# macOS security import rejects the PBKDF2/AES defaults of OpenSSL 3 and later.
openssl pkcs12 -export -name "$IDENTITY" -inkey "$KEY" -in "$CERT" -out "$P12" \
  -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 \
  -passout fd:3 3<<<"$PASSWORD"

rm -f "$KEY"
chmod 600 "$P12"
chmod 644 "$CERT"

cat <<EOF
Certificat « $IDENTITY » créé dans $OUT (valable 10 ans).
  $P12  clé privée et certificat, à garder hors du dépôt
  $CERT certificat public

Dépose les deux secrets de la release :
  base64 < "$P12" | tr -d '\n' | gh secret set MACOS_SIGNING_P12 --repo $REPO
  gh secret set MACOS_SIGNING_P12_PASSWORD --repo $REPO
EOF
