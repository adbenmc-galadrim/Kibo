# Kibo — Spec I : mises à jour de l'application de bureau (après v1.0)

- **Date** : 2026-09-27 · **Phase** : 8 (v1.1) · **Statut** : décidé par Adam, à confirmer sur le premier tag
- **Parent** : `2026-09-25-kibo-design.md` §4 (architecture), §10 (sécurité), §11 (tests) · **Dépôt public** : `github.com/adbenmc-galadrim/Kibo`

## 1. Objectif

Qu'un utilisateur de l'application de bureau reçoive les nouvelles versions sans rien télécharger à la main, avec une chaîne
vérifiable (signature) et sans jamais qu'une installation démarre sans son accord.

## 2. Périmètre

- Publication : un workflow GitHub Actions construit les bundles, signe les artefacts de l'updater et publie une release
  GitHub avec son manifeste `latest.json`.
- Application : la coque Tauri embarque `tauri-plugin-updater` et `tauri-plugin-process` ; l'UI vérifie, affiche et
  installe depuis **Paramètres › Général**.
- Hors périmètre : signature et notarisation Apple (pas de certificat), mise à jour du démon seul (il est embarqué dans
  l'application), canal bêta, Windows.

## 3. Décisions

### 3.1 Canal

- Source : **la dernière release GitHub publiée** (ni brouillon ni pré-release) du dépôt, par l'URL stable
  `https://github.com/adbenmc-galadrim/Kibo/releases/latest/download/latest.json`.
- Tags **`vX.Y.Z`** en semver complet (les tags de jalon `v0.n` et `v1.0` restent historiques et ne produisent rien).
- La version de l'application vit dans `apps/desktop/src-tauri/tauri.conf.json` et est recopiée dans `Cargo.toml`,
  `Cargo.lock` et `apps/desktop/package.json` par `bun apps/desktop/scripts/version.ts set X.Y.Z`. Le workflow refuse un
  tag qui ne correspond pas à cette version (`version.ts check vX.Y.Z`) : impossible de publier `v1.2.0` avec une
  application qui se dit `1.1.0`.
- La release est créée **en brouillon** le temps que chaque plateforme téléverse ses artefacts, puis publiée par un
  dernier job : un utilisateur ne voit jamais un `latest.json` incomplet.

### 3.2 Vérification

- Chaque artefact de l'updater (`Kibo.app.tar.gz`, `Kibo_x.y.z_amd64.AppImage`) est signé **minisign** par la CLI Tauri à
  la construction ; `latest.json` porte les signatures ; l'application refuse tout artefact dont la signature ne
  correspond pas à la clé publique figée dans `tauri.conf.json` (`plugins.updater.pubkey`).
- Clé privée et mot de passe : secrets GitHub `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`,
  jamais dans le dépôt. Sauvegarde hors ligne chez Adam (`~/.tauri/kibo-updater.key` et `.password`). Perdre la clé, c'est
  perdre la possibilité de mettre à jour les installations existantes : on republierait une application à réinstaller.
- Sans certificat Apple, l'application n'est ni signée ni notarisée : la **première** installation demande d'ouvrir
  l'application par clic droit › Ouvrir (Gatekeeper). Les mises à jour installées par l'updater ne passent pas par un
  navigateur et ne reçoivent pas l'attribut de quarantaine : elles se relancent directement.
- Aucun secret côté application : la clé publique est le seul élément de confiance embarqué.

### 3.3 Moment et consentement

- Vérification **10 s après l'ouverture de la fenêtre**, puis **toutes les 6 h** tant qu'elle est ouverte ; bouton
  « Rechercher » pour vérifier à la demande. Aucune vérification en dehors de la fenêtre Tauri (UI dans un navigateur).
- **Jamais d'installation sans clic.** L'écran Paramètres › Général gagne une carte « Mises à jour » : version installée,
  état (à jour, vérification, disponible, téléchargement avec progression, erreur), notes de version de la release, bouton
  « Installer et redémarrer ». La carte existe en sombre et en clair (composants shadcn, tokens zinc).
- Textes en français dans `packages/ui/src/i18n/fr-updates.ts`, chargé avec l'écran Général (hors chargement initial) ;
  le budget de 230 kB n'est pas relevé et les paquets `@tauri-apps/*` sont interdits au chargement initial.

### 3.4 Redémarrage et démon

- L'installation est **refusée tant qu'un run occupe un créneau** (`starting`, `running`) : le bouton est désactivé et
  explique pourquoi. L'état vient de `getAgents` (événement déterministe du démon), pas d'un LLM. Les runs en file
  d'attente ou en attente de réponse ne tiennent aucun processus : ils ne bloquent pas et reprennent après redémarrage
  (`--resume`, déjà en place).
- Choix « refuser » plutôt qu'« attendre la file » : attendre rendrait le moment de l'installation imprévisible ;
  l'utilisateur voit le nombre de runs actifs et décide (les laisser finir ou les annuler depuis la barre des agents).
- Au redémarrage, `relaunch()` de Tauri émet `RunEvent::Exit` : la coque tue le sidecar comme à toute fermeture ; le démon
  surveille de plus son parent et s'arrête proprement s'il survit. SQLite en WAL avec `synchronous = FULL` : aucune
  perte de données. Au démarrage, l'orchestrateur marque interrompus les runs qui n'ont pas de processus et récupère
  leurs orphelins : filet de sécurité si un run démarre entre le clic et l'arrêt.

### 3.5 Compatibilité des données

Vérifié sur le code : toutes les tables du démon sont créées par `CREATE TABLE IF NOT EXISTS`, sans `PRAGMA
user_version` ni migration destructive ; les docs Loro sont des snapshots CRDT dont le format est garanti par
`loro-crdt` (version figée). Règle pour toute version future :

- **schéma additif seulement** : nouvelle table ou nouvelle colonne avec valeur par défaut ; jamais de renommage ni de
  suppression ; une version N+1 ouvre toujours une base écrite par N ;
- **pas de retour arrière** : l'updater n'installe que des versions supérieures ; si une donnée devait changer de forme,
  la version qui l'introduit convertit en lisant et écrit encore l'ancienne forme pendant une version ;
- montée de version majeure de `loro-crdt` : test dédié de relecture d'un snapshot de la version précédente avant de la
  livrer.

### 3.6 Plateformes et minutes CI

- **Par défaut** : macOS Apple Silicon (`aarch64-apple-darwin`, `.dmg` + `.app.tar.gz` signé) et Linux x86_64 (`.AppImage`
  signé, `.deb`, `.rpm`). Sur Linux, seule l'**AppImage** se met à jour toute seule ; `.deb` et `.rpm` sont publiés pour
  une installation manuelle et l'application le dit dans la carte.
- **macOS Intel** : sur demande seulement (`workflow_dispatch`, entrée `intel: true`, runner `macos-15-intel`) : les
  minutes macOS coûtent dix fois plus et la chaîne d'outils embarque des binaires natifs (`@tailwindcss/oxide`, Bun) qui
  interdisent une compilation croisée depuis un runner arm64.
- Le workflow ne se déclenche que sur un tag `v*` ou à la main : jamais sur une PR ni sur `main`.

### 3.7 Architecture : une exception explicite à « l'UI ne parle qu'au démon »

Le démon ne peut pas remplacer l'application qui l'embarque : la mise à jour est une fonction **de la coque**. Pour que
la coque reste « Rust minimal », toute la logique (état, planification, textes, blocage par les runs) vit dans l'UI en
TypeScript testé, et la coque ne fait que :

1. enregistrer `tauri-plugin-updater` et `tauri-plugin-process` ;
2. au message `KIBO_READY`, accorder **à l'exécution** une capacité IPC (`updater:default`, `process:allow-restart`,
   `core:app:allow-version`) à **l'origine exacte** du démon (`http://127.0.0.1:<port>`), et à elle seule : l'origine du
   bac à sable des composants, sur un autre port, n'obtient rien. Depuis la phase 9, la même capacité porte aussi
   `core:window:allow-set-title` (titre de la fenêtre) et `opener:allow-open-url` limitée à `https://**` (liens
   externes) : spec code et onglets §12.5. Depuis la vague 2 de la phase 9, elle porte aussi `dialog:allow-open`
   (sélecteur de dossier natif, sans `save`, `message`, `ask` ni `confirm`) : spec de conception §14.6.

