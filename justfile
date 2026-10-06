set shell := ["bash", "-euo", "pipefail", "-c"]

root := justfile_directory()
state := root / ".kibo-dev"
kibo_home := env("KIBO_HOME", home_directory() / ".kibo")
just := quote(just_executable()) + " --justfile " + quote(justfile())
host_arch := arch()
target_dir := env("CARGO_TARGET_DIR", root / "apps/desktop/src-tauri/target")
penpot := "docker compose -p kibo-penpot -f " + quote(root / "design/penpot/docker-compose.yaml")

# Liste les recettes
[group("divers")]
default:
    @{{ just }} --list

# Construit l'UI et lance le démon en arrière-plan
[arg("home", long="home")]
[arg("build", long="no-build", value="0")]
[arg("port", long="port")]
[group("app")]
up port="4317" home=kibo_home build="1":
    #!/usr/bin/env bash
    set -euo pipefail
    home={{ quote(home) }}
    pidf={{ quote(state / "daemon.pid") }}
    if [[ -f "$pidf" ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
      echo "Le démon tourne déjà (pid $(cat "$pidf")) : just status, just down ou just restart." >&2
      exit 1
    fi
    if [[ -f "$home/daemon.json" ]]; then
      running=$(sed -nE 's/.*"port":([0-9]+).*/\1/p' "$home/daemon.json")
      if [[ -n "$running" ]] && curl -fsS -m 1 "http://127.0.0.1:$running/api/health" >/dev/null 2>&1; then
        echo "Un démon Kibo sert déjà $home sur le port $running (l'app de bureau ?). Arrête-le ou passe --home." >&2
        exit 1
      fi
    fi
    if [[ "{{ build }}" == "1" ]]; then
      bun run --cwd packages/ui build
    elif [[ ! -f packages/ui/dist/index.html ]]; then
      echo "packages/ui/dist est vide : relance sans --no-build." >&2
      exit 1
    fi
    mkdir -p {{ quote(state) }}
    printf '%s\n%s\n' {{ quote(port) }} "$home" > {{ quote(state / "daemon.args") }}
    {{ just }} _bg-start daemon KIBO_READY env KIBO_HOME="$home" bun packages/daemon/src/main.ts --ui {{ quote(root / "packages/ui/dist") }} --port {{ quote(port) }}
    echo "KIBO_HOME : $home"
    echo "Ouvrir : just open · journal : just logs · arrêter : just down"

# Arrête le démon lancé par just up (sans rien supprimer)
[group("app")]
down:
    @{{ just }} _bg-stop daemon

# Arrête puis relance le démon avec le même port et le même KIBO_HOME
[arg("build", long="no-build", value="0")]
[group("app")]
restart build="1":
    #!/usr/bin/env bash
    set -euo pipefail
    args={{ quote(state / "daemon.args") }}
    port=4317 home={{ quote(kibo_home) }}
    if [[ -f "$args" ]]; then port=$(sed -n 1p "$args"); home=$(sed -n 2p "$args"); fi
    {{ just }} down
    flags=(--port "$port" --home "$home")
    [[ "{{ build }}" == "0" ]] && flags+=(--no-build)
    {{ just }} up "${flags[@]}"

# Affiche l'état du démon et du serveur de sync
[group("app")]
status:
    #!/usr/bin/env bash
    set -euo pipefail
    alive() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }
    pidf={{ quote(state / "daemon.pid") }}
    if alive "$pidf"; then
      port=$(sed -n 1p {{ quote(state / "daemon.args") }}); home=$(sed -n 2p {{ quote(state / "daemon.args") }})
      health=$(curl -fsS -m 1 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && echo "répond" || echo "ne répond pas")
      echo "Démon : lancé (pid $(cat "$pidf")), port $port, $health"
      echo "KIBO_HOME : $home"
    else
      echo "Démon : arrêté"
    fi
    if alive {{ quote(state / "sync.pid") }}; then
      echo "Sync : lancé (pid $(cat {{ quote(state / "sync.pid") }})), $(grep -h 'écoute sur' {{ quote(state / "sync.log") }} | tail -1)"
    else
      echo "Sync : arrêté"
    fi

# Suit le journal du démon (--sync pour celui du serveur de sync)
[arg("lines", long="lines")]
[arg("which", long="sync", value="sync")]
[group("app")]
logs lines="50" which="daemon":
    #!/usr/bin/env bash
    set -euo pipefail
    log={{ quote(state) }}/{{ which }}.log
    [[ -f "$log" ]] || { echo "Aucun journal : lance d'abord just up." >&2; exit 1; }
    exec tail -n {{ quote(lines) }} -f "$log"

# Ouvre l'UI du démon dans le navigateur, appairée
[group("app")]
open:
    #!/usr/bin/env bash
    set -euo pipefail
    pidf={{ quote(state / "daemon.pid") }}
    if ! { [[ -f "$pidf" ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; }; then
      echo "Le démon n'est pas lancé : just up." >&2
      exit 1
    fi
    url=$(sed -nE 's/^KIBO_READY (.*)$/\1/p' {{ quote(state / "daemon.log") }} | tail -1)
    if command -v open >/dev/null && [[ "$(uname)" == Darwin ]]; then open "$url"; else xdg-open "$url"; fi

# Démon --dev et UI Vite avec rechargement à chaud (port 4317)
[arg("home", long="home")]
[group("app")]
dev home=kibo_home:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
    KIBO_HOME={{ quote(home) }} bun packages/daemon/src/main.ts --dev &
    daemon=$!
    until curl -fsS -m 1 http://127.0.0.1:4317/api/health >/dev/null 2>&1; do
      kill -0 "$daemon" 2>/dev/null || { echo "Le démon --dev n'a pas démarré (port 4317 pris ?)." >&2; exit 1; }
      sleep 0.2
    done
    kill -0 "$daemon" 2>/dev/null || { echo "Un autre démon occupe le port 4317." >&2; exit 1; }
    echo "UI : http://localhost:5173/#pair=$(cat {{ quote(home / "token") }})"
    bun run --cwd packages/ui dev --strictPort

# Construit l'UI et lance le démon au premier plan
[arg("home", long="home")]
[arg("port", long="port")]
[group("app")]
start port="4317" home=kibo_home:
    bun run --cwd packages/ui build
    KIBO_HOME={{ quote(home) }} bun packages/daemon/src/main.ts --ui {{ quote(root / "packages/ui/dist") }} --port {{ quote(port) }}

# Lance l'app de bureau en développement (tauri dev)
[group("desktop")]
desktop: _ui
    bun run --cwd apps/desktop dev

# Construit l'app de bureau en debug, sans paquet
[group("desktop")]
desktop-debug: _ui
    bun run --cwd apps/desktop build:debug
    @echo "Binaire : {{ target_dir }}/debug/kibo"

# Compile le démon, kibo-hook et l'agent de démo pour l'hôte
[group("desktop")]
sidecar:
    bun run --cwd apps/desktop sidecar

# Copie la chaîne d'outils des composants dans le bundle
[group("desktop")]
toolchain:
    bun run --cwd apps/desktop toolchain

# Smoke test de l'app de bureau (construit le debug s'il manque)
[group("desktop")]
desktop-smoke: _ui
    bun run --cwd apps/desktop smoke

# Tests Rust et scripts de l'app de bureau
[group("desktop")]
desktop-test:
    cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
    bun test apps/desktop/scripts

# Smoke test de la commande kibo installée par le démon compilé
[group("desktop")]
cli-smoke:
    bun apps/desktop/scripts/cli-smoke.ts

# Paquet .dmg macOS (contient le .app)
[arg("arch", long="arch")]
[group("paquets")]
dmg arch=host_arch: (_package "macos" "dmg" arch)

# Application .app macOS
[arg("arch", long="arch")]
[group("paquets")]
app arch=host_arch: (_package "macos" "app" arch)

# Paquet .AppImage Linux
[arg("arch", long="arch")]
[group("paquets")]
appimage arch=host_arch: (_package "linux" "appimage" arch)

# Paquet .deb Linux
[arg("arch", long="arch")]
[group("paquets")]
deb arch=host_arch: (_package "linux" "deb" arch)

# Paquet .rpm Linux
[arg("arch", long="arch")]
[group("paquets")]
rpm arch=host_arch: (_package "linux" "rpm" arch)

# Tous les paquets de la plateforme courante
[arg("arch", long="arch")]
[group("paquets")]
bundle arch=host_arch: (_package "" "" arch)

# Biome : format et lint
[group("qualité")]
check:
    bun run check

# Applique le formatage Biome
[group("qualité")]
fix:
    bun run format

# Vérifie les types de tout le monorepo
[group("qualité")]
typecheck:
    bun run typecheck

# Tests unitaires (arguments passés à bun test, ex. packages/daemon)
[group("qualité")]
test *args:
    bun test {{ if args == "" { "packages components ./scripts" } else { args } }}

# Parcours Playwright (filtre, --headed, --theme dark|light, options après --)
[arg("headed", long="headed", value="--headed")]
[arg("theme", long="theme")]
[group("qualité")]
e2e headed="" theme="" *filter: _ui
    KIBO_E2E_THEME={{ quote(theme) }} bun run --cwd e2e test {{ headed }} {{ filter }}

# Budget de taille du bundle de l'UI
[group("qualité")]
budget: _ui
    bun run budget

# Enchaîne la CI en local (--desktop ajoute le job de l'app de bureau)
[arg("desktop", long="desktop", value="1")]
[group("qualité")]
ci desktop="":
    bun install --frozen-lockfile
    {{ just }} check typecheck sync-build
    packages/sync-server/dist/kibo-sync invite account --name CI --data "$(mktemp -d)"
    {{ just }} budget cli-smoke test
    KIBO_E2E_THEME=dark bun run --cwd e2e test
    {{ if desktop == "1" { just + " desktop-debug desktop-test desktop-smoke" } else { "true" } }}

# Lance kibo-sync en arrière-plan sur 127.0.0.1 (données dans .kibo-dev/sync)
[arg("data", long="data")]
[arg("port", long="port")]
[group("sync")]
sync-up port="8443" data=(state / "sync"):
    mkdir -p {{ quote(data) }}
    {{ just }} _bg-start sync "écoute sur" bun packages/sync-server/src/cli.ts serve --data {{ quote(data) }} --port {{ quote(port) }}
    @echo "Données : {{ data }} · arrêter : just sync-down"

# Arrête kibo-sync lancé par just sync-up
[group("sync")]
sync-down:
    @{{ just }} _bg-stop sync

# Compile le binaire kibo-sync
[group("sync")]
sync-build:
    bun run --cwd packages/sync-server build

# Crée un code d'invitation de compte sur le kibo-sync local
[arg("data", long="data")]
[group("sync")]
sync-invite name data=(state / "sync"):
    bun packages/sync-server/src/cli.ts invite account --name {{ quote(name) }} --data {{ quote(data) }}

# Lance Penpot (http://localhost:9010)
[group("design")]
penpot-up:
    {{ penpot }} up -d
    @echo "Penpot : http://localhost:9010"

# Arrête Penpot (les volumes et les maquettes sont conservés)
[group("design")]
penpot-down:
    {{ penpot }} down

# Affiche les conteneurs Penpot
[group("design")]
penpot-status:
    {{ penpot }} ps

# Fusionne les PDF exportés en design/pdf/kibo-design-{sombre,clair}.pdf
[group("design")]
pdf:
    design/penpot/scripts/build-pdf.sh

# Réemballe un export .penpot en design/penpot/kibo.penpot.xz
[group("design")]
penpot-pack file:
    design/penpot/scripts/pack-penpot.sh {{ quote(file) }}

# Affiche la version de l'app
[group("version")]
version:
    @bun apps/desktop/scripts/version.ts get

# Change la version (tauri.conf.json, Cargo, package.json)
[group("version")]
version-set new:
    bun apps/desktop/scripts/version.ts set {{ quote(new) }}

# Vérifie un tag (défaut : v<version>) contre la version et le CHANGELOG
[group("version")]
version-check tag="":
    bun apps/desktop/scripts/version.ts check {{ if tag == "" { "v$(bun apps/desktop/scripts/version.ts get)" } else { quote(tag) } }}

# Affiche la section du CHANGELOG d'une version (défaut : la courante)
[group("version")]
changelog version="":
    @bun apps/desktop/scripts/changelog.ts section {{ if version == "" { "$(bun apps/desktop/scripts/version.ts get)" } else { quote(version) } }}

# Installe les dépendances
[group("divers")]
install:
    bun install

# Importe le projet Kibo dans le démon en cours
[arg("home", long="home")]
[group("divers")]
dogfood home=kibo_home:
    bun scripts/dogfood/seed-kibo.ts --home {{ quote(home) }} --folder {{ quote(root) }}

# Lance la commande kibo des sources (ex. just kibo component new x)
[group("divers")]
[positional-arguments]
kibo *args:
    bun packages/cli/src/bin.ts "$@"

# Supprime les sorties de build ignorées par git (--rust : aussi target/)
[arg("rust", long="rust", value="1")]
[group("divers")]
clean rust="":
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    paths=(packages/*/dist components/*/dist apps/*/dist e2e/test-results e2e/playwright-report test-results playwright-report
      apps/desktop/src-tauri/binaries apps/desktop/src-tauri/toolchain apps/desktop/src-tauri/builtin apps/desktop/src-tauri/gen)
    [[ "{{ rust }}" == "1" ]] && paths+=(apps/desktop/src-tauri/target)
    while IFS= read -r f; do paths+=("$f"); done < <(find packages components apps e2e scripts -name node_modules -prune -o \( -name '*.tsbuildinfo' -o -name dist-types \) -print)
    for p in "${paths[@]}"; do
      if [[ -e "$p" ]] && git check-ignore -q "$p"; then rm -rf "$p"; echo "supprimé : $p"; fi
    done

[private]
_ui:
    bun run --cwd packages/ui build

[private]
_package os bundles arch:
    #!/usr/bin/env bash
    set -euo pipefail
    case "$(uname)" in Darwin) host=macos suffix=apple-darwin ;; Linux) host=linux suffix=unknown-linux-gnu ;; *) host=other ;; esac
    if [[ -n "{{ os }}" && "{{ os }}" != "$host" ]]; then
      echo "Le paquet {{ bundles }} se construit sur {{ os }} uniquement (hôte : $(uname))." >&2
      exit 1
    fi
    [[ "$host" != other ]] || { echo "Plateforme non prise en charge : $(uname)." >&2; exit 1; }
    if [[ "{{ arch }}" != "{{ host_arch }}" ]]; then
      echo "Architecture {{ arch }} impossible ici : le sidecar (bun --compile) et la chaîne d'outils native" >&2
      echo "ne se construisent que pour l'hôte ({{ host_arch }}). La release utilise un runner par architecture." >&2
      exit 1
    fi
    target="{{ arch }}-$suffix"
    {{ just }} _ui sidecar toolchain
    flags=(--target "$target" --config '{"bundle":{"createUpdaterArtifacts":false}}')
    [[ -n "{{ bundles }}" ]] && flags+=(--bundles "{{ bundles }}")
    (cd apps/desktop && env -u TAURI_SIGNING_PRIVATE_KEY -u TAURI_SIGNING_PRIVATE_KEY_PASSWORD NO_STRIP=true bun run tauri build "${flags[@]}")
    out={{ quote(target_dir) }}/"$target"/release/bundle
    echo "Artefacts dans $out (signature ad hoc, sans artefacts de mise à jour) :"
    find "$out" -maxdepth 2 -mindepth 2 \( -name '*.dmg' -o -name '*.app' -o -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' \) -print

[positional-arguments]
[private]
_bg-start name ready +cmd:
    #!/usr/bin/env bash
    set -euo pipefail
    umask 077
    name="$1" ready="$2"
    shift 2
    pidf={{ quote(state) }}/"$name.pid" log={{ quote(state) }}/"$name.log"
    mkdir -p {{ quote(state) }}
    if [[ -f "$pidf" ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
      echo "$name tourne déjà (pid $(cat "$pidf"))." >&2
      exit 1
    fi
    rm -f "$pidf"
    : > "$log"
    nohup bash -c '"$@" </dev/null & echo $! > "$0"; wait' "$pidf" "$@" >>"$log" 2>&1 &
    for _ in $(seq 1 600); do
      if grep -q "$ready" "$log"; then
        echo "$name lancé (pid $(cat "$pidf")) : $(grep "$ready" "$log" | tail -1)"
        exit 0
      fi
      if [[ -f "$pidf" ]] && ! kill -0 "$(cat "$pidf")" 2>/dev/null; then
        echo "$name s'est arrêté au démarrage. Fin du journal ($log) :" >&2
        tail -n 20 "$log" >&2
        rm -f "$pidf"
        exit 1
      fi
      sleep 0.1
    done
    echo "$name ne s'est pas annoncé en 60 s ; il tourne peut-être encore : voir $log" >&2
    exit 1

[private]
_bg-stop name:
    #!/usr/bin/env bash
    set -euo pipefail
    pidf={{ quote(state) }}/{{ name }}.pid
    if [[ ! -f "$pidf" ]]; then echo "{{ name }} n'est pas lancé."; exit 0; fi
    pid=$(cat "$pidf")
    if ! kill -0 "$pid" 2>/dev/null || ! ps -o command= -p "$pid" | grep -q bun; then
      rm -f "$pidf"
      echo "{{ name }} n'était plus lancé."
      exit 0
    fi
    kill -TERM "$pid"
    for _ in $(seq 1 150); do
      if ! kill -0 "$pid" 2>/dev/null; then rm -f "$pidf"; echo "{{ name }} arrêté."; exit 0; fi
      sleep 0.1
    done
    kill -KILL "$pid" 2>/dev/null || true
    rm -f "$pidf"
    echo "{{ name }} ne répondait pas à SIGTERM : arrêt forcé."
