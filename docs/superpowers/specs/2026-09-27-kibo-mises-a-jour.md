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
   externes) : spec code et onglets §12.5.

L'UI appelle l'API Tauri (`@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`) **uniquement pour cela** et
uniquement quand `__TAURI_INTERNALS__` est présent. Le démon ajoute `ipc:` et `http://ipc.localhost` au `connect-src` de
sa CSP (les seuls schémas de l'IPC Tauri, inertes dans un navigateur) ; il ne change pas autrement.

## 4. Sécurité

- Signature minisign obligatoire (updater Tauri) ; HTTPS vers `github.com` ; aucun exécutable lancé hors du bundle
  téléchargé et vérifié.
- Capacité IPC limitée à une origine et aux permissions listées en §3.7 (mise à jour, redémarrage, version, titre de la fenêtre, ouverture d'URL `https` dans le navigateur), accordée après la réponse `KIBO_READY` du démon local.
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