L'UI appelle l'API Tauri (`@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`) **uniquement pour cela** et
uniquement quand `__TAURI_INTERNALS__` est présent. Le démon ajoute `ipc:` et `http://ipc.localhost` au `connect-src` de
sa CSP (les seuls schémas de l'IPC Tauri, inertes dans un navigateur) ; il ne change pas autrement.

## 4. Sécurité

- Signature minisign obligatoire (updater Tauri) ; HTTPS vers `github.com` ; aucun exécutable lancé hors du bundle
  téléchargé et vérifié.
- Capacité IPC limitée à une origine et aux permissions listées en §3.7 (mise à jour, redémarrage, version, titre de la fenêtre, ouverture d'URL `https` dans le navigateur, sélecteur de dossier), accordée après la réponse `KIBO_READY` du démon local.
- Aucun secret dans l'application, le CRDT ou la CI hors des secrets GitHub chiffrés.

## 5. Tests

| Niveau | Ce qu'on vérifie |
|---|---|
| UI (`bun test`) | machine à états de la mise à jour, planification (temporisateurs injectés), carte Paramètres (états, blocage par les runs, notes), budget du chargement initial |
| Démon | en-tête CSP avec les origines IPC |
| Outillage | `version.ts` : lecture, recopie dans les quatre fichiers, refus d'un tag discordant |
| Coque (CI `desktop-smoke`) | compilation avec les deux plugins, test unitaire de l'origine IPC, fumée inchangée |
| Publication | premier tag `v1.1.0` : release brouillon → publiée, `latest.json` avec `darwin-aarch64` et `linux-x86_64`, mise à jour effective depuis une `1.0.x` installée |

## 6. Publier une version

1. `bun apps/desktop/scripts/version.ts set 1.1.0`, commit `chore: version 1.1.0`.
2. Fusion sur `main`, puis `git tag v1.1.0 && git push origin v1.1.0`.
3. Le workflow `release` construit, signe, crée la release brouillon, la publie ; vérifier `latest.json` dans les assets.
4. Les applications installées proposent la mise à jour à la prochaine vérification (au plus 6 h, ou « Rechercher »).

## 7. Amendements de la phase 14 (spec de conception §20.1)

- **Signature ad hoc** sur macOS (`bundle.macOS.signingIdentity: "-"`, `hardenedRuntime: false`, sans `entitlements`), décision d'Adam du 2026-10-04 : ni certificat ni notarisation pour l'instant ; la signature minisign de l'updater est inchangée et indépendante.
- **Première ouverture** (amende §3.2, ordre de la spec de conception §20.1, repris par la page des releases, `README.md` et `docs/installation.md`) : ouvrir Kibo une première fois (macOS refuse), puis Réglages Système ▸ Confidentialité et sécurité ▸ « Ouvrir quand même » ; le clic droit ▸ Ouvrir ▸ Ouvrir ne suffit que sur macOS 14 et avant ; pour les avancés, `xattr -d com.apple.quarantine /Applications/Kibo.app`. Les mises à jour de l'updater ne reçoivent pas l'attribut de quarantaine et se relancent sans question (§3.2 reste vrai sur ce point).
- **macOS Intel construit à chaque tag** (amende §3.6) ; l'entrée `workflow_dispatch` devient `skipIntel`.
- La release publie en plus `SHA256SUMS` et `install.sh` ; son corps commence par l'encart d'installation puis la section du `CHANGELOG.md` de la version (le tag est refusé si elle manque).
- Avant `downloadAndInstall`, l'interface demande au démon une sauvegarde (`createBackup { reason: "update" }`, §20.5) ; un échec de sauvegarde bloque l'installation et l'explique.

## 8. Amendements de la phase 16 : versions alpha (décision d'Adam du 2026-10-06, spec de conception §22.12)

- **Kibo est en alpha jusqu'au lancement officiel**, qui sera la vraie `1.0.0`. Numérotation d'ici là : **`0.<phase>.0-alpha.N`** ; la phase 16 sort en `0.16.0-alpha.1`, un correctif en `0.16.0-alpha.2`, la phase 17 en `0.17.0-alpha.1`. Les tags historiques `v0.1` à `v0.6`, `v1.0` et `v1.0.0` restent ; la release GitHub `v1.0.0` est repassée en pré-release « Kibo v1.0.0 (alpha) » ; `1.1.0` à `1.6.0` ne seront jamais taguées (elles n'ont existé que dans `tauri.conf.json`). Le tag d'un jalon attend toujours la validation d'Adam.
- **Forme acceptée partout** : `APP_VERSION = /^\d+\.\d+\.\d+(?:-alpha\.\d+)?$/` (`@kibo/schema`), seule expression de version de l'application, utilisée par `readAppVersion`/`withAppVersion`/`checkReleaseTag` (devkit), `appVersion` (démon, `KIBO_VERSION`), le titre de section du `CHANGELOG.md` (`## 0.16.0-alpha.1 — AAAA-MM-JJ`) et « Quoi de neuf ». Comparaison : `compareAppVersions(a, b)` (`@kibo/schema`, pur : majeur, mineur, correctif, puis **une version sans suffixe l'emporte sur une alpha**, et `alpha.N` se compare par `N`) ; « Quoi de neuf » (spec de conception §20.4) s'affiche dès que la version installée **diffère** de la dernière vue (plus seulement quand elle est supérieure : la renumérotation `1.6.0` → `0.16.0-alpha.1` doit afficher les nouveautés).
- **Canal alpha** (amende §3.1 et §6) : une release alpha est publiée **en pré-release** (`prerelease: true`, jamais `--latest`) ; `releases/latest` ne pointe donc sur rien tant que la `1.0.0` n'existe pas. Le workflow entretient une **release roulante `alpha`** (tag `alpha` posé une fois, jamais déplacé ; pré-release ; titre « Kibo alpha · canal de mise à jour ») dont les actifs sont **remplacés** à chaque alpha publiée : `latest.json` (les URL qu'il contient visent la release versionnée), `SHA256SUMS`, `install.sh`, `icon-512.png`. L'updater interroge d'abord `https://github.com/adbenmc-galadrim/Kibo/releases/download/alpha/latest.json`, puis l'adresse `releases/latest/download/latest.json` d'origine (qui reprendra la main à la `1.0.0` ; plusieurs `endpoints` sont essayés dans l'ordre). `install.sh` télécharge par défaut depuis `releases/download/alpha` tant que la `1.0.0` n'est pas publiée (`KIBO_INSTALL_BASE_URL` inchangé pour forcer une autre adresse) ; `docs/installation.md` et le `README.md` disent « alpha ».
- **Mise à jour depuis `1.6.0`** : l'updater (comparaison semver de Tauri) ne proposera **jamais** `0.16.0-alpha.1` à une `1.6.0` installée (version inférieure) : **réinstallation manuelle unique** d'Adam depuis la release `v0.16.0-alpha.1` (DMG), documentée dans le rapport de jalon ; ensuite `alpha.1` → `alpha.2` → `0.17.0-alpha.1` se proposent normalement (semver : `0.16.0-alpha.2 > 0.16.0-alpha.1`, `0.17.0-alpha.1 > 0.16.0-alpha.2`, et `1.0.0 > 0.n.0-alpha.N`).
- **Windows** : aucun runner Windows dans `ci.yml` ni `release.yml` (matrices macOS et Linux) : rien n'y est construit aujourd'hui. Vérifié dans `tauri-bundler` (Tauri 2) : le MSI (WiX) exige un pré-release **numérique** (`convert_version` : `major.minor.patch.pre` avec `pre ≤ 65535`, sinon « optional pre-release identifier in app version must be numeric-only ») ; `0.16.0-alpha.1` serait refusé. Décision : `bundle.targets` passe de `"all"` à la liste explicite **sans `msi`** (`["app", "dmg", "deb", "rpm", "appimage"]` ; `createUpdaterArtifacts` inchangé), pour qu'un futur runner Windows ne tombe pas sur WiX ; `nsis` sera ajouté le jour où Windows entre dans la matrice, après vérification de `VIProductVersion` avec un pré-release. Aucune configuration Windows spécifique (`tauri.windows.conf.json` avec une version numérique différente fausserait l'updater).
- **Noms d'artefacts** : Tauri nomme les paquets avec la version complète (`Kibo_0.16.0-alpha.1_amd64.AppImage`, `.deb` ; le RPM interdit le tiret dans `Version` : le bundler le remplace, nom **à relever sur la release brouillon** au jalon) ; `install.sh` (`check_version`, `published_version`, `ASSET`) accepte le suffixe `-alpha.N` et les noms relevés. `SHA256SUMS` couvre tous les actifs comme avant.
- **Procédure** (amende §6) : 1. `bun apps/desktop/scripts/version.ts set 0.16.0-alpha.1`, section `## 0.16.0-alpha.1 — AAAA-MM-JJ` dans `CHANGELOG.md`, commit `chore: version 0.16.0-alpha.1` ; 2. PR de phase fusionnée sur `main` ; 3. après validation d'Adam : `git tag v0.16.0-alpha.1 && git push origin v0.16.0-alpha.1` ; 4. le workflow construit, crée la release brouillon, la publie en **pré-release** sans `--latest`, puis remplace les actifs de la release `alpha` ; 5. vérifier `latest.json` sous `releases/download/alpha/`, puis sur une `0.16.0-alpha.1` installée que « Rechercher » ne propose rien ; 6. la première fois seulement, réinstaller à la main depuis la release.
- **Échecs classés** (retour d'Adam du 2026-10-07 : « Impossible de joindre GitHub » s'affichait alors que GitHub répondait 404 sur `latest.json`) : `tauri-plugin-updater` 2.13 essaie chaque endpoint ; une réponse non 2xx (404 : aucune release sur le canal) n'est pas une erreur réseau, et quand aucun endpoint ne rend de manifeste il échoue avec « Could not fetch a valid release JSON from the remote » (`ReleaseNotFound`). L'interface classe le texte de l'erreur (`classifyUpdateFailure`, pur) : **aucune version publiée** (`ReleaseNotFound`) ⇒ statut **neutre**, sans alerte rouge, « Aucune version publiée sur ce canal pour l'instant. » en texte simple ; **manifeste ou signature invalide** (JSON illisible, champ manquant, plateforme absente de `platforms`, erreur `minisign`, signature base64 illisible, à la vérification comme à l'installation) ⇒ alerte « La version publiée est invalide (format ou signature) : rien n'a été installé. Réessaie plus tard ou télécharge-la depuis la page des releases. », avec le lien des releases ; **tout autre échec de vérification** (DNS, TLS, délai, connexion) ⇒ message réseau inchangé. Les cas sauvegarde, installation et AppImage ne changent pas.
