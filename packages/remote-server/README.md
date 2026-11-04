# kibo-remote

Serveur de `kibo.shinseo.fr` : il relaie les blocs chiffrés entre le Mac et le téléphone, et sert l'application téléphone (`packages/phone/dist`) sur la même origine. Il ne voit jamais la clé : il stocke et transmet des blocs illisibles (spec §52.6).

## Image

`packages/remote-server/Dockerfile`, construit depuis la **racine du dépôt** (le contexte doit contenir tout le monorepo). Les exclusions du contexte sont dans `packages/remote-server/Dockerfile.dockerignore`, que BuildKit lit à côté du `Dockerfile`.

- Base `oven/bun:1.4.2-slim`, `bun install --frozen-lockfile --ignore-scripts` (aucun script `postinstall`).
- Construit l'application téléphone (`bun run build:phone`), puis ne garde que les dépendances de production du serveur.
- Tourne sous l'utilisateur `bun` (non root), port **8080**, volume **`/data`**.
- `HEALTHCHECK` sur `GET /api/health`, qui répond `{"ok":true,"mac":"offline"}` (ou `"online"` quand le Mac est connecté).

```sh
docker build -f packages/remote-server/Dockerfile --build-arg KIBO_BUILD_ID=$(git rev-parse --short HEAD) -t kibo-remote .
docker run --rm -p 8080:8080 -v kibo-remote-data:/data \
  -e KIBO_REMOTE_ORIGIN=http://127.0.0.1:8080 \
  -e KIBO_REMOTE_SETUP_CODE=un-code-local-assez-long \
  kibo-remote
curl http://127.0.0.1:8080/api/health
```

Les passkeys exigent HTTPS hors de `localhost` : en local, le serveur répond et sert l'application, mais l'appairage complet ne se teste que sur `kibo.shinseo.fr` ou avec l'authentificateur virtuel des tests E2E.

### Arguments de construction

| Argument | Rôle |
| --- | --- |
| `KIBO_BUILD_ID` | Identifiant du build de l'application téléphone : nomme le cache du service worker, qui est vidé quand il change. Le SHA du commit est le bon choix. |
| `SOURCE_COMMIT` | Repli quand `KIBO_BUILD_ID` est absent ; Coolify le fournit si « Include Source Commit in Build » est coché. |

Sans l'un ni l'autre, l'heure de construction (`date +%s`) sert d'identifiant : chaque build reste distinct.

## Variables

| Variable | Obligatoire | Défaut | Rôle |
| --- | --- | --- | --- |
| `KIBO_REMOTE_ORIGIN` | oui | | Origine publique, `https://kibo.shinseo.fr` en production. Son nom d'hôte est l'identifiant des passkeys (`rpID`). |
| `KIBO_REMOTE_SETUP_CODE` | oui | | Code d'installation, **au moins 20 caractères** (le serveur refuse de démarrer sinon). Saisi une seule fois sur le Mac pour l'enregistrer. Générer avec `openssl rand -base64 24` ; il ne vit que dans Coolify, jamais dans le dépôt. |
| `KIBO_REMOTE_DB` | non | `/data/kibo-remote.db` | Fichier SQLite. |
| `KIBO_REMOTE_PORT` | non | `8080` | Port d'écoute. |
| `KIBO_REMOTE_STATIC` | non | `/app/packages/phone/dist` dans l'image | Dossier de l'application téléphone ; le serveur refuse de démarrer s'il n'existe pas. |

Chaque variable a son option en ligne de commande (`--origin`, `--setup-code`, `--db`, `--port`, `--static`), prioritaire sur la variable.

## Données

Tout l'état est dans `/data/kibo-remote.db` (compte, passkeys, sessions, blocs chiffrés). **Effacer `/data` ne perd rien d'irremplaçable** : le Mac renvoie tous ses blocs à la reconnexion. Il faut seulement réactiver l'accès sur le Mac (même code d'installation) puis appairer de nouveau le téléphone.

## Déploiement sur Coolify

Ressource « kibo » de type Dockerfile, sur le dépôt Kibo :

- **Branche** : `phase/35` pendant l'alpha de test, puis `main` une fois la phase fusionnée.
- **Base directory** `/`, **Dockerfile location** `/packages/remote-server/Dockerfile`.
- **Domaine** `https://kibo.shinseo.fr`, port exposé `8080`.
- **Stockage persistant** monté sur `/data` : un volume nommé, pas un répertoire de l'hôte (un dossier vierge appartient à root et SQLite ne pourrait pas y écrire).
- **Variables** : `KIBO_REMOTE_ORIGIN=https://kibo.shinseo.fr`, `KIBO_REMOTE_DB=/data/kibo-remote.db`, `KIBO_REMOTE_SETUP_CODE` (secret, *Available at Buildtime* décoché pour qu'il n'entre jamais dans le build), et de préférence « Include Source Commit in Build » coché pour `SOURCE_COMMIT`.
- **Auto-deploy coupé** : le déploiement passe par le workflow, pour ne pas déployer deux fois.
- **Healthcheck de Coolify coupé** : il appelle `curl` ou `wget`, absents de l'image, et ferait échouer chaque déploiement. Le `HEALTHCHECK` du `Dockerfile` (Bun) suffit.

`.github/workflows/deploy-remote.yml` déclenche le déploiement à chaque release publiée, ou à la main (`workflow_dispatch`), par `POST $COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_REMOTE_UUID&force=false`. Réglages du dépôt (Settings › Secrets and variables › Actions) :

| Nom | Type | Valeur |
| --- | --- | --- |
| `COOLIFY_TOKEN` | secret | Jeton API Coolify (droit « deploy » suffisant) |
| `COOLIFY_URL` | variable | Adresse de l'instance Coolify |
| `COOLIFY_REMOTE_UUID` | variable | UUID de la ressource « kibo » |

Reconstruire à la main : `gh workflow run deploy-remote.yml`, ou « Redeploy » dans Coolify.
