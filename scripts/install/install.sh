#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${KIBO_INSTALL_BASE_URL:-https://github.com/adbenmc-galadrim/Kibo/releases/latest/download}"
HOME_DIR="${KIBO_INSTALL_HOME:-$HOME}"
ARCH="${KIBO_INSTALL_ARCH:-$(uname -m)}"

fail() { echo "kibo : $*" >&2; exit 1; }
info() { echo "kibo : $*" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || fail "la commande $1 est nécessaire"; }
fetch() { curl -fsSL "${CURL_PROTOCOLS[@]}" "$BASE_URL/$1" -o "$2" || fail "téléchargement impossible : $1"; }
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

[ "$ARCH" = "x86_64" ] || fail "architecture $ARCH non prise en charge : Kibo est publié pour Linux x86_64 (et macOS en .dmg)"

is_local_http() {
  [ "${KIBO_INSTALL_ALLOW_HTTP:-}" = "1" ] || return 1
  [[ "$BASE_URL" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$ ]]
}
if is_local_http; then
  CURL_PROTOCOLS=(--proto '=http' --proto-redir '=http')
else
  case "$BASE_URL" in
    https://*) CURL_PROTOCOLS=(--proto '=https' --proto-redir '=https' --tlsv1.2) ;;
    *) fail "adresse de téléchargement refusée : $BASE_URL (https:// obligatoire)" ;;
  esac
fi

check_version() {
  [[ "$1" =~ ^[0-9][0-9.]*$ && "$1" != *..* ]] || fail "version invalide : $1 (attendu : chiffres et points, par exemple 1.5.0)"
}
if [ -n "${KIBO_INSTALL_VERSION:-}" ]; then check_version "$KIBO_INSTALL_VERSION"; fi
need curl

detect_format() {
  if [ -n "${KIBO_INSTALL_FORMAT:-}" ]; then echo "$KIBO_INSTALL_FORMAT"; return; fi
  if command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then echo deb; return; fi
  if command -v dnf >/dev/null 2>&1; then echo rpm; return; fi
  echo appimage
}
FORMAT="$(detect_format)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fetch SHA256SUMS "$WORK/SHA256SUMS"

published_version() {
  awk '$1 ~ /^[0-9a-f]{64}$/ && $2 ~ /^Kibo_[0-9][0-9.]*_amd64\.AppImage$/ { v = $2; sub(/^Kibo_/, "", v); sub(/_amd64\.AppImage$/, "", v); print v; exit }' "$WORK/SHA256SUMS"
}
VERSION="${KIBO_INSTALL_VERSION:-$(published_version)}"
[ -n "$VERSION" ] || fail "version introuvable dans SHA256SUMS"
check_version "$VERSION"

case "$FORMAT" in
  deb) ASSET="Kibo_${VERSION}_amd64.deb" ;;
  rpm) ASSET="Kibo-${VERSION}-1.x86_64.rpm" ;;
  appimage) ASSET="Kibo_${VERSION}_amd64.AppImage" ;;
  *) fail "format $FORMAT inconnu (deb, rpm ou appimage)" ;;
esac

verify() {
  local expected actual
  expected="$(awk -v name="$2" '$2 == name { print $1; exit }' "$WORK/SHA256SUMS")"
  [ -n "$expected" ] || fail "aucune somme publiée pour $2"
  actual="$(sha256 "$1")"
  [ "$expected" = "$actual" ] || fail "La somme de contrôle ne correspond pas pour $2 : fichier refusé"
}

fetch "$ASSET" "$WORK/$ASSET"
verify "$WORK/$ASSET" "$ASSET"

install_appimage() {
  fetch icon-512.png "$WORK/icon-512.png"
  verify "$WORK/icon-512.png" icon-512.png
  local bin="$HOME_DIR/.local/bin" apps="$HOME_DIR/.local/share/applications"
  local icons="$HOME_DIR/.local/share/icons/hicolor/512x512/apps"
  install -d -m 0755 "$bin" "$apps" "$icons"
  install -m 0755 "$WORK/$ASSET" "$bin/kibo"
  install -m 0644 "$WORK/icon-512.png" "$icons/kibo.png"
  cat > "$apps/kibo.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Kibo
Comment=Centre de contrôle local pour tes projets de code
Exec=$bin/kibo
Icon=kibo
Terminal=false
Categories=Development;ProjectManagement;
Keywords=kanban;tickets;agents;claude;
StartupWMClass=kibo
DESKTOP
  if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$apps" || true; fi
}

case "$FORMAT" in
  deb)
    info "installation du paquet vérifié avec « sudo apt-get install » (ton mot de passe peut être demandé)"
    sudo apt-get install -y "$WORK/$ASSET"
    ;;
  rpm)
    info "installation du paquet vérifié avec « sudo dnf install » (ton mot de passe peut être demandé)"
    sudo dnf install -y "$WORK/$ASSET"
    ;;
  appimage) install_appimage ;;
esac

echo "Kibo $VERSION installé ($FORMAT). Lance-le depuis ton menu d'applications ; les données vivent dans ~/.kibo."
