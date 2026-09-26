# Kibo · Sync et marketplace (phase 7, v1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** partager un projet en temps réel entre plusieurs personnes via un serveur de sync auto-hébergé (`kibo-sync`), publier et installer des composants par une marketplace signée vérifiable de bout en bout, et isoler les backends sandboxés au niveau de l'OS (bubblewrap, `sandbox-exec`).

**Architecture:** un nouveau paquet `packages/trust` (WebCrypto, sans I/O) porte les signatures Ed25519, les codes à usage unique, l'empreinte canonique des sources, les certificats X.509 auto-signés, les paquets `.kpkg` et les index signés. Un nouveau paquet `packages/sync-server` (Bun, SQLite) relaie le doc Loro de chaque projet partagé : il authentifie les appareils par défi signé, applique les rôles, valide chaque mise à jour avec la fonction pure `validateProjectUpdate` de `core`, attribue les clés de ticket et héberge la marketplace d'équipe. Le démon gagne un client de sync transport-agnostique (un `ProjectSync` par projet), la présence (`EphemeralStore`), les sessions d'appairage persistées, l'accès distant TLS opt-in, le client marketplace et l'enveloppe OS du `ProcessHost`.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, loro-crdt 1.16.3 (`LoroDoc.fork`, `VersionVector`, `EphemeralStore`, `getChangeAt`), `bun:sqlite`, WebCrypto (Ed25519, ECDSA P-256, SHA-256), `Bun.serve` (TLS, WebSocket), React 19 + shadcn/ui, fast-check 4.3.0, Playwright, bubblewrap, `sandbox-exec`.

**Spec:** `docs/superpowers/specs/2026-09-26-kibo-sync.md` (spec G) et `docs/superpowers/specs/2026-09-26-kibo-marketplace.md` (spec H), sources principales ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` (spec B : empreinte §3.2, magasin §3.3, registre §3.4, `ProcessHost` §4.4, écrans 6 et 30) ; `docs/superpowers/specs/2026-09-25-kibo-design.md` §4, §5, §10, §12 ; feuille de route phase 7. Données : `design/donnees-fictives.md`. Maquettes : `design/pdf/` (écrans 3, 6, 15, 19, 30, 31) et les écrans à dessiner listés plus bas.

## Prérequis (v0.6) et recalage

Ce plan suppose les phases 2 à 6 livrées. Leurs plans n'existaient pas quand il a été écrit : les noms ci-dessous viennent des specs de phase. **La tâche 0 les confronte au code de `main` au tag `v0.6`** et corrige le plan (noms, chemins, signatures) avant la vague 1.

| Besoin | Nom supposé | Origine |
|---|---|---|
| RPC asynchrone | `Service.handle(req: RpcRequest, ctx: RpcContext): Promise<unknown>` (le `ctx` est ajouté par la tâche 9) | phases 2 à 5 |
| Base SQLite du démon | `Store.db: Database` (ajouté par la tâche 1 s'il manque) | phase 1 |
| Réglages locaux par projet | table `project_settings(projectId, key, value)` | spec B §8.2 |
| Secrets | `SecretStore`, `MemorySecretStore`, `SecretName` dans `packages/daemon/src/secrets/` | spec F §3.4 |
| Domaines | `listDomains(ws: LoroDoc): Domain[]`, `Domain = { id, name, color, guidelines }` | phase 2 |
| Runs actifs | `runs.active(): { ticketId: string; ticketKey: string; profile: string; state: RunState }[]` | phase 2 |
| Notifications système | `notify({ title, body }): Promise<void>` | phase 2 (M1) |
| Liaisons de sync | `bindings: LoroMap` du doc projet, `Binding.runner`, `Binding.createdBy` | spec F §3.2 |
| Magasin de composants | `ComponentStore.put(input: { id; version; files: SourceFile[] }): Promise<{ hash: string; dir: string }>`, `ComponentStore.remove(id, version, hash)`, `ComponentStore.readSources(id, version, hash): Promise<SourceFile[]>` | spec B §3.3 |
| Registre | `Registry.get(id, version)`, `Registry.put(id, title, v: RegistryVersion)`, `Registry.setTrust(id, version, trust)`, `Registry.all()` | spec B §3.4 |
| Aperçu de confiance (écran 30) | `TrustPreview` et `previewTrust(id, version): TrustPreview` | spec B §7.5 |
| Validation | `validateComponent(dir: string, opts?: ValidateOptions): Promise<ValidationReport>`, `hashSources(dir)`, `buildComponent(srcDir, outDir)` dans `packages/devkit` | spec B §7.4, §9.1 |
| Backend sandboxé | `ProcessHost` (`packages/daemon/src/components/backend/process-host.ts`) avec un point d'extension `spawnCommand` | spec B §4.4 |
| Journal des refus | `component_events` et `logComponentEvent(e)` | spec B §6.4 |
| UI | `SettingsPage` et `SETTINGS_SECTIONS` (`packages/ui/src/pages/settings/`), `ComponentsPage` (écran 6), `TrustDialog` (écran 30), `PublishDialog` (écran 6), `FirstRunPage` (écran 19), `StatusBar`, `TabBar`, `PairingScreen` (écran 31), `TicketSheet` | phases 1 à 6 |
| CLI | `packages/cli` avec `kibo component new|test|dev|publish` | spec B §9.2 |
| Événements WebSocket | union `DaemonEvent` (schéma) diffusée sur `/api/events` | phases 1 à 5 |

## Global Constraints

- Bun **1.4.2** partout (CI `oven-sh/setup-bun` avec `bun-version: 1.4.2`), dépendances figées par `bun.lock`, aucun `postinstall`, **aucune nouvelle dépendance npm** dans cette phase.
- **Aucun commentaire dans le code** (rédhibitoire en review) : les justifications vont dans le plan, les messages de commit ou des données nommées (ex. `reason` dans le profil macOS).
- Code, identifiants et messages d'erreur internes en anglais ; textes d'interface en français dans `packages/ui/src/i18n/fr.ts`, **tutoiement**.
- shadcn/ui depuis `@kibo/sdk/ui/*` (`packages/sdk/src/ui`) ; un composant manquant y est ajouté par le CLI shadcn, jamais écrit à la main dans `packages/ui`. Identifiants de formulaire par `useId()`.
- **Aucune erreur avalée** : tout `catch` rejette, journalise avec contexte ou convertit en `KiboError` typée ; pas de `catch {}` vide, pas de `.catch(() => null)` sans traitement.
- Nouveaux paquets (`packages/trust`, `packages/sync-server`) ajoutés au script `typecheck` racine, à `bun test packages components` et aux dépendances autorisées de `CLAUDE.md` : `schema ← trust ← {devkit, daemon, sync-server, cli}`, `schema ← core ← sync-server`.
- CI verte sur **macOS et Linux** ; E2E en **sombre et en clair** (projets Playwright `dark` et `light`).
- Transport : `wss://` obligatoire ; `ws://` seulement vers `127.0.0.1` / `localhost` (`TLS_REQUIRED` sinon). Trames JSON validées par Zod, 8 Mio max.
- Limites de sync (spec G) : envoi groupé 50 ms ; 50 Mio par projet ; 100 mises à jour / s par appareil ; 20 connexions par utilisateur ; 5 échecs d'authentification / min / IP ⇒ 429 pendant 5 min ; compactage toutes les 500 mises à jour ; déchargement d'un projet après 10 min sans client ; reconnexion 1 s → 60 s avec gigue ; présence expirée à 30 s, rafraîchie toutes les 10 s.
- Codes : invitation de compte 128 bits base32, 48 h ; code d'appareil 15 min ; invitation de projet 48 h ; tous stockés hachés (SHA-256), affichés une seule fois, usage unique. Code d'appairage : 6 caractères, 5 min, 5 essais.
- Sessions d'appairage : SQLite `remote_sessions`, hash SHA-256 de l'id (jamais l'id), 30 jours glissants, révocables ; locales et distantes.
- Marketplace : `.kpkg` ≤ 2 Mio décodés, téléchargement 30 s max, HTTPS seulement (loopback en test), redirections limitées au même hôte ; rafraîchissement au démarrage puis toutes les 6 h ; jamais d'installation automatique.
- Clés privées : `SecretStore` uniquement (`sync:device`, `market:publisher`, `remote:tls`) ; fichiers de données en `0600`, dossiers en `0700`.
- **Rien ne quitte la machine** tant que l'utilisateur n'a pas configuré un serveur **et** cliqué « Partager » sur un projet donné.
- Un projet non partagé se comporte exactement comme en v0.6 : les tests existants passent sans modification de leurs attentes.
- **Aucun compte ni serveur réel en CI** : serveur de sync, démons, fausse source marketplace et certificats auto-signés sont créés par les tests sur des ports loopback.

## Review Focus

1. **Membre retiré pendant qu'il est hors ligne** : à la reconnexion, `welcome` ne liste plus le projet ; le démon doit le marquer « Accès retiré », en lecture seule, sans rien pousser, au lieu de boucler sur des `reject` (Task 21, test « removed while offline »).
2. **Accusé perdu puis même lot renvoyé, ou serveur redémarré entre deux lots** : l'import est idempotent, aucune clé n'est attribuée deux fois, la séquence reprend après la dernière clé (Task 14, tests « duplicate push » et « reload after restart »).
3. **`bwrap` présent mais espaces de noms utilisateur interdits** (Ubuntu 24.04 par défaut) : la détection exécute une sonde réelle, pas seulement `which` ; résultat `SANDBOX_UNAVAILABLE` avec la commande `sysctl` à proposer (Task 8, test avec un faux `bwrap` qui échoue).
4. **Connexion coupée au milieu d'un partage** : relancer « Partager » est idempotent côté serveur (même propriétaire ⇒ `shared`), le projet local n'est ni dupliqué ni laissé verrouillé (Task 23, test « share retried after drop »).
5. **Code saisi avec espaces, tirets ou minuscules** (invitation, appareil, appairage à 6 caractères) : accepté après normalisation ; un code faux ne consomme jamais un code valide d'un autre utilisateur (Task 2 `normalizeCode`, Task 11, Task 13).

## Décisions nouvelles (à reporter dans les specs G et H par le chef d'équipe)

Aucune ne contredit les specs ; elles comblent leurs silences (la 14 précise une garantie de la spec H §8.3). Le chef d'équipe les reporte dans la spec concernée avant la vague 1 (règle de `CLAUDE.md`).

1. **Paquet `packages/trust`** (WebCrypto et Zod, sans I/O) : Ed25519, codes, empreinte canonique des sources (spec B §3.2), X.509, `.kpkg`, index signés, signature des requêtes HTTP. `packages/devkit` y délègue `hashSources` pour qu'il n'existe qu'une implémentation de l'empreinte. Arêtes : `schema ← trust ← {devkit, daemon, sync-server, cli}` et `schema ← core ← sync-server`.
2. **Certificats générés par un encodeur X.509 minimal** (ECDSA P-256, WebCrypto) plutôt qu'une fixture versionnée (spec G §9) ou le binaire `openssl` : aucune clé dans le dépôt, aucune dépendance, et le même code sert au certificat auto-signé de l'accès distant (spec G §7).
3. **Protocole** (spec G §6) complété : `update` et `ack` portent `version` (vecteur de versions du serveur, base de l'envoi suivant) ; `reject` porte `version` et le code `OUT_OF_DATE` (dépendances manquantes : le client renvoie depuis cette version, sans perte) ; trames ajoutées `unsubscribe`, `redeem` / `joined`, `set-role` (rôle `null` = retrait), `unshare`, `revoked`, `device-invite`, `list-devices` / `devices`, `revoke-device`, `done`, `error`, chacune corrélée par `requestId`. Invitations de kind `device` (spec G §4 « même mécanisme »). Invitation de projet valable 48 h.
4. **Défi d'authentification** : signature Ed25519 de `"kibo-sync-v1\n" + nonce + "\n" + origin`, où `origin` est l'origine publique déclarée du serveur (`--origin`).
5. **Requêtes HTTP de la marketplace d'équipe** (`POST /v1/market/*`) signées par la clé d'appareil : en-têtes `x-kibo-device`, `x-kibo-date`, `x-kibo-nonce`, `x-kibo-signature` sur `"kibo-http-v1\n" + méthode + "\n" + chemin + "\n" + date + "\n" + nonce + "\n" + sha256(corps)` ; écart d'horloge ≤ 5 min ; nonce refusé s'il a servi dans les 10 dernières minutes.
6. **Clé provisoire** : `pendingSeq = 1 + max(pendingSeq des tickets créés par ce pair Loro)`, calculé dans le doc (pas d'I/O). Ordre d'attribution = (Lamport de l'opération de création du nœud, id), le Lamport étant `change.lamport + (id.counter − change.counter)`.
7. **Partage atomique côté démon** : pendant `shareProject`, les commandes sur ce projet échouent en `CONFLICT` (« partage en cours ») ; les migrations (dossier, assignés, domaines, liaisons) sont appliquées au doc **avant** l'export du snapshot, pour que le dossier local ne parte jamais.
8. **Resynchronisation après `UPDATE_REJECTED`** : le démon remplace le doc local par un doc neuf construit depuis le serveur (`subscribe` avec `version: null`) ; les modifications locales non acceptées sont perdues (spec G §5.5).
9. **Lecture seule locale** pour un `viewer` et pour un projet « Accès retiré » : toute `ProjectCommand` échoue en `FORBIDDEN`, même hors ligne.
10. **Présence authentifiée** : le serveur n'accepte une trame de présence que si elle ne touche que la clé de l'appareil émetteur et que `userId` y est celui de la session ; il renvoie l'état courant (`encodeAll`) à chaque nouvel abonné.
11. **`Instance.componentHash`** (optionnel, `null` pour les intégrés) : écrit par le démon à l'ajout ou à la mise à jour d'une instance non intégrée ; c'est « la même empreinte » exigée par spec H §5.5 pour installer un composant absent.
12. **`RegistryVersion.source` et `RegistryVersion.revoked`** (`{ reason, at } | null`) pour afficher le motif de révocation (spec H §4).
13. **Ajout d'une source en deux temps** : `probeMarketSource { url }` lit l'index, vérifie sa signature avec la clé qu'il annonce et renvoie nom et empreinte ; l'utilisateur compare hors bande puis confirme `addMarketSource { url, publicKey }`.
14. **bubblewrap à liaison minimale** : au lieu de `--ro-bind /usr /usr`, seules les bibliothèques listées par `ldd <runtime>`, le chargeur dynamique et `/etc/ld.so.cache` sont montés, sinon `/usr/bin` resterait exécutable et « lancement d'un processus bloqué par l'OS » (spec H §8.3) serait faux. Repli validé par la tâche 8 si le runtime ne démarre pas ainsi : `--ro-bind /usr /usr`, et la ligne « processus » du test `escape` passe alors par le retrait des API de la phase 4 (écart noté au jalon). Le filtre seccomp additionnel (spec H §8.1, « à valider ») est **reporté après v1.0** : générer le programme BPF sans dépendance sort du budget de la phase ; bubblewrap couvre déjà réseau, disque et processus.
15. **Profil macOS sans commentaires dans le code** : chaque règle ajoutée est une donnée `{ rule, reason }` ; le générateur émet `reason` en ligne `;` dans le SBPL produit.
16. **Validation sandboxée à l'installation** : `validateComponent(dir, { conformanceOnly: true, wrap })`, où `wrap` enveloppe chaque sous-processus (`tsc`, `bun test`, build) dans le bac à sable OS ; les tests de l'éditeur ne sont ni fournis ni exécutés.
17. **RPC sensibles réservées aux sessions locales** (`127.0.0.1`) : `enableRemoteAccess`, `disableRemoteAccess`, `createPairingCode`, `setAllowUnsandboxed`, `connectSyncServer`, `disconnectSyncServer`, `addMarketSource`, `unpinPublisher` ⇒ `FORBIDDEN` depuis une session distante. L'appairage distant se fait par code à 6 caractères seulement (jamais par le jeton).
18. **Clé privée TLS de l'accès distant** dans `SecretStore` (`remote:tls`), certificat en `<KIBO_HOME>/remote/cert.pem` (`0600`). `SecretName` accepte les préfixes `sync`, `market` et `remote`.
19. **Présence exposée aux composants** : `sdk.presence.list()` (appel `presence.list`, soumis à `reads: ticket`) et `members` dans l'instantané, pour que le Kanban affiche « opus-dev-1 · Adam » et le nom d'un assigné identifié par `userId`.
20. **Paramètres** : nouvelles sections « Sync » (après Intégrations) et « Composants » (sous-page Sources), en plus de « Sécurité ».
21. **`kibo-sync`** est compilé par `bun build --compile` (`packages/sync-server/scripts/build.ts`), hors bundle Tauri. La source d'équipe est servie sous `<serveur>/market/` (`index.json`, `index.json.sig`, `packages/<id>/<version>.kpkg`).
22. **Clé de projet en double** : rejoindre un projet dont la clé existe déjà localement échoue en `INVALID_INPUT` avec un message explicite (« Un projet local utilise déjà la clé KIB ») ; le renommage de clé est hors périmètre v1.0.
23. **Canal du backend sandboxé en JSON par lignes sur stdin/stdout** (spec H §8.1) au lieu du canal `ipc` de Bun : `bwrap --clearenv` efface la variable qui porte ce canal. Les messages de spec B §6.3 ne changent pas ; `process-host.ts` et `component-runtime.ts` de la phase 4 sont adaptés (T12).
24. **Un paquet de marketplace demande toujours l'approbation de son empreinte** (écran 30 à chaque installation et mise à jour) : l'héritage de confiance de spec B §7.2 point 4 ne vaut que pour les composants de l'utilisateur. Raison : le code vient d'un tiers et son empreinte change à chaque version (T20).
25. **`TicketView.keyLabel`** calculé par `readProject` (« KIB-12 » ou « KIB-… ») : l'affichage ne recompose jamais une clé (T6).
26. **Tests d'intégration du démon contre le vrai serveur** : `@kibo/sync-server` est une `devDependency` du démon, importée seulement par les fichiers `*.test.ts` et `testing/` ; aucun code de production du démon ne l'importe (contrôlé par un test qui parcourt les imports de `packages/daemon/src` hors tests).

## Écrans à dessiner (Penpot, avant les tâches UI)

Aucun de ces écrans n'existe. Le chef d'équipe les dessine dans Penpot (page `07 · Sync et marketplace`), **en sombre et en clair**, avec les données de `design/donnees-fictives.md` (utilisateur Adam, collègue fictive **Léa**, serveur `sync.kibo.test`), puis réexporte `kibo.penpot.xz` et les PDF. Chaque tâche UI cite les identifiants qu'elle implémente.

**S1 · Paramètres › Sync** (nouvelle section du menu Paramètres, entre Intégrations et Sécurité). Sous-titre « Partage tes projets avec ton équipe via ton propre serveur. Rien ne part tant que tu n'as pas cliqué « Partager ». »
- *Non configuré* : encart vide (icône nuage barré), texte « Aucun serveur de sync configuré. », bouton « Se connecter à un serveur ».
- *Dialogue « Se connecter à un serveur »* : champs Adresse du serveur (`wss://sync.kibo.test`), Code d'invitation (26 caractères, aide « Donné par l'administrateur du serveur, valable 48 h »), Nom de cet appareil (pré-rempli « MacBook d'Adam »), Certificat racine (optionnel, chemin d'un fichier `.pem`, aide « Seulement pour un serveur auto-hébergé avec sa propre autorité ») ; erreurs en ligne : « Adresse non chiffrée : utilise wss:// », « Code invalide ou expiré », « Serveur injoignable » ; boutons Annuler / Se connecter (état « Connexion… »).
- *Connecté* : bloc Serveur (adresse, état en pastille : ● Connecté vert, ● Reconnexion dans 12 s ambre, ● Hors ligne gris, bouton « Se déconnecter » avec confirmation) ; bloc Compte (nom « Adam », identifiant court) ; bloc Appareils (tableau Nom · Ajouté · Vu · action : « MacBook d'Adam » badge « Cet appareil », « iMac bureau » vu il y a 2 h, bouton « Révoquer » ; bouton « Ajouter un appareil ») ; bloc Projets partagés (Projet · Rôle · Dernière sync · État : Kibo Propriétaire « à l'instant », Portfolio Éditeur, un projet « Accès retiré » en rouge).
- *Dialogue « Ajouter un appareil »* : code affiché une fois en police mono, groupé par 4, bouton Copier, « Valable 15 minutes. Saisis-le sur l'autre appareil dans Paramètres › Sync. »

**S2 · Dialogue « Partager le projet »** (menu `⋯` du projet dans la sidebar et bouton « Partager » en haut à droite d'une page de projet).
- *Étape non partagé* : titre « Partager « Kibo » », deux colonnes « Envoyé au serveur » (tickets et sous-tickets, pages et leur mise en page, liens, workflow, domaines du projet, configuration des composants) et « Reste sur ta machine » (dossier local, notes .md, runs et journaux des agents, secrets et serveurs MCP, code des composants, confiance accordée aux composants) ; mention « Le serveur voit les données en clair. » ; bouton « Partager » ; si aucun serveur : bouton désactivé et lien « Configure un serveur dans Paramètres › Sync ».
- *Étape partagé* : liste des membres (avatar initiales, nom, rôle en `Select` Propriétaire / Éditeur / Lecteur pour un propriétaire, texte simple sinon, bouton « Retirer ») ; bloc Inviter (rôle Éditeur ou Lecteur, bouton « Générer un code ») ; code affiché une fois, bouton Copier, « Valable 48 h, usage unique » ; en bas « Arrêter le partage » (propriétaire, confirmation destructive).
- *États* : « Partage en cours… » (spinner), erreur « Serveur injoignable, réessaie quand tu es en ligne ».

**S3 · Dialogue « Rejoindre un projet »** (bouton dans la sidebar sous « Nouveau projet », visible si un serveur est configuré) : champ Code d'invitation, champ Dossier local (facultatif, aide « Le dossier reste sur ta machine »), bouton Rejoindre ; erreurs « Code invalide ou expiré », « Un projet local utilise déjà la clé KIB ».

**S4 · Présence** : pile d'avatars (initiales, 24 px, bordure de la couleur du fond, 3 max puis « +2 ») à droite de la barre d'onglets pour le projet actif, infobulle « Léa · Kibo › Kanban » ; même pile réduite à droite du titre d'une page ; bandeau discret en haut du Sheet ticket « Léa regarde ce ticket » ; carte Kanban d'un ticket travaillé par l'agent d'un collègue : ligne agent « opus-dev-1 · Léa » (orange, sans barre d'état locale).

**S5 · Ticket à clé provisoire** : `KIB-…` en italique, couleur atténuée, dans la carte Kanban, l'arbre Tickets et le Sheet, infobulle « Clé attribuée à la prochaine synchronisation » ; actions désactivées avec la même infobulle : « Assigner à un agent », « Créer la branche », « Générer le message de commit ».

**S6 · Projet en lecture seule et « Accès retiré »** : bandeau pleine largeur sous la barre d'onglets, icône œil, « Lecture seule — tu es lecteur de ce projet. » ; variante rouge « Accès retiré — ta copie locale reste lisible mais n'est plus synchronisée. » ; boutons d'édition masqués (Nouveau ticket, Ajouter une page, glisser-déposer désactivé).

**S7 · Composant absent** : cadre de l'instance en pointillés, icône paquet, « Composant absent : burndown@0.3.0 », sous-texte selon le cas : bouton « Installer » (source connue) ou « Demande à Léa de le publier sur la marketplace d'équipe ».

**S8 · Paramètres › Sécurité**
- *Accès distant* : interrupteur désactivé par défaut, texte « Le démon n'écoute que sur 127.0.0.1. L'accès distant ouvre un second port, chiffré, sur une interface que tu choisis. » ; dialogue d'activation : Interface (`Select` des adresses locales, ex. « en0 · 192.168.1.20 »), Port (défaut 47832), Certificat (Auto-signé / Fourni : chemins certificat et clé), avertissement ambre, case « Je comprends que cet appareil sera joignable depuis le réseau » requise ; état activé : URL `https://192.168.1.20:47832`, empreinte SHA-256 en mono groupée, « Vérifie cette empreinte dans ton navigateur à la première connexion. », bouton « Désactiver ».
- *Sessions* : tableau Appareil · Type (Local / Distant) · Créée · Dernière activité · Expire · action « Révoquer » ; ligne courante badge « Cette session » ; texte « Une session expire après 30 jours sans activité. »
- *Isolation des composants* : état « bubblewrap actif » / « sandbox-exec actif » (vert) ou « Indisponible : … » (ambre) avec la commande d'installation ; interrupteur « Autoriser les backends sandboxés sans isolation OS » (désactivé par défaut, avertissement rouge).

**S9 · Indicateur de sync dans la barre d'état** : à droite, « ● Démon local » devient « ● Démon local · synchronisé » (vert), « · synchronisation… » (spinner), « · hors ligne » (gris) ou « · erreur de sync » (rouge, clic ⇒ Paramètres › Sync).

**M1 · Page Composants, onglet Marketplace** (onglets « Installés » / « Marketplace » en haut de l'écran 6) : champ de recherche, filtres Source et Type (Widget, Vue, Les deux) ; grille de cartes (titre, id en mono, description sur 2 lignes, type, éditeur avec coche « vérifié » ou « non vérifié », dernière version, source, badge « Installé 0.3.0 » ou « 0.4.0 disponible ») ; état vide sans source : « Aucune source de marketplace. Ajoute-en une dans Paramètres › Composants. » ; état vide de recherche.

**M2 · Détail d'un paquet** (Sheet à droite) : titre, id, description, éditeur (vérifié par <source> / non vérifié / nouvel éditeur), source, taille, empreinte courte, liste des versions (date, révoquée barrée avec motif), permissions en langage clair (mêmes phrases que l'écran 30), bouton « Voir le code » (liste des fichiers à gauche, aperçu en lecture à droite, bannière « Code vérifié : signature et empreinte correspondent »), bouton principal « Installer » (« Installation… », puis écran 30) ; erreurs de contrôle : « Signature invalide », « L'empreinte ne correspond pas », « Version révoquée : <motif> », « La clé de l'éditeur a changé » avec « Débloquer… ».

**M3 · Paramètres › Composants › Sources** : tableau Nom · Adresse · Empreinte de la clé (courte) · Index n° · Mis à jour · État ; bouton « Ajouter une source » ⇒ dialogue en deux étapes (1 : adresse HTTPS ; 2 : nom de la source, empreinte complète groupée par 4, « Compare cette empreinte avec celle communiquée par l'éditeur de la source », boutons Retour / Ajouter) ; menu `⋯` Rafraîchir, Retirer ; erreur « Index refusé : numéro inférieur au dernier vu ».

**M4 · Onglet Installés, états marketplace** : colonne Origine « Marketplace · Équipe » ; badge « 0.4.0 disponible » avec bouton « Mettre à jour » (ouvre l'écran 6) ; ligne révoquée : badge rouge « Révoqué », motif en sous-texte, instances en « Autorisation requise — Révoqué : <motif> ».

**M5 · Écran 30, variantes marketplace** : sous-titre « Publié par Léa · vérifié par Équipe » ou « Publié par Léa · éditeur non vérifié » ; badge « Nouvel éditeur » au premier install ; avertissement supplémentaire sous « Confiance totale » : « Ce code vient d'une marketplace. ».

**M6 · Clé d'éditeur changée** : dialogue destructif « La clé de l'éditeur a changé » (ancienne et nouvelle empreintes, « Ne débloque que si l'éditeur t'a confirmé ce changement »), boutons Annuler / Débloquer.

**M7 · Backend indisponible faute d'isolation OS** : bannière ambre en haut de la page Composants « Les backends sandboxés sont arrêtés : isolation OS indisponible. » + commande (`sudo apt install bubblewrap` ou `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`) ; instance concernée : « Backend arrêté — isolation OS indisponible » ; écran 19 : ligne « Isolation des composants » (✓ bubblewrap 0.9 / sandbox-exec, ou ⚠ avec la commande).

**M8 · Publier sur la marketplace** (menu `⋯` d'un composant utilisateur) : choix de la source (sources d'équipe seulement), nom d'éditeur au premier usage (« Ce nom accompagne tes composants publiés »), récapitulatif version, empreinte, permissions ; états « Publication… », succès « Publié : index n° 42 », erreurs « Version déjà publiée », « Tu n'as pas le droit de publier sur cette source ».

## File Structure

```
packages/trust/                        NOUVEAU — crypto et formats signés, WebCrypto, sans I/O
  src/bytes.ts                         base64, utf8, sha256Hex, égalité constante
  src/ed25519.ts                       paires de clés, signature, vérification, empreinte de clé
  src/codes.ts                         codes d'invitation (base32 128 bits), code d'appairage, normalisation, hachage
  src/source-hash.ts                   empreinte canonique des sources (spec B §3.2)
  src/der.ts  src/x509.ts              encodeur DER, certificat auto-signé ECDSA P-256, empreinte SHA-256
  src/http-signing.ts                  charge signée des requêtes HTTP (décision 5)
  src/kpkg.ts                          paquet .kpkg : construction, signature, décodage, contrôles
  src/market-index.ts                  index signé : signature, vérification, anti-retour
  src/verify-package.ts                chaîne complète paquet × index × épinglage
packages/schema/src/
  errors.ts                            nouveaux codes (T1)
  sync.ts                              rôles, trames, présence, statuts (T4)
  security.ts                          sessions, accès distant, isolation (T4)
  market.ts                            Kpkg, MarketIndex, types RPC marketplace (T5)
  ticket.ts  rpc.ts  instance.ts       clé nullable + pendingSeq (T6), RPC (T4, T5), componentHash (T5)
packages/core/src/
  keys.ts                              allocateur, clé provisoire, ordre Lamport, membres (T6, T7)
  validate-update.ts                   validateProjectUpdate (T7)
  share-migration.ts                   migrations du premier partage (T7)
packages/sync-server/                  NOUVEAU — kibo-sync
  src/db.ts  src/accounts.ts  src/members.ts  src/audit.ts  src/auth.ts  src/limits.ts   (T11)
  src/room.ts  src/rooms.ts            salle de projet (T14)
  src/hub.ts  src/server.ts  src/cli.ts  scripts/build.ts   (T17)
  src/market/team-market.ts  src/market/routes.ts  src/market/signed-request.ts   (T16)
  src/testing/start-test-server.ts     serveur de test TLS en processus (T17)
packages/daemon/src/
  settings.ts                          réglages locaux clé/valeur (T1)
  sessions/session-store.ts            sessions persistées hachées (T9)
  remote/pairing-codes.ts  remote/remote-access.ts  remote/interfaces.ts   (T13)
  sandbox/detect.ts  sandbox/bwrap.ts  sandbox/macos.sb.ts  sandbox/os-sandbox.ts   (T8)
  sandbox/escape.test.ts  testing/fixtures/escape/   (T12)
  sync/transport.ts  sync/project-sync.ts   (T18)
  sync/convergence.property.test.ts  sync/testing/in-memory-network.ts   (T19)
  sync/sync-db.ts  sync/device-keys.ts  sync/sync-client.ts  sync/rpc.ts   (T21)
  sync/share.ts   (T23)      sync/presence.ts   (T24)
  market/market-db.ts  market/http-get.ts  market/market-service.ts  market/rpc.ts   (T15)
  market/install.ts   (T20)  market/publish.ts   (T22)
  testing/fake-market.ts   (T15)   testing/sync-harness.ts   (T21)
packages/devkit/src/                   hashSources délègue à trust (T2) ; validateComponent({ conformanceOnly, wrap }) (T20)
packages/cli/src/market.ts             kibo market keygen|pack|index ; publish --to (T22)
packages/sdk/src/                      presence, members, TicketKeyLabel (T30)
packages/ui/src/
  pages/settings/SecuritySettings.tsx  dialogs/EnableRemoteAccessDialog.tsx   (T25)
  pages/components/MarketplaceTab.tsx  pages/components/MarketPackageSheet.tsx
  pages/settings/ComponentSourcesSettings.tsx  dialogs/AddSourceDialog.tsx   (T26)
  dialogs/PublishToMarketDialog.tsx  dialogs/PublisherChangedDialog.tsx  shell/MissingComponent.tsx   (T27)
  pages/settings/SyncSettings.tsx  dialogs/ConnectServerDialog.tsx  dialogs/AddDeviceDialog.tsx  shell/SyncIndicator.tsx   (T28)
  dialogs/ShareProjectDialog.tsx  dialogs/JoinProjectDialog.tsx  shell/ProjectAccessBanner.tsx   (T29)
  shell/PresenceAvatars.tsx   (T30)
  i18n/fr.ts                           sections security, market, sync, share, presence
e2e/
  serve-sync.ts  sync.spec.ts   (T31)       serve-market.ts  market.spec.ts   (T32)
.github/workflows/ci.yml               bubblewrap + sysctl AppArmor (T8), build kibo-sync (T17), E2E (T31, T32)
CLAUDE.md                              monorepo et arêtes (T1)
```

## Contrats partagés

Chaque tâche ne voit que sa propre section : ces signatures font foi entre tâches. Une tâche qui doit en changer une le signale au chef d'équipe, qui corrige ici avant d'intégrer.

### Schéma (`@kibo/schema`)

```ts
// errors.ts (T1) — ajouts à KiboErrorCode
| "UPDATE_REJECTED" | "ACCESS_REVOKED" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "INVITE_INVALID" | "DEVICE_REVOKED"
| "TLS_REQUIRED" | "SYNC_OFFLINE" | "SANDBOX_UNAVAILABLE" | "SIGNATURE_INVALID" | "PUBLISHER_CHANGED" | "REVOKED"
| "INDEX_ROLLBACK"

// sync.ts (T4)
export const Role = z.enum(["owner", "editor", "viewer"]);
export const KeyAllocator = z.enum(["local", "server"]);
export const Base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
export const MemberInfo = z.object({ userId: z.string().min(1), name: z.string().min(1), role: Role });
export const PresenceRun = z.object({ ticketKey: z.string().nullable(), profile: z.string(), state: z.string() });
export const PresenceState = z.object({ userId: z.string(), name: z.string(), pageId: z.string().nullable(),
  ticketId: z.string().nullable(), runs: z.array(PresenceRun).max(50) });
export const DeviceInfo = z.object({ deviceId: z.string(), name: z.string(), createdAt: z.number(),
  lastSeenAt: z.number().nullable(), revokedAt: z.number().nullable() });
export const RejectCode = z.enum(["UPDATE_REJECTED", "OUT_OF_DATE", "FORBIDDEN", "QUOTA_EXCEEDED", "RATE_LIMITED"]);
export const ClientFrame = z.discriminatedUnion("type", [ /* auth, subscribe, unsubscribe, push, presence, share, invite,
  redeem, set-role, unshare, device-invite, list-devices, revoke-device — champs exacts en T4 */ ]);
export const ServerFrame = z.discriminatedUnion("type", [ /* challenge, welcome, update, ack, reject, presence, members,
  invite-code, shared, joined, revoked, devices, done, error — champs exacts en T4 */ ]);
export const JoinRequest = z.object({ code: z.string().min(1).max(64), publicKey: Base64, deviceName: z.string().trim().min(1).max(64) });
export const JoinResponse = z.object({ userId: z.string(), deviceId: z.string(), name: z.string() });
export const MAX_FRAME_BYTES = 8 * 1024 * 1024;
export function challengePayload(nonce: string, origin: string): Uint8Array;
export const SYNC_LIMITS: { batchMs: 50; projectBytes: 52428800; updatesPerSecond: 100; connectionsPerUser: 20;
  authFailuresPerMinute: 5; authBlockMs: 300000; compactEvery: 500; unloadAfterMs: 600000; backoffMinMs: 1000;
  backoffMaxMs: 60000; presenceTimeoutMs: 30000; presenceRefreshMs: 10000; accountInviteMs: 172800000;
  deviceInviteMs: 900000; projectInviteMs: 172800000 };
export const CLOSE_CODES: { authFailed: 4401; deviceRevoked: 4403; accessRevoked: 4404; tooManyConnections: 4429 };
export type SyncState = "unconfigured" | "connecting" | "online" | "offline";
export type SyncProjectStatus = { projectId: string; name: string; role: Role; lastSyncAt: number | null;
  lastError: string | null; accessRevoked: boolean };
export type SyncStatus = { state: SyncState; serverUrl: string | null; user: { id: string; name: string } | null;
  deviceId: string | null; retryAt: number | null; lastError: string | null; projects: SyncProjectStatus[] };
export type PresencePeer = PresenceState & { deviceId: string; self: boolean };
export type ProjectAccess = "write" | "read-only" | "revoked";
export type ProjectSyncInfo = { shared: boolean; keyAllocator: KeyAllocator; role: Role | null; access: ProjectAccess;
  members: MemberInfo[] };

// security.ts (T4)
export type SessionInfo = { id: string; deviceName: string; remote: boolean; createdAt: number; lastSeenAt: number;
  expiresAt: number; current: boolean };
export const RemoteTls = z.discriminatedUnion("kind", [z.object({ kind: z.literal("self-signed") }),
  z.object({ kind: z.literal("provided"), certFile: z.string().min(1), keyFile: z.string().min(1) })]);
export const RemoteAccessConfig = z.object({ address: z.string().ip(), port: z.number().int().min(1024).max(65535), tls: RemoteTls });
export type RemoteAccessStatus = { enabled: boolean; address: string | null; port: number | null; url: string | null;
  fingerprint: string | null; tls: "self-signed" | "provided" | null; interfaces: { name: string; address: string }[];
  lastError: string | null };
export type PairingCode = { code: string; expiresAt: number };
export type SandboxStatus = { kind: "bwrap" | "sandbox-exec" | null; available: boolean; reason: string | null;
  fix: string | null; allowUnsandboxed: boolean };

// ticket.ts (T6)
key: TicketKey.nullable(), pendingSeq: z.number().int().positive().nullable()   // refine : key !== null || pendingSeq !== null
export function ticketKeyLabel(t: { key: string | null }, projectKey: string): string;   // "KIB-12" ou "KIB-…"
// rpc.ts (T6) : ProjectSnapshot.nextTicketKey: string | null ; ProjectSnapshot.sync: ProjectSyncInfo

// market.ts (T5)
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const KpkgFile = z.object({ path: z.string().min(1), sha256: Sha256, content: Base64 });
export const Kpkg = z.object({ format: z.literal(1), manifest: ComponentManifest, files: z.array(KpkgFile).min(1),
  hash: Sha256, publisher: z.object({ name: z.string().min(1).max(64), publicKey: Base64 }),
  publishedAt: z.string().datetime(), signature: Base64 });
export const MarketIndex = /* spec H §3.2 à l'identique */;
export const KPKG_MAX_BYTES = 2 * 1024 * 1024; export const MARKET_FETCH_TIMEOUT_MS = 30_000;
export const MARKET_REFRESH_MS = 6 * 3600_000;
export type MarketSourceInfo = { id: string; name: string; url: string; publicKey: string; fingerprint: string;
  lastSerial: number | null; lastFetchedAt: number | null; lastError: string | null; enabled: boolean };
export type MarketProbe = { sourceId: string; name: string; publicKey: string; fingerprint: string; serial: number; packages: number };
export type MarketHit = { sourceId: string; sourceName: string; id: string; title: string; description: string;
  kind: ComponentKind; latest: string; publisher: { name: string; publicKey: string; verified: boolean };
  installed: string | null; updateAvailable: string | null };
export type MarketVersionInfo = { version: string; hash: string; size: number; permissions: GrantedPermissions;
  publishedAt: string; revoked: string | null };
export type MarketPackageDetail = MarketHit & { version: string; hash: string; size: number;
  permissions: GrantedPermissions; versions: MarketVersionInfo[]; pinnedPublisher: string | null;
  newPublisher: boolean; publisherChanged: boolean; files: { path: string; content: string }[] };
export type MarketInstallResult = { id: string; version: string; hash: string; preview: TrustPreview };
// registry (T5) : RegistryVersion.source: { sourceId: string; publisherKey: string } | null (défaut null)
//                 RegistryVersion.revoked: { reason: string; at: number } | null (défaut null)
// instance.ts (T5) : Instance.componentHash: Sha256 | null (défaut null)
```

### Trust (`@kibo/trust`)

```ts
// bytes.ts (T2)
export function toBase64(bytes: Uint8Array): string;
export function fromBase64(text: string): Uint8Array;            // KiboError INVALID_INPUT si invalide
export function utf8(text: string): Uint8Array;
export function sha256Hex(data: Uint8Array | string): Promise<string>;
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean;
// ed25519.ts (T2)
export type KeyPair = { publicKey: string; privateKey: string };   // SPKI base64, PKCS8 base64
export function generateKeyPair(): Promise<KeyPair>;
export function signBytes(privateKey: string, data: Uint8Array): Promise<string>;
export function verifyBytes(publicKey: string, data: Uint8Array, signature: string): Promise<boolean>;  // false si mal formé, ne lève jamais
export function keyFingerprint(publicKey: string): Promise<string>;   // sha256 hex des octets SPKI
export function formatFingerprint(hex: string): string;              // groupes de 4 séparés par des espaces
export function shortHash(hex: string): string;                      // "3f9a…c21e"
// codes.ts (T2)
export function newInviteCode(): string;          // 26 caractères base32 RFC 4648 sans remplissage
export function newPairingCode(): string;         // 6 caractères dans ABCDEFGHJKLMNPQRSTUVWXYZ23456789
export function normalizeCode(input: string): string;   // majuscules, sans espaces ni tirets
export function formatPairingCode(code: string): string; // "K7Q-4M2"
export function hashCode(code: string): Promise<string>; // sha256Hex(normalizeCode(code))
// source-hash.ts (T2)
export type SourceFile = { path: string; bytes: Uint8Array };
export function isHashedSource(path: string): boolean;
export function sourceHash(files: SourceFile[]): Promise<string>;
// x509.ts (T3)
export type SelfSigned = { certPem: string; keyPem: string; fingerprint256: string };   // "AB:CD:…" majuscules
export function generateSelfSignedCert(opts: { commonName: string; dns: string[]; ips: string[]; days: number; now?: Date }): Promise<SelfSigned>;
export function certFingerprint(certPem: string): Promise<string>;
// http-signing.ts (T2)
export const HTTP_SIGNATURE_HEADERS: { device: "x-kibo-device"; date: "x-kibo-date"; nonce: "x-kibo-nonce"; signature: "x-kibo-signature" };
export function httpSigningPayload(input: { method: string; path: string; date: string; nonce: string; bodySha256: string }): Uint8Array;
export function signRequest(input: { deviceId: string; privateKey: string; method: string; path: string; body: Uint8Array; now: number }): Promise<Record<string, string>>;
// kpkg.ts (T10)
export function signingPayload(pkg: Pick<Kpkg, "manifest" | "hash" | "publisher" | "publishedAt">): Uint8Array;
export function packKpkg(input: { manifest: ComponentManifest; files: SourceFile[]; publisherName: string; keys: KeyPair; publishedAt: Date }): Promise<Kpkg>;
export function encodeKpkg(pkg: Kpkg): Uint8Array;
export function decodeKpkg(bytes: Uint8Array): Kpkg;                  // taille, JSON, Zod ⇒ INVALID_INPUT
export function verifyKpkgSignature(pkg: Kpkg): Promise<void>;         // SIGNATURE_INVALID
export function kpkgSourceFiles(pkg: Kpkg): Promise<SourceFile[]>;     // sha256 par fichier, chemins sûrs, 2 Mio, empreinte ⇒ HASH_MISMATCH
// market-index.ts (T10)
export function signIndex(index: MarketIndex, privateKey: string): Promise<{ bytes: Uint8Array; sig: string }>;
export function verifyIndex(input: { bytes: Uint8Array; sig: string; expectedKey: string; lastSerial: number | null }): Promise<MarketIndex>;
// verify-package.ts (T10)
export function verifyMarketPackage(input: { pkg: Kpkg; index: MarketIndex; pinnedKey: string | null }):
  Promise<{ files: SourceFile[]; newPublisher: boolean }>;   // ordre spec H §4 : SIGNATURE_INVALID, HASH_MISMATCH, NOT_FOUND | REVOKED, PUBLISHER_CHANGED
```

### Core (`@kibo/core`)

```ts
// keys.ts (T6)
export function getKeyAllocator(doc: LoroDoc): KeyAllocator;
export function nextPendingSeq(doc: LoroDoc): number;
// keys.ts (T7) — écrit par le serveur uniquement
export function ticketCreationLamport(doc: LoroDoc, ticketId: string): number;
export function pendingTicketOrder(doc: LoroDoc): string[];
export function allocateTicketKeys(doc: LoroDoc): { ticketId: string; key: string }[];
export function enableServerAllocation(doc: LoroDoc): number;          // keyAllocator = "server", renvoie meta.ticketSeq
export function writeMembers(doc: LoroDoc, members: { userId: string; name: string }[]): void;
export function readMembers(doc: LoroDoc): { userId: string; name: string }[];
// validate-update.ts (T7)
export type UpdateVerdict = { ok: true } | { ok: false; reason: string };
export function validateProjectUpdate(before: LoroDoc, after: LoroDoc): UpdateVerdict;
// share-migration.ts (T7)
export type ShareMigrationInput = { localUser: string; userId: string; domains: { id: string; name: string; color: string; guidelines: string }[] };
export function migrateForSharing(doc: LoroDoc, input: ShareMigrationInput): { folder: string | null };
```

### Serveur de sync (`@kibo/sync-server`)

```ts
// db.ts, accounts.ts, members.ts, audit.ts, auth.ts, limits.ts (T11)
export type ServerDb = { db: Database; close(): void };
export function openServerDb(file: string): ServerDb;                  // ":memory:" accepté en test, fichier 0600 sinon
export type InviteInput = { kind: "account"; name: string; createdBy: string }
  | { kind: "device"; userId: string; createdBy: string }
  | { kind: "project"; projectId: string; role: "editor" | "viewer"; createdBy: string };
export function createInvite(sdb: ServerDb, input: InviteInput, now: number): Promise<{ code: string; expiresAt: number }>;
export function redeemDeviceInvite(sdb: ServerDb, req: JoinRequest, now: number): Promise<JoinResponse>;   // INVITE_INVALID
export function redeemProjectInvite(sdb: ServerDb, input: { code: string; userId: string }, now: number): Promise<{ projectId: string; role: Role }>;
export function deviceRecord(sdb: ServerDb, deviceId: string): { userId: string; name: string; publicKey: string; revoked: boolean; userDisabled: boolean } | null;
export function listDevices(sdb: ServerDb, userId: string): DeviceInfo[];
export function revokeDevice(sdb: ServerDb, input: { deviceId: string; by: string }, now: number): void;
export function disableUser(sdb: ServerDb, userId: string, now: number): void;
export function roleOf(sdb: ServerDb, projectId: string, userId: string): Role | null;
export function listMembers(sdb: ServerDb, projectId: string): MemberInfo[];
export function setRole(sdb: ServerDb, input: { projectId: string; userId: string; role: Role | null }, now: number): void;
export function projectsOf(sdb: ServerDb, userId: string): { id: string; name: string; role: Role }[];
export type AuditKind = "connect" | "auth-failed" | "invite-created" | "invite-redeemed" | "role-changed" | "member-removed"
  | "device-revoked" | "user-disabled" | "update-rejected" | "project-shared" | "project-deleted" | "market-published" | "market-revoked";
export function audit(sdb: ServerDb, e: { at: number; kind: AuditKind; userId?: string | null; deviceId?: string | null; projectId?: string | null; detail?: string }): void;
export function newNonce(): string;
export function verifyChallenge(sdb: ServerDb, input: { deviceId: string; signature: string; nonce: string; origin: string }, now: number): Promise<{ userId: string; deviceId: string; name: string }>;  // UNAUTHORIZED | DEVICE_REVOKED
export class FailureLimiter { constructor(opts: { max: number; windowMs: number; blockMs: number; now: () => number }); blocked(key: string): boolean; fail(key: string): void }
export class RateWindow { constructor(opts: { limit: number; windowMs: number; now: () => number }); take(key: string): boolean }
// room.ts, rooms.ts (T14)
export type Actor = { userId: string; deviceId: string; role: Role };
export type PushResult = { bytes: Uint8Array | null; serverSeq: number; version: Uint8Array; allocated: { ticketId: string; key: string }[] };
export type RoomLimits = { projectBytes: number; compactEvery: number };
export class RoomReject extends Error { constructor(readonly code: RejectCode, message: string, readonly version: Uint8Array | null) }
export class ProjectRoom {
  static create(sdb: ServerDb, input: { projectId: string; name: string; ownerId: string; ownerName: string; snapshot: Uint8Array }, now: number, limits?: Partial<RoomLimits>): ProjectRoom;
  static load(sdb: ServerDb, projectId: string, limits?: Partial<RoomLimits>): ProjectRoom;
  readonly projectId: string; readonly presence: EphemeralStore;
  version(): Uint8Array; serverSeq(): number; sizeBytes(): number;
  diffSince(version: Uint8Array | null): Uint8Array;
  push(bytes: Uint8Array, actor: Actor, now: number): PushResult;      // RoomReject
  syncMembers(now: number): PushResult | null;
  snapshotBytes(): Uint8Array;
}
export class RoomRegistry {
  constructor(sdb: ServerDb, opts: { now: () => number; unloadAfterMs: number });
  get(projectId: string): ProjectRoom; create(input: Parameters<typeof ProjectRoom.create>[1]): ProjectRoom;
  attach(projectId: string, connId: string): void; detach(projectId: string, connId: string): void;
  drop(projectId: string): void; sweep(): string[]; loaded(): string[];
}
// hub.ts, server.ts (T17)
export type HubConnection = { id: string; ip: string; send(frame: ServerFrame): void; close(code: number, reason: string): void };
export class SyncHub {
  constructor(opts: { sdb: ServerDb; rooms: RoomRegistry; origin: string; now: () => number });
  open(conn: HubConnection): void; message(conn: HubConnection, raw: string): Promise<void>; closed(conn: HubConnection): void;
  kickDevice(deviceId: string, code: number): void;
}
export type SyncServerOptions = { dataDir: string; hostname: string; port: number; origin: string;
  tls: { cert: string; key: string } | null; behindProxy: boolean; now?: () => number };
export function startSyncServer(opts: SyncServerOptions): Promise<{ url: string; port: number; hub: SyncHub; sdb: ServerDb; stop(): Promise<void> }>;
// testing/start-test-server.ts (T17)
export function startTestSyncServer(opts?: { now?: () => number }): Promise<{ url: string; origin: string; caPem: string; dataDir: string;
  inviteAccount(name: string): Promise<string>; server: Awaited<ReturnType<typeof startSyncServer>>; stop(): Promise<void> }>;
// market/ (T16)
export function initMarketSource(dataDir: string, input: { id: string; name: string }): Promise<{ publicKey: string; fingerprint: string }>;
export class TeamMarket {
  static open(sdb: ServerDb, dataDir: string): Promise<TeamMarket | null>;
  grant(userId: string, role: "owner" | "publisher"): void;
  publish(kpkg: Uint8Array, actor: { userId: string }, now: number): Promise<{ serial: number }>;
  revoke(input: { hash: string; reason: string }, actor: { userId: string }, now: number): Promise<{ serial: number }>;
  index(): { bytes: Uint8Array; sig: string };
  packageBytes(id: string, version: string): Uint8Array | null;
}
export class NonceCache { constructor(opts: { ttlMs: number; now: () => number }); seen(nonce: string): boolean }
export function verifySignedRequest(sdb: ServerDb, req: Request, body: Uint8Array, nonces: NonceCache, now: number): Promise<{ userId: string; deviceId: string }>;
```

### Démon (`@kibo/daemon`)

```ts
// settings.ts (T1)
export type LocalSettings = { get<T>(key: string, schema: z.ZodType<T>, fallback: T): T; set(key: string, value: unknown): void };
export function openLocalSettings(db: Database): LocalSettings;
// sessions/session-store.ts (T9)
export const SESSION_TTL_MS = 30 * 24 * 3600_000;
export type SessionStore = {
  create(input: { deviceName: string; remote: boolean }, now: number): { id: string; hash: string };
  validate(id: string, now: number): { hash: string; remote: boolean } | null;
  list(now: number): Omit<SessionInfo, "current">[];
  revoke(hash: string, now: number): void;
  onRevoke(listener: (hash: string) => void): () => void;
};
export function openSessionStore(db: Database): SessionStore;
export type RpcContext = { sessionHash: string; remote: boolean };
// remote/ (T13)
export class PairingCodes { constructor(now: () => number); create(): PairingCode; redeem(input: string): boolean }
export type ListenInfo = { hostname: string; port: number; secure: boolean; remote: boolean };
export type RemoteAccess = { status(): RemoteAccessStatus; enable(cfg: RemoteAccessConfig): Promise<RemoteAccessStatus>;
  disable(): Promise<void>; resume(): Promise<void>; stop(): void };
// sandbox/ (T8)
export type SandboxPolicy = { runtime: string; args: string[]; readOnly: { host: string; guest: string }[]; tmpDir: string; env: Record<string, string> };
export type DetectDeps = { platform: NodeJS.Platform; which(name: string): string | null; run(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> };
export type SandboxProbe = { kind: "bwrap" | "sandbox-exec" | null; available: boolean; reason: string | null; fix: string | null; bwrapPath: string | null; libs: string[] };
export function detectSandbox(deps: DetectDeps, runtime: string): Promise<SandboxProbe>;
export function bwrapArgv(bwrapPath: string, policy: SandboxPolicy, libs: string[]): string[];
export function macosProfile(policy: SandboxPolicy): string;
export function sandboxExecArgv(policy: SandboxPolicy): string[];
export function wrapCommand(probe: SandboxProbe, policy: SandboxPolicy, allowUnsandboxed: boolean): { argv: string[]; env: Record<string, string>; isolated: boolean };  // SANDBOX_UNAVAILABLE
// sync/ (T18, T21, T23, T24)
export type SyncHost = { doc(): LoroDoc; applyRemote(bytes: Uint8Array): void; replaceDoc(doc: LoroDoc): void };
export type ProjectSyncOptions = { projectId: string; host: SyncHost; send(frame: ClientFrame): void;
  serverVersion: Uint8Array | null; saveServerVersion(version: Uint8Array | null): void; newBatchId(): string;
  schedule(fn: () => void, ms: number): void; onRejected(code: RejectCode, message: string): void };
export class ProjectSync {
  constructor(opts: ProjectSyncOptions);
  connected(): void; disconnected(): void; localChange(): void; resync(): void; flush(): void;
  receive(frame: Extract<ServerFrame, { type: "update" | "ack" | "reject" }>): void;
  readonly inFlight: string | null; readonly resyncing: boolean;
}
export type SyncSocket = { send(text: string): void; close(code?: number): void;
  onOpen(fn: () => void): void; onMessage(fn: (text: string) => void): void; onClose(fn: (code: number) => void): void };
export type SyncTransport = { open(url: string, opts: { ca: string | null }): SyncSocket };
export function assertSyncUrl(url: string): URL;                         // TLS_REQUIRED
export function createWebSocketTransport(): SyncTransport;
export type ProjectHostRegistry = { host(projectId: string): SyncHost; projectIds(): string[];
  setAccess(projectId: string, access: ProjectAccess): void; setLocked(projectId: string, locked: boolean): void;
  onLocalChange(listener: (projectId: string) => void): () => void;
  addJoinedProject(doc: LoroDoc, folder: string | null): ProjectMeta; localUser(): string };
export class SyncClient {
  constructor(deps: SyncClientDeps);   // défini en T21
  start(): Promise<void>; stop(): void; status(): SyncStatus;
  connect(input: { serverUrl: string; code: string; deviceName: string; caFile: string | null }): Promise<SyncStatus>;
  disconnect(): Promise<void>;
  request<T extends ServerFrame["type"]>(frame: ClientFrame, expect: T, timeoutMs?: number): Promise<Extract<ServerFrame, { type: T }>>;
  attachProject(projectId: string, role: Role): void; detachProject(projectId: string): void;
  onFrame(listener: (frame: ServerFrame) => void): () => void;
}
export class PresenceHub { /* T24 */ set(projectId: string, where: { pageId: string | null; ticketId: string | null }): void;
  receive(projectId: string, bytes: Uint8Array): void; peers(projectId: string): PresencePeer[]; tick(): void }
// market/ (T15, T20, T22)
export type HttpGet = (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<Uint8Array>;
export function createHttpGet(opts: { allowLoopbackHttp: boolean; fetchImpl?: typeof fetch }): HttpGet;
export type RegistryPort = { get(id: string, version: string): RegistryVersion | null; put(id: string, title: string, v: RegistryVersion): void;
  installed(): { id: string; title: string; version: string; v: RegistryVersion }[]; revoke(id: string, version: string, reason: string, at: number): Promise<void> };
export class MarketService {
  constructor(deps: { db: MarketDb; get: HttpGet; registry: RegistryPort; now: () => number; notify(msg: { title: string; body: string }): Promise<void> });
  listSources(): MarketSourceInfo[]; probe(url: string): Promise<MarketProbe>;
  addSource(input: { url: string; publicKey: string }): Promise<MarketSourceInfo>; removeSource(id: string): void;
  refresh(sourceId?: string): Promise<void>; search(input: { query: string; sourceId?: string; kind?: ComponentKind }): MarketHit[];
  getPackage(input: { sourceId: string; id: string; version: string }): Promise<MarketPackageDetail>;
  fetchVerified(input: { sourceId: string; id: string; version: string }): Promise<{ pkg: Kpkg; files: SourceFile[]; newPublisher: boolean }>;
  pinPublisher(sourceId: string, componentId: string, publisherKey: string): void;
  unpinPublisher(input: { sourceId: string; componentId: string }): void;
  findSourceFor(input: { id: string; version: string; hash: string | null }): { sourceId: string } | null;
}
export function installFromMarket(deps: InstallDeps, input: { sourceId: string; id: string; version: string }): Promise<MarketInstallResult>;
export function exportKpkg(deps: PublishDeps, input: { id: string; version: string; publisherName?: string }): Promise<Kpkg>;
export function publishToMarket(deps: PublishDeps, input: { id: string; version: string; sourceId: string; publisherName?: string }): Promise<{ serial: number }>;
```

### RPC ajoutées (`RpcRequest`, `packages/schema/src/rpc.ts`)

| Méthode | Entrée | Sortie | Tâche | Session distante |
|---|---|---|---|---|
| `listSessions` | — | `SessionInfo[]` | T9 | oui |
| `revokeSession` | `{ id }` | `null` | T9 | oui |
| `getRemoteAccess` | — | `RemoteAccessStatus` | T13 | oui |
| `enableRemoteAccess` | `RemoteAccessConfig` | `RemoteAccessStatus` | T13 | **non** |
| `disableRemoteAccess` | — | `null` | T13 | **non** |
| `createPairingCode` | — | `PairingCode` | T13 | **non** |
| `getSandboxStatus` | — | `SandboxStatus` | T12 | oui |
| `setAllowUnsandboxed` | `{ allow }` | `SandboxStatus` | T12 | **non** |
| `listMarketSources` / `probeMarketSource { url }` / `addMarketSource { url, publicKey }` / `removeMarketSource { id }` / `refreshMarket` / `searchMarket { query, sourceId?, kind? }` / `getMarketPackage { sourceId, id, version }` / `unpinPublisher { sourceId, componentId }` | | spec H §6 | T15 | `addMarketSource` et `unpinPublisher` **non** |
| `findMarketSource` | `{ id, version, hash }` (`hash` nullable) | `{ sourceId } \| null` | T15 | oui |
| `installFromMarket` | `{ sourceId, id, version }` | `MarketInstallResult` | T20 | oui |
| `publishToMarket` | `{ id, version, sourceId, publisherName? }` | `{ serial }` | T22 | oui |
| `exportKpkg` | `{ id, version, publisherName? }` | `Kpkg` | T22 | oui |
| `getSyncStatus` | — | `SyncStatus` | T21 | oui |
| `connectSyncServer` | `{ serverUrl, code, deviceName, caFile }` | `SyncStatus` | T21 | **non** |
| `disconnectSyncServer` | — | `null` | T21 | **non** |
| `listDevices` / `addDevice` / `revokeDevice { deviceId }` | | `DeviceInfo[]` / `{ code, expiresAt }` / `null` | T21 | oui |
| `shareProject` | `{ projectId }` | `ProjectSyncInfo` | T23 | oui |
| `createProjectInvite` | `{ projectId, role }` | `{ code, expiresAt }` | T23 | oui |
| `joinProject` | `{ code, folder }` | `ProjectMeta` | T23 | oui |
| `setMemberRole` | `{ projectId, userId, role }` (`null` = retirer) | `MemberInfo[]` | T23 | oui |
| `unshareProject` | `{ projectId }` | `null` | T23 | oui |
| `setBindingRunner` | `{ projectId, bindingId }` | `null` | T23 | oui |
| `setPresence` | `{ projectId, pageId, ticketId }` | `null` | T24 | oui |
| `getPresence` | `{ projectId }` | `PresencePeer[]` | T24 | oui |

`DaemonEvent` gagne `{ type: "sync" }`, `{ type: "presence"; projectId: string }`, `{ type: "market" }`, `{ type: "sessions" }`, `{ type: "sandbox" }`.

### Compléments de contrats (fixés à l'écriture des tâches)

Chaque tâche détaille ces ajouts sous « Produces » ; ils font foi au même titre que ci-dessus.

- **Schéma** : `Base64` et `Sha256` vivent dans `ids.ts` ; `Role`, `KeyAllocator`, `MemberInfo`, `ProjectAccess`, `ProjectSyncInfo` dans `sharing.ts` (T1), importés par `sync.ts` (T4) et `core` (T6). T4 ajoute `parseClientFrame`, `parseServerFrame`, `encodeFrame`, `SYNC_RPC_REQUESTS` ; T5 ajoute `MARKET_RPC_REQUESTS` ; `RpcResult` devient l'intersection des résultats de base, de sync et de marketplace. T6 ajoute `TicketView.keyLabel`, `localSyncInfo(doc)`, `peekTicketKey(doc): string | null`.
- **RPC du démon** (T9, `packages/daemon/src/rpc-extensions.ts`) : `RpcContext`, `requireLocal(ctx)` ; une **extension** (`RpcExtension`, méthodes déclarées) sert T9, T12, T13 ; un **gestionnaire** (`RpcHandler = (req, ctx) => Promise<RpcOutcome>`, `{ handled: false }` pour les autres méthodes) sert T15, T20, T21, T22, T23, T24, T27 et se branche par l'option `handlers` de `startServer`. `service.ts` ne grossit pas.
- **Trust** : T2 `owned(bytes)` ; T3 primitives DER ; T10 `assertPackagePath`, et `@kibo/trust/testing` : `makeTestPackage(input?) → { pkg, bytes, keys, files, publisher }` (composant par défaut valide pour la conformité générique) et `makeTestIndex(...) → { index, bytes, sig }`. `kpkgSourceFiles` refuse un `manifest` différent de `kibo.component.json`.
- **Serveur** : T11 `insertProject`, `touchDevice`, `readAudit`, `AuditEntry`, `deviceRecord().deviceName` ; T14 `RoomRegistry` accepte `limits`, fixtures `@kibo/sync-server/testing/fixtures` (`seedUser`, `addMember`, `ownerSnapshot`), l'audit `update-rejected` est écrit par la salle seulement ; T16 `handleMarketRoute`, `TeamMarket.source()`, `NONCE_TTL_MS`, `SIGNED_REQUEST_SKEW_MS` ; T17 `SyncHub.failures`, `SyncHub.checkRevocations()`, `runCli`, `TestSyncServerOptions { now, dataDir, port, cert, market }`, retour `{ url, httpsUrl, origin, caPem, cert, dataDir, server, inviteAccount, stop({ keepData }) }`, `@kibo/sync-server/testing/ws-client`.
- **Démon, isolation** : T8 `parseLdd`, `realDetectDeps`, `EXTRA_RULES` ; T12 `SandboxService`, `createSandboxService`, `LineChannel`, `createLineChannel`, `currentRuntime()`.
- **Démon, sessions et accès distant** : T9 `hashSessionId`, `deviceNameFromUserAgent`, `startServer().publish(event)` ; T13 `listInterfaces`, `createRemoteAccess(deps)`, `remoteRpc`, `startServer().listenRemote`, `KiboClient.pairWithCode(code)` (SDK).
- **Démon, sync** : T18 `createMemoryHost(doc)` (tests) ; T19 `InMemoryNetwork` (tests, `fast-check` en devDependency du démon) ; T21 `SyncClientDeps` (dont `backoff` injectable et `backoffDelay`), `SyncDb`, `SyncProjectRow`, `openSyncDb`, `SyncConfig`, `createDeviceKeys` / `loadDeviceKeys` / `clearDeviceKeys`, `projectSyncInfo`, `handleSyncRpc`, `ProjectHostRegistry.mutate`, `SyncClient.send` / `membersOf` / `addDevice` / `listDevices` / `revokeDevice`, harnais `startSyncHarness` ; T23 `ShareDeps`, `restoreLocalAllocation(doc)` (core) ; T24 `PresenceDeps`, `PresenceHub` complet (`set`, `receive`, `peers`, `refreshRuns`, `tick`, `forget`, `dispose`), `FakeRuns`.
- **Démon, marketplace** : T15 `openMarketDb`, `createHttpGet({ ca })`, `MarketService.load()` / `sourceUrl()` et `deps.log`, `startMarketRefresh`, `createMarketRpc`, `startFakeMarket`, `createMemoryRegistry` ; T20 `TrustPreview.market`, `ValidateOptions { conformanceOnly, wrap }` (devkit), `createSandboxedValidator`, `InstallDeps`, `createMemoryComponentStore`, `setInstanceHash` (core) ; T22 `MarketService.hasVersion`, `loadPublisherKeys`, `buildStaticIndex`, `runMarketCommand` ; T27 RPC `getMarketPublisher` → `{ name, fingerprint } | null`, `ComponentVersionSummary.market` et `.revoked`.
- **SDK et UI** : T25 `useRpcQuery`, `formatPairingCode` (UI) ; T26 `marketErrorText`, `groupFingerprint`, props de `TrustDialog` (`publisherLine`, `newPublisher`, `fromMarketplace`) ; T28 `useSyncStatus`, `relativeTime` ; T29 `canEdit` ; T30 `sdk.presence.list()`, `sdk.sharing()`, `sdk.projectKey()`, hooks `usePresence`, `useSharing`, `useMembers`, `useReadOnly`, `useProjectKey`, `assigneeLabel`, `remoteRuns`, `TicketKeyLabel` (textes dans `packages/sdk/src/fr.ts`, comme les `fr.ts` des composants), appel `presence.list`, `PresenceAvatars`, `usePresenceReporter`, `KeyRequired`.

## Vagues d'exécution

Une vague démarre quand toutes les tâches dont elle dépend sont intégrées dans `main`. Dans une vague, chaque tâche a son worktree `.claude/worktrees/p7-t<n>` et sa branche `feat/p7-t<n>` ; le chef d'équipe lance tous les `kibo-dev` de la vague en parallèle. Les tâches UI attendent en plus leurs écrans dessinés (colonne « Écrans »), que le chef d'équipe dessine pendant les vagues 1 à 4.

| Vague | Tâches en parallèle | Dépend de | Écrans |
|---|---|---|---|
| 0 | T0 (kibo-lead), puis T1 | v0.6 | — |
| 1 | T2, T3, T4, T5, T6, T8, T9 | T1 | — |
| 2 | T7, T10, T11, T12, T13 | T7 ← T6 · T10 ← T2, T5 · T11 ← T2, T4 · T12 ← T8 · T13 ← T3, T9 | — |
| 3 | T14, T15, T16, T25 | T14 ← T7, T11 · T15 ← T10 · T16 ← T10, T11 · T25 ← T12, T13 | T25 : S8, M7 |
| 4 | T17, T18, T20 | T17 ← T14, T3 · T18 ← T14 · T20 ← T15, T8 | — |
| 5 | T19, T21, T26 | T19 ← T18 · T21 ← T17, T18 · T26 ← T20 | T26 : M1, M2, M3, M5 |
| 6 | T22, T23, T24, T28 | T22 ← T16, T20, T21 · T23 ← T21 · T24 ← T21 · T28 ← T21 | T28 : S1, S9 |
| 7 | T27, T29, T30 | T27 ← T22, T26 · T29 ← T23 · T30 ← T24, T6 | T27 : M4, M6, M8, S7 · T29 : S2, S3, S6 · T30 : S4, S5 |
| 8 | T31, T32 | T31 ← T28, T29, T30 · T32 ← T27 | — |
| Jalon | conformité, tag `v1.0`, rapport final | tout | toutes |

Chemin critique : T1 → T6 → T7 → T14 → T17 → T21 → T23 → T29 → T31, et T21 → T22 → T27 → T32 (9 vagues). Tâches à risque relues aussi par `kibo-lead` : T7, T8, T12, T14, T17, T19, T21.

---

### Task 0: Recalage du plan sur v0.6

Tâche de `kibo-lead`, sans code de production. Elle se fait sur `main` au tag `v0.6`, dans le worktree `.claude/worktrees/p7-t0`, branche `docs/p7-t0`. Sortie : ce plan corrigé, une ligne cochée par hypothèse.

**Files:**
- Modify: `docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md` (tableau « Prérequis (v0.6) et recalage », Contrats partagés, sections des tâches concernées)
- Modify: `docs/superpowers/specs/2026-09-26-kibo-sync.md`, `docs/superpowers/specs/2026-09-26-kibo-marketplace.md` (report des décisions nouvelles, validé par le chef d'équipe)

**Interfaces:**
- Consumes: le code de `main` au tag `v0.6`, les plans des phases 2 à 6.
- Produces: un plan dont chaque nom supposé (tableau Prérequis et lignes « Hypothèse v0.6 (vérifiée en T0) » des tâches) correspond au code réel.

- [ ] **Step 1: Lister les hypothèses du plan**

Run: `grep -n "Hypothèse v0.6" docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md` et relire le tableau « Prérequis ».
Expected: une liste d'hypothèses numérotées, recopiée dans le compte rendu de la tâche.

- [ ] **Step 1b: Traiter d'abord les écarts déjà repérés**

Les plans des phases 4 (`2026-09-26-kibo-composants.md`) et 5 (`2026-09-26-kibo-integrations.md`) ont paru pendant l'écriture de ce plan. Écarts connus, à corriger dans les tâches citées avant tout le reste :

| Ce plan suppose | Plans 4 et 5 | Tâches à corriger |
|---|---|---|
| `Sha256` créé par T1 dans `ids.ts` | `Sha256` et `shortHash` déjà exportés par `packages/schema/src/component.ts` (phase 4) | T1 n'ajoute que `Base64` ; T2 réexporte le `shortHash` du schéma au lieu d'en écrire un ; T5 importe `Sha256` depuis `./component` |
| `SecretName`, `MemorySecretStore` dans `packages/daemon/src/secrets/secret-store.ts` | `SecretName` dans `packages/schema/src/integrations.ts` (avec `SecretNameSchema`) ; `createMemorySecretStore(redactor, initial?)` dans `packages/daemon/src/integrations/memory-secret-store.ts` | T1 (extension de `SecretName` et constantes dans le schéma), T12, T13, T21, T22, T23, T24 (tests : `createMemorySecretStore(redactor)` au lieu de `new MemorySecretStore()`) |
| `ComponentStore.put({ id, version, files })` | `ComponentStore.put(srcDir, expectedHash?)`, `load`, `verify` (`createComponentStore`) | T12 (fixture), T20 (écrire les sources dans le dossier temporaire puis `put(dir, hash)`), T22 |
| `RegistryVersion` sans `autoUpdate` | `RegistryVersion.autoUpdate: boolean` (décision 7 du plan 4) | T5 (défauts), T15, T20, T27 (littéraux de registre) |
| `Service.handle` asynchrone | rendu asynchrone par la tâche 30 du plan de phase 3 | T9 (conforme) |
| canal `ipc` de Bun pour le backend | confirmé (`ipc:` dans le `ProcessHost` du plan 4) | T12 applique la décision 23 |
| réglages locaux | `integration_settings(key, value)` (phase 5) | T1 garde `local_settings` (réglages hors intégrations) : pas de mélange des domaines |
| tables `sync_config`, `sync_projects` | tables de phase 5 `sync_items`, `sync_cursors`, `sync_outbox` (sync d'intégrations) | aucun conflit de nom ; T21 garde ses noms, T0 le note pour les lecteurs |

- [ ] **Step 2: Confronter chaque hypothèse au code**

Pour chaque ligne, retrouver le symbole réel :
```bash
grep -rn "handle(" packages/daemon/src/service.ts
grep -rn "SecretStore\|MemorySecretStore\|SecretName" packages/daemon/src --include=*.ts -l
grep -rn "class ProcessHost\|spawnCommand\|component-runtime" packages/daemon/src -l
grep -rn "export function validateComponent\|export async function validateComponent\|hashSources" packages/devkit/src
grep -rn "RegistryVersion\|previewTrust\|TrustPreview" packages -l
grep -rn "project_settings\|local_state\|component_events" packages/daemon/src -l
grep -rn "SETTINGS_SECTIONS\|TrustDialog\|PublishDialog\|FirstRun\|StatusBar\|TabBar" packages/ui/src -l
grep -rn "DaemonEvent" packages/schema/src
grep -rn "listDomains\|runs.active\|notify(" packages/daemon/src packages/core/src -l
```
Expected: un symbole réel par hypothèse. Si le symbole existe sous un autre nom ou une autre signature, remplacer le nom supposé **partout dans le plan** (Contrats, Interfaces, code des étapes). Si le besoin n'existe pas du tout, ajouter l'étape qui le crée à la tâche consommatrice, avec test, et le noter dans le tableau.

- [ ] **Step 3: Vérifier les invariants de plateforme connus**

```bash
bun --version
grep -n "loro-crdt" packages/core/package.json
grep -n "ipc\|NODE_CHANNEL_FD" packages/daemon/src/components/backend/*.ts
```
Expected: Bun 1.4.2, loro-crdt 1.16.3. Noter si le canal du `ProcessHost` repose sur l'IPC de Bun (variables d'environnement à transmettre dans la politique d'isolation de T12) ou sur stdin/stdout.

- [ ] **Step 4: Faire valider et reporter les décisions nouvelles**

Soumettre au chef d'équipe la liste « Décisions nouvelles » ; après accord, les reporter dans les specs G et H (sections concernées) et `CLAUDE.md` n'est modifié que par T1. Une décision refusée ⇒ proposer 2 options au chef d'équipe, qui escalade à Adam (règle de `CLAUDE.md`).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md docs/superpowers/specs/2026-09-26-kibo-sync.md docs/superpowers/specs/2026-09-26-kibo-marketplace.md
git commit -m "docs: recalage du plan de la phase 7"
```

---

### Task 1: Socle de la phase 7

Petite tâche série qui débloque tout le reste : codes d'erreur, noms de secrets, réglages locaux, squelettes des deux nouveaux paquets, `typecheck` et `CLAUDE.md`. Aucune logique métier.

**Files:**
- Modify: `packages/schema/src/errors.ts`
- Modify: `packages/schema/src/ids.ts` (`Base64`, et `Sha256` seulement s'il n'est pas déjà exporté par le schéma de la phase 4 — voir T0, étape 1b)
- Modify: `packages/schema/src/schema.test.ts`
- Create: `packages/schema/src/sharing.ts`, `packages/schema/src/sharing.test.ts` (types de partage lus à la fois par T4 et T6, parallèles en vague 1)
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/daemon/package.json` (dépendance `zod` 3.25.76, importée par `settings.ts`)
- Modify: `packages/daemon/src/server.ts` (table `STATUS`, exportée)
- Create: `packages/daemon/src/status.test.ts`
- Modify: `packages/daemon/src/secrets/secret-store.ts` (type `SecretName`, constantes)
- Modify: `packages/daemon/src/secrets/secret-store.test.ts`
- Modify: `packages/daemon/src/store.ts` (expose `db` si absent)
- Create: `packages/daemon/src/settings.ts`
- Create: `packages/daemon/src/settings.test.ts`
- Create: `packages/trust/package.json`, `packages/trust/tsconfig.json`, `packages/trust/src/index.ts`, `packages/trust/src/sanity.test.ts`
- Create: `packages/sync-server/package.json`, `packages/sync-server/tsconfig.json`, `packages/sync-server/src/index.ts`, `packages/sync-server/src/sanity.test.ts`
- Modify: `package.json` (script `typecheck`)
- Modify: `CLAUDE.md` (monorepo, dépendances autorisées)

**Interfaces:**
- Consumes: `KiboError`, `KiboErrorCode` (`@kibo/schema`) ; `Store` (`packages/daemon/src/store.ts`) ; `SecretName` (phase 5).
- Produces:
  - `KiboErrorCode` gagne `"UPDATE_REJECTED" | "ACCESS_REVOKED" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "INVITE_INVALID" | "DEVICE_REVOKED" | "TLS_REQUIRED" | "SYNC_OFFLINE" | "SANDBOX_UNAVAILABLE" | "SIGNATURE_INVALID" | "PUBLISHER_CHANGED" | "REVOKED" | "INDEX_ROLLBACK"`.
  - `Base64` (chaîne base64 standard, longueur multiple de 4) et `Sha256` (hex minuscule, 64 caractères) dans `packages/schema/src/ids.ts`.
  - `Role`, `KeyAllocator`, `MemberInfo`, `ProjectAccess`, `ProjectSyncInfo` dans `packages/schema/src/sharing.ts` (Contrats partagés ; T4 les importe au lieu de les définir).
  - `export const STATUS: Partial<Record<KiboErrorCode, number>>` dans `packages/daemon/src/server.ts`.
  - `SecretName = \`${"github" | "mcp" | "figma" | "sync" | "market" | "remote"}${"" | \`:${string}\`}\`` ; `SECRET_SYNC_DEVICE = "sync:device"`, `SECRET_MARKET_PUBLISHER = "market:publisher"`, `SECRET_REMOTE_TLS = "remote:tls"`.
  - `Store.db: Database`.
  - `LocalSettings`, `openLocalSettings(db: Database): LocalSettings` (Contrats partagés).
  - Paquets `@kibo/trust` et `@kibo/sync-server` (vides, testés, typés).
- Hypothèse v0.6 (vérifiée en T0) : `SecretName` et `MemorySecretStore` vivent dans `packages/daemon/src/secrets/secret-store.ts` avec un test voisin ; `STATUS` est encore une constante locale de `server.ts` (sinon, modifier le fichier qui la porte).

- [ ] **Step 1: Écrire les tests des codes d'erreur**

Ajouter à la fin de `packages/schema/src/schema.test.ts` :
```ts
describe("phase 7 error codes", () => {
  test("new codes are accepted by KiboError", () => {
    const codes = [
      "UPDATE_REJECTED",
      "ACCESS_REVOKED",
      "RATE_LIMITED",
      "QUOTA_EXCEEDED",
      "INVITE_INVALID",
      "DEVICE_REVOKED",
      "TLS_REQUIRED",
      "SYNC_OFFLINE",
      "SANDBOX_UNAVAILABLE",
      "SIGNATURE_INVALID",
      "PUBLISHER_CHANGED",
      "REVOKED",
      "INDEX_ROLLBACK",
    ] as const;
    for (const code of codes) {
      const err = new KiboError(code, "detail");
      expect(err.code).toBe(code);
      expect(err.message).toBe(`${code}: detail`);
    }
  });
});

describe("shared encodings", () => {
  test("Base64 accepts padded standard base64 only", () => {
    expect(Base64.safeParse("a2libw==").success).toBe(true);
    expect(Base64.safeParse("").success).toBe(true);
    expect(Base64.safeParse("a2libw").success).toBe(false);
    expect(Base64.safeParse("a2l-bw==").success).toBe(false);
  });
  test("Sha256 is 64 lowercase hex characters", () => {
    expect(Sha256.safeParse("a".repeat(64)).success).toBe(true);
    expect(Sha256.safeParse("A".repeat(64)).success).toBe(false);
    expect(Sha256.safeParse("a".repeat(63)).success).toBe(false);
  });
});
```

Ajouter `Base64` et `Sha256` à l'import `./index` en tête du fichier.

`packages/daemon/src/status.test.ts` :
```ts
import { expect, test } from "bun:test";
import { STATUS } from "./server";

test("phase 7 codes map to HTTP statuses", () => {
  expect(STATUS).toMatchObject({
    UPDATE_REJECTED: 409,
    ACCESS_REVOKED: 403,
    RATE_LIMITED: 429,
    QUOTA_EXCEEDED: 413,
    INVITE_INVALID: 400,
    DEVICE_REVOKED: 401,
    TLS_REQUIRED: 400,
    SYNC_OFFLINE: 503,
    SANDBOX_UNAVAILABLE: 503,
    SIGNATURE_INVALID: 422,
    PUBLISHER_CHANGED: 409,
    REVOKED: 410,
    INDEX_ROLLBACK: 409,
  });
});

test("existing mappings are unchanged", () => {
  expect(STATUS.NOT_FOUND).toBe(404);
  expect(STATUS.UNAUTHORIZED).toBe(401);
  expect(STATUS.FORBIDDEN).toBe(403);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/schema/src/schema.test.ts packages/daemon/src/status.test.ts`
Expected: FAIL — `bun run typecheck` refuse les nouveaux littéraux et `STATUS` n'est pas exporté (`SyntaxError: Export named 'STATUS' not found`).

- [ ] **Step 3: Ajouter les codes, les encodages et la table**

Dans `packages/schema/src/ids.ts` :
```ts
export const Base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .refine((s) => s.length % 4 === 0, "base64 length must be a multiple of 4");
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
```

Dans `packages/schema/src/errors.ts`, compléter l'union (garder les codes des phases 2 à 6 déjà présents) :
```ts
  | "UPDATE_REJECTED"
  | "ACCESS_REVOKED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "INVITE_INVALID"
  | "DEVICE_REVOKED"
  | "TLS_REQUIRED"
  | "SYNC_OFFLINE"
  | "SANDBOX_UNAVAILABLE"
  | "SIGNATURE_INVALID"
  | "PUBLISHER_CHANGED"
  | "REVOKED"
  | "INDEX_ROLLBACK"
```

Dans `packages/daemon/src/server.ts`, exporter la table et ajouter les entrées (les entrées existantes restent) :
```ts
export const STATUS: Partial<Record<KiboErrorCode, number>> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  UPDATE_REJECTED: 409,
  ACCESS_REVOKED: 403,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 413,
  INVITE_INVALID: 400,
  DEVICE_REVOKED: 401,
  TLS_REQUIRED: 400,
  SYNC_OFFLINE: 503,
  SANDBOX_UNAVAILABLE: 503,
  SIGNATURE_INVALID: 422,
  PUBLISHER_CHANGED: 409,
  REVOKED: 410,
  INDEX_ROLLBACK: 409,
};
```

- [ ] **Step 4: Vérifier le passage**

Run: `bun test packages/schema/src/schema.test.ts packages/daemon/src/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests des noms de secrets**

Ajouter à `packages/daemon/src/secrets/secret-store.test.ts` :
```ts
import { expect, test } from "bun:test";
import {
  MemorySecretStore,
  SECRET_MARKET_PUBLISHER,
  SECRET_REMOTE_TLS,
  SECRET_SYNC_DEVICE,
} from "./secret-store";

test("phase 7 secret names are stable", () => {
  expect(SECRET_SYNC_DEVICE).toBe("sync:device");
  expect(SECRET_MARKET_PUBLISHER).toBe("market:publisher");
  expect(SECRET_REMOTE_TLS).toBe("remote:tls");
});

test("phase 7 secrets round-trip through the memory store", async () => {
  const secrets = new MemorySecretStore();
  await secrets.set(SECRET_SYNC_DEVICE, "k1");
  await secrets.set(SECRET_MARKET_PUBLISHER, "k2");
  await secrets.set(SECRET_REMOTE_TLS, "k3");
  expect(await secrets.get(SECRET_SYNC_DEVICE)).toBe("k1");
  expect(await secrets.has(SECRET_MARKET_PUBLISHER)).toBe(true);
  await secrets.delete(SECRET_REMOTE_TLS);
  expect(await secrets.get(SECRET_REMOTE_TLS)).toBeNull();
});
```

Run: `bun test packages/daemon/src/secrets/secret-store.test.ts`
Expected: FAIL — `SECRET_SYNC_DEVICE` introuvable.

- [ ] **Step 6: Étendre `SecretName`**

Dans `packages/daemon/src/secrets/secret-store.ts` :
```ts
export type SecretName = `${"github" | "mcp" | "figma" | "sync" | "market" | "remote"}${"" | `:${string}`}`;

export const SECRET_SYNC_DEVICE: SecretName = "sync:device";
export const SECRET_MARKET_PUBLISHER: SecretName = "market:publisher";
export const SECRET_REMOTE_TLS: SecretName = "remote:tls";
```

Run: `bun test packages/daemon/src/secrets/secret-store.test.ts`
Expected: PASS.

- [ ] **Step 6b: Types de partage**

`packages/schema/src/sharing.test.ts` :
```ts
import { expect, test } from "bun:test";
import { KeyAllocator, MemberInfo, Role } from "./sharing";

test("roles and allocators are closed sets", () => {
  expect(Role.options).toEqual(["owner", "editor", "viewer"]);
  expect(KeyAllocator.options).toEqual(["local", "server"]);
  expect(Role.safeParse("admin").success).toBe(false);
});

test("a member needs an id, a name and a role", () => {
  expect(MemberInfo.safeParse({ userId: "u1", name: "Léa", role: "editor" }).success).toBe(true);
  expect(MemberInfo.safeParse({ userId: "", name: "Léa", role: "editor" }).success).toBe(false);
});
```

Run: `bun test packages/schema/src/sharing.test.ts`
Expected: FAIL — `Cannot find module './sharing'`.

`packages/schema/src/sharing.ts` :
```ts
import { z } from "zod";

export const Role = z.enum(["owner", "editor", "viewer"]);
export type Role = z.infer<typeof Role>;
export const KeyAllocator = z.enum(["local", "server"]);
export type KeyAllocator = z.infer<typeof KeyAllocator>;
export const MemberInfo = z.object({ userId: z.string().min(1), name: z.string().min(1), role: Role });
export type MemberInfo = z.infer<typeof MemberInfo>;
export type ProjectAccess = "write" | "read-only" | "revoked";
export type ProjectSyncInfo = {
  shared: boolean;
  keyAllocator: KeyAllocator;
  role: Role | null;
  access: ProjectAccess;
  members: MemberInfo[];
};
```
Ajouter `export * from "./sharing";` à `packages/schema/src/index.ts`.

Run: `bun test packages/schema/src/sharing.test.ts`
Expected: PASS.

Ajouter `"zod": "3.25.76"` aux `dependencies` de `packages/daemon/package.json` (même version que `@kibo/schema`, aucun nouveau paquet dans `bun.lock`).

- [ ] **Step 7: Tests des réglages locaux**

`packages/daemon/src/settings.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { z } from "zod";
import { openLocalSettings } from "./settings";

let db: Database;
beforeEach(() => {
  db = new Database(":memory:", { strict: true });
});

const Remote = z.object({ enabled: z.boolean(), port: z.number().int() });

test("returns the fallback when the key is absent", () => {
  const settings = openLocalSettings(db);
  expect(settings.get("remoteAccess", Remote, { enabled: false, port: 47832 })).toEqual({
    enabled: false,
    port: 47832,
  });
});

test("stores JSON values and reads them back", () => {
  const settings = openLocalSettings(db);
  settings.set("remoteAccess", { enabled: true, port: 50000 });
  settings.set("sandbox.allowUnsandboxed", true);
  expect(settings.get("remoteAccess", Remote, { enabled: false, port: 1 })).toEqual({
    enabled: true,
    port: 50000,
  });
  expect(settings.get("sandbox.allowUnsandboxed", z.boolean(), false)).toBe(true);
});

test("overwrites an existing value", () => {
  const settings = openLocalSettings(db);
  settings.set("sandbox.allowUnsandboxed", true);
  settings.set("sandbox.allowUnsandboxed", false);
  expect(settings.get("sandbox.allowUnsandboxed", z.boolean(), true)).toBe(false);
});

test("survives a reopen on the same database", () => {
  openLocalSettings(db).set("k", 42);
  expect(openLocalSettings(db).get("k", z.number(), 0)).toBe(42);
});

test("a value that does not match its schema is reported, not replaced", () => {
  const settings = openLocalSettings(db);
  settings.set("remoteAccess", { enabled: "yes" });
  expect(() => settings.get("remoteAccess", Remote, { enabled: false, port: 1 })).toThrow("STORE_CORRUPT");
});

test("unparsable JSON is reported", () => {
  openLocalSettings(db);
  db.query("INSERT INTO local_settings (key, value) VALUES ('broken', '{')").run();
  expect(() => openLocalSettings(db).get("broken", z.number(), 0)).toThrow("STORE_CORRUPT");
});
```

Run: `bun test packages/daemon/src/settings.test.ts`
Expected: FAIL — `Cannot find module './settings'`.

- [ ] **Step 8: Implémenter `settings.ts`**

`packages/daemon/src/settings.ts` :
```ts
import type { Database } from "bun:sqlite";
import { KiboError } from "@kibo/schema";
import type { z } from "zod";

export type LocalSettings = {
  get<T>(key: string, schema: z.ZodType<T>, fallback: T): T;
  set(key: string, value: unknown): void;
};

export function openLocalSettings(db: Database): LocalSettings {
  db.exec("CREATE TABLE IF NOT EXISTS local_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const select = db.query("SELECT value FROM local_settings WHERE key = $key");
  const upsert = db.query(
    "INSERT INTO local_settings (key, value) VALUES ($key, $value) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  return {
    get(key, schema, fallback) {
      const row = select.get({ key }) as { value: string } | null;
      if (!row) return fallback;
      let raw: unknown;
      try {
        raw = JSON.parse(row.value);
      } catch (e) {
        throw new KiboError("STORE_CORRUPT", `setting ${key} is not valid JSON: ${String(e)}`);
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        throw new KiboError("STORE_CORRUPT", `setting ${key} is invalid: ${parsed.error.message}`);
      }
      return parsed.data;
    },
    set(key, value) {
      upsert.run({ key, value: JSON.stringify(value) });
    },
  };
}
```

Si `Store` n'expose pas encore sa base, ajouter dans `packages/daemon/src/store.ts` le champ `db: Database` au type `Store` et `db,` dans l'objet retourné par `openStore` (aucune autre modification).

Run: `bun test packages/daemon/src/settings.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Squelette `packages/trust`**

`packages/trust/package.json` :
```json
{
  "name": "@kibo/trust",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@kibo/schema": "workspace:*",
    "zod": "3.25.76"
  }
}
```
`packages/trust/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../schema" }]
}
```
`packages/trust/src/index.ts` :
```ts
export const TRUST_FORMAT_VERSION = 1;
```
`packages/trust/src/sanity.test.ts` :
```ts
import { expect, test } from "bun:test";
import { TRUST_FORMAT_VERSION } from "./index";

test("trust package is wired", () => {
  expect(TRUST_FORMAT_VERSION).toBe(1);
});
```

- [ ] **Step 10: Squelette `packages/sync-server`**

`packages/sync-server/package.json` :
```json
{
  "name": "@kibo/sync-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@kibo/core": "workspace:*",
    "@kibo/schema": "workspace:*",
    "@kibo/trust": "workspace:*",
    "loro-crdt": "1.16.3"
  }
}
```
`packages/sync-server/tsconfig.json` :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../schema" }, { "path": "../core" }, { "path": "../trust" }]
}
```
`packages/sync-server/src/index.ts` :
```ts
export const SYNC_PROTOCOL_VERSION = 1;
```
`packages/sync-server/src/sanity.test.ts` :
```ts
import { expect, test } from "bun:test";
import { SYNC_PROTOCOL_VERSION } from "./index";

test("sync-server package is wired", () => {
  expect(SYNC_PROTOCOL_VERSION).toBe(1);
});
```

Dans `package.json` racine, insérer `packages/trust packages/sync-server` juste après `packages/core` dans le script `typecheck` :
```json
"typecheck": "tsc -b packages/schema packages/core packages/trust packages/sync-server packages/daemon packages/sdk packages/ui components/tickets components/kanban e2e apps/desktop"
```
(Conserver les paquets ajoutés par les phases 2 à 6 : `packages/devkit`, `packages/cli`, `components/graph`, `components/notes`… ; seule l'insertion est à faire.)

Si le `tsconfig.json` des autres paquets n'utilise pas `references`, retirer la clé `references` des deux nouveaux fichiers pour suivre le modèle existant.

- [ ] **Step 11: Installer et vérifier**

Run: `bun install && bun test packages/trust packages/sync-server && bun run check && bun run typecheck`
Expected: 2 tests PASS, Biome et tsc sans erreur ; `bun.lock` gagne les deux espaces de travail.

- [ ] **Step 12: Mettre à jour `CLAUDE.md`**

Dans le bloc « Monorepo », ajouter après la ligne `packages/core/` :
```
packages/trust/      signatures Ed25519, codes, empreinte, X.509, paquets et index signés — WebCrypto, sans I/O
packages/sync-server/ serveur de sync kibo-sync (Bun, SQLite) et marketplace d'équipe
```
Remplacer la phrase des dépendances autorisées par :
```
Dépendances autorisées entre paquets : `schema ← core ← daemon`, `schema ← sdk ← components`, `sdk ← ui`, `schema ← core ← sync-server`, `schema ← trust ← {devkit, daemon, sync-server, cli}`. `sync-server` n'est qu'une `devDependency` du démon, pour ses tests.
```
(Garder les arêtes ajoutées par les phases 4 à 6, par exemple `schema ← devkit ← daemon`, `devkit ← cli`.)

Run: `bun run check`
Expected: sans erreur (Biome ignore le Markdown).

- [ ] **Step 13: Commits**

```bash
git add packages/schema/src/errors.ts packages/schema/src/ids.ts packages/schema/src/schema.test.ts packages/schema/src/sharing.ts packages/schema/src/sharing.test.ts packages/schema/src/index.ts packages/daemon/package.json bun.lock packages/daemon/src/server.ts packages/daemon/src/status.test.ts packages/daemon/src/secrets/secret-store.ts packages/daemon/src/secrets/secret-store.test.ts packages/daemon/src/store.ts packages/daemon/src/settings.ts packages/daemon/src/settings.test.ts
git commit -m "feat: codes, secrets et réglages de la phase 7"
git add packages/trust packages/sync-server package.json bun.lock CLAUDE.md
git commit -m "build: paquets trust et sync-server"
```

---

### Task 2: Paquet trust : signatures, codes et empreinte

Les primitives de confiance partagées par le démon, le serveur de sync, le devkit et la CLI : octets et base64, Ed25519 (WebCrypto), codes à usage unique, empreinte canonique des sources (spec B §3.2) et charge signée des requêtes HTTP (décision 5). Aucune I/O dans `packages/trust` ; `packages/devkit` lit le disque et délègue le calcul.

**Files:**
- Create: `packages/trust/src/bytes.ts`, `packages/trust/src/bytes.test.ts`
- Create: `packages/trust/src/platform.test.ts`
- Create: `packages/trust/src/ed25519.ts`, `packages/trust/src/ed25519.test.ts`
- Create: `packages/trust/src/codes.ts`, `packages/trust/src/codes.test.ts`
- Create: `packages/trust/src/source-hash.ts`, `packages/trust/src/source-hash.test.ts`
- Create: `packages/trust/src/http-signing.ts`, `packages/trust/src/http-signing.test.ts`
- Modify: `packages/trust/src/index.ts`
- Modify: `packages/devkit/package.json` (dépendance `@kibo/trust`), `packages/devkit/src/hash.ts` (`hashSources`)
- Test: `packages/devkit/src/hash-delegation.test.ts`

**Interfaces:**
- Consumes: `KiboError` (`@kibo/schema`).
- Produces (Contrats partagés, `@kibo/trust`) : `toBase64`, `fromBase64`, `utf8`, `sha256Hex`, `constantTimeEqual` ; `KeyPair`, `generateKeyPair`, `signBytes`, `verifyBytes`, `keyFingerprint`, `formatFingerprint`, `shortHash` ; `newInviteCode`, `newPairingCode`, `normalizeCode`, `formatPairingCode`, `hashCode` ; `SourceFile`, `isHashedSource`, `sourceHash` ; `HTTP_SIGNATURE_HEADERS`, `httpSigningPayload`, `signRequest`.
- Hypothèse v0.6 (vérifiée en T0) : `hashSources(dir: string): Promise<string>` est défini dans `packages/devkit/src/hash.ts`.

- [ ] **Step 1: Test de plateforme et tests des octets**

`packages/trust/src/platform.test.ts` :
```ts
import { expect, test } from "bun:test";

test("WebCrypto of this Bun exposes Ed25519", async () => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const data = new TextEncoder().encode("kibo");
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, data);
  expect(await crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, sig, data)).toBe(true);
  expect((await crypto.subtle.exportKey("spki", pair.publicKey)).byteLength).toBe(44);
});
```

`packages/trust/src/bytes.test.ts` :
```ts
import { expect, test } from "bun:test";
import { constantTimeEqual, fromBase64, sha256Hex, toBase64, utf8 } from "./bytes";

test("base64 round-trips arbitrary bytes", () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
  expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  expect(toBase64(utf8("kibo"))).toBe("a2libw==");
});

test("invalid base64 is refused", () => {
  expect(() => fromBase64("a2l*bw==")).toThrow("INVALID_INPUT");
  expect(() => fromBase64("abc")).toThrow("INVALID_INPUT");
});

test("sha256Hex hashes strings and bytes identically", async () => {
  expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(await sha256Hex(utf8("abc"))).toBe(await sha256Hex("abc"));
});

test("constantTimeEqual compares content and length", () => {
  expect(constantTimeEqual(utf8("ab"), utf8("ab"))).toBe(true);
  expect(constantTimeEqual(utf8("ab"), utf8("ac"))).toBe(false);
  expect(constantTimeEqual(utf8("ab"), utf8("abc"))).toBe(false);
});
```

Run: `bun test packages/trust/src/platform.test.ts packages/trust/src/bytes.test.ts`
Expected: `platform.test.ts` PASS (si FAIL : arrêter la tâche et escalader, Ed25519 est requis par la spec G §4) ; `bytes.test.ts` FAIL — `Cannot find module './bytes'`.

- [ ] **Step 2: Implémenter `bytes.ts`**

```ts
import { KiboError } from "@kibo/schema";

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(text: string): Uint8Array {
  if (!BASE64.test(text) || text.length % 4 !== 0) {
    throw new KiboError("INVALID_INPUT", "invalid base64");
  }
  return new Uint8Array(Buffer.from(text, "base64"));
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? utf8(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", owned(bytes)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
```

Run: `bun test packages/trust/src/bytes.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests Ed25519**

`packages/trust/src/ed25519.test.ts` :
```ts
import { expect, test } from "bun:test";
import { utf8 } from "./bytes";
import { formatFingerprint, generateKeyPair, keyFingerprint, shortHash, signBytes, verifyBytes } from "./ed25519";

test("a signature verifies with the matching public key", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("hello"));
  expect(await verifyBytes(keys.publicKey, utf8("hello"), sig)).toBe(true);
});

test("altered data, altered signature or another key fail", async () => {
  const keys = await generateKeyPair();
  const other = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("hello"));
  expect(await verifyBytes(keys.publicKey, utf8("hellO"), sig)).toBe(false);
  const flipped = `${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
  expect(await verifyBytes(keys.publicKey, utf8("hello"), flipped)).toBe(false);
  expect(await verifyBytes(other.publicKey, utf8("hello"), sig)).toBe(false);
});

test("malformed keys and signatures return false without throwing", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("x"));
  expect(await verifyBytes("not base64!", utf8("x"), sig)).toBe(false);
  expect(await verifyBytes("AAAA", utf8("x"), sig)).toBe(false);
  expect(await verifyBytes(keys.publicKey, utf8("x"), "AAAA")).toBe(false);
});

test("signing with a malformed private key is an input error", async () => {
  await expect(signBytes("AAAA", utf8("x"))).rejects.toThrow("INVALID_INPUT");
});

test("fingerprints are stable and formatted", async () => {
  const keys = await generateKeyPair();
  const fp = await keyFingerprint(keys.publicKey);
  expect(fp).toMatch(/^[0-9a-f]{64}$/);
  expect(await keyFingerprint(keys.publicKey)).toBe(fp);
  expect(formatFingerprint(fp).split(" ")).toHaveLength(16);
  expect(formatFingerprint("3f9a8b21")).toBe("3f9a 8b21");
  expect(shortHash("3f9a0000000000000000000000000000000000000000000000000000000c21e")).toBe("3f9a…c21e");
});
```

Run: `bun test packages/trust/src/ed25519.test.ts`
Expected: FAIL — `Cannot find module './ed25519'`.

- [ ] **Step 4: Implémenter `ed25519.ts`**

```ts
import { KiboError } from "@kibo/schema";
import { fromBase64, owned, sha256Hex, toBase64 } from "./bytes";

export type KeyPair = { publicKey: string; privateKey: string };

const ALG = { name: "Ed25519" } as const;

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return { publicKey: toBase64(spki), privateKey: toBase64(pkcs8) };
}

export async function signBytes(privateKey: string, data: Uint8Array): Promise<string> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("pkcs8", owned(fromBase64(privateKey)), ALG, false, ["sign"]);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `invalid Ed25519 private key: ${String(e)}`);
  }
  const sig = await crypto.subtle.sign(ALG, key, owned(data));
  return toBase64(new Uint8Array(sig));
}

export async function verifyBytes(publicKey: string, data: Uint8Array, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", owned(fromBase64(publicKey)), ALG, false, ["verify"]);
    return await crypto.subtle.verify(ALG, key, owned(fromBase64(signature)), owned(data));
  } catch (e) {
    if (e instanceof KiboError || e instanceof DOMException || e instanceof TypeError) return false;
    throw e;
  }
}

export async function keyFingerprint(publicKey: string): Promise<string> {
  return sha256Hex(fromBase64(publicKey));
}

export function formatFingerprint(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? []).join(" ");
}

export function shortHash(hex: string): string {
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}
```

`verifyBytes` ne renvoie `false` que pour les erreurs d'entrée attendues (base64, clé ou signature mal formées) ; toute autre exception remonte.

Run: `bun test packages/trust/src/ed25519.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests des codes**

`packages/trust/src/codes.test.ts` :
```ts
import { expect, test } from "bun:test";
import { formatPairingCode, hashCode, newInviteCode, newPairingCode, normalizeCode } from "./codes";

test("invite codes carry 128 bits in 26 base32 characters", () => {
  const a = newInviteCode();
  const b = newInviteCode();
  expect(a).toMatch(/^[A-Z2-7]{26}$/);
  expect(a).not.toBe(b);
  expect(a.at(-1)).toMatch(/^[A-Z2-7]$/);
});

test("pairing codes avoid ambiguous characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = newPairingCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test("codes are normalized before comparison", () => {
  expect(normalizeCode(" k7q-4m2 ")).toBe("K7Q4M2");
  expect(normalizeCode("abcd efgh\tijkl-mnop")).toBe("ABCDEFGHIJKLMNOP");
  expect(formatPairingCode("K7Q4M2")).toBe("K7Q-4M2");
});

test("hashCode is identical for every spelling of the same code", async () => {
  const code = newInviteCode();
  const spaced = code.toLowerCase().replace(/(.{4})/g, "$1 ");
  const dashed = code.replace(/(.{4})/g, "$1-");
  expect(await hashCode(spaced)).toBe(await hashCode(code));
  expect(await hashCode(dashed)).toBe(await hashCode(code));
  expect(await hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
  expect(await hashCode(newInviteCode())).not.toBe(await hashCode(code));
});
```

Run: `bun test packages/trust/src/codes.test.ts`
Expected: FAIL — `Cannot find module './codes'`.

- [ ] **Step 6: Implémenter `codes.ts`**

```ts
import { sha256Hex } from "./bytes";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PAIRING = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function newInviteCode(): string {
  return base32(crypto.getRandomValues(new Uint8Array(16)));
}

export function newPairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => PAIRING[b & 31]).join("");
}

export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function formatPairingCode(code: string): string {
  const c = normalizeCode(code);
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

export function hashCode(code: string): Promise<string> {
  return sha256Hex(normalizeCode(code));
}
```

`b & 31` est sans biais car 256 est un multiple de 32.

Run: `bun test packages/trust/src/codes.test.ts`
Expected: PASS.

- [ ] **Step 7: Tests de l'empreinte canonique**

`packages/trust/src/source-hash.test.ts` :
```ts
import { expect, test } from "bun:test";
import { utf8 } from "./bytes";
import { isHashedSource, type SourceFile, sourceHash } from "./source-hash";

const files = (): SourceFile[] => [
  { path: "kibo.component.json", bytes: utf8('{"id":"burndown"}') },
  { path: "ui.tsx", bytes: utf8("export const A = 1;") },
  { path: "lib/chart.ts", bytes: utf8("export const B = 2;") },
  { path: "styles.css", bytes: utf8(".a{}") },
];

test("only manifest and ts, tsx, css sources are hashed", () => {
  expect(isHashedSource("kibo.component.json")).toBe(true);
  expect(isHashedSource("ui.tsx")).toBe(true);
  expect(isHashedSource("lib/chart.ts")).toBe(true);
  expect(isHashedSource("styles.css")).toBe(true);
  expect(isHashedSource("component.test.tsx")).toBe(false);
  expect(isHashedSource("lib/x.test.ts")).toBe(false);
  expect(isHashedSource("node_modules/react/index.ts")).toBe(false);
  expect(isHashedSource("dist/ui.js")).toBe(false);
  expect(isHashedSource(".env.ts")).toBe(false);
  expect(isHashedSource("lib/.hidden/a.ts")).toBe(false);
  expect(isHashedSource("README.md")).toBe(false);
  expect(isHashedSource("lib/data.json")).toBe(false);
});

test("hash is independent of file order", async () => {
  const a = await sourceHash(files());
  const b = await sourceHash(files().reverse());
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(b).toBe(a);
});

test("one changed byte changes the hash", async () => {
  const base = await sourceHash(files());
  const changed = files();
  changed[1] = { path: "ui.tsx", bytes: utf8("export const A = 2;") };
  expect(await sourceHash(changed)).not.toBe(base);
});

test("renaming a file changes the hash", async () => {
  const base = await sourceHash(files());
  const renamed = files();
  renamed[2] = { path: "lib/graph.ts", bytes: utf8("export const B = 2;") };
  expect(await sourceHash(renamed)).not.toBe(base);
});

test("ignored files do not affect the hash", async () => {
  const base = await sourceHash(files());
  const extra = [
    ...files(),
    { path: "component.test.tsx", bytes: utf8("test") },
    { path: "node_modules/x/index.ts", bytes: utf8("x") },
    { path: "dist/ui.js", bytes: utf8("y") },
    { path: ".cache.ts", bytes: utf8("z") },
  ];
  expect(await sourceHash(extra)).toBe(base);
});

test("encoding is path NUL size NUL bytes, sorted by path", async () => {
  const one: SourceFile[] = [{ path: "a.ts", bytes: utf8("x") }];
  const expected = new Uint8Array([...utf8("a.ts"), 0, ...utf8("1"), 0, ...utf8("x")]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", expected));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  expect(await sourceHash(one)).toBe(hex);
});
```

Run: `bun test packages/trust/src/source-hash.test.ts`
Expected: FAIL — `Cannot find module './source-hash'`.

- [ ] **Step 8: Implémenter `source-hash.ts`**

```ts
import { sha256Hex, utf8 } from "./bytes";

export type SourceFile = { path: string; bytes: Uint8Array };

const MANIFEST = "kibo.component.json";

export function isHashedSource(path: string): boolean {
  const segments = path.split("/");
  if (segments.some((s) => s.startsWith(".") || s === "node_modules")) return false;
  if (segments[0] === "dist") return false;
  if (/\.test\.tsx?$/.test(path)) return false;
  return path === MANIFEST || /\.(ts|tsx|css)$/.test(path);
}

export function sourceHash(files: SourceFile[]): Promise<string> {
  const kept = files.filter((f) => isHashedSource(f.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts: Uint8Array[] = [];
  for (const f of kept) parts.push(utf8(f.path), new Uint8Array([0]), utf8(String(f.bytes.length)), new Uint8Array([0]), f.bytes);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return sha256Hex(out);
}
```

Le tri compare les chaînes par unité de code (pas `localeCompare`), identique sur toutes les machines.

Run: `bun test packages/trust/src/source-hash.test.ts`
Expected: PASS.

- [ ] **Step 9: Tests de la signature HTTP**

`packages/trust/src/http-signing.test.ts` :
```ts
import { expect, test } from "bun:test";
import { sha256Hex, utf8 } from "./bytes";
import { generateKeyPair, verifyBytes } from "./ed25519";
import { HTTP_SIGNATURE_HEADERS, httpSigningPayload, signRequest } from "./http-signing";

test("the signing payload is deterministic", () => {
  const input = { method: "POST", path: "/v1/market/packages", date: "1700000000000", nonce: "bm9uY2U=", bodySha256: "ab" };
  const text = new TextDecoder().decode(httpSigningPayload(input));
  expect(text).toBe("kibo-http-v1\nPOST\n/v1/market/packages\n1700000000000\nbm9uY2U=\nab");
  expect(httpSigningPayload(input)).toEqual(httpSigningPayload({ ...input }));
});

test("signRequest produces the four headers and a verifiable signature", async () => {
  const keys = await generateKeyPair();
  const body = utf8('{"x":1}');
  const headers = await signRequest({ deviceId: "d1", privateKey: keys.privateKey, method: "POST", path: "/v1/market/revoke", body, now: 1700000000000 });
  expect(Object.keys(headers).sort()).toEqual(Object.values(HTTP_SIGNATURE_HEADERS).sort());
  expect(headers["x-kibo-device"]).toBe("d1");
  expect(headers["x-kibo-date"]).toBe("1700000000000");
  const payload = httpSigningPayload({
    method: "POST",
    path: "/v1/market/revoke",
    date: headers["x-kibo-date"] ?? "",
    nonce: headers["x-kibo-nonce"] ?? "",
    bodySha256: await sha256Hex(body),
  });
  expect(await verifyBytes(keys.publicKey, payload, headers["x-kibo-signature"] ?? "")).toBe(true);
});

test("two requests never share a nonce", async () => {
  const keys = await generateKeyPair();
  const input = { deviceId: "d1", privateKey: keys.privateKey, method: "POST", path: "/p", body: utf8(""), now: 1 };
  const a = await signRequest(input);
  const b = await signRequest(input);
  expect(a["x-kibo-nonce"]).not.toBe(b["x-kibo-nonce"]);
});
```

Run: `bun test packages/trust/src/http-signing.test.ts`
Expected: FAIL — `Cannot find module './http-signing'`.

- [ ] **Step 10: Implémenter `http-signing.ts` et l'index**

`packages/trust/src/http-signing.ts` :
```ts
import { sha256Hex, toBase64, utf8 } from "./bytes";
import { signBytes } from "./ed25519";

export const HTTP_SIGNATURE_HEADERS = {
  device: "x-kibo-device",
  date: "x-kibo-date",
  nonce: "x-kibo-nonce",
  signature: "x-kibo-signature",
} as const;

export function httpSigningPayload(input: {
  method: string;
  path: string;
  date: string;
  nonce: string;
  bodySha256: string;
}): Uint8Array {
  return utf8(`kibo-http-v1\n${input.method}\n${input.path}\n${input.date}\n${input.nonce}\n${input.bodySha256}`);
}

export async function signRequest(input: {
  deviceId: string;
  privateKey: string;
  method: string;
  path: string;
  body: Uint8Array;
  now: number;
}): Promise<Record<string, string>> {
  const date = String(input.now);
  const nonce = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const payload = httpSigningPayload({
    method: input.method,
    path: input.path,
    date,
    nonce,
    bodySha256: await sha256Hex(input.body),
  });
  return {
    [HTTP_SIGNATURE_HEADERS.device]: input.deviceId,
    [HTTP_SIGNATURE_HEADERS.date]: date,
    [HTTP_SIGNATURE_HEADERS.nonce]: nonce,
    [HTTP_SIGNATURE_HEADERS.signature]: await signBytes(input.privateKey, payload),
  };
}
```

`packages/trust/src/index.ts` :
```ts
export * from "./bytes";
export * from "./codes";
export * from "./ed25519";
export * from "./http-signing";
export * from "./source-hash";
export const TRUST_FORMAT_VERSION = 1;
```

Run: `bun test packages/trust`
Expected: PASS (tous les fichiers de `packages/trust`).

- [ ] **Step 11: Commit trust**

```bash
git add packages/trust/src
git commit -m "feat(trust): signatures, codes et empreinte"
```

- [ ] **Step 12: Figer l'empreinte actuelle du devkit avant délégation**

Créer la fixture et le test `packages/devkit/src/hash-delegation.test.ts` ; la constante `PINNED` est la sortie de l'implémentation de la phase 4, capturée **avant** la modification :

Run: `bun -e 'import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os"; import { hashSources } from "./packages/devkit/src/hash"; const d = mkdtempSync(join(tmpdir(), "h-")); mkdirSync(join(d, "lib")); writeFileSync(join(d, "kibo.component.json"), "{\"id\":\"burndown\"}"); writeFileSync(join(d, "ui.tsx"), "export const A = 1;\n"); writeFileSync(join(d, "lib/chart.ts"), "export const B = 2;\n"); writeFileSync(join(d, "ui.css"), ".a{}\n"); writeFileSync(join(d, "component.test.tsx"), "x"); console.log(await hashSources(d));'`
Expected: une empreinte hexadécimale de 64 caractères, à coller dans `PINNED`.

```ts
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceHash, utf8 } from "@kibo/trust";
import { hashSources } from "./hash";

const PINNED = "<sortie de la commande ci-dessus>";

const dir = mkdtempSync(join(tmpdir(), "kibo-hash-"));
mkdirSync(join(dir, "lib"));
const content: Record<string, string> = {
  "kibo.component.json": '{"id":"burndown"}',
  "ui.tsx": "export const A = 1;\n",
  "lib/chart.ts": "export const B = 2;\n",
  "ui.css": ".a{}\n",
  "component.test.tsx": "x",
};
for (const [path, text] of Object.entries(content)) writeFileSync(join(dir, path), text);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("hashSources is unchanged by the delegation", async () => {
  expect(await hashSources(dir)).toBe(PINNED);
});

test("hashSources equals the trust implementation on the same files", async () => {
  const files = Object.entries(content).map(([path, text]) => ({ path, bytes: utf8(text) }));
  expect(await hashSources(dir)).toBe(await sourceHash(files));
});
```

Si la valeur capturée diffère de `sourceHash` (second test en échec après la délégation), l'implémentation de la phase 4 s'écartait de la spec B §3.2 : arrêter et signaler au chef d'équipe, car toutes les empreintes approuvées changeraient.

- [ ] **Step 13: Vérifier l'échec**

Run: `bun test packages/devkit/src/hash-delegation.test.ts`
Expected: FAIL — `Cannot find module '@kibo/trust'` (dépendance absente).

- [ ] **Step 14: Déléguer**

Dans `packages/devkit/package.json`, ajouter `"@kibo/trust": "workspace:*"` aux dépendances. Remplacer le corps de `hashSources` dans `packages/devkit/src/hash.ts` :
```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isHashedSource, type SourceFile, sourceHash } from "@kibo/trust";

export async function readSourceFiles(dir: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for await (const path of new Bun.Glob("**/*").scan({ cwd: dir, dot: true, onlyFiles: true })) {
    const posix = path.split("\\").join("/");
    if (!isHashedSource(posix)) continue;
    files.push({ path: posix, bytes: new Uint8Array(await readFile(join(dir, path))) });
  }
  return files;
}

export async function hashSources(dir: string): Promise<string> {
  return sourceHash(await readSourceFiles(dir));
}
```
Supprimer l'ancien encodage local devenu inutilisé ; garder les autres exports de `hash.ts`.

Run: `bun install && bun test packages/devkit`
Expected: PASS, y compris les tests d'empreinte de la phase 4.

- [ ] **Step 15: Vérifications et commit**

Run: `bun run check && bun run typecheck`
Expected: sans erreur.

```bash
git add packages/devkit/package.json packages/devkit/src/hash.ts packages/devkit/src/hash-delegation.test.ts bun.lock
git commit -m "refactor(devkit): empreinte déléguée à trust"
```

---

### Task 3: Certificats auto-signés et TLS

Encodeur DER minimal et certificat X.509 v3 auto-signé (ECDSA P-256, WebCrypto), sans dépendance ni binaire `openssl` (décision 2). Il sert au serveur de sync de test, à l'E2E et au certificat de l'accès distant (spec G §7). La tâche contient aussi le **test de plateforme** qui valide que le client WebSocket de Bun 1.4.2 accepte une autorité supplémentaire (`tls.ca`), hypothèse du client de sync (T18, T21).

**Files:**
- Create: `packages/trust/src/der.ts`, `packages/trust/src/der.test.ts`
- Create: `packages/trust/src/x509.ts`, `packages/trust/src/x509.test.ts`
- Create: `packages/trust/src/tls-platform.test.ts`
- Modify: `packages/trust/src/index.ts`

**Interfaces:**
- Consumes: `toBase64`, `owned`, `sha256Hex`, `utf8` (`packages/trust/src/bytes.ts`, T2) ; `KiboError` (`@kibo/schema`).
- Produces : `SelfSigned = { certPem: string; keyPem: string; fingerprint256: string }`, `generateSelfSignedCert(opts: { commonName: string; dns: string[]; ips: string[]; days: number; now?: Date }): Promise<SelfSigned>`, `certFingerprint(certPem: string): Promise<string>` (format `AB:CD:…`, majuscules). Internes exportés pour les tests : `sequence`, `set`, `integer`, `oid`, `utf8String`, `ia5`, `booleanTrue`, `time`, `bitString`, `octetString`, `explicit`, `tlv`, `concat`, `ipBytes`.

- [ ] **Step 1: Tests de l'encodeur DER**

`packages/trust/src/der.test.ts` :
```ts
import { expect, test } from "bun:test";
import { bitString, concat, explicit, integer, ipBytes, oid, sequence, time, tlv, utf8String } from "./der";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

test("short and long lengths", () => {
  expect(hex(tlv(0x04, new Uint8Array(3)))).toBe("0403000000");
  expect(hex(tlv(0x04, new Uint8Array(200))).slice(0, 6)).toBe("0481c8");
  expect(hex(tlv(0x04, new Uint8Array(300))).slice(0, 8)).toBe("0482012c");
});

test("integers are minimal and positive", () => {
  expect(hex(integer(new Uint8Array([2])))).toBe("020102");
  expect(hex(integer(new Uint8Array([0, 0, 5])))).toBe("020105");
  expect(hex(integer(new Uint8Array([0x80])))).toBe("02020080");
  expect(hex(integer(new Uint8Array([0])))).toBe("020100");
});

test("object identifiers", () => {
  expect(hex(oid("1.2.840.10045.4.3.2"))).toBe("06082a8648ce3d040302");
  expect(hex(oid("2.5.4.3"))).toBe("0603550403");
});

test("strings, sequences and context tags", () => {
  expect(hex(utf8String("Kibo"))).toBe("0c044b69626f");
  expect(hex(sequence(integer(new Uint8Array([1]))))).toBe("3003020101");
  expect(hex(explicit(0, integer(new Uint8Array([2]))))).toBe("a003020102");
  expect(hex(bitString(new Uint8Array([0xff])))).toBe("030200ff");
  expect(concat(new Uint8Array([1]), new Uint8Array([2, 3]))).toEqual(new Uint8Array([1, 2, 3]));
});

test("UTCTime before 2050, GeneralizedTime after", () => {
  expect(new TextDecoder().decode(time(new Date("2026-09-26T10:20:30Z")).slice(2))).toBe("260926102030Z");
  expect(time(new Date("2026-09-26T10:20:30Z"))[0]).toBe(0x17);
  expect(new TextDecoder().decode(time(new Date("2051-01-02T03:04:05Z")).slice(2))).toBe("20510102030405Z");
  expect(time(new Date("2051-01-02T03:04:05Z"))[0]).toBe(0x18);
});

test("IP addresses", () => {
  expect(ipBytes("127.0.0.1")).toEqual(new Uint8Array([127, 0, 0, 1]));
  expect(ipBytes("::1")).toEqual(new Uint8Array([...new Array(15).fill(0), 1]));
  expect(ipBytes("fe80::1:2")).toEqual(new Uint8Array([0xfe, 0x80, ...new Array(10).fill(0), 0, 1, 0, 2]));
  expect(() => ipBytes("300.1.1.1")).toThrow("INVALID_INPUT");
  expect(() => ipBytes("localhost")).toThrow("INVALID_INPUT");
});
```

Run: `bun test packages/trust/src/der.test.ts`
Expected: FAIL — `Cannot find module './der'`.

- [ ] **Step 2: Implémenter `der.ts`**

```ts
import { KiboError } from "@kibo/schema";
import { utf8 } from "./bytes";

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function encodeLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

export function tlv(tag: number, content: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), encodeLength(content.length), content);
}

export const sequence = (...items: Uint8Array[]): Uint8Array => tlv(0x30, concat(...items));
export const set = (...items: Uint8Array[]): Uint8Array => tlv(0x31, concat(...items));
export const utf8String = (text: string): Uint8Array => tlv(0x0c, utf8(text));
export const ia5 = (tag: number, text: string): Uint8Array => tlv(tag, utf8(text));
export const bitString = (bytes: Uint8Array): Uint8Array => tlv(0x03, concat(new Uint8Array([0]), bytes));
export const octetString = (bytes: Uint8Array): Uint8Array => tlv(0x04, bytes);
export const booleanTrue = (): Uint8Array => tlv(0x01, new Uint8Array([0xff]));
export const explicit = (n: number, content: Uint8Array): Uint8Array => tlv(0xa0 + n, content);

export function integer(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  const body = bytes.slice(start);
  const first = body[0] ?? 0;
  return tlv(0x02, first & 0x80 ? concat(new Uint8Array([0]), body) : body.length ? body : new Uint8Array([0]));
}

function base128(n: number): number[] {
  const out = [n & 0x7f];
  for (let v = Math.floor(n / 128); v > 0; v = Math.floor(v / 128)) out.unshift((v & 0x7f) | 0x80);
  return out;
}

export function oid(dotted: string): Uint8Array {
  const [a = 0, b = 0, ...rest] = dotted.split(".").map(Number);
  return tlv(0x06, new Uint8Array([40 * a + b, ...rest.flatMap(base128)]));
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function time(d: Date): Uint8Array {
  const body = `${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const year = d.getUTCFullYear();
  if (year < 2050) return tlv(0x17, utf8(`${pad(year % 100)}${body}`));
  return tlv(0x18, utf8(`${pad(year, 4)}${body}`));
}

export function ipBytes(ip: string): Uint8Array {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.some((p) => p > 255)) throw new KiboError("INVALID_INPUT", `invalid IPv4 ${ip}`);
    return new Uint8Array(parts);
  }
  if (!/^[0-9a-fA-F:]+$/.test(ip) || !ip.includes(":")) throw new KiboError("INVALID_INPUT", `invalid IP ${ip}`);
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...new Array(8 - left.length - right.length).fill("0"), ...right] : left;
  if (groups.length !== 8 || groups.some((g) => g.length > 4)) throw new KiboError("INVALID_INPUT", `invalid IPv6 ${ip}`);
  return new Uint8Array(groups.flatMap((g) => {
    const v = Number.parseInt(g, 16);
    return [v >> 8, v & 0xff];
  }));
}
```

Run: `bun test packages/trust/src/der.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests du certificat**

`packages/trust/src/x509.test.ts` :
```ts
import { expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { certFingerprint, generateSelfSignedCert } from "./x509";

const now = new Date("2026-09-26T10:00:00Z");

test("the certificate is parsed by the platform with SAN and validity", async () => {
  const cert = await generateSelfSignedCert({ commonName: "Kibo", dns: ["localhost"], ips: ["127.0.0.1"], days: 30, now });
  const x = new X509Certificate(cert.certPem);
  expect(x.subject).toContain("CN=Kibo");
  expect(x.issuer).toBe(x.subject);
  expect(x.subjectAltName).toContain("DNS:localhost");
  expect(x.subjectAltName).toContain("IP Address:127.0.0.1");
  expect(new Date(x.validFrom).getTime()).toBeLessThanOrEqual(now.getTime());
  expect(new Date(x.validTo).getTime()).toBe(now.getTime() + 30 * 86_400_000);
  expect(x.ca).toBe(false);
  expect(x.checkIssued(x)).toBe(true);
});

test("the private key is PKCS8 PEM and the fingerprint matches the DER", async () => {
  const cert = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 1, now });
  expect(cert.keyPem.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
  expect(cert.certPem.startsWith("-----BEGIN CERTIFICATE-----\n")).toBe(true);
  expect(cert.fingerprint256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  expect(await certFingerprint(cert.certPem)).toBe(cert.fingerprint256);
  expect(new X509Certificate(cert.certPem).fingerprint256).toBe(cert.fingerprint256);
});

test("two certificates never share a serial or a key", async () => {
  const a = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 1, now });
  const b = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 1, now });
  expect(new X509Certificate(a.certPem).serialNumber).not.toBe(new X509Certificate(b.certPem).serialNumber);
  expect(a.keyPem).not.toBe(b.keyPem);
});

test("an invalid IP is refused", async () => {
  await expect(generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["nope"], days: 1 })).rejects.toThrow("INVALID_INPUT");
});
```

Run: `bun test packages/trust/src/x509.test.ts`
Expected: FAIL — `Cannot find module './x509'`.

- [ ] **Step 4: Implémenter `x509.ts`**

```ts
import { owned, sha256Hex, toBase64 } from "./bytes";
import {
  bitString,
  booleanTrue,
  explicit,
  ia5,
  integer,
  ipBytes,
  octetString,
  oid,
  sequence,
  set,
  time,
  tlv,
  utf8String,
} from "./der";

export type SelfSigned = { certPem: string; keyPem: string; fingerprint256: string };

const OID = {
  ecdsaSha256: "1.2.840.10045.4.3.2",
  commonName: "2.5.4.3",
  basicConstraints: "2.5.29.19",
  keyUsage: "2.5.29.15",
  extKeyUsage: "2.5.29.37",
  serverAuth: "1.3.6.1.5.5.7.3.1",
  subjectAltName: "2.5.29.17",
} as const;

const DAY_MS = 86_400_000;

function extension(id: string, critical: boolean, value: Uint8Array): Uint8Array {
  return critical ? sequence(oid(id), booleanTrue(), octetString(value)) : sequence(oid(id), octetString(value));
}

function pem(label: string, der: Uint8Array): string {
  const lines = toBase64(der).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function p1363ToDer(sig: Uint8Array): Uint8Array {
  return sequence(integer(sig.slice(0, 32)), integer(sig.slice(32)));
}

async function fingerprintOf(der: Uint8Array): Promise<string> {
  return (await sha256Hex(der)).toUpperCase().match(/.{2}/g)?.join(":") ?? "";
}

export async function generateSelfSignedCert(opts: {
  commonName: string;
  dns: string[];
  ips: string[];
  days: number;
  now?: Date;
}): Promise<SelfSigned> {
  const altNames = [...opts.dns.map((d) => ia5(0x82, d)), ...opts.ips.map((ip) => tlv(0x87, ipBytes(ip)))];
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const serial = crypto.getRandomValues(new Uint8Array(16));
  serial[0] = ((serial[0] ?? 0) & 0x3f) | 0x40;
  const start = opts.now ?? new Date();
  const end = new Date(start.getTime() + opts.days * DAY_MS);
  const algorithm = sequence(oid(OID.ecdsaSha256));
  const name = sequence(set(sequence(oid(OID.commonName), utf8String(opts.commonName))));
  const extensions = sequence(
    extension(OID.basicConstraints, true, sequence()),
    extension(OID.keyUsage, true, tlv(0x03, new Uint8Array([0x07, 0x80]))),
    extension(OID.extKeyUsage, false, sequence(oid(OID.serverAuth))),
    extension(OID.subjectAltName, false, sequence(...altNames)),
  );
  const tbs = sequence(
    explicit(0, integer(new Uint8Array([2]))),
    integer(serial),
    algorithm,
    name,
    sequence(time(start), time(end)),
    name,
    spki,
    explicit(3, extensions),
  );
  const raw = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, owned(tbs)),
  );
  const der = sequence(tbs, algorithm, bitString(p1363ToDer(raw)));
  return { certPem: pem("CERTIFICATE", der), keyPem: pem("PRIVATE KEY", pkcs8), fingerprint256: await fingerprintOf(der) };
}

export async function certFingerprint(certPem: string): Promise<string> {
  const body = certPem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return fingerprintOf(new Uint8Array(Buffer.from(body, "base64")));
}
```

Run: `bun test packages/trust/src/x509.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests TLS de plateforme**

`packages/trust/src/tls-platform.test.ts` :
```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { generateSelfSignedCert, type SelfSigned } from "./x509";

let cert: SelfSigned;
let server: Server<undefined>;

beforeAll(async () => {
  cert = await generateSelfSignedCert({ commonName: "Kibo test", dns: ["localhost"], ips: ["127.0.0.1"], days: 1 });
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: { cert: cert.certPem, key: cert.keyPem },
    fetch(req, srv) {
      if (new URL(req.url).pathname === "/ws" && srv.upgrade(req, { data: undefined })) return undefined;
      return new Response("ok");
    },
    websocket: {
      message(ws, msg) {
        ws.send(`echo:${String(msg)}`);
      },
    },
  });
});
afterAll(() => server.stop(true));

test("fetch trusts the generated certificate through tls.ca", async () => {
  const res = await fetch(`https://127.0.0.1:${server.port}/`, { tls: { ca: cert.certPem } });
  expect(await res.text()).toBe("ok");
});

test("fetch without the CA refuses the certificate", async () => {
  await expect(fetch(`https://127.0.0.1:${server.port}/`)).rejects.toThrow();
});

test("the Bun WebSocket client accepts tls.ca", async () => {
  const ws = new WebSocket(`wss://127.0.0.1:${server.port}/ws`, { tls: { ca: cert.certPem } });
  const reply = await new Promise<string>((resolve, reject) => {
    ws.addEventListener("open", () => ws.send("ping"));
    ws.addEventListener("message", (e) => resolve(String(e.data)));
    ws.addEventListener("error", () => reject(new Error("websocket error")));
  });
  ws.close();
  expect(reply).toBe("echo:ping");
});

test("the Bun WebSocket client refuses an unknown CA", async () => {
  const ws = new WebSocket(`wss://127.0.0.1:${server.port}/ws`);
  const outcome = await new Promise<string>((resolve) => {
    ws.addEventListener("open", () => resolve("open"));
    ws.addEventListener("error", () => resolve("error"));
    ws.addEventListener("close", () => resolve("close"));
  });
  expect(outcome).not.toBe("open");
});
```

Run: `bun test packages/trust/src/tls-platform.test.ts`
Expected: PASS (4 tests).

**Si le troisième test échoue** (le constructeur `WebSocket` de Bun 1.4.2 ignore ou refuse `tls.ca`) : ne pas contourner ; arrêter la tâche après le commit des étapes 1 à 4 et escalader au chef d'équipe, qui choisit avec Adam entre :
1. **`NODE_EXTRA_CA_CERTS`** : le lanceur du démon (sidecar Tauri, `e2e/serve-sync.ts`, harnais de test en sous-processus) pose la variable vers le `caFile` configuré ; changer d'autorité demande un redémarrage du démon ; le client de sync (T21) ne passe plus `ca`.
2. **Épinglage d'empreinte** : le client ouvre `wss://` avec `tls: { rejectUnauthorized: false, checkServerIdentity }`, où `checkServerIdentity` compare l'empreinte SHA-256 du certificat présenté à celle du `caFile` et refuse sinon ; la vérification de chaîne standard reste active pour les serveurs sans `caFile`.

- [ ] **Step 6: Exporter et vérifier**

Ajouter à `packages/trust/src/index.ts` :
```ts
export * from "./der";
export * from "./x509";
```

Run: `bun test packages/trust && bun run check && bun run typecheck`
Expected: PASS, sans erreur.

- [ ] **Step 7: Commit**

```bash
git add packages/trust/src/der.ts packages/trust/src/der.test.ts packages/trust/src/x509.ts packages/trust/src/x509.test.ts packages/trust/src/tls-platform.test.ts packages/trust/src/index.ts
git commit -m "feat(trust): certificats auto-signés"
```

---

### Task 4: Schémas du protocole de sync

Toutes les formes échangées entre le démon et `kibo-sync` (spec G §6, décision 3), les types de statut lus par l'UI, les types de sécurité (sessions, accès distant, isolation) et les entrées RPC de sync, présence, sessions, accès distant et isolation. Schéma seulement : aucune logique réseau.

**Files:**
- Create: `packages/schema/src/sync.ts`, `packages/schema/src/sync.test.ts`
- Create: `packages/schema/src/security.ts`, `packages/schema/src/security.test.ts`
- Create: `packages/schema/src/sync-rpc.ts`, `packages/schema/src/sync-rpc.test.ts`
- Modify: `packages/schema/src/rpc.ts` (décomposition de `SYNC_RPC_REQUESTS` dans `RpcRequest`, `SyncRpcResult` dans `RpcResult`)
- Modify: `packages/schema/src/events.ts` (union `DaemonEvent`)
- Modify: `packages/schema/src/index.ts`

**Interfaces:**
- Consumes: `KiboError` ; `ProjectMeta` ; `ProjectKey`.
- Consumes aussi : `Base64` (`packages/schema/src/ids.ts`, T1) ; `Role`, `KeyAllocator`, `MemberInfo`, `ProjectAccess`, `ProjectSyncInfo` (`packages/schema/src/sharing.ts`, T1, importés et non redéfinis).
- Produces (Contrats partagés) : `PresenceRun`, `PresenceState`, `DeviceInfo`, `RejectCode`, `ClientFrame`, `ServerFrame`, `JoinRequest`, `JoinResponse`, `MAX_FRAME_BYTES`, `challengePayload`, `SYNC_LIMITS`, `CLOSE_CODES`, `SyncState`, `SyncProjectStatus`, `SyncStatus`, `PresencePeer` ; `SessionInfo`, `RemoteTls`, `RemoteAccessConfig`, `RemoteAccessStatus`, `PairingCode`, `SandboxStatus`.
- Produces (nouveau, signalé) : `parseClientFrame(raw: string): ClientFrame`, `parseServerFrame(raw: string): ServerFrame` (taille > `MAX_FRAME_BYTES`, JSON invalide ou Zod ⇒ `KiboError("INVALID_INPUT")`), `encodeFrame(frame: ClientFrame | ServerFrame): string` ; `SYNC_RPC_REQUESTS` (tuple Zod), `SyncRpcResult` ; `Phase7Event` ajouté à `DaemonEvent`.
- Hypothèse v0.6 (vérifiée en T0) : `DaemonEvent` est une union TypeScript exportée par `packages/schema/src/events.ts` ; `RpcRequest` reste un `z.discriminatedUnion("method", [...])` et `RpcResult` un type objet indexé par méthode.

- [ ] **Step 1: Tests des trames**

`packages/schema/src/sync.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import {
  CLOSE_CODES,
  ClientFrame,
  challengePayload,
  encodeFrame,
  JoinRequest,
  MAX_FRAME_BYTES,
  parseClientFrame,
  parseServerFrame,
  SYNC_LIMITS,
  ServerFrame,
} from "./sync";

describe("client frames", () => {
  test("accepts every client frame type", () => {
    const frames = [
      { type: "auth", deviceId: "d1", signature: "c2ln" },
      { type: "subscribe", projectId: "p1", version: null },
      { type: "subscribe", projectId: "p1", version: "AAAA" },
      { type: "unsubscribe", projectId: "p1" },
      { type: "push", projectId: "p1", bytes: "AAAA", clientBatchId: "b1" },
      { type: "presence", projectId: "p1", bytes: "AAAA" },
      { type: "share", projectId: "p1", requestId: "r1", name: "Kibo", snapshot: "AAAA" },
      { type: "invite", projectId: "p1", requestId: "r2", role: "editor" },
      { type: "redeem", requestId: "r3", code: "ABCD" },
      { type: "set-role", projectId: "p1", requestId: "r4", userId: "u2", role: null },
      { type: "unshare", projectId: "p1", requestId: "r5" },
      { type: "device-invite", requestId: "r6" },
      { type: "list-devices", requestId: "r7" },
      { type: "revoke-device", requestId: "r8", deviceId: "d2" },
    ];
    for (const f of frames) expect(ClientFrame.safeParse(f).success).toBe(true);
  });

  test("refuses unknown types, invalid base64 and owner invitations", () => {
    expect(ClientFrame.safeParse({ type: "hello" }).success).toBe(false);
    expect(ClientFrame.safeParse({ type: "push", projectId: "p1", bytes: "@@", clientBatchId: "b" }).success).toBe(false);
    expect(ClientFrame.safeParse({ type: "push", projectId: "p1", bytes: "abc", clientBatchId: "b" }).success).toBe(false);
    expect(ClientFrame.safeParse({ type: "invite", projectId: "p1", requestId: "r", role: "owner" }).success).toBe(false);
    expect(ClientFrame.safeParse({ type: "subscribe", projectId: "", version: null }).success).toBe(false);
  });
});

describe("server frames", () => {
  test("accepts every server frame type", () => {
    const frames = [
      { type: "challenge", nonce: "AAAA" },
      { type: "welcome", userId: "u1", name: "Adam", deviceId: "d1", projects: [{ id: "p1", name: "Kibo", role: "owner" }] },
      { type: "update", projectId: "p1", bytes: "AAAA", serverSeq: 3, version: "AAAA" },
      { type: "ack", projectId: "p1", clientBatchId: "b1", serverSeq: 4, version: "AAAA" },
      { type: "reject", projectId: "p1", clientBatchId: "b1", code: "OUT_OF_DATE", message: "gap", version: "AAAA" },
      { type: "reject", projectId: "p1", clientBatchId: "b1", code: "UPDATE_REJECTED", message: "key", version: null },
      { type: "presence", projectId: "p1", bytes: "AAAA" },
      { type: "members", projectId: "p1", members: [{ userId: "u1", name: "Adam", role: "owner" }] },
      { type: "invite-code", requestId: "r1", code: "ABCD", expiresAt: 1 },
      { type: "shared", requestId: "r1", projectId: "p1" },
      { type: "joined", requestId: "r1", projectId: "p1", name: "Kibo", role: "viewer" },
      { type: "revoked", projectId: "p1", reason: "removed" },
      { type: "devices", requestId: "r1", devices: [{ deviceId: "d1", name: "Mac", createdAt: 1, lastSeenAt: null, revokedAt: null }] },
      { type: "done", requestId: "r1" },
      { type: "error", requestId: null, code: "FORBIDDEN", message: "owner only" },
    ];
    for (const f of frames) expect(ServerFrame.safeParse(f).success).toBe(true);
  });

  test("refuses a negative serverSeq and an unknown reject code", () => {
    expect(ServerFrame.safeParse({ type: "update", projectId: "p1", bytes: "AAAA", serverSeq: -1, version: "AAAA" }).success).toBe(false);
    expect(ServerFrame.safeParse({ type: "reject", projectId: "p1", clientBatchId: "b", code: "NOPE", message: "", version: null }).success).toBe(false);
  });
});

describe("parsing helpers", () => {
  test("round-trip through encodeFrame", () => {
    const frame = { type: "push", projectId: "p1", bytes: "AAAA", clientBatchId: "b1" } as const;
    expect(parseClientFrame(encodeFrame(frame))).toEqual(frame);
    expect(parseServerFrame(encodeFrame({ type: "done", requestId: "r" }))).toEqual({ type: "done", requestId: "r" });
  });

  test("invalid JSON, invalid shape and oversized frames are input errors", () => {
    expect(() => parseClientFrame("{")).toThrow("INVALID_INPUT");
    expect(() => parseClientFrame('{"type":"nope"}')).toThrow("INVALID_INPUT");
    expect(() => parseServerFrame("x".repeat(MAX_FRAME_BYTES + 1))).toThrow("INVALID_INPUT");
  });
});

describe("constants", () => {
  test("challenge payload is deterministic and bound to the origin", () => {
    const a = challengePayload("bm9uY2U=", "wss://sync.kibo.test");
    expect(new TextDecoder().decode(a)).toBe("kibo-sync-v1\nbm9uY2U=\nwss://sync.kibo.test");
    expect(challengePayload("bm9uY2U=", "wss://other.test")).not.toEqual(a);
  });

  test("limits and close codes match spec G", () => {
    expect(MAX_FRAME_BYTES).toBe(8 * 1024 * 1024);
    expect(SYNC_LIMITS).toMatchObject({
      batchMs: 50,
      projectBytes: 50 * 1024 * 1024,
      updatesPerSecond: 100,
      connectionsPerUser: 20,
      authFailuresPerMinute: 5,
      authBlockMs: 5 * 60_000,
      compactEvery: 500,
      unloadAfterMs: 10 * 60_000,
      backoffMinMs: 1000,
      backoffMaxMs: 60_000,
      presenceTimeoutMs: 30_000,
      presenceRefreshMs: 10_000,
      accountInviteMs: 48 * 3_600_000,
      deviceInviteMs: 15 * 60_000,
      projectInviteMs: 48 * 3_600_000,
    });
    expect(CLOSE_CODES).toEqual({ authFailed: 4401, deviceRevoked: 4403, accessRevoked: 4404, tooManyConnections: 4429 });
  });

  test("join request trims and bounds the device name", () => {
    expect(JoinRequest.safeParse({ code: "ABCD", publicKey: "AAAA", deviceName: "  Mac  " }).success).toBe(true);
    expect(JoinRequest.safeParse({ code: "ABCD", publicKey: "AAAA", deviceName: "   " }).success).toBe(false);
  });
});
```

Run: `bun test packages/schema/src/sync.test.ts`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 2: Implémenter `sync.ts`**

```ts
import { z } from "zod";
import { KiboError } from "./errors";
import { Base64 } from "./ids";
import { MemberInfo, Role } from "./sharing";

export const PresenceRun = z.object({ ticketKey: z.string().nullable(), profile: z.string(), state: z.string() });
export type PresenceRun = z.infer<typeof PresenceRun>;
export const PresenceState = z.object({
  userId: z.string(),
  name: z.string(),
  pageId: z.string().nullable(),
  ticketId: z.string().nullable(),
  runs: z.array(PresenceRun).max(50),
});
export type PresenceState = z.infer<typeof PresenceState>;
export const DeviceInfo = z.object({
  deviceId: z.string(),
  name: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number().nullable(),
  revokedAt: z.number().nullable(),
});
export type DeviceInfo = z.infer<typeof DeviceInfo>;
export const RejectCode = z.enum(["UPDATE_REJECTED", "OUT_OF_DATE", "FORBIDDEN", "QUOTA_EXCEEDED", "RATE_LIMITED"]);
export type RejectCode = z.infer<typeof RejectCode>;

const projectId = z.string().min(1).max(128);
const requestId = z.string().min(1).max(64);
const seq = z.number().int().nonnegative();

export const ClientFrame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), deviceId: z.string().min(1), signature: Base64 }),
  z.object({ type: z.literal("subscribe"), projectId, version: Base64.nullable() }),
  z.object({ type: z.literal("unsubscribe"), projectId }),
  z.object({ type: z.literal("push"), projectId, bytes: Base64, clientBatchId: requestId }),
  z.object({ type: z.literal("presence"), projectId, bytes: Base64 }),
  z.object({ type: z.literal("share"), projectId, requestId, name: z.string().trim().min(1).max(200), snapshot: Base64 }),
  z.object({ type: z.literal("invite"), projectId, requestId, role: z.enum(["editor", "viewer"]) }),
  z.object({ type: z.literal("redeem"), requestId, code: z.string().min(1).max(64) }),
  z.object({ type: z.literal("set-role"), projectId, requestId, userId: z.string().min(1), role: Role.nullable() }),
  z.object({ type: z.literal("unshare"), projectId, requestId }),
  z.object({ type: z.literal("device-invite"), requestId }),
  z.object({ type: z.literal("list-devices"), requestId }),
  z.object({ type: z.literal("revoke-device"), requestId, deviceId: z.string().min(1) }),
]);
export type ClientFrame = z.infer<typeof ClientFrame>;

export const ServerFrame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("challenge"), nonce: Base64 }),
  z.object({
    type: z.literal("welcome"),
    userId: z.string(),
    name: z.string(),
    deviceId: z.string(),
    projects: z.array(z.object({ id: projectId, name: z.string(), role: Role })),
  }),
  z.object({ type: z.literal("update"), projectId, bytes: Base64, serverSeq: seq, version: Base64 }),
  z.object({ type: z.literal("ack"), projectId, clientBatchId: requestId, serverSeq: seq, version: Base64 }),
  z.object({
    type: z.literal("reject"),
    projectId,
    clientBatchId: requestId,
    code: RejectCode,
    message: z.string(),
    version: Base64.nullable(),
  }),
  z.object({ type: z.literal("presence"), projectId, bytes: Base64 }),
  z.object({ type: z.literal("members"), projectId, members: z.array(MemberInfo) }),
  z.object({ type: z.literal("invite-code"), requestId, code: z.string(), expiresAt: z.number() }),
  z.object({ type: z.literal("shared"), requestId, projectId }),
  z.object({ type: z.literal("joined"), requestId, projectId, name: z.string(), role: Role }),
  z.object({ type: z.literal("revoked"), projectId, reason: z.enum(["removed", "deleted"]) }),
  z.object({ type: z.literal("devices"), requestId, devices: z.array(DeviceInfo) }),
  z.object({ type: z.literal("done"), requestId }),
  z.object({ type: z.literal("error"), requestId: requestId.nullable(), code: z.string(), message: z.string() }),
]);
export type ServerFrame = z.infer<typeof ServerFrame>;

export const JoinRequest = z.object({
  code: z.string().min(1).max(64),
  publicKey: Base64,
  deviceName: z.string().trim().min(1).max(64),
});
export type JoinRequest = z.infer<typeof JoinRequest>;
export const JoinResponse = z.object({ userId: z.string(), deviceId: z.string(), name: z.string() });
export type JoinResponse = z.infer<typeof JoinResponse>;

export const MAX_FRAME_BYTES = 8 * 1024 * 1024;
export const CHALLENGE_PREFIX = "kibo-sync-v1";

export function challengePayload(nonce: string, origin: string): Uint8Array {
  return new TextEncoder().encode(`${CHALLENGE_PREFIX}\n${nonce}\n${origin}`);
}

function parseWith<T>(schema: z.ZodType<T>, raw: string): T {
  if (raw.length > MAX_FRAME_BYTES) throw new KiboError("INVALID_INPUT", "frame too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `frame is not JSON: ${String(e)}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid frame: ${parsed.error.message}`);
  return parsed.data;
}

export const parseClientFrame = (raw: string): ClientFrame => parseWith(ClientFrame, raw);
export const parseServerFrame = (raw: string): ServerFrame => parseWith(ServerFrame, raw);
export const encodeFrame = (frame: ClientFrame | ServerFrame): string => JSON.stringify(frame);

export const SYNC_LIMITS = {
  batchMs: 50,
  projectBytes: 50 * 1024 * 1024,
  updatesPerSecond: 100,
  connectionsPerUser: 20,
  authFailuresPerMinute: 5,
  authBlockMs: 5 * 60_000,
  compactEvery: 500,
  unloadAfterMs: 10 * 60_000,
  backoffMinMs: 1000,
  backoffMaxMs: 60_000,
  presenceTimeoutMs: 30_000,
  presenceRefreshMs: 10_000,
  accountInviteMs: 48 * 3_600_000,
  deviceInviteMs: 15 * 60_000,
  projectInviteMs: 48 * 3_600_000,
} as const;

export const CLOSE_CODES = { authFailed: 4401, deviceRevoked: 4403, accessRevoked: 4404, tooManyConnections: 4429 } as const;

export type SyncState = "unconfigured" | "connecting" | "online" | "offline";
export type SyncProjectStatus = {
  projectId: string;
  name: string;
  role: Role;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: boolean;
};
export type SyncStatus = {
  state: SyncState;
  serverUrl: string | null;
  user: { id: string; name: string } | null;
  deviceId: string | null;
  retryAt: number | null;
  lastError: string | null;
  projects: SyncProjectStatus[];
};
export type PresencePeer = PresenceState & { deviceId: string; self: boolean };

export type Phase7Event =
  | { type: "sync" }
  | { type: "presence"; projectId: string }
  | { type: "market" }
  | { type: "sessions" }
  | { type: "sandbox" };
```

`parseWith` mesure `raw.length` (unités UTF-16) : une trame JSON de base64 est ASCII, la longueur en octets est donc identique.

Run: `bun test packages/schema/src/sync.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests des types de sécurité**

`packages/schema/src/security.test.ts` :
```ts
import { expect, test } from "bun:test";
import { RemoteAccessConfig, RemoteTls } from "./security";

test("remote access needs a concrete interface address", () => {
  const tls = { kind: "self-signed" } as const;
  expect(RemoteAccessConfig.safeParse({ address: "192.168.1.20", port: 47832, tls }).success).toBe(true);
  expect(RemoteAccessConfig.safeParse({ address: "fe80::1", port: 47832, tls }).success).toBe(true);
  expect(RemoteAccessConfig.safeParse({ address: "0.0.0.0", port: 47832, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "::", port: 47832, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "kibo.local", port: 47832, tls }).success).toBe(false);
});

test("ports are unprivileged", () => {
  const tls = { kind: "self-signed" } as const;
  expect(RemoteAccessConfig.safeParse({ address: "10.0.0.2", port: 443, tls }).success).toBe(false);
  expect(RemoteAccessConfig.safeParse({ address: "10.0.0.2", port: 70000, tls }).success).toBe(false);
});

test("a provided certificate needs both files", () => {
  expect(RemoteTls.safeParse({ kind: "provided", certFile: "/c.pem", keyFile: "/k.pem" }).success).toBe(true);
  expect(RemoteTls.safeParse({ kind: "provided", certFile: "/c.pem", keyFile: "" }).success).toBe(false);
});
```

Run: `bun test packages/schema/src/security.test.ts`
Expected: FAIL — `Cannot find module './security'`.

- [ ] **Step 4: Implémenter `security.ts`**

```ts
import { z } from "zod";

export type SessionInfo = {
  id: string;
  deviceName: string;
  remote: boolean;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  current: boolean;
};

export const RemoteTls = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self-signed") }),
  z.object({ kind: z.literal("provided"), certFile: z.string().min(1), keyFile: z.string().min(1) }),
]);
export type RemoteTls = z.infer<typeof RemoteTls>;

const WILDCARDS = new Set(["0.0.0.0", "::", "0:0:0:0:0:0:0:0"]);

export const RemoteAccessConfig = z.object({
  address: z
    .string()
    .ip()
    .refine((a) => !WILDCARDS.has(a), "listening on every interface is not allowed"),
  port: z.number().int().min(1024).max(65535),
  tls: RemoteTls,
});
export type RemoteAccessConfig = z.infer<typeof RemoteAccessConfig>;

export type RemoteAccessStatus = {
  enabled: boolean;
  address: string | null;
  port: number | null;
  url: string | null;
  fingerprint: string | null;
  tls: "self-signed" | "provided" | null;
  interfaces: { name: string; address: string }[];
  lastError: string | null;
};
export type PairingCode = { code: string; expiresAt: number };
export type SandboxStatus = {
  kind: "bwrap" | "sandbox-exec" | null;
  available: boolean;
  reason: string | null;
  fix: string | null;
  allowUnsandboxed: boolean;
};
```

Run: `bun test packages/schema/src/security.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests des RPC**

`packages/schema/src/sync-rpc.test.ts` :
```ts
import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("phase 7 sync, presence and security RPCs parse", () => {
  const requests = [
    { method: "listSessions" },
    { method: "revokeSession", id: "a".repeat(64) },
    { method: "getRemoteAccess" },
    { method: "enableRemoteAccess", address: "192.168.1.20", port: 47832, tls: { kind: "self-signed" } },
    { method: "disableRemoteAccess" },
    { method: "createPairingCode" },
    { method: "getSandboxStatus" },
    { method: "setAllowUnsandboxed", allow: true },
    { method: "getSyncStatus" },
    { method: "connectSyncServer", serverUrl: "wss://sync.kibo.test", code: "ABCD", deviceName: "Mac", caFile: null },
    { method: "disconnectSyncServer" },
    { method: "listDevices" },
    { method: "addDevice" },
    { method: "revokeDevice", deviceId: "d2" },
    { method: "shareProject", projectId: "p1" },
    { method: "createProjectInvite", projectId: "p1", role: "viewer" },
    { method: "joinProject", code: "ABCD", folder: null },
    { method: "setMemberRole", projectId: "p1", userId: "u2", role: null },
    { method: "unshareProject", projectId: "p1" },
    { method: "setBindingRunner", projectId: "p1", bindingId: "b1" },
    { method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null },
    { method: "getPresence", projectId: "p1" },
  ];
  for (const r of requests) expect(RpcRequest.safeParse(r).success).toBe(true);
});

test("invalid phase 7 RPCs are refused", () => {
  expect(RpcRequest.safeParse({ method: "enableRemoteAccess", address: "0.0.0.0", port: 47832, tls: { kind: "self-signed" } }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "createProjectInvite", projectId: "p1", role: "owner" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "connectSyncServer", serverUrl: "", code: "A", deviceName: "M", caFile: null }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "setAllowUnsandboxed" }).success).toBe(false);
});
```

Run: `bun test packages/schema/src/sync-rpc.test.ts`
Expected: FAIL — les méthodes ne sont pas dans `RpcRequest`.

- [ ] **Step 6: Implémenter `sync-rpc.ts` et brancher `rpc.ts`**

`packages/schema/src/sync-rpc.ts` :
```ts
import { z } from "zod";
import type { ProjectMeta } from "./project";
import { type PairingCode, RemoteAccessConfig, type RemoteAccessStatus, type SandboxStatus, type SessionInfo } from "./security";
import { type MemberInfo, type ProjectSyncInfo, Role } from "./sharing";
import type { DeviceInfo, PresencePeer, SyncStatus } from "./sync";

const id = z.string().min(1).max(128);

export const SYNC_RPC_REQUESTS = [
  z.object({ method: z.literal("listSessions") }),
  z.object({ method: z.literal("revokeSession"), id: z.string().regex(/^[0-9a-f]{64}$/) }),
  z.object({ method: z.literal("getRemoteAccess") }),
  RemoteAccessConfig.extend({ method: z.literal("enableRemoteAccess") }),
  z.object({ method: z.literal("disableRemoteAccess") }),
  z.object({ method: z.literal("createPairingCode") }),
  z.object({ method: z.literal("getSandboxStatus") }),
  z.object({ method: z.literal("setAllowUnsandboxed"), allow: z.boolean() }),
  z.object({ method: z.literal("getSyncStatus") }),
  z.object({
    method: z.literal("connectSyncServer"),
    serverUrl: z.string().min(1).max(2048),
    code: z.string().min(1).max(64),
    deviceName: z.string().trim().min(1).max(64),
    caFile: z.string().min(1).nullable(),
  }),
  z.object({ method: z.literal("disconnectSyncServer") }),
  z.object({ method: z.literal("listDevices") }),
  z.object({ method: z.literal("addDevice") }),
  z.object({ method: z.literal("revokeDevice"), deviceId: id }),
  z.object({ method: z.literal("shareProject"), projectId: id }),
  z.object({ method: z.literal("createProjectInvite"), projectId: id, role: z.enum(["editor", "viewer"]) }),
  z.object({ method: z.literal("joinProject"), code: z.string().min(1).max(64), folder: z.string().min(1).nullable() }),
  z.object({ method: z.literal("setMemberRole"), projectId: id, userId: id, role: Role.nullable() }),
  z.object({ method: z.literal("unshareProject"), projectId: id }),
  z.object({ method: z.literal("setBindingRunner"), projectId: id, bindingId: id }),
  z.object({ method: z.literal("setPresence"), projectId: id, pageId: id.nullable(), ticketId: id.nullable() }),
  z.object({ method: z.literal("getPresence"), projectId: id }),
] as const;

export type SyncRpcResult = {
  listSessions: SessionInfo[];
  revokeSession: null;
  getRemoteAccess: RemoteAccessStatus;
  enableRemoteAccess: RemoteAccessStatus;
  disableRemoteAccess: null;
  createPairingCode: PairingCode;
  getSandboxStatus: SandboxStatus;
  setAllowUnsandboxed: SandboxStatus;
  getSyncStatus: SyncStatus;
  connectSyncServer: SyncStatus;
  disconnectSyncServer: null;
  listDevices: DeviceInfo[];
  addDevice: { code: string; expiresAt: number };
  revokeDevice: null;
  shareProject: ProjectSyncInfo;
  createProjectInvite: { code: string; expiresAt: number };
  joinProject: ProjectMeta;
  setMemberRole: MemberInfo[];
  unshareProject: null;
  setBindingRunner: null;
  setPresence: null;
  getPresence: PresencePeer[];
};
```

Dans `packages/schema/src/rpc.ts`, ajouter `...SYNC_RPC_REQUESTS` à la fin du tableau de `RpcRequest` (après les entrées des phases 1 à 6) et étendre le type de résultat :
```ts
import { SYNC_RPC_REQUESTS, type SyncRpcResult } from "./sync-rpc";

export const RpcRequest = z.discriminatedUnion("method", [
  ...EXISTING_REQUESTS,
  ...SYNC_RPC_REQUESTS,
]);

export type RpcResult = CoreRpcResult & SyncRpcResult;
```
où `EXISTING_REQUESTS` désigne le tableau actuel sorti tel quel dans une constante `as const`, et `CoreRpcResult` l'ancien type `RpcResult` renommé ; si `rpc.ts` compose déjà plusieurs tableaux (phases 4 à 6), ajouter simplement `...SYNC_RPC_REQUESTS` à la liste.

Dans `packages/schema/src/events.ts`, ajouter `| Phase7Event` à l'union `DaemonEvent` (import de type depuis `./sync`).

Ajouter à `packages/schema/src/index.ts` :
```ts
export * from "./security";
export * from "./sync";
export * from "./sync-rpc";
```

Run: `bun test packages/schema`
Expected: PASS (tous les tests du paquet, anciens compris).

- [ ] **Step 7: Vérifications**

Run: `bun run check && bun run typecheck`
Expected: sans erreur. Le démon compile encore : ses `switch` sur `req.method` ne sont pas exhaustifs par `never` pour les nouvelles méthodes ; si l'un l'est, ajouter une branche qui lève `new KiboError("INTERNAL", `${req.method} is not wired yet`)`, remplacée par les tâches 9, 12, 13, 21, 23 et 24.

- [ ] **Step 8: Commit**

```bash
git add packages/schema/src/sync.ts packages/schema/src/sync.test.ts packages/schema/src/security.ts packages/schema/src/security.test.ts packages/schema/src/sync-rpc.ts packages/schema/src/sync-rpc.test.ts packages/schema/src/rpc.ts packages/schema/src/events.ts packages/schema/src/index.ts
git commit -m "feat(schema): protocole de sync"
```
Ajouter à `git add` le fichier du démon modifié à l'étape 7 s'il y en a un.

---

### Task 5: Schémas de la marketplace

Formats signés de la spec H §3 (`.kpkg`, index de source), types des RPC marketplace de la spec H §6, extensions rétrocompatibles du registre (décision 12) et de l'instance (décision 11). Schéma seulement.

**Files:**
- Create: `packages/schema/src/market.ts`, `packages/schema/src/market.test.ts`
- Create: `packages/schema/src/market-rpc.ts`, `packages/schema/src/market-rpc.test.ts`
- Modify: `packages/schema/src/registry.ts` (`RegistryVersion.source`, `RegistryVersion.revoked`)
- Modify: `packages/schema/src/instance.ts` (`Instance.componentHash`)
- Create: `packages/schema/src/compat.test.ts`
- Modify: `packages/core/src/instances.ts` (lecture de `componentHash`)
- Modify: `packages/schema/src/rpc.ts`, `packages/schema/src/index.ts`

**Interfaces:**
- Consumes: `Base64`, `Sha256` (`packages/schema/src/ids.ts`, T1) ; `ComponentManifest`, `ComponentId`, `ComponentKind`, `SemVer`, `GrantedPermissions` (`manifest.ts`, phase 4) ; `RegistryVersion`, `TrustPreview` (`registry.ts`, phase 4).
- Produces (Contrats partagés) : `KpkgFile`, `Kpkg`, `MarketIndex`, `KPKG_MAX_BYTES`, `MARKET_FETCH_TIMEOUT_MS`, `MARKET_REFRESH_MS`, `MarketSourceInfo`, `MarketProbe`, `MarketHit`, `MarketVersionInfo`, `MarketPackageDetail`, `MarketInstallResult` ; `RegistryVersion.source: { sourceId: string; publisherKey: string } | null` ; `RegistryVersion.revoked: { reason: string; at: number } | null` ; `Instance.componentHash: string | null`.
- Produces (nouveau, signalé) : `MARKET_RPC_REQUESTS` (tuple Zod), `MarketRpcResult`.
- Hypothèse v0.6 (vérifiée en T0) : `ComponentId`, `ComponentKind`, `SemVer`, `GrantedPermissions` sont exportés par `packages/schema/src/manifest.ts` ; `RegistryVersion` et `TrustPreview` par `packages/schema/src/registry.ts` ; `core/src/instances.ts` a une fonction de lecture `readInstance` utilisée par `listInstances`.

- [ ] **Step 1: Tests des formats signés**

`packages/schema/src/market.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { KPKG_MAX_BYTES, Kpkg, MARKET_FETCH_TIMEOUT_MS, MARKET_REFRESH_MS, MarketIndex, Sha256 } from "./index";

const H = "a".repeat(64);
const manifest = {
  id: "burndown",
  version: "0.3.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
};
const kpkg = {
  format: 1,
  manifest,
  files: [{ path: "ui.tsx", sha256: H, content: "AAAA" }],
  hash: H,
  publisher: { name: "Léa", publicKey: "AAAA" },
  publishedAt: "2026-09-26T10:00:00.000Z",
  signature: "AAAA",
};
const index = {
  format: 1,
  source: { id: "team", name: "Équipe", publicKey: "AAAA" },
  serial: 42,
  generatedAt: "2026-09-26T10:00:00.000Z",
  publishers: [{ publicKey: "AAAA", name: "Léa", verified: true }],
  packages: [
    {
      id: "burndown",
      title: "Burndown",
      description: "Tickets restants par jour",
      kind: "widget",
      versions: [
        {
          version: "0.3.0",
          hash: H,
          publisherKey: "AAAA",
          size: 1234,
          permissions: { reads: ["ticket"], writes: [], data: false, net: [] },
          publishedAt: "2026-09-26T10:00:00.000Z",
          url: "packages/burndown/0.3.0.kpkg",
        },
      ],
    },
  ],
  revoked: [{ hash: "b".repeat(64), reason: "fuite de données" }],
};

describe("Sha256", () => {
  test("is lowercase hex of 64 characters", () => {
    expect(Sha256.safeParse(H).success).toBe(true);
    expect(Sha256.safeParse("A".repeat(64)).success).toBe(false);
    expect(Sha256.safeParse("a".repeat(63)).success).toBe(false);
  });
});

describe("Kpkg", () => {
  test("accepts a well-formed package and applies manifest defaults", () => {
    const parsed = Kpkg.parse(kpkg);
    expect(parsed.manifest.id).toBe("burndown");
  });
  test("refuses another format, a non-hex hash, an invalid date or no file", () => {
    expect(Kpkg.safeParse({ ...kpkg, format: 2 }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, hash: "zz" }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publishedAt: "hier" }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, files: [] }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publisher: { name: "", publicKey: "AAAA" } }).success).toBe(false);
    expect(Kpkg.safeParse({ ...kpkg, publisher: { name: "x".repeat(65), publicKey: "AAAA" } }).success).toBe(false);
  });
});

describe("MarketIndex", () => {
  test("accepts spec H §3.2", () => {
    expect(MarketIndex.parse(index).serial).toBe(42);
  });
  test("refuses serial 0, another format and malformed versions", () => {
    expect(MarketIndex.safeParse({ ...index, serial: 0 }).success).toBe(false);
    expect(MarketIndex.safeParse({ ...index, format: 2 }).success).toBe(false);
    const bad = structuredClone(index);
    const v = bad.packages[0]?.versions[0];
    if (v) v.version = "1.0";
    expect(MarketIndex.safeParse(bad).success).toBe(false);
  });
});

test("limits", () => {
  expect(KPKG_MAX_BYTES).toBe(2 * 1024 * 1024);
  expect(MARKET_FETCH_TIMEOUT_MS).toBe(30_000);
  expect(MARKET_REFRESH_MS).toBe(6 * 3_600_000);
});
```

Run: `bun test packages/schema/src/market.test.ts`
Expected: FAIL — `Kpkg` n'est pas exporté.

- [ ] **Step 2: Implémenter `market.ts`**

`packages/schema/src/market.ts` :
```ts
import { z } from "zod";
import { Base64, Sha256 } from "./ids";
import { ComponentId, ComponentKind, ComponentManifest, GrantedPermissions, SemVer } from "./manifest";
import type { TrustPreview } from "./registry";

export const KpkgFile = z.object({ path: z.string().min(1), sha256: Sha256, content: Base64 });
export type KpkgFile = z.infer<typeof KpkgFile>;

export const Kpkg = z.object({
  format: z.literal(1),
  manifest: ComponentManifest,
  files: z.array(KpkgFile).min(1),
  hash: Sha256,
  publisher: z.object({ name: z.string().min(1).max(64), publicKey: Base64 }),
  publishedAt: z.string().datetime(),
  signature: Base64,
});
export type Kpkg = z.infer<typeof Kpkg>;

export const MarketIndex = z.object({
  format: z.literal(1),
  source: z.object({ id: z.string(), name: z.string(), publicKey: z.string() }),
  serial: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  publishers: z.array(z.object({ publicKey: z.string(), name: z.string(), verified: z.boolean() })),
  packages: z.array(
    z.object({
      id: ComponentId,
      title: z.string(),
      description: z.string(),
      kind: ComponentKind,
      versions: z.array(
        z.object({
          version: SemVer,
          hash: Sha256,
          publisherKey: z.string(),
          size: z.number().int(),
          permissions: GrantedPermissions,
          publishedAt: z.string().datetime(),
          url: z.string(),
        }),
      ),
    }),
  ),
  revoked: z.array(z.object({ hash: Sha256, reason: z.string() })),
});
export type MarketIndex = z.infer<typeof MarketIndex>;

export const KPKG_MAX_BYTES = 2 * 1024 * 1024;
export const MARKET_FETCH_TIMEOUT_MS = 30_000;
export const MARKET_REFRESH_MS = 6 * 3_600_000;

export type MarketSourceInfo = {
  id: string;
  name: string;
  url: string;
  publicKey: string;
  fingerprint: string;
  lastSerial: number | null;
  lastFetchedAt: number | null;
  lastError: string | null;
  enabled: boolean;
};
export type MarketProbe = {
  sourceId: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  serial: number;
  packages: number;
};
export type MarketHit = {
  sourceId: string;
  sourceName: string;
  id: string;
  title: string;
  description: string;
  kind: ComponentKind;
  latest: string;
  publisher: { name: string; publicKey: string; verified: boolean };
  installed: string | null;
  updateAvailable: string | null;
};
export type MarketVersionInfo = {
  version: string;
  hash: string;
  size: number;
  permissions: GrantedPermissions;
  publishedAt: string;
  revoked: string | null;
};
export type MarketPackageDetail = MarketHit & {
  version: string;
  hash: string;
  size: number;
  permissions: GrantedPermissions;
  versions: MarketVersionInfo[];
  pinnedPublisher: string | null;
  newPublisher: boolean;
  publisherChanged: boolean;
  files: { path: string; content: string }[];
};
export type MarketInstallResult = { id: string; version: string; hash: string; preview: TrustPreview };
```

`ComponentKind` et `GrantedPermissions` sont à la fois des schémas et des types (`z.infer`) dans `manifest.ts` ; si l'un n'est exporté que comme schéma, utiliser `z.infer<typeof …>` localement.

Ajouter à `packages/schema/src/index.ts` : `export * from "./market";`

Run: `bun test packages/schema/src/market.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests de rétrocompatibilité**

`packages/schema/src/compat.test.ts` :
```ts
import { expect, test } from "bun:test";
import { Instance, RegistryVersion } from "./index";

test("a v0.6 registry entry parses with source and revoked set to null", () => {
  const v06 = {
    version: "0.3.0",
    hash: "c".repeat(64),
    origin: "user",
    trust: "sandboxed",
    approvedHash: "c".repeat(64),
    granted: { reads: ["ticket"], writes: [], data: false, net: [] },
    publishedAt: 1,
  };
  const parsed = RegistryVersion.parse(v06);
  expect(parsed.source).toBeNull();
  expect(parsed.revoked).toBeNull();
});

test("a marketplace entry keeps its source and revocation", () => {
  const parsed = RegistryVersion.parse({
    version: "0.3.0",
    hash: "c".repeat(64),
    origin: "marketplace",
    trust: null,
    approvedHash: null,
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 1,
    source: { sourceId: "team", publisherKey: "AAAA" },
    revoked: { reason: "fuite de données", at: 5 },
  });
  expect(parsed.source).toEqual({ sourceId: "team", publisherKey: "AAAA" });
  expect(parsed.revoked?.reason).toBe("fuite de données");
});

test("a v0.6 instance parses with componentHash null", () => {
  const parsed = Instance.parse({
    id: "i1",
    pageId: "pg1",
    component: "kanban@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 4 },
    config: {},
  });
  expect(parsed.componentHash).toBeNull();
});

test("componentHash must be a sha256 when present", () => {
  const base = { id: "i1", pageId: "pg1", component: "burndown@0.3.0", layout: { x: 0, y: 0, w: 6, h: 4 }, config: {} };
  expect(Instance.safeParse({ ...base, componentHash: "d".repeat(64) }).success).toBe(true);
  expect(Instance.safeParse({ ...base, componentHash: "nope" }).success).toBe(false);
});
```

Run: `bun test packages/schema/src/compat.test.ts`
Expected: FAIL — `parsed.source` est `undefined` (champ inconnu retiré par Zod).

- [ ] **Step 4: Étendre le registre et l'instance**

Dans `packages/schema/src/registry.ts`, ajouter à l'objet `RegistryVersion` :
```ts
  source: z.object({ sourceId: z.string().min(1), publisherKey: z.string().min(1) }).nullable().default(null),
  revoked: z.object({ reason: z.string(), at: z.number().int() }).nullable().default(null),
```

Dans `packages/schema/src/instance.ts` :
```ts
import { NodeId, Sha256 } from "./ids";

export const Instance = z.object({
  id: z.string(),
  pageId: NodeId,
  component: ComponentRef,
  layout: Layout,
  config: z.record(z.string(), z.unknown()),
  componentHash: Sha256.nullable().default(null),
});
```
(garder les champs ajoutés par les phases 4 à 6, par exemple `data`.)

Dans `packages/core/src/instances.ts`, la lecture d'une instance renvoie le champ :
```ts
componentHash: (m.get("componentHash") as string | null | undefined) ?? null,
```
à côté des autres champs lus depuis la `LoroMap` de l'instance.

Run: `bun test packages/schema/src/compat.test.ts packages/core`
Expected: PASS.

- [ ] **Step 5: Réparer les littéraux typés**

Run: `bun run typecheck`
Expected: des erreurs `Property 'componentHash' is missing` et `Property 'source' is missing` uniquement dans des littéraux de test ou des constructions d'objets `Instance` / `RegistryVersion`. Ajouter `componentHash: null` et `source: null, revoked: null` à chacun (les fonctions du démon qui créent un `RegistryVersion` pour un composant utilisateur ou IA écrivent `source: null, revoked: null`). Aucune attente de test existante ne change.

Run: `bun run typecheck && bun test packages components`
Expected: sans erreur, PASS.

- [ ] **Step 6: Tests des RPC marketplace**

`packages/schema/src/market-rpc.test.ts` :
```ts
import { expect, test } from "bun:test";
import { RpcRequest } from "./rpc";

test("marketplace RPCs parse", () => {
  const requests = [
    { method: "listMarketSources" },
    { method: "probeMarketSource", url: "https://market.kibo.test" },
    { method: "addMarketSource", url: "https://market.kibo.test", publicKey: "AAAA" },
    { method: "removeMarketSource", id: "team" },
    { method: "refreshMarket" },
    { method: "searchMarket", query: "burn" },
    { method: "searchMarket", query: "", sourceId: "team", kind: "widget" },
    { method: "getMarketPackage", sourceId: "team", id: "burndown", version: "0.3.0" },
    { method: "unpinPublisher", sourceId: "team", componentId: "burndown" },
    { method: "findMarketSource", id: "burndown", version: "0.3.0", hash: null },
    { method: "installFromMarket", sourceId: "team", id: "burndown", version: "0.3.0" },
    { method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team" },
    { method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team", publisherName: "Léa" },
    { method: "exportKpkg", id: "burndown", version: "0.3.0" },
  ];
  for (const r of requests) expect(RpcRequest.safeParse(r).success).toBe(true);
});

test("invalid marketplace RPCs are refused", () => {
  expect(RpcRequest.safeParse({ method: "getMarketPackage", sourceId: "team", id: "burndown", version: "1" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "findMarketSource", id: "burndown", version: "0.3.0", hash: "x" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "probeMarketSource", url: "" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "team", publisherName: "" }).success).toBe(false);
});
```

Run: `bun test packages/schema/src/market-rpc.test.ts`
Expected: FAIL — méthodes absentes de `RpcRequest`.

- [ ] **Step 7: Implémenter `market-rpc.ts` et brancher**

`packages/schema/src/market-rpc.ts` :
```ts
import { z } from "zod";
import { Sha256 } from "./ids";
import type { Kpkg, MarketHit, MarketInstallResult, MarketPackageDetail, MarketProbe, MarketSourceInfo } from "./market";
import { ComponentId, ComponentKind, SemVer } from "./manifest";

const sourceId = z.string().min(1).max(64);
const url = z.string().min(1).max(2048);
const publisherName = z.string().trim().min(1).max(64);

export const MARKET_RPC_REQUESTS = [
  z.object({ method: z.literal("listMarketSources") }),
  z.object({ method: z.literal("probeMarketSource"), url }),
  z.object({ method: z.literal("addMarketSource"), url, publicKey: z.string().min(1) }),
  z.object({ method: z.literal("removeMarketSource"), id: sourceId }),
  z.object({ method: z.literal("refreshMarket") }),
  z.object({
    method: z.literal("searchMarket"),
    query: z.string().max(200),
    sourceId: sourceId.optional(),
    kind: ComponentKind.optional(),
  }),
  z.object({ method: z.literal("getMarketPackage"), sourceId, id: ComponentId, version: SemVer }),
  z.object({ method: z.literal("unpinPublisher"), sourceId, componentId: ComponentId }),
  z.object({ method: z.literal("findMarketSource"), id: ComponentId, version: SemVer, hash: Sha256.nullable() }),
  z.object({ method: z.literal("installFromMarket"), sourceId, id: ComponentId, version: SemVer }),
  z.object({
    method: z.literal("publishToMarket"),
    id: ComponentId,
    version: SemVer,
    sourceId,
    publisherName: publisherName.optional(),
  }),
  z.object({ method: z.literal("exportKpkg"), id: ComponentId, version: SemVer, publisherName: publisherName.optional() }),
] as const;

export type MarketRpcResult = {
  listMarketSources: MarketSourceInfo[];
  probeMarketSource: MarketProbe;
  addMarketSource: MarketSourceInfo;
  removeMarketSource: null;
  refreshMarket: null;
  searchMarket: MarketHit[];
  getMarketPackage: MarketPackageDetail;
  unpinPublisher: null;
  findMarketSource: { sourceId: string } | null;
  installFromMarket: MarketInstallResult;
  publishToMarket: { serial: number };
  exportKpkg: Kpkg;
};
```

Dans `packages/schema/src/rpc.ts`, ajouter `...MARKET_RPC_REQUESTS` au tableau de `RpcRequest` et `& MarketRpcResult` au type `RpcResult` (même procédé que T4 ; l'ordre de décomposition est indifférent). Ajouter à `index.ts` : `export * from "./market-rpc";`.

Run: `bun test packages/schema`
Expected: PASS.

- [ ] **Step 8: Vérifications**

Run: `bun run check && bun run typecheck`
Expected: sans erreur (même règle que T4 pour un `switch` exhaustif du démon : branche `INTERNAL` provisoire, remplacée par T15, T20 et T22).

- [ ] **Step 9: Commit**

```bash
git add packages/schema/src/market.ts packages/schema/src/market.test.ts packages/schema/src/market-rpc.ts packages/schema/src/market-rpc.test.ts packages/schema/src/registry.ts packages/schema/src/instance.ts packages/schema/src/compat.test.ts packages/schema/src/rpc.ts packages/schema/src/index.ts packages/core/src/instances.ts
git commit -m "feat(schema): marketplace"
```
Ajouter à `git add` chaque fichier de test ou du démon réparé à l'étape 5 (littéraux `componentHash`, `source`, `revoked`).

---

### Task 6: Clé provisoire des tickets

Dans un projet partagé, seul le serveur attribue les clés (spec G §5, décision 6). Cette tâche rend la clé nullable, ajoute le compteur provisoire `pendingSeq` et l'étiquette `KIB-…`, sans rien changer pour un projet local : l'allocateur par défaut reste `local` et `createTicket` s'y comporte exactement comme en v0.6.

Pour éviter que chaque composant doive connaître la clé du projet, `TicketView` gagne `keyLabel` (calculé par `readProject`) : l'affichage lit `keyLabel`, jamais `key`.

**Files:**
- Modify: `packages/schema/src/ticket.ts` (clé nullable, `pendingSeq`, refine, `ticketKeyLabel`)
- Modify: `packages/schema/src/rpc.ts` (`TicketView.keyLabel`, `ProjectSnapshot.nextTicketKey: string | null`, `ProjectSnapshot.sync`)
- Create: `packages/schema/src/ticket-key.test.ts`
- Create: `packages/core/src/keys.ts` (partie client : `getKeyAllocator`, `nextPendingSeq`, `localSyncInfo`)
- Modify: `packages/core/src/tickets.ts` (`createTicket`, `readTicket`)
- Modify: `packages/core/src/project.ts` (`peekTicketKey`)
- Modify: `packages/core/src/links.ts` (`waitingOn` renvoie des étiquettes)
- Modify: `packages/core/src/commands.ts` (`readProject` : `keyLabel`, `sync`)
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/keys.test.ts`
- Modify: `components/kanban/src/KanbanCard.tsx`, `components/kanban/src/Kanban.tsx`, `components/tickets/src/TicketsTree.tsx`, `packages/ui/src/shell/TicketSheet.tsx`, `packages/ui/src/dialogs/NewTicketDialog.tsx`, `packages/ui/src/i18n/fr.ts`
- Modify (fixtures de test seulement, attentes inchangées) : `components/kanban/src/filter.test.ts`, `components/tickets/src/build-tree.test.ts`, `packages/ui/src/dialogs/dialogs.test.tsx`, `packages/ui/src/shell/shell.test.tsx`, `packages/ui/src/shell/screens.test.tsx`, `packages/ui/src/state/use-projects.test.tsx`
- Modify : tout autre usage signalé par `bun run typecheck` (phases 2 à 6 : lancement d'agent, nom de branche, message de commit, mention dans une note)

**Interfaces:**
- Consumes : `KeyAllocator`, `ProjectSyncInfo`, `MemberInfo` de `@kibo/schema` (`sharing.ts`, T1).
- Produces :
  - `Ticket.key: string | null`, `Ticket.pendingSeq: number | null` ; refine `key !== null || pendingSeq !== null`.
  - `ticketKeyLabel(t: { key: string | null }, projectKey: string): string` (« KIB-12 » ou « KIB-… »).
  - `TicketView = Ticket & { progress; waitingOn: string[]; keyLabel: string }` (**ajout** aux Contrats partagés) ; `waitingOn` contient des étiquettes.
  - `ProjectSnapshot.nextTicketKey: string | null` ; `ProjectSnapshot.sync: ProjectSyncInfo`.
  - `getKeyAllocator(doc: LoroDoc): KeyAllocator` ; `nextPendingSeq(doc: LoroDoc): number` ; `localSyncInfo(doc: LoroDoc): ProjectSyncInfo` (**ajout**).

**Note de dépendance.** `KeyAllocator` et `ProjectSyncInfo` viennent de T1 (`sharing.ts`) : T6 ne dépend pas de T4.

**Valeur par défaut de `sync`.** `core` ne connaît ni la connexion ni les rôles : `localSyncInfo` renvoie `{ shared: keyAllocator === "server", keyAllocator, role: null, access: "write", members: [] }`. C'est l'état exact d'un projet non partagé ; pour un projet partagé, le démon remplace cette valeur (rôle, accès, membres) en T21.

- [ ] **Step 1: Écrire les tests de schéma qui échouent**

`packages/schema/src/ticket-key.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { Ticket, ticketKeyLabel } from "./index";

const base = {
  id: "1@1",
  title: "Schéma Loro",
  description: "",
  statusId: "todo" as const,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
};

describe("ticket key", () => {
  test("a ticket with a key and no pending sequence is valid", () => {
    expect(Ticket.safeParse({ ...base, key: "KIB-12", pendingSeq: null }).success).toBe(true);
  });

  test("a ticket waiting for its key needs a pending sequence", () => {
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 3 }).success).toBe(true);
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: null }).success).toBe(false);
  });

  test("the pending sequence is a positive integer", () => {
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 0 }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 1.5 }).success).toBe(false);
  });

  test("the label shows the key, or the project prefix with an ellipsis", () => {
    expect(ticketKeyLabel({ key: "KIB-12" }, "KIB")).toBe("KIB-12");
    expect(ticketKeyLabel({ key: null }, "KIB")).toBe("KIB-…");
  });
});
```

- [ ] **Step 2: Lancer le test**

Run: `bun test packages/schema/src/ticket-key.test.ts`
Expected: FAIL (`ticketKeyLabel` n'est pas exporté, `key: null` refusé).

- [ ] **Step 3: Rendre la clé nullable**

`packages/schema/src/ticket.ts` :
```ts
import { z } from "zod";
import { NodeId, TicketKey } from "./ids";
import { StatusId } from "./status";

export const Assignee = z.object({ kind: z.enum(["human", "agent"]), ref: z.string().min(1) });
export type Assignee = z.infer<typeof Assignee>;

export const Ticket = z
  .object({
    id: NodeId,
    key: TicketKey.nullable(),
    pendingSeq: z.number().int().positive().nullable(),
    title: z.string().trim().min(1),
    description: z.string(),
    statusId: StatusId,
    blockedReason: z.string().nullable(),
    domainId: z.string().nullable(),
    assignee: Assignee.nullable(),
    parentId: NodeId.nullable(),
  })
  .superRefine((t, ctx) => {
    const hasReason = t.blockedReason !== null && t.blockedReason.trim().length > 0;
    if (t.statusId === "blocked" && !hasReason) {
      ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "BLOCKED_REASON_REQUIRED" });
    }
    if (t.statusId !== "blocked" && t.blockedReason !== null) {
      ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "reason only allowed when blocked" });
    }
    if (t.key === null && t.pendingSeq === null) {
      ctx.addIssue({ code: "custom", path: ["key"], message: "a ticket needs a key or a pending sequence" });
    }
  });
export type Ticket = z.infer<typeof Ticket>;

export function ticketKeyLabel(t: { key: string | null }, projectKey: string): string {
  return t.key ?? `${projectKey}-…`;
}
```

Dans `packages/schema/src/rpc.ts`, remplacer les deux types :
```ts
export type TicketView = Ticket & {
  progress: { done: number; total: number };
  waitingOn: string[];
  keyLabel: string;
};
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  instances: Instance[];
  nextTicketKey: string | null;
  sync: ProjectSyncInfo;
};
```
et ajouter `ProjectSyncInfo` à l'import depuis `./sharing`.

- [ ] **Step 4: Relancer le test de schéma**

Run: `bun test packages/schema/src/ticket-key.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Écrire les tests de `core` qui échouent**

`packages/core/src/keys.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  createProjectDoc,
  createTicket,
  getKeyAllocator,
  getTicket,
  listTickets,
  nextPendingSeq,
  peekTicketKey,
  readProject,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function serverAllocated(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Existant" });
  doc.getMap("meta").set("keyAllocator", "server");
  doc.commit();
  return doc;
}

function peerCopy(doc: LoroDoc, peer: number): LoroDoc {
  const copy = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
  copy.setPeerId(peer);
  return copy;
}

describe("local allocator", () => {
  test("is the default and keeps v0.6 behaviour", () => {
    const doc = createProjectDoc(meta);
    expect(getKeyAllocator(doc)).toBe("local");
    const a = createTicket(doc, { title: "A" });
    const b = createTicket(doc, { title: "B" });
    expect([a.key, b.key]).toEqual(["KIB-1", "KIB-2"]);
    expect([a.pendingSeq, b.pendingSeq]).toEqual([null, null]);
    expect(peekTicketKey(doc)).toBe("KIB-3");
  });

  test("readProject exposes an unshared, writable project", () => {
    const snapshot = readProject(createProjectDoc(meta));
    expect(snapshot.sync).toEqual({
      shared: false,
      keyAllocator: "local",
      role: null,
      access: "write",
      members: [],
    });
    expect(snapshot.nextTicketKey).toBe("KIB-1");
  });
});

describe("server allocator", () => {
  test("a new ticket has no key and a pending sequence", () => {
    const doc = peerCopy(serverAllocated(), 11);
    const a = createTicket(doc, { title: "A" });
    const b = createTicket(doc, { title: "B", parentId: a.id });
    expect([a.key, b.key]).toEqual([null, null]);
    expect([a.pendingSeq, b.pendingSeq]).toEqual([1, 2]);
    expect(getTicket(doc, b.id).pendingSeq).toBe(2);
  });

  test("the client never advances meta.ticketSeq", () => {
    const doc = peerCopy(serverAllocated(), 12);
    createTicket(doc, { title: "A" });
    createTicket(doc, { title: "B" });
    expect(doc.getMap("meta").get("ticketSeq")).toBe(1);
  });

  test("each peer counts its own pending tickets", () => {
    const shared = serverAllocated();
    const a = peerCopy(shared, 21);
    const b = peerCopy(shared, 22);
    createTicket(a, { title: "A1" });
    createTicket(a, { title: "A2" });
    b.import(a.export({ mode: "update" }));
    expect(nextPendingSeq(b)).toBe(1);
    expect(createTicket(b, { title: "B1" }).pendingSeq).toBe(1);
    expect(nextPendingSeq(a)).toBe(3);
  });

  test("the snapshot shows labels and no upcoming key", () => {
    const doc = peerCopy(serverAllocated(), 31);
    createTicket(doc, { title: "A" });
    const snapshot = readProject(doc);
    expect(snapshot.nextTicketKey).toBeNull();
    expect(snapshot.sync.keyAllocator).toBe("server");
    expect(snapshot.sync.shared).toBe(true);
    expect(snapshot.tickets.map((t) => t.keyLabel)).toEqual(["KIB-1", "KIB-…"]);
  });

  test("a dependency on a pending ticket is shown with its label", () => {
    const doc = peerCopy(serverAllocated(), 41);
    const [existing] = listTickets(doc);
    const pending = createTicket(doc, { title: "Nouveau" });
    doc.getMap("links").set("l1", { id: "l1", from: pending.id, to: existing?.id ?? "", type: "blocks" });
    doc.commit();
    const view = readProject(doc).tickets.find((t) => t.id === existing?.id);
    expect(view?.waitingOn).toEqual(["KIB-…"]);
  });
});
```

- [ ] **Step 6: Lancer le test**

Run: `bun test packages/core/src/keys.test.ts`
Expected: FAIL (`getKeyAllocator` et `nextPendingSeq` introuvables).

- [ ] **Step 7: Implémenter la partie client de `keys.ts`**

`packages/core/src/keys.ts` :
```ts
import type { KeyAllocator, ProjectSyncInfo } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { walkDepthFirst } from "./tree";

export function getKeyAllocator(doc: LoroDoc): KeyAllocator {
  return doc.getMap("meta").get("keyAllocator") === "server" ? "server" : "local";
}

export function nextPendingSeq(doc: LoroDoc): number {
  const suffix = `@${doc.peerIdStr}`;
  let max = 0;
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    if (!node.id.endsWith(suffix)) continue;
    const seq = node.data.get("pendingSeq");
    if (typeof seq === "number" && seq > max) max = seq;
  }
  return max + 1;
}

export function localSyncInfo(doc: LoroDoc): ProjectSyncInfo {
  const keyAllocator = getKeyAllocator(doc);
  return { shared: keyAllocator === "server", keyAllocator, role: null, access: "write", members: [] };
}
```

Dans `packages/core/src/tickets.ts`, remplacer `readTicket` et `createTicket` :
```ts
function readTicket(n: LoroTreeNode): Ticket {
  const d = n.data;
  const text = d.get("description");
  return {
    id: n.id,
    key: (d.get("key") as string | null | undefined) ?? null,
    pendingSeq: (d.get("pendingSeq") as number | null | undefined) ?? null,
    title: d.get("title") as string,
    description: text instanceof LoroText ? text.toString() : "",
    statusId: d.get("statusId") as StatusId,
    blockedReason: (d.get("blockedReason") as string | null | undefined) ?? null,
    domainId: (d.get("domainId") as string | null | undefined) ?? null,
    assignee: (d.get("assignee") as Assignee | null | undefined) ?? null,
    parentId: n.parent()?.id ?? null,
  };
}

export function createTicket(doc: LoroDoc, input: NewTicket): Ticket {
  if (input.statusId === "blocked") {
    throw new KiboError("BLOCKED_REASON_REQUIRED", "create the ticket first, then block it with a reason");
  }
  const title = cleanTitle(input.title);
  const parent = input.parentId ? getNode(tree(doc), input.parentId) : undefined;
  const serverKeys = getKeyAllocator(doc) === "server";
  const pendingSeq = serverKeys ? nextPendingSeq(doc) : null;
  const key = serverKeys ? null : formatTicketKey(getProjectMeta(doc).key, nextTicketSeq(doc));
  const node = parent ? parent.createNode() : tree(doc).createNode();
  node.data.set("key", key);
  node.data.set("pendingSeq", pendingSeq);
  node.data.set("title", title);
  node.data.set("statusId", input.statusId ?? "todo");
  node.data.set("blockedReason", null);
  node.data.set("domainId", input.domainId ?? null);
  node.data.set("assignee", input.assignee ?? null);
  writeDescription(node, input.description ?? "");
  doc.commit();
  return readTicket(node);
}
```
avec `import { getKeyAllocator, nextPendingSeq } from "./keys";`.

Dans `packages/core/src/project.ts`, `peekTicketKey` devient :
```ts
export function peekTicketKey(doc: LoroDoc): string | null {
  if (doc.getMap("meta").get("keyAllocator") === "server") return null;
  return formatTicketKey(getProjectMeta(doc).key, upcomingSeq(doc));
}
```
(lecture directe de la map pour ne pas créer d'import circulaire `project` ↔ `keys` ↔ `tickets`).

Dans `packages/core/src/links.ts`, `waitingOn` :
```ts
export function waitingOn(doc: LoroDoc, ticketId: string): string[] {
  const tickets = doc.getTree("tickets");
  const projectKey = doc.getMap("meta").get("key") as string;
  return listLinks(doc)
    .filter((l) => l.type === "blocks" && l.to === ticketId)
    .map((l) => getNode(tickets, l.from).data)
    .filter((data) => data.get("statusId") !== "done")
    .map((data) => ticketKeyLabel({ key: (data.get("key") as string | null | undefined) ?? null }, projectKey));
}
```
avec `ticketKeyLabel` importé de `@kibo/schema`.

Dans `packages/core/src/commands.ts`, `readProject` :
```ts
export function readProject(doc: LoroDoc): ProjectSnapshot {
  const meta = getProjectMeta(doc);
  return {
    meta,
    workflow: getWorkflow(doc),
    pages: listPages(doc),
    tickets: listTickets(doc).map((t) => ({
      ...t,
      progress: childProgress(doc, t.id),
      waitingOn: waitingOn(doc, t.id),
      keyLabel: ticketKeyLabel(t, meta.key),
    })),
    links: listLinks(doc),
    instances: listInstances(doc),
    nextTicketKey: peekTicketKey(doc),
    sync: localSyncInfo(doc),
  };
}
```
et `export * from "./keys";` dans `packages/core/src/index.ts`.

- [ ] **Step 8: Relancer les tests de `core`**

Run: `bun test packages/core`
Expected: PASS, y compris `tickets.test.ts`, `project.test.ts` et `commands.test.ts` inchangés.

- [ ] **Step 9: Écrire le test UI qui échoue (sous-titre de Nouveau ticket)**

Ajouter à `packages/ui/src/dialogs/dialogs.test.tsx`, après le test existant qui vérifie `KIB-30` :
```ts
test("NewTicketDialog explains that the key comes with the next sync", () => {
  render(
    <NewTicketDialog project={{ ...project, nextTicketKey: null }} viewer="adam" defaults={{}} onClose={() => {}} />,
  );
  expect(screen.getByText("Kibo · la clé sera attribuée à la prochaine synchronisation.")).toBeTruthy();
});
```
Dans le même fichier, compléter la fixture `project` avec `sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] }` ; faire de même dans `shell.test.tsx`, `screens.test.tsx` et `use-projects.test.tsx`.

Run: `bun test packages/ui/src/dialogs/dialogs.test.tsx`
Expected: FAIL (`fr.newTicket.keyPending` n'existe pas).

- [ ] **Step 10: Propager `keyLabel` et le sous-titre**

`packages/ui/src/i18n/fr.ts`, dans `newTicket` :
```ts
    keyPending: (project: string) => `${project} · la clé sera attribuée à la prochaine synchronisation.`,
```
`packages/ui/src/dialogs/NewTicketDialog.tsx` :
```tsx
            <DialogDescription>
              {project.nextTicketKey === null
                ? fr.newTicket.keyPending(project.meta.name)
                : fr.newTicket.subtitle(project.meta.name, project.nextTicketKey)}
            </DialogDescription>
```
et `{parent.key}` devient `{parent.keyLabel}`.

`packages/ui/src/shell/TicketSheet.tsx` : `{t.key}` ⇒ `{t.keyLabel}` et `{c.key}` ⇒ `{c.keyLabel}`.

`components/kanban/src/KanbanCard.tsx` : `{t.key}` ⇒ `{t.keyLabel}` et `fr.actions(t.key)` ⇒ `fr.actions(t.keyLabel)`. `components/kanban/src/Kanban.tsx` : `fr.moveFailed(t.key)` ⇒ `fr.moveFailed(t.keyLabel)` et `ticketKey={blocking.key}` ⇒ `ticketKey={blocking.keyLabel}`.

`components/tickets/src/TicketsTree.tsx` : les quatre usages `t.key` (`fr.collapse`, `fr.expand`, l'affichage, `fr.newSubTicket`) ⇒ `t.keyLabel`.

Fixtures : dans `components/kanban/src/filter.test.ts` et `components/tickets/src/build-tree.test.ts`, la fabrique `t(...)` ajoute `pendingSeq: null` et `keyLabel: <même valeur que key>` ; les attentes ne changent pas.

- [ ] **Step 11: Garde des actions dérivées de la clé côté démon**

Lancer `bun run typecheck` et corriger chaque usage restant de `ticket.key` selon la règle :
- **affichage** (UI, composants, textes, `brief.md`) ⇒ `keyLabel` ou `ticketKeyLabel(t, projectKey)` ;
- **action dérivée de la clé** côté démon (nom de branche de run, message de commit pré-rempli, lancement d'un agent, mention de clé dans une note) ⇒ garde en tête de la fonction :
```ts
if (ticket.key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
```
Hypothèse v0.6 (vérifiée en T0) : ces actions passent par `startRun(ticket)` (phase 2), `defaultCommitMessage(ticket)` et `branchNameFor(ticket)` (phase 3) ; la tâche 0 donne les noms réels. Pour chacune, ajouter à côté de ses tests existants un test du modèle suivant (adapter l'appel) :
```ts
test("refuses a ticket that has no key yet", async () => {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  doc.getMap("meta").set("keyAllocator", "server");
  doc.commit();
  const ticket = createTicket(doc, { title: "Sans clé" });
  expect(() => branchNameFor(ticket)).toThrow("INVALID_INPUT");
});
```
(`await expect(startRun(...)).rejects.toThrow("INVALID_INPUT")` pour une fonction asynchrone).

Run: `bun run typecheck`
Expected: aucune erreur.

- [ ] **Step 12: Suite complète**

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS, aucune attente de test existante modifiée (seules les fixtures `TicketView` et `ProjectSnapshot` gagnent `pendingSeq`, `keyLabel` et `sync`).

- [ ] **Step 13: Commit**

```bash
git add packages/schema/src/ticket.ts packages/schema/src/rpc.ts packages/schema/src/ticket-key.test.ts \
  packages/core/src/keys.ts packages/core/src/keys.test.ts packages/core/src/tickets.ts packages/core/src/project.ts \
  packages/core/src/links.ts packages/core/src/commands.ts packages/core/src/index.ts \
  components/kanban/src/KanbanCard.tsx components/kanban/src/Kanban.tsx components/kanban/src/filter.test.ts \
  components/tickets/src/TicketsTree.tsx components/tickets/src/build-tree.test.ts \
  packages/ui/src/shell/TicketSheet.tsx packages/ui/src/dialogs/NewTicketDialog.tsx packages/ui/src/i18n/fr.ts \
  packages/ui/src/dialogs/dialogs.test.tsx packages/ui/src/shell/shell.test.tsx packages/ui/src/shell/screens.test.tsx \
  packages/ui/src/state/use-projects.test.tsx
git commit -m "feat(core): clé provisoire des tickets"
```
Ajouter à `git add` chaque fichier des phases 2 à 6 modifié à l'étape 11 (liste donnée par `git status`, fichier par fichier).

---

### Task 7: Attribution serveur et validation des mises à jour

Fonctions pures de `core` que seul le serveur appelle (spec G §5, points 2, 4 et 5) : attribuer les clés des tickets en attente dans un ordre déterministe, refuser toute mise à jour cliente qui touche un champ réservé au serveur, et préparer un doc local à son premier partage (spec G §3.3). Tâche à risque : relue aussi par `kibo-lead`.

**Ordre d'attribution** (décision 6) : (Lamport de l'opération qui a créé le nœud, id du nœud). Le Lamport d'une opération se déduit du `Change` qui la contient : `change.lamport + (id.counter - change.counter)`. Deux répliques qui ont les mêmes opérations calculent donc le même ordre, quel que soit l'ordre d'import.

**Validation** : on compare deux états, `before` (doc serveur) et `after` (fork du serveur où l'on a importé la mise à jour cliente). Un client ne peut ni changer `meta.ticketSeq`, `meta.keyAllocator`, `meta.members`, ni écrire une clé sur un ticket qui n'en avait pas, ni modifier ou effacer une clé attribuée. Le contrôle porte sur **tous** les nœuds, supprimés compris (`getNodes({ withDeleted: true })`) : un déplacement concurrent peut ressusciter un ticket supprimé, qui réapparaît alors avec sa clé déjà attribuée ; sans cela, ce déplacement légitime serait refusé comme une « clé écrite par un client ». Hypothèse (vérifiée par le test « resurrected ») : `node.data` reste lisible sur un nœud supprimé.

**Files:**
- Modify: `packages/core/src/keys.ts` (partie serveur)
- Create: `packages/core/src/validate-update.ts`
- Create: `packages/core/src/share-migration.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/server-keys.test.ts`, `packages/core/src/validate-update.test.ts`, `packages/core/src/share-migration.test.ts`

**Interfaces:**
- Consumes (T6) : `getKeyAllocator(doc)`, `nextPendingSeq(doc)`, `Ticket.key: string | null` ; (v0.1) `createProjectDoc`, `createTicket`, `updateTicket`, `setStatus`, `moveTicket`, `deleteTicket`, `addLink`, `addPage`, `listTickets`, `getTicket`, `walkDepthFirst`, `getNode`.
- Produces (Contrats partagés) :
  - `ticketCreationLamport(doc: LoroDoc, ticketId: string): number`
  - `pendingTicketOrder(doc: LoroDoc): string[]`
  - `allocateTicketKeys(doc: LoroDoc): { ticketId: string; key: string }[]`
  - `enableServerAllocation(doc: LoroDoc): number`
  - `writeMembers(doc: LoroDoc, members: { userId: string; name: string }[]): void`
  - `readMembers(doc: LoroDoc): { userId: string; name: string }[]` (trié par `userId`)
  - `type UpdateVerdict = { ok: true } | { ok: false; reason: string }` ; `validateProjectUpdate(before: LoroDoc, after: LoroDoc): UpdateVerdict`
  - `type ShareMigrationInput` ; `migrateForSharing(doc: LoroDoc, input: ShareMigrationInput): { folder: string | null }`

Hypothèse v0.6 (vérifiée en T0) : une liaison (spec F §3.2) est stockée comme valeur JSON simple dans la map `bindings` du doc projet (`bindings.set(id, binding)`), pas comme conteneur `LoroMap`. Si c'est un conteneur, `migrateForSharing` écrit `runner` et `createdBy` dans le conteneur au lieu de remplacer la valeur.

- [ ] **Step 1: Écrire les tests d'attribution qui échouent**

`packages/core/src/server-keys.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  deleteTicket,
  enableServerAllocation,
  getKeyAllocator,
  getTicket,
  listTickets,
  pendingTicketOrder,
  readMembers,
  ticketCreationLamport,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Existant" });
  enableServerAllocation(doc);
  return doc;
}

function replica(doc: LoroDoc, peer: number): LoroDoc {
  const copy = new LoroDoc();
  copy.setPeerId(peer);
  copy.import(doc.export({ mode: "update" }));
  return copy;
}

describe("enableServerAllocation", () => {
  test("switches the allocator and returns the current sequence", () => {
    const doc = createProjectDoc(meta);
    createTicket(doc, { title: "A" });
    createTicket(doc, { title: "B" });
    expect(enableServerAllocation(doc)).toBe(2);
    expect(getKeyAllocator(doc)).toBe("server");
  });
});

describe("allocateTicketKeys", () => {
  test("continues from meta.ticketSeq", () => {
    const server = sharedServer();
    const client = replica(server, 7);
    const a = createTicket(client, { title: "A" });
    const b = createTicket(client, { title: "B" });
    server.import(client.export({ mode: "update" }));
    expect(allocateTicketKeys(server)).toEqual([
      { ticketId: a.id, key: "KIB-2" },
      { ticketId: b.id, key: "KIB-3" },
    ]);
    expect(server.getMap("meta").get("ticketSeq")).toBe(3);
    expect(getTicket(server, b.id).key).toBe("KIB-3");
    expect(allocateTicketKeys(server)).toEqual([]);
  });

  test("orders by creation Lamport, then by id", () => {
    const server = sharedServer();
    const a = replica(server, 101);
    const b = replica(server, 202);
    const ta = createTicket(a, { title: "A" });
    const tb = createTicket(b, { title: "B" });
    b.import(a.export({ mode: "update" }));
    const tc = createTicket(b, { title: "C" });
    server.import(a.export({ mode: "update" }));
    server.import(b.export({ mode: "update" }));
    expect(ticketCreationLamport(server, ta.id)).toBe(ticketCreationLamport(server, tb.id));
    expect(ticketCreationLamport(server, tc.id)).toBeGreaterThan(ticketCreationLamport(server, ta.id));
    const first = [ta.id, tb.id].sort();
    expect(pendingTicketOrder(server)).toEqual([...first, tc.id]);
  });

  test("is deterministic whatever the import order", () => {
    const base = sharedServer();
    const a = replica(base, 11);
    const b = replica(base, 12);
    createTicket(a, { title: "A1" });
    createTicket(b, { title: "B1" });
    createTicket(a, { title: "A2" });
    const one = replica(base, 21);
    one.import(a.export({ mode: "update" }));
    one.import(b.export({ mode: "update" }));
    const two = replica(base, 22);
    two.import(b.export({ mode: "update" }));
    two.import(a.export({ mode: "update" }));
    expect(allocateTicketKeys(one)).toEqual(allocateTicketKeys(two));
  });

  test("skips a sub-ticket whose parent was deleted concurrently", () => {
    const server = sharedServer();
    const [parent] = listTickets(server);
    const a = replica(server, 31);
    const b = replica(server, 32);
    createTicket(a, { title: "Enfant", parentId: parent?.id ?? null });
    deleteTicket(b, parent?.id ?? "");
    server.import(a.export({ mode: "update" }));
    server.import(b.export({ mode: "update" }));
    expect(allocateTicketKeys(server)).toEqual([]);
    expect(server.getMap("meta").get("ticketSeq")).toBe(1);
  });
});

describe("members", () => {
  test("writes, updates and removes the display directory", () => {
    const doc = sharedServer();
    writeMembers(doc, [
      { userId: "u-lea", name: "Léa" },
      { userId: "u-adam", name: "Adam" },
    ]);
    expect(readMembers(doc)).toEqual([
      { userId: "u-adam", name: "Adam" },
      { userId: "u-lea", name: "Léa" },
    ]);
    writeMembers(doc, [{ userId: "u-adam", name: "Adam B." }]);
    expect(readMembers(doc)).toEqual([{ userId: "u-adam", name: "Adam B." }]);
  });

  test("a project without directory has no members", () => {
    expect(readMembers(createProjectDoc(meta))).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test**

Run: `bun test packages/core/src/server-keys.test.ts`
Expected: FAIL (`allocateTicketKeys` introuvable).

- [ ] **Step 3: Implémenter la partie serveur de `keys.ts`**

Ajouter à `packages/core/src/keys.ts` (les imports existants de T6 sont complétés) :
```ts
import { formatTicketKey, type KeyAllocator, type ProjectSyncInfo } from "@kibo/schema";
import { idStrToId, type LoroDoc, LoroMap, type TreeID } from "loro-crdt";
import { getNode, walkDepthFirst } from "./tree";

const SERVER_ORIGIN = "kibo-server";

export function ticketCreationLamport(doc: LoroDoc, ticketId: string): number {
  const id = idStrToId(ticketId as TreeID);
  const change = doc.getChangeAt(id);
  return change.lamport + (id.counter - change.counter);
}

export function pendingTicketOrder(doc: LoroDoc): string[] {
  return walkDepthFirst(doc.getTree("tickets"))
    .filter((node) => ((node.data.get("key") as string | null | undefined) ?? null) === null)
    .map((node) => ({ id: node.id, lamport: ticketCreationLamport(doc, node.id) }))
    .sort((a, b) => a.lamport - b.lamport || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((entry) => entry.id);
}

export function allocateTicketKeys(doc: LoroDoc): { ticketId: string; key: string }[] {
  const order = pendingTicketOrder(doc);
  if (order.length === 0) return [];
  const meta = doc.getMap("meta");
  const projectKey = meta.get("key") as string;
  const tickets = doc.getTree("tickets");
  let seq = (meta.get("ticketSeq") as number | undefined) ?? 0;
  const allocated: { ticketId: string; key: string }[] = [];
  for (const ticketId of order) {
    seq += 1;
    const key = formatTicketKey(projectKey, seq);
    getNode(tickets, ticketId).data.set("key", key);
    allocated.push({ ticketId, key });
  }
  meta.set("ticketSeq", seq);
  doc.commit({ origin: SERVER_ORIGIN });
  return allocated;
}

export function enableServerAllocation(doc: LoroDoc): number {
  const meta = doc.getMap("meta");
  meta.set("keyAllocator", "server");
  doc.commit({ origin: SERVER_ORIGIN });
  return (meta.get("ticketSeq") as number | undefined) ?? 0;
}

export function writeMembers(doc: LoroDoc, members: { userId: string; name: string }[]): void {
  const directory = doc.getMap("meta").getOrCreateContainer("members", new LoroMap());
  const wanted = new Map(members.map((m) => [m.userId, m.name]));
  for (const userId of directory.keys()) if (!wanted.has(userId)) directory.delete(userId);
  for (const [userId, name] of wanted) {
    const current = directory.get(userId) as { name: string } | undefined;
    if (current?.name !== name) directory.set(userId, { name });
  }
  doc.commit({ origin: SERVER_ORIGIN });
}

export function readMembers(doc: LoroDoc): { userId: string; name: string }[] {
  const directory = doc.getMap("meta").get("members");
  if (!(directory instanceof LoroMap)) return [];
  return Object.entries(directory.toJSON() as Record<string, { name: string }>)
    .map(([userId, entry]) => ({ userId, name: entry.name }))
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}
```
Le cast `ticketId as TreeID` est justifié : les ids de ticket sont les `TreeID` Loro (`counter@peer`), produits par `createNode`.

- [ ] **Step 4: Relancer le test**

Run: `bun test packages/core/src/server-keys.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Écrire les tests de validation qui échouent**

`packages/core/src/validate-update.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import {
  addLink,
  addPage,
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  deleteTicket,
  enableServerAllocation,
  listTickets,
  moveTicket,
  setStatus,
  type UpdateVerdict,
  updateTicket,
  validateProjectUpdate,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Noyau" });
  createTicket(doc, { title: "Schéma" });
  enableServerAllocation(doc);
  writeMembers(doc, [{ userId: "u-adam", name: "Adam" }]);
  return doc;
}

function clientOf(server: LoroDoc): LoroDoc {
  const client = new LoroDoc();
  client.import(server.export({ mode: "update" }));
  return client;
}

function verdictFor(server: LoroDoc, edit: (client: LoroDoc) => void): UpdateVerdict {
  const client = clientOf(server);
  edit(client);
  const after = server.fork();
  after.import(client.export({ mode: "update", from: server.oplogVersion() }));
  return validateProjectUpdate(server, after);
}

const firstTicketNode = (doc: LoroDoc) => {
  const [first] = doc.getTree("tickets").roots();
  if (!first) throw new Error("fixture has no ticket");
  return first;
};

describe("refused updates", () => {
  test("a new ticket written with a key", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const node = c.getTree("tickets").createNode();
      node.data.set("key", "KIB-99");
      node.data.set("pendingSeq", null);
      node.data.set("title", "Forgé");
      node.data.set("statusId", "todo");
      c.commit();
    });
    expect(verdict.ok).toBe(false);
  });

  test("an assigned key rewritten", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      firstTicketNode(c).data.set("key", "KIB-42");
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("KIB-1") });
  });

  test("an assigned key reset to null", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      firstTicketNode(c).data.set("key", null);
      c.commit();
    });
    expect(verdict.ok).toBe(false);
  });

  test("meta.ticketSeq written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("ticketSeq", 10);
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("ticketSeq") });
  });

  test("meta.keyAllocator written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("keyAllocator", "local");
      c.commit();
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("keyAllocator") });
  });

  test("meta.members written by a client", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      writeMembers(c, [
        { userId: "u-adam", name: "Adam" },
        { userId: "u-mallory", name: "Mallory" },
      ]);
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });
});

describe("accepted updates", () => {
  test("ordinary edits of tickets, links and pages", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const [a, b] = listTickets(c);
      if (!a || !b) throw new Error("fixture has two tickets");
      updateTicket(c, a.id, { title: "Noyau de données" });
      setStatus(c, b.id, "blocked", "Attente client");
      moveTicket(c, b.id, a.id);
      addLink(c, { from: a.id, to: b.id, type: "relates" });
      addPage(c, { title: "Kanban", kind: "view" });
    });
    expect(verdict).toEqual({ ok: true });
  });

  test("a concurrent move that resurrects a deleted ticket is resurrected with its key", () => {
    const server = sharedServer();
    const stale = clientOf(server);
    const deleter = clientOf(server);
    const [a, b] = listTickets(deleter);
    if (!a || !b) throw new Error("fixture has two tickets");
    deleteTicket(deleter, b.id);
    server.import(deleter.export({ mode: "update", from: server.oplogVersion() }));
    updateTicket(stale, a.id, { title: "Noyau 1" });
    updateTicket(stale, a.id, { title: "Noyau 2" });
    moveTicket(stale, b.id, a.id);
    const after = server.fork();
    after.import(stale.export({ mode: "update", from: server.oplogVersion() }));
    expect(validateProjectUpdate(server, after)).toEqual({ ok: true });
  });

  test("a new ticket without key", () => {
    expect(verdictFor(sharedServer(), (c) => createTicket(c, { title: "Nouveau" }))).toEqual({ ok: true });
  });

  test("a concurrent title edit of a ticket the server just numbered", () => {
    const server = sharedServer();
    const client = clientOf(server);
    const pending = createTicket(client, { title: "Brouillon" });
    const pushed = client.export({ mode: "update", from: server.oplogVersion() });
    const beforeFirstPush = server.oplogVersion();
    server.import(pushed);
    allocateTicketKeys(server);
    updateTicket(client, pending.id, { title: "Brouillon relu" });
    const after = server.fork();
    after.import(client.export({ mode: "update", from: beforeFirstPush }));
    expect(validateProjectUpdate(server, after)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 6: Lancer le test**

Run: `bun test packages/core/src/validate-update.test.ts`
Expected: FAIL (`validateProjectUpdate` introuvable).

- [ ] **Step 7: Implémenter `validate-update.ts`**

`packages/core/src/validate-update.ts` :
```ts
import type { LoroDoc } from "loro-crdt";
import { readMembers } from "./keys";

export type UpdateVerdict = { ok: true } | { ok: false; reason: string };

const metaValue = (doc: LoroDoc, key: string): unknown => doc.getMap("meta").get(key) ?? null;

function ticketKeys(doc: LoroDoc): Map<string, string | null> {
  return new Map(
    doc
      .getTree("tickets")
      .getNodes({ withDeleted: true })
      .map((node) => [node.id, (node.data.get("key") as string | null | undefined) ?? null]),
  );
}

export function validateProjectUpdate(before: LoroDoc, after: LoroDoc): UpdateVerdict {
  if (metaValue(before, "ticketSeq") !== metaValue(after, "ticketSeq")) {
    return { ok: false, reason: "meta.ticketSeq is written by the server only" };
  }
  if (metaValue(before, "keyAllocator") !== metaValue(after, "keyAllocator")) {
    return { ok: false, reason: "meta.keyAllocator is written by the server only" };
  }
  if (JSON.stringify(readMembers(before)) !== JSON.stringify(readMembers(after))) {
    return { ok: false, reason: "meta.members is written by the server only" };
  }
  const previous = ticketKeys(before);
  for (const [ticketId, key] of ticketKeys(after)) {
    const assigned = previous.get(ticketId) ?? null;
    if (assigned !== null && key !== assigned) {
      return { ok: false, reason: `ticket ${ticketId}: assigned key ${assigned} cannot change` };
    }
    if (assigned === null && key !== null) {
      return { ok: false, reason: `ticket ${ticketId}: key ${key} can only be assigned by the server` };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 8: Relancer le test**

Run: `bun test packages/core/src/validate-update.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/keys.ts packages/core/src/validate-update.ts packages/core/src/index.ts \
  packages/core/src/server-keys.test.ts packages/core/src/validate-update.test.ts
git commit -m "feat(core): attribution serveur des clés"
```
`packages/core/src/index.ts` gagne `export * from "./validate-update";`.

- [ ] **Step 10: Écrire les tests de migration qui échouent**

`packages/core/src/share-migration.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createProjectDoc, createTicket, getProjectMeta, getTicket, migrateForSharing } from "./index";

const input = {
  localUser: "adam",
  userId: "u-adam",
  domains: [{ id: "core", name: "Core", color: "#0EA5E9", guidelines: "core.md" }],
};

function localProject() {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: "/Users/adam/kibo", color: "#F97316" });
  const mine = createTicket(doc, { title: "Mien", assignee: { kind: "human", ref: "adam" } });
  const lea = createTicket(doc, { title: "Léa", assignee: { kind: "human", ref: "lea" } });
  const agent = createTicket(doc, { title: "Agent", assignee: { kind: "agent", ref: "adam" } });
  doc.getMap("bindings").set("b1", { id: "b1", adapter: "github-issues", createdBy: "adam", runner: "adam" });
  doc.getMap("bindings").set("b2", { id: "b2", adapter: "github-issues", createdBy: "lea", runner: "lea" });
  doc.commit();
  return { doc, mine, lea, agent };
}

test("removes the local folder from the doc and returns it", () => {
  const { doc } = localProject();
  expect(migrateForSharing(doc, input)).toEqual({ folder: "/Users/adam/kibo" });
  expect(doc.getMap("meta").get("folder")).toBeUndefined();
  expect(getProjectMeta(doc).folder).toBeNull();
});

test("rewrites only the local user's human assignments", () => {
  const { doc, mine, lea, agent } = localProject();
  migrateForSharing(doc, input);
  expect(getTicket(doc, mine.id).assignee).toEqual({ kind: "human", ref: "u-adam" });
  expect(getTicket(doc, lea.id).assignee).toEqual({ kind: "human", ref: "lea" });
  expect(getTicket(doc, agent.id).assignee).toEqual({ kind: "agent", ref: "adam" });
});

test("copies the domains into the project", () => {
  const { doc } = localProject();
  migrateForSharing(doc, input);
  expect(doc.getMap("projectDomains").toJSON()).toEqual({
    core: { name: "Core", color: "#0EA5E9", guidelines: "core.md" },
  });
});

test("moves the local user's bindings to the account id", () => {
  const { doc } = localProject();
  migrateForSharing(doc, input);
  expect(doc.getMap("bindings").toJSON()).toEqual({
    b1: { id: "b1", adapter: "github-issues", createdBy: "u-adam", runner: "u-adam" },
    b2: { id: "b2", adapter: "github-issues", createdBy: "lea", runner: "lea" },
  });
});
```

- [ ] **Step 11: Lancer le test**

Run: `bun test packages/core/src/share-migration.test.ts`
Expected: FAIL (`migrateForSharing` introuvable).

- [ ] **Step 12: Implémenter `share-migration.ts`**

`packages/core/src/share-migration.ts` :
```ts
import type { Assignee } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { walkDepthFirst } from "./tree";

export type ShareMigrationInput = {
  localUser: string;
  userId: string;
  domains: { id: string; name: string; color: string; guidelines: string }[];
};

export function migrateForSharing(doc: LoroDoc, input: ShareMigrationInput): { folder: string | null } {
  const meta = doc.getMap("meta");
  const folder = (meta.get("folder") as string | null | undefined) ?? null;
  meta.delete("folder");
  for (const node of walkDepthFirst(doc.getTree("tickets"))) {
    const assignee = node.data.get("assignee") as Assignee | null | undefined;
    if (assignee?.kind === "human" && assignee.ref === input.localUser) {
      node.data.set("assignee", { kind: "human", ref: input.userId });
    }
  }
  const domains = doc.getMap("projectDomains");
  for (const d of input.domains) domains.set(d.id, { name: d.name, color: d.color, guidelines: d.guidelines });
  const bindings = doc.getMap("bindings");
  for (const [id, binding] of Object.entries(bindings.toJSON() as Record<string, Record<string, unknown>>)) {
    const runner = binding.runner === input.localUser ? input.userId : binding.runner;
    const createdBy = binding.createdBy === input.localUser ? input.userId : binding.createdBy;
    if (runner !== binding.runner || createdBy !== binding.createdBy) {
      bindings.set(id, { ...binding, runner, createdBy });
    }
  }
  doc.commit();
  return { folder };
}
```
et `export * from "./share-migration";` dans `packages/core/src/index.ts`.

- [ ] **Step 13: Suite complète**

Run: `bun test packages/core && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add packages/core/src/share-migration.ts packages/core/src/share-migration.test.ts packages/core/src/index.ts
git commit -m "feat(core): migrations du premier partage"
```

---

### Task 8: Isolation OS : détection et arguments

Vague 1, tâche à risque (relue aussi par `kibo-lead`). Spec H §8.1, §8.2 ; décisions 14 et 15. Cette tâche ne touche pas encore au `ProcessHost` (tâche 12) : elle livre des fonctions pures (arguments `bwrap`, profil SBPL) et une détection à dépendances injectées, plus l'installation de bubblewrap en CI Linux.

**Files:**
- Create: `packages/daemon/src/sandbox/detect.ts`, `packages/daemon/src/sandbox/bwrap.ts`, `packages/daemon/src/sandbox/macos.sb.ts`, `packages/daemon/src/sandbox/os-sandbox.ts`, `packages/daemon/src/sandbox/types.ts`
- Test: `packages/daemon/src/sandbox/bwrap.test.ts`, `packages/daemon/src/sandbox/macos.sb.test.ts`, `packages/daemon/src/sandbox/detect.test.ts`, `packages/daemon/src/sandbox/os-sandbox.test.ts`, `packages/daemon/src/sandbox/real-sandbox.test.ts`
- Modify: `.github/workflows/ci.yml` (jobs `test` et `e2e`)

**Interfaces:**
- Consumes: `KiboError` et le code `SANDBOX_UNAVAILABLE` (T1).
- Produces (Contrats partagés, à l'identique) :
  ```ts
  export type SandboxPolicy = { runtime: string; args: string[]; readOnly: { host: string; guest: string }[]; tmpDir: string; env: Record<string, string> };
  export type DetectDeps = { platform: NodeJS.Platform; which(name: string): string | null; run(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> };
  export type SandboxProbe = { kind: "bwrap" | "sandbox-exec" | null; available: boolean; reason: string | null; fix: string | null; bwrapPath: string | null; libs: string[] };
  export function detectSandbox(deps: DetectDeps, runtime: string): Promise<SandboxProbe>;
  export function bwrapArgv(bwrapPath: string, policy: SandboxPolicy, libs: string[]): string[];
  export function macosProfile(policy: SandboxPolicy): string;
  export function sandboxExecArgv(policy: SandboxPolicy): string[];
  export function wrapCommand(probe: SandboxProbe, policy: SandboxPolicy, allowUnsandboxed: boolean): { argv: string[]; env: Record<string, string>; isolated: boolean };
  ```
- Produces (nouveau, signalé) : `export function parseLdd(stdout: string): string[]` (`detect.ts`), `export function realDetectDeps(): DetectDeps` (`detect.ts`), `export const SANDBOX_EXEC = "/usr/bin/sandbox-exec"`, `export const BWRAP_FIX_INSTALL`, `export const BWRAP_FIX_USERNS` (`detect.ts`), `export const EXTRA_RULES: { rule: string; reason: string }[]` (`macos.sb.ts`).

Choix : dans le bac à sable Linux, le runtime est monté en `/kibo/runtime` et les dossiers `readOnly` à leur `guest` ; les bibliothèques de `ldd` sont montées **à leur propre chemin** (le chargeur dynamique les cherche là), rien d'autre de `/usr` (décision 14). Sous macOS, `sandbox-exec` ne remappe pas les chemins : `guest` est ignoré, on autorise `host`.

- [ ] **Step 1: Écrire les types et le test des arguments bubblewrap**

`packages/daemon/src/sandbox/types.ts` :
```ts
export type SandboxPolicy = {
  runtime: string;
  args: string[];
  readOnly: { host: string; guest: string }[];
  tmpDir: string;
  env: Record<string, string>;
};

export type DetectDeps = {
  platform: NodeJS.Platform;
  which(name: string): string | null;
  run(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
};

export type SandboxProbe = {
  kind: "bwrap" | "sandbox-exec" | null;
  available: boolean;
  reason: string | null;
  fix: string | null;
  bwrapPath: string | null;
  libs: string[];
};
```

`packages/daemon/src/sandbox/bwrap.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { bwrapArgv } from "./bwrap";
import type { SandboxPolicy } from "./types";

const policy: SandboxPolicy = {
  runtime: "/opt/kibo/kibo-daemon",
  args: ["component-runtime"],
  readOnly: [{ host: "/home/adam/.kibo/components/store/burndown/0.3.0/3f9a/build", guest: "/kibo/component" }],
  tmpDir: "/tmp/kibo-rt-1",
  env: { KIBO_COMPONENT: "burndown@0.3.0", NODE_CHANNEL_FD: "3" },
};
const libs = ["/lib/x86_64-linux-gnu/libc.so.6", "/lib64/ld-linux-x86-64.so.2"];

describe("bwrapArgv", () => {
  test("builds the exact minimal-binding command line", () => {
    expect(bwrapArgv("/usr/bin/bwrap", policy, libs)).toEqual([
      "/usr/bin/bwrap",
      "--unshare-all",
      "--die-with-parent",
      "--new-session",
      "--cap-drop",
      "ALL",
      "--ro-bind",
      "/opt/kibo/kibo-daemon",
      "/kibo/runtime",
      "--ro-bind",
      "/home/adam/.kibo/components/store/burndown/0.3.0/3f9a/build",
      "/kibo/component",
      "--ro-bind",
      "/lib/x86_64-linux-gnu/libc.so.6",
      "/lib/x86_64-linux-gnu/libc.so.6",
      "--ro-bind",
      "/lib64/ld-linux-x86-64.so.2",
      "/lib64/ld-linux-x86-64.so.2",
      "--ro-bind-try",
      "/etc/ld.so.cache",
      "/etc/ld.so.cache",
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--tmpfs",
      "/tmp",
      "--chdir",
      "/tmp",
      "--clearenv",
      "--setenv",
      "KIBO_COMPONENT",
      "burndown@0.3.0",
      "--setenv",
      "NODE_CHANNEL_FD",
      "3",
      "--",
      "/kibo/runtime",
      "component-runtime",
    ]);
  });

  test("never binds /usr, /home or the root", () => {
    const argv = bwrapArgv("/usr/bin/bwrap", policy, libs);
    const binds = argv.flatMap((a, i) => (a === "--ro-bind" || a === "--bind" ? [argv[i + 1]] : []));
    expect(binds).not.toContain("/usr");
    expect(binds).not.toContain("/");
    expect(binds.some((b) => b === "/home" || b === "/home/adam")).toBe(false);
    expect(argv).not.toContain("--bind");
    expect(argv).not.toContain("--share-net");
  });

  test("deduplicates libraries and refuses relative paths", () => {
    const argv = bwrapArgv("/usr/bin/bwrap", policy, [...libs, libs[0] ?? ""]);
    expect(argv.filter((a) => a === "/lib/x86_64-linux-gnu/libc.so.6")).toHaveLength(2);
    expect(() => bwrapArgv("/usr/bin/bwrap", { ...policy, tmpDir: "tmp" }, libs)).toThrow("INVALID_INPUT");
    expect(() => bwrapArgv("/usr/bin/bwrap", policy, ["libc.so.6"])).toThrow("INVALID_INPUT");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `bun test packages/daemon/src/sandbox/bwrap.test.ts`
Expected: FAIL avec « Cannot find module './bwrap' ».

- [ ] **Step 3: Implémenter `bwrapArgv`**

`packages/daemon/src/sandbox/bwrap.ts` :
```ts
import { isAbsolute } from "node:path";
import { KiboError } from "@kibo/schema";
import type { SandboxPolicy } from "./types";

export const RUNTIME_GUEST = "/kibo/runtime";

const absolute = (path: string, what: string): string => {
  if (!isAbsolute(path)) throw new KiboError("INVALID_INPUT", `${what} must be an absolute path: ${path}`);
  return path;
};

export function bwrapArgv(bwrapPath: string, policy: SandboxPolicy, libs: string[]): string[] {
  absolute(policy.runtime, "runtime");
  absolute(policy.tmpDir, "tmpDir");
  const argv = [
    absolute(bwrapPath, "bwrap"),
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--ro-bind",
    policy.runtime,
    RUNTIME_GUEST,
  ];
  for (const { host, guest } of policy.readOnly) {
    argv.push("--ro-bind", absolute(host, "readOnly host"), absolute(guest, "readOnly guest"));
  }
  for (const lib of [...new Set(libs)]) argv.push("--ro-bind", absolute(lib, "library"), lib);
  argv.push("--ro-bind-try", "/etc/ld.so.cache", "/etc/ld.so.cache");
  argv.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--chdir", "/tmp", "--clearenv");
  for (const [name, value] of Object.entries(policy.env)) argv.push("--setenv", name, value);
  argv.push("--", RUNTIME_GUEST, ...policy.args);
  return argv;
}
```

- [ ] **Step 4: Lancer le test**

Run: `bun test packages/daemon/src/sandbox/bwrap.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Écrire le test du profil macOS**

`packages/daemon/src/sandbox/macos.sb.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { EXTRA_RULES, macosProfile, sandboxExecArgv } from "./macos.sb";
import type { SandboxPolicy } from "./types";

const policy: SandboxPolicy = {
  runtime: "/Applications/Kibo.app/Contents/MacOS/kibo-daemon",
  args: ["component-runtime"],
  readOnly: [{ host: "/Users/adam/.kibo/components/store/burndown/0.3.0/3f9a/build", guest: "/kibo/component" }],
  tmpDir: "/private/var/folders/xy/kibo-rt-1",
  env: { KIBO_COMPONENT: "burndown@0.3.0" },
};

describe("macosProfile", () => {
  const profile = macosProfile(policy);

  test("denies everything by default, network included", () => {
    expect(profile.startsWith("(version 1)\n(deny default)\n")).toBe(true);
    expect(profile).toContain("(deny network*)");
    expect(profile).not.toContain("(allow network");
    expect(profile).not.toContain("(allow default)");
  });

  test("allows exec of the runtime only", () => {
    expect(profile).toContain(`(allow process-exec (literal "${policy.runtime}"))`);
    expect(profile.match(/process-exec/g)).toHaveLength(1);
    expect(profile).not.toContain("process-fork");
  });

  test("reads only the runtime, the component build and system libraries", () => {
    expect(profile).toContain(`(literal "${policy.runtime}")`);
    expect(profile).toContain(`(subpath "${policy.readOnly[0]?.host}")`);
    for (const p of ["/usr/lib", "/System/Library", "/private/var/db/dyld", "/System/Volumes/Preboot/Cryptexes"]) {
      expect(profile).toContain(`(subpath "${p}")`);
    }
    expect(profile).toContain('(literal "/dev/urandom")');
    expect(profile).not.toContain('(subpath "/Users")');
    expect(profile).not.toContain(`(subpath "/Users/adam")`);
  });

  test("writes only in the process temp dir", () => {
    expect(profile).toContain(`(allow file-write* (subpath "${policy.tmpDir}"))`);
    expect(profile.match(/file-write/g)).toHaveLength(1);
  });

  test("emits every extra rule with its reason as a comment line", () => {
    for (const { rule, reason } of EXTRA_RULES) {
      expect(profile).toContain(`; ${reason}\n${rule}`);
    }
  });

  test("refuses paths that could break out of an SBPL string", () => {
    expect(() => macosProfile({ ...policy, tmpDir: '/tmp/a"b' })).toThrow("INVALID_INPUT");
    expect(() => macosProfile({ ...policy, runtime: "/tmp/a\\b" })).toThrow("INVALID_INPUT");
    expect(() => macosProfile({ ...policy, readOnly: [{ host: "relative", guest: "/x" }] })).toThrow("INVALID_INPUT");
  });

  test("sandboxExecArgv runs the runtime under the generated profile", () => {
    expect(sandboxExecArgv(policy)).toEqual([
      "/usr/bin/sandbox-exec",
      "-p",
      profile,
      policy.runtime,
      "component-runtime",
    ]);
  });
});
```

- [ ] **Step 6: Lancer le test pour le voir échouer**

Run: `bun test packages/daemon/src/sandbox/macos.sb.test.ts`
Expected: FAIL avec « Cannot find module './macos.sb' ».

- [ ] **Step 7: Implémenter le profil**

`EXTRA_RULES` démarre avec les deux besoins connus de Bun (fuseaux horaires, configuration système) ; la tâche 12 y ajoute ce que le test `escape` révèle, toujours avec un `reason`.

`packages/daemon/src/sandbox/macos.sb.ts` :
```ts
import { isAbsolute } from "node:path";
import { KiboError } from "@kibo/schema";
import type { SandboxPolicy } from "./types";

export const SANDBOX_EXEC = "/usr/bin/sandbox-exec";

export const EXTRA_RULES: { rule: string; reason: string }[] = [
  {
    rule: '(allow file-read* (subpath "/usr/share/zoneinfo") (subpath "/private/var/db/timezone"))',
    reason: "Bun resolves the local time zone at startup",
  },
  {
    rule: '(allow file-read* (literal "/private/etc/localtime") (subpath "/private/etc/ssl"))',
    reason: "Bun reads the system clock zone and the certificate store while initialising",
  },
];

const SYSTEM_READS = [
  "/usr/lib",
  "/System/Library",
  "/private/var/db/dyld",
  "/System/Volumes/Preboot/Cryptexes",
];

const sbplPath = (path: string, what: string): string => {
  if (!isAbsolute(path)) throw new KiboError("INVALID_INPUT", `${what} must be an absolute path: ${path}`);
  if (path.includes('"') || path.includes("\\")) {
    throw new KiboError("INVALID_INPUT", `${what} contains a forbidden character: ${path}`);
  }
  return path;
};

export function macosProfile(policy: SandboxPolicy): string {
  const runtime = sbplPath(policy.runtime, "runtime");
  const tmp = sbplPath(policy.tmpDir, "tmpDir");
  const reads = [
    `(literal "${runtime}")`,
    ...policy.readOnly.map((r) => `(subpath "${sbplPath(r.host, "readOnly host")}")`),
    ...SYSTEM_READS.map((p) => `(subpath "${p}")`),
    '(literal "/dev/urandom")',
  ];
  const lines = [
    "(version 1)",
    "(deny default)",
    `(allow process-exec (literal "${runtime}"))`,
    `(allow file-read* ${reads.join(" ")})`,
    "(allow file-read-metadata)",
    `(allow file-write* (subpath "${tmp}"))`,
    "(allow sysctl-read)",
    '(allow mach-lookup (global-name "com.apple.system.logger"))',
    ...EXTRA_RULES.flatMap(({ rule, reason }) => [`; ${reason}`, rule]),
    "(deny network*)",
  ];
  return `${lines.join("\n")}\n`;
}

export function sandboxExecArgv(policy: SandboxPolicy): string[] {
  return [SANDBOX_EXEC, "-p", macosProfile(policy), policy.runtime, ...policy.args];
}
```

- [ ] **Step 8: Lancer le test**

Run: `bun test packages/daemon/src/sandbox/macos.sb.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 9: Écrire le test de la détection**

`packages/daemon/src/sandbox/detect.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { BWRAP_FIX_INSTALL, BWRAP_FIX_USERNS, detectSandbox, parseLdd } from "./detect";
import type { DetectDeps } from "./types";

const LDD_UBUNTU = [
  "\tlinux-vdso.so.1 (0x00007ffd4b1f2000)",
  "\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f1c2a200000)",
  "\tlibpthread.so.0 => /lib/x86_64-linux-gnu/libpthread.so.0 (0x00007f1c2a1f0000)",
  "\tlibdl.so.2 => /lib/x86_64-linux-gnu/libdl.so.2 (0x00007f1c2a1e0000)",
  "\tlibm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f1c2a0f0000)",
  "\t/lib64/ld-linux-x86-64.so.2 (0x00007f1c2a4a0000)",
  "",
].join("\n");

type Call = string[];
const fakeDeps = (over: Partial<DetectDeps> & { answers?: Record<string, { code: number; stdout?: string; stderr?: string }> }) => {
  const calls: Call[] = [];
  const deps: DetectDeps = {
    platform: over.platform ?? "linux",
    which: over.which ?? ((name) => (name === "bwrap" ? "/usr/bin/bwrap" : null)),
    run: async (argv) => {
      calls.push(argv);
      const answer = over.answers?.[argv[0] ?? ""] ?? { code: 0 };
      return { code: answer.code, stdout: answer.stdout ?? "", stderr: answer.stderr ?? "" };
    },
  };
  return { deps, calls };
};

describe("parseLdd", () => {
  test("keeps absolute library paths and the loader, drops the vdso", () => {
    expect(parseLdd(LDD_UBUNTU)).toEqual([
      "/lib/x86_64-linux-gnu/libc.so.6",
      "/lib/x86_64-linux-gnu/libpthread.so.0",
      "/lib/x86_64-linux-gnu/libdl.so.2",
      "/lib/x86_64-linux-gnu/libm.so.6",
      "/lib64/ld-linux-x86-64.so.2",
    ]);
  });
  test("recognises the aarch64 loader", () => {
    expect(parseLdd("\t/lib/ld-linux-aarch64.so.1 (0x0000ffff9a1b0000)\n")).toEqual(["/lib/ld-linux-aarch64.so.1"]);
  });
  test("a missing library is an error, never silently skipped", () => {
    expect(() => parseLdd("\tlibfoo.so.1 => not found\n")).toThrow("INVALID_INPUT");
  });
});

describe("detectSandbox on Linux", () => {
  test("bwrap missing: unavailable with the install command", async () => {
    const { deps } = fakeDeps({ which: () => null });
    expect(await detectSandbox(deps, "/opt/kibo/kibo-daemon")).toEqual({
      kind: "bwrap",
      available: false,
      reason: "bubblewrap (bwrap) is not installed",
      fix: BWRAP_FIX_INSTALL,
      bwrapPath: null,
      libs: [],
    });
  });

  test("bwrap present but user namespaces forbidden: real probe fails, sysctl fix", async () => {
    const { deps, calls } = fakeDeps({
      answers: { "/usr/bin/bwrap": { code: 1, stderr: "bwrap: setting up uid map: Permission denied" } },
    });
    const probe = await detectSandbox(deps, "/opt/kibo/kibo-daemon");
    expect(calls[0]).toEqual(["/usr/bin/bwrap", "--unshare-all", "--die-with-parent", "--ro-bind", "/", "/", "true"]);
    expect(probe.available).toBe(false);
    expect(probe.fix).toBe(BWRAP_FIX_USERNS);
    expect(probe.reason).toContain("setting up uid map");
  });

  test("any other probe failure is reported without a guessed fix", async () => {
    const { deps } = fakeDeps({ answers: { "/usr/bin/bwrap": { code: 1, stderr: "bwrap: unknown option" } } });
    const probe = await detectSandbox(deps, "/opt/kibo/kibo-daemon");
    expect(probe).toMatchObject({ available: false, fix: null, reason: "bwrap probe failed: bwrap: unknown option" });
  });

  test("probe ok: available with the runtime libraries from ldd", async () => {
    const { deps, calls } = fakeDeps({ answers: { ldd: { code: 0, stdout: LDD_UBUNTU } } });
    const probe = await detectSandbox(deps, "/opt/kibo/kibo-daemon");
    expect(calls[1]).toEqual(["ldd", "/opt/kibo/kibo-daemon"]);
    expect(probe).toMatchObject({ kind: "bwrap", available: true, bwrapPath: "/usr/bin/bwrap", reason: null });
    expect(probe.libs).toContain("/lib64/ld-linux-x86-64.so.2");
  });

  test("ldd failure makes the sandbox unavailable", async () => {
    const { deps } = fakeDeps({ answers: { ldd: { code: 1, stderr: "not a dynamic executable" } } });
    expect(await detectSandbox(deps, "/opt/kibo/kibo-daemon")).toMatchObject({
      available: false,
      reason: "ldd failed on /opt/kibo/kibo-daemon: not a dynamic executable",
    });
  });
});

describe("detectSandbox on macOS and elsewhere", () => {
  test("sandbox-exec probe ok", async () => {
    const { deps, calls } = fakeDeps({ platform: "darwin" });
    const probe = await detectSandbox(deps, "/Applications/Kibo.app/Contents/MacOS/kibo-daemon");
    expect(calls[0]).toEqual(["/usr/bin/sandbox-exec", "-p", "(version 1)(allow default)", "/usr/bin/true"]);
    expect(probe).toEqual({ kind: "sandbox-exec", available: true, reason: null, fix: null, bwrapPath: null, libs: [] });
  });
  test("sandbox-exec failing is unavailable", async () => {
    const { deps } = fakeDeps({ platform: "darwin", answers: { "/usr/bin/sandbox-exec": { code: 71, stderr: "sandbox_apply: Operation not permitted" } } });
    expect(await detectSandbox(deps, "/x")).toMatchObject({ kind: "sandbox-exec", available: false });
  });
  test("other platforms are unavailable", async () => {
    const { deps } = fakeDeps({ platform: "win32" });
    expect(await detectSandbox(deps, "/x")).toMatchObject({ kind: null, available: false, reason: "unsupported platform win32" });
  });
});
```

- [ ] **Step 10: Lancer le test pour le voir échouer**

Run: `bun test packages/daemon/src/sandbox/detect.test.ts`
Expected: FAIL avec « Cannot find module './detect' ».

- [ ] **Step 11: Implémenter la détection**

`packages/daemon/src/sandbox/detect.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { SANDBOX_EXEC } from "./macos.sb";
import type { DetectDeps, SandboxProbe } from "./types";

export const BWRAP_FIX_INSTALL = "sudo apt install bubblewrap";
export const BWRAP_FIX_USERNS = "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0";
const USERNS_MARKERS = ["uid map", "Operation not permitted", "Permission denied"];

export { SANDBOX_EXEC };

export function parseLdd(stdout: string): string[] {
  const libs: string[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes("=> not found")) throw new KiboError("INVALID_INPUT", `missing library: ${line}`);
    const arrow = line.match(/=>\s+(\/\S+)/);
    const bare = line.match(/^(\/\S+)/);
    const path = arrow?.[1] ?? bare?.[1];
    if (path) libs.push(path);
  }
  return libs;
}

const unavailable = (kind: SandboxProbe["kind"], reason: string, fix: string | null, bwrapPath: string | null = null): SandboxProbe => ({
  kind,
  available: false,
  reason,
  fix,
  bwrapPath,
  libs: [],
});

async function detectLinux(deps: DetectDeps, runtime: string): Promise<SandboxProbe> {
  const bwrap = deps.which("bwrap");
  if (!bwrap) return unavailable("bwrap", "bubblewrap (bwrap) is not installed", BWRAP_FIX_INSTALL);
  const probe = await deps.run([bwrap, "--unshare-all", "--die-with-parent", "--ro-bind", "/", "/", "true"]);
  if (probe.code !== 0) {
    const stderr = probe.stderr.trim();
    const userns = USERNS_MARKERS.some((m) => stderr.includes(m));
    return unavailable("bwrap", userns ? stderr : `bwrap probe failed: ${stderr}`, userns ? BWRAP_FIX_USERNS : null, bwrap);
  }
  const ldd = await deps.run(["ldd", runtime]);
  if (ldd.code !== 0) return unavailable("bwrap", `ldd failed on ${runtime}: ${ldd.stderr.trim()}`, null, bwrap);
  return { kind: "bwrap", available: true, reason: null, fix: null, bwrapPath: bwrap, libs: parseLdd(ldd.stdout) };
}

async function detectMac(deps: DetectDeps): Promise<SandboxProbe> {
  const probe = await deps.run([SANDBOX_EXEC, "-p", "(version 1)(allow default)", "/usr/bin/true"]);
  if (probe.code !== 0) return unavailable("sandbox-exec", `sandbox-exec probe failed: ${probe.stderr.trim()}`, null);
  return { kind: "sandbox-exec", available: true, reason: null, fix: null, bwrapPath: null, libs: [] };
}

export async function detectSandbox(deps: DetectDeps, runtime: string): Promise<SandboxProbe> {
  if (deps.platform === "linux") return detectLinux(deps, runtime);
  if (deps.platform === "darwin") return detectMac(deps);
  return unavailable(null, `unsupported platform ${deps.platform}`, null);
}

export function realDetectDeps(): DetectDeps {
  return {
    platform: process.platform,
    which: (name) => Bun.which(name),
    run: async (argv) => {
      const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { code, stdout, stderr };
    },
  };
}
```

`Bun.spawn` d'un binaire absent lève une exception : elle remonte telle quelle (`ENOENT` avec le chemin), ce qui est voulu (aucune erreur avalée). Seul `bwrap` est pré-testé par `which`.

- [ ] **Step 12: Lancer le test**

Run: `bun test packages/daemon/src/sandbox/detect.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 13: Écrire le test de `wrapCommand` et le test réel**

`packages/daemon/src/sandbox/os-sandbox.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { wrapCommand } from "./os-sandbox";
import type { SandboxPolicy, SandboxProbe } from "./types";

const policy: SandboxPolicy = {
  runtime: "/opt/kibo/kibo-daemon",
  args: ["component-runtime"],
  readOnly: [],
  tmpDir: "/tmp/kibo-rt-1",
  env: { KIBO_COMPONENT: "burndown@0.3.0" },
};
const off: SandboxProbe = {
  kind: "bwrap",
  available: false,
  reason: "bubblewrap (bwrap) is not installed",
  fix: "sudo apt install bubblewrap",
  bwrapPath: null,
  libs: [],
};

describe("wrapCommand", () => {
  test("refuses to run without isolation by default, with reason and fix", () => {
    expect(() => wrapCommand(off, policy, false)).toThrow(
      "SANDBOX_UNAVAILABLE: bubblewrap (bwrap) is not installed (fix: sudo apt install bubblewrap)",
    );
  });
  test("the explicit setting runs the plain command, marked not isolated", () => {
    expect(wrapCommand(off, policy, true)).toEqual({
      argv: ["/opt/kibo/kibo-daemon", "component-runtime"],
      env: { KIBO_COMPONENT: "burndown@0.3.0" },
      isolated: false,
    });
  });
  test("bwrap: environment passes through --setenv only", () => {
    const probe: SandboxProbe = { ...off, available: true, reason: null, fix: null, bwrapPath: "/usr/bin/bwrap", libs: [] };
    const wrapped = wrapCommand(probe, policy, false);
    expect(wrapped.isolated).toBe(true);
    expect(wrapped.argv[0]).toBe("/usr/bin/bwrap");
    expect(wrapped.env).toEqual({});
  });
  test("sandbox-exec: environment is the policy env only", () => {
    const probe: SandboxProbe = { kind: "sandbox-exec", available: true, reason: null, fix: null, bwrapPath: null, libs: [] };
    const wrapped = wrapCommand(probe, policy, false);
    expect(wrapped.argv.slice(0, 2)).toEqual(["/usr/bin/sandbox-exec", "-p"]);
    expect(wrapped.env).toEqual({ KIBO_COMPONENT: "burndown@0.3.0" });
  });
});
```

`packages/daemon/src/sandbox/real-sandbox.test.ts` (exécute un vrai binaire dans le vrai bac à sable ; sur la CI Linux et macOS il ne peut pas être sauté, `KIBO_REQUIRE_OS_SANDBOX=1`) :
```ts
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectSandbox, realDetectDeps } from "./detect";
import { wrapCommand } from "./os-sandbox";

const deps = realDetectDeps();
const supported = deps.platform === "linux" || deps.platform === "darwin";
const probe = supported ? await detectSandbox(deps, "/usr/bin/true") : null;
const skip = !probe?.available && process.env.KIBO_REQUIRE_OS_SANDBOX !== "1";

test.skipIf(skip)("a wrapped /usr/bin/true runs inside the OS sandbox", async () => {
  if (!probe) throw new Error("unsupported platform");
  expect(probe.available).toBe(true);
  const tmp = mkdtempSync(join(tmpdir(), "kibo-sbx-"));
  const { argv, env } = wrapCommand(probe, { runtime: "/usr/bin/true", args: [], readOnly: [], tmpDir: tmp, env: {} }, false);
  const proc = Bun.spawn(argv, { env, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stderr = await new Response(proc.stderr).text();
  rmSync(tmp, { recursive: true, force: true });
  expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
});
```

- [ ] **Step 14: Lancer les tests pour les voir échouer**

Run: `bun test packages/daemon/src/sandbox/os-sandbox.test.ts packages/daemon/src/sandbox/real-sandbox.test.ts`
Expected: FAIL avec « Cannot find module './os-sandbox' ».

- [ ] **Step 15: Implémenter `wrapCommand`**

`packages/daemon/src/sandbox/os-sandbox.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { bwrapArgv } from "./bwrap";
import { sandboxExecArgv } from "./macos.sb";
import type { SandboxPolicy, SandboxProbe } from "./types";

export type { DetectDeps, SandboxPolicy, SandboxProbe } from "./types";
export { detectSandbox, parseLdd, realDetectDeps } from "./detect";
export { bwrapArgv } from "./bwrap";
export { macosProfile, sandboxExecArgv } from "./macos.sb";

export function wrapCommand(
  probe: SandboxProbe,
  policy: SandboxPolicy,
  allowUnsandboxed: boolean,
): { argv: string[]; env: Record<string, string>; isolated: boolean } {
  if (probe.available && probe.kind === "bwrap" && probe.bwrapPath) {
    return { argv: bwrapArgv(probe.bwrapPath, policy, probe.libs), env: {}, isolated: true };
  }
  if (probe.available && probe.kind === "sandbox-exec") {
    return { argv: sandboxExecArgv(policy), env: { ...policy.env }, isolated: true };
  }
  if (allowUnsandboxed) return { argv: [policy.runtime, ...policy.args], env: { ...policy.env }, isolated: false };
  const fix = probe.fix ? ` (fix: ${probe.fix})` : "";
  throw new KiboError("SANDBOX_UNAVAILABLE", `${probe.reason ?? "no OS sandbox"}${fix}`);
}
```

- [ ] **Step 16: Lancer les tests**

Run: `bun test packages/daemon/src/sandbox`
Expected: PASS ; sur macOS et sur une Linux avec bubblewrap utilisable, le test réel s'exécute et passe ; ailleurs il est sauté (en local seulement).

Si le test réel échoue sous Linux parce que `/usr/bin/true` lié par `ldd` ne démarre pas (bibliothèque chargée par `dlopen` absente de `ldd`), **ne pas élargir en `/usr`** : ajouter la bibliothèque manquante à `libs` dans `detectLinux` à partir du message d'erreur, et le noter pour le chef d'équipe (décision 14, repli).

- [ ] **Step 17: Vérifier le lint et les types, commiter**

Run: `bun run check && bun run typecheck`
Expected: aucun diagnostic.

```bash
git add packages/daemon/src/sandbox/types.ts packages/daemon/src/sandbox/detect.ts packages/daemon/src/sandbox/bwrap.ts packages/daemon/src/sandbox/macos.sb.ts packages/daemon/src/sandbox/os-sandbox.ts packages/daemon/src/sandbox/bwrap.test.ts packages/daemon/src/sandbox/macos.sb.test.ts packages/daemon/src/sandbox/detect.test.ts packages/daemon/src/sandbox/os-sandbox.test.ts packages/daemon/src/sandbox/real-sandbox.test.ts
git commit -m "feat(daemon): détection de l'isolation OS"
```

- [ ] **Step 18: CI Linux avec bubblewrap**

Dans `.github/workflows/ci.yml`, job `test` : ajouter au niveau du job
```yaml
    env:
      KIBO_REQUIRE_OS_SANDBOX: "1"
```
et, juste après `bun install --frozen-lockfile`, dans **les jobs `test` et `e2e`** :
```yaml
      - if: runner.os == 'Linux'
        name: bubblewrap
        run: |
          sudo apt-get update
          sudo apt-get install -y bubblewrap
          if [ "$(sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0; fi
          bwrap --unshare-all --die-with-parent --ro-bind / / true
```
La dernière ligne fait échouer la CI tout de suite si le runner change de politique, au lieu d'un échec obscur dans les tests.

Run: pousser la branche et vérifier le job `test` Linux (étape « bubblewrap » verte, `real-sandbox.test.ts` exécuté, pas sauté).
Expected: CI verte sur macOS et Linux.

```bash
git add .github/workflows/ci.yml
git commit -m "build(ci): bubblewrap sous Linux"
```

---

### Task 9: Sessions d'appairage persistées

Vague 1. Spec G §7 (décision §12 de la spec générale : sessions persistées hachées, 30 jours glissants, révocables, locales comme distantes) ; lève le risque « sessions d'appairage en mémoire » du rapport v0.1. Le cookie contient l'id brut (32 octets hex) ; la base ne contient que son SHA-256.

**Files:**
- Create: `packages/daemon/src/sessions/session-store.ts`, `packages/daemon/src/sessions/device-name.ts`, `packages/daemon/src/sessions/rpc.ts`, `packages/daemon/src/rpc-extensions.ts`
- Modify: `packages/daemon/src/server.ts` (sessions, contexte RPC, WebSocket), `packages/daemon/src/main.ts`, `packages/daemon/src/server.test.ts` (seulement la mise en place `beforeEach` et les `startServer` des autres blocs : ajout de `sessions`), `packages/schema/src/rpc.ts` (si T4 n'a pas encore ajouté `listSessions` / `revokeSession`, les ajouter ici à l'identique de T4)
- Test: `packages/daemon/src/sessions/session-store.test.ts`, `packages/daemon/src/sessions/device-name.test.ts`, `packages/daemon/src/sessions/sessions-http.test.ts`

**Interfaces:**
- Consumes: `Store.db: Database` (T1) ; `SessionInfo`, `RpcRequest` avec `listSessions` / `revokeSession`, `DaemonEvent` `{ type: "sessions" }` (T4).
- Produces (Contrats partagés) : `SESSION_TTL_MS`, `SessionStore`, `openSessionStore(db)`, `RpcContext = { sessionHash: string; remote: boolean }`.
- Produces (nouveau, signalé ; réutilisé par T12, T13, T15, T21, T23, T24) :
  ```ts
  // packages/daemon/src/rpc-extensions.ts
  export type RpcContext = { sessionHash: string; remote: boolean };
  export type RpcExtension = { methods: readonly RpcRequest["method"][]; handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> };
  export type RpcOutcome = { handled: true; result: unknown } | { handled: false };
  export type RpcHandler = (req: RpcRequest, ctx: RpcContext) => Promise<RpcOutcome>;
  export function dispatchRpc(service: Service, extensions: readonly RpcExtension[], req: RpcRequest, ctx: RpcContext, handlers?: readonly RpcHandler[]): Promise<unknown>;
  export function requireLocal(ctx: RpcContext): void;   // FORBIDDEN depuis une session distante (décision 17)
  // packages/daemon/src/sessions/device-name.ts
  export function deviceNameFromUserAgent(ua: string | null): string;
  // packages/daemon/src/sessions/rpc.ts
  export function sessionRpc(store: SessionStore, publish: (e: DaemonEvent) => void, now: () => number): RpcExtension;
  // server.ts : ServerOptions gagne sessions: SessionStore, extensions?: RpcExtension[], handlers?: RpcHandler[], now?: () => number ;
  // règle pour les tâches suivantes : une extension déclare ses méthodes (T12, T13) ; un gestionnaire RpcHandler (T15, T20, T21, T22, T23, T24, T27) répond { handled: false } pour les autres
  //             startServer renvoie en plus publish(event: DaemonEvent): void
  ```
- Hypothèse v0.6 (vérifiée en T0) : `Service.handle(req)` est asynchrone ou synchrone ; `dispatchRpc` fait `await service.handle(req, ctx)` dans les deux cas, et `Service.handle` accepte désormais un second paramètre `ctx: RpcContext` (ignoré par les services existants).
- Hypothèse v0.6 (vérifiée en T0) : le serveur diffuse les événements par `server.publish("changes", JSON.stringify(event))` ; `publish` de cette tâche réutilise ce canal.

- [ ] **Step 1: Écrire le test du magasin de sessions**

`packages/daemon/src/sessions/session-store.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { hashSessionId, openSessionStore, SESSION_TTL_MS, type SessionStore } from "./session-store";

const DAY = 24 * 3600_000;
let db: Database;
let store: SessionStore;

beforeEach(() => {
  db = new Database(":memory:", { strict: true });
  store = openSessionStore(db);
});

describe("session store", () => {
  test("creates a random id and stores only its SHA-256", () => {
    const { id, hash } = store.create({ deviceName: "Chrome · macOS", remote: false }, 1_000);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashSessionId(id));
    expect(hash).not.toBe(id);
    const rows = db.query("SELECT * FROM remote_sessions").all();
    expect(JSON.stringify(rows)).not.toContain(id);
    expect(Buffer.from(db.serialize()).includes(Buffer.from(id))).toBe(false);
  });

  test("validates a known id and refuses an unknown one", () => {
    const { id, hash } = store.create({ deviceName: "Firefox · Linux", remote: true }, 1_000);
    expect(store.validate(id, 2_000)).toEqual({ hash, remote: true });
    expect(store.validate("f".repeat(64), 2_000)).toBeNull();
    expect(store.validate(hash, 2_000)).toBeNull();
  });

  test("expires 30 days after the last activity", () => {
    const { id } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(id, SESSION_TTL_MS - 1)).not.toBeNull();
    const other = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(other.id, SESSION_TTL_MS)).toBeNull();
  });

  test("activity slides the expiry forward", () => {
    const { id } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    expect(store.validate(id, 20 * DAY)).not.toBeNull();
    expect(store.validate(id, 45 * DAY)).not.toBeNull();
    expect(store.validate(id, 45 * DAY + SESSION_TTL_MS)).toBeNull();
  });

  test("writes lastSeenAt at most once a minute", () => {
    const { id, hash } = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    store.validate(id, 30_000);
    const seen = () => (db.query("SELECT lastSeenAt FROM remote_sessions WHERE idHash = $h").get({ h: hash }) as { lastSeenAt: number }).lastSeenAt;
    expect(seen()).toBe(0);
    store.validate(id, 61_000);
    expect(seen()).toBe(61_000);
  });

  test("revocation is immediate, notified, and listed sessions exclude it", () => {
    const a = store.create({ deviceName: "Chrome · macOS", remote: false }, 0);
    const b = store.create({ deviceName: "Application Kibo", remote: false }, 10);
    const revoked: string[] = [];
    store.onRevoke((h) => revoked.push(h));
    store.revoke(a.hash, 100);
    expect(store.validate(a.id, 200)).toBeNull();
    expect(revoked).toEqual([a.hash]);
    expect(store.list(200).map((s) => s.id)).toEqual([b.hash]);
    expect(store.list(200)[0]).toEqual({
      id: b.hash,
      deviceName: "Application Kibo",
      remote: false,
      createdAt: 10,
      lastSeenAt: 10,
      expiresAt: 10 + SESSION_TTL_MS,
    });
  });

  test("revoking an unknown session is a NOT_FOUND error", () => {
    expect(() => store.revoke("0".repeat(64), 1)).toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `bun test packages/daemon/src/sessions/session-store.test.ts`
Expected: FAIL avec « Cannot find module './session-store' ».

- [ ] **Step 3: Implémenter le magasin**

Le hachage est synchrone (`node:crypto`) : `validate` est appelé à chaque requête et doit rester synchrone.

`packages/daemon/src/sessions/session-store.ts` :
```ts
import type { Database } from "bun:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { KiboError, type SessionInfo } from "@kibo/schema";

export const SESSION_TTL_MS = 30 * 24 * 3600_000;
const TOUCH_EVERY_MS = 60_000;

export type SessionStore = {
  create(input: { deviceName: string; remote: boolean }, now: number): { id: string; hash: string };
  validate(id: string, now: number): { hash: string; remote: boolean } | null;
  list(now: number): Omit<SessionInfo, "current">[];
  revoke(hash: string, now: number): void;
  onRevoke(listener: (hash: string) => void): () => void;
};

type Row = {
  idHash: string;
  deviceName: string;
  remote: number;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
};

export function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

export function openSessionStore(db: Database): SessionStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS remote_sessions (idHash TEXT PRIMARY KEY, deviceName TEXT NOT NULL, " +
      "remote INTEGER NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, " +
      "lastSeenAt INTEGER NOT NULL, revokedAt INTEGER)",
  );
  const insert = db.query(
    "INSERT INTO remote_sessions (idHash, deviceName, remote, createdAt, expiresAt, lastSeenAt, revokedAt) " +
      "VALUES ($idHash, $deviceName, $remote, $at, $expiresAt, $at, NULL)",
  );
  const byHash = db.query("SELECT * FROM remote_sessions WHERE idHash = $idHash");
  const touch = db.query("UPDATE remote_sessions SET lastSeenAt = $at, expiresAt = $expiresAt WHERE idHash = $idHash");
  const active = db.query(
    "SELECT * FROM remote_sessions WHERE revokedAt IS NULL AND expiresAt > $now ORDER BY createdAt DESC",
  );
  const markRevoked = db.query("UPDATE remote_sessions SET revokedAt = $at WHERE idHash = $idHash AND revokedAt IS NULL");
  const listeners = new Set<(hash: string) => void>();

  return {
    create({ deviceName, remote }, now) {
      const id = randomBytes(32).toString("hex");
      const hash = hashSessionId(id);
      insert.run({ idHash: hash, deviceName, remote: remote ? 1 : 0, at: now, expiresAt: now + SESSION_TTL_MS });
      return { id, hash };
    },
    validate(id, now) {
      const hash = hashSessionId(id);
      const row = byHash.get({ idHash: hash }) as Row | null;
      if (!row || row.revokedAt !== null || row.expiresAt <= now) return null;
      if (now - row.lastSeenAt >= TOUCH_EVERY_MS) touch.run({ idHash: hash, at: now, expiresAt: now + SESSION_TTL_MS });
      return { hash, remote: row.remote === 1 };
    },
    list(now) {
      return (active.all({ now }) as Row[]).map((r) => ({
        id: r.idHash,
        deviceName: r.deviceName,
        remote: r.remote === 1,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        expiresAt: r.expiresAt,
      }));
    },
    revoke(hash, now) {
      const row = byHash.get({ idHash: hash }) as Row | null;
      if (!row) throw new KiboError("NOT_FOUND", "session not found");
      markRevoked.run({ idHash: hash, at: now });
      for (const l of listeners) l(hash);
    },
    onRevoke(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Lancer le test**

Run: `bun test packages/daemon/src/sessions/session-store.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Écrire le test du nom d'appareil**

`packages/daemon/src/sessions/device-name.test.ts` :
```ts
import { expect, test } from "bun:test";
import { deviceNameFromUserAgent } from "./device-name";

test.each([
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36", "Chrome · macOS"],
  ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Linux"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15", "Safari · macOS"],
  ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Tauri/2.0", "Application Kibo"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile Safari/604.1", "Safari · iOS"],
  ["curl/8.7.1", "Navigateur"],
  [null, "Navigateur"],
])("%s ⇒ %s", (ua, name) => {
  expect(deviceNameFromUserAgent(ua)).toBe(name);
});
```

- [ ] **Step 6: Lancer le test pour le voir échouer, puis implémenter**

Run: `bun test packages/daemon/src/sessions/device-name.test.ts`
Expected: FAIL avec « Cannot find module './device-name' ».

Le nom est un texte d'interface affiché dans Paramètres › Sécurité ; il est calculé côté démon et stocké, d'où le français.

`packages/daemon/src/sessions/device-name.ts` :
```ts
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Android/, "Android"],
  [/Linux|X11/, "Linux"],
  [/Windows/, "Windows"],
];

export function deviceNameFromUserAgent(ua: string | null): string {
  if (!ua) return "Navigateur";
  if (ua.includes("Tauri")) return "Application Kibo";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  if (!browser) return "Navigateur";
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return system ? `${browser} · ${system}` : browser;
}
```

Run: `bun test packages/daemon/src/sessions/device-name.test.ts`
Expected: PASS (7 cas).

- [ ] **Step 7: Écrire le test HTTP (redémarrage, expiration, révocation, `current`)**

`packages/daemon/src/sessions/sessions-http.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo } from "@kibo/schema";
import { startServer } from "../server";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { openSessionStore, SESSION_TTL_MS } from "./session-store";

const TOKEN = "a".repeat(64);
let home: string;
let store: Store;
let clock: number;
let server: ReturnType<typeof startServer>;

const boot = () =>
  startServer({
    service: createService(store, { user: "adam" }),
    sessions: openSessionStore(store.db),
    token: TOKEN,
    port: 0,
    uiDir: null,
    now: () => clock,
  });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-sess-"));
  store = openStore(home);
  clock = 1_000_000;
  server = boot();
});
afterEach(() => {
  server.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url, ...headers },
    body: JSON.stringify(body),
  });

async function pair(userAgent = "Mozilla/5.0 (Macintosh) Chrome/129.0 Safari/537.36"): Promise<string> {
  const res = await post("/api/pair", { token: TOKEN }, { "user-agent": userAgent });
  expect(res.status).toBe(204);
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}
const rpc = (body: unknown, cookie: string) => post("/api/rpc", body, { cookie });

test("a session survives a daemon restart", async () => {
  const cookie = await pair();
  server.stop();
  server = boot();
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
});

test("a session expires after 30 days without activity", async () => {
  const cookie = await pair();
  clock += SESSION_TTL_MS;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(401);
});

test("an active session keeps sliding", async () => {
  const cookie = await pair();
  clock += SESSION_TTL_MS - 60_000;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
  clock += SESSION_TTL_MS - 60_000;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
});

test("listSessions marks the calling session as current", async () => {
  const mine = await pair();
  await pair("Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0");
  const res = (await (await rpc({ method: "listSessions" }, mine)).json()) as { ok: true; result: SessionInfo[] };
  expect(res.result).toHaveLength(2);
  expect(res.result.filter((s) => s.current).map((s) => s.deviceName)).toEqual(["Chrome · macOS"]);
  expect(res.result.map((s) => s.deviceName).sort()).toEqual(["Chrome · macOS", "Firefox · Linux"]);
  expect(res.result.every((s) => s.remote === false)).toBe(true);
});

test("revoking a session refuses its next request and closes its websocket", async () => {
  const admin = await pair();
  const victim = await pair("Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0");
  const ws = new WebSocket(`${server.url.replace("http", "ws")}/api/events`, {
    headers: { origin: server.url, cookie: victim },
  });
  await new Promise((r) => {
    ws.onopen = r;
  });
  const closed = new Promise<number>((r) => {
    ws.onclose = (e) => r(e.code);
  });
  const list = (await (await rpc({ method: "listSessions" }, admin)).json()) as { result: SessionInfo[] };
  const target = list.result.find((s) => !s.current);
  expect(target).toBeDefined();
  const revoked = await rpc({ method: "revokeSession", id: target?.id }, admin);
  expect(await revoked.json()).toEqual({ ok: true, result: null });
  expect(await closed).toBe(4401);
  expect((await rpc({ method: "listProjects" }, victim)).status).toBe(401);
  expect((await rpc({ method: "listProjects" }, admin)).status).toBe(200);
});

test("the database never holds a raw session id", async () => {
  const cookie = await pair();
  const id = cookie.split("=")[1] ?? "";
  expect(id).toMatch(/^[0-9a-f]{64}$/);
  expect(Buffer.from(store.db.serialize()).includes(Buffer.from(id))).toBe(false);
});
```

- [ ] **Step 8: Lancer le test pour le voir échouer**

Run: `bun test packages/daemon/src/sessions/sessions-http.test.ts`
Expected: FAIL (`startServer` n'accepte pas `sessions`, `listSessions` inconnu ⇒ 400 ; la session ne survit pas au redémarrage).

- [ ] **Step 9: Extensions RPC et RPC des sessions**

`packages/daemon/src/rpc-extensions.ts` :
```ts
import { KiboError, type RpcRequest } from "@kibo/schema";
import type { Service } from "./service";

export type RpcContext = { sessionHash: string; remote: boolean };
export type RpcExtension = {
  methods: readonly RpcRequest["method"][];
  handle(req: RpcRequest, ctx: RpcContext): Promise<unknown>;
};

export type RpcOutcome = { handled: true; result: unknown } | { handled: false };
export type RpcHandler = (req: RpcRequest, ctx: RpcContext) => Promise<RpcOutcome>;

export async function dispatchRpc(
  service: Service,
  extensions: readonly RpcExtension[],
  req: RpcRequest,
  ctx: RpcContext,
  handlers: readonly RpcHandler[] = [],
): Promise<unknown> {
  const extension = extensions.find((e) => e.methods.includes(req.method));
  if (extension) return extension.handle(req, ctx);
  for (const handler of handlers) {
    const outcome = await handler(req, ctx);
    if (outcome.handled) return outcome.result;
  }
  return service.handle(req, ctx);
}

export function requireLocal(ctx: RpcContext): void {
  if (ctx.remote) throw new KiboError("FORBIDDEN", "this action is only allowed from this machine");
}
```

`packages/daemon/src/sessions/rpc.ts` :
```ts
import { type DaemonEvent, KiboError, type RpcRequest, type SessionInfo } from "@kibo/schema";
import type { RpcContext, RpcExtension } from "../rpc-extensions";
import type { SessionStore } from "./session-store";

export function sessionRpc(store: SessionStore, publish: (e: DaemonEvent) => void, now: () => number): RpcExtension {
  return {
    methods: ["listSessions", "revokeSession"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "listSessions") {
        return store.list(now()).map((s): SessionInfo => ({ ...s, current: s.id === ctx.sessionHash }));
      }
      if (req.method === "revokeSession") {
        store.revoke(req.id, now());
        publish({ type: "sessions" });
        return null;
      }
      throw new KiboError("INTERNAL", `sessionRpc cannot handle ${req.method}`);
    },
  };
}
```

`packages/daemon/src/rpc-extensions.test.ts` (écrit avant `rpc-extensions.ts`, vu échouer par `bun test packages/daemon/src/rpc-extensions.test.ts`, puis vert) :
```ts
import { expect, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { dispatchRpc, type RpcHandler } from "./rpc-extensions";
import type { Service } from "./service";

const ctx = { sessionHash: "h", remote: false };
const service = { handle: async (req: RpcRequest) => `service:${req.method}` } as unknown as Service;

test("an extension wins for its declared methods", async () => {
  const ext = { methods: ["listSessions"] as const, handle: async () => "ext" };
  expect(await dispatchRpc(service, [ext], { method: "listSessions" }, ctx)).toBe("ext");
});

test("handlers are tried in order before the service", async () => {
  const seen: string[] = [];
  const skip: RpcHandler = async () => {
    seen.push("skip");
    return { handled: false };
  };
  const take: RpcHandler = async () => {
    seen.push("take");
    return { handled: true, result: 42 };
  };
  expect(await dispatchRpc(service, [], { method: "listProjects" }, ctx, [skip, take])).toBe(42);
  expect(seen).toEqual(["skip", "take"]);
});

test("the service answers when nothing handles the request", async () => {
  expect(await dispatchRpc(service, [], { method: "listProjects" }, ctx, [])).toBe("service:listProjects");
});
```
Le `as unknown as Service` du test est justifié : seul `handle` est appelé.

- [ ] **Step 10: Brancher le serveur**

Dans `packages/daemon/src/server.ts` (les autres routes ajoutées par les phases 2 à 6 restent telles quelles) :

1. Options et types :
```ts
import type { ServerWebSocket } from "bun";
import type { DaemonEvent } from "@kibo/schema";
import { dispatchRpc, type RpcContext, type RpcExtension, type RpcHandler } from "./rpc-extensions";
import { deviceNameFromUserAgent } from "./sessions/device-name";
import { sessionRpc } from "./sessions/rpc";
import type { SessionStore } from "./sessions/session-store";

export type ServerOptions = {
  service: Service;
  sessions: SessionStore;
  token: string;
  port: number;
  uiDir: string | null;
  extraOrigins?: string[];
  extensions?: RpcExtension[];
  handlers?: RpcHandler[];
  now?: () => number;
};
type WsData = { sessionHash: string };
```
2. Remplacer `const sessions = new Set<string>()` et `hasSession` par :
```ts
  const now = opts.now ?? Date.now;
  const sockets = new Map<string, Set<ServerWebSocket<WsData>>>();
  const sessionOf = (req: Request): { hash: string; remote: boolean } | null => {
    const id = readCookie(req.headers.get("cookie"), COOKIE);
    return id === null ? null : opts.sessions.validate(id, now());
  };
  const offRevoke = opts.sessions.onRevoke((hash) => {
    for (const ws of sockets.get(hash) ?? []) ws.close(4401, "session revoked");
    sockets.delete(hash);
  });
```
3. Dans `/api/pair`, remplacer `newSessionId()` / `sessions.add(id)` par :
```ts
      const { id } = opts.sessions.create(
        { deviceName: deviceNameFromUserAgent(req.headers.get("user-agent")), remote: false },
        now(),
      );
```
(`newSessionId` n'est plus utilisé : le retirer de `auth.ts` et de l'import.)
4. Après la vérification d'origine :
```ts
    const session = sessionOf(req);
    if (!session) return fail("UNAUTHORIZED", "pair this browser first", 401);
    const ctx: RpcContext = { sessionHash: session.hash, remote: session.remote };

    if (url.pathname === "/api/events") {
      return srv.upgrade(req, { data: { sessionHash: session.hash } })
        ? undefined
        : new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/api/rpc" && req.method === "POST") {
      const parsed = RpcRequest.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
      try {
        return json({ ok: true, result: (await dispatchRpc(opts.service, extensions, parsed.data, ctx, opts.handlers ?? [])) ?? null });
      } catch (e) {
        if (e instanceof KiboError) return fail(e.code, e.detail, STATUS[e.code] ?? 400);
        console.error("[kibo-daemon] rpc failed", e);
        return fail("INTERNAL", "internal error", 500);
      }
    }
```
Le `.catch(() => null)` sur `req.json()` existe déjà en v0.1 : il ne cache rien, un corps illisible devient une requête invalide (400) juste en dessous.
5. `extensions` et `publish` :
```ts
  const publish = (event: DaemonEvent) => server.publish("changes", JSON.stringify(event));
  const extensions: RpcExtension[] = [sessionRpc(opts.sessions, (e) => publish(e), now), ...(opts.extensions ?? [])];
```
(`extensions` est déclaré avant `Bun.serve` ; `publish` référence `server` au moment de l'appel seulement.)
6. `Bun.serve<WsData>` et WebSocket :
```ts
    websocket: {
      open(ws) {
        ws.subscribe("changes");
        const set = sockets.get(ws.data.sessionHash) ?? new Set();
        set.add(ws);
        sockets.set(ws.data.sessionHash, set);
      },
      close(ws) {
        sockets.get(ws.data.sessionHash)?.delete(ws);
      },
      message() {},
    },
```
7. `stop` appelle aussi `offRevoke()` ; `startServer` renvoie `{ url, port, stop, publish }`.

Dans `packages/daemon/src/main.ts` : `import { openSessionStore } from "./sessions/session-store";` et `sessions: openSessionStore(store.db)` dans `startServer`.

Dans `packages/daemon/src/server.test.ts` : ajouter `sessions: openSessionStore(store.db)` à chaque `startServer({...})` (mise en place seulement, aucune attente modifiée) ; le service factice du bloc « unexpected failures » garde sa forme.

- [ ] **Step 11: Lancer les tests du démon**

Run: `bun test packages/daemon`
Expected: PASS, y compris `server.test.ts` inchangé dans ses attentes et les 6 tests de `sessions-http.test.ts`.

- [ ] **Step 12: Vérifier le lint et les types, commiter**

Run: `bun run check && bun run typecheck`
Expected: aucun diagnostic.

```bash
git add packages/daemon/src/sessions packages/daemon/src/rpc-extensions.ts packages/daemon/src/rpc-extensions.test.ts packages/daemon/src/server.ts packages/daemon/src/auth.ts packages/daemon/src/main.ts packages/daemon/src/server.test.ts packages/schema/src/rpc.ts
git commit -m "feat(daemon): sessions d'appairage persistées"
```

---

### Task 10: Paquets .kpkg et index signés

Chaîne de vérification de la marketplace (spec H §3.1, §3.2, §4, §7), dans `packages/trust` : construction et signature d'un `.kpkg`, décodage borné, contrôle des fichiers et de l'empreinte, signature et vérification de l'index d'une source, puis vérification complète d'un paquet contre l'index et l'épinglage. Tout est pur (WebCrypto, pas d'I/O). Un utilitaire de test partagé fabrique des paquets et des index valides pour les tâches 15, 16, 20 et 22.

**Files:**
- Create: `packages/trust/src/kpkg.ts`, `packages/trust/src/market-index.ts`, `packages/trust/src/verify-package.ts`, `packages/trust/src/testing/fixtures.ts`
- Modify: `packages/trust/src/index.ts` (exports), `packages/trust/package.json` (export `./testing`)
- Test: `packages/trust/src/kpkg.test.ts`, `packages/trust/src/market-index.test.ts`, `packages/trust/src/verify-package.test.ts`

**Interfaces:**
- Consumes (T2) : `toBase64`, `fromBase64`, `utf8`, `sha256Hex`, `generateKeyPair`, `signBytes`, `verifyBytes`, `type KeyPair`, `type SourceFile`, `isHashedSource`, `sourceHash`. (T5) : `Kpkg`, `KpkgFile`, `MarketIndex`, `KPKG_MAX_BYTES`, `ComponentManifest`, `KiboError`.
- Produces :
  - `signingPayload(pkg: Pick<Kpkg, "manifest" | "hash" | "publisher" | "publishedAt">): Uint8Array`
  - `packKpkg(input: { manifest: ComponentManifest; files: SourceFile[]; publisherName: string; keys: KeyPair; publishedAt: Date }): Promise<Kpkg>`
  - `encodeKpkg(pkg: Kpkg): Uint8Array` ; `decodeKpkg(bytes: Uint8Array): Kpkg` (`INVALID_INPUT`)
  - `verifyKpkgSignature(pkg: Kpkg): Promise<void>` (`SIGNATURE_INVALID`)
  - `kpkgSourceFiles(pkg: Kpkg): Promise<SourceFile[]>` (`INVALID_INPUT`, `HASH_MISMATCH`)
  - `signIndex(index: MarketIndex, privateKey: string): Promise<{ bytes: Uint8Array; sig: string }>`
  - `verifyIndex(input: { bytes: Uint8Array; sig: string; expectedKey: string; lastSerial: number | null }): Promise<MarketIndex>` (`SIGNATURE_INVALID`, `INDEX_ROLLBACK`, `INVALID_INPUT`)
  - `verifyMarketPackage(input: { pkg: Kpkg; index: MarketIndex; pinnedKey: string | null }): Promise<{ files: SourceFile[]; newPublisher: boolean }>`
  - **Nouveau** (`@kibo/trust/testing`) :
    - `type TestPackageInput = { id?: string; version?: string; title?: string; files?: Record<string, string>; manifest?: Partial<ComponentManifestInput>; publisherName?: string; keys?: KeyPair; publisher?: { name: string; keys: KeyPair }; publishedAt?: Date }`
    - `makeTestPackage(input?: TestPackageInput): Promise<TestPackage>` avec `TestPackage = { pkg, bytes, keys, files, publisher: { name, keys } }` ; `input.publisher` équivaut à `publisherName` + `keys` ; le `ui.tsx` par défaut exporte `Component` qui affiche le titre, pour passer la conformité générique (T20, T22)
    - `makeTestIndex(input: { source: { id: string; name: string; keys: KeyPair }; serial: number; packages: { pkg: Kpkg; verified?: boolean }[]; revoked?: { hash: string; reason: string }[]; now?: Date }): Promise<{ index: MarketIndex; bytes: Uint8Array; sig: string }>`
    - `ComponentManifestInput = z.input<typeof ComponentManifest>`

Règles d'un chemin de fichier de paquet : relatif POSIX, segments `[A-Za-z0-9._-]+`, aucun segment commençant par `.` (couvre `..` et les fichiers cachés), pas de `/` initial, pas de doublon, et `isHashedSource(path)` vrai. Le manifeste porté par le paquet doit être identique à `kibo.component.json` du paquet : sinon les permissions affichées pourraient différer du code installé.

- [ ] **Step 1: Écrire les tests du paquet**

`packages/trust/src/kpkg.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { KPKG_MAX_BYTES } from "@kibo/schema";
import { toBase64, utf8, sha256Hex } from "./bytes";
import { generateKeyPair, signBytes } from "./ed25519";
import { decodeKpkg, encodeKpkg, kpkgSourceFiles, signingPayload, verifyKpkgSignature } from "./kpkg";
import { makeTestPackage } from "./testing/fixtures";

const code = (e: unknown) => (e as { code?: string }).code;

async function rejectsWith(p: Promise<unknown>, expected: string) {
  let caught: unknown = null;
  try {
    await p;
  } catch (e) {
    caught = e;
  }
  expect(code(caught)).toBe(expected);
}

describe("signingPayload", () => {
  test("follows spec H §3.1 exactly", async () => {
    const { pkg } = await makeTestPackage({ id: "burndown", version: "0.3.0" });
    const text = new TextDecoder().decode(signingPayload(pkg));
    expect(text).toBe(
      `kibo-kpkg-v1\nburndown@0.3.0\n${pkg.hash}\n${pkg.publisher.publicKey}\n${pkg.publishedAt}`,
    );
  });
});

describe("signature", () => {
  test("a freshly packed package verifies", async () => {
    const { pkg } = await makeTestPackage();
    await verifyKpkgSignature(pkg);
  });
  test("an altered manifest version is refused", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(
      verifyKpkgSignature({ ...pkg, manifest: { ...pkg.manifest, version: "9.9.9" } }),
      "SIGNATURE_INVALID",
    );
  });
  test("an altered publishedAt is refused", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(verifyKpkgSignature({ ...pkg, publishedAt: "2030-01-01T00:00:00.000Z" }), "SIGNATURE_INVALID");
  });
  test("a signature from another key is refused", async () => {
    const { pkg } = await makeTestPackage();
    const other = await generateKeyPair();
    const signature = await signBytes(other.privateKey, signingPayload(pkg));
    await rejectsWith(verifyKpkgSignature({ ...pkg, signature }), "SIGNATURE_INVALID");
  });
  test("a garbage signature is refused without throwing another code", async () => {
    const { pkg } = await makeTestPackage();
    await rejectsWith(verifyKpkgSignature({ ...pkg, signature: "AAAA" }), "SIGNATURE_INVALID");
  });
});

describe("content", () => {
  test("returns the sorted source files", async () => {
    const { pkg } = await makeTestPackage();
    const files = await kpkgSourceFiles(pkg);
    expect(files.map((f) => f.path)).toEqual(["kibo.component.json", "ui.tsx"]);
  });
  test("a modified file with a recomputed sha256 no longer matches the hash", async () => {
    const { pkg } = await makeTestPackage();
    const bytes = utf8("export function Burndown() { return 42; }\n");
    const files = pkg.files.map((f) =>
      f.path === "ui.tsx" ? { path: f.path, content: toBase64(bytes), sha256: "" } : f,
    );
    const ui = files.find((f) => f.path === "ui.tsx");
    if (!ui) throw new Error("fixture has no ui.tsx");
    ui.sha256 = await sha256Hex(bytes);
    await rejectsWith(kpkgSourceFiles({ ...pkg, files }), "HASH_MISMATCH");
  });
  test("a wrong per-file sha256 is refused", async () => {
    const { pkg } = await makeTestPackage();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "0".repeat(64) } : f));
    await rejectsWith(kpkgSourceFiles({ ...pkg, files }), "HASH_MISMATCH");
  });
  for (const path of ["../evil.ts", "/abs.ts", "src/../x.ts", ".hidden.ts", "src/.cache/x.ts", "ui.test.tsx", "run.sh", "a\\b.ts"]) {
    test(`refuses the path ${path}`, async () => {
      const { pkg } = await makeTestPackage();
      const content = toBase64(utf8("export const x = 1;\n"));
      const extra = { path, content, sha256: await sha256Hex(utf8("export const x = 1;\n")) };
      await rejectsWith(kpkgSourceFiles({ ...pkg, files: [...pkg.files, extra] }), "INVALID_INPUT");
    });
  }
  test("refuses duplicated paths", async () => {
    const { pkg } = await makeTestPackage();
    const first = pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    await rejectsWith(kpkgSourceFiles({ ...pkg, files: [...pkg.files, first] }), "INVALID_INPUT");
  });
  test("refuses a manifest that differs from kibo.component.json", async () => {
    const keys = await generateKeyPair();
    const { pkg } = await makeTestPackage({ keys });
    const manifest = { ...pkg.manifest, writes: ["ticket" as const] };
    const signature = await signBytes(keys.privateKey, signingPayload({ ...pkg, manifest }));
    await rejectsWith(kpkgSourceFiles({ ...pkg, manifest, signature }), "INVALID_INPUT");
  });
  test("refuses more than 2 MiB of decoded sources", async () => {
    const big = "x".repeat(KPKG_MAX_BYTES);
    const { pkg } = await makeTestPackage({ files: { "big.ts": `export const s = "${big}";\n` } });
    await rejectsWith(kpkgSourceFiles(pkg), "INVALID_INPUT");
  });
});

describe("encoding", () => {
  test("round-trips through bytes", async () => {
    const { pkg } = await makeTestPackage();
    expect(decodeKpkg(encodeKpkg(pkg))).toEqual(pkg);
  });
  test("refuses non JSON bytes", () => {
    expect(() => decodeKpkg(utf8("not json"))).toThrow("INVALID_INPUT");
  });
  test("refuses a document that is not a kpkg", () => {
    expect(() => decodeKpkg(utf8(JSON.stringify({ format: 2 })))).toThrow("INVALID_INPUT");
  });
  test("refuses oversized raw bytes before parsing", () => {
    expect(() => decodeKpkg(new Uint8Array(KPKG_MAX_BYTES * 2))).toThrow("INVALID_INPUT");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/trust/src/kpkg.test.ts`
Expected: FAIL — `Cannot find module './kpkg'`.

- [ ] **Step 3: Implémenter le paquet et les fixtures**

`packages/trust/src/kpkg.ts` :
```ts
import { ComponentManifest, KiboError, Kpkg, KPKG_MAX_BYTES } from "@kibo/schema";
import { fromBase64, sha256Hex, toBase64, utf8 } from "./bytes";
import { type KeyPair, signBytes, verifyBytes } from "./ed25519";
import { isHashedSource, type SourceFile, sourceHash } from "./source-hash";

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const MANIFEST_FILE = "kibo.component.json";
const RAW_LIMIT = Math.ceil((KPKG_MAX_BYTES * 4) / 3) + 256 * 1024;

export function signingPayload(pkg: Pick<Kpkg, "manifest" | "hash" | "publisher" | "publishedAt">): Uint8Array {
  return utf8(
    `kibo-kpkg-v1\n${pkg.manifest.id}@${pkg.manifest.version}\n${pkg.hash}\n${pkg.publisher.publicKey}\n${pkg.publishedAt}`,
  );
}

export function assertPackagePath(path: string): void {
  const segments = path.split("/");
  const safe =
    path.length > 0 &&
    path.length <= 256 &&
    segments.every((s) => SEGMENT.test(s) && !s.startsWith(".")) &&
    isHashedSource(path);
  if (!safe) throw new KiboError("INVALID_INPUT", `unsafe package path: ${JSON.stringify(path)}`);
}

export async function packKpkg(input: {
  manifest: ComponentManifest;
  files: SourceFile[];
  publisherName: string;
  keys: KeyPair;
  publishedAt: Date;
}): Promise<Kpkg> {
  const files = [...input.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const f of files) assertPackagePath(f.path);
  const hash = await sourceHash(files);
  const encoded = await Promise.all(
    files.map(async (f) => ({ path: f.path, sha256: await sha256Hex(f.bytes), content: toBase64(f.bytes) })),
  );
  const unsigned = {
    manifest: input.manifest,
    hash,
    publisher: { name: input.publisherName, publicKey: input.keys.publicKey },
    publishedAt: input.publishedAt.toISOString(),
  };
  const signature = await signBytes(input.keys.privateKey, signingPayload(unsigned));
  return Kpkg.parse({ format: 1, ...unsigned, files: encoded, signature });
}

export function encodeKpkg(pkg: Kpkg): Uint8Array {
  return utf8(JSON.stringify(pkg));
}

export function decodeKpkg(bytes: Uint8Array): Kpkg {
  if (bytes.byteLength > RAW_LIMIT) throw new KiboError("INVALID_INPUT", `package too large: ${bytes.byteLength} bytes`);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `package is not UTF-8 JSON: ${String(e)}`);
  }
  const parsed = Kpkg.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `package does not match the kpkg format: ${parsed.error.message}`);
  return parsed.data;
}

export async function verifyKpkgSignature(pkg: Kpkg): Promise<void> {
  const ok = await verifyBytes(pkg.publisher.publicKey, signingPayload(pkg), pkg.signature);
  if (!ok) throw new KiboError("SIGNATURE_INVALID", `signature of ${pkg.manifest.id}@${pkg.manifest.version} is invalid`);
}

export async function kpkgSourceFiles(pkg: Kpkg): Promise<SourceFile[]> {
  const seen = new Set<string>();
  let total = 0;
  const files: SourceFile[] = [];
  for (const f of pkg.files) {
    assertPackagePath(f.path);
    if (seen.has(f.path)) throw new KiboError("INVALID_INPUT", `duplicated package path ${f.path}`);
    seen.add(f.path);
    const bytes = fromBase64(f.content);
    total += bytes.byteLength;
    if (total > KPKG_MAX_BYTES) throw new KiboError("INVALID_INPUT", `package sources exceed ${KPKG_MAX_BYTES} bytes`);
    if ((await sha256Hex(bytes)) !== f.sha256) throw new KiboError("HASH_MISMATCH", `sha256 of ${f.path} does not match`);
    files.push({ path: f.path, bytes });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if ((await sourceHash(files)) !== pkg.hash) {
    throw new KiboError("HASH_MISMATCH", `recomputed hash of ${pkg.manifest.id}@${pkg.manifest.version} differs`);
  }
  const manifestFile = files.find((f) => f.path === MANIFEST_FILE);
  if (!manifestFile) throw new KiboError("INVALID_INPUT", `package has no ${MANIFEST_FILE}`);
  let declared: unknown;
  try {
    declared = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `${MANIFEST_FILE} is not JSON: ${String(e)}`);
  }
  const manifest = ComponentManifest.safeParse(declared);
  if (!manifest.success || !Bun.deepEquals(manifest.data, pkg.manifest, true)) {
    throw new KiboError("INVALID_INPUT", `package manifest differs from ${MANIFEST_FILE}`);
  }
  return files;
}
```

`packages/trust/src/testing/fixtures.ts` :
```ts
import { ComponentManifest, type Kpkg, type MarketIndex } from "@kibo/schema";
import type { z } from "zod";
import { utf8 } from "../bytes";
import { generateKeyPair, type KeyPair } from "../ed25519";
import { encodeKpkg, packKpkg } from "../kpkg";
import { signIndex } from "../market-index";
import type { SourceFile } from "../source-hash";

export type ComponentManifestInput = z.input<typeof ComponentManifest>;
export type TestPackageInput = {
  id?: string;
  version?: string;
  title?: string;
  files?: Record<string, string>;
  manifest?: Partial<ComponentManifestInput>;
  publisherName?: string;
  keys?: KeyPair;
  publisher?: { name: string; keys: KeyPair };
  publishedAt?: Date;
};

export type TestPackage = {
  pkg: Kpkg;
  bytes: Uint8Array;
  keys: KeyPair;
  files: SourceFile[];
  publisher: { name: string; keys: KeyPair };
};

export async function makeTestPackage(
  input: TestPackageInput = {},
): Promise<TestPackage> {
  const keys = input.publisher?.keys ?? input.keys ?? (await generateKeyPair());
  const publisherName = input.publisher?.name ?? input.publisherName ?? "Léa";
  const title = input.title ?? input.manifest?.title ?? "Burndown";
  const manifest = ComponentManifest.parse({
    id: input.id ?? "burndown",
    version: input.version ?? "0.3.0",
    kind: "widget",
    title,
    description: "Avancement du sprint",
    reads: ["ticket", "status"],
    writes: [],
    ...input.manifest,
  });
  const sources: Record<string, string> = {
    "kibo.component.json": JSON.stringify(manifest, null, 2),
    "ui.tsx": `export function Component() {\n  return <p>${title}</p>;\n}\n`,
    ...input.files,
  };
  const files = Object.entries(sources).map(([path, text]) => ({ path, bytes: utf8(text) }));
  const pkg = await packKpkg({
    manifest,
    files,
    publisherName,
    keys,
    publishedAt: input.publishedAt ?? new Date("2026-09-26T10:00:00.000Z"),
  });
  return { pkg, bytes: encodeKpkg(pkg), keys, files, publisher: { name: publisherName, keys } };
}

export async function makeTestIndex(input: {
  source: { id: string; name: string; keys: KeyPair };
  serial: number;
  packages: { pkg: Kpkg; verified?: boolean }[];
  revoked?: { hash: string; reason: string }[];
  now?: Date;
}): Promise<{ index: MarketIndex; bytes: Uint8Array; sig: string }> {
  const byId = new Map<string, Kpkg[]>();
  for (const { pkg } of input.packages) byId.set(pkg.manifest.id, [...(byId.get(pkg.manifest.id) ?? []), pkg]);
  const publishers = new Map<string, { publicKey: string; name: string; verified: boolean }>();
  for (const { pkg, verified } of input.packages) {
    publishers.set(pkg.publisher.publicKey, {
      publicKey: pkg.publisher.publicKey,
      name: pkg.publisher.name,
      verified: verified ?? true,
    });
  }
  const index: MarketIndex = {
    format: 1,
    source: { id: input.source.id, name: input.source.name, publicKey: input.source.keys.publicKey },
    serial: input.serial,
    generatedAt: (input.now ?? new Date("2026-09-26T10:00:00.000Z")).toISOString(),
    publishers: [...publishers.values()],
    packages: [...byId.entries()].map(([id, pkgs]) => {
      const latest = pkgs[pkgs.length - 1];
      if (!latest) throw new Error(`no version for ${id}`);
      return {
        id,
        title: latest.manifest.title,
        description: latest.manifest.description,
        kind: latest.manifest.kind,
        versions: pkgs.map((p) => ({
          version: p.manifest.version,
          hash: p.hash,
          publisherKey: p.publisher.publicKey,
          size: encodeKpkg(p).byteLength,
          permissions: { reads: p.manifest.reads, writes: p.manifest.writes, data: p.manifest.data, net: p.manifest.net },
          publishedAt: p.publishedAt,
          url: `packages/${id}/${p.manifest.version}.kpkg`,
        })),
      };
    }),
    revoked: input.revoked ?? [],
  };
  const signed = await signIndex(index, input.source.keys.privateKey);
  return { index, ...signed };
}

export { generateKeyPair };
```

Si `GrantedPermissions` (phase 4, étendu en phase 5 par `secrets` et `mcp`) exige d'autres champs, les ajouter ici depuis le manifeste avec leurs défauts ; T0 le vérifie.

`packages/trust/package.json` : ajouter à `exports` `"./testing": "./src/testing/fixtures.ts"`.

- [ ] **Step 4: Vérifier le succès**

Run: `bun test packages/trust/src/kpkg.test.ts`
Expected: FAIL — `Cannot find module '../market-index'` (importé par les fixtures). C'est l'échec attendu de l'étape suivante : les tests du paquet passent à l'étape 8, une fois l'index écrit.

- [ ] **Step 5: Écrire les tests de l'index**

`packages/trust/src/market-index.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { utf8 } from "./bytes";
import { generateKeyPair } from "./ed25519";
import { signIndex, verifyIndex } from "./market-index";
import { makeTestIndex, makeTestPackage } from "./testing/fixtures";

const caught = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "no-code";
  }
};

async function fixture(serial = 3) {
  const keys = await generateKeyPair();
  const { pkg } = await makeTestPackage();
  const signed = await makeTestIndex({ source: { id: "team", name: "Équipe", keys }, serial, packages: [{ pkg }] });
  return { keys, ...signed };
}

describe("verifyIndex", () => {
  test("accepts an index signed by the expected key", async () => {
    const f = await fixture();
    const index = await verifyIndex({ bytes: f.bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: 2 });
    expect(index.serial).toBe(3);
    expect(index.packages[0]?.id).toBe("burndown");
  });
  test("accepts the same serial again", async () => {
    const f = await fixture();
    expect(await caught(verifyIndex({ bytes: f.bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: 3 }))).toBeNull();
  });
  test("refuses a lower serial (rollback)", async () => {
    const f = await fixture(3);
    expect(await caught(verifyIndex({ bytes: f.bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: 4 }))).toBe(
      "INDEX_ROLLBACK",
    );
  });
  test("refuses an index signed by another key", async () => {
    const f = await fixture();
    const other = await generateKeyPair();
    const resigned = await signIndex(f.index, other.privateKey);
    expect(await caught(verifyIndex({ ...resigned, expectedKey: f.keys.publicKey, lastSerial: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("refuses an index whose declared source key changed", async () => {
    const f = await fixture();
    const other = await generateKeyPair();
    const tampered = await signIndex({ ...f.index, source: { ...f.index.source, publicKey: other.publicKey } }, f.keys.privateKey);
    expect(await caught(verifyIndex({ ...tampered, expectedKey: f.keys.publicKey, lastSerial: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("refuses one extra whitespace byte", async () => {
    const f = await fixture();
    const bytes = new Uint8Array([...f.bytes, ...utf8(" ")]);
    expect(await caught(verifyIndex({ bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("refuses signed bytes that are not an index", async () => {
    const keys = await generateKeyPair();
    const { signBytes } = await import("./ed25519");
    const bytes = utf8(JSON.stringify({ hello: "world" }));
    const sig = await signBytes(keys.privateKey, bytes);
    expect(await caught(verifyIndex({ bytes, sig, expectedKey: keys.publicKey, lastSerial: null }))).toBe("INVALID_INPUT");
  });
});
```

- [ ] **Step 6: Vérifier l'échec**

Run: `bun test packages/trust/src/market-index.test.ts`
Expected: FAIL — `Cannot find module './market-index'`.

- [ ] **Step 7: Implémenter l'index**

`packages/trust/src/market-index.ts` :
```ts
import { KiboError, MarketIndex } from "@kibo/schema";
import { utf8 } from "./bytes";
import { signBytes, verifyBytes } from "./ed25519";

export async function signIndex(index: MarketIndex, privateKey: string): Promise<{ bytes: Uint8Array; sig: string }> {
  const bytes = utf8(JSON.stringify(MarketIndex.parse(index)));
  return { bytes, sig: await signBytes(privateKey, bytes) };
}

export async function verifyIndex(input: {
  bytes: Uint8Array;
  sig: string;
  expectedKey: string;
  lastSerial: number | null;
}): Promise<MarketIndex> {
  if (!(await verifyBytes(input.expectedKey, input.bytes, input.sig))) {
    throw new KiboError("SIGNATURE_INVALID", "index signature does not match the source key");
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `index is not UTF-8 JSON: ${String(e)}`);
  }
  const parsed = MarketIndex.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `index does not match the format: ${parsed.error.message}`);
  const index = parsed.data;
  if (index.source.publicKey !== input.expectedKey) {
    throw new KiboError("SIGNATURE_INVALID", "index declares another source key");
  }
  if (input.lastSerial !== null && index.serial < input.lastSerial) {
    throw new KiboError("INDEX_ROLLBACK", `index serial ${index.serial} is lower than ${input.lastSerial}`);
  }
  return index;
}
```

- [ ] **Step 8: Vérifier le succès**

Run: `bun test packages/trust/src/market-index.test.ts packages/trust/src/kpkg.test.ts`
Expected: PASS.

- [ ] **Step 9: Écrire les tests de la chaîne complète**

`packages/trust/src/verify-package.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { KiboError, type Kpkg, type MarketIndex } from "@kibo/schema";
import { generateKeyPair, signBytes } from "./ed25519";
import { signingPayload } from "./kpkg";
import { makeTestIndex, makeTestPackage } from "./testing/fixtures";
import { verifyMarketPackage } from "./verify-package";

const outcome = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string; detail?: string }).code ?? "no-code";
  }
};

async function setup(opts: { revoke?: boolean } = {}) {
  const sourceKeys = await generateKeyPair();
  const made = await makeTestPackage();
  const { index } = await makeTestIndex({
    source: { id: "team", name: "Équipe", keys: sourceKeys },
    serial: 1,
    packages: [{ pkg: made.pkg }],
    revoked: opts.revoke ? [{ hash: made.pkg.hash, reason: "fuite de données" }] : [],
  });
  return { pkg: made.pkg, keys: made.keys, index };
}

describe("verifyMarketPackage", () => {
  test("first install pins a new publisher", async () => {
    const { pkg, index } = await setup();
    const res = await verifyMarketPackage({ pkg, index, pinnedKey: null });
    expect(res.newPublisher).toBe(true);
    expect(res.files.map((f) => f.path)).toContain("ui.tsx");
  });
  test("same pinned key is not a new publisher", async () => {
    const { pkg, index } = await setup();
    const res = await verifyMarketPackage({ pkg, index, pinnedKey: pkg.publisher.publicKey });
    expect(res.newPublisher).toBe(false);
  });
  test("another pinned key is PUBLISHER_CHANGED", async () => {
    const { pkg, index } = await setup();
    const other = await generateKeyPair();
    expect(await outcome(verifyMarketPackage({ pkg, index, pinnedKey: other.publicKey }))).toBe("PUBLISHER_CHANGED");
  });
  test("a revoked hash is REVOKED with its reason", async () => {
    const { pkg, index } = await setup({ revoke: true });
    const error = await verifyMarketPackage({ pkg, index, pinnedKey: null }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(KiboError);
    expect((error as KiboError).code).toBe("REVOKED");
    expect((error as KiboError).detail).toContain("fuite de données");
  });
  test("a hash absent from the index is NOT_FOUND", async () => {
    const { pkg, index } = await setup();
    const empty: MarketIndex = { ...index, packages: [] };
    expect(await outcome(verifyMarketPackage({ pkg, index: empty, pinnedKey: null }))).toBe("NOT_FOUND");
  });
  test("a publisher other than the index entry is SIGNATURE_INVALID", async () => {
    const { pkg, index } = await setup();
    const other = await generateKeyPair();
    const rewritten: Kpkg = { ...pkg, publisher: { name: "Mallory", publicKey: other.publicKey } };
    const signature = await signBytes(other.privateKey, signingPayload(rewritten));
    expect(await outcome(verifyMarketPackage({ pkg: { ...rewritten, signature }, index, pinnedKey: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("a badly signed and modified package fails on the signature first", async () => {
    const { pkg, index } = await setup();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "1".repeat(64) } : f));
    expect(await outcome(verifyMarketPackage({ pkg: { ...pkg, files, signature: "AAAA" }, index, pinnedKey: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("a correctly signed but modified package is HASH_MISMATCH", async () => {
    const { pkg, index } = await setup();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "1".repeat(64) } : f));
    expect(await outcome(verifyMarketPackage({ pkg: { ...pkg, files }, index, pinnedKey: null }))).toBe("HASH_MISMATCH");
  });
});
```

- [ ] **Step 10: Vérifier l'échec**

Run: `bun test packages/trust/src/verify-package.test.ts`
Expected: FAIL — `Cannot find module './verify-package'`.

- [ ] **Step 11: Implémenter la chaîne**

`packages/trust/src/verify-package.ts` :
```ts
import { KiboError, type Kpkg, type MarketIndex } from "@kibo/schema";
import { kpkgSourceFiles, verifyKpkgSignature } from "./kpkg";
import type { SourceFile } from "./source-hash";

export async function verifyMarketPackage(input: {
  pkg: Kpkg;
  index: MarketIndex;
  pinnedKey: string | null;
}): Promise<{ files: SourceFile[]; newPublisher: boolean }> {
  const { pkg, index, pinnedKey } = input;
  const ref = `${pkg.manifest.id}@${pkg.manifest.version}`;
  await verifyKpkgSignature(pkg);
  const files = await kpkgSourceFiles(pkg);
  const revoked = index.revoked.find((r) => r.hash === pkg.hash);
  if (revoked) throw new KiboError("REVOKED", `${ref} is revoked: ${revoked.reason}`);
  const entry = index.packages
    .find((p) => p.id === pkg.manifest.id)
    ?.versions.find((v) => v.version === pkg.manifest.version && v.hash === pkg.hash);
  if (!entry) throw new KiboError("NOT_FOUND", `${ref} with hash ${pkg.hash} is not in the index of ${index.source.id}`);
  if (entry.publisherKey !== pkg.publisher.publicKey) {
    throw new KiboError("SIGNATURE_INVALID", `${ref} is signed by a publisher the index does not list`);
  }
  if (pinnedKey !== null && pinnedKey !== pkg.publisher.publicKey) {
    throw new KiboError("PUBLISHER_CHANGED", `publisher key of ${pkg.manifest.id} changed on ${index.source.id}`);
  }
  return { files, newPublisher: pinnedKey === null };
}
```

`packages/trust/src/index.ts` : ajouter
```ts
export * from "./kpkg";
export * from "./market-index";
export * from "./verify-package";
```

- [ ] **Step 12: Vérifier le succès, lint et types**

Run: `bun test packages/trust && bun run check && bun run typecheck`
Expected: PASS, Biome et `tsc` sans erreur.

- [ ] **Step 13: Commit**

```bash
git add packages/trust/src/kpkg.ts packages/trust/src/market-index.ts packages/trust/src/verify-package.ts packages/trust/src/testing/fixtures.ts packages/trust/src/index.ts packages/trust/package.json packages/trust/src/kpkg.test.ts packages/trust/src/market-index.test.ts packages/trust/src/verify-package.test.ts
git commit -m "feat(trust): paquets et index signés"
```

---

### Task 11: Serveur de sync : comptes, appareils, invitations

Base SQLite de `kibo-sync` (spec G §3.1) et tout ce qui touche à l'identité : invitations à usage unique stockées hachées, comptes créés par invitation, appareils Ed25519, membres et rôles par projet, défi d'authentification, journal d'audit append-only, limiteurs. Aucune écoute réseau ici (T17).

**Files:**
- Create: `packages/sync-server/src/db.ts`, `packages/sync-server/src/accounts.ts`, `packages/sync-server/src/members.ts`, `packages/sync-server/src/audit.ts`, `packages/sync-server/src/auth.ts`, `packages/sync-server/src/limits.ts`
- Modify: `packages/sync-server/src/index.ts` (exports)
- Test: `packages/sync-server/src/db.test.ts`, `packages/sync-server/src/accounts.test.ts`, `packages/sync-server/src/auth.test.ts`, `packages/sync-server/src/limits.test.ts`

**Interfaces:**
- Consumes (T2) : `hashCode`, `newInviteCode`, `normalizeCode`, `fromBase64`, `toBase64`, `verifyBytes`, `generateKeyPair`, `signBytes`. (T4) : `JoinRequest`, `JoinResponse`, `DeviceInfo`, `MemberInfo`, `Role`, `SYNC_LIMITS`, `challengePayload`. (T1) : codes `INVITE_INVALID`, `DEVICE_REVOKED`.
- Produces : toutes les signatures `db.ts`, `accounts.ts`, `members.ts`, `audit.ts`, `auth.ts`, `limits.ts` des Contrats partagés, avec ces précisions **nouvelles** :
  - `deviceRecord(...)` renvoie `{ userId: string; name: string; deviceName: string; publicKey: string; revoked: boolean; userDisabled: boolean } | null` (`name` = nom de l'utilisateur, `deviceName` ajouté).
  - `type AuditEntry = { id: number; at: number; kind: AuditKind; userId: string | null; deviceId: string | null; projectId: string | null; detail: string | null }` et `readAudit(sdb: ServerDb, limit: number): AuditEntry[]` (plus récent d'abord), utilisés par la CLI (T17).
  - `insertProject(sdb: ServerDb, input: { id: string; ownerId: string; name: string; ticketSeq: number }, now: number): void` (insère le projet et le membre `owner` dans une transaction), utilisé par `ProjectRoom.create` (T14).
  - `setRole` refuse de laisser un projet sans `owner` (`FORBIDDEN`).

Les codes ne sont jamais écrits en clair : seule `hashCode(code)` est stockée. Une invitation est consommée dans la même transaction que ses effets (utilisateur, appareil, membre) : si l'insertion échoue, le code reste utilisable. La clé publique est vérifiée (import SPKI Ed25519) **avant** de consommer le code.

- [ ] **Step 1: Écrire les tests de la base et des invitations**

`packages/sync-server/src/db.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, readAudit } from "./audit";
import { openServerDb } from "./db";

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("creates the database file with mode 0600 in a 0700 directory", () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-db-"));
  const file = join(dir, "data", "sync.db");
  const sdb = openServerDb(file);
  audit(sdb, { at: 1, kind: "connect", userId: "u1" });
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(statSync(join(dir, "data")).mode & 0o777).toBe(0o700);
  sdb.close();
});

test("audit is append-only", () => {
  const sdb = openServerDb(":memory:");
  audit(sdb, { at: 1, kind: "connect", userId: "u1", deviceId: "d1" });
  audit(sdb, { at: 2, kind: "auth-failed", detail: "bad signature" });
  expect(readAudit(sdb, 10).map((e) => e.kind)).toEqual(["auth-failed", "connect"]);
  expect(() => sdb.db.exec("DELETE FROM audit")).toThrow("append-only");
  expect(() => sdb.db.exec("UPDATE audit SET kind = 'x'")).toThrow("append-only");
  sdb.close();
});
```

`packages/sync-server/src/accounts.test.ts` :
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { SYNC_LIMITS } from "@kibo/schema";
import { generateKeyPair } from "@kibo/trust";
import {
  createInvite,
  deviceRecord,
  disableUser,
  listDevices,
  redeemDeviceInvite,
  redeemProjectInvite,
  revokeDevice,
} from "./accounts";
import { readAudit } from "./audit";
import { openServerDb, type ServerDb } from "./db";
import { insertProject, listMembers, projectsOf, roleOf, setRole } from "./members";

let sdb: ServerDb;
const T0 = 1_800_000_000_000;
beforeEach(() => {
  sdb = openServerDb(":memory:");
});

const code = async (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "no-code",
  );

async function account(name: string, now = T0) {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: `Mac de ${name}` }, now);
  return { ...joined, keys };
}

describe("account invites", () => {
  test("a code is 26 base32 characters and is never stored in clear", async () => {
    const { code: c, expiresAt } = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    expect(c).toMatch(/^[A-Z2-7]{26}$/);
    expect(expiresAt).toBe(T0 + SYNC_LIMITS.accountInviteMs);
    const dump = JSON.stringify(sdb.db.query("SELECT * FROM invites").all());
    expect(dump).not.toContain(c);
  });
  test("redeeming creates the user and the device", async () => {
    const a = await account("Adam");
    expect(a.name).toBe("Adam");
    expect(deviceRecord(sdb, a.deviceId)).toMatchObject({ userId: a.userId, name: "Adam", deviceName: "Mac de Adam", revoked: false });
    expect(readAudit(sdb, 10).map((e) => e.kind)).toContain("invite-redeemed");
  });
  test("a code works only once", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const k1 = await generateKeyPair();
    const k2 = await generateKeyPair();
    await redeemDeviceInvite(sdb, { code: invite.code, publicKey: k1.publicKey, deviceName: "A" }, T0);
    expect(await code(redeemDeviceInvite(sdb, { code: invite.code, publicKey: k2.publicKey, deviceName: "B" }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
  test("a code is valid for 48 h, not one millisecond more", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const keys = await generateKeyPair();
    const late = T0 + SYNC_LIMITS.accountInviteMs + 1;
    expect(await code(redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "A" }, late))).toBe(
      "INVITE_INVALID",
    );
  });
  test("spaces, dashes and lowercase are accepted", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    const messy = ` ${invite.code.slice(0, 4).toLowerCase()}-${invite.code.slice(4, 13)} ${invite.code.slice(13)} `;
    const keys = await generateKeyPair();
    expect(await code(redeemDeviceInvite(sdb, { code: messy, publicKey: keys.publicKey, deviceName: "A" }, T0))).toBe("ok");
  });
  test("an invalid public key is refused and does not burn the code", async () => {
    const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, T0);
    expect(await code(redeemDeviceInvite(sdb, { code: invite.code, publicKey: "AAAA", deviceName: "A" }, T0))).toBe(
      "INVALID_INPUT",
    );
    const keys = await generateKeyPair();
    expect(await code(redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "A" }, T0))).toBe("ok");
  });
  test("an unknown code is refused", async () => {
    const keys = await generateKeyPair();
    expect(await code(redeemDeviceInvite(sdb, { code: "A".repeat(26), publicKey: keys.publicKey, deviceName: "A" }, T0))).toBe(
      "INVITE_INVALID",
    );
  });
});

describe("devices", () => {
  test("a device code adds a device to the same user for 15 minutes", async () => {
    const a = await account("Adam");
    const invite = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    expect(invite.expiresAt).toBe(T0 + SYNC_LIMITS.deviceInviteMs);
    const keys = await generateKeyPair();
    const second = await redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "iMac" }, T0 + 60_000);
    expect(second.userId).toBe(a.userId);
    expect(listDevices(sdb, a.userId).map((d) => d.name)).toEqual(["Mac de Adam", "iMac"]);
    const late = await createInvite(sdb, { kind: "device", userId: a.userId, createdBy: a.userId }, T0);
    const k3 = await generateKeyPair();
    expect(
      await code(redeemDeviceInvite(sdb, { code: late.code, publicKey: k3.publicKey, deviceName: "X" }, T0 + SYNC_LIMITS.deviceInviteMs + 1)),
    ).toBe("INVITE_INVALID");
  });
  test("revoking marks the device and is audited", async () => {
    const a = await account("Adam");
    revokeDevice(sdb, { deviceId: a.deviceId, by: "admin" }, T0 + 5);
    expect(deviceRecord(sdb, a.deviceId)?.revoked).toBe(true);
    expect(listDevices(sdb, a.userId)[0]?.revokedAt).toBe(T0 + 5);
    expect(readAudit(sdb, 1)[0]?.kind).toBe("device-revoked");
  });
  test("disabling a user flags every device", async () => {
    const a = await account("Adam");
    disableUser(sdb, a.userId, T0 + 5);
    expect(deviceRecord(sdb, a.deviceId)?.userDisabled).toBe(true);
    const invite = createInvite(sdb, { kind: "device", userId: a.userId, createdBy: "admin" }, T0);
    expect(await code(invite)).toBe("FORBIDDEN");
  });
});

describe("project invites and members", () => {
  test("a project invite adds the member with its role, once", async () => {
    const owner = await account("Adam");
    const lea = await account("Léa");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 24 }, T0);
    const invite = await createInvite(sdb, { kind: "project", projectId: "p1", role: "viewer", createdBy: owner.userId }, T0);
    expect(invite.expiresAt).toBe(T0 + SYNC_LIMITS.projectInviteMs);
    expect(await redeemProjectInvite(sdb, { code: invite.code, userId: lea.userId }, T0)).toEqual({ projectId: "p1", role: "viewer" });
    expect(roleOf(sdb, "p1", lea.userId)).toBe("viewer");
    expect(projectsOf(sdb, lea.userId)).toEqual([{ id: "p1", name: "Kibo", role: "viewer" }]);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: lea.userId }, T0))).toBe("INVITE_INVALID");
  });
  test("an account code cannot be used as a project code", async () => {
    const owner = await account("Adam");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    const invite = await createInvite(sdb, { kind: "account", name: "X", createdBy: "admin" }, T0);
    expect(await code(redeemProjectInvite(sdb, { code: invite.code, userId: owner.userId }, T0))).toBe("INVITE_INVALID");
  });
  test("roles change, members are removed, the last owner stays", async () => {
    const owner = await account("Adam");
    const lea = await account("Léa");
    insertProject(sdb, { id: "p1", ownerId: owner.userId, name: "Kibo", ticketSeq: 0 }, T0);
    setRole(sdb, { projectId: "p1", userId: lea.userId, role: "editor" }, T0);
    expect(listMembers(sdb, "p1")).toEqual([
      { userId: owner.userId, name: "Adam", role: "owner" },
      { userId: lea.userId, name: "Léa", role: "editor" },
    ]);
    setRole(sdb, { projectId: "p1", userId: lea.userId, role: null }, T0);
    expect(roleOf(sdb, "p1", lea.userId)).toBeNull();
    expect(() => setRole(sdb, { projectId: "p1", userId: owner.userId, role: "editor" }, T0)).toThrow("FORBIDDEN");
    expect(() => setRole(sdb, { projectId: "p1", userId: owner.userId, role: null }, T0)).toThrow("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/sync-server/src/db.test.ts packages/sync-server/src/accounts.test.ts`
Expected: FAIL — `Cannot find module './db'`.

- [ ] **Step 3: Implémenter la base, l'audit, les comptes et les membres**

`packages/sync-server/src/db.ts` :
```ts
import { Database } from "bun:sqlite";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import { KiboError } from "@kibo/schema";

export type ServerDb = { db: Database; close(): void };

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, disabledAt INTEGER)",
  "CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), publicKey TEXT NOT NULL UNIQUE, name TEXT NOT NULL, createdAt INTEGER NOT NULL, lastSeenAt INTEGER, revokedAt INTEGER)",
  "CREATE INDEX IF NOT EXISTS devices_by_user ON devices(userId)",
  "CREATE TABLE IF NOT EXISTS invites (codeHash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('account', 'device', 'project')), name TEXT, userId TEXT, projectId TEXT, role TEXT, createdBy TEXT NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, usedAt INTEGER)",
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, createdAt INTEGER NOT NULL, ticketSeq INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS members (projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, userId TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')), addedAt INTEGER NOT NULL, PRIMARY KEY (projectId, userId))",
  "CREATE INDEX IF NOT EXISTS members_by_user ON members(userId)",
  "CREATE TABLE IF NOT EXISTS updates (projectId TEXT NOT NULL, seq INTEGER NOT NULL, bytes BLOB NOT NULL, userId TEXT NOT NULL, deviceId TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (projectId, seq))",
  "CREATE TABLE IF NOT EXISTS snapshots (projectId TEXT NOT NULL, bytes BLOB NOT NULL, versionJson TEXT NOT NULL, uptoSeq INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (projectId, uptoSeq))",
  "CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, userId TEXT, deviceId TEXT, projectId TEXT, detail TEXT)",
  "CREATE INDEX IF NOT EXISTS audit_by_at ON audit(at)",
  "CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END",
  "CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END",
];

export function openServerDb(file: string): ServerDb {
  const onDisk = file !== ":memory:";
  if (onDisk) {
    const dir = dirname(file);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    if (!existsSync(file)) closeSync(openSync(file, "a", 0o600));
  }
  let db: Database;
  try {
    db = new Database(file, { create: true, strict: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA foreign_keys = ON");
    for (const statement of SCHEMA) db.exec(statement);
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open sync database ${file}: ${String(e)}`);
  }
  if (onDisk) for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);
  return { db, close: () => db.close() };
}
```

`packages/sync-server/src/audit.ts` :
```ts
import type { ServerDb } from "./db";

export type AuditKind =
  | "connect"
  | "auth-failed"
  | "invite-created"
  | "invite-redeemed"
  | "role-changed"
  | "member-removed"
  | "device-revoked"
  | "user-disabled"
  | "update-rejected"
  | "project-shared"
  | "project-deleted"
  | "market-published"
  | "market-revoked";

export type AuditEntry = {
  id: number;
  at: number;
  kind: AuditKind;
  userId: string | null;
  deviceId: string | null;
  projectId: string | null;
  detail: string | null;
};

export function audit(
  sdb: ServerDb,
  e: { at: number; kind: AuditKind; userId?: string | null; deviceId?: string | null; projectId?: string | null; detail?: string },
): void {
  sdb.db
    .query(
      "INSERT INTO audit (at, kind, userId, deviceId, projectId, detail) VALUES ($at, $kind, $userId, $deviceId, $projectId, $detail)",
    )
    .run({
      at: e.at,
      kind: e.kind,
      userId: e.userId ?? null,
      deviceId: e.deviceId ?? null,
      projectId: e.projectId ?? null,
      detail: e.detail ?? null,
    });
}

export function readAudit(sdb: ServerDb, limit: number): AuditEntry[] {
  return sdb.db.query("SELECT * FROM audit ORDER BY id DESC LIMIT $limit").all({ limit }) as AuditEntry[];
}
```

`packages/sync-server/src/accounts.ts` :
```ts
import { type DeviceInfo, JoinRequest, type JoinResponse, KiboError, type Role, SYNC_LIMITS } from "@kibo/schema";
import { fromBase64, hashCode, newInviteCode } from "@kibo/trust";
import { audit } from "./audit";
import type { ServerDb } from "./db";

export type InviteInput =
  | { kind: "account"; name: string; createdBy: string }
  | { kind: "device"; userId: string; createdBy: string }
  | { kind: "project"; projectId: string; role: "editor" | "viewer"; createdBy: string };

type InviteRow = {
  codeHash: string;
  kind: "account" | "device" | "project";
  name: string | null;
  userId: string | null;
  projectId: string | null;
  role: Role | null;
  expiresAt: number;
  usedAt: number | null;
};

const TTL: Record<InviteInput["kind"], number> = {
  account: SYNC_LIMITS.accountInviteMs,
  device: SYNC_LIMITS.deviceInviteMs,
  project: SYNC_LIMITS.projectInviteMs,
};

function userActive(sdb: ServerDb, userId: string): boolean {
  const row = sdb.db.query("SELECT disabledAt FROM users WHERE id = $id").get({ id: userId }) as
    | { disabledAt: number | null }
    | null;
  return row !== null && row.disabledAt === null;
}

export async function createInvite(sdb: ServerDb, input: InviteInput, now: number): Promise<{ code: string; expiresAt: number }> {
  if (input.kind === "account" && !input.name.trim()) throw new KiboError("INVALID_INPUT", "account invite needs a name");
  if (input.kind === "device" && !userActive(sdb, input.userId)) {
    throw new KiboError("FORBIDDEN", `user ${input.userId} is unknown or disabled`);
  }
  if (input.kind === "project" && !sdb.db.query("SELECT 1 FROM projects WHERE id = $id").get({ id: input.projectId })) {
    throw new KiboError("NOT_FOUND", `project ${input.projectId} is not shared`);
  }
  const code = newInviteCode();
  const expiresAt = now + TTL[input.kind];
  sdb.db
    .query(
      "INSERT INTO invites (codeHash, kind, name, userId, projectId, role, createdBy, createdAt, expiresAt, usedAt) " +
        "VALUES ($codeHash, $kind, $name, $userId, $projectId, $role, $createdBy, $createdAt, $expiresAt, NULL)",
    )
    .run({
      codeHash: await hashCode(code),
      kind: input.kind,
      name: input.kind === "account" ? input.name.trim() : null,
      userId: input.kind === "device" ? input.userId : null,
      projectId: input.kind === "project" ? input.projectId : null,
      role: input.kind === "project" ? input.role : null,
      createdBy: input.createdBy,
      createdAt: now,
      expiresAt,
    });
  audit(sdb, {
    at: now,
    kind: "invite-created",
    userId: input.createdBy,
    projectId: input.kind === "project" ? input.projectId : null,
    detail: input.kind,
  });
  return { code, expiresAt };
}

function takeInvite(sdb: ServerDb, codeHash: string, kinds: InviteRow["kind"][], now: number): InviteRow {
  const row = sdb.db.query("SELECT * FROM invites WHERE codeHash = $codeHash").get({ codeHash }) as InviteRow | null;
  if (!row || row.usedAt !== null || row.expiresAt < now || !kinds.includes(row.kind)) {
    throw new KiboError("INVITE_INVALID", "invite code is invalid, expired or already used");
  }
  const res = sdb.db
    .query("UPDATE invites SET usedAt = $now WHERE codeHash = $codeHash AND usedAt IS NULL")
    .run({ now, codeHash });
  if (res.changes !== 1) throw new KiboError("INVITE_INVALID", "invite code was used concurrently");
  return row;
}

async function assertEd25519PublicKey(publicKey: string): Promise<void> {
  try {
    await crypto.subtle.importKey("spki", fromBase64(publicKey), { name: "Ed25519" }, true, ["verify"]);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `device public key is not an Ed25519 SPKI key: ${String(e)}`);
  }
}

export async function redeemDeviceInvite(sdb: ServerDb, req: JoinRequest, now: number): Promise<JoinResponse> {
  const input = JoinRequest.parse(req);
  await assertEd25519PublicKey(input.publicKey);
  const codeHash = await hashCode(input.code);
  return sdb.db.transaction(() => {
    const invite = takeInvite(sdb, codeHash, ["account", "device"], now);
    let userId: string;
    let name: string;
    if (invite.kind === "account") {
      userId = crypto.randomUUID();
      name = invite.name ?? "";
      sdb.db.query("INSERT INTO users (id, name, createdAt, disabledAt) VALUES ($id, $name, $now, NULL)").run({ id: userId, name, now });
    } else {
      userId = invite.userId ?? "";
      if (!userActive(sdb, userId)) throw new KiboError("INVITE_INVALID", "the invited user is disabled");
      const user = sdb.db.query("SELECT name FROM users WHERE id = $id").get({ id: userId }) as { name: string };
      name = user.name;
    }
    if (sdb.db.query("SELECT 1 FROM devices WHERE publicKey = $k").get({ k: input.publicKey })) {
      throw new KiboError("INVALID_INPUT", "this public key is already registered");
    }
    const deviceId = crypto.randomUUID();
    sdb.db
      .query(
        "INSERT INTO devices (id, userId, publicKey, name, createdAt, lastSeenAt, revokedAt) VALUES ($id, $userId, $publicKey, $name, $now, NULL, NULL)",
      )
      .run({ id: deviceId, userId, publicKey: input.publicKey, name: input.deviceName, now });
    audit(sdb, { at: now, kind: "invite-redeemed", userId, deviceId, detail: invite.kind });
    return { userId, deviceId, name };
  })();
}

export async function redeemProjectInvite(
  sdb: ServerDb,
  input: { code: string; userId: string },
  now: number,
): Promise<{ projectId: string; role: Role }> {
  const codeHash = await hashCode(input.code);
  return sdb.db.transaction(() => {
    const invite = takeInvite(sdb, codeHash, ["project"], now);
    const projectId = invite.projectId ?? "";
    const role = invite.role ?? "viewer";
    if (sdb.db.query("SELECT 1 FROM members WHERE projectId = $p AND userId = $u").get({ p: projectId, u: input.userId })) {
      throw new KiboError("INVALID_INPUT", "already a member of this project");
    }
    sdb.db
      .query("INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, $role, $now)")
      .run({ p: projectId, u: input.userId, role, now });
    audit(sdb, { at: now, kind: "invite-redeemed", userId: input.userId, projectId, detail: role });
    return { projectId, role };
  })();
}

export function deviceRecord(
  sdb: ServerDb,
  deviceId: string,
): { userId: string; name: string; deviceName: string; publicKey: string; revoked: boolean; userDisabled: boolean } | null {
  const row = sdb.db
    .query(
      "SELECT d.userId AS userId, u.name AS name, d.name AS deviceName, d.publicKey AS publicKey, d.revokedAt AS revokedAt, u.disabledAt AS disabledAt " +
        "FROM devices d JOIN users u ON u.id = d.userId WHERE d.id = $id",
    )
    .get({ id: deviceId }) as {
    userId: string;
    name: string;
    deviceName: string;
    publicKey: string;
    revokedAt: number | null;
    disabledAt: number | null;
  } | null;
  if (!row) return null;
  return {
    userId: row.userId,
    name: row.name,
    deviceName: row.deviceName,
    publicKey: row.publicKey,
    revoked: row.revokedAt !== null,
    userDisabled: row.disabledAt !== null,
  };
}

export function touchDevice(sdb: ServerDb, deviceId: string, now: number): void {
  sdb.db.query("UPDATE devices SET lastSeenAt = $now WHERE id = $id").run({ now, id: deviceId });
}

export function listDevices(sdb: ServerDb, userId: string): DeviceInfo[] {
  return sdb.db
    .query(
      "SELECT id AS deviceId, name, createdAt, lastSeenAt, revokedAt FROM devices WHERE userId = $userId ORDER BY createdAt, id",
    )
    .all({ userId }) as DeviceInfo[];
}

export function revokeDevice(sdb: ServerDb, input: { deviceId: string; by: string }, now: number): void {
  const res = sdb.db
    .query("UPDATE devices SET revokedAt = $now WHERE id = $id AND revokedAt IS NULL")
    .run({ now, id: input.deviceId });
  if (res.changes === 0 && !deviceRecord(sdb, input.deviceId)) throw new KiboError("NOT_FOUND", `device ${input.deviceId} not found`);
  audit(sdb, { at: now, kind: "device-revoked", userId: input.by, deviceId: input.deviceId });
}

export function disableUser(sdb: ServerDb, userId: string, now: number): void {
  const res = sdb.db.query("UPDATE users SET disabledAt = $now WHERE id = $id AND disabledAt IS NULL").run({ now, id: userId });
  if (res.changes === 0 && !sdb.db.query("SELECT 1 FROM users WHERE id = $id").get({ id: userId })) {
    throw new KiboError("NOT_FOUND", `user ${userId} not found`);
  }
  audit(sdb, { at: now, kind: "user-disabled", userId });
}
```

`touchDevice` est une signature **nouvelle** (utilisée par `verifyChallenge`).

`packages/sync-server/src/members.ts` :
```ts
import { KiboError, type MemberInfo, type Role } from "@kibo/schema";
import { audit } from "./audit";
import type { ServerDb } from "./db";

export function insertProject(
  sdb: ServerDb,
  input: { id: string; ownerId: string; name: string; ticketSeq: number },
  now: number,
): void {
  sdb.db.transaction(() => {
    sdb.db
      .query("INSERT INTO projects (id, ownerId, name, createdAt, ticketSeq) VALUES ($id, $ownerId, $name, $now, $ticketSeq)")
      .run({ ...input, now });
    sdb.db
      .query("INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, 'owner', $now)")
      .run({ p: input.id, u: input.ownerId, now });
  })();
}

export function roleOf(sdb: ServerDb, projectId: string, userId: string): Role | null {
  const row = sdb.db.query("SELECT role FROM members WHERE projectId = $p AND userId = $u").get({ p: projectId, u: userId }) as
    | { role: Role }
    | null;
  return row?.role ?? null;
}

export function listMembers(sdb: ServerDb, projectId: string): MemberInfo[] {
  return sdb.db
    .query(
      "SELECT m.userId AS userId, u.name AS name, m.role AS role FROM members m JOIN users u ON u.id = m.userId " +
        "WHERE m.projectId = $p ORDER BY m.addedAt, m.userId",
    )
    .all({ p: projectId }) as MemberInfo[];
}

export function setRole(sdb: ServerDb, input: { projectId: string; userId: string; role: Role | null }, now: number): void {
  sdb.db.transaction(() => {
    const current = roleOf(sdb, input.projectId, input.userId);
    if (current === "owner" && input.role !== "owner") {
      const owners = sdb.db
        .query("SELECT COUNT(*) AS n FROM members WHERE projectId = $p AND role = 'owner'")
        .get({ p: input.projectId }) as { n: number };
      if (owners.n <= 1) throw new KiboError("FORBIDDEN", "a shared project keeps at least one owner");
    }
    if (input.role === null) {
      if (current === null) throw new KiboError("NOT_FOUND", `user ${input.userId} is not a member`);
      sdb.db.query("DELETE FROM members WHERE projectId = $p AND userId = $u").run({ p: input.projectId, u: input.userId });
      audit(sdb, { at: now, kind: "member-removed", userId: input.userId, projectId: input.projectId });
      return;
    }
    sdb.db
      .query(
        "INSERT INTO members (projectId, userId, role, addedAt) VALUES ($p, $u, $role, $now) " +
          "ON CONFLICT(projectId, userId) DO UPDATE SET role = excluded.role",
      )
      .run({ p: input.projectId, u: input.userId, role: input.role, now });
    audit(sdb, { at: now, kind: "role-changed", userId: input.userId, projectId: input.projectId, detail: input.role });
  })();
}

export function projectsOf(sdb: ServerDb, userId: string): { id: string; name: string; role: Role }[] {
  return sdb.db
    .query(
      "SELECT p.id AS id, p.name AS name, m.role AS role FROM members m JOIN projects p ON p.id = m.projectId " +
        "WHERE m.userId = $u ORDER BY p.createdAt, p.id",
    )
    .all({ u: userId }) as { id: string; name: string; role: Role }[];
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `bun test packages/sync-server/src/db.test.ts packages/sync-server/src/accounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Écrire les tests d'authentification et des limiteurs**

`packages/sync-server/src/auth.test.ts` :
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { challengePayload } from "@kibo/schema";
import { generateKeyPair, signBytes } from "@kibo/trust";
import { createInvite, disableUser, redeemDeviceInvite, revokeDevice } from "./accounts";
import { newNonce, verifyChallenge } from "./auth";
import { openServerDb, type ServerDb } from "./db";

const ORIGIN = "wss://sync.kibo.test";
let sdb: ServerDb;
let device: { userId: string; deviceId: string; keys: Awaited<ReturnType<typeof generateKeyPair>> };

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, 1);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" }, 1);
  device = { userId: joined.userId, deviceId: joined.deviceId, keys };
});

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "no-code",
  );

describe("verifyChallenge", () => {
  test("nonces are 32 random bytes in base64", () => {
    const a = newNonce();
    expect(Buffer.from(a, "base64")).toHaveLength(32);
    expect(newNonce()).not.toBe(a);
  });
  test("accepts a signature of the nonce and the origin, and touches the device", async () => {
    const nonce = newNonce();
    const signature = await signBytes(device.keys.privateKey, challengePayload(nonce, ORIGIN));
    const who = await verifyChallenge(sdb, { deviceId: device.deviceId, signature, nonce, origin: ORIGIN }, 99);
    expect(who).toEqual({ userId: device.userId, deviceId: device.deviceId, name: "Adam" });
    const row = sdb.db.query("SELECT lastSeenAt FROM devices WHERE id = $id").get({ id: device.deviceId }) as { lastSeenAt: number };
    expect(row.lastSeenAt).toBe(99);
  });
  test("a signature of another nonce (replay) is refused", async () => {
    const signature = await signBytes(device.keys.privateKey, challengePayload(newNonce(), ORIGIN));
    expect(await outcome(verifyChallenge(sdb, { deviceId: device.deviceId, signature, nonce: newNonce(), origin: ORIGIN }, 2))).toBe(
      "UNAUTHORIZED",
    );
  });
  test("a signature for another server origin is refused", async () => {
    const nonce = newNonce();
    const signature = await signBytes(device.keys.privateKey, challengePayload(nonce, "wss://evil.test"));
    expect(await outcome(verifyChallenge(sdb, { deviceId: device.deviceId, signature, nonce, origin: ORIGIN }, 2))).toBe(
      "UNAUTHORIZED",
    );
  });
  test("an unknown device is refused", async () => {
    const nonce = newNonce();
    const signature = await signBytes(device.keys.privateKey, challengePayload(nonce, ORIGIN));
    expect(await outcome(verifyChallenge(sdb, { deviceId: "nope", signature, nonce, origin: ORIGIN }, 2))).toBe("UNAUTHORIZED");
  });
  test("a revoked device is DEVICE_REVOKED", async () => {
    revokeDevice(sdb, { deviceId: device.deviceId, by: "admin" }, 2);
    const nonce = newNonce();
    const signature = await signBytes(device.keys.privateKey, challengePayload(nonce, ORIGIN));
    expect(await outcome(verifyChallenge(sdb, { deviceId: device.deviceId, signature, nonce, origin: ORIGIN }, 3))).toBe(
      "DEVICE_REVOKED",
    );
  });
  test("a disabled user is DEVICE_REVOKED", async () => {
    disableUser(sdb, device.userId, 2);
    const nonce = newNonce();
    const signature = await signBytes(device.keys.privateKey, challengePayload(nonce, ORIGIN));
    expect(await outcome(verifyChallenge(sdb, { deviceId: device.deviceId, signature, nonce, origin: ORIGIN }, 3))).toBe(
      "DEVICE_REVOKED",
    );
  });
});
```

`packages/sync-server/src/limits.test.ts` :
```ts
import { expect, test } from "bun:test";
import { SYNC_LIMITS } from "@kibo/schema";
import { FailureLimiter, RateWindow } from "./limits";

test("five failures in a minute block the key for five minutes", () => {
  let now = 0;
  const limiter = new FailureLimiter({
    max: SYNC_LIMITS.authFailuresPerMinute,
    windowMs: 60_000,
    blockMs: SYNC_LIMITS.authBlockMs,
    now: () => now,
  });
  for (let i = 0; i < 4; i++) limiter.fail("1.2.3.4");
  expect(limiter.blocked("1.2.3.4")).toBe(false);
  limiter.fail("1.2.3.4");
  expect(limiter.blocked("1.2.3.4")).toBe(true);
  expect(limiter.blocked("5.6.7.8")).toBe(false);
  now = SYNC_LIMITS.authBlockMs - 1;
  expect(limiter.blocked("1.2.3.4")).toBe(true);
  now = SYNC_LIMITS.authBlockMs + 1;
  expect(limiter.blocked("1.2.3.4")).toBe(false);
});

test("failures older than the window do not count", () => {
  let now = 0;
  const limiter = new FailureLimiter({ max: 5, windowMs: 60_000, blockMs: 300_000, now: () => now });
  for (let i = 0; i < 4; i++) limiter.fail("ip");
  now = 61_000;
  limiter.fail("ip");
  expect(limiter.blocked("ip")).toBe(false);
});

test("a rate window allows the limit per window, per key", () => {
  let now = 1000;
  const rate = new RateWindow({ limit: SYNC_LIMITS.updatesPerSecond, windowMs: 1000, now: () => now });
  for (let i = 0; i < 100; i++) expect(rate.take("d1")).toBe(true);
  expect(rate.take("d1")).toBe(false);
  expect(rate.take("d2")).toBe(true);
  now = 2001;
  expect(rate.take("d1")).toBe(true);
});
```

- [ ] **Step 6: Vérifier l'échec**

Run: `bun test packages/sync-server/src/auth.test.ts packages/sync-server/src/limits.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 7: Implémenter l'authentification et les limiteurs**

`packages/sync-server/src/auth.ts` :
```ts
import { challengePayload, KiboError } from "@kibo/schema";
import { toBase64, verifyBytes } from "@kibo/trust";
import { deviceRecord, touchDevice } from "./accounts";
import type { ServerDb } from "./db";

export function newNonce(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)));
}

export async function verifyChallenge(
  sdb: ServerDb,
  input: { deviceId: string; signature: string; nonce: string; origin: string },
  now: number,
): Promise<{ userId: string; deviceId: string; name: string }> {
  const device = deviceRecord(sdb, input.deviceId);
  if (!device) throw new KiboError("UNAUTHORIZED", "unknown device");
  const valid = await verifyBytes(device.publicKey, challengePayload(input.nonce, input.origin), input.signature);
  if (!valid) throw new KiboError("UNAUTHORIZED", "invalid challenge signature");
  if (device.revoked || device.userDisabled) throw new KiboError("DEVICE_REVOKED", "device or user has been revoked");
  touchDevice(sdb, input.deviceId, now);
  return { userId: device.userId, deviceId: input.deviceId, name: device.name };
}
```

`packages/sync-server/src/limits.ts` :
```ts
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();
  private readonly blockedUntil = new Map<string, number>();

  constructor(private readonly opts: { max: number; windowMs: number; blockMs: number; now: () => number }) {}

  blocked(key: string): boolean {
    const until = this.blockedUntil.get(key);
    if (until === undefined) return false;
    if (until > this.opts.now()) return true;
    this.blockedUntil.delete(key);
    return false;
  }

  fail(key: string): void {
    const now = this.opts.now();
    const recent = (this.failures.get(key) ?? []).filter((t) => t > now - this.opts.windowMs);
    recent.push(now);
    if (recent.length >= this.opts.max) {
      this.blockedUntil.set(key, now + this.opts.blockMs);
      this.failures.delete(key);
      return;
    }
    this.failures.set(key, recent);
  }
}

export class RateWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly opts: { limit: number; windowMs: number; now: () => number }) {}

  take(key: string): boolean {
    const now = this.opts.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.opts.windowMs);
    if (recent.length >= this.opts.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
```

`packages/sync-server/src/index.ts` :
```ts
export * from "./accounts";
export * from "./audit";
export * from "./auth";
export * from "./db";
export * from "./limits";
export * from "./members";
```

- [ ] **Step 8: Vérifier le succès, lint et types**

Run: `bun test packages/sync-server && bun run check && bun run typecheck`
Expected: PASS (dont le test de fumée de T1), Biome et `tsc` sans erreur.

- [ ] **Step 9: Commit**

```bash
git add packages/sync-server/src/db.ts packages/sync-server/src/accounts.ts packages/sync-server/src/members.ts packages/sync-server/src/audit.ts packages/sync-server/src/auth.ts packages/sync-server/src/limits.ts packages/sync-server/src/index.ts packages/sync-server/src/db.test.ts packages/sync-server/src/accounts.test.ts packages/sync-server/src/auth.test.ts packages/sync-server/src/limits.test.ts
git commit -m "feat(sync-server): comptes et invitations"
```

---

### Task 12: Isolation OS du backend sandboxé

Vague 2, tâche à risque (relue aussi par `kibo-lead`). Spec H §8 (critère de sortie : le test `escape` passe sur macOS et Linux en CI avec le durcissement actif), spec B §4.4. Dépend de T8 (`wrapCommand`, `detectSandbox`) et de T1 (`LocalSettings`, `SANDBOX_UNAVAILABLE`), T9 (`RpcExtension`, `requireLocal`).

Trois changements dans le backend de la phase 4 :
1. Le `ProcessHost` ne lance plus le runtime directement : il demande à un `SandboxService` la commande enveloppée (`bwrap` ou `sandbox-exec`), ou échoue en `SANDBOX_UNAVAILABLE`.
2. **Canal IPC** : `bwrap --clearenv` efface la variable par laquelle Bun transmet son canal `ipc` au fils (le fils direct est `bwrap`, pas le runtime). Le canal passe donc en **JSON par lignes sur stdin/stdout** (spec H §8.1 : « IPC par stdin/stdout »), stderr restant le journal. Les messages (spec B §6.3) ne changent pas.
3. Le runtime lit `server.js` dans `KIBO_COMPONENT_DIR` (chemin **vu du bac à sable** : `/kibo/component` sous Linux, le chemin réel sous macOS, où `sandbox-exec` ne remappe rien).

- Hypothèse v0.6 (vérifiée en T0) : `ProcessHost` (`packages/daemon/src/components/backend/process-host.ts`) reçoit `ProcessHostOptions = { storeDir: string; spawnCommand: SpawnCommand; logEvent(e: ComponentEvent): void }` et expose `invoke(input: BackendInvoke): Promise<unknown>` avec `BackendInvoke = { ref: { id: string; version: string; hash: string }; instanceId: string; config: Record<string, unknown>; target: { action: string } | { job: string }; input: unknown }`.
- Hypothèse v0.6 (vérifiée en T0) : `packages/daemon/src/testing/install-fixture.ts` (utilisé par le test de sortie `evil` de la phase 4) exporte `installFixtureComponent(input: { home: string; srcDir: string; trust: "trusted" | "sandboxed" }): Promise<{ ref: { id: string; version: string; hash: string }; buildDir: string; storeDir: string }>`.
- Hypothèse v0.6 (vérifiée en T0) : `defineServer` de `@kibo/sdk/server` s'exporte par `export const server = defineServer({ actions })` dans `server.ts` ; le dossier `packages/daemon/src/testing/fixtures/` est exclu du `tsconfig` du démon (comme la fixture `evil`).

**Files:**
- Create: `packages/daemon/src/sandbox/sandbox-service.ts`, `packages/daemon/src/sandbox/rpc.ts`, `packages/daemon/src/components/backend/line-channel.ts`, `packages/daemon/src/testing/fixtures/escape/kibo.component.json`, `packages/daemon/src/testing/fixtures/escape/ui.tsx`, `packages/daemon/src/testing/fixtures/escape/server.ts`
- Modify: `packages/daemon/src/components/backend/process-host.ts` (lancement via `SandboxService`, canal par lignes), `packages/daemon/src/component-runtime.ts` (canal par lignes, `KIBO_COMPONENT_DIR`), `packages/daemon/src/main.ts` (sonde au démarrage, extension RPC)
- Test: `packages/daemon/src/sandbox/sandbox-service.test.ts`, `packages/daemon/src/components/backend/line-channel.test.ts`, `packages/daemon/src/sandbox/escape.test.ts`

**Interfaces:**
- Consumes: `detectSandbox`, `realDetectDeps`, `wrapCommand`, `SandboxPolicy`, `SandboxProbe` (T8) ; `LocalSettings` (T1) ; `SandboxStatus`, RPC `getSandboxStatus` / `setAllowUnsandboxed`, `DaemonEvent` `{ type: "sandbox" }` (T4) ; `RpcExtension`, `requireLocal` (T9).
- Produces (nouveau, signalé) :
  ```ts
  // sandbox/sandbox-service.ts
  export type RuntimeCommand = { command: string; args: string[]; extraReadOnly: string[] };
  export type SandboxService = {
    status(): SandboxStatus;
    setAllowUnsandboxed(allow: boolean): SandboxStatus;
    launch(input: { componentRef: string; buildDir: string; tmpDir: string }): { argv: string[]; env: Record<string, string>; componentDir: string; isolated: boolean };
  };
  export function currentRuntime(): RuntimeCommand;
  export function createSandboxService(deps: { probe: SandboxProbe; settings: LocalSettings; runtime: RuntimeCommand; publish(e: DaemonEvent): void }): SandboxService;
  export const ALLOW_UNSANDBOXED_KEY = "sandbox.allowUnsandboxed";
  // sandbox/rpc.ts
  export function sandboxRpc(service: SandboxService): RpcExtension;
  // components/backend/line-channel.ts
  export type LineChannel = { send(message: unknown): void; onMessage(fn: (message: unknown) => void): void; close(): void };
  export function createLineChannel(input: ReadableStream<Uint8Array>, write: (text: string) => void, onError: (e: Error) => void): LineChannel;
  ```

- [ ] **Step 1: Écrire le test du canal par lignes**

`packages/daemon/src/components/backend/line-channel.test.ts` :
```ts
import { expect, test } from "bun:test";
import { createLineChannel } from "./line-channel";

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
      c.close();
    },
  });

test("messages split across chunks are reassembled line by line", async () => {
  const received: unknown[] = [];
  const done = new Promise<void>((r) => setTimeout(r, 20));
  const channel = createLineChannel(streamOf(['{"type":"res', 'ult","id":1}\n{"type":"call"', ',"id":2}\n']), () => {}, (e) => {
    throw e;
  });
  channel.onMessage((m) => received.push(m));
  await done;
  expect(received).toEqual([{ type: "result", id: 1 }, { type: "call", id: 2 }]);
});

test("send writes one JSON document per line", () => {
  const out: string[] = [];
  const channel = createLineChannel(streamOf([]), (t) => out.push(t), (e) => {
    throw e;
  });
  channel.send({ type: "invoke", id: 3, input: "a\nb" });
  expect(out).toEqual(['{"type":"invoke","id":3,"input":"a\\nb"}\n']);
});

test("an invalid line is reported, never dropped silently", async () => {
  const errors: string[] = [];
  const channel = createLineChannel(streamOf(["not json\n"]), () => {}, (e) => errors.push(e.message));
  channel.onMessage(() => {});
  await new Promise((r) => setTimeout(r, 20));
  expect(errors).toEqual(["invalid IPC line: not json"]);
});
```

Run: `bun test packages/daemon/src/components/backend/line-channel.test.ts`
Expected: FAIL avec « Cannot find module './line-channel' ».

- [ ] **Step 2: Implémenter le canal**

`packages/daemon/src/components/backend/line-channel.ts` :
```ts
export type LineChannel = {
  send(message: unknown): void;
  onMessage(fn: (message: unknown) => void): void;
  close(): void;
};

export function createLineChannel(
  input: ReadableStream<Uint8Array>,
  write: (text: string) => void,
  onError: (e: Error) => void,
): LineChannel {
  const listeners = new Set<(message: unknown) => void>();
  const reader = input.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let open = true;

  const deliver = (line: string) => {
    if (!line.trim()) return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      onError(new Error(`invalid IPC line: ${line.slice(0, 200)}`));
      return;
    }
    for (const l of listeners) l(message);
  };

  const pump = async () => {
    while (open) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        deliver(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
  };
  pump().catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))));

  return {
    send: (message) => write(`${JSON.stringify(message)}\n`),
    onMessage: (fn) => {
      listeners.add(fn);
    },
    close: () => {
      open = false;
      reader.cancel().catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))));
    },
  };
}
```
Le `catch` de `JSON.parse` convertit l'erreur en signalement (`onError`), il ne l'avale pas.

Run: `bun test packages/daemon/src/components/backend/line-channel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Écrire le test du service d'isolation**

`packages/daemon/src/sandbox/sandbox-service.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { DaemonEvent } from "@kibo/schema";
import { z } from "zod";
import { openLocalSettings } from "../settings";
import { sandboxRpc } from "./rpc";
import { createSandboxService } from "./sandbox-service";
import type { SandboxProbe } from "./types";

const runtime = { command: "/opt/kibo/kibo-daemon", args: ["component-runtime"], extraReadOnly: [] };
const bwrapOk: SandboxProbe = { kind: "bwrap", available: true, reason: null, fix: null, bwrapPath: "/usr/bin/bwrap", libs: ["/lib64/ld-linux-x86-64.so.2"] };
const macOk: SandboxProbe = { kind: "sandbox-exec", available: true, reason: null, fix: null, bwrapPath: null, libs: [] };
const off: SandboxProbe = { kind: "bwrap", available: false, reason: "bubblewrap (bwrap) is not installed", fix: "sudo apt install bubblewrap", bwrapPath: null, libs: [] };

const make = (probe: SandboxProbe) => {
  const events: DaemonEvent[] = [];
  const settings = openLocalSettings(new Database(":memory:", { strict: true }));
  return { service: createSandboxService({ probe, settings, runtime, publish: (e) => events.push(e) }), events, settings };
};
const launchInput = { componentRef: "escape@0.1.0", buildDir: "/store/escape/0.1.0/ab12/build", tmpDir: "/tmp/kibo-rt-9" };

describe("sandbox service", () => {
  test("status reflects the probe and the setting, off by default", () => {
    expect(make(off).service.status()).toEqual({
      kind: "bwrap",
      available: false,
      reason: "bubblewrap (bwrap) is not installed",
      fix: "sudo apt install bubblewrap",
      allowUnsandboxed: false,
    });
  });

  test("bwrap: the build is mounted at /kibo/component and the runtime reads it there", () => {
    const launch = make(bwrapOk).service.launch(launchInput);
    expect(launch.isolated).toBe(true);
    expect(launch.componentDir).toBe("/kibo/component");
    expect(launch.argv).toContain("--clearenv");
    const i = launch.argv.indexOf("/store/escape/0.1.0/ab12/build");
    expect(launch.argv.slice(i - 1, i + 2)).toEqual(["--ro-bind", "/store/escape/0.1.0/ab12/build", "/kibo/component"]);
    expect(launch.argv).toContain("KIBO_COMPONENT_DIR");
    expect(launch.argv.slice(-2)).toEqual(["/kibo/runtime", "component-runtime"]);
  });

  test("sandbox-exec: the runtime reads the real build path", () => {
    const launch = make(macOk).service.launch(launchInput);
    expect(launch.componentDir).toBe("/store/escape/0.1.0/ab12/build");
    expect(launch.env).toEqual({ KIBO_COMPONENT: "escape@0.1.0", KIBO_COMPONENT_DIR: "/store/escape/0.1.0/ab12/build" });
  });

  test("no isolation: refuses to launch unless explicitly allowed, and publishes the change", () => {
    const { service, events, settings } = make(off);
    expect(() => service.launch(launchInput)).toThrow("SANDBOX_UNAVAILABLE");
    expect(service.setAllowUnsandboxed(true).allowUnsandboxed).toBe(true);
    expect(events).toEqual([{ type: "sandbox" }]);
    expect(settings.get("sandbox.allowUnsandboxed", z.boolean(), false)).toBe(true);
    const launch = service.launch(launchInput);
    expect(launch.isolated).toBe(false);
    expect(launch.argv).toEqual(["/opt/kibo/kibo-daemon", "component-runtime"]);
  });

  test("setAllowUnsandboxed is refused from a remote session", async () => {
    const rpc = sandboxRpc(make(off).service);
    await expect(rpc.handle({ method: "setAllowUnsandboxed", allow: true }, { sessionHash: "h", remote: true })).rejects.toThrow("FORBIDDEN");
    expect(await rpc.handle({ method: "getSandboxStatus" }, { sessionHash: "h", remote: true })).toMatchObject({ available: false });
  });
});
```
Run: `bun test packages/daemon/src/sandbox/sandbox-service.test.ts`
Expected: FAIL avec « Cannot find module './sandbox-service' ».

- [ ] **Step 4: Implémenter le service et les RPC**

`packages/daemon/src/sandbox/sandbox-service.ts` :
```ts
import { dirname, resolve } from "node:path";
import type { DaemonEvent, SandboxStatus } from "@kibo/schema";
import { z } from "zod";
import type { LocalSettings } from "../settings";
import { wrapCommand } from "./os-sandbox";
import type { SandboxPolicy, SandboxProbe } from "./types";

export const ALLOW_UNSANDBOXED_KEY = "sandbox.allowUnsandboxed";
const COMPONENT_GUEST = "/kibo/component";

export type RuntimeCommand = { command: string; args: string[]; extraReadOnly: string[] };
export type SandboxService = {
  status(): SandboxStatus;
  setAllowUnsandboxed(allow: boolean): SandboxStatus;
  launch(input: { componentRef: string; buildDir: string; tmpDir: string }): {
    argv: string[];
    env: Record<string, string>;
    componentDir: string;
    isolated: boolean;
  };
};

export function currentRuntime(): RuntimeCommand {
  if (Bun.main.startsWith("/$bunfs/")) return { command: process.execPath, args: ["component-runtime"], extraReadOnly: [] };
  const script = resolve(import.meta.dir, "../component-runtime.ts");
  const repo = resolve(import.meta.dir, "../../../..");
  return { command: process.execPath, args: [script], extraReadOnly: [repo, dirname(process.execPath)] };
}

export function createSandboxService(deps: {
  probe: SandboxProbe;
  settings: LocalSettings;
  runtime: RuntimeCommand;
  publish(e: DaemonEvent): void;
}): SandboxService {
  const allowed = () => deps.settings.get(ALLOW_UNSANDBOXED_KEY, z.boolean(), false);
  const status = (): SandboxStatus => ({
    kind: deps.probe.kind,
    available: deps.probe.available,
    reason: deps.probe.reason,
    fix: deps.probe.fix,
    allowUnsandboxed: allowed(),
  });
  return {
    status,
    setAllowUnsandboxed(allow) {
      deps.settings.set(ALLOW_UNSANDBOXED_KEY, allow);
      deps.publish({ type: "sandbox" });
      return status();
    },
    launch({ componentRef, buildDir, tmpDir }) {
      const remapped = deps.probe.available && deps.probe.kind === "bwrap";
      const componentDir = remapped ? COMPONENT_GUEST : buildDir;
      const policy: SandboxPolicy = {
        runtime: deps.runtime.command,
        args: deps.runtime.args,
        readOnly: [
          { host: buildDir, guest: componentDir },
          ...deps.runtime.extraReadOnly.map((p) => ({ host: p, guest: p })),
        ],
        tmpDir,
        env: { KIBO_COMPONENT: componentRef, KIBO_COMPONENT_DIR: componentDir },
      };
      return { ...wrapCommand(deps.probe, policy, allowed()), componentDir };
    },
  };
}
```
En développement (`bun src/main.ts`), le runtime est le script TypeScript : le dépôt et le dossier de `bun` sont montés en lecture ; le binaire compilé (production, test `escape`) n'en a pas besoin.

`packages/daemon/src/sandbox/rpc.ts` :
```ts
import { KiboError, type RpcRequest } from "@kibo/schema";
import { requireLocal, type RpcContext, type RpcExtension } from "../rpc-extensions";
import type { SandboxService } from "./sandbox-service";

export function sandboxRpc(service: SandboxService): RpcExtension {
  return {
    methods: ["getSandboxStatus", "setAllowUnsandboxed"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "getSandboxStatus") return service.status();
      if (req.method === "setAllowUnsandboxed") {
        requireLocal(ctx);
        return service.setAllowUnsandboxed(req.allow);
      }
      throw new KiboError("INTERNAL", `sandboxRpc cannot handle ${req.method}`);
    },
  };
}
```

Run: `bun test packages/daemon/src/sandbox/sandbox-service.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Brancher le `ProcessHost` et le runtime**

Dans `process-host.ts`, la fonction de lancement devient (le reste de la phase 4 — délais, 4 appels simultanés, arrêt après 5 min, backoff de redémarrage, `COMPONENT_CRASHED` — est inchangé) :
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import type { SandboxService } from "../../sandbox/sandbox-service";
import { createLineChannel, type LineChannel } from "./line-channel";

type Launched = { proc: ReturnType<typeof Bun.spawn>; channel: LineChannel; tmpDir: string; isolated: boolean };

function launchRuntime(
  sandbox: SandboxService,
  ref: { id: string; version: string },
  buildDir: string,
  onError: (e: Error) => void,
): Launched {
  const tmpDir = mkdtempSync(join(tmpdir(), "kibo-rt-"));
  let launch: ReturnType<SandboxService["launch"]>;
  try {
    launch = sandbox.launch({ componentRef: `${ref.id}@${ref.version}`, buildDir, tmpDir });
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw e;
  }
  const proc = Bun.spawn(launch.argv, {
    cwd: tmpDir,
    env: launch.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const channel = createLineChannel(proc.stdout, (text) => {
    proc.stdin.write(text);
    proc.stdin.flush();
  }, onError);
  return { proc, channel, tmpDir, isolated: launch.isolated };
}
```
`ProcessHostOptions` remplace `spawnCommand` par `sandbox: SandboxService`. À l'échec de `launchRuntime` par `KiboError("SANDBOX_UNAVAILABLE")`, `invoke` rejette avec cette erreur et appelle `logEvent({ at, projectId, instanceId, ref: \`${id}@${version}\`, kind: "action", code: "SANDBOX_UNAVAILABLE" })` ; le backoff de redémarrage ne s'applique pas (rien n'a planté). Le message `load` ne porte plus de descripteur : le runtime lit `server.js` dans `KIBO_COMPONENT_DIR`. `tmpDir` est supprimé à l'arrêt du processus (`proc.exited.then(...)`, erreur journalisée si la suppression échoue). Chaque message envoyé passe par `channel.send`, chaque réponse par `channel.onMessage` ; `stderr` reste journalisé et tronqué à 64 Kio.

Dans `component-runtime.ts`, remplacer l'écoute `process.on("message")` / `process.send` par :
```ts
import { join } from "node:path";
import { createLineChannel } from "./components/backend/line-channel";

const channel = createLineChannel(
  Bun.stdin.stream(),
  (text) => {
    process.stdout.write(text);
  },
  (e) => {
    process.stderr.write(`[component-runtime] ${e.message}\n`);
  },
);
const componentDir = process.env.KIBO_COMPONENT_DIR;
if (!componentDir) throw new Error("KIBO_COMPONENT_DIR is not set");
const serverPath = join(componentDir, "server.js");
```
puis `channel.onMessage(handle)` et `channel.send(reply)` à la place des appels IPC ; le chargement lit `serverPath` **avant** le retrait des capacités (spec B §4.4 : `Bun.file` est retiré ensuite), puis évalue le code comme en phase 4. Toute écriture de journal du runtime va sur `stderr` (stdout est réservé au canal).

Dans `main.ts` :
```ts
import { detectSandbox, realDetectDeps } from "./sandbox/detect";
import { sandboxRpc } from "./sandbox/rpc";
import { createSandboxService, currentRuntime } from "./sandbox/sandbox-service";

const runtime = currentRuntime();
const sandboxProbe = await detectSandbox(realDetectDeps(), runtime.command);
if (!sandboxProbe.available) console.warn(`[kibo-daemon] OS sandbox unavailable: ${sandboxProbe.reason}`);
const sandbox = createSandboxService({ probe: sandboxProbe, settings, runtime, publish: (e) => server.publish(e) });
```
et `sandboxRpc(sandbox)` dans `extensions` ; le `ProcessHost` reçoit `sandbox`. (`server` est déclaré après : `publish` est appelé plus tard, à la première modification du réglage.)

Run: `bun test packages/daemon`
Expected: PASS, dont les tests de la phase 4 sur le `ProcessHost` (sous Linux sans bubblewrap et en local seulement, ils passent par `allowUnsandboxed` : leur mise en place règle `sandbox.allowUnsandboxed = true`, sans changer leurs attentes).

- [ ] **Step 6: Écrire le composant fixture `escape`**

`packages/daemon/src/testing/fixtures/escape/kibo.component.json` :
```json
{
  "id": "escape",
  "version": "0.1.0",
  "kind": "widget",
  "title": "Escape",
  "description": "Fixture de test : tente de sortir du bac à sable.",
  "reads": [],
  "writes": [],
  "data": false,
  "net": []
}
```

`packages/daemon/src/testing/fixtures/escape/ui.tsx` :
```tsx
export function EscapeWidget() {
  return <p>escape</p>;
}
```

`packages/daemon/src/testing/fixtures/escape/server.ts` :
```ts
import { defineServer } from "@kibo/sdk/server";

type Outcome = { ok: boolean; error: string | null };
type Socket = { once(event: string, fn: (arg?: unknown) => void): void; end(): void };
type NetModule = { connect(port: number, host: string): Socket };
type FsModule = { readFileSync(path: string, enc: string): string; writeFileSync(path: string, data: string): void };
type SpawnResult = { error?: Error; status: number | null };
type ChildModule = { spawnSync(cmd: string, args: string[]): SpawnResult };

const builtin = (name: string): Promise<unknown> => import(["node", name].join(":"));

const attempt = async (fn: () => Promise<unknown>): Promise<Outcome> => {
  try {
    await fn();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const field = (input: unknown, key: string): string => {
  const value = typeof input === "object" && input !== null ? (input as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`missing ${key}`);
  return String(value);
};

export const server = defineServer({
  actions: {
    tryFetch: (_ctx, input) => attempt(() => fetch(field(input, "url"))),
    tryTcp: (_ctx, input) =>
      attempt(async () => {
        const net = (await builtin("net")) as NetModule;
        await new Promise((resolve, reject) => {
          const socket = net.connect(Number(field(input, "port")), "127.0.0.1");
          socket.once("connect", () => {
            socket.end();
            resolve(null);
          });
          socket.once("error", reject);
        });
      }),
    readToken: (_ctx, input) =>
      attempt(async () => {
        const fs = (await builtin("fs")) as FsModule;
        fs.readFileSync(field(input, "path"), "utf8");
      }),
    writeHome: (_ctx, input) =>
      attempt(async () => {
        const fs = (await builtin("fs")) as FsModule;
        fs.writeFileSync(field(input, "path"), "escaped");
      }),
    trySpawn: () =>
      attempt(async () => {
        const child = (await builtin("child_process")) as ChildModule;
        const result = child.spawnSync("/bin/sh", ["-c", "true"]);
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`exit ${String(result.status)}`);
      }),
  },
});
```
Les `as` sont justifiés : le spécificateur calculé empêche tout typage statique du module, c'est précisément ce que la fixture teste.

- [ ] **Step 7: Écrire le test `escape`**

`packages/daemon/src/sandbox/escape.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ProcessHost } from "../components/backend/process-host";
import { openLocalSettings } from "../settings";
import { installFixtureComponent } from "../testing/install-fixture";
import { detectSandbox, realDetectDeps } from "./detect";
import { createSandboxService } from "./sandbox-service";
import type { SandboxProbe } from "./types";

const required = process.env.KIBO_REQUIRE_OS_SANDBOX === "1";
const preProbe = await detectSandbox(realDetectDeps(), process.execPath);
const skipWithoutSandbox = !required && !preProbe.available;
const work = mkdtempSync(join(tmpdir(), "kibo-escape-"));
const runtimeBin = join(work, "kibo-daemon");
const fakeHome = join(work, "home");
const tokenPath = join(fakeHome, ".kibo", "token");
const events: { code: string }[] = [];
let probe: SandboxProbe;
let installed: Awaited<ReturnType<typeof installFixtureComponent>>;
let listener: ReturnType<typeof Bun.listen>;

beforeAll(async () => {
  const build = Bun.spawnSync([
    "bun",
    "build",
    "--compile",
    resolve(import.meta.dir, "../main.ts"),
    "--outfile",
    runtimeBin,
  ]);
  if (build.exitCode !== 0) throw new Error(`daemon build failed: ${build.stderr.toString()}`);
  probe = await detectSandbox(realDetectDeps(), runtimeBin);
  mkdirSync(join(fakeHome, ".kibo"), { recursive: true });
  writeFileSync(tokenPath, "e2e-secret-token\n", { mode: 0o600 });
  installed = await installFixtureComponent({
    home: join(work, "kibo-home"),
    srcDir: resolve(import.meta.dir, "../testing/fixtures/escape"),
    trust: "sandboxed",
  });
  listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
}, 120_000);

afterAll(() => {
  listener?.stop(true);
  rmSync(work, { recursive: true, force: true });
});

const hostWith = (allowUnsandboxed: boolean, useProbe: SandboxProbe) => {
  const settings = openLocalSettings(new Database(":memory:", { strict: true }));
  settings.set("sandbox.allowUnsandboxed", allowUnsandboxed);
  const sandbox = createSandboxService({
    probe: useProbe,
    settings,
    runtime: { command: runtimeBin, args: ["component-runtime"], extraReadOnly: [] },
    publish: () => {},
  });
  return new ProcessHost({ storeDir: installed.storeDir, sandbox, logEvent: (e) => events.push(e) });
};
const call = (host: ProcessHost, action: string, input: unknown) =>
  host.invoke({ ref: installed.ref, instanceId: "i-escape", config: {}, target: { action }, input }) as Promise<{
    ok: boolean;
    error: string | null;
  }>;

describe("sandboxed backend escape attempts", () => {
  test.skipIf(skipWithoutSandbox)("every attempt is blocked by the OS", async () => {
    expect(probe.available).toBe(true);
    const host = hostWith(false, probe);
    const target = join(fakeHome, "escaped.txt");
    const results = {
      fetch: await call(host, "tryFetch", { url: "https://example.com" }),
      tcp: await call(host, "tryTcp", { port: listener.port }),
      token: await call(host, "readToken", { path: tokenPath }),
      write: await call(host, "writeHome", { path: target }),
      spawn: await call(host, "trySpawn", {}),
    };
    for (const [name, r] of Object.entries(results)) expect({ name, ok: r.ok }).toEqual({ name, ok: false });
    expect(existsSync(target)).toBe(false);
  }, 60_000);

  test.skipIf(skipWithoutSandbox)("without OS isolation, phase 4 still removes fetch", async () => {
    const off: SandboxProbe = { kind: null, available: false, reason: "test", fix: null, bwrapPath: null, libs: [] };
    const host = hostWith(true, off);
    expect((await call(host, "tryFetch", { url: "https://example.com" })).ok).toBe(false);
  }, 60_000);

  test("no isolation and no permission: the call fails and is logged", async () => {
    const off: SandboxProbe = { kind: null, available: false, reason: "test", fix: null, bwrapPath: null, libs: [] };
    const host = hostWith(false, off);
    await expect(call(host, "tryFetch", { url: "https://example.com" })).rejects.toThrow("SANDBOX_UNAVAILABLE");
    expect(events.map((e) => e.code)).toContain("SANDBOX_UNAVAILABLE");
  }, 60_000);
});
```

`skipWithoutSandbox` est calculé au chargement du fichier par une sonde sur `process.execPath` (Bun évalue `skipIf` à la déclaration) ; `beforeAll` refait la sonde exacte sur le binaire compilé pour obtenir ses bibliothèques.

- [ ] **Step 8: Lancer le test `escape` et ajuster le profil macOS**

Run: `KIBO_REQUIRE_OS_SANDBOX=1 bun test packages/daemon/src/sandbox/escape.test.ts`
Expected: PASS sur macOS et sur Linux avec bubblewrap. Si le runtime ne démarre pas sous `sandbox-exec` (stderr du processus journalisé : `deny(1) file-read-data /chemin`), ajouter **une entrée par cause** à `EXTRA_RULES` de `macos.sb.ts` (`{ rule, reason }`, jamais un `(allow default)` ni un `subpath` de `/Users` ou `/private/var/folders`), relancer, et ajouter l'entrée au test « emits every extra rule » (T8). Sous Linux, une bibliothèque chargée par `dlopen` absente de `ldd` s'ajoute de la même façon (décision 14).

- [ ] **Step 9: Vérifier le lint et les types, commiter**

Run: `bun run check && bun run typecheck && bun test packages/daemon`
Expected: aucun diagnostic, tous les tests verts.

```bash
git add packages/daemon/src/sandbox/sandbox-service.ts packages/daemon/src/sandbox/rpc.ts packages/daemon/src/sandbox/sandbox-service.test.ts packages/daemon/src/sandbox/escape.test.ts packages/daemon/src/sandbox/macos.sb.ts packages/daemon/src/components/backend/line-channel.ts packages/daemon/src/components/backend/line-channel.test.ts packages/daemon/src/components/backend/process-host.ts packages/daemon/src/component-runtime.ts packages/daemon/src/main.ts packages/daemon/src/testing/fixtures/escape
git commit -m "feat(daemon): isolation OS des backends"
```

---

### Task 13: Accès distant au démon (TLS, code à 6 caractères)

Vague 2. Spec G §7 et §8 ; décisions 17 et 18 ; maquette 31 (« Code valable 5 minutes · usage unique ») et écran 15 (« Générer un code »). Désactivé par défaut. L'accès distant ouvre un **second** `Bun.serve`, chiffré, sur une adresse d'interface choisie ; le démon continue d'écouter sur `127.0.0.1`. Le même gestionnaire HTTP sert les deux écouteurs, avec des contrôles `Host` / `Origin` propres à chacun. L'appairage distant se fait **uniquement** par code à 6 caractères ; le jeton local reste réservé à `127.0.0.1`.

**Files:**
- Create: `packages/daemon/src/remote/pairing-codes.ts`, `packages/daemon/src/remote/interfaces.ts`, `packages/daemon/src/remote/remote-access.ts`, `packages/daemon/src/remote/rpc.ts`
- Modify: `packages/daemon/src/server.ts` (gestionnaire partagé, `/api/pair-code`, `listenRemote`), `packages/daemon/src/main.ts`, `packages/sdk/src/client.ts` (`pairWithCode`)
- Test: `packages/daemon/src/remote/pairing-codes.test.ts`, `packages/daemon/src/remote/interfaces.test.ts`, `packages/daemon/src/remote/remote-access.test.ts`, `packages/sdk/src/client.test.ts` (un cas ajouté)

**Interfaces:**
- Consumes: `generateSelfSignedCert`, `certFingerprint` (T3) ; `newPairingCode`, `normalizeCode` (T2) ; `RemoteAccessConfig`, `RemoteAccessStatus`, `PairingCode`, RPC `getRemoteAccess` / `enableRemoteAccess` / `disableRemoteAccess` / `createPairingCode` (T4) ; `LocalSettings` (T1) ; `SessionStore`, `RpcExtension`, `requireLocal` (T9) ; `SecretStore` avec le nom `remote:tls` (T1).
- Produces (Contrats partagés) : `PairingCodes`, `ListenInfo`, `RemoteAccess`.
- Produces (nouveau, signalé) :
  ```ts
  // remote/pairing-codes.ts
  export const PAIRING_CODE_TTL_MS = 5 * 60_000; export const PAIRING_MAX_FAILURES = 5;
  // remote/interfaces.ts
  export function listInterfaces(source?: NodeJS.Dict<NetworkInterfaceInfo[]>): { name: string; address: string }[];
  // remote/remote-access.ts
  export type RemoteListen = (input: { hostname: string; port: number; tls: { cert: string; key: string } }) => { port: number; stop(): void };
  export type RemoteAccessDeps = { home: string; settings: LocalSettings; secrets: SecretStore; interfaces(): { name: string; address: string }[]; listen: RemoteListen; log(message: string): void };
  export function createRemoteAccess(deps: RemoteAccessDeps): RemoteAccess;
  export const REMOTE_SETTING_KEY = "remoteAccess"; export const REMOTE_TLS_SECRET = "remote:tls";
  // remote/rpc.ts
  export function remoteRpc(remote: RemoteAccess, codes: PairingCodes): RpcExtension;
  // server.ts : ServerOptions gagne pairingCodes: PairingCodes ; startServer renvoie en plus listenRemote: RemoteListen
  // sdk client.ts : KiboClient.pairWithCode(code: string): Promise<void>
  ```
- Hypothèse v0.6 (vérifiée en T0) : `MemorySecretStore` est exporté par `packages/daemon/src/secrets/secret-store.ts` avec un constructeur sans argument.

- [ ] **Step 1: Écrire le test des codes d'appairage**

`packages/daemon/src/remote/pairing-codes.test.ts` :
```ts
import { beforeEach, expect, test } from "bun:test";
import { PAIRING_CODE_TTL_MS, PairingCodes } from "./pairing-codes";

let clock: number;
let codes: PairingCodes;
beforeEach(() => {
  clock = 1_000;
  codes = new PairingCodes(() => clock);
});

test("a code has 6 unambiguous characters and expires in 5 minutes", () => {
  const { code, expiresAt } = codes.create();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(expiresAt).toBe(1_000 + PAIRING_CODE_TTL_MS);
});

test("a code is single use", () => {
  const { code } = codes.create();
  expect(codes.redeem(code)).toBe(true);
  expect(codes.redeem(code)).toBe(false);
});

test("spaces, dashes and lower case are accepted", () => {
  const { code } = codes.create();
  const typed = ` ${code.slice(0, 3).toLowerCase()} - ${code.slice(3)} `;
  expect(codes.redeem(typed)).toBe(true);
});

test("an expired code is refused", () => {
  const { code } = codes.create();
  clock += PAIRING_CODE_TTL_MS;
  expect(codes.redeem(code)).toBe(false);
});

test("five wrong attempts invalidate every active code", () => {
  const a = codes.create();
  const b = codes.create();
  for (let i = 0; i < 4; i++) expect(codes.redeem("ZZZZZZ")).toBe(false);
  expect(codes.redeem(a.code)).toBe(true);
  expect(codes.redeem("ZZZZZZ")).toBe(false);
  expect(codes.redeem(b.code)).toBe(false);
  const c = codes.create();
  expect(codes.redeem(c.code)).toBe(true);
});
```
Un succès ne remet pas le compteur d'échecs à zéro (seul `create` le fait) : après 4 échecs puis le succès de `a`, un seul échec de plus atteint la limite et invalide `b`.

Run: `bun test packages/daemon/src/remote/pairing-codes.test.ts`
Expected: FAIL avec « Cannot find module './pairing-codes' ».

- [ ] **Step 2: Implémenter les codes**

`packages/daemon/src/remote/pairing-codes.ts` :
```ts
import type { PairingCode } from "@kibo/schema";
import { newPairingCode, normalizeCode } from "@kibo/trust";

export const PAIRING_CODE_TTL_MS = 5 * 60_000;
export const PAIRING_MAX_FAILURES = 5;

export class PairingCodes {
  private readonly active = new Map<string, number>();
  private failures = 0;

  constructor(private readonly now: () => number) {}

  create(): PairingCode {
    const code = newPairingCode();
    const expiresAt = this.now() + PAIRING_CODE_TTL_MS;
    this.active.set(code, expiresAt);
    this.failures = 0;
    return { code, expiresAt };
  }

  redeem(input: string): boolean {
    const at = this.now();
    for (const [code, expiresAt] of this.active) if (expiresAt <= at) this.active.delete(code);
    const code = normalizeCode(input);
    if (this.active.has(code)) {
      this.active.delete(code);
      return true;
    }
    this.failures += 1;
    if (this.failures >= PAIRING_MAX_FAILURES) {
      this.active.clear();
      this.failures = 0;
    }
    return false;
  }
}
```

Run: `bun test packages/daemon/src/remote/pairing-codes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Interfaces réseau**

`packages/daemon/src/remote/interfaces.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { NetworkInterfaceInfo } from "node:os";
import { listInterfaces } from "./interfaces";

const info = (address: string, family: "IPv4" | "IPv6"): NetworkInterfaceInfo =>
  ({ address, family, netmask: "", mac: "", internal: false, cidr: null, scopeid: 0 }) as NetworkInterfaceInfo;

test("lists concrete addresses, never the wildcard nor link-local IPv6", () => {
  expect(
    listInterfaces({
      lo0: [info("127.0.0.1", "IPv4"), info("::1", "IPv6")],
      en0: [info("192.168.1.20", "IPv4"), info("fe80::1c2b:3aff:fe4d:5e6f", "IPv6"), info("2a01:e0a::20", "IPv6")],
      bogus: [info("0.0.0.0", "IPv4"), info("::", "IPv6")],
    }),
  ).toEqual([
    { name: "lo0", address: "127.0.0.1" },
    { name: "lo0", address: "::1" },
    { name: "en0", address: "192.168.1.20" },
    { name: "en0", address: "2a01:e0a::20" },
  ]);
});
```
`as NetworkInterfaceInfo` : le type de Node est une union discriminée par `family` que l'objet littéral construit ne permet pas d'inférer.

`packages/daemon/src/remote/interfaces.ts` :
```ts
import { type NetworkInterfaceInfo, networkInterfaces } from "node:os";

const WILDCARDS = new Set(["0.0.0.0", "::"]);

export function listInterfaces(
  source: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): { name: string; address: string }[] {
  const out: { name: string; address: string }[] = [];
  for (const [name, infos] of Object.entries(source)) {
    for (const i of infos ?? []) {
      if (WILDCARDS.has(i.address) || i.address.toLowerCase().startsWith("fe80:")) continue;
      out.push({ name, address: i.address });
    }
  }
  return out;
}
```

Run: `bun test packages/daemon/src/remote/interfaces.test.ts`
Expected: PASS.

- [ ] **Step 4: Écrire le test d'intégration de l'accès distant**

`packages/daemon/src/remote/remote-access.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo } from "@kibo/schema";
import { MemorySecretStore } from "../secrets/secret-store";
import { startServer } from "../server";
import { createService } from "../service";
import { openSessionStore } from "../sessions/session-store";
import { openLocalSettings } from "../settings";
import { openStore, type Store } from "../store";
import { PairingCodes } from "./pairing-codes";
import { createRemoteAccess, type RemoteAccess } from "./remote-access";
import { remoteRpc } from "./rpc";

const TOKEN = "a".repeat(64);
let home: string;
let store: Store;
let codes: PairingCodes;
let secrets: MemorySecretStore;
let remote: RemoteAccess;
let server: ReturnType<typeof startServer>;
let port: number;

const freePort = () => {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const p = probe.port;
  probe.stop(true);
  return p;
};

const makeRemote = () =>
  createRemoteAccess({
    home,
    settings: openLocalSettings(store.db),
    secrets,
    interfaces: () => [{ name: "lo0", address: "127.0.0.1" }],
    listen: (input) => server.listenRemote(input),
    log: () => {},
  });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-remote-"));
  store = openStore(home);
  codes = new PairingCodes(Date.now);
  secrets = new MemorySecretStore();
  let current: RemoteAccess | null = null;
  server = startServer({
    service: createService(store, { user: "adam" }),
    sessions: openSessionStore(store.db),
    pairingCodes: codes,
    token: TOKEN,
    port: 0,
    uiDir: null,
    extensions: [
      {
        methods: ["getRemoteAccess", "enableRemoteAccess", "disableRemoteAccess", "createPairingCode"],
        handle: (req, ctx) => {
          if (!current) throw new Error("remote not ready");
          return remoteRpc(current, codes).handle(req, ctx);
        },
      },
    ],
  });
  remote = makeRemote();
  current = remote;
  port = freePort();
});
afterEach(() => {
  remote.stop();
  server.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const enable = () => remote.enable({ address: "127.0.0.1", port, tls: { kind: "self-signed" } });
const caOf = () => readFileSync(join(home, "remote", "cert.pem"), "utf8");
const rurl = () => `https://127.0.0.1:${port}`;
const rpost = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${rurl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: rurl(), ...headers },
    body: JSON.stringify(body),
    tls: { ca: caOf() },
  });
const localPair = async () => {
  const res = await fetch(`${server.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url },
    body: JSON.stringify({ token: TOKEN }),
  });
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
};
const remotePair = async () => {
  const res = await rpost("/api/pair-code", { code: codes.create().code });
  expect(res.status).toBe(204);
  return res.headers.get("set-cookie") ?? "";
};

describe("remote access", () => {
  test("is disabled by default", () => {
    expect(remote.status()).toMatchObject({ enabled: false, address: null, port: null, url: null, fingerprint: null, tls: null });
  });

  test("serves HTTPS on the chosen interface with a self-signed certificate", async () => {
    const status = await enable();
    expect(status).toMatchObject({ enabled: true, address: "127.0.0.1", port, url: rurl(), tls: "self-signed" });
    expect(status.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    const cookie = await remotePair();
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const list = await rpost("/api/rpc", { method: "listSessions" }, { cookie: cookie.split(";")[0] ?? "" });
    const body = (await list.json()) as { result: SessionInfo[] };
    expect(body.result.find((s) => s.current)?.remote).toBe(true);
  });

  test("pairing by code also works locally, without the Secure flag", async () => {
    const res = await fetch(`${server.url}/api/pair-code`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: server.url },
      body: JSON.stringify({ code: codes.create().code }),
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });

  test("a wrong code is refused", async () => {
    await enable();
    expect((await rpost("/api/pair-code", { code: "ZZZZZZ" })).status).toBe(401);
  });

  test("a foreign Host or Origin is refused on the remote listener", async () => {
    await enable();
    const cookie = (await remotePair()).split(";")[0] ?? "";
    expect((await rpost("/api/rpc", { method: "listProjects" }, { cookie, host: "evil.test" })).status).toBe(403);
    expect((await rpost("/api/rpc", { method: "listProjects" }, { cookie, origin: "http://127.0.0.1:1" })).status).toBe(403);
  });

  test("token pairing is refused remotely", async () => {
    await enable();
    expect((await rpost("/api/pair", { token: TOKEN })).status).toBe(403);
  });

  test("sensitive RPCs are refused from a remote session", async () => {
    await enable();
    const cookie = (await remotePair()).split(";")[0] ?? "";
    for (const body of [{ method: "createPairingCode" }, { method: "disableRemoteAccess" }]) {
      const res = await rpost("/api/rpc", body, { cookie });
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    const status = await rpost("/api/rpc", { method: "getRemoteAccess" }, { cookie });
    expect(await status.json()).toMatchObject({ ok: true, result: { enabled: true } });
  });

  test("the wildcard and foreign addresses are refused", async () => {
    await expect(remote.enable({ address: "0.0.0.0", port, tls: { kind: "self-signed" } })).rejects.toThrow("INVALID_INPUT");
    await expect(remote.enable({ address: "10.9.8.7", port, tls: { kind: "self-signed" } })).rejects.toThrow("INVALID_INPUT");
    expect(remote.status().enabled).toBe(false);
  });

  test("disabling closes the listener", async () => {
    await enable();
    await remote.disable();
    expect(remote.status().enabled).toBe(false);
    await expect(fetch(`${rurl()}/`, { tls: { ca: caOf() } })).rejects.toThrow();
  });

  test("the certificate is 0600 and the private key never touches the disk", async () => {
    await enable();
    expect(statSync(join(home, "remote", "cert.pem")).mode & 0o777).toBe(0o600);
    expect(await secrets.has("remote:tls")).toBe(true);
    const files = readdirSync(home, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
    for (const f of files) {
      expect(readFileSync(join(f.parentPath, f.name)).includes("PRIVATE KEY")).toBe(false);
    }
  });

  test("an enabled access resumes after a restart with the same fingerprint", async () => {
    const first = await enable();
    remote.stop();
    remote = makeRemote();
    await remote.resume();
    expect(remote.status()).toMatchObject({ enabled: true, fingerprint: first.fingerprint });
  });

  test("the local session can drive it through RPC", async () => {
    const cookie = await localPair();
    const res = await fetch(`${server.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: server.url, cookie },
      body: JSON.stringify({ method: "createPairingCode" }),
    });
    expect(await res.json()).toMatchObject({ ok: true, result: { code: expect.stringMatching(/^[A-Z2-9]{6}$/) } });
  });
});
```
Dans `beforeEach`, l'extension enveloppe `remoteRpc` parce que `remote` dépend de `server.listenRemote`, créé par `startServer` : c'est aussi l'ordre d'initialisation de `main.ts` (Step 7).

Run: `bun test packages/daemon/src/remote/remote-access.test.ts`
Expected: FAIL (`./remote-access` introuvable, `/api/pair-code` inconnu).

- [ ] **Step 5: Implémenter l'accès distant et ses RPC**

`packages/daemon/src/remote/remote-access.ts` :
```ts
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError, RemoteAccessConfig, type RemoteAccessStatus, RemoteTls } from "@kibo/schema";
import { certFingerprint, generateSelfSignedCert } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../secrets/secret-store";
import type { LocalSettings } from "../settings";

export const REMOTE_SETTING_KEY = "remoteAccess";
export const REMOTE_TLS_SECRET = "remote:tls";

export type RemoteAccess = {
  status(): RemoteAccessStatus;
  enable(cfg: RemoteAccessConfig): Promise<RemoteAccessStatus>;
  disable(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
};
export type RemoteListen = (input: { hostname: string; port: number; tls: { cert: string; key: string } }) => {
  port: number;
  stop(): void;
};
export type RemoteAccessDeps = {
  home: string;
  settings: LocalSettings;
  secrets: SecretStore;
  interfaces(): { name: string; address: string }[];
  listen: RemoteListen;
  log(message: string): void;
};

const Stored = z
  .object({
    enabled: z.boolean(),
    address: z.string(),
    port: z.number().int(),
    tls: RemoteTls,
    certAddress: z.string().nullable(),
  })
  .nullable();
type Running = { stop(): void; address: string; port: number; fingerprint: string; tls: "self-signed" | "provided" };

const hostPart = (address: string) => (address.includes(":") ? `[${address}]` : address);

export function createRemoteAccess(deps: RemoteAccessDeps): RemoteAccess {
  let running: Running | null = null;
  let lastError: string | null = null;
  const certPath = join(deps.home, "remote", "cert.pem");
  const stored = () => deps.settings.get(REMOTE_SETTING_KEY, Stored, null);

  const selfSigned = async (address: string) => {
    const key = await deps.secrets.get(REMOTE_TLS_SECRET);
    if (key && existsSync(certPath) && stored()?.certAddress === address) {
      return { cert: readFileSync(certPath, "utf8"), key };
    }
    const made = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: [address], days: 825 });
    mkdirSync(join(deps.home, "remote"), { recursive: true, mode: 0o700 });
    writeFileSync(certPath, made.certPem, { mode: 0o600 });
    chmodSync(certPath, 0o600);
    await deps.secrets.set(REMOTE_TLS_SECRET, made.keyPem);
    return { cert: made.certPem, key: made.keyPem };
  };

  const provided = (certFile: string, keyFile: string) => {
    try {
      return { cert: readFileSync(certFile, "utf8"), key: readFileSync(keyFile, "utf8") };
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `cannot read the TLS certificate or key: ${String(e)}`);
    }
  };

  const start = async (cfg: RemoteAccessConfig) => {
    if (cfg.address === "0.0.0.0" || cfg.address === "::") {
      throw new KiboError("INVALID_INPUT", "listening on every interface is not allowed");
    }
    if (!deps.interfaces().some((i) => i.address === cfg.address)) {
      throw new KiboError("INVALID_INPUT", `${cfg.address} is not an address of this machine`);
    }
    const material = cfg.tls.kind === "self-signed" ? await selfSigned(cfg.address) : provided(cfg.tls.certFile, cfg.tls.keyFile);
    const fingerprint = await certFingerprint(material.cert);
    running?.stop();
    running = null;
    let handle: ReturnType<RemoteListen>;
    try {
      handle = deps.listen({ hostname: cfg.address, port: cfg.port, tls: material });
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `cannot listen on ${hostPart(cfg.address)}:${cfg.port}: ${String(e)}`);
    }
    running = { stop: handle.stop, address: cfg.address, port: handle.port, fingerprint, tls: cfg.tls.kind };
    deps.settings.set(REMOTE_SETTING_KEY, {
      enabled: true,
      address: cfg.address,
      port: cfg.port,
      tls: cfg.tls,
      certAddress: cfg.tls.kind === "self-signed" ? cfg.address : null,
    });
    lastError = null;
  };

  const status = (): RemoteAccessStatus => ({
    enabled: running !== null,
    address: running?.address ?? null,
    port: running?.port ?? null,
    url: running ? `https://${hostPart(running.address)}:${running.port}` : null,
    fingerprint: running?.fingerprint ?? null,
    tls: running?.tls ?? null,
    interfaces: deps.interfaces(),
    lastError,
  });

  return {
    status,
    async enable(cfg) {
      const parsed = RemoteAccessConfig.safeParse(cfg);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
      await start(parsed.data);
      return status();
    },
    async disable() {
      running?.stop();
      running = null;
      const s = stored();
      if (s) deps.settings.set(REMOTE_SETTING_KEY, { ...s, enabled: false });
    },
    async resume() {
      const s = stored();
      if (!s?.enabled) return;
      try {
        await start({ address: s.address, port: s.port, tls: s.tls });
      } catch (e) {
        lastError = e instanceof KiboError ? e.detail : String(e);
        deps.log(`remote access not resumed: ${lastError}`);
      }
    },
    stop() {
      running?.stop();
      running = null;
    },
  };
}
```
`resume` ne relance pas l'erreur : le démon doit démarrer même si l'interface a disparu ; l'erreur est journalisée et affichée (`lastError`, écran S8).

`packages/daemon/src/remote/rpc.ts` :
```ts
import { KiboError, type RpcRequest } from "@kibo/schema";
import { requireLocal, type RpcContext, type RpcExtension } from "../rpc-extensions";
import type { PairingCodes } from "./pairing-codes";
import type { RemoteAccess } from "./remote-access";

export function remoteRpc(remote: RemoteAccess, codes: PairingCodes): RpcExtension {
  return {
    methods: ["getRemoteAccess", "enableRemoteAccess", "disableRemoteAccess", "createPairingCode"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      switch (req.method) {
        case "getRemoteAccess":
          return remote.status();
        case "enableRemoteAccess":
          requireLocal(ctx);
          return remote.enable({ address: req.address, port: req.port, tls: req.tls });
        case "disableRemoteAccess":
          requireLocal(ctx);
          await remote.disable();
          return null;
        case "createPairingCode":
          requireLocal(ctx);
          return codes.create();
        default:
          throw new KiboError("INTERNAL", `remoteRpc cannot handle ${req.method}`);
      }
    },
  };
}
```

- [ ] **Step 6: Gestionnaire HTTP partagé par les deux écouteurs**

Dans `packages/daemon/src/server.ts` (base : la version de T9 ; les routes ajoutées par les phases 2 à 6 restent dans `handleApi` et `fetch` telles quelles, elles reçoivent simplement `listen`) :
```ts
export type ListenInfo = { hostname: string; port: number; secure: boolean; remote: boolean };

const hostPart = (hostname: string, port: number) =>
  `${hostname.includes(":") ? `[${hostname}]` : hostname}:${port}`;

  const allowedHosts = (l: ListenInfo) =>
    l.remote ? [hostPart(l.hostname, l.port)] : [`127.0.0.1:${l.port}`, `localhost:${l.port}`];
  const allowedOrigins = (l: ListenInfo) =>
    l.remote
      ? [`https://${hostPart(l.hostname, l.port)}`]
      : [`http://127.0.0.1:${l.port}`, `http://localhost:${l.port}`, ...(opts.extraOrigins ?? [])];
  const paired = (req: Request, l: ListenInfo) => {
    const { id } = opts.sessions.create(
      { deviceName: deviceNameFromUserAgent(req.headers.get("user-agent")), remote: l.remote },
      now(),
    );
    const secure = l.secure ? "; Secure" : "";
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/${secure}` },
    });
  };
```
Dans `handleApi(req, url, srv, l)`, après le contrôle d'origine :
```ts
    if (url.pathname === "/api/pair" && req.method === "POST") {
      if (l.remote) return fail("FORBIDDEN", "token pairing is only allowed on 127.0.0.1", 403);
      const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
      if (typeof body?.token !== "string" || !sameSecret(body.token, opts.token)) {
        return fail("UNAUTHORIZED", "invalid pairing token", 401);
      }
      return paired(req, l);
    }
    if (url.pathname === "/api/pair-code" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
      if (typeof body?.code !== "string" || !opts.pairingCodes.redeem(body.code)) {
        return fail("UNAUTHORIZED", "invalid or expired code", 401);
      }
      return paired(req, l);
    }
```
Le gestionnaire devient une fabrique :
```ts
  const makeHandler = (listen: () => ListenInfo) =>
    async (req: Request, srv: Server<WsData>): Promise<Response | undefined> => {
      const l = listen();
      const url = new URL(req.url);
      if (!allowedHosts(l).includes(req.headers.get("host") ?? "")) return new Response("forbidden host", { status: 403 });
      if (!url.pathname.startsWith("/api/")) return withUiHeaders(serveUi(opts.uiDir, url.pathname));
      const res = await handleApi(req, url, srv, l);
      res?.headers.set("cache-control", "no-store");
      return res;
    };
  const servers = new Set<Server<WsData>>();
  const publish = (event: DaemonEvent) => {
    for (const s of servers) s.publish("changes", JSON.stringify(event));
  };
  let port = opts.port;
  const local = Bun.serve<WsData>({
    hostname: "127.0.0.1",
    port: opts.port,
    maxRequestBodySize: MAX_BODY_BYTES,
    fetch: makeHandler(() => ({ hostname: "127.0.0.1", port, secure: false, remote: false })),
    websocket,
  });
  port = local.port ?? opts.port;
  servers.add(local);
  const listenRemote: RemoteListen = ({ hostname, port: remotePort, tls }) => {
    const info: ListenInfo = { hostname, port: remotePort, secure: true, remote: true };
    const remote = Bun.serve<WsData>({
      hostname,
      port: remotePort,
      tls,
      maxRequestBodySize: MAX_BODY_BYTES,
      fetch: makeHandler(() => info),
      websocket,
    });
    servers.add(remote);
    info.port = remote.port ?? remotePort;
    return {
      port: info.port,
      stop: () => {
        servers.delete(remote);
        remote.stop(true);
      },
    };
  };
```
(`websocket` est l'objet `open` / `close` / `message` de T9, extrait dans une constante ; la diffusion des changements de projet de la v0.1 passe par `publish`.) `ServerOptions` gagne `pairingCodes: PairingCodes` ; `startServer` renvoie `{ url, port, stop, publish, listenRemote }`, et `stop` ferme aussi les écouteurs distants restants. Le CSP de l'UI est identique sur les deux écouteurs (`withUiHeaders`), `connect-src 'self'` couvrant `wss:` de la même origine.

- [ ] **Step 7: Brancher `main.ts` et le client du SDK**

`main.ts` :
```ts
import { PairingCodes } from "./remote/pairing-codes";
import { listInterfaces } from "./remote/interfaces";
import { createRemoteAccess, type RemoteAccess } from "./remote/remote-access";
import { remoteRpc } from "./remote/rpc";

const pairingCodes = new PairingCodes(Date.now);
let remote: RemoteAccess | null = null;
const remoteExtension: RpcExtension = {
  methods: ["getRemoteAccess", "enableRemoteAccess", "disableRemoteAccess", "createPairingCode"],
  handle: (req, ctx) => {
    if (!remote) throw new KiboError("INTERNAL", "remote access is not initialised");
    return remoteRpc(remote, pairingCodes).handle(req, ctx);
  },
};
```
`startServer({ …, pairingCodes, extensions: [remoteExtension, …] })`, puis :
```ts
remote = createRemoteAccess({
  home,
  settings,
  secrets,
  interfaces: () => listInterfaces(),
  listen: (input) => server.listenRemote(input),
  log: (m) => console.warn(`[kibo-daemon] ${m}`),
});
await remote.resume();
```
et `remote.stop()` dans `shutdown`.

`packages/sdk/src/client.ts` : ajouter à `KiboClient` `pairWithCode(code: string): Promise<void>`, implémenté comme `pair` sur `/api/pair-code` avec `{ code }` (204 ⇒ résolu, sinon `KiboError("UNAUTHORIZED", "invalid or expired code")`). Test ajouté à `packages/sdk/src/client.test.ts` :
```ts
test("pairWithCode posts the code and fails on 401", async () => {
  const seen: { url: string; body: string }[] = [];
  const statuses = [204, 401];
  const client = createClient({
    baseUrl: "http://127.0.0.1:1",
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), body: String(init?.body) });
      return new Response(null, { status: statuses.shift() ?? 500 });
    }) as typeof fetch,
  });
  await client.pairWithCode("K7Q4M2");
  await expect(client.pairWithCode("ZZZZZZ")).rejects.toThrow("UNAUTHORIZED");
  expect(seen[0]).toEqual({ url: "http://127.0.0.1:1/api/pair-code", body: '{"code":"K7Q4M2"}' });
});
```

- [ ] **Step 8: Lancer les tests**

Run: `bun test packages/daemon packages/sdk`
Expected: PASS (dont les 12 tests de `remote-access.test.ts`), `server.test.ts` inchangé dans ses attentes (sa mise en place gagne `pairingCodes: new PairingCodes(Date.now)`).

- [ ] **Step 9: Vérifier le lint et les types, commiter**

Run: `bun run check && bun run typecheck`
Expected: aucun diagnostic.

```bash
git add packages/daemon/src/remote packages/daemon/src/server.ts packages/daemon/src/server.test.ts packages/daemon/src/main.ts packages/sdk/src/client.ts packages/sdk/src/client.test.ts
git commit -m "feat(daemon): accès distant TLS"
```

---

### Task 14: Serveur de sync, salle de projet

Une salle (`ProjectRoom`) tient en mémoire le `LoroDoc` d'un projet partagé et applique chaque lot poussé par un client dans cet ordre (spec G §5 et §8) : rôle, lecture du lot sur un **fork**, dépendances, invariants (`validateProjectUpdate`), quota, puis import dans le doc principal, attribution des clés, écriture append-only du delta. Un lot déjà connu ne produit rien (idempotence). Le registre charge les salles à la demande et les décharge après 10 minutes sans client. Tâche à risque : relue aussi par `kibo-lead`.

Stockage (tables créées par T11, `packages/sync-server/src/db.ts`) :
```
projects(id TEXT PRIMARY KEY, ownerId TEXT, name TEXT, createdAt INTEGER, ticketSeq INTEGER)
members(projectId TEXT, userId TEXT, role TEXT, addedAt INTEGER, PRIMARY KEY (projectId, userId))
updates(projectId TEXT, seq INTEGER, bytes BLOB, userId TEXT, deviceId TEXT, at INTEGER, PRIMARY KEY (projectId, seq))
snapshots(projectId TEXT, bytes BLOB, versionJson TEXT, uptoSeq INTEGER, at INTEGER)
audit(at INTEGER, kind TEXT, userId TEXT, deviceId TEXT, projectId TEXT, detail TEXT)
```
Hypothèse (vérifiée à l'intégration de T11) : noms de colonnes exactement ceux de la spec G §3.1, table d'audit `audit`. Les requêtes utilisent des paramètres positionnels `?1`, compatibles avec `strict: true`.

Les lignes écrites par le serveur lui-même (attribution de clés dans un lot client, annuaire des membres) portent `userId = deviceId = "kibo-server"` quand aucun client n'en est l'auteur.

**Files:**
- Create: `packages/sync-server/src/room.ts`
- Create: `packages/sync-server/src/rooms.ts`
- Modify: `packages/sync-server/src/index.ts`
- Create: `packages/sync-server/src/testing/fixtures.ts`
- Modify: `packages/sync-server/package.json` (export `"./testing/*": "./src/testing/*.ts"`, utilisé par les tests du démon)
- Test: `packages/sync-server/src/room.test.ts`, `packages/sync-server/src/rooms.test.ts`

**Interfaces:**
- Consumes (T7) : `enableServerAllocation`, `allocateTicketKeys`, `validateProjectUpdate`, `writeMembers`, `listTickets` de `@kibo/core` ; (T4) `RejectCode`, `Role`, `SYNC_LIMITS` de `@kibo/schema` ; (T11) `ServerDb`, `openServerDb`, `audit`, `listMembers`, `insertProject`, `createInvite`, `redeemDeviceInvite`, `redeemProjectInvite` ; (T2) `generateKeyPair` de `@kibo/trust`.
- Produces (Contrats partagés) : `Actor`, `PushResult` (avec `allocated`), `RoomLimits`, `RoomReject`, `ProjectRoom` (`create`, `load`, `projectId`, `presence`, `version`, `serverSeq`, `sizeBytes`, `diffSince`, `push`, `syncMembers`, `snapshotBytes`), `RoomRegistry` (`get`, `create`, `attach`, `detach`, `drop`, `sweep`, `loaded`).
- Produces (**ajout**) : le constructeur de `RoomRegistry` accepte `limits?: Partial<RoomLimits>` dans ses options ; `@kibo/sync-server/testing/fixtures` exporte `seedUser(sdb, name, now): Promise<SeededUser>`, `addMember(sdb, input, now)` et `ownerSnapshot(): Uint8Array` pour T17, T18 et T19.

- [ ] **Step 1: Écrire les fixtures de test**

`packages/sync-server/src/testing/fixtures.ts` :
```ts
import { createProjectDoc, createTicket } from "@kibo/core";
import { generateKeyPair } from "@kibo/trust";
import { createInvite, redeemDeviceInvite, redeemProjectInvite } from "../accounts";
import type { ServerDb } from "../db";

export type SeededUser = { userId: string; deviceId: string; name: string };

export async function seedUser(sdb: ServerDb, name: string, now: number): Promise<SeededUser> {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: `Appareil de ${name}` },
    now,
  );
  return { userId: joined.userId, deviceId: joined.deviceId, name: joined.name };
}

export async function addMember(
  sdb: ServerDb,
  input: { projectId: string; user: SeededUser; role: "editor" | "viewer"; owner: SeededUser },
  now: number,
): Promise<void> {
  const invite = await createInvite(
    sdb,
    { kind: "project", projectId: input.projectId, role: input.role, createdBy: input.owner.userId },
    now,
  );
  await redeemProjectInvite(sdb, { code: invite.code, userId: input.user.userId }, now);
}

export function ownerSnapshot(): Uint8Array {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });
  createTicket(doc, { title: "Noyau de données" });
  createTicket(doc, { title: "Schéma Loro des tickets" });
  return doc.export({ mode: "snapshot" });
}
```

- [ ] **Step 2: Écrire les tests de la salle qui échouent**

`packages/sync-server/src/room.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTicket,
  getKeyAllocator,
  listTickets,
  readMembers,
  updateTicket,
} from "@kibo/core";
import { LoroDoc, VersionVector } from "loro-crdt";
import { openServerDb, type ServerDb } from "./db";
import { type Actor, ProjectRoom, RoomReject } from "./room";
import { addMember, ownerSnapshot, type SeededUser, seedUser } from "./testing/fixtures";

const NOW = 1_790_000_000_000;
let sdb: ServerDb;
let adam: SeededUser;
let lea: SeededUser;

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", NOW);
  lea = await seedUser(sdb, "Léa", NOW);
});
afterEach(() => sdb.close());

const actor = (u: SeededUser, role: Actor["role"]): Actor => ({ userId: u.userId, deviceId: u.deviceId, role });

function share(limits?: { projectBytes?: number; compactEvery?: number }, projectId = "p1"): ProjectRoom {
  return ProjectRoom.create(
    sdb,
    { projectId, name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
    NOW,
    limits,
  );
}

function docOf(room: ProjectRoom): LoroDoc {
  return LoroDoc.fromSnapshot(room.snapshotBytes());
}

function clientOf(room: ProjectRoom): LoroDoc {
  const client = new LoroDoc();
  client.import(room.diffSince(null));
  return client;
}

const changesSince = (client: LoroDoc, room: ProjectRoom): Uint8Array =>
  client.export({ mode: "update", from: VersionVector.decode(room.version()) });

function rejection(fn: () => unknown): RoomReject {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomReject) return e;
    throw e;
  }
  throw new Error("expected a RoomReject");
}

describe("create", () => {
  test("imports the owner's snapshot and takes over key allocation", () => {
    const room = share();
    const doc = docOf(room);
    expect(getKeyAllocator(doc)).toBe("server");
    expect(readMembers(doc)).toEqual([{ userId: adam.userId, name: "Adam" }]);
    expect(listTickets(doc).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
    const project = sdb.db.query("SELECT ownerId, ticketSeq FROM projects WHERE id = ?1").get("p1");
    expect(project).toEqual({ ownerId: adam.userId, ticketSeq: 2 });
    const member = sdb.db.query("SELECT role FROM members WHERE projectId = ?1 AND userId = ?2").get("p1", adam.userId);
    expect(member).toEqual({ role: "owner" });
    expect(room.serverSeq()).toBe(0);
  });

  test("refuses a snapshot with a ticket that has no key", () => {
    const doc = new LoroDoc();
    doc.import(ownerSnapshot());
    doc.getMap("meta").set("keyAllocator", "server");
    doc.commit();
    createTicket(doc, { title: "Sans clé" });
    expect(() =>
      ProjectRoom.create(
        sdb,
        { projectId: "p2", name: "X", ownerId: adam.userId, ownerName: "Adam", snapshot: doc.export({ mode: "snapshot" }) },
        NOW,
      ),
    ).toThrow("INVALID_INPUT");
  });
});

describe("push", () => {
  test("a viewer is refused", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "Lecture seule" });
    expect(rejection(() => room.push(changesSince(client, room), actor(lea, "viewer"), NOW)).code).toBe("FORBIDDEN");
  });

  test("an editor writing a key is refused and audited", () => {
    const room = share();
    const before = room.version();
    const client = clientOf(room);
    const [first] = client.getTree("tickets").roots();
    first?.data.set("key", "KIB-42");
    client.commit();
    const reject = rejection(() => room.push(changesSince(client, room), actor(lea, "editor"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
    expect(reject.version).toEqual(before);
    expect(room.version()).toEqual(before);
    const row = sdb.db.query("SELECT kind, userId, projectId FROM audit WHERE kind = 'update-rejected'").get();
    expect(row).toEqual({ kind: "update-rejected", userId: lea.userId, projectId: "p1" });
  });

  test("a valid batch gets its keys, in order, with a growing sequence", () => {
    const room = share();
    const client = clientOf(room);
    const a = createTicket(client, { title: "A" });
    const b = createTicket(client, { title: "B" });
    const first = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    expect(first.allocated).toEqual([
      { ticketId: a.id, key: "KIB-3" },
      { ticketId: b.id, key: "KIB-4" },
    ]);
    expect(first.serverSeq).toBe(1);
    expect(first.bytes).not.toBeNull();
    client.import(first.bytes ?? new Uint8Array());
    expect(listTickets(client).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3", "KIB-4"]);
    const c = createTicket(client, { title: "C" });
    const second = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    expect(second.allocated).toEqual([{ ticketId: c.id, key: "KIB-5" }]);
    expect(second.serverSeq).toBe(2);
  });

  test("the same batch pushed twice changes nothing the second time", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "A" });
    const batch = changesSince(client, room);
    const first = room.push(batch, actor(adam, "owner"), NOW);
    const again = room.push(batch, actor(adam, "owner"), NOW);
    expect(again).toEqual({ bytes: null, serverSeq: first.serverSeq, version: first.version, allocated: [] });
    const keys = listTickets(docOf(room)).map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const count = sdb.db.query("SELECT COUNT(*) AS n FROM updates WHERE projectId = ?1").get("p1");
    expect(count).toEqual({ n: 1 });
  });

  test("a batch with missing dependencies is out of date", () => {
    const room = share();
    const client = clientOf(room);
    const t = createTicket(client, { title: "A" });
    const afterFirst = client.oplogVersion();
    updateTicket(client, t.id, { title: "A bis" });
    const onlySecond = client.export({ mode: "update", from: afterFirst });
    const reject = rejection(() => room.push(onlySecond, actor(adam, "owner"), NOW));
    expect(reject.code).toBe("OUT_OF_DATE");
    expect(reject.version).toEqual(room.version());
  });

  test("an unreadable batch is rejected", () => {
    const room = share();
    const reject = rejection(() => room.push(new Uint8Array([1, 2, 3]), actor(adam, "owner"), NOW));
    expect(reject.code).toBe("UPDATE_REJECTED");
  });

  test("the size quota is enforced", () => {
    const limit = share(undefined, "probe").sizeBytes() + 16;
    const room = share({ projectBytes: limit });
    const client = clientOf(room);
    createTicket(client, { title: "x".repeat(200), description: "y".repeat(500) });
    expect(rejection(() => room.push(changesSince(client, room), actor(adam, "owner"), NOW)).code).toBe(
      "QUOTA_EXCEEDED",
    );
  });
});

describe("history", () => {
  test("compacts every compactEvery updates and reloads identically", () => {
    const room = share({ compactEvery: 3 });
    const client = clientOf(room);
    for (const title of ["A", "B", "C", "D"]) {
      createTicket(client, { title });
      const r = room.push(changesSince(client, room), actor(adam, "owner"), NOW);
      client.import(r.bytes ?? new Uint8Array());
    }
    const snapshots = sdb.db.query("SELECT uptoSeq FROM snapshots WHERE projectId = ?1 ORDER BY uptoSeq").all("p1");
    expect(snapshots).toEqual([{ uptoSeq: 0 }, { uptoSeq: 3 }]);
    const reloaded = ProjectRoom.load(sdb, "p1");
    expect(docOf(reloaded).toJSON()).toEqual(docOf(room).toJSON());
    expect(reloaded.serverSeq()).toBe(4);
  });

  test("diffSince(null) rebuilds the whole document", () => {
    const room = share();
    const client = clientOf(room);
    createTicket(client, { title: "A" });
    room.push(changesSince(client, room), actor(adam, "owner"), NOW);
    const rebuilt = new LoroDoc();
    rebuilt.import(room.diffSince(null));
    expect(rebuilt.toJSON()).toEqual(docOf(room).toJSON());
  });

  test("syncMembers writes the directory once", async () => {
    const room = share();
    await addMember(sdb, { projectId: "p1", user: lea, role: "editor", owner: adam }, NOW);
    const result = room.syncMembers(NOW);
    expect(result?.bytes).not.toBeNull();
    expect(readMembers(docOf(room)).map((m) => m.name).sort()).toEqual(["Adam", "Léa"]);
    expect(room.syncMembers(NOW)).toBeNull();
  });
});

describe("restart", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kibo-room-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("the key sequence continues after a server restart", async () => {
    const file = join(dir, "sync.db");
    const first = openServerDb(file);
    const owner = await seedUser(first, "Adam", NOW);
    const room = ProjectRoom.create(
      first,
      { projectId: "p1", name: "Kibo", ownerId: owner.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
      NOW,
    );
    const client = clientOf(room);
    createTicket(client, { title: "Avant" });
    const pushed = room.push(changesSince(client, room), actor(owner, "owner"), NOW);
    client.import(pushed.bytes ?? new Uint8Array());
    first.close();
    const second = openServerDb(file);
    const reloaded = ProjectRoom.load(second, "p1");
    expect(reloaded.serverSeq()).toBe(1);
    createTicket(client, { title: "Après" });
    const after = reloaded.push(
      client.export({ mode: "update", from: VersionVector.decode(reloaded.version()) }),
      actor(owner, "owner"),
      NOW,
    );
    expect(after.allocated.map((a) => a.key)).toEqual(["KIB-4"]);
    expect(after.serverSeq).toBe(2);
    expect(second.db.query("SELECT ticketSeq FROM projects WHERE id = ?1").get("p1")).toEqual({ ticketSeq: 4 });
    second.close();
  });
});
```

- [ ] **Step 3: Lancer le test**

Run: `bun test packages/sync-server/src/room.test.ts`
Expected: FAIL (`./room` introuvable).

- [ ] **Step 4: Implémenter `room.ts`**

`packages/sync-server/src/room.ts` :
```ts
import {
  allocateTicketKeys,
  enableServerAllocation,
  listTickets,
  validateProjectUpdate,
  writeMembers,
} from "@kibo/core";
import { KiboError, type RejectCode, type Role, SYNC_LIMITS } from "@kibo/schema";
import { EphemeralStore, LoroDoc, VersionVector } from "loro-crdt";
import { audit } from "./audit";
import type { ServerDb } from "./db";
import { insertProject, listMembers } from "./members";

export type Actor = { userId: string; deviceId: string; role: Role };
export type PushResult = {
  bytes: Uint8Array | null;
  serverSeq: number;
  version: Uint8Array;
  allocated: { ticketId: string; key: string }[];
};
export type RoomLimits = { projectBytes: number; compactEvery: number };

export class RoomReject extends Error {
  constructor(
    readonly code: RejectCode,
    message: string,
    readonly version: Uint8Array | null,
  ) {
    super(message);
    this.name = "RoomReject";
  }
}

const SERVER_AUTHOR = "kibo-server";
const DEFAULT_LIMITS: RoomLimits = {
  projectBytes: SYNC_LIMITS.projectBytes,
  compactEvery: SYNC_LIMITS.compactEvery,
};

const versionJson = (doc: LoroDoc): string => JSON.stringify(Object.fromEntries(doc.oplogVersion().toJSON()));

type State = { seq: number; sinceSnapshot: number; size: number };

export class ProjectRoom {
  readonly presence = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);

  private constructor(
    private readonly sdb: ServerDb,
    readonly projectId: string,
    private readonly doc: LoroDoc,
    private readonly state: State,
    private readonly limits: RoomLimits,
  ) {}

  static create(
    sdb: ServerDb,
    input: { projectId: string; name: string; ownerId: string; ownerName: string; snapshot: Uint8Array },
    now: number,
    limits?: Partial<RoomLimits>,
  ): ProjectRoom {
    const doc = new LoroDoc();
    try {
      doc.import(input.snapshot);
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable project snapshot: ${String(e)}`);
    }
    if (listTickets(doc).some((t) => t.key === null)) {
      throw new KiboError("INVALID_INPUT", "a shared snapshot must have a key on every ticket");
    }
    const ticketSeq = enableServerAllocation(doc);
    writeMembers(doc, [{ userId: input.ownerId, name: input.ownerName }]);
    const snapshot = doc.export({ mode: "snapshot" });
    sdb.db.transaction(() => {
      insertProject(sdb, { id: input.projectId, ownerId: input.ownerId, name: input.name, ticketSeq }, now);
      sdb.db
        .query("INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, 0, ?4)")
        .run(input.projectId, snapshot, versionJson(doc), now);
    })();
    return new ProjectRoom(
      sdb,
      input.projectId,
      doc,
      { seq: 0, sinceSnapshot: 0, size: snapshot.length },
      { ...DEFAULT_LIMITS, ...limits },
    );
  }

  static load(sdb: ServerDb, projectId: string, limits?: Partial<RoomLimits>): ProjectRoom {
    const project = sdb.db.query("SELECT id FROM projects WHERE id = ?1").get(projectId);
    if (!project) throw new KiboError("NOT_FOUND", `project ${projectId} is not shared on this server`);
    const snapshot = sdb.db
      .query("SELECT bytes, uptoSeq FROM snapshots WHERE projectId = ?1 ORDER BY uptoSeq DESC LIMIT 1")
      .get(projectId) as { bytes: Uint8Array; uptoSeq: number } | null;
    if (!snapshot) throw new KiboError("STORE_CORRUPT", `project ${projectId} has no snapshot`);
    const rows = sdb.db
      .query("SELECT seq, bytes FROM updates WHERE projectId = ?1 AND seq > ?2 ORDER BY seq")
      .all(projectId, snapshot.uptoSeq) as { seq: number; bytes: Uint8Array }[];
    let doc: LoroDoc;
    try {
      doc = LoroDoc.fromSnapshot(new Uint8Array(snapshot.bytes));
      if (rows.length > 0) doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)));
    } catch (e) {
      throw new KiboError("STORE_CORRUPT", `project ${projectId} history is unreadable: ${String(e)}`);
    }
    const last = rows.at(-1)?.seq ?? snapshot.uptoSeq;
    const size = rows.reduce((total, r) => total + r.bytes.length, snapshot.bytes.length);
    return new ProjectRoom(
      sdb,
      projectId,
      doc,
      { seq: last, sinceSnapshot: rows.length, size },
      { ...DEFAULT_LIMITS, ...limits },
    );
  }

  version(): Uint8Array {
    return this.doc.oplogVersion().encode();
  }

  serverSeq(): number {
    return this.state.seq;
  }

  sizeBytes(): number {
    return this.state.size;
  }

  snapshotBytes(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  diffSince(version: Uint8Array | null): Uint8Array {
    if (version === null) return this.doc.export({ mode: "update" });
    return this.doc.export({ mode: "update", from: VersionVector.decode(version) });
  }

  push(bytes: Uint8Array, actor: Actor, now: number): PushResult {
    if (actor.role === "viewer") throw new RoomReject("FORBIDDEN", "viewers cannot write", null);
    const candidate = this.doc.fork();
    let pending: boolean;
    try {
      const status = candidate.import(bytes);
      pending = status.pending !== null && status.pending.size > 0;
    } catch (e) {
      throw new RoomReject("UPDATE_REJECTED", `unreadable update: ${String(e)}`, this.version());
    }
    if (pending) {
      throw new RoomReject("OUT_OF_DATE", "update depends on changes the server does not have", this.version());
    }
    const verdict = validateProjectUpdate(this.doc, candidate);
    if (!verdict.ok) {
      audit(this.sdb, {
        at: now,
        kind: "update-rejected",
        userId: actor.userId,
        deviceId: actor.deviceId,
        projectId: this.projectId,
        detail: verdict.reason,
      });
      throw new RoomReject("UPDATE_REJECTED", verdict.reason, this.version());
    }
    if (this.state.size + bytes.length > this.limits.projectBytes) {
      throw new RoomReject("QUOTA_EXCEEDED", "project is over its size quota", this.version());
    }
    const before = this.doc.oplogVersion();
    this.doc.import(bytes);
    const allocated = allocateTicketKeys(this.doc);
    return this.record(before, { userId: actor.userId, deviceId: actor.deviceId }, now, allocated);
  }

  syncMembers(now: number): PushResult | null {
    const before = this.doc.oplogVersion();
    writeMembers(
      this.doc,
      listMembers(this.sdb, this.projectId).map((m) => ({ userId: m.userId, name: m.name })),
    );
    const result = this.record(before, { userId: SERVER_AUTHOR, deviceId: SERVER_AUTHOR }, now, []);
    return result.bytes === null ? null : result;
  }

  private record(
    before: VersionVector,
    author: { userId: string; deviceId: string },
    now: number,
    allocated: { ticketId: string; key: string }[],
  ): PushResult {
    if (this.doc.oplogVersion().compare(before) === 0) {
      return { bytes: null, serverSeq: this.state.seq, version: this.version(), allocated: [] };
    }
    const delta = this.doc.export({ mode: "update", from: before });
    const seq = this.state.seq + 1;
    const ticketSeq = (this.doc.getMap("meta").get("ticketSeq") as number | undefined) ?? 0;
    this.sdb.db.transaction(() => {
      this.sdb.db
        .query(
          "INSERT INTO updates (projectId, seq, bytes, userId, deviceId, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .run(this.projectId, seq, delta, author.userId, author.deviceId, now);
      this.sdb.db.query("UPDATE projects SET ticketSeq = ?2 WHERE id = ?1").run(this.projectId, ticketSeq);
    })();
    this.state.seq = seq;
    this.state.size += delta.length;
    this.state.sinceSnapshot += 1;
    if (this.state.sinceSnapshot >= this.limits.compactEvery) this.compact(now);
    return { bytes: delta, serverSeq: seq, version: this.version(), allocated };
  }

  private compact(now: number): void {
    const snapshot = this.doc.export({ mode: "snapshot" });
    this.sdb.db
      .query("INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .run(this.projectId, snapshot, versionJson(this.doc), this.state.seq, now);
    this.state.sinceSnapshot = 0;
    this.state.size = snapshot.length;
  }
}
```
Notes pour le relecteur :
- `fork()` coûte une copie du doc par lot : acceptable en v1.0 (projets de quelques Mio), risque noté au jalon.
- Les lignes `updates` restent (append-only) après compactage ; seuls le chargement et le quota partent du dernier snapshot.
- Le lot rejeté pour quota a déjà passé la validation : il ne touche jamais le doc principal.

- [ ] **Step 5: Relancer le test**

Run: `bun test packages/sync-server/src/room.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Écrire les tests du registre qui échouent**

`packages/sync-server/src/rooms.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { SYNC_LIMITS } from "@kibo/schema";
import { openServerDb, type ServerDb } from "./db";
import { RoomRegistry } from "./rooms";
import { ownerSnapshot, type SeededUser, seedUser } from "./testing/fixtures";

let sdb: ServerDb;
let adam: SeededUser;
let clock: number;
let rooms: RoomRegistry;

beforeEach(async () => {
  clock = 1_790_000_000_000;
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", clock);
  rooms = new RoomRegistry(sdb, { now: () => clock, unloadAfterMs: SYNC_LIMITS.unloadAfterMs });
  rooms.create({ projectId: "p1", name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot: ownerSnapshot() });
  rooms.drop("p1");
});
afterEach(() => sdb.close());

test("loads a room lazily and keeps a single instance", () => {
  expect(rooms.loaded()).toEqual([]);
  const room = rooms.get("p1");
  expect(rooms.get("p1")).toBe(room);
  expect(rooms.loaded()).toEqual(["p1"]);
});

test("an unknown project is not found", () => {
  expect(() => rooms.get("nope")).toThrow("NOT_FOUND");
});

test("unloads a room ten minutes after its last client left", () => {
  rooms.attach("p1", "c1");
  clock += SYNC_LIMITS.unloadAfterMs * 2;
  expect(rooms.sweep()).toEqual([]);
  rooms.detach("p1", "c1");
  clock += SYNC_LIMITS.unloadAfterMs - 1;
  expect(rooms.sweep()).toEqual([]);
  clock += 1;
  expect(rooms.sweep()).toEqual(["p1"]);
  expect(rooms.loaded()).toEqual([]);
});

test("a room loaded without client is also unloaded", () => {
  rooms.get("p1");
  clock += SYNC_LIMITS.unloadAfterMs;
  expect(rooms.sweep()).toEqual(["p1"]);
});

test("a reloaded room has the same state", () => {
  const version = rooms.get("p1").version();
  rooms.drop("p1");
  expect(rooms.get("p1").version()).toEqual(version);
});
```

- [ ] **Step 7: Lancer le test**

Run: `bun test packages/sync-server/src/rooms.test.ts`
Expected: FAIL (`./rooms` introuvable).

- [ ] **Step 8: Implémenter `rooms.ts`**

`packages/sync-server/src/rooms.ts` :
```ts
import type { ServerDb } from "./db";
import { ProjectRoom, type RoomLimits } from "./room";

type Entry = { room: ProjectRoom; connections: Set<string>; idleSince: number | null };

export class RoomRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly sdb: ServerDb,
    private readonly opts: { now: () => number; unloadAfterMs: number; limits?: Partial<RoomLimits> },
  ) {}

  get(projectId: string): ProjectRoom {
    return this.entry(projectId).room;
  }

  create(input: Parameters<typeof ProjectRoom.create>[1]): ProjectRoom {
    const room = ProjectRoom.create(this.sdb, input, this.opts.now(), this.opts.limits);
    this.entries.set(input.projectId, { room, connections: new Set(), idleSince: this.opts.now() });
    return room;
  }

  attach(projectId: string, connId: string): void {
    const entry = this.entry(projectId);
    entry.connections.add(connId);
    entry.idleSince = null;
  }

  detach(projectId: string, connId: string): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.connections.delete(connId);
    if (entry.connections.size === 0) entry.idleSince = this.opts.now();
  }

  drop(projectId: string): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.room.presence.destroy();
    this.entries.delete(projectId);
  }

  sweep(): string[] {
    const now = this.opts.now();
    const unloaded: string[] = [];
    for (const [projectId, entry] of this.entries) {
      if (entry.idleSince !== null && now - entry.idleSince >= this.opts.unloadAfterMs) unloaded.push(projectId);
    }
    for (const projectId of unloaded) this.drop(projectId);
    return unloaded;
  }

  loaded(): string[] {
    return [...this.entries.keys()];
  }

  private entry(projectId: string): Entry {
    const existing = this.entries.get(projectId);
    if (existing) return existing;
    const entry: Entry = {
      room: ProjectRoom.load(this.sdb, projectId, this.opts.limits),
      connections: new Set(),
      idleSince: this.opts.now(),
    };
    this.entries.set(projectId, entry);
    return entry;
  }
}
```
`detach` d'une salle non chargée ne fait rien : une connexion peut se fermer après un `unshare` qui a déjà retiré la salle (T17).

Dans `packages/sync-server/src/index.ts`, ajouter :
```ts
export * from "./room";
export * from "./rooms";
```

- [ ] **Step 9: Suite du paquet, lint, types**

Run: `bun test packages/sync-server && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/sync-server/package.json packages/sync-server/src/room.ts packages/sync-server/src/rooms.ts packages/sync-server/src/index.ts \
  packages/sync-server/src/testing/fixtures.ts packages/sync-server/src/room.test.ts packages/sync-server/src/rooms.test.ts
git commit -m "feat(sync-server): salle de projet"
```

---

### Task 15: Sources de marketplace dans le démon

Côté démon de la chaîne de vérification (spec H §3.3, §4, §5.2, §6) : sources déclarées et épinglées par leur clé, index signé à numéro croissant, cache, épinglage des éditeurs, recherche locale, détail d'un paquet avec ses sources vérifiées (« Voir le code »), révocation au rafraîchissement. L'installation elle-même est la tâche 20.

**Files:**
- Create: `packages/daemon/src/market/market-db.ts`, `packages/daemon/src/market/http-get.ts`, `packages/daemon/src/market/market-service.ts`, `packages/daemon/src/market/refresh-schedule.ts`, `packages/daemon/src/market/rpc.ts`, `packages/daemon/src/testing/fake-market.ts`, `packages/daemon/src/testing/memory-registry.ts`
- Modify: `packages/daemon/src/service.ts` (branchement des RPC marketplace), `packages/daemon/src/main.ts` (planification du rafraîchissement), `packages/daemon/package.json` (dépendance `@kibo/trust`)
- Test: `packages/daemon/src/market/http-get.test.ts`, `packages/daemon/src/market/market-service.test.ts`, `packages/daemon/src/market/rpc.test.ts`

**Interfaces:**
- Consumes: `verifyIndex`, `verifyMarketPackage`, `decodeKpkg`, `keyFingerprint`, `utf8`, `type SourceFile` (`@kibo/trust`, T2 et T10) ; `makeTestPackage` (`@kibo/trust/testing`, T10) ; `MarketIndex`, `Kpkg`, `KPKG_MAX_BYTES`, `MARKET_FETCH_TIMEOUT_MS`, `MARKET_REFRESH_MS`, `MarketSourceInfo`, `MarketProbe`, `MarketHit`, `MarketPackageDetail`, `RegistryVersion`, `ComponentKind`, `KiboError` (`@kibo/schema`, T1 et T5) ; `RpcContext` (T9) ; `LocalSettings` n'est pas utilisé.
- Hypothèse v0.6 (vérifiée en T0) : `compareSemver(a: string, b: string): number` exporté par `@kibo/schema` (phase 4, versioning) ; `grantedPermissions(manifest: ComponentManifest): GrantedPermissions` exporté par `@kibo/schema` (phase 4, écran 30).
- Consumes aussi : `RpcContext`, `RpcOutcome`, `RpcHandler` et l'option `handlers` de `startServer` (`packages/daemon/src/rpc-extensions.ts`, T9).
- Produces :
  - `MarketDb`, `MarketSourceRow`, `openMarketDb(db: Database): MarketDb`.
  - `HttpGet`, `createHttpGet(opts: { allowLoopbackHttp: boolean; ca?: string | null; fetchImpl?: typeof fetch }): HttpGet` (Contrats, **option `ca` ajoutée** : autorité supplémentaire pour une source d'équipe auto-hébergée, reprise du `caFile` de la sync).
  - `MarketService` des Contrats, avec **`deps.log(message: string, error: unknown): void` en plus** (signature élargie, signalée au chef d'équipe).
  - `startMarketRefresh(service: MarketService, opts: { intervalMs: number; log(message: string, error: unknown): void }): () => void`.
  - `createMarketRpc(market: MarketService): (req: RpcRequest, ctx: RpcContext) => Promise<RpcOutcome>`.
  - `startFakeMarket(opts?: { id?: string; name?: string; verified?: boolean }): Promise<FakeMarket>` avec `FakeMarket = { url: string; publicKey: string; publish(pkg: Uint8Array): Promise<void>; revoke(hash: string, reason: string): Promise<void>; setSerial(serial: number): Promise<void>; resignWith(keys: KeyPair): Promise<void>; tamper(path: string, bytes: Uint8Array): void; serial(): number; stop(): void }`.
  - `createMemoryRegistry(): { port: RegistryPort; revoked: { id: string; version: string; reason: string }[] }` (réutilisé par T20 et T22).

- [ ] **Step 1: Écrire les tests de `http-get`**

`packages/daemon/src/market/http-get.test.ts` :
```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createHttpGet } from "./http-get";

let server: Server<undefined>;
let base: string;

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/ok") return new Response("hello");
      if (path === "/big") return new Response("x".repeat(2048));
      if (path === "/slow") {
        await Bun.sleep(300);
        return new Response("late");
      }
      if (path === "/same") return new Response(null, { status: 302, headers: { location: "/ok" } });
      if (path === "/other") {
        return new Response(null, { status: 302, headers: { location: `http://localhost:${server.port}/ok` } });
      }
      if (path === "/loop") return new Response(null, { status: 302, headers: { location: "/loop" } });
      return new Response("missing", { status: 404 });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(() => server.stop(true));

const get = createHttpGet({ allowLoopbackHttp: true });
const opts = { timeoutMs: 1000, maxBytes: 1024 };
const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("createHttpGet", () => {
  test("downloads a loopback resource when loopback http is allowed", async () => {
    expect(text(await get(`${base}/ok`, opts))).toBe("hello");
  });

  test("refuses plain http outside loopback", async () => {
    await expect(get("http://example.com/index.json", opts)).rejects.toThrow("TLS_REQUIRED");
  });

  test("refuses loopback http when not allowed", async () => {
    const strict = createHttpGet({ allowLoopbackHttp: false });
    await expect(strict(`${base}/ok`, opts)).rejects.toThrow("TLS_REQUIRED");
  });

  test("follows a redirect on the same host", async () => {
    expect(text(await get(`${base}/same`, opts))).toBe("hello");
  });

  test("refuses a redirect to another host", async () => {
    await expect(get(`${base}/other`, opts)).rejects.toThrow("redirect to another host");
  });

  test("stops after three redirects", async () => {
    await expect(get(`${base}/loop`, opts)).rejects.toThrow("too many redirects");
  });

  test("cuts a body larger than maxBytes", async () => {
    await expect(get(`${base}/big`, opts)).rejects.toThrow("INVALID_INPUT");
  });

  test("gives up after the timeout", async () => {
    await expect(get(`${base}/slow`, { timeoutMs: 50, maxBytes: 1024 })).rejects.toThrow("TIMEOUT");
  });

  test("maps a 404 to NOT_FOUND", async () => {
    await expect(get(`${base}/nope`, opts)).rejects.toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `bun test packages/daemon/src/market/http-get.test.ts`
Expected: FAIL avec « Cannot find module './http-get' ».

- [ ] **Step 3: Implémenter `http-get.ts`**

`packages/daemon/src/market/http-get.ts` :
```ts
import { KiboError } from "@kibo/schema";

export type HttpGet = (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<Uint8Array>;

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MAX_REDIRECTS = 3;

export function createHttpGet(opts: { allowLoopbackHttp: boolean; ca?: string | null; fetchImpl?: typeof fetch }): HttpGet {
  const doFetch = opts.fetchImpl ?? fetch;
  const allowed = (url: URL): void => {
    if (url.protocol === "https:") return;
    if (url.protocol === "http:" && opts.allowLoopbackHttp && LOOPBACK.has(url.hostname)) return;
    throw new KiboError("TLS_REQUIRED", `refusing ${url.protocol} download from ${url.host}`);
  };

  return async (raw, { timeoutMs, maxBytes }) => {
    let url = new URL(raw);
    allowed(url);
    const signal = AbortSignal.timeout(timeoutMs);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await send(doFetch, url, signal, opts.ca ?? null);
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new KiboError("INVALID_INPUT", `redirect without location from ${url.href}`);
        const next = new URL(location, url);
        if (next.host !== url.host) {
          throw new KiboError("INVALID_INPUT", `redirect to another host refused: ${next.host}`);
        }
        allowed(next);
        url = next;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new KiboError(res.status === 404 ? "NOT_FOUND" : "INTERNAL", `GET ${url.href} returned ${res.status}`);
      }
      return readLimited(res, maxBytes, url.href, signal);
    }
    throw new KiboError("INVALID_INPUT", `too many redirects from ${raw}`);
  };
}

async function send(doFetch: typeof fetch, url: URL, signal: AbortSignal, ca: string | null): Promise<Response> {
  try {
    return await doFetch(url, { redirect: "manual", signal, ...(ca ? { tls: { ca } } : {}) });
  } catch (e) {
    if (signal.aborted) throw new KiboError("TIMEOUT", `download timed out: ${url.href}`);
    throw new KiboError("INTERNAL", `download failed: ${url.href}: ${String(e)}`);
  }
}

async function readLimited(res: Response, maxBytes: number, href: string, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    await res.body?.cancel();
    throw new KiboError("INVALID_INPUT", `${href} exceeds ${maxBytes} bytes`);
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let step: ReadableStreamReadResult<Uint8Array>;
    try {
      step = await reader.read();
    } catch (e) {
      if (signal.aborted) throw new KiboError("TIMEOUT", `download timed out: ${href}`);
      throw new KiboError("INTERNAL", `download interrupted: ${href}: ${String(e)}`);
    }
    if (step.done) break;
    total += step.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new KiboError("INVALID_INPUT", `${href} exceeds ${maxBytes} bytes`);
    }
    chunks.push(step.value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
```

- [ ] **Step 4: Relancer**

Run: `bun test packages/daemon/src/market/http-get.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Écrire la fausse source et le registre en mémoire**

`packages/daemon/src/testing/fake-market.ts` :
```ts
import { decodeKpkg, generateKeyPair, type KeyPair, signIndex, utf8 } from "@kibo/trust";
import { grantedPermissions, type Kpkg, type MarketIndex } from "@kibo/schema";

export type FakeMarket = {
  url: string;
  publicKey: string;
  publish(pkg: Uint8Array): Promise<void>;
  revoke(hash: string, reason: string): Promise<void>;
  setSerial(serial: number): Promise<void>;
  resignWith(keys: KeyPair): Promise<void>;
  tamper(path: string, bytes: Uint8Array): void;
  serial(): number;
  stop(): void;
};

export async function startFakeMarket(
  opts: { id?: string; name?: string; verified?: boolean } = {},
): Promise<FakeMarket> {
  const id = opts.id ?? "equipe";
  const name = opts.name ?? "Équipe";
  let keys = await generateKeyPair();
  let serial = 1;
  const packages: { pkg: Kpkg; bytes: Uint8Array }[] = [];
  const revoked: { hash: string; reason: string }[] = [];
  const files = new Map<string, Uint8Array>();
  const tampered = new Map<string, Uint8Array>();

  const rebuild = async (): Promise<void> => {
    const ids = [...new Set(packages.map((p) => p.pkg.manifest.id))];
    const index: MarketIndex = {
      format: 1,
      source: { id, name, publicKey: keys.publicKey },
      serial,
      generatedAt: new Date(0).toISOString(),
      publishers: [...new Map(packages.map((p) => [p.pkg.publisher.publicKey, p.pkg.publisher.name])).entries()].map(
        ([publicKey, pname]) => ({ publicKey, name: pname, verified: opts.verified ?? true }),
      ),
      packages: ids.map((pid) => {
        const versions = packages.filter((p) => p.pkg.manifest.id === pid);
        const latest = versions[versions.length - 1];
        if (!latest) throw new Error(`no version for ${pid}`);
        return {
          id: pid,
          title: latest.pkg.manifest.title,
          description: latest.pkg.manifest.description ?? "",
          kind: latest.pkg.manifest.kind,
          versions: versions.map(({ pkg, bytes }) => ({
            version: pkg.manifest.version,
            hash: pkg.hash,
            publisherKey: pkg.publisher.publicKey,
            size: bytes.byteLength,
            permissions: grantedPermissions(pkg.manifest),
            publishedAt: pkg.publishedAt,
            url: `packages/${pid}/${pkg.manifest.version}.kpkg`,
          })),
        };
      }),
      revoked: [...revoked],
    };
    const signed = await signIndex(index, keys.privateKey);
    files.set("index.json", signed.bytes);
    files.set("index.json.sig", utf8(signed.sig));
    for (const { pkg, bytes } of packages) files.set(`packages/${pkg.manifest.id}/${pkg.manifest.version}.kpkg`, bytes);
  };

  await rebuild();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname.slice(1));
      const body = tampered.get(path) ?? files.get(path);
      return body ? new Response(body) : new Response("not found", { status: 404 });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}/`,
    get publicKey() {
      return keys.publicKey;
    },
    async publish(bytes) {
      packages.push({ pkg: decodeKpkg(bytes), bytes });
      serial += 1;
      await rebuild();
    },
    async revoke(hash, reason) {
      revoked.push({ hash, reason });
      serial += 1;
      await rebuild();
    },
    async setSerial(next) {
      serial = next;
      await rebuild();
    },
    async resignWith(next) {
      keys = next;
      serial += 1;
      await rebuild();
    },
    tamper(path, bytes) {
      tampered.set(path, bytes);
    },
    serial: () => serial,
    stop: () => server.stop(true),
  };
}
```

`packages/daemon/src/testing/memory-registry.ts` :
```ts
import type { RegistryVersion } from "@kibo/schema";
import type { RegistryPort } from "../market/market-service";

type Row = { id: string; title: string; version: string; v: RegistryVersion };

export function createMemoryRegistry(): {
  port: RegistryPort;
  revoked: { id: string; version: string; reason: string }[];
} {
  const rows = new Map<string, Row>();
  const revoked: { id: string; version: string; reason: string }[] = [];
  const port: RegistryPort = {
    get: (id, version) => rows.get(`${id}@${version}`)?.v ?? null,
    put: (id, title, v) => {
      rows.set(`${id}@${v.version}`, { id, title, version: v.version, v });
    },
    installed: () => [...rows.values()],
    revoke: async (id, version, reason, at) => {
      const row = rows.get(`${id}@${version}`);
      if (!row) return;
      rows.set(`${id}@${version}`, { ...row, v: { ...row.v, trust: null, revoked: { reason, at } } });
      revoked.push({ id, version, reason });
    },
  };
  return { port, revoked };
}
```

- [ ] **Step 6: Écrire les tests du service**

`packages/daemon/src/market/market-service.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { generateKeyPair, keyFingerprint } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";

let fake: FakeMarket;
let db: Database;
let registry: ReturnType<typeof createMemoryRegistry>;
let notify: ReturnType<typeof mock>;
let log: ReturnType<typeof mock>;
let service: MarketService;
let now = 1_000;

const burndown = (version: string) =>
  makeTestPackage({
    id: "burndown",
    version,
    manifest: { title: "Burndown", description: "Graphe énergie du sprint", kind: "widget" },
  });

beforeEach(async () => {
  fake = await startFakeMarket();
  db = new Database(":memory:");
  registry = createMemoryRegistry();
  notify = mock(async (_: { title: string; body: string }) => {});
  log = mock((_m: string, _e: unknown) => {});
  now = 1_000;
  service = new MarketService({
    db: openMarketDb(db),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: registry.port,
    now: () => now,
    notify,
    log,
  });
});
afterEach(() => {
  fake.stop();
  db.close();
});

describe("sources", () => {
  test("probe reads the index and reports the announced key", async () => {
    await fake.publish((await burndown("0.1.0")).bytes);
    const probe = await service.probe(fake.url);
    expect(probe).toEqual({
      sourceId: "equipe",
      name: "Équipe",
      publicKey: fake.publicKey,
      fingerprint: await keyFingerprint(fake.publicKey),
      serial: 2,
      packages: 1,
    });
  });

  test("adding a source with another key is refused and stores nothing", async () => {
    const other = await generateKeyPair();
    await expect(service.addSource({ url: fake.url, publicKey: other.publicKey })).rejects.toThrow("SIGNATURE_INVALID");
    expect(service.listSources()).toEqual([]);
  });

  test("an added source lists its fingerprint and serial", async () => {
    const info = await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    expect(info.id).toBe("equipe");
    expect(info.fingerprint).toBe(await keyFingerprint(fake.publicKey));
    expect(info.lastSerial).toBe(1);
    expect(service.listSources()).toHaveLength(1);
  });

  test("an index with a lower serial is refused and the cache kept", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.publish((await burndown("0.1.0")).bytes);
    await fake.publish((await burndown("0.2.0")).bytes);
    await service.refresh();
    await fake.setSerial(2);
    await service.refresh();
    const [source] = service.listSources();
    expect(source?.lastSerial).toBe(3);
    expect(source?.lastError).toContain("INDEX_ROLLBACK");
    expect(log).toHaveBeenCalled();
    expect(service.search({ query: "" })[0]?.latest).toBe("0.2.0");
  });

  test("an explicit refresh of one source rethrows its error", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.setSerial(5);
    await service.refresh();
    await fake.setSerial(2);
    await expect(service.refresh("equipe")).rejects.toThrow("INDEX_ROLLBACK");
  });

  test("a source whose key changed is refused", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.resignWith(await generateKeyPair());
    await service.refresh();
    expect(service.listSources()[0]?.lastError).toContain("SIGNATURE_INVALID");
  });
});

describe("revocation", () => {
  test("a revoked installed version loses its trust and notifies", async () => {
    const pkg = await burndown("0.1.0");
    await fake.publish(pkg.bytes);
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    registry.port.put("burndown", "Burndown", {
      version: "0.1.0",
      hash: pkg.pkg.hash,
      origin: "marketplace",
      trust: "sandboxed",
      approvedHash: pkg.pkg.hash,
      granted: { reads: [], writes: [], data: false, net: [] },
      publishedAt: 0,
      source: { sourceId: "equipe", publisherKey: pkg.publisher.keys.publicKey },
      revoked: null,
    });
    now = 5_000;
    await fake.revoke(pkg.pkg.hash, "Faille de sécurité");
    await service.refresh();
    expect(registry.revoked).toEqual([{ id: "burndown", version: "0.1.0", reason: "Faille de sécurité" }]);
    expect(registry.port.get("burndown", "0.1.0")?.revoked).toEqual({ reason: "Faille de sécurité", at: 5_000 });
    expect(notify).toHaveBeenCalledWith({ title: "Composant révoqué : Burndown", body: "Faille de sécurité" });
    await service.refresh();
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe("search and packages", () => {
  beforeEach(async () => {
    await fake.publish((await burndown("0.1.0")).bytes);
    await fake.publish(
      (
        await makeTestPackage({
          id: "roadmap",
          version: "1.0.0",
          manifest: { title: "Feuille de route", description: "Jalons du projet", kind: "view" },
        })
      ).bytes,
    );
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
  });

  test("search ignores case and accents on title, description and id", () => {
    expect(service.search({ query: "ENERGIE" }).map((h) => h.id)).toEqual(["burndown"]);
    expect(service.search({ query: "feuille" }).map((h) => h.id)).toEqual(["roadmap"]);
    expect(service.search({ query: "burn" }).map((h) => h.id)).toEqual(["burndown"]);
  });

  test("search filters by kind and by source", () => {
    expect(service.search({ query: "", kind: "view" }).map((h) => h.id)).toEqual(["roadmap"]);
    expect(service.search({ query: "", sourceId: "ailleurs" })).toEqual([]);
  });

  test("a newer version is offered as an update of the installed one", async () => {
    const installed = service.search({ query: "burn" })[0];
    registry.port.put("burndown", "Burndown", {
      version: "0.1.0",
      hash: "0".repeat(64),
      origin: "marketplace",
      trust: "sandboxed",
      approvedHash: "0".repeat(64),
      granted: { reads: [], writes: [], data: false, net: [] },
      publishedAt: 0,
      source: { sourceId: "equipe", publisherKey: installed?.publisher.publicKey ?? "" },
      revoked: null,
    });
    await fake.publish((await burndown("0.2.0")).bytes);
    await service.refresh();
    const hit = service.search({ query: "burn" })[0];
    expect(hit?.installed).toBe("0.1.0");
    expect(hit?.updateAvailable).toBe("0.2.0");
  });

  test("the detail returns verified sources and flags a new publisher", async () => {
    const detail = await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(detail.files.map((f) => f.path)).toContain("ui.tsx");
    expect(detail.files.find((f) => f.path === "ui.tsx")?.content).toContain("export");
    expect(detail.newPublisher).toBe(true);
    expect(detail.publisherChanged).toBe(false);
    service.pinPublisher("equipe", "burndown", detail.publisher.publicKey);
    expect((await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).newPublisher).toBe(false);
  });

  test("a changed publisher key is flagged in the detail and refused for install", async () => {
    const other = await generateKeyPair();
    service.pinPublisher("equipe", "burndown", other.publicKey);
    const detail = await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(detail.publisherChanged).toBe(true);
    expect(detail.pinnedPublisher).toBe(other.publicKey);
    await expect(service.fetchVerified({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "PUBLISHER_CHANGED",
    );
    service.unpinPublisher({ sourceId: "equipe", componentId: "burndown" });
    expect((await service.fetchVerified({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).newPublisher).toBe(true);
  });

  test("a tampered package is refused", async () => {
    fake.tamper("packages/burndown/0.1.0.kpkg", new TextEncoder().encode("{}"));
    await expect(service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });

  test("findSourceFor requires the same hash when one is given", async () => {
    const hash = (await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).hash;
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash })).toEqual({ sourceId: "equipe" });
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash: "f".repeat(64) })).toBeNull();
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash: null })).toEqual({ sourceId: "equipe" });
    expect(service.findSourceFor({ id: "burndown", version: "9.9.9", hash: null })).toBeNull();
  });

  test("the cache survives a restart of the service", async () => {
    const again = new MarketService({
      db: openMarketDb(db),
      get: createHttpGet({ allowLoopbackHttp: true }),
      registry: registry.port,
      now: () => now,
      notify,
      log,
    });
    fake.stop();
    await again.load();
    expect(again.search({ query: "" }).map((h) => h.id).sort()).toEqual(["burndown", "roadmap"]);
  });
});
```

- [ ] **Step 7: Lancer pour voir échouer**

Run: `bun test packages/daemon/src/market/market-service.test.ts`
Expected: FAIL avec « Cannot find module './market-db' ».

- [ ] **Step 8: Implémenter `market-db.ts`**

`packages/daemon/src/market/market-db.ts` :
```ts
import type { Database } from "bun:sqlite";

export type MarketSourceRow = {
  id: string;
  url: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  lastSerial: number | null;
  lastFetchedAt: number | null;
  enabled: boolean;
  lastError: string | null;
};

export type MarketDb = {
  sources(): MarketSourceRow[];
  source(id: string): MarketSourceRow | null;
  addSource(row: MarketSourceRow): void;
  removeSource(id: string): void;
  setFetched(id: string, input: { serial: number; bytes: Uint8Array; sig: string; at: number }): void;
  setError(id: string, message: string | null): void;
  cachedIndex(id: string): { bytes: Uint8Array; sig: string } | null;
  pin(sourceId: string, componentId: string): string | null;
  setPin(sourceId: string, componentId: string, publisherKey: string, at: number): void;
  unpin(sourceId: string, componentId: string): void;
};

type SourceRecord = Omit<MarketSourceRow, "enabled"> & { enabled: number };

export function openMarketDb(db: Database): MarketDb {
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL, name TEXT NOT NULL, " +
      "publicKey TEXT NOT NULL, fingerprint TEXT NOT NULL, lastSerial INTEGER, lastFetchedAt INTEGER, " +
      "enabled INTEGER NOT NULL DEFAULT 1, lastError TEXT)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_pins (sourceId TEXT NOT NULL, componentId TEXT NOT NULL, " +
      "publisherKey TEXT NOT NULL, pinnedAt INTEGER NOT NULL, PRIMARY KEY (sourceId, componentId))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS market_index_cache (sourceId TEXT PRIMARY KEY, bytes BLOB NOT NULL, " +
      "sig TEXT NOT NULL, fetchedAt INTEGER NOT NULL)",
  );
  const toRow = (r: SourceRecord): MarketSourceRow => ({ ...r, enabled: r.enabled === 1 });
  return {
    sources: () => (db.query("SELECT * FROM market_sources ORDER BY name").all() as SourceRecord[]).map(toRow),
    source: (id) => {
      const r = db.query("SELECT * FROM market_sources WHERE id = ?").get(id) as SourceRecord | null;
      return r ? toRow(r) : null;
    },
    addSource: (row) => {
      db.query(
        "INSERT INTO market_sources (id, url, name, publicKey, fingerprint, lastSerial, lastFetchedAt, enabled, lastError) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(row.id, row.url, row.name, row.publicKey, row.fingerprint, row.lastSerial, row.lastFetchedAt,
        row.enabled ? 1 : 0, row.lastError);
    },
    removeSource: (id) => {
      db.query("DELETE FROM market_sources WHERE id = ?").run(id);
      db.query("DELETE FROM market_index_cache WHERE sourceId = ?").run(id);
    },
    setFetched: (id, { serial, bytes, sig, at }) => {
      db.transaction(() => {
        db.query("UPDATE market_sources SET lastSerial = ?, lastFetchedAt = ?, lastError = NULL WHERE id = ?").run(
          serial, at, id);
        db.query(
          "INSERT INTO market_index_cache (sourceId, bytes, sig, fetchedAt) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(sourceId) DO UPDATE SET bytes = excluded.bytes, sig = excluded.sig, fetchedAt = excluded.fetchedAt",
        ).run(id, bytes, sig, at);
      })();
    },
    setError: (id, message) => {
      db.query("UPDATE market_sources SET lastError = ? WHERE id = ?").run(message, id);
    },
    cachedIndex: (id) => {
      const r = db.query("SELECT bytes, sig FROM market_index_cache WHERE sourceId = ?").get(id) as
        | { bytes: Uint8Array; sig: string }
        | null;
      return r ? { bytes: new Uint8Array(r.bytes), sig: r.sig } : null;
    },
    pin: (sourceId, componentId) => {
      const r = db.query("SELECT publisherKey FROM market_pins WHERE sourceId = ? AND componentId = ?").get(
        sourceId, componentId) as { publisherKey: string } | null;
      return r?.publisherKey ?? null;
    },
    setPin: (sourceId, componentId, publisherKey, at) => {
      db.query(
        "INSERT INTO market_pins (sourceId, componentId, publisherKey, pinnedAt) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(sourceId, componentId) DO UPDATE SET publisherKey = excluded.publisherKey, pinnedAt = excluded.pinnedAt",
      ).run(sourceId, componentId, publisherKey, at);
    },
    unpin: (sourceId, componentId) => {
      db.query("DELETE FROM market_pins WHERE sourceId = ? AND componentId = ?").run(sourceId, componentId);
    },
  };
}
```
La suppression d'une source garde les épinglages : ils ne portent aucun secret et réinstaller depuis la même source doit retrouver la même exigence (spec H §5.4).

- [ ] **Step 9: Implémenter `market-service.ts`**

`packages/daemon/src/market/market-service.ts` :
```ts
import {
  type ComponentKind,
  compareSemver,
  KiboError,
  type Kpkg,
  KPKG_MAX_BYTES,
  MARKET_FETCH_TIMEOUT_MS,
  type MarketHit,
  MarketIndex,
  type MarketPackageDetail,
  type MarketProbe,
  type MarketSourceInfo,
  type RegistryVersion,
} from "@kibo/schema";
import { decodeKpkg, keyFingerprint, type SourceFile, verifyIndex, verifyMarketPackage } from "@kibo/trust";
import { z } from "zod";
import type { HttpGet } from "./http-get";
import type { MarketDb, MarketSourceRow } from "./market-db";

export type RegistryPort = {
  get(id: string, version: string): RegistryVersion | null;
  put(id: string, title: string, v: RegistryVersion): void;
  installed(): { id: string; title: string; version: string; v: RegistryVersion }[];
  revoke(id: string, version: string, reason: string, at: number): Promise<void>;
};

export type MarketServiceDeps = {
  db: MarketDb;
  get: HttpGet;
  registry: RegistryPort;
  now: () => number;
  notify(msg: { title: string; body: string }): Promise<void>;
  log(message: string, error: unknown): void;
};

const INDEX_MAX_BYTES = 8 * 1024 * 1024;
const SIG_MAX_BYTES = 4096;
const KPKG_DOWNLOAD_MAX = KPKG_MAX_BYTES * 2;
const Announced = z.object({ source: z.object({ id: z.string(), name: z.string(), publicKey: z.string() }) });

const withSlash = (url: string) => (url.endsWith("/") ? url : `${url}/`);
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const message = (e: unknown) => (e instanceof KiboError ? e.message : String(e));

export class MarketService {
  private readonly indexes = new Map<string, MarketIndex>();

  constructor(private readonly deps: MarketServiceDeps) {}

  async load(): Promise<void> {
    for (const row of this.deps.db.sources()) {
      const cached = this.deps.db.cachedIndex(row.id);
      if (!cached) continue;
      try {
        this.indexes.set(row.id, await verifyIndex({ ...cached, expectedKey: row.publicKey, lastSerial: row.lastSerial }));
      } catch (e) {
        this.deps.db.setError(row.id, message(e));
        this.deps.log(`market: cached index of ${row.id} rejected`, e);
      }
    }
  }

  listSources(): MarketSourceInfo[] {
    return this.deps.db.sources().map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      publicKey: r.publicKey,
      fingerprint: r.fingerprint,
      lastSerial: r.lastSerial,
      lastFetchedAt: r.lastFetchedAt,
      lastError: r.lastError,
      enabled: r.enabled,
    }));
  }

  async probe(url: string): Promise<MarketProbe> {
    const fetched = await this.fetchIndex(url);
    const announced = Announced.safeParse(JSON.parse(new TextDecoder().decode(fetched.bytes)));
    if (!announced.success) throw new KiboError("INVALID_INPUT", `not a Kibo market index: ${url}`);
    const index = await verifyIndex({ ...fetched, expectedKey: announced.data.source.publicKey, lastSerial: null });
    return {
      sourceId: index.source.id,
      name: index.source.name,
      publicKey: index.source.publicKey,
      fingerprint: await keyFingerprint(index.source.publicKey),
      serial: index.serial,
      packages: index.packages.length,
    };
  }

  async addSource(input: { url: string; publicKey: string }): Promise<MarketSourceInfo> {
    const fetched = await this.fetchIndex(input.url);
    const index = await verifyIndex({ ...fetched, expectedKey: input.publicKey, lastSerial: null });
    if (this.deps.db.source(index.source.id)) {
      throw new KiboError("INVALID_INPUT", `market source ${index.source.id} already exists`);
    }
    this.deps.db.addSource({
      id: index.source.id,
      url: withSlash(input.url),
      name: index.source.name,
      publicKey: input.publicKey,
      fingerprint: await keyFingerprint(input.publicKey),
      lastSerial: null,
      lastFetchedAt: null,
      enabled: true,
      lastError: null,
    });
    this.deps.db.setFetched(index.source.id, { serial: index.serial, ...fetched, at: this.deps.now() });
    this.indexes.set(index.source.id, index);
    const info = this.listSources().find((s) => s.id === index.source.id);
    if (!info) throw new KiboError("INTERNAL", `market source ${index.source.id} was not stored`);
    return info;
  }

  removeSource(id: string): void {
    this.deps.db.removeSource(id);
    this.indexes.delete(id);
  }

  async refresh(sourceId?: string): Promise<void> {
    const rows = this.deps.db.sources().filter((r) => r.enabled && (sourceId === undefined || r.id === sourceId));
    if (sourceId !== undefined && rows.length === 0) throw new KiboError("NOT_FOUND", `market source ${sourceId}`);
    for (const row of rows) {
      try {
        await this.refreshOne(row);
      } catch (e) {
        this.deps.db.setError(row.id, message(e));
        this.deps.log(`market: refresh of ${row.id} failed`, e);
        if (sourceId !== undefined) throw e;
      }
    }
  }

  search(input: { query: string; sourceId?: string; kind?: ComponentKind }): MarketHit[] {
    const q = fold(input.query.trim());
    const hits: MarketHit[] = [];
    for (const row of this.deps.db.sources()) {
      if (!row.enabled || (input.sourceId !== undefined && row.id !== input.sourceId)) continue;
      const index = this.indexes.get(row.id);
      if (!index) continue;
      for (const p of index.packages) {
        if (input.kind !== undefined && p.kind !== input.kind) continue;
        if (q && ![p.title, p.description, p.id].some((t) => fold(t).includes(q))) continue;
        const hit = this.hit(row, index, p.id);
        if (hit) hits.push(hit);
      }
    }
    return hits.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }

  async getPackage(input: { sourceId: string; id: string; version: string }): Promise<MarketPackageDetail> {
    const { row, index } = this.source(input.sourceId);
    const pkg = await this.download(row, index, input.id, input.version);
    const pinned = this.deps.db.pin(input.sourceId, input.id);
    let publisherChanged = false;
    let verified: { files: SourceFile[]; newPublisher: boolean };
    try {
      verified = await verifyMarketPackage({ pkg, index, pinnedKey: pinned });
    } catch (e) {
      if (!(e instanceof KiboError) || e.code !== "PUBLISHER_CHANGED") throw e;
      publisherChanged = true;
      verified = await verifyMarketPackage({ pkg, index, pinnedKey: null });
    }
    const hit = this.hit(row, index, input.id);
    const entry = index.packages.find((p) => p.id === input.id);
    const version = entry?.versions.find((v) => v.version === input.version);
    if (!hit || !entry || !version) throw new KiboError("NOT_FOUND", `${input.id}@${input.version}`);
    const revoked = new Map(index.revoked.map((r) => [r.hash, r.reason]));
    const decoder = new TextDecoder();
    return {
      ...hit,
      publisher: this.publisher(index, version.publisherKey),
      version: input.version,
      hash: version.hash,
      size: version.size,
      permissions: version.permissions,
      versions: entry.versions.map((v) => ({
        version: v.version,
        hash: v.hash,
        size: v.size,
        permissions: v.permissions,
        publishedAt: v.publishedAt,
        revoked: revoked.get(v.hash) ?? null,
      })),
      pinnedPublisher: pinned,
      newPublisher: publisherChanged ? false : verified.newPublisher,
      publisherChanged,
      files: verified.files.map((f) => ({ path: f.path, content: decoder.decode(f.bytes) })),
    };
  }

  async fetchVerified(input: { sourceId: string; id: string; version: string }): Promise<{
    pkg: Kpkg;
    files: SourceFile[];
    newPublisher: boolean;
  }> {
    const { row, index } = this.source(input.sourceId);
    const pkg = await this.download(row, index, input.id, input.version);
    const verified = await verifyMarketPackage({ pkg, index, pinnedKey: this.deps.db.pin(input.sourceId, input.id) });
    return { pkg, ...verified };
  }

  pinPublisher(sourceId: string, componentId: string, publisherKey: string): void {
    this.deps.db.setPin(sourceId, componentId, publisherKey, this.deps.now());
  }

  unpinPublisher(input: { sourceId: string; componentId: string }): void {
    this.deps.db.unpin(input.sourceId, input.componentId);
  }

  findSourceFor(input: { id: string; version: string; hash: string | null }): { sourceId: string } | null {
    for (const row of this.deps.db.sources()) {
      const index = row.enabled ? this.indexes.get(row.id) : undefined;
      const version = index?.packages.find((p) => p.id === input.id)?.versions.find((v) => v.version === input.version);
      if (!index || !version) continue;
      if (index.revoked.some((r) => r.hash === version.hash)) continue;
      if (input.hash !== null && version.hash !== input.hash) continue;
      return { sourceId: row.id };
    }
    return null;
  }

  sourceUrl(sourceId: string): string {
    return this.source(sourceId).row.url;
  }

  private async refreshOne(row: MarketSourceRow): Promise<void> {
    const fetched = await this.fetchIndex(row.url);
    const index = await verifyIndex({ ...fetched, expectedKey: row.publicKey, lastSerial: row.lastSerial });
    this.deps.db.setFetched(row.id, { serial: index.serial, ...fetched, at: this.deps.now() });
    this.indexes.set(row.id, index);
    const revoked = new Map(index.revoked.map((r) => [r.hash, r.reason]));
    for (const item of this.deps.registry.installed()) {
      const reason = revoked.get(item.v.hash);
      if (reason === undefined || item.v.source?.sourceId !== row.id || item.v.revoked !== null) continue;
      await this.deps.registry.revoke(item.id, item.version, reason, this.deps.now());
      await this.deps.notify({ title: `Composant révoqué : ${item.title}`, body: reason });
    }
  }

  private async fetchIndex(url: string): Promise<{ bytes: Uint8Array; sig: string }> {
    const base = withSlash(url);
    const bytes = await this.deps.get(new URL("index.json", base).href, {
      timeoutMs: MARKET_FETCH_TIMEOUT_MS,
      maxBytes: INDEX_MAX_BYTES,
    });
    const sig = await this.deps.get(new URL("index.json.sig", base).href, {
      timeoutMs: MARKET_FETCH_TIMEOUT_MS,
      maxBytes: SIG_MAX_BYTES,
    });
    return { bytes, sig: new TextDecoder().decode(sig).trim() };
  }

  private source(sourceId: string): { row: MarketSourceRow; index: MarketIndex } {
    const row = this.deps.db.source(sourceId);
    const index = this.indexes.get(sourceId);
    if (!row || !index) throw new KiboError("NOT_FOUND", `market source ${sourceId} has no verified index`);
    return { row, index };
  }

  private async download(row: MarketSourceRow, index: MarketIndex, id: string, version: string): Promise<Kpkg> {
    const entry = index.packages.find((p) => p.id === id)?.versions.find((v) => v.version === version);
    if (!entry) throw new KiboError("NOT_FOUND", `${id}@${version} is not in ${row.id}`);
    const bytes = await this.deps.get(new URL(entry.url, row.url).href, {
      timeoutMs: MARKET_FETCH_TIMEOUT_MS,
      maxBytes: KPKG_DOWNLOAD_MAX,
    });
    return decodeKpkg(bytes);
  }

  private publisher(index: MarketIndex, key: string): MarketHit["publisher"] {
    const p = index.publishers.find((x) => x.publicKey === key);
    return { name: p?.name ?? "?", publicKey: key, verified: p?.verified ?? false };
  }

  private hit(row: MarketSourceRow, index: MarketIndex, id: string): MarketHit | null {
    const entry = index.packages.find((p) => p.id === id);
    if (!entry) return null;
    const revoked = new Set(index.revoked.map((r) => r.hash));
    const live = entry.versions.filter((v) => !revoked.has(v.hash)).sort((a, b) => compareSemver(a.version, b.version));
    const latest = live[live.length - 1];
    if (!latest) return null;
    const mine = this.deps.registry
      .installed()
      .filter((i) => i.id === id && i.v.source?.sourceId === row.id)
      .map((i) => i.version)
      .sort(compareSemver);
    const installed = mine[mine.length - 1] ?? null;
    return {
      sourceId: row.id,
      sourceName: row.name,
      id,
      title: entry.title,
      description: entry.description,
      kind: entry.kind,
      latest: latest.version,
      publisher: this.publisher(index, latest.publisherKey),
      installed,
      updateAvailable: installed !== null && compareSemver(latest.version, installed) > 0 ? latest.version : null,
    };
  }
}
```

- [ ] **Step 10: Relancer**

Run: `bun test packages/daemon/src/market/market-service.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 11: Test des RPC**

`packages/daemon/src/market/rpc.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { startFakeMarket, type FakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { createMarketRpc } from "./rpc";

let fake: FakeMarket;
let rpc: ReturnType<typeof createMarketRpc>;
const local = { sessionHash: "a".repeat(64), remote: false };
const remote = { sessionHash: "b".repeat(64), remote: true };

beforeEach(async () => {
  fake = await startFakeMarket();
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: createMemoryRegistry().port,
    now: () => 1,
    notify: mock(async () => {}),
    log: mock(() => {}),
  });
  rpc = createMarketRpc(market);
});
afterEach(() => fake.stop());

test("addMarketSource and unpinPublisher are refused from a remote session", async () => {
  await expect(rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, remote)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(rpc({ method: "unpinPublisher", sourceId: "equipe", componentId: "x" }, remote)).rejects.toThrow(
    "FORBIDDEN",
  );
});

test("a local session adds a source then lists it", async () => {
  await rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, local);
  const out = await rpc({ method: "listMarketSources" }, remote);
  expect(out.handled && Array.isArray(out.result) && out.result.length).toBe(1);
});

test("other methods are left to the next handler", async () => {
  expect(await rpc({ method: "listProjects" }, local)).toEqual({ handled: false });
});

test("findMarketSource answers null when nothing matches", async () => {
  expect(await rpc({ method: "findMarketSource", id: "x", version: "1.0.0", hash: null }, local)).toEqual({
    handled: true,
    result: null,
  });
});
```

Run: `bun test packages/daemon/src/market/rpc.test.ts`
Expected: FAIL avec « Cannot find module './rpc' ».

- [ ] **Step 12: Implémenter `rpc.ts` et la planification**

`packages/daemon/src/market/rpc.ts` :
```ts
import { KiboError, type RpcRequest } from "@kibo/schema";
import type { RpcContext, RpcOutcome } from "../rpc-extensions";
import type { MarketService } from "./market-service";

const localOnly = (ctx: RpcContext, method: string): void => {
  if (ctx.remote) throw new KiboError("FORBIDDEN", `${method} requires a local session`);
};

export function createMarketRpc(market: MarketService): (req: RpcRequest, ctx: RpcContext) => Promise<RpcOutcome> {
  const done = (result: unknown): RpcOutcome => ({ handled: true, result });
  return async (req, ctx) => {
    switch (req.method) {
      case "listMarketSources":
        return done(market.listSources());
      case "probeMarketSource":
        return done(await market.probe(req.url));
      case "addMarketSource":
        localOnly(ctx, req.method);
        return done(await market.addSource({ url: req.url, publicKey: req.publicKey }));
      case "removeMarketSource":
        market.removeSource(req.id);
        return done(null);
      case "refreshMarket":
        await market.refresh();
        return done(market.listSources());
      case "searchMarket":
        return done(market.search({ query: req.query, sourceId: req.sourceId, kind: req.kind }));
      case "getMarketPackage":
        return done(await market.getPackage({ sourceId: req.sourceId, id: req.id, version: req.version }));
      case "unpinPublisher":
        localOnly(ctx, req.method);
        market.unpinPublisher({ sourceId: req.sourceId, componentId: req.componentId });
        return done(null);
      case "findMarketSource":
        return done(market.findSourceFor({ id: req.id, version: req.version, hash: req.hash }));
      default:
        return { handled: false };
    }
  };
}
```

`packages/daemon/src/market/refresh-schedule.ts` :
```ts
import type { MarketService } from "./market-service";

export function startMarketRefresh(
  service: MarketService,
  opts: { intervalMs: number; log(message: string, error: unknown): void },
): () => void {
  const run = () => {
    service.refresh().catch((e: unknown) => opts.log("market: scheduled refresh failed", e));
  };
  service.load().then(run, (e: unknown) => opts.log("market: cache load failed", e));
  const timer = setInterval(run, opts.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
```

Dans `main.ts`, passer `createMarketRpc(market)` dans l'option `handlers` de `startServer` (mécanisme de T9 ; `service.ts` n'est pas modifié) :
```ts
const market = new MarketService({
  db: openMarketDb(store.db),
  get: createHttpGet({ allowLoopbackHttp: process.env.KIBO_MARKET_ALLOW_LOOPBACK === "1" }),
  registry: registryPort,
  now: Date.now,
  notify,
  log: (m, e) => console.error(`[kibo-daemon] ${m}`, e),
});
const stopMarket = startMarketRefresh(market, {
  intervalMs: MARKET_REFRESH_MS,
  log: (m, e) => console.error(`[kibo-daemon] ${m}`, e),
});
```
et appeler `stopMarket()` dans `shutdown`. `registryPort` adapte le `Registry` de la phase 4 (`get`, `put`, `all`) et `revoke` appelle `Registry.setTrust(id, version, null)`, écrit `revoked`, arrête le backend de la version (`backendHost.stop(ref)`) et journalise `component_events` ; `notify` est la notification système de la phase 2. `KIBO_MARKET_ALLOW_LOOPBACK=1` n'est posé que par les E2E (T32).

Hypothèse v0.6 (vérifiée en T0) : `backendHost.stop(ref: string): Promise<void>` existe sur l'hôte des backends de la phase 4.

- [ ] **Step 13: Relancer tout le dossier**

Run: `bun test packages/daemon/src/market`
Expected: PASS.

- [ ] **Step 14: Vérifications**

Run: `bun run check && bun run typecheck`
Expected: aucune erreur.

- [ ] **Step 15: Commit**

```bash
git add packages/daemon/package.json packages/daemon/src/market packages/daemon/src/testing/fake-market.ts packages/daemon/src/testing/memory-registry.ts packages/daemon/src/main.ts bun.lock
git commit -m "feat(daemon): sources de marketplace"
```

---

### Task 16: Marketplace d'équipe sur kibo-sync

Source de marketplace servie par `kibo-sync` (spec H §5.1 point 4, §6, décisions 5 et 21) : clé de source conservée côté serveur (`0600`), publication authentifiée par la clé d'appareil (requête signée), contrôle de la signature et de l'empreinte, un seul éditeur par composant, index reconstruit, re-signé et à numéro croissant à chaque publication ou révocation, routes HTTP de lecture et d'écriture.

**Files:**
- Create: `packages/sync-server/src/market/team-market.ts`, `packages/sync-server/src/market/signed-request.ts`, `packages/sync-server/src/market/routes.ts`
- Modify: `packages/sync-server/src/index.ts` (exports)
- Test: `packages/sync-server/src/market/team-market.test.ts`, `packages/sync-server/src/market/routes.test.ts`

**Interfaces:**
- Consumes (T10) : `decodeKpkg`, `verifyKpkgSignature`, `kpkgSourceFiles`, `encodeKpkg`, `signIndex`, `verifyIndex` ; `makeTestPackage` (`@kibo/trust/testing`). (T2) : `generateKeyPair`, `keyFingerprint`, `sha256Hex`, `httpSigningPayload`, `HTTP_SIGNATURE_HEADERS`, `signRequest`, `verifyBytes`. (T11) : `ServerDb`, `openServerDb`, `deviceRecord`, `createInvite`, `redeemDeviceInvite`, `audit`. (T5) : `MarketIndex`, `Sha256`, `KPKG_MAX_BYTES`.
- Produces : `initMarketSource`, `TeamMarket`, `NonceCache`, `verifySignedRequest` (Contrats), et **nouveau** :
  - `type MarketRouteDeps = { sdb: ServerDb; market: TeamMarket; nonces: NonceCache; now: () => number }`
  - `handleMarketRoute(req: Request, url: URL, deps: MarketRouteDeps): Promise<Response | null>` (`null` = route non marketplace)
  - `TeamMarket.source(): { id: string; name: string; publicKey: string }`
  - `MARKET_SOURCE_FILE = "market-source.json"`, `SIGNED_REQUEST_SKEW_MS = 300_000`, `NONCE_TTL_MS = 600_000`

Réponses HTTP : succès `{ ok: true, result }`, erreur `{ ok: false, error: { code, message } }` comme le démon. Statuts : `UNAUTHORIZED` et `DEVICE_REVOKED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VERSION_EXISTS` et `PUBLISHER_CHANGED` 409, `REVOKED` 410, `SIGNATURE_INVALID` et `HASH_MISMATCH` 422, `INVALID_INPUT` 400, corps trop gros 413, autre erreur 500 journalisée.

- [ ] **Step 1: Écrire les tests de la source d'équipe**

`packages/sync-server/src/market/team-market.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, verifyIndex } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createInvite, redeemDeviceInvite } from "../accounts";
import { openServerDb, type ServerDb } from "../db";
import { initMarketSource, MARKET_SOURCE_FILE, TeamMarket } from "./team-market";

let dir: string;
let sdb: ServerDb;
let market: TeamMarket;
let sourceKey: string;
let lea: string;
let tom: string;
const NOW = 1_800_000_000_000;

async function user(name: string) {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, NOW);
  const keys = await generateKeyPair();
  return (await redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: name }, NOW)).userId;
}

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "no-code",
  );

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-team-market-"));
  sdb = openServerDb(join(dir, "sync.db"));
  sourceKey = (await initMarketSource(dir, { id: "equipe", name: "Équipe" })).publicKey;
  const opened = await TeamMarket.open(sdb, dir);
  if (!opened) throw new Error("market source was not initialised");
  market = opened;
  lea = await user("Léa");
  tom = await user("Tom");
});
afterEach(() => {
  sdb.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("source", () => {
  test("keeps its key in a 0600 file and refuses a second init", async () => {
    expect(statSync(join(dir, MARKET_SOURCE_FILE)).mode & 0o777).toBe(0o600);
    expect(await outcome(initMarketSource(dir, { id: "equipe", name: "Équipe" }))).toBe("INVALID_INPUT");
  });
  test("returns null when no source was initialised", async () => {
    const other = mkdtempSync(join(tmpdir(), "kibo-team-market-none-"));
    expect(await TeamMarket.open(sdb, other)).toBeNull();
    rmSync(other, { recursive: true, force: true });
  });
  test("starts with an empty signed index at serial 1", async () => {
    const { bytes, sig } = market.index();
    const index = await verifyIndex({ bytes, sig, expectedKey: sourceKey, lastSerial: null });
    expect(index.serial).toBe(1);
    expect(index.packages).toEqual([]);
  });
});

describe("publish", () => {
  test("requires the publisher or owner role", async () => {
    const { bytes } = await makeTestPackage();
    expect(await outcome(market.publish(bytes, { userId: lea }, NOW))).toBe("FORBIDDEN");
  });
  test("adds the version, bumps the serial and re-signs the index", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage({ publisherName: "Léa" });
    expect(await market.publish(bytes, { userId: lea }, NOW)).toEqual({ serial: 2 });
    const signed = market.index();
    const index = await verifyIndex({ ...signed, expectedKey: sourceKey, lastSerial: 1 });
    expect(index.serial).toBe(2);
    expect(index.packages[0]?.versions[0]).toMatchObject({
      version: "0.3.0",
      hash: pkg.hash,
      publisherKey: pkg.publisher.publicKey,
      url: "packages/burndown/0.3.0.kpkg",
    });
    expect(index.publishers).toEqual([{ publicKey: pkg.publisher.publicKey, name: "Léa", verified: true }]);
    expect(market.packageBytes("burndown", "0.3.0")).toEqual(bytes);
  });
  test("refuses the same version twice", async () => {
    market.grant(lea, "publisher");
    const first = await makeTestPackage();
    await market.publish(first.bytes, { userId: lea }, NOW);
    const again = await makeTestPackage({ keys: first.keys, files: { "extra.ts": "export const x = 1;\n" } });
    expect(await outcome(market.publish(again.bytes, { userId: lea }, NOW))).toBe("VERSION_EXISTS");
  });
  test("refuses another publisher key for the same component", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    await market.publish((await makeTestPackage()).bytes, { userId: lea }, NOW);
    const other = await makeTestPackage({ version: "0.4.0" });
    expect(await outcome(market.publish(other.bytes, { userId: tom }, NOW))).toBe("PUBLISHER_CHANGED");
  });
  test("refuses a publisher key registered by another user", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    const keys = await generateKeyPair();
    await market.publish((await makeTestPackage({ keys })).bytes, { userId: lea }, NOW);
    const stolen = await makeTestPackage({ id: "velocity", keys });
    expect(await outcome(market.publish(stolen.bytes, { userId: tom }, NOW))).toBe("FORBIDDEN");
  });
  test("refuses a package whose content does not match its hash", async () => {
    market.grant(lea, "publisher");
    const { pkg } = await makeTestPackage();
    const tampered = { ...pkg, files: pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) })) };
    const bytes = new TextEncoder().encode(JSON.stringify(tampered));
    expect(await outcome(market.publish(bytes, { userId: lea }, NOW))).toBe("HASH_MISMATCH");
  });
});

describe("revoke", () => {
  test("the publisher revokes its package and the index lists it", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    expect(await market.revoke({ hash: pkg.hash, reason: "fuite de jeton" }, { userId: lea }, NOW)).toEqual({ serial: 3 });
    const index = await verifyIndex({ ...market.index(), expectedKey: sourceKey, lastSerial: 2 });
    expect(index.revoked).toEqual([{ hash: pkg.hash, reason: "fuite de jeton" }]);
  });
  test("another publisher cannot revoke, the source owner can", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: tom }, NOW))).toBe("FORBIDDEN");
    market.grant(tom, "owner");
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: tom }, NOW))).toBe("ok");
  });
  test("an unknown hash is NOT_FOUND", async () => {
    market.grant(lea, "owner");
    expect(await outcome(market.revoke({ hash: "a".repeat(64), reason: "x" }, { userId: lea }, NOW))).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/sync-server/src/market/team-market.test.ts`
Expected: FAIL — `Cannot find module './team-market'`.

- [ ] **Step 3: Implémenter la source d'équipe**

`packages/sync-server/src/market/team-market.ts` :
```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentManifest, KiboError, type MarketIndex } from "@kibo/schema";
import {
  decodeKpkg,
  generateKeyPair,
  keyFingerprint,
  kpkgSourceFiles,
  signIndex,
  verifyKpkgSignature,
} from "@kibo/trust";
import { z } from "zod";
import { audit } from "../audit";
import type { ServerDb } from "../db";

export const MARKET_SOURCE_FILE = "market-source.json";

const SourceFile = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(64),
  publicKey: z.string().min(1),
  privateKey: z.string().min(1),
});
type SourceKeys = z.infer<typeof SourceFile>;

const TABLES = [
  "CREATE TABLE IF NOT EXISTS market_packages (id TEXT NOT NULL, version TEXT NOT NULL, hash TEXT NOT NULL, publisherKey TEXT NOT NULL, userId TEXT NOT NULL, manifestJson TEXT NOT NULL, bytes BLOB NOT NULL, size INTEGER NOT NULL, publishedAt TEXT NOT NULL, PRIMARY KEY (id, version))",
  "CREATE INDEX IF NOT EXISTS market_packages_by_hash ON market_packages(hash)",
  "CREATE TABLE IF NOT EXISTS market_revoked (hash TEXT PRIMARY KEY, reason TEXT NOT NULL, at INTEGER NOT NULL, by TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS market_roles (userId TEXT PRIMARY KEY REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner', 'publisher')))",
  "CREATE TABLE IF NOT EXISTS market_publishers (publicKey TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS market_state (id INTEGER PRIMARY KEY CHECK (id = 1), serial INTEGER NOT NULL, indexJson TEXT NOT NULL, sig TEXT NOT NULL)",
];

type PackageRow = {
  id: string;
  version: string;
  hash: string;
  publisherKey: string;
  userId: string;
  manifestJson: string;
  size: number;
  publishedAt: string;
};

const semverParts = (v: string) => v.split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10));
function compareSemver(a: string, b: string): number {
  const x = semverParts(a);
  const y = semverParts(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function initMarketSource(
  dataDir: string,
  input: { id: string; name: string },
): Promise<{ publicKey: string; fingerprint: string }> {
  const file = join(dataDir, MARKET_SOURCE_FILE);
  if (existsSync(file)) throw new KiboError("INVALID_INPUT", `market source already initialised in ${file}`);
  const keys = await generateKeyPair();
  const content = SourceFile.parse({ id: input.id, name: input.name, ...keys });
  writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return { publicKey: keys.publicKey, fingerprint: await keyFingerprint(keys.publicKey) };
}

export class TeamMarket {
  private constructor(
    private readonly sdb: ServerDb,
    private readonly keys: SourceKeys,
  ) {}

  static async open(sdb: ServerDb, dataDir: string): Promise<TeamMarket | null> {
    const file = join(dataDir, MARKET_SOURCE_FILE);
    if (!existsSync(file)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new KiboError("STORE_CORRUPT", `cannot read ${file}: ${String(e)}`);
    }
    const parsed = SourceFile.safeParse(raw);
    if (!parsed.success) throw new KiboError("STORE_CORRUPT", `${file} is not a market source: ${parsed.error.message}`);
    for (const statement of TABLES) sdb.db.exec(statement);
    const market = new TeamMarket(sdb, parsed.data);
    if (!sdb.db.query("SELECT 1 FROM market_state WHERE id = 1").get()) await market.rebuild(0, Date.now());
    return market;
  }

  source(): { id: string; name: string; publicKey: string } {
    return { id: this.keys.id, name: this.keys.name, publicKey: this.keys.publicKey };
  }

  grant(userId: string, role: "owner" | "publisher"): void {
    if (!this.sdb.db.query("SELECT 1 FROM users WHERE id = $id").get({ id: userId })) {
      throw new KiboError("NOT_FOUND", `user ${userId} not found`);
    }
    this.sdb.db
      .query("INSERT INTO market_roles (userId, role) VALUES ($userId, $role) ON CONFLICT(userId) DO UPDATE SET role = excluded.role")
      .run({ userId, role });
  }

  private role(userId: string): "owner" | "publisher" | null {
    const row = this.sdb.db.query("SELECT role FROM market_roles WHERE userId = $userId").get({ userId }) as
      | { role: "owner" | "publisher" }
      | null;
    return row?.role ?? null;
  }

  private serial(): number {
    const row = this.sdb.db.query("SELECT serial FROM market_state WHERE id = 1").get() as { serial: number } | null;
    return row?.serial ?? 0;
  }

  async publish(kpkg: Uint8Array, actor: { userId: string }, now: number): Promise<{ serial: number }> {
    if (this.role(actor.userId) === null) throw new KiboError("FORBIDDEN", "publishing needs the publisher or owner role");
    const pkg = decodeKpkg(kpkg);
    await verifyKpkgSignature(pkg);
    await kpkgSourceFiles(pkg);
    const { id, version } = pkg.manifest;
    const ref = `${id}@${version}`;
    if (this.sdb.db.query("SELECT 1 FROM market_revoked WHERE hash = $hash").get({ hash: pkg.hash })) {
      throw new KiboError("REVOKED", `${ref} has a revoked hash`);
    }
    if (this.sdb.db.query("SELECT 1 FROM market_packages WHERE id = $id AND version = $version").get({ id, version })) {
      throw new KiboError("VERSION_EXISTS", `${ref} is already published`);
    }
    const previous = this.sdb.db.query("SELECT DISTINCT publisherKey FROM market_packages WHERE id = $id").all({ id }) as {
      publisherKey: string;
    }[];
    if (previous.some((p) => p.publisherKey !== pkg.publisher.publicKey)) {
      throw new KiboError("PUBLISHER_CHANGED", `${id} is published by another key`);
    }
    const owner = this.sdb.db.query("SELECT userId FROM market_publishers WHERE publicKey = $k").get({ k: pkg.publisher.publicKey }) as
      | { userId: string }
      | null;
    if (owner && owner.userId !== actor.userId) throw new KiboError("FORBIDDEN", "this publisher key belongs to another user");
    this.sdb.db.transaction(() => {
      this.sdb.db
        .query(
          "INSERT INTO market_publishers (publicKey, userId, name) VALUES ($k, $u, $n) ON CONFLICT(publicKey) DO UPDATE SET name = excluded.name",
        )
        .run({ k: pkg.publisher.publicKey, u: actor.userId, n: pkg.publisher.name });
      this.sdb.db
        .query(
          "INSERT INTO market_packages (id, version, hash, publisherKey, userId, manifestJson, bytes, size, publishedAt) " +
            "VALUES ($id, $version, $hash, $publisherKey, $userId, $manifestJson, $bytes, $size, $publishedAt)",
        )
        .run({
          id,
          version,
          hash: pkg.hash,
          publisherKey: pkg.publisher.publicKey,
          userId: actor.userId,
          manifestJson: JSON.stringify(pkg.manifest),
          bytes: kpkg,
          size: kpkg.byteLength,
          publishedAt: pkg.publishedAt,
        });
    })();
    const serial = await this.rebuild(this.serial(), now);
    audit(this.sdb, { at: now, kind: "market-published", userId: actor.userId, detail: `${ref} ${pkg.hash}` });
    return { serial };
  }

  async revoke(input: { hash: string; reason: string }, actor: { userId: string }, now: number): Promise<{ serial: number }> {
    const row = this.sdb.db.query("SELECT userId FROM market_packages WHERE hash = $hash LIMIT 1").get({ hash: input.hash }) as
      | { userId: string }
      | null;
    if (!row) throw new KiboError("NOT_FOUND", `no package with hash ${input.hash}`);
    if (this.role(actor.userId) !== "owner" && row.userId !== actor.userId) {
      throw new KiboError("FORBIDDEN", "only the source owner or the publisher can revoke");
    }
    if (this.sdb.db.query("SELECT 1 FROM market_revoked WHERE hash = $hash").get({ hash: input.hash })) {
      throw new KiboError("INVALID_INPUT", "already revoked");
    }
    this.sdb.db
      .query("INSERT INTO market_revoked (hash, reason, at, by) VALUES ($hash, $reason, $at, $by)")
      .run({ hash: input.hash, reason: input.reason, at: now, by: actor.userId });
    const serial = await this.rebuild(this.serial(), now);
    audit(this.sdb, { at: now, kind: "market-revoked", userId: actor.userId, detail: `${input.hash} ${input.reason}` });
    return { serial };
  }

  index(): { bytes: Uint8Array; sig: string } {
    const row = this.sdb.db.query("SELECT indexJson, sig FROM market_state WHERE id = 1").get() as {
      indexJson: string;
      sig: string;
    } | null;
    if (!row) throw new KiboError("STORE_CORRUPT", "market index is missing");
    return { bytes: new TextEncoder().encode(row.indexJson), sig: row.sig };
  }

  packageBytes(id: string, version: string): Uint8Array | null {
    const row = this.sdb.db.query("SELECT bytes FROM market_packages WHERE id = $id AND version = $version").get({ id, version }) as
      | { bytes: Uint8Array }
      | null;
    return row ? new Uint8Array(row.bytes) : null;
  }

  private async rebuild(previousSerial: number, now: number): Promise<number> {
    const rows = this.sdb.db
      .query("SELECT id, version, hash, publisherKey, userId, manifestJson, size, publishedAt FROM market_packages")
      .all() as PackageRow[];
    const byId = new Map<string, PackageRow[]>();
    for (const r of rows) byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
    const publishers = this.sdb.db.query("SELECT publicKey, name FROM market_publishers ORDER BY publicKey").all() as {
      publicKey: string;
      name: string;
    }[];
    const revoked = this.sdb.db.query("SELECT hash, reason FROM market_revoked ORDER BY at, hash").all() as {
      hash: string;
      reason: string;
    }[];
    const serial = previousSerial + 1;
    const index: MarketIndex = {
      format: 1,
      source: this.source(),
      serial,
      generatedAt: new Date(now).toISOString(),
      publishers: publishers.map((p) => ({ ...p, verified: true })),
      packages: [...byId.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([id, versions]) => {
          const sorted = [...versions].sort((a, b) => compareSemver(a.version, b.version));
          const manifests = sorted.map((v) => ComponentManifest.parse(JSON.parse(v.manifestJson)));
          const latest = manifests[manifests.length - 1];
          if (!latest) throw new KiboError("STORE_CORRUPT", `market package ${id} has no version`);
          return {
            id,
            title: latest.title,
            description: latest.description,
            kind: latest.kind,
            versions: sorted.map((v, i) => {
              const m = manifests[i] ?? latest;
              return {
                version: v.version,
                hash: v.hash,
                publisherKey: v.publisherKey,
                size: v.size,
                permissions: { reads: m.reads, writes: m.writes, data: m.data, net: m.net },
                publishedAt: v.publishedAt,
                url: `packages/${id}/${v.version}.kpkg`,
              };
            }),
          };
        }),
      revoked,
    };
    const { bytes, sig } = await signIndex(index, this.keys.privateKey);
    this.sdb.db
      .query(
        "INSERT INTO market_state (id, serial, indexJson, sig) VALUES (1, $serial, $indexJson, $sig) " +
          "ON CONFLICT(id) DO UPDATE SET serial = excluded.serial, indexJson = excluded.indexJson, sig = excluded.sig",
      )
      .run({ serial, indexJson: new TextDecoder().decode(bytes), sig });
    return serial;
  }
}
```

Si `GrantedPermissions` comporte d'autres champs à v0.6 (phase 5 : `secrets`, `mcp`), les recopier ici du manifeste, comme dans `makeTestIndex` (T10).

- [ ] **Step 4: Vérifier le succès**

Run: `bun test packages/sync-server/src/market/team-market.test.ts`
Expected: PASS.

- [ ] **Step 5: Écrire les tests des requêtes signées et des routes**

`packages/sync-server/src/market/routes.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, type KeyPair, signRequest } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createInvite, redeemDeviceInvite, revokeDevice } from "../accounts";
import { openServerDb, type ServerDb } from "../db";
import { handleMarketRoute, type MarketRouteDeps } from "./routes";
import { NonceCache } from "./signed-request";
import { initMarketSource, TeamMarket } from "./team-market";

const BASE = "https://sync.kibo.test";
let dir: string;
let sdb: ServerDb;
let deps: MarketRouteDeps;
let now = 1_800_000_000_000;
let device: { userId: string; deviceId: string; keys: KeyPair };

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-market-routes-"));
  sdb = openServerDb(join(dir, "sync.db"));
  await initMarketSource(dir, { id: "equipe", name: "Équipe" });
  const market = await TeamMarket.open(sdb, dir);
  if (!market) throw new Error("market source was not initialised");
  const invite = await createInvite(sdb, { kind: "account", name: "Léa", createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(sdb, { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" }, now);
  device = { userId: joined.userId, deviceId: joined.deviceId, keys };
  market.grant(joined.userId, "publisher");
  deps = { sdb, market, nonces: new NonceCache({ ttlMs: 600_000, now: () => now }), now: () => now };
});
afterEach(() => {
  sdb.close();
  rmSync(dir, { recursive: true, force: true });
});

async function signed(path: string, body: Uint8Array, at = now, headers: Record<string, string> = {}) {
  const auth = await signRequest({ deviceId: device.deviceId, privateKey: device.keys.privateKey, method: "POST", path, body, now: at });
  return new Request(`${BASE}${path}`, { method: "POST", headers: { ...auth, ...headers }, body });
}
const route = (req: Request) => handleMarketRoute(req, new URL(req.url), deps);
const codeOf = async (res: Response | null) => ((await res?.json()) as { error?: { code: string } }).error?.code;

describe("routes", () => {
  test("unrelated paths are not handled", async () => {
    expect(await route(new Request(`${BASE}/v1/sync`))).toBeNull();
  });
  test("a signed publication is accepted and served back byte for byte", async () => {
    const { bytes, pkg } = await makeTestPackage();
    const res = await route(await signed("/v1/market/packages", bytes));
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 2 } });
    const index = await route(new Request(`${BASE}/market/index.json`));
    const { bytes: expected, sig } = deps.market.index();
    expect(new Uint8Array(await (index as Response).arrayBuffer())).toEqual(expected);
    expect(await (await route(new Request(`${BASE}/market/index.json.sig`)))?.text()).toBe(sig);
    const file = await route(new Request(`${BASE}/market/packages/burndown/0.3.0.kpkg`));
    expect(new Uint8Array(await (file as Response).arrayBuffer())).toEqual(bytes);
    expect(pkg.manifest.id).toBe("burndown");
  });
  test("a missing package is 404", async () => {
    expect((await route(new Request(`${BASE}/market/packages/nope/1.0.0.kpkg`)))?.status).toBe(404);
  });
  test("an unsigned publication is 401", async () => {
    const { bytes } = await makeTestPackage();
    const res = await route(new Request(`${BASE}/v1/market/packages`, { method: "POST", body: bytes }));
    expect(res?.status).toBe(401);
  });
  test("a replayed nonce is 401", async () => {
    const { bytes } = await makeTestPackage();
    const first = await signed("/v1/market/packages", bytes);
    const replay = first.clone();
    expect((await route(first))?.status).toBe(200);
    const res = await route(replay);
    expect(res?.status).toBe(401);
    expect(await codeOf(res)).toBe("UNAUTHORIZED");
  });
  test("a date skewed by more than 5 minutes is 401", async () => {
    const { bytes } = await makeTestPackage();
    expect((await route(await signed("/v1/market/packages", bytes, now - 300_001)))?.status).toBe(401);
  });
  test("a signature over another body is 401", async () => {
    const { bytes } = await makeTestPackage();
    const auth = await signRequest({
      deviceId: device.deviceId,
      privateKey: device.keys.privateKey,
      method: "POST",
      path: "/v1/market/packages",
      body: new Uint8Array([1, 2, 3]),
      now,
    });
    const forged = new Request(`${BASE}/v1/market/packages`, { method: "POST", headers: auth, body: bytes });
    expect((await route(forged))?.status).toBe(401);
  });
  test("a revoked device is 401 DEVICE_REVOKED", async () => {
    revokeDevice(sdb, { deviceId: device.deviceId, by: "admin" }, now);
    const { bytes } = await makeTestPackage();
    const res = await route(await signed("/v1/market/packages", bytes));
    expect(res?.status).toBe(401);
    expect(await codeOf(res)).toBe("DEVICE_REVOKED");
  });
  test("the publisher revokes through the API", async () => {
    const { bytes, pkg } = await makeTestPackage();
    await route(await signed("/v1/market/packages", bytes));
    const body = new TextEncoder().encode(JSON.stringify({ hash: pkg.hash, reason: "faille" }));
    const res = await route(await signed("/v1/market/revoke", body, now, { "content-type": "application/json" }));
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 3 } });
  });
  test("the same version twice is 409", async () => {
    const first = await makeTestPackage();
    await route(await signed("/v1/market/packages", first.bytes));
    now += 1;
    const again = await makeTestPackage({ keys: first.keys, files: { "extra.ts": "export const y = 2;\n" } });
    const res = await route(await signed("/v1/market/packages", again.bytes));
    expect(res?.status).toBe(409);
    expect(await codeOf(res)).toBe("VERSION_EXISTS");
  });
});
```

- [ ] **Step 6: Vérifier l'échec**

Run: `bun test packages/sync-server/src/market/routes.test.ts`
Expected: FAIL — `Cannot find module './routes'`.

- [ ] **Step 7: Implémenter les requêtes signées et les routes**

`packages/sync-server/src/market/signed-request.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { HTTP_SIGNATURE_HEADERS, httpSigningPayload, sha256Hex, verifyBytes } from "@kibo/trust";
import { deviceRecord } from "../accounts";
import type { ServerDb } from "../db";

export const SIGNED_REQUEST_SKEW_MS = 300_000;
export const NONCE_TTL_MS = 600_000;

export class NonceCache {
  private readonly seenUntil = new Map<string, number>();

  constructor(private readonly opts: { ttlMs: number; now: () => number }) {}

  seen(nonce: string): boolean {
    const now = this.opts.now();
    for (const [n, until] of this.seenUntil) if (until <= now) this.seenUntil.delete(n);
    if (this.seenUntil.has(nonce)) return true;
    this.seenUntil.set(nonce, now + this.opts.ttlMs);
    return false;
  }
}

export async function verifySignedRequest(
  sdb: ServerDb,
  req: Request,
  body: Uint8Array,
  nonces: NonceCache,
  now: number,
): Promise<{ userId: string; deviceId: string }> {
  const h = HTTP_SIGNATURE_HEADERS;
  const deviceId = req.headers.get(h.device);
  const date = req.headers.get(h.date);
  const nonce = req.headers.get(h.nonce);
  const signature = req.headers.get(h.signature);
  if (!deviceId || !date || !nonce || !signature) throw new KiboError("UNAUTHORIZED", "request is not signed");
  const at = Number(date);
  if (!Number.isFinite(at) || Math.abs(now - at) > SIGNED_REQUEST_SKEW_MS) {
    throw new KiboError("UNAUTHORIZED", "request date is too far from the server clock");
  }
  const device = deviceRecord(sdb, deviceId);
  if (!device) throw new KiboError("UNAUTHORIZED", "unknown device");
  const payload = httpSigningPayload({
    method: req.method,
    path: new URL(req.url).pathname,
    date,
    nonce,
    bodySha256: await sha256Hex(body),
  });
  if (!(await verifyBytes(device.publicKey, payload, signature))) throw new KiboError("UNAUTHORIZED", "invalid request signature");
  if (device.revoked || device.userDisabled) throw new KiboError("DEVICE_REVOKED", "device or user has been revoked");
  if (nonces.seen(nonce)) throw new KiboError("UNAUTHORIZED", "request nonce was already used");
  return { userId: device.userId, deviceId };
}
```

`packages/sync-server/src/market/routes.ts` :
```ts
import { KiboError, type KiboErrorCode, KPKG_MAX_BYTES, Sha256 } from "@kibo/schema";
import { z } from "zod";
import type { ServerDb } from "../db";
import { type NonceCache, verifySignedRequest } from "./signed-request";
import type { TeamMarket } from "./team-market";

export type MarketRouteDeps = { sdb: ServerDb; market: TeamMarket; nonces: NonceCache; now: () => number };

const STATUS: Partial<Record<KiboErrorCode, number>> = {
  UNAUTHORIZED: 401,
  DEVICE_REVOKED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_EXISTS: 409,
  PUBLISHER_CHANGED: 409,
  REVOKED: 410,
  SIGNATURE_INVALID: 422,
  HASH_MISMATCH: 422,
  INVALID_INPUT: 400,
};
const PACKAGE_PATH = /^\/market\/packages\/([a-z0-9][a-z0-9-]{0,63})\/(\d+\.\d+\.\d+)\.kpkg$/;
const RevokeBody = z.object({ hash: Sha256, reason: z.string().trim().min(1).max(500) });
const MAX_POST_BYTES = KPKG_MAX_BYTES * 2;

const ok = (result: unknown) => Response.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
const fail = (code: KiboErrorCode, message: string, status: number) =>
  Response.json({ ok: false, error: { code, message } }, { status });
const bytes = (body: Uint8Array | string, type: string) =>
  new Response(body, { headers: { "content-type": type, "cache-control": "no-cache" } });

async function readBody(req: Request): Promise<Uint8Array | Response> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_POST_BYTES) return fail("INVALID_INPUT", "body too large", 413);
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > MAX_POST_BYTES) return fail("INVALID_INPUT", "body too large", 413);
  return body;
}

export async function handleMarketRoute(req: Request, url: URL, deps: MarketRouteDeps): Promise<Response | null> {
  const { market } = deps;
  try {
    if (req.method === "GET" && url.pathname === "/market/index.json") return bytes(market.index().bytes, "application/json");
    if (req.method === "GET" && url.pathname === "/market/index.json.sig") return bytes(market.index().sig, "text/plain");
    const pkg = req.method === "GET" ? PACKAGE_PATH.exec(url.pathname) : null;
    if (pkg) {
      const found = market.packageBytes(pkg[1] ?? "", pkg[2] ?? "");
      return found ? bytes(found, "application/json") : fail("NOT_FOUND", "package not found", 404);
    }
    if (req.method === "POST" && url.pathname === "/v1/market/packages") {
      const body = await readBody(req);
      if (body instanceof Response) return body;
      const actor = await verifySignedRequest(deps.sdb, req, body, deps.nonces, deps.now());
      return ok(await market.publish(body, actor, deps.now()));
    }
    if (req.method === "POST" && url.pathname === "/v1/market/revoke") {
      const body = await readBody(req);
      if (body instanceof Response) return body;
      const actor = await verifySignedRequest(deps.sdb, req, body, deps.nonces, deps.now());
      let json: unknown;
      try {
        json = JSON.parse(new TextDecoder().decode(body));
      } catch (e) {
        throw new KiboError("INVALID_INPUT", `revoke body is not JSON: ${String(e)}`);
      }
      const input = RevokeBody.safeParse(json);
      if (!input.success) throw new KiboError("INVALID_INPUT", input.error.message);
      return ok(await market.revoke(input.data, actor, deps.now()));
    }
    return null;
  } catch (e) {
    if (e instanceof KiboError) return fail(e.code, e.detail, STATUS[e.code] ?? 400);
    console.error("[kibo-sync] market route failed", url.pathname, e);
    return fail("INTERNAL", "internal error", 500);
  }
}
```

`packages/sync-server/src/index.ts` : ajouter
```ts
export * from "./market/routes";
export * from "./market/signed-request";
export * from "./market/team-market";
```

- [ ] **Step 8: Vérifier le succès, lint et types**

Run: `bun test packages/sync-server && bun run check && bun run typecheck`
Expected: PASS, Biome et `tsc` sans erreur.

- [ ] **Step 9: Commit**

```bash
git add packages/sync-server/src/market packages/sync-server/src/index.ts
git commit -m "feat(sync-server): marketplace d'équipe"
```

---

### Task 17: Serveur de sync : protocole WebSocket et binaire

Le cœur réseau de `kibo-sync` (spec G §4, §6, §8 ; décisions 3, 4, 10, 21) : un `SyncHub` indépendant du transport qui authentifie chaque connexion par défi signé, applique les rôles à chaque trame, relaie mises à jour et présence, gère partage, invitations, membres et appareils ; un `startSyncServer` qui l'expose en WebSocket sur TLS (ou derrière un proxy TLS sur loopback) avec `POST /v1/join` et les routes marketplace de T16 ; la CLI d'administration et le binaire compilé `kibo-sync` ; un serveur de test TLS en processus réutilisé par les tâches 18 à 24 et 31.

Tâche à risque : relue aussi par `kibo-lead`.

**Files:**
- Create: `packages/sync-server/src/hub.ts`, `packages/sync-server/src/server.ts`, `packages/sync-server/src/cli.ts`, `packages/sync-server/scripts/build.ts`, `packages/sync-server/src/testing/start-test-server.ts`, `packages/sync-server/src/testing/ws-client.ts`
- Modify: `packages/sync-server/package.json` (`bin`, script `build`, exports `./testing`, `./testing/ws-client`), `packages/sync-server/src/index.ts`, `.github/workflows/ci.yml` (build et fumée du binaire)
- Test: `packages/sync-server/src/hub.test.ts`, `packages/sync-server/src/server.test.ts`, `packages/sync-server/src/cli.test.ts`

**Interfaces:**
- Consumes :
  - (T4) `ClientFrame`, `ServerFrame`, `CLOSE_CODES`, `SYNC_LIMITS`, `MAX_FRAME_BYTES`, `JoinRequest`, `PresenceState`, `challengePayload`. Formes utilisées : `subscribe { projectId, version }`, `unsubscribe { projectId }`, `push { projectId, bytes, clientBatchId }`, `presence { projectId, bytes }`, `share { projectId, requestId, name, snapshot }`, `invite { projectId, requestId, role }`, `redeem { requestId, code }`, `set-role { projectId, requestId, userId, role }`, `unshare { projectId, requestId }`, `device-invite { requestId }`, `list-devices { requestId }`, `revoke-device { requestId, deviceId }` ; côté serveur `challenge { nonce }`, `welcome { userId, name, deviceId, projects }`, `update { projectId, bytes, serverSeq, version }`, `ack { projectId, clientBatchId, serverSeq, version }`, `reject { projectId, clientBatchId, code, message, version }`, `presence`, `members { projectId, members }`, `invite-code { requestId, code, expiresAt }`, `shared { requestId, projectId }`, `joined { requestId, projectId, name, role }`, `revoked { projectId, reason }`, `devices { requestId, devices }`, `done { requestId }`, `error { requestId, code, message }`.
  - (T11) `openServerDb`, `createInvite`, `redeemDeviceInvite`, `redeemProjectInvite`, `deviceRecord`, `listDevices`, `revokeDevice`, `disableUser`, `roleOf`, `listMembers`, `setRole`, `projectsOf`, `audit`, `readAudit`, `newNonce`, `verifyChallenge`, `FailureLimiter`, `RateWindow`.
  - (T14) `ProjectRoom` (`diffSince`, `version`, `serverSeq`, `push`, `syncMembers`, `presence`), `RoomReject`, `RoomRegistry` (`get` lève `NOT_FOUND` pour un projet inconnu, `create` insère `projects` et le membre `owner` via `insertProject`, `attach`, `detach`, `drop`, `sweep`).
  - (T16) `TeamMarket.open`, `initMarketSource`, `NonceCache`, `NONCE_TTL_MS`, `handleMarketRoute`.
  - (T3) `generateSelfSignedCert` ; (T2) `toBase64`, `fromBase64`, `signBytes`, `generateKeyPair`, `formatFingerprint`.
  - (T6, T7) `createProjectDoc`, `createTicket`, `listTickets` (tests).
- Produces : `HubConnection`, `SyncHub`, `SyncServerOptions`, `startSyncServer`, `startTestSyncServer` (Contrats) et **nouveau** :
  - `SyncHub.failures: FailureLimiter` (lu par le serveur HTTP avant l'upgrade et `POST /v1/join`) et `SyncHub.checkRevocations(): void` (ferme en 4403 les connexions d'un appareil révoqué ou d'un utilisateur désactivé ; appelé toutes les 5 s, pour qu'une révocation par la CLI coupe les sockets).
  - `SyncServerOptions.origin` : chaîne vide ⇒ origine dérivée `wss://<hostname>:<port>` (tests) ; en production l'administrateur passe `--origin`.
  - `POST /v1/join` répond `{ ok: true, result: JoinResponse }` ou `{ ok: false, error: { code, message } }` (403 pour `INVITE_INVALID`, 429 si l'IP est bloquée).
  - `type TestSyncServer = Awaited<ReturnType<typeof startTestSyncServer>>` ; `startTestSyncServer` renvoie `url` = `wss://127.0.0.1:<port>` (base, sans chemin), `httpsUrl` = `https://127.0.0.1:<port>` (**ajouté**).
  - `@kibo/sync-server/testing/ws-client` : `type TestDevice = { userId: string; deviceId: string; name: string; keys: KeyPair }`, `joinTestAccount(t: TestSyncServer, name: string): Promise<TestDevice>`, `addTestDevice(t: TestSyncServer, user: TestDevice, deviceName: string): Promise<TestDevice>`, `class TestClient { static open(t: TestSyncServer): Promise<TestClient>; auth(device: TestDevice, override?: { privateKey?: string; origin?: string }): Promise<void>; send(frame: ClientFrame): void; sendRaw(text: string): void; next<T extends ServerFrame["type"]>(type: T, match?: (f: Extract<ServerFrame, { type: T }>) => boolean, timeoutMs?: number): Promise<Extract<ServerFrame, { type: T }>>; received(type: ServerFrame["type"]): ServerFrame[]; readonly closed: Promise<number>; close(): void }`.
  - `runCli(argv: string[], io: { out(line: string): void; err(line: string): void; now(): number }): Promise<number>`.

Règles du hub, dans l'ordre pour chaque trame :
1. Trame non JSON ou refusée par Zod ⇒ `error { requestId: null, code: "INVALID_INPUT" }`, la connexion reste ouverte.
2. Avant `auth`, toute autre trame ferme en 4401.
3. Après `auth`, chaque trame revérifie l'appareil (`deviceRecord`) : révoqué ou utilisateur désactivé ⇒ fermeture 4403.
4. Le rôle est relu en base à chaque `push` (un changement de rôle s'applique sans reconnexion).
5. Les trames d'une connexion sont traitées dans l'ordre (file de promesses par connexion).
6. Une `KiboError` devient `error { requestId, code, message }` ; toute autre erreur est journalisée avec le type de trame puis renvoyée en `INTERNAL`.

- [ ] **Step 1: Écrire le client de test et le serveur de test**

`packages/sync-server/src/testing/start-test-server.ts` :
```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSelfSignedCert, type SelfSigned } from "@kibo/trust";
import { createInvite } from "../accounts";
import { initMarketSource } from "../market/team-market";
import { startSyncServer } from "../server";

export type TestSyncServerOptions = {
  now?: () => number;
  dataDir?: string;
  port?: number;
  cert?: SelfSigned;
  market?: { id: string; name: string };
};

export async function startTestSyncServer(opts: TestSyncServerOptions = {}) {
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), "kibo-sync-test-"));
  const cert =
    opts.cert ??
    (await generateSelfSignedCert({ commonName: "kibo-sync-test", dns: ["localhost"], ips: ["127.0.0.1"], days: 2 }));
  const now = opts.now ?? Date.now;
  if (opts.market) await initMarketSource(dataDir, opts.market);
  const server = await startSyncServer({
    dataDir,
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    origin: "",
    tls: { cert: cert.certPem, key: cert.keyPem },
    behindProxy: false,
    now,
  });
  const base = `127.0.0.1:${server.port}`;
  return {
    url: `wss://${base}`,
    httpsUrl: `https://${base}`,
    origin: `wss://${base}`,
    caPem: cert.certPem,
    cert,
    dataDir,
    server,
    inviteAccount: async (name: string) => (await createInvite(server.sdb, { kind: "account", name, createdBy: "admin" }, now())).code,
    stop: async (stopOpts: { keepData?: boolean } = {}) => {
      await server.stop();
      if (!stopOpts.keepData) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export type TestSyncServer = Awaited<ReturnType<typeof startTestSyncServer>>;
```

`packages/sync-server/src/testing/ws-client.ts` :
```ts
import { challengePayload, type ClientFrame, JoinResponse, ServerFrame } from "@kibo/schema";
import { generateKeyPair, type KeyPair, signBytes } from "@kibo/trust";
import { createInvite } from "../accounts";
import type { TestSyncServer } from "./start-test-server";

export type TestDevice = { userId: string; deviceId: string; name: string; keys: KeyPair };

async function join(t: TestSyncServer, code: string, deviceName: string): Promise<TestDevice> {
  const keys = await generateKeyPair();
  const res = await fetch(`${t.httpsUrl}/v1/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, publicKey: keys.publicKey, deviceName }),
    tls: { ca: t.caPem },
  });
  const body = (await res.json()) as { ok: boolean; result?: unknown; error?: { code: string } };
  if (!body.ok) throw new Error(`join failed: ${body.error?.code ?? res.status}`);
  return { ...JoinResponse.parse(body.result), keys };
}

export async function joinTestAccount(t: TestSyncServer, name: string): Promise<TestDevice> {
  return join(t, await t.inviteAccount(name), `Mac de ${name}`);
}

export async function addTestDevice(t: TestSyncServer, user: TestDevice, deviceName: string): Promise<TestDevice> {
  const invite = await createInvite(t.server.sdb, { kind: "device", userId: user.userId, createdBy: user.userId }, Date.now());
  return join(t, invite.code, deviceName);
}

type Waiter = { type: ServerFrame["type"]; match: (f: ServerFrame) => boolean; resolve: (f: ServerFrame) => void };

export class TestClient {
  private readonly frames: ServerFrame[] = [];
  private readonly consumed = new Set<ServerFrame>();
  private readonly waiters: Waiter[] = [];
  readonly closed: Promise<number>;

  private constructor(
    private readonly ws: WebSocket,
    private readonly t: TestSyncServer,
  ) {
    this.closed = new Promise((resolve) => ws.addEventListener("close", (e) => resolve(e.code)));
    ws.addEventListener("message", (e) => {
      const frame = ServerFrame.parse(JSON.parse(String(e.data)));
      const waiter = this.waiters.find((w) => w.type === frame.type && w.match(frame));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        this.consumed.add(frame);
        this.frames.push(frame);
        waiter.resolve(frame);
        return;
      }
      this.frames.push(frame);
    });
  }

  static async open(t: TestSyncServer): Promise<TestClient> {
    const ws = new WebSocket(`${t.url}/v1/sync`, { tls: { ca: t.caPem } });
    const client = new TestClient(ws, t);
    await client.next("challenge");
    return client;
  }

  async auth(device: TestDevice, override: { privateKey?: string; origin?: string } = {}): Promise<void> {
    const challenge = this.frames.find((f) => f.type === "challenge");
    if (!challenge || challenge.type !== "challenge") throw new Error("no challenge received");
    const payload = challengePayload(challenge.nonce, override.origin ?? this.t.origin);
    const signature = await signBytes(override.privateKey ?? device.keys.privateKey, payload);
    this.send({ type: "auth", deviceId: device.deviceId, signature });
  }

  send(frame: ClientFrame): void {
    this.ws.send(JSON.stringify(frame));
  }

  sendRaw(text: string): void {
    this.ws.send(text);
  }

  received(type: ServerFrame["type"]): ServerFrame[] {
    return this.frames.filter((f) => f.type === type);
  }

  next<T extends ServerFrame["type"]>(
    type: T,
    match: (f: Extract<ServerFrame, { type: T }>) => boolean = () => true,
    timeoutMs = 3000,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    const accepts = (f: ServerFrame): f is Extract<ServerFrame, { type: T }> =>
      f.type === type && match(f as Extract<ServerFrame, { type: T }>);
    const ready = this.frames.find((f) => !this.consumed.has(f) && accepts(f));
    if (ready && accepts(ready)) {
      this.consumed.add(ready);
      return Promise.resolve(ready);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        type,
        match: (f) => accepts(f),
        resolve: (f) => {
          clearTimeout(timer);
          if (accepts(f)) resolve(f);
        },
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}
```

Le cast `as Extract<…>` dans `accepts` est la seule façon d'appeler le prédicat générique avant le raffinement ; il est borné par le test `f.type === type` qui le précède.

- [ ] **Step 2: Écrire les tests du protocole**

`packages/sync-server/src/hub.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createProjectDoc, createTicket, listTickets } from "@kibo/core";
import { CLOSE_CODES, SYNC_LIMITS } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { EphemeralStore, LoroDoc, VersionVector } from "loro-crdt";
import { startTestSyncServer, type TestSyncServer } from "./testing/start-test-server";
import { addTestDevice, joinTestAccount, TestClient, type TestDevice } from "./testing/ws-client";

let t: TestSyncServer;
let clock = 1_800_000_000_000;
const clients: TestClient[] = [];

beforeEach(async () => {
  t = await startTestSyncServer({ now: () => clock });
});
afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await t.stop();
});

async function connect(device: TestDevice): Promise<TestClient> {
  const c = await TestClient.open(t);
  clients.push(c);
  await c.auth(device);
  await c.next("welcome");
  return c;
}

const META = { id: "p-kibo", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

async function sharedProject() {
  const adam = await joinTestAccount(t, "Adam");
  const owner = await connect(adam);
  const doc = createProjectDoc(META);
  createTicket(doc, { title: "Noyau de données" });
  owner.send({ type: "share", projectId: META.id, requestId: "s1", name: "Kibo", snapshot: toBase64(doc.export({ mode: "snapshot" })) });
  await owner.next("shared");
  owner.send({ type: "subscribe", projectId: META.id, version: null });
  const first = await owner.next("update");
  const ownerDoc = new LoroDoc();
  ownerDoc.import(fromBase64(first.bytes));
  return { adam, owner, ownerDoc };
}

async function member(owner: TestClient, name: string, role: "editor" | "viewer") {
  owner.send({ type: "invite", projectId: META.id, requestId: `i-${name}`, role });
  const invite = await owner.next("invite-code", (f) => f.requestId === `i-${name}`);
  const device = await joinTestAccount(t, name);
  const client = await connect(device);
  client.send({ type: "redeem", requestId: "r1", code: invite.code });
  await client.next("joined");
  client.send({ type: "subscribe", projectId: META.id, version: null });
  const update = await client.next("update");
  const doc = new LoroDoc();
  doc.import(fromBase64(update.bytes));
  return { device, client, doc, version: update.version };
}

const pushFrom = (doc: LoroDoc, version: string, id: string) => ({
  type: "push" as const,
  projectId: META.id,
  clientBatchId: id,
  bytes: toBase64(doc.export({ mode: "update", from: VersionVector.decode(fromBase64(version)) })),
});

describe("authentication", () => {
  test("a device receives a challenge then a welcome listing its projects", async () => {
    const { adam } = await sharedProject();
    const again = await connect(adam);
    expect(again.received("welcome")[0]).toMatchObject({ userId: adam.userId, name: "Adam", deviceId: adam.deviceId, projects: [{ id: META.id, name: "Kibo", role: "owner" }] });
  });
  test("a bad signature closes with 4401", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const other = await joinTestAccount(t, "Mallory");
    const c = await TestClient.open(t);
    clients.push(c);
    await c.auth(adam, { privateKey: other.keys.privateKey });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("a signature for another origin closes with 4401", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const c = await TestClient.open(t);
    clients.push(c);
    await c.auth(adam, { origin: "wss://evil.test" });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("five failures from an IP make the next upgrade answer 429", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const other = await joinTestAccount(t, "Mallory");
    for (let i = 0; i < SYNC_LIMITS.authFailuresPerMinute; i++) {
      const c = await TestClient.open(t);
      await c.auth(adam, { privateKey: other.keys.privateKey });
      await c.closed;
    }
    const res = await fetch(`${t.httpsUrl}/v1/sync`, { tls: { ca: t.caPem } });
    expect(res.status).toBe(429);
    clock += SYNC_LIMITS.authBlockMs + 1;
    const ok = await TestClient.open(t);
    clients.push(ok);
    await ok.auth(adam);
    await ok.next("welcome");
  });
  test("a frame before auth closes with 4401", async () => {
    const c = await TestClient.open(t);
    clients.push(c);
    c.send({ type: "list-devices", requestId: "x" });
    expect(await c.closed).toBe(CLOSE_CODES.authFailed);
  });
  test("a device revoked from another device is closed with 4403", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const imac = await addTestDevice(t, adam, "iMac");
    const first = await connect(adam);
    const second = await connect(imac);
    second.send({ type: "revoke-device", requestId: "rv", deviceId: adam.deviceId });
    await second.next("done");
    expect(await first.closed).toBe(CLOSE_CODES.deviceRevoked);
    second.send({ type: "list-devices", requestId: "ld" });
    const list = await second.next("devices");
    expect(list.devices.find((d) => d.deviceId === adam.deviceId)?.revokedAt).toBe(clock);
  });
  test("a user cannot revoke someone else's device", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const lea = await joinTestAccount(t, "Léa");
    const c = await connect(lea);
    c.send({ type: "revoke-device", requestId: "rv", deviceId: adam.deviceId });
    expect((await c.next("error")).code).toBe("FORBIDDEN");
  });
  test("the 21st connection of a user is closed with 4429", async () => {
    const adam = await joinTestAccount(t, "Adam");
    for (let i = 0; i < SYNC_LIMITS.connectionsPerUser; i++) await connect(adam);
    const extra = await TestClient.open(t);
    clients.push(extra);
    await extra.auth(adam);
    expect(await extra.closed).toBe(CLOSE_CODES.tooManyConnections);
  });
  test("an invalid frame gets an error and keeps the connection", async () => {
    const adam = await joinTestAccount(t, "Adam");
    const c = await connect(adam);
    c.sendRaw("{not json");
    expect((await c.next("error")).code).toBe("INVALID_INPUT");
    c.send({ type: "list-devices", requestId: "ok" });
    await c.next("devices");
  });
});

describe("projects", () => {
  test("replaying a share by the same owner answers shared again", async () => {
    const { owner } = await sharedProject();
    owner.send({ type: "share", projectId: META.id, requestId: "s2", name: "Kibo", snapshot: toBase64(new Uint8Array()) });
    expect((await owner.next("shared", (f) => f.requestId === "s2")).projectId).toBe(META.id);
  });
  test("sharing a project id owned by someone else is FORBIDDEN", async () => {
    await sharedProject();
    const lea = await connect(await joinTestAccount(t, "Léa"));
    lea.send({ type: "share", projectId: META.id, requestId: "s3", name: "Kibo", snapshot: toBase64(new Uint8Array()) });
    expect((await lea.next("error")).code).toBe("FORBIDDEN");
  });
  test("a non member cannot subscribe", async () => {
    await sharedProject();
    const lea = await connect(await joinTestAccount(t, "Léa"));
    lea.send({ type: "subscribe", projectId: META.id, version: null });
    expect((await lea.next("error")).code).toBe("FORBIDDEN");
  });
  test("an editor ticket reaches the owner with a server key", async () => {
    const { owner, ownerDoc } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    createTicket(lea.doc, { title: "Schéma Loro des tickets" });
    lea.client.send(pushFrom(lea.doc, lea.version, "b1"));
    const ack = await lea.client.next("ack", (f) => f.clientBatchId === "b1");
    expect(ack.serverSeq).toBeGreaterThan(0);
    const update = await owner.next("update", (f) => f.serverSeq === ack.serverSeq);
    ownerDoc.import(fromBase64(update.bytes));
    expect(listTickets(ownerDoc).map((x) => x.key)).toEqual(["KIB-1", "KIB-2"]);
  });
  test("a viewer push is rejected with FORBIDDEN", async () => {
    const { owner } = await sharedProject();
    const viewer = await member(owner, "Tom", "viewer");
    createTicket(viewer.doc, { title: "Interdit" });
    viewer.client.send(pushFrom(viewer.doc, viewer.version, "v1"));
    const reject = await viewer.client.next("reject");
    expect(reject.code).toBe("FORBIDDEN");
  });
  test("an editor writing a ticket key is rejected with UPDATE_REJECTED and audited", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    const node = lea.doc.getTree("tickets").roots()[0];
    if (!node) throw new Error("no ticket in the shared project");
    node.data.set("key", "KIB-99");
    lea.doc.commit();
    lea.client.send(pushFrom(lea.doc, lea.version, "k1"));
    expect((await lea.client.next("reject")).code).toBe("UPDATE_REJECTED");
    const rows = t.server.sdb.db.query("SELECT kind FROM audit WHERE kind = 'update-rejected'").all();
    expect(rows.length).toBeGreaterThan(0);
  });
  test("the 101st push in the same second is RATE_LIMITED", async () => {
    const { owner, ownerDoc } = await sharedProject();
    const version = toBase64(ownerDoc.oplogVersion().encode());
    for (let i = 0; i <= SYNC_LIMITS.updatesPerSecond; i++) owner.send(pushFrom(ownerDoc, version, `r${i}`));
    const reject = await owner.next("reject", (f) => f.clientBatchId === `r${SYNC_LIMITS.updatesPerSecond}`);
    expect(reject.code).toBe("RATE_LIMITED");
    expect(owner.received("ack")).toHaveLength(SYNC_LIMITS.updatesPerSecond);
  });
  test("removing a member sends revoked and stops its updates", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    owner.send({ type: "set-role", projectId: META.id, requestId: "rm", userId: lea.device.userId, role: null });
    await owner.next("done", (f) => f.requestId === "rm");
    expect((await lea.client.next("revoked")).reason).toBe("removed");
    createTicket(lea.doc, { title: "Après retrait" });
    lea.client.send(pushFrom(lea.doc, lea.version, "late"));
    expect((await lea.client.next("reject")).code).toBe("FORBIDDEN");
  });
  test("the last owner cannot be removed", async () => {
    const { owner, adam } = await sharedProject();
    owner.send({ type: "set-role", projectId: META.id, requestId: "self", userId: adam.userId, role: null });
    expect((await owner.next("error")).code).toBe("FORBIDDEN");
  });
  test("unshare notifies subscribers and deletes the project", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "viewer");
    owner.send({ type: "unshare", projectId: META.id, requestId: "u" });
    await owner.next("done");
    expect((await lea.client.next("revoked")).reason).toBe("deleted");
    expect(t.server.sdb.db.query("SELECT 1 FROM projects WHERE id = $id").get({ id: META.id })).toBeNull();
  });
});

describe("presence", () => {
  const state = (userId: string, name: string) => ({ userId, name, pageId: null, ticketId: null, runs: [] });
  const encode = (key: string, value: ReturnType<typeof state>) => {
    const store = new EphemeralStore(30_000);
    store.set(key, value);
    const bytes = store.encodeAll();
    store.destroy();
    return toBase64(bytes);
  };
  test("presence touching another device key is ignored, a valid one is relayed", async () => {
    const { owner, adam } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    lea.client.send({ type: "presence", projectId: META.id, bytes: encode(adam.deviceId, state(adam.userId, "Adam")) });
    lea.client.send({ type: "presence", projectId: META.id, bytes: encode(lea.device.deviceId, state(adam.userId, "Adam")) });
    lea.client.send({ type: "presence", projectId: META.id, bytes: encode(lea.device.deviceId, state(lea.device.userId, "Léa")) });
    const relayed = await owner.next("presence");
    const store = new EphemeralStore(30_000);
    store.apply(fromBase64(relayed.bytes));
    expect(store.keys()).toEqual([lea.device.deviceId]);
    store.destroy();
    await Bun.sleep(100);
    expect(owner.received("presence")).toHaveLength(1);
  });
  test("a new subscriber receives the current presence", async () => {
    const { owner } = await sharedProject();
    const lea = await member(owner, "Léa", "editor");
    lea.client.send({ type: "presence", projectId: META.id, bytes: encode(lea.device.deviceId, state(lea.device.userId, "Léa")) });
    await owner.next("presence");
    const tom = await member(owner, "Tom", "viewer");
    expect((await tom.client.next("presence")).projectId).toBe(META.id);
  });
});
```

`packages/sync-server/src/server.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair } from "@kibo/trust";
import { startSyncServer } from "./server";
import { startTestSyncServer, type TestSyncServer } from "./testing/start-test-server";

let t: TestSyncServer | null = null;
afterEach(async () => {
  await t?.stop();
  t = null;
});

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "no-code",
  );

test("refuses to listen on a non loopback address without TLS", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "kibo-sync-notls-"));
  expect(
    await outcome(startSyncServer({ dataDir, hostname: "192.0.2.10", port: 0, origin: "", tls: null, behindProxy: false })),
  ).toBe("TLS_REQUIRED");
  expect(
    await outcome(startSyncServer({ dataDir, hostname: "192.0.2.10", port: 0, origin: "", tls: null, behindProxy: true })),
  ).toBe("TLS_REQUIRED");
  rmSync(dataDir, { recursive: true, force: true });
});

test("joins with an invite code over HTTPS and refuses a reused code with 403", async () => {
  const s = await startTestSyncServer();
  t = s;
  const code = await s.inviteAccount("Adam");
  const post = async () => {
    const keys = await generateKeyPair();
    return fetch(`${s.httpsUrl}/v1/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, publicKey: keys.publicKey, deviceName: "Mac" }),
      tls: { ca: s.caPem },
    });
  };
  const first = await post();
  expect(first.status).toBe(200);
  expect(((await first.json()) as { result: { name: string } }).result.name).toBe("Adam");
  const second = await post();
  expect(second.status).toBe(403);
  expect(((await second.json()) as { error: { code: string } }).error.code).toBe("INVITE_INVALID");
});

test("rejects a plain HTTP client and unknown paths", async () => {
  const s = await startTestSyncServer();
  t = s;
  expect((await fetch(`${s.httpsUrl}/nope`, { tls: { ca: s.caPem } })).status).toBe(404);
  const plain = await fetch(`http://127.0.0.1:${s.server.port}/v1/join`).then(
    () => "answered",
    () => "refused",
  );
  expect(plain).toBe("refused");
});
```

`packages/sync-server/src/cli.test.ts` :
```ts
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair } from "@kibo/trust";
import { redeemDeviceInvite } from "./accounts";
import { runCli } from "./cli";
import { openServerDb } from "./db";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const io = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l), now: () => 1_800_000_000_000 } };
};

test("invite account prints a code that creates the account", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const run = io();
  expect(await runCli(["invite", "account", "--name", "Adam", "--data", dir], run.io)).toBe(0);
  const code = /[A-Z2-7]{26}/.exec(run.out.join("\n"))?.[0];
  if (!code) throw new Error(`no code in ${run.out.join("\n")}`);
  const sdb = openServerDb(join(dir, "sync.db"));
  const keys = await generateKeyPair();
  expect((await redeemDeviceInvite(sdb, { code, publicKey: keys.publicKey, deviceName: "Mac" }, 1_800_000_000_001)).name).toBe("Adam");
  sdb.close();
});

test("market init then grant, and audit lists events", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const init = io();
  expect(await runCli(["market", "init", "--id", "equipe", "--name", "Équipe", "--data", dir], init.io)).toBe(0);
  expect(init.out.join("\n")).toMatch(/([0-9a-f]{4} ){15}[0-9a-f]{4}/);
  const grant = io();
  expect(await runCli(["market", "grant", "inconnu", "publisher", "--data", dir], grant.io)).toBe(1);
  expect(grant.err.join("\n")).toContain("NOT_FOUND");
  const audit = io();
  expect(await runCli(["audit", "--data", dir], audit.io)).toBe(0);
});

test("an unknown command prints the usage and fails", async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-sync-cli-"));
  const run = io();
  expect(await runCli(["nope"], run.io)).toBe(1);
  expect(run.err.join("\n")).toContain("kibo-sync serve");
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `bun test packages/sync-server/src/hub.test.ts packages/sync-server/src/server.test.ts packages/sync-server/src/cli.test.ts`
Expected: FAIL — `Cannot find module '../server'` (depuis `testing/start-test-server.ts`).

- [ ] **Step 4: Implémenter le hub**

`packages/sync-server/src/hub.ts` :
```ts
import {
  ClientFrame,
  CLOSE_CODES,
  KiboError,
  PresenceState,
  type Role,
  type ServerFrame,
  SYNC_LIMITS,
} from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { EphemeralStore } from "loro-crdt";
import { createInvite, deviceRecord, listDevices, redeemProjectInvite, revokeDevice } from "./accounts";
import { audit } from "./audit";
import { newNonce, verifyChallenge } from "./auth";
import type { ServerDb } from "./db";
import { FailureLimiter, RateWindow } from "./limits";
import { listMembers, projectsOf, roleOf, setRole } from "./members";
import { RoomReject } from "./room";
import type { RoomRegistry } from "./rooms";

export type HubConnection = {
  id: string;
  ip: string;
  send(frame: ServerFrame): void;
  close(code: number, reason: string): void;
};

type Session = { userId: string; deviceId: string; name: string };
type ConnState = {
  conn: HubConnection;
  nonce: string;
  session: Session | null;
  projects: Set<string>;
  queue: Promise<void>;
};
type Authed = ConnState & { session: Session };

export class SyncHub {
  readonly failures: FailureLimiter;
  private readonly pushes: RateWindow;
  private readonly conns = new Map<string, ConnState>();

  constructor(private readonly opts: { sdb: ServerDb; rooms: RoomRegistry; origin: string; now: () => number }) {
    this.failures = new FailureLimiter({
      max: SYNC_LIMITS.authFailuresPerMinute,
      windowMs: 60_000,
      blockMs: SYNC_LIMITS.authBlockMs,
      now: opts.now,
    });
    this.pushes = new RateWindow({ limit: SYNC_LIMITS.updatesPerSecond, windowMs: 1000, now: opts.now });
  }

  open(conn: HubConnection): void {
    const state: ConnState = { conn, nonce: newNonce(), session: null, projects: new Set(), queue: Promise.resolve() };
    this.conns.set(conn.id, state);
    conn.send({ type: "challenge", nonce: state.nonce });
  }

  message(conn: HubConnection, raw: string): Promise<void> {
    const state = this.conns.get(conn.id);
    if (!state) return Promise.resolve();
    state.queue = state.queue.then(() => this.handle(state, raw));
    return state.queue;
  }

  closed(conn: HubConnection): void {
    const state = this.conns.get(conn.id);
    if (!state) return;
    for (const projectId of state.projects) this.opts.rooms.detach(projectId, conn.id);
    this.conns.delete(conn.id);
  }

  kickDevice(deviceId: string, code: number): void {
    for (const s of this.conns.values()) if (s.session?.deviceId === deviceId) s.conn.close(code, "device revoked");
  }

  checkRevocations(): void {
    for (const s of this.conns.values()) {
      if (!s.session) continue;
      const device = deviceRecord(this.opts.sdb, s.session.deviceId);
      if (!device || device.revoked || device.userDisabled) s.conn.close(CLOSE_CODES.deviceRevoked, "device revoked");
    }
  }

  private async handle(state: ConnState, raw: string): Promise<void> {
    let frame: ClientFrame;
    try {
      frame = ClientFrame.parse(JSON.parse(raw));
    } catch (e) {
      this.error(state, null, "INVALID_INPUT", `invalid frame: ${String(e)}`);
      return;
    }
    const requestId = "requestId" in frame ? frame.requestId : null;
    try {
      if (!state.session) {
        if (frame.type !== "auth") {
          state.conn.close(CLOSE_CODES.authFailed, "authenticate first");
          return;
        }
        await this.auth(state, frame);
        return;
      }
      const device = deviceRecord(this.opts.sdb, state.session.deviceId);
      if (!device || device.revoked || device.userDisabled) {
        state.conn.close(CLOSE_CODES.deviceRevoked, "device revoked");
        return;
      }
      await this.dispatch({ ...state, session: state.session }, state, frame);
    } catch (e) {
      if (e instanceof KiboError) {
        this.error(state, requestId, e.code, e.detail);
        return;
      }
      console.error("[kibo-sync] frame failed", frame.type, e);
      this.error(state, requestId, "INTERNAL", "internal error");
    }
  }

  private async auth(state: ConnState, frame: Extract<ClientFrame, { type: "auth" }>): Promise<void> {
    const { sdb, now, origin } = this.opts;
    const ip = state.conn.ip;
    if (this.failures.blocked(ip)) {
      state.conn.close(CLOSE_CODES.authFailed, "too many failures");
      return;
    }
    let who: Session;
    try {
      who = await verifyChallenge(sdb, { deviceId: frame.deviceId, signature: frame.signature, nonce: state.nonce, origin }, now());
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      this.failures.fail(ip);
      audit(sdb, { at: now(), kind: "auth-failed", deviceId: frame.deviceId, detail: `${e.code} from ${ip}` });
      state.conn.close(e.code === "DEVICE_REVOKED" ? CLOSE_CODES.deviceRevoked : CLOSE_CODES.authFailed, e.code);
      return;
    }
    const open = [...this.conns.values()].filter((s) => s.session?.userId === who.userId).length;
    if (open >= SYNC_LIMITS.connectionsPerUser) {
      state.conn.close(CLOSE_CODES.tooManyConnections, "too many connections");
      return;
    }
    state.session = who;
    state.nonce = "";
    audit(sdb, { at: now(), kind: "connect", userId: who.userId, deviceId: who.deviceId, detail: ip });
    state.conn.send({ type: "welcome", userId: who.userId, name: who.name, deviceId: who.deviceId, projects: projectsOf(sdb, who.userId) });
  }

  private requireRole(projectId: string, userId: string, allowed: Role[]): Role {
    const role = roleOf(this.opts.sdb, projectId, userId);
    if (!role || !allowed.includes(role)) throw new KiboError("FORBIDDEN", `${allowed.join(" or ")} role required on ${projectId}`);
    return role;
  }

  private async dispatch(s: Authed, state: ConnState, frame: ClientFrame): Promise<void> {
    const { sdb, rooms, now } = this.opts;
    const me = s.session;
    switch (frame.type) {
      case "auth":
        throw new KiboError("INVALID_INPUT", "already authenticated");
      case "subscribe": {
        this.requireRole(frame.projectId, me.userId, ["owner", "editor", "viewer"]);
        const room = rooms.get(frame.projectId);
        if (!state.projects.has(frame.projectId)) {
          rooms.attach(frame.projectId, state.conn.id);
          state.projects.add(frame.projectId);
        }
        const bytes = room.diffSince(frame.version === null ? null : fromBase64(frame.version));
        state.conn.send({
          type: "update",
          projectId: frame.projectId,
          bytes: toBase64(bytes),
          serverSeq: room.serverSeq(),
          version: toBase64(room.version()),
        });
        state.conn.send({ type: "members", projectId: frame.projectId, members: listMembers(sdb, frame.projectId) });
        if (room.presence.keys().length > 0) {
          state.conn.send({ type: "presence", projectId: frame.projectId, bytes: toBase64(room.presence.encodeAll()) });
        }
        return;
      }
      case "unsubscribe":
        this.leave(state, frame.projectId);
        return;
      case "push": {
        const reject = (code: "FORBIDDEN" | "RATE_LIMITED", message: string) =>
          state.conn.send({ type: "reject", projectId: frame.projectId, clientBatchId: frame.clientBatchId, code, message, version: null });
        const role = roleOf(sdb, frame.projectId, me.userId);
        if (!state.projects.has(frame.projectId) || role === null) return reject("FORBIDDEN", "not a subscribed member");
        if (!this.pushes.take(me.deviceId)) return reject("RATE_LIMITED", "too many updates per second");
        const room = rooms.get(frame.projectId);
        let result: ReturnType<typeof room.push>;
        try {
          result = room.push(fromBase64(frame.bytes), { userId: me.userId, deviceId: me.deviceId, role }, now());
        } catch (e) {
          if (!(e instanceof RoomReject)) throw e;
          state.conn.send({
            type: "reject",
            projectId: frame.projectId,
            clientBatchId: frame.clientBatchId,
            code: e.code,
            message: e.message,
            version: e.version ? toBase64(e.version) : null,
          });
          return;
        }
        const version = toBase64(result.version);
        state.conn.send({ type: "ack", projectId: frame.projectId, clientBatchId: frame.clientBatchId, serverSeq: result.serverSeq, version });
        if (result.bytes) {
          this.broadcast(frame.projectId, { type: "update", projectId: frame.projectId, bytes: toBase64(result.bytes), serverSeq: result.serverSeq, version });
        }
        return;
      }
      case "presence": {
        if (!state.projects.has(frame.projectId)) throw new KiboError("FORBIDDEN", "subscribe before sending presence");
        const bytes = fromBase64(frame.bytes);
        if (!this.presenceIsOwn(bytes, me)) {
          audit(sdb, { at: now(), kind: "update-rejected", userId: me.userId, deviceId: me.deviceId, projectId: frame.projectId, detail: "spoofed presence" });
          return;
        }
        rooms.get(frame.projectId).presence.apply(bytes);
        this.broadcast(frame.projectId, { type: "presence", projectId: frame.projectId, bytes: frame.bytes }, state.conn.id);
        return;
      }
      case "share": {
        const existing = sdb.db.query("SELECT ownerId FROM projects WHERE id = $id").get({ id: frame.projectId }) as
          | { ownerId: string }
          | null;
        if (existing) {
          if (existing.ownerId !== me.userId) throw new KiboError("FORBIDDEN", "this project id is shared by someone else");
          state.conn.send({ type: "shared", requestId: frame.requestId, projectId: frame.projectId });
          return;
        }
        rooms.create({ projectId: frame.projectId, name: frame.name, ownerId: me.userId, ownerName: me.name, snapshot: fromBase64(frame.snapshot) });
        audit(sdb, { at: now(), kind: "project-shared", userId: me.userId, projectId: frame.projectId });
        state.conn.send({ type: "shared", requestId: frame.requestId, projectId: frame.projectId });
        return;
      }
      case "invite": {
        this.requireRole(frame.projectId, me.userId, ["owner"]);
        const invite = await createInvite(sdb, { kind: "project", projectId: frame.projectId, role: frame.role, createdBy: me.userId }, now());
        state.conn.send({ type: "invite-code", requestId: frame.requestId, code: invite.code, expiresAt: invite.expiresAt });
        return;
      }
      case "redeem": {
        const joined = await redeemProjectInvite(sdb, { code: frame.code, userId: me.userId }, now());
        this.membersChanged(joined.projectId);
        const name = projectsOf(sdb, me.userId).find((p) => p.id === joined.projectId)?.name ?? joined.projectId;
        state.conn.send({ type: "joined", requestId: frame.requestId, projectId: joined.projectId, name, role: joined.role });
        return;
      }
      case "set-role": {
        this.requireRole(frame.projectId, me.userId, ["owner"]);
        setRole(sdb, { projectId: frame.projectId, userId: frame.userId, role: frame.role }, now());
        if (frame.role === null) {
          for (const other of this.conns.values()) {
            if (other.session?.userId !== frame.userId || !other.projects.has(frame.projectId)) continue;
            other.conn.send({ type: "revoked", projectId: frame.projectId, reason: "removed" });
            this.leave(other, frame.projectId);
          }
        }
        this.membersChanged(frame.projectId);
        state.conn.send({ type: "done", requestId: frame.requestId });
        return;
      }
      case "unshare": {
        this.requireRole(frame.projectId, me.userId, ["owner"]);
        for (const other of this.conns.values()) {
          if (!other.projects.has(frame.projectId)) continue;
          if (other !== state) other.conn.send({ type: "revoked", projectId: frame.projectId, reason: "deleted" });
          this.leave(other, frame.projectId);
        }
        rooms.drop(frame.projectId);
        sdb.db.transaction(() => {
          for (const table of ["updates", "snapshots", "invites", "members", "projects"]) {
            const column = table === "projects" ? "id" : "projectId";
            sdb.db.query(`DELETE FROM ${table} WHERE ${column} = $id`).run({ id: frame.projectId });
          }
        })();
        audit(sdb, { at: now(), kind: "project-deleted", userId: me.userId, projectId: frame.projectId });
        state.conn.send({ type: "done", requestId: frame.requestId });
        return;
      }
      case "device-invite": {
        const invite = await createInvite(sdb, { kind: "device", userId: me.userId, createdBy: me.userId }, now());
        state.conn.send({ type: "invite-code", requestId: frame.requestId, code: invite.code, expiresAt: invite.expiresAt });
        return;
      }
      case "list-devices":
        state.conn.send({ type: "devices", requestId: frame.requestId, devices: listDevices(sdb, me.userId) });
        return;
      case "revoke-device": {
        const target = deviceRecord(sdb, frame.deviceId);
        if (!target || target.userId !== me.userId) throw new KiboError("FORBIDDEN", "you can only revoke your own devices");
        revokeDevice(sdb, { deviceId: frame.deviceId, by: me.userId }, now());
        state.conn.send({ type: "done", requestId: frame.requestId });
        this.kickDevice(frame.deviceId, CLOSE_CODES.deviceRevoked);
        return;
      }
    }
  }

  private presenceIsOwn(bytes: Uint8Array, me: Session): boolean {
    const scratch = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);
    try {
      scratch.apply(bytes);
      const keys = scratch.keys();
      if (keys.length !== 1 || keys[0] !== me.deviceId) return false;
      const parsed = PresenceState.safeParse(scratch.get(me.deviceId));
      return parsed.success && parsed.data.userId === me.userId;
    } finally {
      scratch.destroy();
    }
  }

  private membersChanged(projectId: string): void {
    const { rooms, sdb, now } = this.opts;
    const room = rooms.get(projectId);
    const res = room.syncMembers(now());
    if (res?.bytes) {
      this.broadcast(projectId, { type: "update", projectId, bytes: toBase64(res.bytes), serverSeq: res.serverSeq, version: toBase64(res.version) });
    }
    this.broadcast(projectId, { type: "members", projectId, members: listMembers(sdb, projectId) });
  }

  private leave(state: ConnState, projectId: string): void {
    if (!state.projects.delete(projectId)) return;
    this.opts.rooms.detach(projectId, state.conn.id);
  }

  private broadcast(projectId: string, frame: ServerFrame, exceptConnId?: string): void {
    for (const s of this.conns.values()) if (s.projects.has(projectId) && s.conn.id !== exceptConnId) s.conn.send(frame);
  }

  private error(state: ConnState, requestId: string | null, code: string, message: string): void {
    state.conn.send({ type: "error", requestId, code, message });
  }
}
```

Le `DELETE` construit ses noms de table depuis une liste figée du code (jamais depuis une trame) ; la valeur passe en paramètre. L'audit `update-rejected` d'une mise à jour refusée est écrit par `ProjectRoom.push` (T14), pas par le hub.

- [ ] **Step 5: Implémenter le serveur**

`packages/sync-server/src/server.ts` :
```ts
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { JoinRequest, KiboError, type KiboErrorCode, MAX_FRAME_BYTES, SYNC_LIMITS } from "@kibo/schema";
import type { Server } from "bun";
import { redeemDeviceInvite } from "./accounts";
import { openServerDb, type ServerDb } from "./db";
import { type HubConnection, SyncHub } from "./hub";
import { handleMarketRoute } from "./market/routes";
import { NONCE_TTL_MS, NonceCache } from "./market/signed-request";
import { TeamMarket } from "./market/team-market";
import { RoomRegistry } from "./rooms";

export type SyncServerOptions = {
  dataDir: string;
  hostname: string;
  port: number;
  origin: string;
  tls: { cert: string; key: string } | null;
  behindProxy: boolean;
  now?: () => number;
};

type WsData = { id: string; ip: string };
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const JOIN_STATUS: Partial<Record<KiboErrorCode, number>> = { INVITE_INVALID: 403, INVALID_INPUT: 400 };

const fail = (code: KiboErrorCode, message: string, status: number) =>
  Response.json({ ok: false, error: { code, message } }, { status });

export async function startSyncServer(opts: SyncServerOptions): Promise<{
  url: string;
  port: number;
  hub: SyncHub;
  sdb: ServerDb;
  stop(): Promise<void>;
}> {
  const now = opts.now ?? Date.now;
  const loopback = LOOPBACK.has(opts.hostname);
  if (!loopback && (opts.tls === null || opts.behindProxy)) {
    throw new KiboError("TLS_REQUIRED", `listening on ${opts.hostname} needs TLS; --behind-proxy only on loopback`);
  }
  mkdirSync(opts.dataDir, { recursive: true, mode: 0o700 });
  chmodSync(opts.dataDir, 0o700);
  const sdb = openServerDb(join(opts.dataDir, "sync.db"));
  const rooms = new RoomRegistry(sdb, { now, unloadAfterMs: SYNC_LIMITS.unloadAfterMs });
  const market = await TeamMarket.open(sdb, opts.dataDir);
  const nonces = new NonceCache({ ttlMs: NONCE_TTL_MS, now });
  const conns = new Map<string, HubConnection>();
  let hub: SyncHub | null = null;
  const requireHub = (): SyncHub => {
    if (!hub) throw new KiboError("INTERNAL", "sync hub is not ready");
    return hub;
  };
  const clientIp = (req: Request, srv: Server<WsData>): string => {
    if (opts.behindProxy) {
      const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (forwarded) return forwarded;
    }
    return srv.requestIP(req)?.address ?? "unknown";
  };

  const join = async (req: Request, ip: string, h: SyncHub): Promise<Response> => {
    if (h.failures.blocked(ip)) return fail("RATE_LIMITED", "too many failures", 429);
    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      return fail("INVALID_INPUT", `body is not JSON: ${String(e)}`, 400);
    }
    const parsed = JoinRequest.safeParse(body);
    if (!parsed.success) return fail("INVALID_INPUT", parsed.error.message, 400);
    try {
      return Response.json({ ok: true, result: await redeemDeviceInvite(sdb, parsed.data, now()) });
    } catch (e) {
      if (!(e instanceof KiboError)) {
        console.error("[kibo-sync] join failed", e);
        return fail("INTERNAL", "internal error", 500);
      }
      if (e.code === "INVITE_INVALID") h.failures.fail(ip);
      return fail(e.code, e.detail, JOIN_STATUS[e.code] ?? 400);
    }
  };

  const server = Bun.serve({
    hostname: opts.hostname,
    port: opts.port,
    tls: opts.tls ? { cert: opts.tls.cert, key: opts.tls.key } : undefined,
    maxRequestBodySize: MAX_FRAME_BYTES,
    async fetch(req, srv) {
      const url = new URL(req.url);
      const h = requireHub();
      const ip = clientIp(req, srv);
      if (url.pathname === "/v1/sync") {
        if (h.failures.blocked(ip)) return new Response("too many failures", { status: 429 });
        return srv.upgrade(req, { data: { id: crypto.randomUUID(), ip } })
          ? undefined
          : new Response("websocket upgrade required", { status: 426 });
      }
      if (url.pathname === "/v1/join" && req.method === "POST") return join(req, ip, h);
      if (market) {
        const res = await handleMarketRoute(req, url, { sdb, market, nonces, now });
        if (res) return res;
      }
      return new Response("not found", { status: 404 });
    },
    websocket: {
      data: {} as WsData,
      maxPayloadLength: MAX_FRAME_BYTES,
      open(ws) {
        const conn: HubConnection = {
          id: ws.data.id,
          ip: ws.data.ip,
          send: (frame) => ws.send(JSON.stringify(frame)),
          close: (code, reason) => ws.close(code, reason),
        };
        conns.set(conn.id, conn);
        requireHub().open(conn);
      },
      message(ws, message) {
        const conn = conns.get(ws.data.id);
        if (!conn) return;
        if (typeof message !== "string") {
          ws.close(1003, "text frames only");
          return;
        }
        requireHub()
          .message(conn, message)
          .catch((e: unknown) => console.error("[kibo-sync] message handling failed", conn.id, e));
      },
      close(ws) {
        const conn = conns.get(ws.data.id);
        if (!conn) return;
        conns.delete(conn.id);
        requireHub().closed(conn);
      },
    },
  });
  const port = server.port ?? opts.port;
  const origin = opts.origin || `${opts.tls ? "wss" : "ws"}://${opts.hostname}:${port}`;
  hub = new SyncHub({ sdb, rooms, origin, now });
  const sweep = setInterval(() => rooms.sweep(), 60_000);
  const revocations = setInterval(() => requireHub().checkRevocations(), 5_000);
  sweep.unref();
  revocations.unref();
  return {
    url: `${opts.tls ? "https" : "http"}://${opts.hostname}:${port}`,
    port,
    hub,
    sdb,
    stop: async () => {
      clearInterval(sweep);
      clearInterval(revocations);
      server.stop(true);
      sdb.close();
    },
  };
}
```

`data: {} as WsData` est la forme documentée par Bun pour typer `ws.data` ; aucune valeur n'est lue depuis cet objet.

- [ ] **Step 6: Implémenter la CLI et le build**

`packages/sync-server/src/cli.ts` :
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { KiboError } from "@kibo/schema";
import { formatFingerprint } from "@kibo/trust";
import { createInvite, disableUser, revokeDevice } from "./accounts";
import { readAudit } from "./audit";
import { openServerDb, type ServerDb } from "./db";
import { initMarketSource, TeamMarket } from "./market/team-market";
import { startSyncServer } from "./server";

export type CliIo = { out(line: string): void; err(line: string): void; now(): number };

const USAGE = [
  "Utilisation :",
  "  kibo-sync serve --data <dossier> --host <adresse> --port <port> --origin <wss://…> [--tls-cert <fichier> --tls-key <fichier> | --behind-proxy]",
  "  kibo-sync invite account --name <nom> --data <dossier>",
  "  kibo-sync device revoke <deviceId> --data <dossier>",
  "  kibo-sync user disable <userId> --data <dossier>",
  "  kibo-sync audit [--limit <n>] --data <dossier>",
  "  kibo-sync market init --id <id> --name <nom> --data <dossier>",
  "  kibo-sync market grant <userId> owner|publisher --data <dossier>",
];

const options = {
  data: { type: "string" },
  name: { type: "string" },
  id: { type: "string" },
  host: { type: "string", default: "127.0.0.1" },
  port: { type: "string", default: "8443" },
  origin: { type: "string", default: "" },
  "tls-cert": { type: "string" },
  "tls-key": { type: "string" },
  "behind-proxy": { type: "boolean", default: false },
  limit: { type: "string", default: "50" },
} as const;

function required(value: string | undefined, flag: string): string {
  if (!value) throw new KiboError("INVALID_INPUT", `missing --${flag}`);
  return value;
}

async function withDb<T>(dataDir: string, fn: (sdb: ServerDb) => Promise<T> | T): Promise<T> {
  const sdb = openServerDb(join(dataDir, "sync.db"));
  try {
    return await fn(sdb);
  } finally {
    sdb.close();
  }
}

const parse = (argv: string[]) => parseArgs({ args: argv, options, allowPositionals: true });

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [command, sub] = argv;
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (e) {
    io.err(`kibo-sync : ${String(e)}`);
    for (const line of USAGE) io.err(line);
    return 1;
  }
  const { values, positionals } = parsed;
  try {
    if (command === "serve") {
      const tls =
        values["tls-cert"] && values["tls-key"]
          ? { cert: readFileSync(values["tls-cert"], "utf8"), key: readFileSync(values["tls-key"], "utf8") }
          : null;
      const server = await startSyncServer({
        dataDir: required(values.data, "data"),
        hostname: values.host,
        port: Number(values.port),
        origin: values.origin,
        tls,
        behindProxy: values["behind-proxy"],
      });
      io.out(`kibo-sync écoute sur ${server.url}`);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
      await server.stop();
      return 0;
    }
    const dataDir = required(values.data, "data");
    if (command === "invite" && sub === "account") {
      const invite = await withDb(dataDir, (sdb) =>
        createInvite(sdb, { kind: "account", name: required(values.name, "name"), createdBy: "admin" }, io.now()),
      );
      io.out("Code d'invitation (affiché une seule fois, valable 48 h) :");
      io.out(invite.code);
      return 0;
    }
    if (command === "device" && sub === "revoke") {
      const deviceId = required(positionals[2], "deviceId");
      await withDb(dataDir, (sdb) => revokeDevice(sdb, { deviceId, by: "admin" }, io.now()));
      io.out(`Appareil ${deviceId} révoqué. Ses connexions sont coupées sous 5 secondes.`);
      return 0;
    }
    if (command === "user" && sub === "disable") {
      const userId = required(positionals[2], "userId");
      await withDb(dataDir, (sdb) => disableUser(sdb, userId, io.now()));
      io.out(`Utilisateur ${userId} désactivé.`);
      return 0;
    }
    if (command === "audit") {
      const entries = await withDb(dataDir, (sdb) => readAudit(sdb, Number(values.limit)));
      for (const e of entries) {
        io.out([new Date(e.at).toISOString(), e.kind, e.userId ?? "-", e.deviceId ?? "-", e.projectId ?? "-", e.detail ?? ""].join("  "));
      }
      return 0;
    }
    if (command === "market" && sub === "init") {
      const name = required(values.name, "name");
      const res = await initMarketSource(dataDir, { id: required(values.id, "id"), name });
      io.out(`Source « ${name} » créée.`);
      io.out(`Empreinte de la clé : ${formatFingerprint(res.fingerprint)}`);
      io.out(`Clé publique : ${res.publicKey}`);
      return 0;
    }
    if (command === "market" && sub === "grant") {
      const userId = required(positionals[2], "userId");
      const role = positionals[3];
      if (role !== "owner" && role !== "publisher") throw new KiboError("INVALID_INPUT", "role must be owner or publisher");
      await withDb(dataDir, async (sdb) => {
        const market = await TeamMarket.open(sdb, dataDir);
        if (!market) throw new KiboError("INVALID_INPUT", "run `kibo-sync market init` first");
        market.grant(userId, role);
      });
      io.out(`Rôle ${role} accordé à ${userId}.`);
      return 0;
    }
    for (const line of USAGE) io.err(line);
    return 1;
  } catch (e) {
    if (e instanceof KiboError) {
      io.err(`kibo-sync : ${e.code} ${e.detail}`);
      if (e.detail.startsWith("missing --")) for (const line of USAGE) io.err(line);
      return 1;
    }
    throw e;
  }
}

if (import.meta.main) {
  process.exit(
    await runCli(process.argv.slice(2), { out: (l) => console.log(l), err: (l) => console.error(l), now: Date.now }),
  );
}
```

Le test « unknown command » passe `["nope"]` sans `--data` : `required` lève `INVALID_INPUT` (« missing --data »), la CLI imprime l'erreur et l'usage puis renvoie 1.

`packages/sync-server/scripts/build.ts` :
```ts
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, "kibo-sync");
const result = await Bun.build({
  entrypoints: [join(root, "src/cli.ts")],
  compile: { outfile },
  plugins: [
    {
      name: "loro-bundler-build",
      setup(build) {
        build.onResolve({ filter: /^loro-crdt$/ }, (args) => ({
          path: Bun.resolveSync("loro-crdt/bundler", args.importer),
        }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
console.log(`kibo-sync: ${outfile}`);
```

`packages/sync-server/package.json` : ajouter
```json
  "bin": { "kibo-sync": "./src/cli.ts" },
  "scripts": { "build": "bun scripts/build.ts" },
```
et dans `exports` : `"./testing": "./src/testing/start-test-server.ts"`, `"./testing/ws-client": "./src/testing/ws-client.ts"`.

`packages/sync-server/src/index.ts` : ajouter
```ts
export * from "./hub";
export * from "./server";
```

`.github/workflows/ci.yml`, job `test`, après `bun run typecheck` :
```yaml
      - run: bun run --cwd packages/sync-server build
      - name: kibo-sync smoke
        shell: bash
        run: packages/sync-server/dist/kibo-sync invite account --name CI --data "$(mktemp -d)"
```

- [ ] **Step 7: Vérifier le succès, lint et types**

Run: `bun test packages/sync-server && bun run check && bun run typecheck && bun run --cwd packages/sync-server build && packages/sync-server/dist/kibo-sync invite account --name Test --data "$(mktemp -d)"`
Expected: tous les tests PASS ; le binaire imprime un code de 26 caractères.

- [ ] **Step 8: Commits**

```bash
git add packages/sync-server/src/hub.ts packages/sync-server/src/server.ts packages/sync-server/src/testing packages/sync-server/src/hub.test.ts packages/sync-server/src/server.test.ts packages/sync-server/src/index.ts
git commit -m "feat(sync-server): protocole WebSocket"
git add packages/sync-server/src/cli.ts packages/sync-server/src/cli.test.ts packages/sync-server/scripts/build.ts packages/sync-server/package.json .github/workflows/ci.yml
git commit -m "build(sync-server): binaire kibo-sync"
```

Le premier commit est vert seul : ses tests importent `./testing/*` par chemin relatif ; les exports `./testing` du `package.json`, dont dépendent les tâches suivantes, arrivent avec le second commit, avant l'intégration.

---

### Task 18: Moteur de sync par projet

Le cœur du client de sync, sans réseau ni horloge : un `ProjectSync` par projet partagé transforme les changements locaux en lots `push` et les trames du serveur en imports Loro (spec G §6). Le transport (WebSocket) et la connexion viennent en T21 ; ici, `send` et `schedule` sont injectés, ce qui rend le moteur testable pas à pas et réutilisable par la propriété de convergence (T19).

Règles :
- `connected()` envoie `subscribe` avec la version locale (`doc.oplogVersion().encode()` en base64), ou `null` pendant une resynchronisation.
- Tant que le premier `update` n'a pas donné la version du serveur (`serverVersion === null`), rien n'est poussé.
- Un seul lot en vol ; `localChange()` regroupe les changements pendant `SYNC_LIMITS.batchMs` (50 ms) ; `flush()` pousse `export({ mode: "update", from: serverVersion })` seulement si le doc local a des opérations que le serveur n'a pas (comparaison de vecteurs de versions : égal ou inférieur ⇒ rien).
- `ack` du lot en vol : libère le lot, adopte la version du serveur, relance `flush`. Un `ack` ou un `reject` d'un autre lot (arrivé après une reconnexion) est sans objet et ignoré.
- `reject UPDATE_REJECTED` : `onRejected`, puis resynchronisation (décision 8) : un doc neuf reçoit tous les `update` suivants et remplace le doc local dès qu'il atteint la version annoncée par le serveur (un `update` diffusé peut arriver avant la réponse complète au `subscribe`, Loro le garde en attente).
- `reject OUT_OF_DATE` : adopter `version` et renvoyer depuis elle. Autres codes (`FORBIDDEN`, `QUOTA_EXCEEDED`, `RATE_LIMITED`) : `onRejected`, lot libéré, pas de renvoi automatique (T21 décide).

**Files:**
- Create: `packages/daemon/src/sync/transport.ts`
- Create: `packages/daemon/src/sync/project-sync.ts`
- Create: `packages/daemon/src/sync/testing/memory-host.ts`
- Modify: `packages/daemon/package.json` (`@kibo/trust` en dépendance, `@kibo/sync-server` en `devDependencies`, décision 26)
- Test: `packages/daemon/src/sync/transport.test.ts`, `packages/daemon/src/sync/project-sync.test.ts`, `packages/daemon/src/sync/imports.test.ts`

**Interfaces:**
- Consumes (T4) : `ClientFrame`, `ServerFrame`, `RejectCode`, `SYNC_LIMITS` ; (T2) `toBase64`, `fromBase64` ; (T14, tests seulement) `ProjectRoom`, `RoomReject`, `openServerDb`, `seedUser`, `ownerSnapshot` ; (T6) `createTicket`, `listTickets`, `updateTicket`.
- Produces (Contrats partagés) : `SyncHost`, `ProjectSyncOptions`, `ProjectSync` (`connected`, `disconnected`, `localChange`, `resync`, `flush`, `receive`, `inFlight`, `resyncing`), `SyncSocket`, `SyncTransport`, `assertSyncUrl`, `createWebSocketTransport`.
- Produces (**ajout**, pour T19 et T21) : `createMemoryHost(doc: LoroDoc): SyncHost & { replaced: number; current(): LoroDoc }` dans `sync/testing/memory-host.ts`.

- [ ] **Step 1: Dépendances du paquet**

Dans `packages/daemon/package.json`, ajouter `"@kibo/trust": "workspace:*"` à `dependencies` et `"@kibo/sync-server": "workspace:*"` à `devDependencies`, puis `bun install`. `bun.lock` change (arêtes internes seulement, aucune dépendance npm).

- [ ] **Step 2: Écrire les tests du transport qui échouent**

`packages/daemon/src/sync/transport.test.ts` :
```ts
import { expect, test } from "bun:test";
import { assertSyncUrl } from "./transport";

test("wss is always accepted", () => {
  expect(assertSyncUrl("wss://sync.kibo.test/v1/sync").hostname).toBe("sync.kibo.test");
});

test("ws is accepted on loopback only", () => {
  expect(assertSyncUrl("ws://127.0.0.1:4400/v1/sync").port).toBe("4400");
  expect(assertSyncUrl("ws://localhost:4400/v1/sync").hostname).toBe("localhost");
  expect(() => assertSyncUrl("ws://10.0.0.2:4400/v1/sync")).toThrow("TLS_REQUIRED");
  expect(() => assertSyncUrl("ws://sync.kibo.test/v1/sync")).toThrow("TLS_REQUIRED");
});

test("other schemes and garbage are invalid", () => {
  expect(() => assertSyncUrl("https://sync.kibo.test")).toThrow("INVALID_INPUT");
  expect(() => assertSyncUrl("pas une url")).toThrow("INVALID_INPUT");
});
```

- [ ] **Step 3: Lancer le test**

Run: `bun test packages/daemon/src/sync/transport.test.ts`
Expected: FAIL (`./transport` introuvable).

- [ ] **Step 4: Implémenter `transport.ts`**

`packages/daemon/src/sync/transport.ts` :
```ts
import { KiboError } from "@kibo/schema";

export type SyncSocket = {
  send(text: string): void;
  close(code?: number): void;
  onOpen(fn: () => void): void;
  onMessage(fn: (text: string) => void): void;
  onClose(fn: (code: number) => void): void;
};
export type SyncTransport = { open(url: string, opts: { ca: string | null }): SyncSocket };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const UNSUPPORTED_DATA = 1003;

export function assertSyncUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `invalid sync url ${url}: ${String(e)}`);
  }
  if (parsed.protocol === "wss:") return parsed;
  if (parsed.protocol === "ws:") {
    if (LOOPBACK.has(parsed.hostname)) return parsed;
    throw new KiboError("TLS_REQUIRED", `unencrypted sync is only allowed on loopback, not ${parsed.hostname}`);
  }
  throw new KiboError("INVALID_INPUT", `unsupported sync scheme ${parsed.protocol}`);
}

export function createWebSocketTransport(): SyncTransport {
  return {
    open(url, opts) {
      const target = assertSyncUrl(url);
      const ws = opts.ca === null ? new WebSocket(target) : new WebSocket(target, { tls: { ca: opts.ca } });
      return {
        send: (text) => ws.send(text),
        close: (code) => ws.close(code),
        onOpen: (fn) => ws.addEventListener("open", () => fn()),
        onMessage: (fn) =>
          ws.addEventListener("message", (event) => {
            if (typeof event.data === "string") {
              fn(event.data);
              return;
            }
            console.error("[kibo-daemon] sync: binary frame refused", { url: target.origin });
            ws.close(UNSUPPORTED_DATA);
          }),
        onClose: (fn) => ws.addEventListener("close", (event) => fn(event.code)),
      };
    },
  };
}
```
L'option `tls.ca` du constructeur `WebSocket` de Bun est validée par le test de plateforme de T3 ; si Bun 1.4.2 la refuse, T3 l'a signalé et le chef d'équipe a tranché avant cette tâche.

- [ ] **Step 5: Relancer le test**

Run: `bun test packages/daemon/src/sync/transport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Écrire l'hôte en mémoire**

`packages/daemon/src/sync/testing/memory-host.ts` :
```ts
import type { LoroDoc } from "loro-crdt";
import type { SyncHost } from "../project-sync";

export type MemoryHost = SyncHost & { replaced: number; current(): LoroDoc };

export function createMemoryHost(initial: LoroDoc): MemoryHost {
  let doc = initial;
  const host: MemoryHost = {
    replaced: 0,
    doc: () => doc,
    current: () => doc,
    applyRemote: (bytes) => {
      doc.import(bytes);
    },
    replaceDoc: (next) => {
      doc = next;
      host.replaced += 1;
    },
  };
  return host;
}
```

- [ ] **Step 7: Écrire les tests du moteur qui échouent**

`packages/daemon/src/sync/project-sync.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTicket, listTickets, updateTicket } from "@kibo/core";
import type { ClientFrame, RejectCode, ServerFrame } from "@kibo/schema";
import { openServerDb, ProjectRoom, RoomReject, type ServerDb } from "@kibo/sync-server";
import { ownerSnapshot, type SeededUser, seedUser } from "@kibo/sync-server/testing/fixtures";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import { ProjectSync } from "./project-sync";
import { createMemoryHost, type MemoryHost } from "./testing/memory-host";

const NOW = 1_790_000_000_000;
type Down = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;

let sdb: ServerDb;
let adam: SeededUser;
let room: ProjectRoom;

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  adam = await seedUser(sdb, "Adam", NOW);
  room = ProjectRoom.create(
    sdb,
    { projectId: "p1", name: "Kibo", ownerId: adam.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
    NOW,
  );
});
afterEach(() => sdb.close());

function relay() {
  const down: Down[] = [];
  const up: ClientFrame[] = [];
  const answer = (frame: ClientFrame) => {
    if (frame.type === "subscribe") {
      down.push({
        type: "update",
        projectId: "p1",
        bytes: toBase64(room.diffSince(frame.version === null ? null : fromBase64(frame.version))),
        serverSeq: room.serverSeq(),
        version: toBase64(room.version()),
      });
      return;
    }
    if (frame.type !== "push") return;
    try {
      const result = room.push(fromBase64(frame.bytes), { userId: adam.userId, deviceId: adam.deviceId, role: "owner" }, NOW);
      down.push({
        type: "ack",
        projectId: "p1",
        clientBatchId: frame.clientBatchId,
        serverSeq: result.serverSeq,
        version: toBase64(result.version),
      });
      if (result.bytes !== null) {
        down.push({
          type: "update",
          projectId: "p1",
          bytes: toBase64(result.bytes),
          serverSeq: result.serverSeq,
          version: toBase64(result.version),
        });
      }
    } catch (e) {
      if (!(e instanceof RoomReject)) throw e;
      down.push({
        type: "reject",
        projectId: "p1",
        clientBatchId: frame.clientBatchId,
        code: e.code,
        message: e.message,
        version: e.version === null ? null : toBase64(e.version),
      });
    }
  };
  return {
    up,
    down,
    send: (frame: ClientFrame) => up.push(frame),
    serve() {
      for (let f = up.shift(); f !== undefined; f = up.shift()) answer(f);
    },
    deliver(sync: ProjectSync) {
      for (let f = down.shift(); f !== undefined; f = down.shift()) sync.receive(f);
    },
  };
}

type Harness = {
  sync: ProjectSync;
  host: MemoryHost;
  net: ReturnType<typeof relay>;
  timers: (() => void)[];
  saved: (Uint8Array | null)[];
  rejected: { code: RejectCode; message: string }[];
};

function client(initial: LoroDoc, serverVersion: Uint8Array | null): Harness {
  const net = relay();
  const host = createMemoryHost(initial);
  const timers: (() => void)[] = [];
  const saved: (Uint8Array | null)[] = [];
  const rejected: { code: RejectCode; message: string }[] = [];
  let batch = 0;
  const sync = new ProjectSync({
    projectId: "p1",
    host,
    send: net.send,
    serverVersion,
    saveServerVersion: (v) => saved.push(v),
    newBatchId: () => `b${++batch}`,
    schedule: (fn) => timers.push(fn),
    onRejected: (code, message) => rejected.push({ code, message }),
  });
  return { sync, host, net, timers, saved, rejected };
}

const runTimers = (h: Harness) => {
  for (let t = h.timers.shift(); t !== undefined; t = h.timers.shift()) t();
};

const roundTrip = (h: Harness) => {
  h.net.serve();
  h.net.deliver(h.sync);
};

const serverDoc = () => LoroDoc.fromSnapshot(room.snapshotBytes());

describe("subscribe", () => {
  test("a new member catches up from an empty document", () => {
    const h = client(new LoroDoc(), null);
    h.sync.connected();
    expect(h.net.up[0]).toMatchObject({ type: "subscribe", projectId: "p1" });
    roundTrip(h);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
    expect(h.saved.at(-1)).toEqual(room.version());
  });

  test("nothing is pushed before the server version is known", () => {
    const h = client(serverDoc(), null);
    createTicket(h.host.current(), { title: "Hors ligne" });
    h.sync.localChange();
    runTimers(h);
    expect(h.net.up).toEqual([]);
  });

  test("offline changes are pushed right after the catch-up", () => {
    const h = client(serverDoc(), null);
    createTicket(h.host.current(), { title: "Hors ligne" });
    h.sync.connected();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.net.up.map((f) => f.type)).toEqual(["push"]);
    roundTrip(h);
    expect(listTickets(serverDoc()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3"]);
  });
});

describe("push", () => {
  test("three quick commands make a single batch", () => {
    const h = client(serverDoc(), room.version());
    h.sync.connected();
    roundTrip(h);
    for (const title of ["A", "B", "C"]) {
      createTicket(h.host.current(), { title });
      h.sync.localChange();
    }
    expect(h.timers).toHaveLength(1);
    runTimers(h);
    expect(h.net.up.filter((f) => f.type === "push")).toHaveLength(1);
    roundTrip(h);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2", "KIB-3", "KIB-4", "KIB-5"]);
    expect(h.sync.inFlight).toBeNull();
  });

  test("a single batch is in flight; the next one leaves after the ack", () => {
    const h = client(serverDoc(), room.version());
    h.sync.connected();
    roundTrip(h);
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    expect(h.sync.inFlight).toBe("b1");
    createTicket(h.host.current(), { title: "B" });
    h.sync.flush();
    expect(h.net.up.filter((f) => f.type === "push")).toHaveLength(1);
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.net.up.map((f) => f.type)).toEqual(["push"]);
    expect(h.sync.inFlight).toBe("b2");
    roundTrip(h);
    expect(listTickets(serverDoc()).map((t) => t.title)).toEqual(["Noyau de données", "Schéma Loro des tickets", "A", "B"]);
  });

  test("a disconnection releases the batch and nothing is sent while offline", () => {
    const h = client(serverDoc(), room.version());
    h.sync.connected();
    roundTrip(h);
    createTicket(h.host.current(), { title: "A" });
    h.sync.flush();
    h.net.up.length = 0;
    h.sync.disconnected();
    expect(h.sync.inFlight).toBeNull();
    h.sync.flush();
    expect(h.net.up).toEqual([]);
  });
});

describe("rejections", () => {
  test("UPDATE_REJECTED replaces the document and drops the forged change", () => {
    const h = client(serverDoc(), room.version());
    h.sync.connected();
    roundTrip(h);
    const [first] = h.host.current().getTree("tickets").roots();
    first?.data.set("key", "KIB-42");
    h.host.current().commit();
    h.sync.flush();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.rejected.map((r) => r.code)).toEqual(["UPDATE_REJECTED"]);
    expect(h.sync.resyncing).toBe(true);
    expect(h.net.up).toEqual([{ type: "subscribe", projectId: "p1", version: null }]);
    roundTrip(h);
    expect(h.host.replaced).toBe(1);
    expect(h.sync.resyncing).toBe(false);
    expect(listTickets(h.host.current()).map((t) => t.key)).toEqual(["KIB-1", "KIB-2"]);
  });

  test("OUT_OF_DATE resends from the server version", () => {
    const local = serverDoc();
    const t = createTicket(local, { title: "A" });
    const pretended = local.oplogVersion().encode();
    updateTicket(local, t.id, { title: "A bis" });
    const h = client(local, pretended);
    h.sync.connected();
    h.net.up.length = 0;
    h.sync.flush();
    h.net.serve();
    h.net.deliver(h.sync);
    expect(h.rejected).toEqual([]);
    roundTrip(h);
    expect(listTickets(serverDoc()).find((x) => x.id === t.id)?.title).toBe("A bis");
  });
});
```
Dans le test `OUT_OF_DATE`, le moteur croit que le serveur a déjà la création du ticket : le premier lot ne contient que le renommage, le serveur répond `OUT_OF_DATE` avec sa vraie version, le second lot contient les deux opérations.

- [ ] **Step 8: Lancer le test**

Run: `bun test packages/daemon/src/sync/project-sync.test.ts`
Expected: FAIL (`./project-sync` introuvable).

- [ ] **Step 9: Implémenter `project-sync.ts`**

`packages/daemon/src/sync/project-sync.ts` :
```ts
import { type ClientFrame, type RejectCode, type ServerFrame, SYNC_LIMITS } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc, VersionVector } from "loro-crdt";

export type SyncHost = { doc(): LoroDoc; applyRemote(bytes: Uint8Array): void; replaceDoc(doc: LoroDoc): void };
export type ProjectSyncOptions = {
  projectId: string;
  host: SyncHost;
  send(frame: ClientFrame): void;
  serverVersion: Uint8Array | null;
  saveServerVersion(version: Uint8Array | null): void;
  newBatchId(): string;
  schedule(fn: () => void, ms: number): void;
  onRejected(code: RejectCode, message: string): void;
};
type Incoming = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;

export class ProjectSync {
  private online = false;
  private flushQueued = false;
  private batch: string | null = null;
  private fresh: LoroDoc | null = null;
  private serverVersion: Uint8Array | null;

  constructor(private readonly opts: ProjectSyncOptions) {
    this.serverVersion = opts.serverVersion;
  }

  get inFlight(): string | null {
    return this.batch;
  }

  get resyncing(): boolean {
    return this.fresh !== null;
  }

  connected(): void {
    this.online = true;
    this.batch = null;
    const version = this.fresh === null ? toBase64(this.opts.host.doc().oplogVersion().encode()) : null;
    this.opts.send({ type: "subscribe", projectId: this.opts.projectId, version });
  }

  disconnected(): void {
    this.online = false;
    this.batch = null;
  }

  localChange(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    this.opts.schedule(() => {
      this.flushQueued = false;
      this.flush();
    }, SYNC_LIMITS.batchMs);
  }

  resync(): void {
    this.fresh = new LoroDoc();
    this.batch = null;
    this.adoptServerVersion(null);
    if (this.online) this.opts.send({ type: "subscribe", projectId: this.opts.projectId, version: null });
  }

  flush(): void {
    if (!this.online || this.batch !== null || this.fresh !== null || this.serverVersion === null) return;
    const doc = this.opts.host.doc();
    const server = VersionVector.decode(this.serverVersion);
    const order = doc.oplogVersion().compare(server);
    if (order === 0 || order === -1) return;
    const batch = this.opts.newBatchId();
    this.batch = batch;
    this.opts.send({
      type: "push",
      projectId: this.opts.projectId,
      bytes: toBase64(doc.export({ mode: "update", from: server })),
      clientBatchId: batch,
    });
  }

  receive(frame: Incoming): void {
    if (frame.type === "update") {
      this.applyUpdate(fromBase64(frame.bytes), fromBase64(frame.version));
      return;
    }
    if (frame.clientBatchId !== this.batch) return;
    this.batch = null;
    if (frame.type === "ack") {
      this.adoptServerVersion(fromBase64(frame.version));
      this.flush();
      return;
    }
    if (frame.code === "OUT_OF_DATE" && frame.version !== null) {
      this.adoptServerVersion(fromBase64(frame.version));
      this.flush();
      return;
    }
    this.opts.onRejected(frame.code, frame.message);
    if (frame.code === "UPDATE_REJECTED") this.resync();
  }

  private applyUpdate(bytes: Uint8Array, version: Uint8Array): void {
    if (this.fresh === null) {
      this.opts.host.applyRemote(bytes);
      this.adoptServerVersion(version);
      this.flush();
      return;
    }
    this.fresh.import(bytes);
    const reached = this.fresh.oplogVersion().compare(VersionVector.decode(version));
    if (reached !== 0 && reached !== 1) return;
    const complete = this.fresh;
    this.fresh = null;
    this.opts.host.replaceDoc(complete);
    this.adoptServerVersion(version);
  }

  private adoptServerVersion(version: Uint8Array | null): void {
    this.serverVersion = version;
    this.opts.saveServerVersion(version);
  }
}
```
Un `ack` ou un `reject` dont le `clientBatchId` n'est pas le lot en vol est sans objet (lot d'une connexion précédente, déjà libéré par `disconnected`) : ce n'est pas une erreur et il n'y a rien à journaliser.

- [ ] **Step 10: Relancer le test**

Run: `bun test packages/daemon/src/sync/project-sync.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 11: Test d'imports (décision 26)**

`packages/daemon/src/sync/imports.test.ts` :
```ts
import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "testing" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("production code of the daemon never imports the sync server", () => {
  const offenders = sources(root)
    .filter((file) => readFileSync(file, "utf8").includes("@kibo/sync-server"))
    .map((file) => relative(root, file));
  expect(offenders).toEqual([]);
});
```

Run: `bun test packages/daemon/src/sync/imports.test.ts`
Expected: PASS (le test protège contre une régression ; le vérifier une fois en ajoutant temporairement `import "@kibo/sync-server";` à `transport.ts` ⇒ FAIL, puis retirer la ligne).

- [ ] **Step 12: Suite, lint, types**

Run: `bun test packages/daemon && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add packages/daemon/package.json bun.lock packages/daemon/src/sync/transport.ts \
  packages/daemon/src/sync/project-sync.ts packages/daemon/src/sync/testing/memory-host.ts \
  packages/daemon/src/sync/transport.test.ts packages/daemon/src/sync/project-sync.test.ts \
  packages/daemon/src/sync/imports.test.ts
git commit -m "feat(daemon): moteur de sync par projet"
```

---

### Task 19: Propriété de convergence multi-client

Critère de sortie de la spec G (§9, §10) : avec 2 à 5 clients qui modifient le même projet, se déconnectent et se reconnectent au hasard, tous les docs convergent vers celui du serveur, chaque ticket finit avec une clé, et les clés sont uniques et contiguës. Le test assemble les vrais composants (`ProjectSync` de T18, `ProjectRoom` de T14, commandes de `core`) sur un réseau en mémoire dont fast-check choisit chaque livraison. Tâche à risque : relue aussi par `kibo-lead`.

Modèle du réseau :
- un lien par client, deux files FIFO (montante et descendante) ; fast-check choisit quel client envoie ou reçoit une trame, quand ses minuteries (envoi groupé de 50 ms) se déclenchent, et quand il se déconnecte ou se reconnecte ;
- une déconnexion vide les deux files du client (trames perdues, comme une socket fermée) : un lot peut être perdu avant le serveur, ou son `ack` perdu après (renvoi idempotent) ;
- le serveur répond à `subscribe` par `update` depuis `diffSince`, à `push` par `ack` à l'émetteur puis `update` à tous les clients connectés et abonnés, émetteur compris ; `RoomReject` devient `reject`.

Invariants vérifiés après reconnexion de tous et vidage des files :
1. aucun client n'a reçu de rejet (des clients honnêtes n'écrivent jamais de champ réservé) ;
2. `toJSON()` de chaque doc client égal à celui du serveur ;
3. chaque ticket vivant a une clé, sans doublon ;
4. clés initiales (`KIB-1`, `KIB-2`) + toutes les clés de `PushResult.allocated` = exactement `KIB-1…KIB-ticketSeq`, sans doublon ni trou.

`numRuns` vaut au moins 200 (critère de sortie) ; `KIBO_PROPERTY_RUNS` ne peut que l'augmenter. En cas d'échec, fast-check affiche la graine et le contre-exemple réduit (comportement par défaut) : les recopier dans le rapport de la tâche.

**Files:**
- Create: `packages/daemon/src/sync/testing/in-memory-network.ts`
- Create: `packages/daemon/src/sync/convergence.property.test.ts`
- Modify: `packages/daemon/package.json` (`fast-check` `4.3.0` en `devDependencies`, même version que `core`)

**Interfaces:**
- Consumes (T18) : `ProjectSync`, `createMemoryHost`, `MemoryHost` ; (T14) `ProjectRoom`, `RoomReject`, `Actor`, `openServerDb`, `seedUser`, `ownerSnapshot` ; (T7) `executeProjectCommand`, `listTickets`, `listPages` ; (T4) `ClientFrame`, `ServerFrame`, `RejectCode` ; (T2) `toBase64`, `fromBase64`.
- Produces (**ajout**, test seulement) : `class InMemoryNetwork { constructor(room: ProjectRoom, actor: Actor, now: () => number); clients: NetClient[]; allocated: { ticketId: string; key: string }[]; addClient(doc: LoroDoc): NetClient; connect(c: NetClient): void; disconnect(c: NetClient): void; stepUp(c: NetClient): boolean; stepDown(c: NetClient): boolean; runTimers(c: NetClient): boolean; drain(): void }`.

- [ ] **Step 1: Ajouter fast-check au démon**

Dans `packages/daemon/package.json`, `devDependencies` : `"fast-check": "4.3.0"`, puis `bun install` (version déjà dans `bun.lock` via `core`).

- [ ] **Step 2: Écrire le réseau en mémoire**

`packages/daemon/src/sync/testing/in-memory-network.ts` :
```ts
import type { ClientFrame, RejectCode, ServerFrame } from "@kibo/schema";
import { type Actor, type ProjectRoom, RoomReject } from "@kibo/sync-server";
import { fromBase64, toBase64 } from "@kibo/trust";
import type { LoroDoc } from "loro-crdt";
import { ProjectSync } from "../project-sync";
import { createMemoryHost, type MemoryHost } from "./memory-host";

type Down = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;

export type NetClient = {
  readonly index: number;
  readonly sync: ProjectSync;
  readonly host: MemoryHost;
  readonly up: ClientFrame[];
  readonly down: Down[];
  readonly timers: (() => void)[];
  readonly rejected: { code: RejectCode; message: string }[];
  connected: boolean;
  subscribed: boolean;
};

const MAX_ROUNDS = 10_000;

export class InMemoryNetwork {
  readonly clients: NetClient[] = [];
  readonly allocated: { ticketId: string; key: string }[] = [];
  private batches = 0;

  constructor(
    private readonly room: ProjectRoom,
    private readonly actor: Actor,
    private readonly now: () => number,
  ) {}

  addClient(doc: LoroDoc): NetClient {
    const up: ClientFrame[] = [];
    const down: Down[] = [];
    const timers: (() => void)[] = [];
    const rejected: { code: RejectCode; message: string }[] = [];
    const host = createMemoryHost(doc);
    const sync = new ProjectSync({
      projectId: this.room.projectId,
      host,
      send: (frame) => up.push(frame),
      serverVersion: this.room.version(),
      saveServerVersion: () => {},
      newBatchId: () => {
        this.batches += 1;
        return `b${this.batches}`;
      },
      schedule: (fn) => timers.push(fn),
      onRejected: (code, message) => rejected.push({ code, message }),
    });
    const client: NetClient = {
      index: this.clients.length,
      sync,
      host,
      up,
      down,
      timers,
      rejected,
      connected: false,
      subscribed: false,
    };
    this.clients.push(client);
    return client;
  }

  connect(c: NetClient): void {
    if (c.connected) return;
    c.connected = true;
    c.sync.connected();
  }

  disconnect(c: NetClient): void {
    if (!c.connected) return;
    c.connected = false;
    c.subscribed = false;
    c.up.length = 0;
    c.down.length = 0;
    c.sync.disconnected();
  }

  stepUp(c: NetClient): boolean {
    const frame = c.up.shift();
    if (frame === undefined) return false;
    this.serve(c, frame);
    return true;
  }

  stepDown(c: NetClient): boolean {
    const frame = c.down.shift();
    if (frame === undefined) return false;
    c.sync.receive(frame);
    return true;
  }

  runTimers(c: NetClient): boolean {
    const due = c.timers.splice(0);
    for (const fn of due) fn();
    return due.length > 0;
  }

  drain(): void {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let progressed = false;
      for (const c of this.clients) {
        if (this.runTimers(c)) progressed = true;
        while (this.stepUp(c)) progressed = true;
        while (this.stepDown(c)) progressed = true;
      }
      if (!progressed) return;
    }
    throw new Error(`in-memory network did not settle after ${MAX_ROUNDS} rounds`);
  }

  private update(bytes: Uint8Array, serverSeq: number, version: Uint8Array): Down {
    return {
      type: "update",
      projectId: this.room.projectId,
      bytes: toBase64(bytes),
      serverSeq,
      version: toBase64(version),
    };
  }

  private serve(c: NetClient, frame: ClientFrame): void {
    if (frame.type === "subscribe") {
      c.subscribed = true;
      const since = frame.version === null ? null : fromBase64(frame.version);
      c.down.push(this.update(this.room.diffSince(since), this.room.serverSeq(), this.room.version()));
      return;
    }
    if (frame.type !== "push") throw new Error(`unexpected ${frame.type} frame in the in-memory network`);
    try {
      const result = this.room.push(fromBase64(frame.bytes), this.actor, this.now());
      this.allocated.push(...result.allocated);
      c.down.push({
        type: "ack",
        projectId: this.room.projectId,
        clientBatchId: frame.clientBatchId,
        serverSeq: result.serverSeq,
        version: toBase64(result.version),
      });
      if (result.bytes === null) return;
      const broadcast = this.update(result.bytes, result.serverSeq, result.version);
      for (const other of this.clients) if (other.connected && other.subscribed) other.down.push(broadcast);
    } catch (e) {
      if (!(e instanceof RoomReject)) throw e;
      c.down.push({
        type: "reject",
        projectId: this.room.projectId,
        clientBatchId: frame.clientBatchId,
        code: e.code,
        message: e.message,
        version: e.version === null ? null : toBase64(e.version),
      });
    }
  }
}
```

- [ ] **Step 3: Écrire la propriété**

`packages/daemon/src/sync/convergence.property.test.ts` :
```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { executeProjectCommand, listPages, listTickets } from "@kibo/core";
import { KiboError, type KiboErrorCode, type ProjectCommand, type StatusId } from "@kibo/schema";
import { openServerDb, ProjectRoom, type ServerDb } from "@kibo/sync-server";
import { ownerSnapshot, type SeededUser, seedUser } from "@kibo/sync-server/testing/fixtures";
import fc from "fast-check";
import { LoroDoc } from "loro-crdt";
import { InMemoryNetwork, type NetClient } from "./testing/in-memory-network";

const NOW = 1_790_000_000_000;
const RUNS = Math.max(200, Number(process.env.KIBO_PROPERTY_RUNS ?? 0));
const INITIAL_KEYS = ["KIB-1", "KIB-2"];
const TOLERATED = new Set<KiboErrorCode>(["TREE_CYCLE", "LINK_CYCLE", "INVALID_INPUT", "NOT_FOUND"]);
const STATUSES: StatusId[] = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"];

type Edit =
  | { kind: "create"; parent: number | null; title: string }
  | { kind: "rename"; ticket: number; title: string }
  | { kind: "status"; ticket: number; status: StatusId }
  | { kind: "move"; ticket: number; parent: number | null }
  | { kind: "delete"; ticket: number }
  | { kind: "page"; title: string }
  | { kind: "movePage"; page: number; parent: number | null }
  | { kind: "link"; from: number; to: number; blocks: boolean };
type Step =
  | { kind: "edit"; client: number; edit: Edit }
  | { kind: "up" | "down" | "timers" | "toggle"; client: number };

const pick = fc.nat(20);
const maybePick = fc.option(fc.nat(20), { nil: null });
const title = fc.constantFrom("Schéma", "Kanban", "Hooks", "Sandbox", "Notes");
const edit: fc.Arbitrary<Edit> = fc.oneof(
  fc.record({ kind: fc.constant("create" as const), parent: maybePick, title }),
  fc.record({ kind: fc.constant("rename" as const), ticket: pick, title }),
  fc.record({ kind: fc.constant("status" as const), ticket: pick, status: fc.constantFrom(...STATUSES) }),
  fc.record({ kind: fc.constant("move" as const), ticket: pick, parent: maybePick }),
  fc.record({ kind: fc.constant("delete" as const), ticket: pick }),
  fc.record({ kind: fc.constant("page" as const), title }),
  fc.record({ kind: fc.constant("movePage" as const), page: pick, parent: maybePick }),
  fc.record({ kind: fc.constant("link" as const), from: pick, to: pick, blocks: fc.boolean() }),
);
const step = (clients: number): fc.Arbitrary<Step> =>
  fc.oneof(
    { weight: 4, arbitrary: fc.record({ kind: fc.constant("edit" as const), client: fc.nat(clients - 1), edit }) },
    { weight: 3, arbitrary: fc.record({ kind: fc.constant("up" as const), client: fc.nat(clients - 1) }) },
    { weight: 3, arbitrary: fc.record({ kind: fc.constant("down" as const), client: fc.nat(clients - 1) }) },
    { weight: 2, arbitrary: fc.record({ kind: fc.constant("timers" as const), client: fc.nat(clients - 1) }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant("toggle" as const), client: fc.nat(clients - 1) }) },
  );
const scenario = fc
  .integer({ min: 2, max: 5 })
  .chain((clients) => fc.record({ clients: fc.constant(clients), steps: fc.array(step(clients), { maxLength: 60 }) }));

function toCommand(doc: LoroDoc, e: Edit): ProjectCommand | null {
  const tickets = listTickets(doc);
  const pages = listPages(doc);
  const ticket = (i: number) => tickets[i % Math.max(tickets.length, 1)]?.id ?? null;
  const page = (i: number) => pages[i % Math.max(pages.length, 1)]?.id ?? null;
  switch (e.kind) {
    case "create":
      return { method: "createTicket", title: e.title, parentId: e.parent === null ? null : ticket(e.parent) };
    case "rename": {
      const id = ticket(e.ticket);
      return id === null ? null : { method: "updateTicket", ticketId: id, title: `${e.title} bis` };
    }
    case "status": {
      const id = ticket(e.ticket);
      if (id === null) return null;
      return e.status === "blocked"
        ? { method: "setStatus", ticketId: id, statusId: e.status, reason: "Attente client" }
        : { method: "setStatus", ticketId: id, statusId: e.status };
    }
    case "move": {
      const id = ticket(e.ticket);
      return id === null ? null : { method: "moveTicket", ticketId: id, parentId: e.parent === null ? null : ticket(e.parent) };
    }
    case "delete": {
      const id = ticket(e.ticket);
      return id === null ? null : { method: "deleteTicket", ticketId: id };
    }
    case "page":
      return { method: "addPage", title: e.title, kind: "view", parentId: null };
    case "movePage": {
      const id = page(e.page);
      return id === null ? null : { method: "movePage", pageId: id, parentId: e.parent === null ? null : page(e.parent) };
    }
    case "link": {
      const from = ticket(e.from);
      const to = ticket(e.to);
      return from === null || to === null ? null : { method: "addLink", from, to, type: e.blocks ? "blocks" : "relates" };
    }
  }
}

function applyEdit(c: NetClient, e: Edit): void {
  const command = toCommand(c.host.doc(), e);
  if (command === null) return;
  try {
    executeProjectCommand(c.host.doc(), command);
  } catch (err) {
    if (err instanceof KiboError && TOLERATED.has(err.code)) return;
    throw err;
  }
  c.sync.localChange();
}

let sdb: ServerDb;
let owner: SeededUser;
let projects = 0;

beforeAll(async () => {
  sdb = openServerDb(":memory:");
  owner = await seedUser(sdb, "Adam", NOW);
});
afterAll(() => sdb.close());

test(
  "N clients with random edits and partitions converge, with unique and contiguous keys",
  () => {
    fc.assert(
      fc.property(scenario, ({ clients, steps }) => {
        projects += 1;
        const room = ProjectRoom.create(
          sdb,
          { projectId: `p${projects}`, name: "Kibo", ownerId: owner.userId, ownerName: "Adam", snapshot: ownerSnapshot() },
          NOW,
        );
        const net = new InMemoryNetwork(room, { userId: owner.userId, deviceId: owner.deviceId, role: "editor" }, () => NOW);
        for (let i = 0; i < clients; i++) {
          const doc = new LoroDoc();
          doc.import(room.diffSince(null));
          net.connect(net.addClient(doc));
        }
        for (const s of steps) {
          const c = net.clients[s.client];
          if (!c) continue;
          if (s.kind === "edit") applyEdit(c, s.edit);
          else if (s.kind === "up") net.stepUp(c);
          else if (s.kind === "down") net.stepDown(c);
          else if (s.kind === "timers") net.runTimers(c);
          else if (c.connected) net.disconnect(c);
          else net.connect(c);
        }
        for (const c of net.clients) net.connect(c);
        net.drain();

        const server = LoroDoc.fromSnapshot(room.snapshotBytes());
        const expected = server.toJSON();
        for (const c of net.clients) {
          expect(c.rejected).toEqual([]);
          expect(c.host.current().toJSON()).toEqual(expected);
        }
        const live = listTickets(server).map((t) => t.key);
        expect(live.every((k) => k !== null)).toBe(true);
        expect(new Set(live).size).toBe(live.length);
        const ticketSeq = server.getMap("meta").get("ticketSeq") as number;
        const ever = [...INITIAL_KEYS, ...net.allocated.map((a) => a.key)];
        expect(ever).toHaveLength(ticketSeq);
        expect(new Set(ever)).toEqual(new Set(Array.from({ length: ticketSeq }, (_, i) => `KIB-${i + 1}`)));
      }),
      { numRuns: RUNS },
    );
  },
  300_000,
);
```

- [ ] **Step 4: Lancer la propriété**

Run: `bun test packages/daemon/src/sync/convergence.property.test.ts`
Expected: PASS (200 exécutions, moins d'une minute en local). Si elle échoue : le contre-exemple réduit désigne soit `ProjectSync` (T18), soit la salle (T14), soit `validateProjectUpdate` (T7) ; corriger la cause dans le bon fichier, ajouter le contre-exemple comme test unitaire dans la tâche concernée, jamais affaiblir la propriété.

- [ ] **Step 5: Vérifier que la propriété détecte une régression**

Remplacer temporairement, dans `project-sync.ts`, la condition `if (order === 0 || order === -1) return;` par `if (order !== 1) return;` (les lots concurrents ne partent plus).
Run: `bun test packages/daemon/src/sync/convergence.property.test.ts`
Expected: FAIL (docs non convergents). Rétablir la ligne, relancer : PASS.

- [ ] **Step 6: Suite, lint, types**

Run: `bun test packages/daemon && bun run check && bun run typecheck`
Expected: PASS. La CI exécute la propriété sur macOS et Linux dans `bun test packages components` (au moins 200 exécutions par OS).

- [ ] **Step 7: Commit**

```bash
git add packages/daemon/package.json bun.lock packages/daemon/src/sync/testing/in-memory-network.ts \
  packages/daemon/src/sync/convergence.property.test.ts
git commit -m "test(daemon): convergence multi-client"
```

---

### Task 20: Installation depuis la marketplace

Installer un paquet vérifié (spec H §5.2 point 3, §7) : sources écrites dans un dossier temporaire privé, validation générique de Kibo **dans le bac à sable OS** (décision 16), copie au magasin, entrée au registre sans confiance, épinglage de l'éditeur, aperçu pour l'écran 30. Tout échec laisse magasin et registre intacts (spec H §5.2 point 4). La même tâche écrit `Instance.componentHash` (décision 11).

**Files:**
- Create: `packages/daemon/src/market/install.ts`, `packages/daemon/src/market/sandboxed-validator.ts`, `packages/daemon/src/testing/memory-component-store.ts`, `packages/devkit/src/run-step.ts`, `packages/devkit/src/conformance-entry.ts`
- Modify: `packages/devkit/src/validate.ts` (options `conformanceOnly` et `wrap`), `packages/core/src/instances.ts` (`setInstanceHash`), `packages/daemon/src/service.ts` (écriture de `componentHash` après `addInstance` / `setInstanceComponent`, RPC `installFromMarket`), `packages/daemon/src/market/rpc.ts`
- Test: `packages/devkit/src/validate-options.test.ts`, `packages/core/src/instances.test.ts`, `packages/daemon/src/market/install.test.ts`, `packages/daemon/src/service-component-hash.test.ts`

**Interfaces:**
- Consumes: `MarketService.fetchVerified`, `MarketService.pinPublisher`, `RegistryPort`, `startFakeMarket`, `createMemoryRegistry` (T15) ; `detectSandbox`, `wrapCommand`, `type SandboxProbe`, `type SandboxPolicy` (T8) ; `sourceHash`, `type SourceFile` (T2) ; `makeTestPackage` (T10) ; `MarketInstallResult`, `RegistryVersion`, `Instance`, `KiboError` (T5, T1) ; `ComponentStore`, `validateComponent`, `ValidationReport`, `BUILTIN_IDS` (phase 4).
- Hypothèse v0.6 (vérifiée en T0) : `buildTrustPreview(input: { id: string; version: string; hash: string; manifest: ComponentManifest; origin: ComponentOrigin }): TrustPreview` (fonction pure de l'écran 30, `packages/daemon/src/components/trust-preview.ts`) ; `validateComponent` lance ses sous-processus par `Bun.spawn(argv, { cwd })` dans `packages/devkit/src/validate.ts` ; la toolchain est `toolchainDir()` exporté par `packages/devkit/src/toolchain.ts` ; `runConformance(mod: ComponentModule)` et un `ui.tsx` utilisateur exportent `Component` (générateur de la phase 4).
- Produces :
  - `TrustPreview.market: { publisherName: string; verified: boolean; sourceName: string; newPublisher: boolean } | null` (**champ ajouté**, lu par T26 pour les variantes M5).
  - `ValidateOptions = { conformanceOnly?: boolean; wrap?: WrapStep }`, `WrapStep = (step: { argv: string[]; cwd: string; writable: string[] }) => { argv: string[]; env: Record<string, string> }` (`packages/devkit`).
  - `type SandboxedValidator = (dir: string) => Promise<ValidationReport>` ; `createSandboxedValidator(deps: { probe(): SandboxProbe; allowUnsandboxed(): boolean; toolchainDir: string; workRoot: string }): SandboxedValidator`.
  - `type InstallDeps = { market: MarketService; store: ComponentStore; registry: RegistryPort; validate: SandboxedValidator; tmpRoot: string; now: () => number }` ; `installFromMarket(deps: InstallDeps, input: { sourceId: string; id: string; version: string }): Promise<MarketInstallResult>`.
  - `setInstanceHash(doc: LoroDoc, instanceId: string, hash: string | null): void` (`@kibo/core`).
  - `createMemoryComponentStore(): ComponentStore & { puts: number }` (tests).

- [ ] **Step 1: Test de `setInstanceHash`**

Ajouter à `packages/core/src/instances.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { addInstance, addPage, createProjectDoc, listInstances, setInstanceHash } from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

describe("setInstanceHash", () => {
  test("records the approved hash of a non builtin instance", () => {
    const doc = createProjectDoc(meta);
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const inst = addInstance(doc, { pageId: page.id, component: "burndown@0.1.0" });
    expect(listInstances(doc)[0]?.componentHash).toBeNull();
    setInstanceHash(doc, inst.id, "a".repeat(64));
    expect(listInstances(doc)[0]?.componentHash).toBe("a".repeat(64));
  });

  test("refuses an unknown instance and a malformed hash", () => {
    const doc = createProjectDoc(meta);
    expect(() => setInstanceHash(doc, "nope", "a".repeat(64))).toThrow("NOT_FOUND");
    const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
    const inst = addInstance(doc, { pageId: page.id, component: "burndown@0.1.0" });
    expect(() => setInstanceHash(doc, inst.id, "xyz")).toThrow("INVALID_INPUT");
  });
});
```

Run: `bun test packages/core/src/instances.test.ts`
Expected: FAIL avec « setInstanceHash is not exported ».

- [ ] **Step 2: Implémenter `setInstanceHash`**

Ajouter à `packages/core/src/instances.ts` :
```ts
export function setInstanceHash(doc: LoroDoc, id: string, hash: string | null): void {
  const current = instances(doc).get(id);
  if (current === undefined) throw new KiboError("NOT_FOUND", `instance ${id} not found`);
  const parsed = Instance.safeParse({ ...Instance.parse(current), componentHash: hash });
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  instances(doc).set(id, parsed.data);
  doc.commit();
}
```
Si la phase 4 stocke une instance comme `LoroMap` (données d'instance, spec B §3.5), écrire le champ par `instanceMap(doc, id).set("componentHash", hash)` avec la même validation.

Run: `bun test packages/core/src/instances.test.ts`
Expected: PASS.

- [ ] **Step 3: Test des options de `validateComponent`**

`packages/devkit/src/validate-options.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "./scaffold";
import { validateComponent } from "./validate";

let root: string;
let dir: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "kibo-devkit-"));
  dir = join(root, "burndown");
  await scaffold({ dir, id: "burndown", kind: "widget", server: false });
  writeFileSync(
    join(dir, "component.test.tsx"),
    'import { expect, test } from "bun:test";\ntest("publisher test", () => expect(1).toBe(2));\n',
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("conformanceOnly ignores the publisher tests and runs the generic suite", async () => {
  const report = await validateComponent(dir, { conformanceOnly: true });
  expect(report.tests.ok).toBe(true);
  expect(report.conformance.ok).toBe(true);
  expect(report.ok).toBe(true);
});

test("without conformanceOnly the publisher tests run", async () => {
  const report = await validateComponent(dir);
  expect(report.ok).toBe(false);
});

test("wrap is applied to every subprocess with a writable work dir", async () => {
  const steps: { argv: string[]; cwd: string; writable: string[] }[] = [];
  const report = await validateComponent(dir, {
    conformanceOnly: true,
    wrap: (step) => {
      steps.push(step);
      return { argv: step.argv, env: { PATH: process.env.PATH ?? "" } };
    },
  });
  expect(report.ok).toBe(true);
  expect(steps.length).toBeGreaterThanOrEqual(2);
  for (const s of steps) expect(s.writable.length).toBe(1);
});
```

Run: `bun test packages/devkit/src/validate-options.test.ts`
Expected: FAIL (le test de l'éditeur fait échouer le rapport, `wrap` n'est jamais appelé).

- [ ] **Step 4: Implémenter les options**

`packages/devkit/src/run-step.ts` :
```ts
export type WrapStep = (step: { argv: string[]; cwd: string; writable: string[] }) => {
  argv: string[];
  env: Record<string, string>;
};

export type StepResult = { code: number; stdout: string; stderr: string };

export async function runStep(
  step: { argv: string[]; cwd: string; writable: string[] },
  wrap: WrapStep | undefined,
): Promise<StepResult> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
  );
  const wrapped = wrap ? wrap(step) : { argv: step.argv, env: inherited };
  const proc = Bun.spawn(wrapped.argv, { cwd: step.cwd, env: wrapped.env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}
```

`packages/devkit/src/conformance-entry.ts` :
```ts
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeConformanceEntry(input: { componentDir: string; workDir: string; toolchainDir: string }): string {
  mkdirSync(input.workDir, { recursive: true, mode: 0o700 });
  symlinkSync(join(input.toolchainDir, "node_modules"), join(input.workDir, "node_modules"), "dir");
  const file = join(input.workDir, "conformance.test.tsx");
  const manifest = JSON.stringify(join(input.componentDir, "kibo.component.json"));
  const ui = JSON.stringify(join(input.componentDir, "ui.tsx"));
  writeFileSync(
    file,
    [
      'import { ComponentManifest } from "@kibo/schema";',
      'import { runConformance } from "@kibo/sdk/conformance";',
      `import manifestJson from ${manifest} with { type: "json" };`,
      `import { Component } from ${ui};`,
      "runConformance({ manifest: ComponentManifest.parse(manifestJson), Component });",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  return file;
}
```

Dans `packages/devkit/src/validate.ts` :
- signature `validateComponent(dir: string, opts: ValidateOptions = {}): Promise<ValidationReport>` avec `export type ValidateOptions = { conformanceOnly?: boolean; wrap?: WrapStep }` ;
- au début, `const workDir = mkdtempSync(join(tmpdir(), "kibo-validate-"))` supprimé dans un `finally` ;
- chaque `Bun.spawn(argv, { cwd })` existant (typecheck `tsc --noEmit`, build, `bun test --preload restrict.ts`) devient `runStep({ argv, cwd, writable: [workDir] }, opts.wrap)`, et le build écrit sa sortie dans `workDir` ;
- l'étape de tests devient, quand `opts.conformanceOnly` est vrai :
```ts
const entry = writeConformanceEntry({ componentDir: dir, workDir: join(workDir, "conformance"), toolchainDir: toolchainDir() });
const result = await runStep(
  { argv: [bunBinary(), "test", "--preload", restrictPreload(), entry], cwd: join(workDir, "conformance"), writable: [workDir] },
  opts.wrap,
);
```
les tests de l'éditeur (`*.test.ts(x)` du dossier) ne sont alors jamais passés à `bun test` ; `report.tests` et `report.conformance` reprennent le résultat de cette exécution.

Run: `bun test packages/devkit/src/validate-options.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Tests de l'installation**

`packages/daemon/src/testing/memory-component-store.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { type SourceFile, sourceHash } from "@kibo/trust";
import type { ComponentStore } from "../components/component-store";

export function createMemoryComponentStore(): ComponentStore & { puts: number; entries(): string[] } {
  const entries = new Map<string, SourceFile[]>();
  const store = {
    puts: 0,
    async put(input: { id: string; version: string; files: SourceFile[] }) {
      store.puts += 1;
      const hash = await sourceHash(input.files);
      entries.set(`${input.id}@${input.version}#${hash}`, input.files);
      return { hash, dir: `/memory/${input.id}/${input.version}/${hash}` };
    },
    async remove(id: string, version: string, hash: string) {
      entries.delete(`${id}@${version}#${hash}`);
    },
    async readSources(id: string, version: string, hash: string) {
      const files = entries.get(`${id}@${version}#${hash}`);
      if (!files) throw new KiboError("NOT_FOUND", `${id}@${version}`);
      return files;
    },
    entries: () => [...entries.keys()],
  };
  return store;
}
```

`packages/daemon/src/market/install.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolchainDir } from "@kibo/devkit/toolchain";
import { sha256Hex, toBase64, utf8 } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { detectSandbox, realDetectDeps } from "../sandbox/detect";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryComponentStore } from "../testing/memory-component-store";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { installFromMarket } from "./install";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { createSandboxedValidator } from "./sandboxed-validator";

const probe = await detectSandbox(realDetectDeps(), process.execPath);
if (process.env.KIBO_REQUIRE_OS_SANDBOX === "1") expect(probe.available).toBe(true);

let fake: FakeMarket;
let home: string;
let market: MarketService;
let registry: ReturnType<typeof createMemoryRegistry>;
let store: ReturnType<typeof createMemoryComponentStore>;

const validator = (available = true) =>
  createSandboxedValidator({
    probe: () => (available ? probe : { ...probe, available: false, reason: "test" }),
    allowUnsandboxed: () => available && !probe.available,
    toolchainDir: toolchainDir(),
    workRoot: join(home, "tmp"),
  });

const deps = (available = true) => ({
  market,
  store,
  registry: registry.port,
  validate: validator(available),
  tmpRoot: join(home, "tmp"),
  now: () => 42,
});

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-install-"));
  fake = await startFakeMarket();
  registry = createMemoryRegistry();
  store = createMemoryComponentStore();
  market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: registry.port,
    now: () => 42,
    notify: mock(async () => {}),
    log: mock(() => {}),
  });
});
afterEach(() => {
  fake.stop();
  rmSync(home, { recursive: true, force: true });
});

async function publish(files?: Record<string, string>) {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0", files, manifest: { title: "Burndown" } });
  await fake.publish(made.bytes);
  await market.addSource({ url: fake.url, publicKey: fake.publicKey });
  return made;
}

const nothingWritten = () => {
  expect(store.puts).toBe(0);
  expect(registry.port.installed()).toEqual([]);
  expect(readdirSync(join(home, "tmp"), { withFileTypes: true }).length).toBe(0);
};

describe("installFromMarket", () => {
  test("installs a verified package without trust and pins its publisher", async () => {
    const made = await publish();
    const result = await installFromMarket(deps(), { sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(result.hash).toBe(made.pkg.hash);
    expect(result.preview.market).toEqual({
      publisherName: made.publisher.name,
      verified: true,
      sourceName: "Équipe",
      newPublisher: true,
    });
    const v = registry.port.get("burndown", "0.1.0");
    expect(v).toMatchObject({
      origin: "marketplace",
      trust: null,
      approvedHash: null,
      hash: made.pkg.hash,
      source: { sourceId: "equipe", publisherKey: made.publisher.keys.publicKey },
      revoked: null,
    });
    expect(store.entries()).toEqual([`burndown@0.1.0#${made.pkg.hash}`]);
    expect((await market.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).newPublisher).toBe(false);
    expect(readdirSync(join(home, "tmp")).length).toBe(0);
  });

  test("a tampered file is refused and nothing is written", async () => {
    const made = await publish();
    const first = made.pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    const content = utf8("export const Component = () => null;\n");
    const altered = {
      ...made.pkg,
      files: [{ ...first, content: toBase64(content), sha256: await sha256Hex(content) }, ...made.pkg.files.slice(1)],
    };
    fake.tamper("packages/burndown/0.1.0.kpkg", utf8(JSON.stringify(altered)));
    await expect(installFromMarket(deps(), { sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "HASH_MISMATCH",
    );
    nothingWritten();
  });

  test("a component that does not typecheck is refused and nothing is written", async () => {
    await publish({ "ui.tsx": 'export const Component = () => { const n: number = "x"; return <div>{n}</div>; };\n' });
    await expect(installFromMarket(deps(), { sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "VALIDATION_FAILED",
    );
    nothingWritten();
  });

  test("without OS isolation and without the override nothing is written", async () => {
    await publish();
    await expect(
      installFromMarket(deps(false), { sourceId: "equipe", id: "burndown", version: "0.1.0" }),
    ).rejects.toThrow("SANDBOX_UNAVAILABLE");
    nothingWritten();
  });

  test("a registry failure removes the stored copy", async () => {
    await publish();
    const failing = {
      ...deps(),
      registry: {
        ...registry.port,
        put: () => {
          throw new Error("disk full");
        },
      },
    };
    await expect(installFromMarket(failing, { sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "disk full",
    );
    expect(store.entries()).toEqual([]);
  });

  test("the pin survives an uninstall", async () => {
    const made = await publish();
    await installFromMarket(deps(), { sourceId: "equipe", id: "burndown", version: "0.1.0" });
    await store.remove("burndown", "0.1.0", made.pkg.hash);
    const detail = await market.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(detail.pinnedPublisher).toBe(made.publisher.keys.publicKey);
  });
});
```
La désinstallation réelle (`uninstallComponent`, phase 4) ne touche ni `market_pins` ni le cache : le dernier test le vérifie au niveau du service ; `uninstallComponent` n'est pas modifié.

Hypothèse v0.6 (vérifiée en T0) : `packages/devkit` exporte `./toolchain` ; `packages/daemon/src/sandbox/detect.ts` (T8) exporte `realDetectDeps(): DetectDeps` (dépendances réelles : `process.platform`, `Bun.which`, `Bun.spawn`).

Run: `bun test packages/daemon/src/market/install.test.ts`
Expected: FAIL avec « Cannot find module './install' ».

- [ ] **Step 6: Implémenter le validateur et l'installation**

`packages/daemon/src/market/sandboxed-validator.ts` :
```ts
import type { ValidationReport } from "@kibo/devkit";
import { validateComponent } from "@kibo/devkit";
import type { SandboxProbe } from "../sandbox/detect";
import { wrapCommand } from "../sandbox/os-sandbox";

export type SandboxedValidator = (dir: string) => Promise<ValidationReport>;

export function createSandboxedValidator(deps: {
  probe(): SandboxProbe;
  allowUnsandboxed(): boolean;
  toolchainDir: string;
  workRoot: string;
}): SandboxedValidator {
  return async (dir) => {
    const probe = deps.probe();
    const allow = deps.allowUnsandboxed();
    wrapCommand(probe, { runtime: process.execPath, args: [], readOnly: [], tmpDir: deps.workRoot, env: {} }, allow);
    return validateComponent(dir, {
      conformanceOnly: true,
      wrap: (step) => {
        const [runtime, ...args] = step.argv;
        if (runtime === undefined) throw new Error("empty validation command");
        const tmpDir = step.writable[0] ?? deps.workRoot;
        return wrapCommand(
          probe,
          {
            runtime,
            args,
            readOnly: [
              { host: deps.toolchainDir, guest: deps.toolchainDir },
              { host: dir, guest: dir },
            ],
            tmpDir,
            env: { HOME: tmpDir, PATH: "/usr/bin:/bin", NO_COLOR: "1" },
          },
          allow,
        );
      },
    });
  };
}
```
Le premier appel à `wrapCommand` lève `SANDBOX_UNAVAILABLE` **avant** toute écriture quand l'isolation manque et n'est pas autorisée.

`packages/daemon/src/market/install.ts` :
```ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { KiboError, type MarketInstallResult } from "@kibo/schema";
import type { SourceFile } from "@kibo/trust";
import type { ComponentStore } from "../components/component-store";
import { buildTrustPreview } from "../components/trust-preview";
import type { MarketService, RegistryPort } from "./market-service";
import type { SandboxedValidator } from "./sandboxed-validator";

export type InstallDeps = {
  market: MarketService;
  store: ComponentStore;
  registry: RegistryPort;
  validate: SandboxedValidator;
  tmpRoot: string;
  now: () => number;
};

function writeSources(dir: string, files: SourceFile[]): void {
  for (const f of files) {
    const target = join(dir, f.path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, f.bytes, { mode: 0o600 });
  }
}

const failures = (report: Awaited<ReturnType<SandboxedValidator>>): string =>
  [
    report.typecheck.ok ? null : "typecheck",
    report.tests.ok ? null : "tests",
    report.conformance.ok ? null : "conformance",
    report.permissions.missing.length ? `missing permissions: ${report.permissions.missing.join(", ")}` : null,
  ]
    .filter((x) => x !== null)
    .join("; ");

export async function installFromMarket(
  deps: InstallDeps,
  input: { sourceId: string; id: string; version: string },
): Promise<MarketInstallResult> {
  const { pkg, files, newPublisher } = await deps.market.fetchVerified(input);
  const existing = deps.registry.get(input.id, input.version);
  if (existing && existing.hash !== pkg.hash) {
    throw new KiboError("VERSION_EXISTS", `${input.id}@${input.version} is installed with another hash`);
  }
  const hit = deps.market.search({ query: input.id, sourceId: input.sourceId }).find((h) => h.id === input.id);
  const preview = () =>
    ({
      ...buildTrustPreview({ id: input.id, version: input.version, hash: pkg.hash, manifest: pkg.manifest, origin: "marketplace" }),
      market: {
        publisherName: pkg.publisher.name,
        verified: hit?.publisher.publicKey === pkg.publisher.publicKey ? hit.publisher.verified : false,
        sourceName: hit?.sourceName ?? input.sourceId,
        newPublisher,
      },
    });
  if (existing) return { id: input.id, version: input.version, hash: pkg.hash, preview: preview() };

  mkdirSync(deps.tmpRoot, { recursive: true, mode: 0o700 });
  const dir = join(deps.tmpRoot, crypto.randomUUID());
  mkdirSync(dir, { mode: 0o700 });
  try {
    writeSources(dir, files);
    const report = await deps.validate(dir);
    if (!report.ok) throw new KiboError("VALIDATION_FAILED", `${input.id}@${input.version}: ${failures(report)}`);
    const stored = await deps.store.put({ id: input.id, version: input.version, files });
    if (stored.hash !== pkg.hash) {
      await deps.store.remove(input.id, input.version, stored.hash);
      throw new KiboError("HASH_MISMATCH", `stored hash ${stored.hash} differs from ${pkg.hash}`);
    }
    try {
      deps.registry.put(input.id, pkg.manifest.title, {
        version: input.version,
        hash: pkg.hash,
        origin: "marketplace",
        trust: null,
        approvedHash: null,
        granted: { reads: [], writes: [], data: false, net: [] },
        publishedAt: Date.parse(pkg.publishedAt),
        source: { sourceId: input.sourceId, publisherKey: pkg.publisher.publicKey },
        revoked: null,
      });
    } catch (e) {
      await deps.store.remove(input.id, input.version, stored.hash);
      throw e;
    }
    if (newPublisher) deps.market.pinPublisher(input.sourceId, input.id, pkg.publisher.publicKey);
    return { id: input.id, version: input.version, hash: pkg.hash, preview: preview() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
```
`granted` reste vide jusqu'à `approveComponent` (écran 30), qui écrit les permissions approuvées comme pour un composant local (spec B §7.5). Si la phase 4 ajoute des champs à `GrantedPermissions` (`secrets`, `mcp` en phase 5), les initialiser vides ici.

Run: `bun test packages/daemon/src/market/install.test.ts`
Expected: PASS (6 tests). Sur un poste de dev dont la sonde échoue, et seulement dans ce fichier de test, le validateur est autorisé à tourner sans isolation (`allowUnsandboxed` = sonde indisponible) ; en CI `KIBO_REQUIRE_OS_SANDBOX=1` impose la sonde. En production, `allowUnsandboxed` est le réglage de Paramètres › Sécurité (T12), désactivé par défaut.

- [ ] **Step 7: `componentHash` écrit par le démon et RPC**

`packages/daemon/src/service-component-hash.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Instance, ProjectMeta, ProjectSnapshot } from "@kibo/schema";
import { createTestService, type TestService } from "./testing/test-service";

let home: string;
let svc: TestService;
const ctx = { sessionHash: "a".repeat(64), remote: false };

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-hash-"));
  svc = await createTestService(home);
  svc.registry.put("burndown", "Burndown", {
    version: "0.1.0",
    hash: "b".repeat(64),
    origin: "marketplace",
    trust: "sandboxed",
    approvedHash: "b".repeat(64),
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 0,
    source: null,
    revoked: null,
  });
});
afterEach(() => {
  svc.close();
  rmSync(home, { recursive: true, force: true });
});

test("adding a non builtin instance records its approved hash, builtins stay null", async () => {
  const meta = (await svc.handle({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" }, ctx)) as ProjectMeta;
  const page = (await svc.handle(
    { method: "command", projectId: meta.id, command: { method: "addPage", title: "T", kind: "dashboard" } },
    ctx,
  )) as { id: string };
  const custom = (await svc.handle(
    { method: "command", projectId: meta.id, command: { method: "addInstance", pageId: page.id, component: "burndown@0.1.0" } },
    ctx,
  )) as Instance;
  await svc.handle(
    { method: "command", projectId: meta.id, command: { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" } },
    ctx,
  );
  const snap = (await svc.handle({ method: "getProject", projectId: meta.id }, ctx)) as ProjectSnapshot;
  expect(snap.instances.find((i) => i.id === custom.id)?.componentHash).toBe("b".repeat(64));
  expect(snap.instances.find((i) => i.component.startsWith("kanban@"))?.componentHash).toBeNull();
});
```
Hypothèse v0.6 (vérifiée en T0) : `testing/test-service.ts` (phase 4) crée un service complet sur un `KIBO_HOME` temporaire et expose `registry` et `handle`.

Dans `service.ts`, après `executeProjectCommand` pour `addInstance` et `setInstanceComponent` :
```ts
const ref = command.component;
const [componentId, componentVersion] = ref.split("@");
if (componentId && componentVersion && !BUILTIN_IDS.includes(componentId)) {
  const instanceId = command.method === "addInstance" ? (result as Instance).id : command.instanceId;
  setInstanceHash(doc, instanceId, registry.get(componentId, componentVersion)?.approvedHash ?? null);
}
```
avant la persistance du doc. Dans `market/rpc.ts`, `createMarketRpc(market, install)` reçoit en second argument `(input) => installFromMarket(installDeps, input)` et traite `installFromMarket`.

Run: `bun test packages/daemon/src/service-component-hash.test.ts packages/daemon/src/market`
Expected: PASS.

- [ ] **Step 8: Vérifications**

Run: `bun run check && bun run typecheck && bun test packages components`
Expected: aucune erreur ; les tests existants de `devkit` passent sans changement de leurs attentes.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/instances.ts packages/core/src/instances.test.ts packages/devkit/src/run-step.ts packages/devkit/src/conformance-entry.ts packages/devkit/src/validate.ts packages/devkit/src/validate-options.test.ts packages/daemon/src/market/install.ts packages/daemon/src/market/install.test.ts packages/daemon/src/market/sandboxed-validator.ts packages/daemon/src/market/rpc.ts packages/daemon/src/testing/memory-component-store.ts packages/daemon/src/service.ts packages/daemon/src/service-component-hash.test.ts
git commit -m "feat(daemon): installation depuis la marketplace"
```

---

### Task 21: Client de sync du démon

Vague 5, tâche à risque (relue aussi par `kibo-lead`). Spec G §3.2, §4, §6, §8 ; décisions 3, 4, 8, 9, 17. Review Focus 1.

**Files:**
- Create: `packages/daemon/src/sync/sync-db.ts`, `packages/daemon/src/sync/sync-db.test.ts`
- Create: `packages/daemon/src/sync/device-keys.ts`
- Create: `packages/daemon/src/sync/sync-client.ts`
- Create: `packages/daemon/src/sync/project-info.ts`
- Create: `packages/daemon/src/sync/rpc.ts`
- Create: `packages/daemon/src/testing/sync-harness.ts`
- Create: `packages/daemon/src/sync/sync-client.test.ts`
- Modify: `packages/daemon/src/service.ts` (registre `ProjectHostRegistry`, accès, verrou, `ProjectSnapshot.sync`)
- Modify: `packages/daemon/src/main.ts` (création et démarrage du `SyncClient`)
- Modify: `packages/daemon/package.json` (`devDependencies` : `"@kibo/sync-server": "workspace:*"`, décision 26)

**Interfaces:**
- Consumes: `ProjectSync`, `ProjectSyncOptions`, `SyncTransport`, `SyncSocket`, `assertSyncUrl`, `createWebSocketTransport` (T18) ; `ClientFrame`, `ServerFrame`, `JoinRequest`, `JoinResponse`, `challengePayload`, `SYNC_LIMITS`, `CLOSE_CODES`, `SyncStatus`, `SyncProjectStatus`, `ProjectSyncInfo`, `ProjectAccess`, `MemberInfo`, `Role`, `RejectCode` (T4) ; `generateKeyPair`, `signBytes`, `toBase64`, `fromBase64`, `KeyPair` (T2) ; `readMembers`, `getKeyAllocator` (T6, T7) ; `startTestSyncServer` (T17) ; `SecretStore`, `MemorySecretStore`, `SecretName` (phase 5) ; `openLocalSettings` (T1) ; `RpcContext` (T9).
- Produces :
```ts
export type SyncConfig = { serverUrl: string; caFile: string | null; userId: string; deviceId: string; displayName: string };
export type SyncProjectRow = { projectId: string; enabled: boolean; role: Role; lastServerVersion: Uint8Array | null;
  lastSyncAt: number | null; lastError: string | null; accessRevoked: boolean };
export type SyncDb = { config(): SyncConfig | null; setConfig(config: SyncConfig | null): void;
  project(projectId: string): SyncProjectRow | null; upsertProject(row: SyncProjectRow): void;
  removeProject(projectId: string): void; projects(): SyncProjectRow[] };
export function openSyncDb(db: Database): SyncDb;
export function createDeviceKeys(secrets: SecretStore): Promise<KeyPair>;
export function loadDeviceKeys(secrets: SecretStore): Promise<KeyPair>;          // UNAUTHORIZED si absente
export function clearDeviceKeys(secrets: SecretStore): Promise<void>;
export type SyncClientDeps = { db: SyncDb; secrets: SecretStore; hosts: ProjectHostRegistry; transport: SyncTransport;
  fetchImpl: typeof fetch; readFile(path: string): Promise<string>; now(): number; random(): number;
  setTimer(fn: () => void, ms: number): () => void; emit(event: DaemonEvent): void;
  log(message: string, error?: unknown): void; backoff?: { minMs: number; maxMs: number } };
export function backoffDelay(attempt: number, random: number, limits: { minMs: number; maxMs: number }): number;
export class SyncClient { /* contrat « Démon » + */ membersOf(projectId: string): MemberInfo[];
  addDevice(): Promise<{ code: string; expiresAt: number }>; listDevices(): Promise<DeviceInfo[]>;
  revokeDevice(deviceId: string): Promise<void> }
export type ProjectHostRegistry = { /* contrat « Démon » + */ mutate(projectId: string, fn: (doc: LoroDoc) => void): void };
export function projectSyncInfo(input: { row: SyncProjectRow | null; doc: LoroDoc; members: MemberInfo[] }): ProjectSyncInfo;
export function handleSyncRpc(client: SyncClient, req: RpcRequest, ctx: RpcContext): Promise<{ handled: true; result: unknown } | { handled: false }>;
export type HarnessDaemon = { home: string; service: Service; client: SyncClient; secrets: MemorySecretStore; syncDb: SyncDb;
  opens(): number; stop(): void };
export function startSyncHarness(opts: { daemons: number }): Promise<SyncHarness>;
export type SyncHarness = { server: TestSyncServer; caFile: string; daemons: HarnessDaemon[];
  connect(i: number, name: string): Promise<void>; shareRaw(i: number, projectId: string): Promise<void>;
  inviteRaw(i: number, projectId: string, role: "editor" | "viewer"): Promise<string>;
  joinRaw(j: number, code: string): Promise<string>; stopServer(): Promise<void>; startServer(): Promise<void>;
  waitUntil(predicate: () => boolean, timeoutMs?: number): Promise<void>; stop(): Promise<void> };
```
- Changement de contrat signalé : `ProjectHostRegistry.mutate` (écriture interne qui persiste, émet et déclenche l'envoi, refusée si l'accès n'est pas `write`) ; `startTestSyncServer(opts?: TestSyncServerOptions)` (T17) accepte `dataDir`, `port`, `cert` et renvoie `cert`, et `stop({ keepData: true })` garde le dossier, pour relancer le serveur sur le même port, le même dossier et le même certificat.
- Hypothèse v0.6 (vérifiée en T0) : `createService(store, opts)` renvoie un objet dont on peut étendre le type `Service` ; la table `project_settings` est accessible par `projectSettings.get(projectId, key)`.

- [ ] **Step 1: Écrire les tests de `SyncDb`**

`packages/daemon/src/sync/sync-db.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { openSyncDb } from "./sync-db";

test("stores a single server configuration", () => {
  const db = openSyncDb(new Database(":memory:"));
  expect(db.config()).toBeNull();
  const config = { serverUrl: "wss://sync.kibo.test", caFile: null, userId: "u1", deviceId: "d1", displayName: "Adam" };
  db.setConfig(config);
  db.setConfig({ ...config, displayName: "Adam B." });
  expect(db.config()).toEqual({ ...config, displayName: "Adam B." });
  db.setConfig(null);
  expect(db.config()).toBeNull();
});

test("round-trips project rows with their server version", () => {
  const db = openSyncDb(new Database(":memory:"));
  const row = {
    projectId: "p1",
    enabled: true,
    role: "editor" as const,
    lastServerVersion: new Uint8Array([1, 2, 3]),
    lastSyncAt: 10,
    lastError: null,
    accessRevoked: false,
  };
  db.upsertProject(row);
  db.upsertProject({ ...row, lastSyncAt: 20 });
  expect(db.project("p1")).toEqual({ ...row, lastSyncAt: 20 });
  expect(db.projects()).toHaveLength(1);
  db.removeProject("p1");
  expect(db.project("p1")).toBeNull();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/daemon/src/sync/sync-db.test.ts`
Expected: FAIL « Cannot find module './sync-db' ».

- [ ] **Step 3: Implémenter `sync-db.ts` et `device-keys.ts`**

`packages/daemon/src/sync/sync-db.ts` :
```ts
import type { Database } from "bun:sqlite";
import { Role } from "@kibo/schema";

export type SyncConfig = { serverUrl: string; caFile: string | null; userId: string; deviceId: string; displayName: string };
export type SyncProjectRow = {
  projectId: string;
  enabled: boolean;
  role: Role;
  lastServerVersion: Uint8Array | null;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: boolean;
};
export type SyncDb = {
  config(): SyncConfig | null;
  setConfig(config: SyncConfig | null): void;
  project(projectId: string): SyncProjectRow | null;
  upsertProject(row: SyncProjectRow): void;
  removeProject(projectId: string): void;
  projects(): SyncProjectRow[];
};

type ProjectRecord = {
  projectId: string;
  enabled: number;
  role: string;
  lastServerVersion: Uint8Array | null;
  lastSyncAt: number | null;
  lastError: string | null;
  accessRevoked: number;
};

const toRow = (r: ProjectRecord): SyncProjectRow => ({
  projectId: r.projectId,
  enabled: r.enabled === 1,
  role: Role.parse(r.role),
  lastServerVersion: r.lastServerVersion ? new Uint8Array(r.lastServerVersion) : null,
  lastSyncAt: r.lastSyncAt,
  lastError: r.lastError,
  accessRevoked: r.accessRevoked === 1,
});

export function openSyncDb(db: Database): SyncDb {
  db.exec(
    "CREATE TABLE IF NOT EXISTS sync_config (id INTEGER PRIMARY KEY CHECK (id = 1), serverUrl TEXT NOT NULL, " +
      "caFile TEXT, userId TEXT NOT NULL, deviceId TEXT NOT NULL, displayName TEXT NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS sync_projects (projectId TEXT PRIMARY KEY, enabled INTEGER NOT NULL, role TEXT NOT NULL, " +
      "lastServerVersion BLOB, lastSyncAt INTEGER, lastError TEXT, accessRevoked INTEGER NOT NULL)",
  );
  const selectProject = db.query("SELECT * FROM sync_projects WHERE projectId = $projectId");
  return {
    config: () =>
      (db.query("SELECT serverUrl, caFile, userId, deviceId, displayName FROM sync_config WHERE id = 1").get() as
        | SyncConfig
        | null) ?? null,
    setConfig: (config) => {
      db.exec("DELETE FROM sync_config");
      if (!config) return;
      db.query(
        "INSERT INTO sync_config (id, serverUrl, caFile, userId, deviceId, displayName) " +
          "VALUES (1, $serverUrl, $caFile, $userId, $deviceId, $displayName)",
      ).run(config);
    },
    project: (projectId) => {
      const r = selectProject.get({ projectId }) as ProjectRecord | null;
      return r ? toRow(r) : null;
    },
    upsertProject: (row) => {
      db.query(
        "INSERT INTO sync_projects VALUES ($projectId, $enabled, $role, $lastServerVersion, $lastSyncAt, $lastError, $accessRevoked) " +
          "ON CONFLICT(projectId) DO UPDATE SET enabled = excluded.enabled, role = excluded.role, " +
          "lastServerVersion = excluded.lastServerVersion, lastSyncAt = excluded.lastSyncAt, " +
          "lastError = excluded.lastError, accessRevoked = excluded.accessRevoked",
      ).run({ ...row, enabled: row.enabled ? 1 : 0, accessRevoked: row.accessRevoked ? 1 : 0 });
    },
    removeProject: (projectId) => {
      db.query("DELETE FROM sync_projects WHERE projectId = $projectId").run({ projectId });
    },
    projects: () => (db.query("SELECT * FROM sync_projects ORDER BY projectId").all() as ProjectRecord[]).map(toRow),
  };
}
```
La base est ouverte sur `Store.db` (T1), fichier `kibo.db` déjà en `0600`.

`packages/daemon/src/sync/device-keys.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { generateKeyPair, type KeyPair } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../secrets/secret-store";

const NAME = "sync:device";
const Stored = z.object({ publicKey: z.string().min(1), privateKey: z.string().min(1) });

export async function createDeviceKeys(secrets: SecretStore): Promise<KeyPair> {
  const keys = await generateKeyPair();
  await secrets.set(NAME, JSON.stringify(keys));
  return keys;
}

export async function loadDeviceKeys(secrets: SecretStore): Promise<KeyPair> {
  const raw = await secrets.get(NAME);
  if (raw === null) throw new KiboError("UNAUTHORIZED", "device key is missing from the secret store");
  const parsed = Stored.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new KiboError("UNAUTHORIZED", "device key in the secret store is malformed");
  return parsed.data;
}

export async function clearDeviceKeys(secrets: SecretStore): Promise<void> {
  await secrets.delete(NAME);
}
```

- [ ] **Step 4: Vérifier**

Run: `bun test packages/daemon/src/sync/sync-db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Registre de projets dans le service**

Dans `packages/daemon/src/service.ts`, le service expose `hosts: ProjectHostRegistry` et applique l'accès avant toute commande. Ajouts (le reste du service est inchangé) :
```ts
export type Service = {
  handle(req: RpcRequest, ctx: RpcContext): Promise<unknown>;
  onChange(listener: (projectId: string | null) => void): () => void;
  hosts: ProjectHostRegistry;
};

  const access = new Map<string, ProjectAccess>();
  const locked = new Set<string>();
  const localListeners = new Set<(projectId: string) => void>();
  const touchedLocally = (projectId: string) => {
    for (const l of localListeners) l(projectId);
  };
  const assertWritable = (projectId: string) => {
    if (locked.has(projectId)) throw new KiboError("CONFLICT", `project ${projectId} is being shared`);
    const a = access.get(projectId) ?? "write";
    if (a !== "write") throw new KiboError("FORBIDDEN", `project ${projectId} is ${a}`);
  };
  const hosts: ProjectHostRegistry = {
    host: (projectId) => ({
      doc: () => project(projectId),
      applyRemote: (bytes) => {
        const doc = project(projectId);
        doc.import(bytes);
        persist(projectDocId(projectId), doc);
        emit(projectId);
      },
      replaceDoc: (doc) => {
        project(projectId);
        projects.set(projectId, doc);
        persist(projectDocId(projectId), doc);
        emit(projectId);
      },
    }),
    projectIds: () => [...projects.keys()],
    setAccess: (projectId, a) => {
      access.set(projectId, a);
      emit(projectId);
    },
    setLocked: (projectId, isLocked) => {
      if (isLocked) locked.add(projectId);
      else locked.delete(projectId);
    },
    onLocalChange: (listener) => {
      localListeners.add(listener);
      return () => localListeners.delete(listener);
    },
    mutate: (projectId, fn) => {
      const a = access.get(projectId) ?? "write";
      if (a !== "write") throw new KiboError("FORBIDDEN", `project ${projectId} is ${a}`);
      const doc = project(projectId);
      fn(doc);
      persist(projectDocId(projectId), doc);
      emit(projectId);
      touchedLocally(projectId);
    },
    addJoinedProject: (doc, folder) => {
      const meta = { ...getProjectMeta(doc), folder };
      registerProject(workspace, meta);
      projects.set(meta.id, doc);
      persist(projectDocId(meta.id), doc);
      persist(WORKSPACE, workspace);
      emit(null);
      return meta;
    },
    localUser: () => opts.user,
  };
```
Dans le cas `command` : `assertWritable(req.projectId)` avant `executeProjectCommand`, puis `touchedLocally(req.projectId)` après `persist`. Dans le cas `getProject` : `{ ...readProject(doc), sync: opts.syncInfo?.(req.projectId, doc) ?? readProject(doc).sync }`, où `opts.syncInfo?: (projectId: string, doc: LoroDoc) => ProjectSyncInfo` est une nouvelle option de `createService`.

`packages/daemon/src/sync/project-info.ts` :
```ts
import { getKeyAllocator, readMembers } from "@kibo/core";
import type { MemberInfo, ProjectSyncInfo } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { SyncProjectRow } from "./sync-db";

export function projectSyncInfo(input: { row: SyncProjectRow | null; doc: LoroDoc; members: MemberInfo[] }): ProjectSyncInfo {
  const { row, doc } = input;
  const names = new Map(readMembers(doc).map((m) => [m.userId, m.name]));
  const members = input.members.length > 0
    ? input.members.map((m) => ({ ...m, name: names.get(m.userId) ?? m.name }))
    : readMembers(doc).map((m) => ({ ...m, role: "editor" as const }));
  if (!row) return { shared: false, keyAllocator: getKeyAllocator(doc), role: null, access: "write", members: [] };
  const access = row.accessRevoked ? "revoked" : row.role === "viewer" ? "read-only" : "write";
  return { shared: true, keyAllocator: getKeyAllocator(doc), role: row.role, access, members };
}
```

- [ ] **Step 6: Écrire le harnais d'intégration**

`packages/daemon/src/testing/sync-harness.ts` :
```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toBase64 } from "@kibo/trust";
import { startTestSyncServer } from "@kibo/sync-server/testing";
import { MemorySecretStore } from "../secrets/secret-store";
import { createService, type Service } from "../service";
import { openStore } from "../store";
import { createWebSocketTransport } from "../sync/transport";
import { projectSyncInfo } from "../sync/project-info";
import { SyncClient } from "../sync/sync-client";
import { openSyncDb, type SyncDb } from "../sync/sync-db";

type TestSyncServer = Awaited<ReturnType<typeof startTestSyncServer>>;
export type HarnessDaemon = {
  home: string;
  service: Service;
  client: SyncClient;
  secrets: MemorySecretStore;
  syncDb: SyncDb;
  opens(): number;
  stop(): void;
};
export type SyncHarness = {
  server: TestSyncServer;
  caFile: string;
  daemons: HarnessDaemon[];
  connect(i: number, name: string): Promise<void>;
  shareRaw(i: number, projectId: string): Promise<void>;
  inviteRaw(i: number, projectId: string, role: "editor" | "viewer"): Promise<string>;
  joinRaw(j: number, code: string): Promise<string>;
  stopServer(): Promise<void>;
  startServer(): Promise<void>;
  waitUntil(predicate: () => boolean, timeoutMs?: number): Promise<void>;
  stop(): Promise<void>;
};

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`condition not met within ${timeoutMs} ms`);
    await Bun.sleep(20);
  }
}

function startDaemon(user: string): HarnessDaemon {
  const home = mkdtempSync(join(tmpdir(), `kibo-sync-${user}-`));
  const store = openStore(home);
  const syncDb = openSyncDb(store.db);
  const secrets = new MemorySecretStore();
  const transport = createWebSocketTransport();
  let opened = 0;
  const counting = { open: (url: string, o: { ca: string | null }) => (opened++, transport.open(url, o)) };
  let client: SyncClient | null = null;
  const service = createService(store, {
    user,
    syncInfo: (projectId, doc) =>
      projectSyncInfo({ row: syncDb.project(projectId), doc, members: client?.membersOf(projectId) ?? [] }),
  });
  client = new SyncClient({
    db: syncDb,
    secrets,
    hosts: service.hosts,
    transport: counting,
    fetchImpl: fetch,
    readFile: (path) => Bun.file(path).text(),
    now: Date.now,
    random: Math.random,
    setTimer: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    emit: () => {},
    log: (message, error) => console.error(`[harness:${user}] ${message}`, error ?? ""),
    backoff: { minMs: 20, maxMs: 200 },
  });
  const c = client;
  return {
    home,
    service,
    client: c,
    secrets,
    syncDb,
    opens: () => opened,
    stop: () => {
      c.stop();
      store.close();
      rmSync(home, { recursive: true, force: true });
    },
  };
}

export async function startSyncHarness(opts: { daemons: number }): Promise<SyncHarness> {
  let server = await startTestSyncServer();
  const { dataDir, cert } = server;
  const port = new URL(server.url).port;
  const caFile = join(dataDir, "ca.pem");
  writeFileSync(caFile, server.caPem, { mode: 0o600 });
  const daemons = Array.from({ length: opts.daemons }, (_, i) => startDaemon(["adam", "lea", "sam"][i] ?? `user${i}`));
  const at = (i: number): HarnessDaemon => {
    const d = daemons[i];
    if (!d) throw new Error(`no daemon ${i}`);
    return d;
  };
  return {
    get server() {
      return server;
    },
    caFile,
    daemons,
    waitUntil,
    connect: async (i, name) => {
      const code = await server.inviteAccount(name);
      await at(i).client.connect({ serverUrl: server.url, code, deviceName: name, caFile });
    },
    shareRaw: async (i, projectId) => {
      const d = at(i);
      const doc = d.service.hosts.host(projectId).doc();
      await d.client.request(
        { type: "share", projectId, requestId: crypto.randomUUID(), name: projectId,
          snapshot: toBase64(doc.export({ mode: "snapshot" })) },
        "shared",
      );
      d.client.attachProject(projectId, "owner");
      await waitUntil(() => d.client.status().projects.some((p) => p.projectId === projectId && p.lastSyncAt !== null));
    },
    inviteRaw: async (i, projectId, role) => {
      const f = await at(i).client.request({ type: "invite", projectId, requestId: crypto.randomUUID(), role }, "invite-code");
      return f.code;
    },
    joinRaw: async (j, code) => {
      const d = at(j);
      const joined = await d.client.request({ type: "redeem", requestId: crypto.randomUUID(), code }, "joined");
      const { LoroDoc } = await import("loro-crdt");
      const doc = new LoroDoc();
      const got = new Promise<void>((resolve) => {
        const off = d.client.onFrame((f) => {
          if (f.type === "update" && f.projectId === joined.projectId) {
            doc.import(Uint8Array.from(Buffer.from(f.bytes, "base64")));
            off();
            resolve();
          }
        });
      });
      d.client.send({ type: "subscribe", projectId: joined.projectId, version: null });
      await got;
      d.client.send({ type: "unsubscribe", projectId: joined.projectId });
      d.service.hosts.addJoinedProject(doc, null);
      d.client.attachProject(joined.projectId, joined.role);
      return joined.projectId;
    },
    stopServer: () => server.stop({ keepData: true }),
    startServer: async () => {
      server = await startTestSyncServer({ dataDir, port: Number(port), cert });
    },
    stop: async () => {
      for (const d of daemons) d.stop();
      await server.stop();
    },
  };
}
```
`SyncClient.send(frame)` est public (envoi brut, `SYNC_OFFLINE` hors ligne) ; il sert au harnais et à T23.

- [ ] **Step 7: Écrire les tests d'intégration du client**

`packages/daemon/src/sync/sync-client.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTicket, listTickets } from "@kibo/core";
import { KiboError, type ProjectMeta, type RpcRequest } from "@kibo/schema";
import { revokeDevice } from "@kibo/sync-server";
import { generateKeyPair } from "@kibo/trust";
import { startSyncHarness, type SyncHarness } from "../testing/sync-harness";

let h: SyncHarness;
beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
});
afterEach(async () => {
  await h.stop();
});

const ctx = { sessionHash: "t", remote: false };
const rpc = (i: number, req: RpcRequest) => d(i).service.handle(req, ctx);
async function newProject(i: number, key = "KIB"): Promise<string> {
  const meta = (await rpc(i, { method: "createProject", name: "Kibo", key, folder: null, color: "#14B8A6" })) as ProjectMeta;
  return meta.id;
}
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const titles = (i: number, projectId: string) =>
  listTickets(d(i).service.hosts.host(projectId).doc()).map((t) => t.title);

describe("device authentication", () => {
  test("connects with an account code and stores the key only in the secret store", async () => {
    await h.connect(0, "Adam");
    const status = d(0).client.status();
    expect(status.state).toBe("online");
    expect(status.user?.name).toBe("Adam");
    const keys = JSON.parse((await d(0).secrets.get("sync:device")) ?? "{}") as { privateKey: string };
    const db = readFileSync(join(d(0).home, "kibo.db"));
    expect(db.includes(Buffer.from(keys.privateKey))).toBe(false);
    expect(db.includes(Buffer.from(keys.privateKey, "base64"))).toBe(false);
  });

  test("a device holding another key cannot authenticate", async () => {
    await h.connect(0, "Adam");
    d(0).client.stop();
    await d(0).secrets.set("sync:device", JSON.stringify(await generateKeyPair()));
    await d(0).client.start();
    await h.waitUntil(() => d(0).client.status().lastError !== null);
    expect(d(0).client.status().state).toBe("offline");
    expect(d(0).client.status().lastError).toBe("Authentification refusée");
  });

  test("refuses an unencrypted server outside loopback", async () => {
    await expect(
      d(0).client.connect({ serverUrl: "ws://10.0.0.2:4000", code: "X", deviceName: "Adam", caFile: null }),
    ).rejects.toMatchObject({ code: "TLS_REQUIRED" });
  });

  test("a revoked device is closed with 4403 and does not retry", async () => {
    await h.connect(0, "Adam");
    const deviceId = d(0).client.status().deviceId ?? "";
    revokeDevice(h.server.server.sdb, { deviceId, by: "admin" }, Date.now());
    h.server.server.hub.kickDevice(deviceId, 4403);
    await h.waitUntil(() => d(0).client.status().lastError === "Appareil révoqué");
    await Bun.sleep(1500);
    expect(d(0).opens()).toBe(1);
    expect(d(0).client.status().retryAt).toBeNull();
  });
});

describe("replication", () => {
  test("changes made offline are pushed when the server comes back", async () => {
    await h.connect(0, "Adam");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.stopServer();
    await rpc(0, { method: "command", projectId: p, command: { method: "createTicket", title: "Hors ligne" } });
    await h.startServer();
    await h.waitUntil(() => d(0).client.status().state === "online", 60_000);
    await h.connect(1, "Léa");
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    await h.waitUntil(() => titles(1, p).includes("Hors ligne"), 10_000);
  }, 90_000);

  test("UPDATE_REJECTED replaces the local doc with the server copy", async () => {
    await h.connect(0, "Adam");
    const p = await newProject(0);
    await rpc(0, { method: "command", projectId: p, command: { method: "createTicket", title: "Original" } });
    await h.shareRaw(0, p);
    const doc = d(0).service.hosts.host(p).doc();
    const ticket = listTickets(doc)[0];
    if (!ticket) throw new Error("no ticket");
    doc.getTree("tickets").getNodeByID(ticket.id as `${number}@${number}`)?.data.set("key", "KIB-999");
    doc.commit();
    await rpc(0, { method: "command", projectId: p, command: { method: "updateTicket", ticketId: ticket.id, title: "Perdu" } });
    await h.waitUntil(() => {
      const t = getTicket(d(0).service.hosts.host(p).doc(), ticket.id);
      return t.key === "KIB-1" && t.title === "Original";
    }, 10_000);
    expect(d(0).client.status().projects.find((x) => x.projectId === p)?.lastError).toContain("UPDATE_REJECTED");
  });
});

describe("roles", () => {
  test("a viewer is read-only, online and offline", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "viewer"));
    const attempt = () => rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } });
    await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.stopServer();
    await h.waitUntil(() => d(1).client.status().state === "offline");
    await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a member removed while offline ends up read-only without pushing", async () => {
    await h.connect(0, "Adam");
    await h.connect(1, "Léa");
    const p = await newProject(0);
    await h.shareRaw(0, p);
    await h.joinRaw(1, await h.inviteRaw(0, p, "editor"));
    const leaId = d(1).client.status().user?.id ?? "";
    d(1).client.stop();
    await d(0).client.request({ type: "set-role", projectId: p, requestId: "r1", userId: leaId, role: null }, "done");
    await rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Jamais envoyé" } });
    await d(1).client.start();
    await h.waitUntil(() => d(1).client.status().projects.some((x) => x.projectId === p && x.accessRevoked));
    await expect(
      rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } }),
    ).rejects.toBeInstanceOf(KiboError);
    await Bun.sleep(300);
    expect(titles(0, p)).not.toContain("Jamais envoyé");
    expect(titles(1, p)).toContain("Jamais envoyé");
  });
});
```

- [ ] **Step 8: Vérifier l'échec**

Run: `bun test packages/daemon/src/sync/sync-client.test.ts`
Expected: FAIL « Cannot find module '../sync/sync-client' ».

- [ ] **Step 9: Implémenter `SyncClient`**

`packages/daemon/src/sync/sync-client.ts` :
```ts
import {
  CLOSE_CODES,
  type ClientFrame,
  challengePayload,
  type DaemonEvent,
  type DeviceInfo,
  JoinResponse,
  KiboError,
  type KiboErrorCode,
  type MemberInfo,
  type Role,
  SYNC_LIMITS,
  ServerFrame,
  type SyncState,
  type SyncStatus,
} from "@kibo/schema";
import { generateKeyPair, signBytes } from "@kibo/trust";
import type { SecretStore } from "../secrets/secret-store";
import { clearDeviceKeys, loadDeviceKeys } from "./device-keys";
import { ProjectSync } from "./project-sync";
import type { SyncDb, SyncProjectRow } from "./sync-db";
import { assertSyncUrl, type SyncSocket, type SyncTransport } from "./transport";
import type { ProjectHostRegistry } from "./types";

export type SyncClientDeps = {
  db: SyncDb;
  secrets: SecretStore;
  hosts: ProjectHostRegistry;
  transport: SyncTransport;
  fetchImpl: typeof fetch;
  readFile(path: string): Promise<string>;
  now(): number;
  random(): number;
  setTimer(fn: () => void, ms: number): () => void;
  emit(event: DaemonEvent): void;
  log(message: string, error?: unknown): void;
  backoff?: { minMs: number; maxMs: number };
};

export function backoffDelay(attempt: number, random: number, limits: { minMs: number; maxMs: number }): number {
  const base = Math.min(limits.maxMs, limits.minMs * 2 ** attempt);
  return Math.round(limits.minMs + random * (base - limits.minMs));
}

type Waiter = { expect: ServerFrame["type"]; resolve(f: ServerFrame): void; reject(e: KiboError): void; cancel(): void };
const REQUEST_TIMEOUT_MS = 10_000;
const REVOKED_MESSAGE = { removed: "Accès retiré", deleted: "Projet supprimé du serveur", disconnected: "Déconnecté du serveur" };

export class SyncClient {
  private socket: SyncSocket | null = null;
  private state: SyncState = "unconfigured";
  private user: { id: string; name: string } | null = null;
  private attempt = 0;
  private retryAt: number | null = null;
  private cancelRetry: (() => void) | null = null;
  private halted = false;
  private stopped = true;
  private lastError: string | null = null;
  private offLocal: (() => void) | null = null;
  private readonly syncs = new Map<string, ProjectSync>();
  private readonly members = new Map<string, MemberInfo[]>();
  private readonly waiters = new Map<string, Waiter>();
  private readonly listeners = new Set<(f: ServerFrame) => void>();
  private readonly welcomeWaiters = new Set<{ resolve(): void; reject(e: KiboError): void }>();

  constructor(private readonly deps: SyncClientDeps) {}

  async start(): Promise<void> {
    this.stopped = false;
    this.halted = false;
    this.offLocal ??= this.deps.hosts.onLocalChange((id) => this.syncs.get(id)?.localChange());
    for (const row of this.deps.db.projects()) this.applyAccess(row);
    if (this.deps.db.config()) await this.open();
  }

  stop(): void {
    this.stopped = true;
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.retryAt = null;
    this.offLocal?.();
    this.offLocal = null;
    this.socket?.close(1000);
    this.socket = null;
  }

  status(): SyncStatus {
    const config = this.deps.db.config();
    return {
      state: config ? this.state : "unconfigured",
      serverUrl: config?.serverUrl ?? null,
      user: this.user ?? (config ? { id: config.userId, name: config.displayName } : null),
      deviceId: config?.deviceId ?? null,
      retryAt: this.retryAt,
      lastError: this.lastError,
      projects: this.deps.db.projects().map((r) => ({
        projectId: r.projectId,
        name: this.projectName(r.projectId),
        role: r.role,
        lastSyncAt: r.lastSyncAt,
        lastError: r.lastError,
        accessRevoked: r.accessRevoked,
      })),
    };
  }

  membersOf(projectId: string): MemberInfo[] {
    return this.members.get(projectId) ?? [];
  }

  async connect(input: { serverUrl: string; code: string; deviceName: string; caFile: string | null }): Promise<SyncStatus> {
    const url = assertSyncUrl(input.serverUrl);
    if (this.deps.db.config()) throw new KiboError("INVALID_INPUT", "a sync server is already configured");
    const ca = input.caFile ? await this.deps.readFile(input.caFile) : null;
    const keys = await generateKeyPair();
    const httpOrigin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
    const res = await this.deps.fetchImpl(`${httpOrigin}/v1/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: input.code, publicKey: keys.publicKey, deviceName: input.deviceName }),
      tls: ca ? { ca } : undefined,
    });
    const body: unknown = await res.json();
    if (!res.ok) {
      const error = (body as { error?: { code?: KiboErrorCode; message?: string } }).error;
      throw new KiboError(error?.code ?? "INVITE_INVALID", error?.message ?? `join failed with ${res.status}`);
    }
    const joined = JoinResponse.parse(body);
    await this.deps.secrets.set("sync:device", JSON.stringify(keys));
    this.deps.db.setConfig({
      serverUrl: url.toString().replace(/\/$/, ""),
      caFile: input.caFile,
      userId: joined.userId,
      deviceId: joined.deviceId,
      displayName: joined.name,
    });
    this.lastError = null;
    const online = new Promise<void>((resolve, reject) => this.welcomeWaiters.add({ resolve, reject }));
    await this.start();
    await online;
    return this.status();
  }

  async disconnect(): Promise<void> {
    this.stop();
    for (const row of this.deps.db.projects()) if (!row.accessRevoked) this.markRevoked(row.projectId, "disconnected");
    this.syncs.clear();
    await clearDeviceKeys(this.deps.secrets);
    this.deps.db.setConfig(null);
    this.state = "unconfigured";
    this.user = null;
    this.lastError = null;
    this.deps.emit({ type: "sync" });
  }

  send(frame: ClientFrame): void {
    if (!this.socket || this.state !== "online") throw new KiboError("SYNC_OFFLINE", "not connected to the sync server");
    this.socket.send(JSON.stringify(frame));
  }

  request<T extends ServerFrame["type"]>(
    frame: ClientFrame,
    expect: T,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    if (!("requestId" in frame)) throw new KiboError("INVALID_INPUT", `${frame.type} is not a request`);
    const id = frame.requestId;
    return new Promise((resolve, reject) => {
      const cancel = this.deps.setTimer(() => {
        this.waiters.delete(id);
        reject(new KiboError("SYNC_OFFLINE", `${frame.type} timed out`));
      }, timeoutMs);
      this.waiters.set(id, {
        expect,
        resolve: (f) => resolve(f as Extract<ServerFrame, { type: T }>),
        reject,
        cancel,
      });
      try {
        this.send(frame);
      } catch (e) {
        cancel();
        this.waiters.delete(id);
        reject(e);
      }
    });
  }

  onFrame(listener: (frame: ServerFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  attachProject(projectId: string, role: Role): void {
    const row = this.deps.db.project(projectId);
    this.deps.db.upsertProject({
      projectId,
      enabled: true,
      role,
      lastServerVersion: row?.lastServerVersion ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: null,
      accessRevoked: false,
    });
    this.applyAccess({ ...(this.deps.db.project(projectId) as SyncProjectRow) });
    if (this.state === "online") this.startProject(projectId).connected();
    this.deps.emit({ type: "sync" });
  }

  detachProject(projectId: string): void {
    this.syncs.get(projectId)?.disconnected();
    this.syncs.delete(projectId);
    this.deps.db.removeProject(projectId);
    this.deps.hosts.setAccess(projectId, "write");
    this.deps.emit({ type: "sync" });
  }

  async addDevice(): Promise<{ code: string; expiresAt: number }> {
    const f = await this.request({ type: "device-invite", requestId: crypto.randomUUID() }, "invite-code");
    return { code: f.code, expiresAt: f.expiresAt };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return (await this.request({ type: "list-devices", requestId: crypto.randomUUID() }, "devices")).devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.request({ type: "revoke-device", requestId: crypto.randomUUID(), deviceId }, "done");
  }

  private projectName(projectId: string): string {
    try {
      return this.deps.hosts.host(projectId).doc().getMap("meta").get("name") as string;
    } catch (e) {
      if (e instanceof KiboError && e.code === "NOT_FOUND") return projectId;
      throw e;
    }
  }

  private applyAccess(row: SyncProjectRow): void {
    if (!this.deps.hosts.projectIds().includes(row.projectId)) return;
    const access = row.accessRevoked ? "revoked" : row.role === "viewer" ? "read-only" : "write";
    this.deps.hosts.setAccess(row.projectId, access);
  }

  private async open(): Promise<void> {
    const config = this.deps.db.config();
    if (!config || this.stopped || this.halted) return;
    const ca = config.caFile ? await this.deps.readFile(config.caFile) : null;
    this.state = "connecting";
    this.retryAt = null;
    this.deps.emit({ type: "sync" });
    const socket = this.deps.transport.open(`${config.serverUrl}/v1/sync`, { ca });
    this.socket = socket;
    socket.onMessage((text) => {
      void this.receive(text).catch((e: unknown) => this.deps.log("sync frame handling failed", e));
    });
    socket.onClose((code) => {
      if (this.socket === socket) this.closed(code);
    });
  }

  private async receive(text: string): Promise<void> {
    const parsed = ServerFrame.safeParse(JSON.parse(text));
    if (!parsed.success) {
      this.deps.log(`invalid frame from sync server: ${parsed.error.message}`);
      return;
    }
    const f = parsed.data;
    switch (f.type) {
      case "challenge":
        await this.authenticate(f.nonce);
        break;
      case "welcome":
        this.welcome(f);
        break;
      case "update":
      case "ack":
      case "reject":
        this.syncs.get(f.projectId)?.receive(f);
        if (f.type !== "reject") this.touch(f.projectId, null);
        break;
      case "members":
        this.members.set(f.projectId, f.members);
        this.updateRole(f.projectId, f.members);
        break;
      case "revoked":
        this.markRevoked(f.projectId, f.reason);
        break;
      default:
        this.settle(f);
    }
    for (const l of this.listeners) l(f);
  }

  private async authenticate(nonce: string): Promise<void> {
    const config = this.deps.db.config();
    if (!config) throw new KiboError("INTERNAL", "challenge received without configuration");
    const keys = await loadDeviceKeys(this.deps.secrets);
    const origin = new URL(config.serverUrl).origin;
    const signature = await signBytes(keys.privateKey, challengePayload(nonce, origin));
    this.socket?.send(JSON.stringify({ type: "auth", deviceId: config.deviceId, signature }));
  }

  private welcome(f: Extract<ServerFrame, { type: "welcome" }>): void {
    this.state = "online";
    this.attempt = 0;
    this.lastError = null;
    this.user = { id: f.userId, name: f.name };
    const listed = new Map(f.projects.map((p) => [p.id, p.role]));
    for (const row of this.deps.db.projects()) {
      if (!row.enabled || row.accessRevoked) continue;
      const role = listed.get(row.projectId);
      if (!role) {
        this.markRevoked(row.projectId, "removed");
        continue;
      }
      this.deps.db.upsertProject({ ...row, role });
      this.applyAccess({ ...row, role });
      this.startProject(row.projectId).connected();
    }
    for (const w of this.welcomeWaiters) w.resolve();
    this.welcomeWaiters.clear();
    this.deps.emit({ type: "sync" });
  }

  private startProject(projectId: string): ProjectSync {
    const existing = this.syncs.get(projectId);
    if (existing) return existing;
    const sync = new ProjectSync({
      projectId,
      host: this.deps.hosts.host(projectId),
      send: (frame) => this.send(frame),
      serverVersion: this.deps.db.project(projectId)?.lastServerVersion ?? null,
      saveServerVersion: (version) => {
        const row = this.deps.db.project(projectId);
        if (row) this.deps.db.upsertProject({ ...row, lastServerVersion: version });
      },
      newBatchId: () => crypto.randomUUID(),
      schedule: (fn, ms) => {
        this.deps.setTimer(fn, ms);
      },
      onRejected: (code, message) => {
        this.touch(projectId, `${code}: ${message}`);
        if (code === "FORBIDDEN") this.deps.hosts.setAccess(projectId, "read-only");
      },
    });
    this.syncs.set(projectId, sync);
    return sync;
  }

  private touch(projectId: string, error: string | null): void {
    const row = this.deps.db.project(projectId);
    if (!row) return;
    this.deps.db.upsertProject({ ...row, lastSyncAt: error ? row.lastSyncAt : this.deps.now(), lastError: error });
    this.deps.emit({ type: "sync" });
  }

  private updateRole(projectId: string, members: MemberInfo[]): void {
    const me = members.find((m) => m.userId === this.user?.id);
    const row = this.deps.db.project(projectId);
    if (!me || !row || row.role === me.role) return;
    this.deps.db.upsertProject({ ...row, role: me.role });
    this.applyAccess({ ...row, role: me.role });
    this.deps.emit({ type: "sync" });
  }

  private markRevoked(projectId: string, reason: keyof typeof REVOKED_MESSAGE): void {
    this.syncs.get(projectId)?.disconnected();
    this.syncs.delete(projectId);
    const row = this.deps.db.project(projectId);
    if (row) {
      this.deps.db.upsertProject({ ...row, enabled: false, accessRevoked: true, lastError: REVOKED_MESSAGE[reason] });
      this.applyAccess({ ...row, accessRevoked: true });
    }
    this.deps.emit({ type: "sync" });
  }

  private settle(f: ServerFrame): void {
    if (!("requestId" in f) || f.requestId === null) {
      if (f.type === "error") this.deps.log(`sync server error: ${f.code} ${f.message}`);
      return;
    }
    const w = this.waiters.get(f.requestId);
    if (!w) return;
    this.waiters.delete(f.requestId);
    w.cancel();
    if (f.type === "error") w.reject(new KiboError(f.code as KiboErrorCode, f.message));
    else if (f.type === w.expect) w.resolve(f);
    else w.reject(new KiboError("INTERNAL", `expected ${w.expect}, got ${f.type}`));
  }

  private closed(code: number): void {
    this.socket = null;
    for (const s of this.syncs.values()) s.disconnected();
    for (const [id, w] of this.waiters) {
      w.cancel();
      w.reject(new KiboError("SYNC_OFFLINE", "connection closed"));
      this.waiters.delete(id);
    }
    this.state = "offline";
    if (code === CLOSE_CODES.deviceRevoked || code === CLOSE_CODES.authFailed) {
      this.halted = true;
      this.lastError = code === CLOSE_CODES.deviceRevoked ? "Appareil révoqué" : "Authentification refusée";
      for (const w of this.welcomeWaiters) w.reject(new KiboError("UNAUTHORIZED", this.lastError));
      this.welcomeWaiters.clear();
    } else if (!this.stopped) {
      const delay = backoffDelay(
        this.attempt,
        this.deps.random(),
        this.deps.backoff ?? { minMs: SYNC_LIMITS.backoffMinMs, maxMs: SYNC_LIMITS.backoffMaxMs },
      );
      this.attempt += 1;
      this.retryAt = this.deps.now() + delay;
      this.cancelRetry = this.deps.setTimer(() => {
        this.cancelRetry = null;
        void this.open().catch((e: unknown) => {
          this.lastError = e instanceof Error ? e.message : String(e);
          this.deps.log("sync reconnection failed", e);
        });
      }, delay);
    }
    this.deps.emit({ type: "sync" });
  }
}
```
`ProjectHostRegistry` est déplacé dans `packages/daemon/src/sync/types.ts` (type du contrat plus `mutate`), importé par le service et le client.

- [ ] **Step 10: RPC et démarrage**

`packages/daemon/src/sync/rpc.ts` :
```ts
import { KiboError, type RpcRequest } from "@kibo/schema";
import type { RpcContext } from "../rpc-extensions";
import type { SyncClient } from "./sync-client";

const LOCAL_ONLY = new Set(["connectSyncServer", "disconnectSyncServer"]);

export async function handleSyncRpc(
  client: SyncClient,
  req: RpcRequest,
  ctx: RpcContext,
): Promise<{ handled: true; result: unknown } | { handled: false }> {
  if (LOCAL_ONLY.has(req.method) && ctx.remote) throw new KiboError("FORBIDDEN", `${req.method} is local only`);
  switch (req.method) {
    case "getSyncStatus":
      return { handled: true, result: client.status() };
    case "connectSyncServer":
      return { handled: true, result: await client.connect(req) };
    case "disconnectSyncServer":
      await client.disconnect();
      return { handled: true, result: null };
    case "listDevices":
      return { handled: true, result: await client.listDevices() };
    case "addDevice":
      return { handled: true, result: await client.addDevice() };
    case "revokeDevice":
      await client.revokeDevice(req.deviceId);
      return { handled: true, result: null };
    default:
      return { handled: false };
  }
}
```
Branchement par l'option `handlers` de `startServer` (T9) : `handlers: [(req, ctx) => handleSyncRpc(sync, req, ctx), …]` ; `server.ts` n'est pas modifié pour la RPC. Dans `main.ts` : `const syncDb = openSyncDb(store.db)`, `SyncClient` avec `createWebSocketTransport()`, `fetch`, `Bun.file(p).text()`, `Date.now`, `Math.random`, `setTimeout`/`clearTimeout`, `emit` vers le hub d'événements, `log` vers `console.error` préfixé `[kibo-daemon]`, puis `await sync.start()` avant `KIBO_READY`, et `sync.stop()` dans `shutdown`. Test ajouté à `rpc.test.ts` (même dossier) :
```ts
import { expect, test } from "bun:test";
import { handleSyncRpc } from "./rpc";
import type { SyncClient } from "./sync-client";

test("connectSyncServer is refused from a remote session", async () => {
  const client = {} as SyncClient;
  await expect(
    handleSyncRpc(client, { method: "disconnectSyncServer" }, { sessionHash: "h", remote: true }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

- [ ] **Step 11: Vérifier**

Run: `bun test packages/daemon/src/sync`
Expected: PASS (tests de T18 inchangés, plus 13 nouveaux). Le harnais réduit le backoff à 20 → 200 ms : le test « hors ligne puis rattrapage » dure quelques secondes.

Test ajouté à `sync-client.test.ts` pour les valeurs de production :
```ts
test("backoff grows from 1 s to 60 s with jitter", () => {
  const limits = { minMs: SYNC_LIMITS.backoffMinMs, maxMs: SYNC_LIMITS.backoffMaxMs };
  expect(backoffDelay(0, 0.7, limits)).toBe(1000);
  expect(backoffDelay(3, 0, limits)).toBe(1000);
  expect(backoffDelay(3, 1, limits)).toBe(8000);
  expect(backoffDelay(3, 0.5, limits)).toBe(4500);
  expect(backoffDelay(20, 1, limits)).toBe(60_000);
});
```
(importer `backoffDelay` depuis `./sync-client` et `SYNC_LIMITS` depuis `@kibo/schema`).

Run: `bun test packages/daemon && bun run check && bun run typecheck`
Expected: PASS ; aucun test existant du démon modifié.

- [ ] **Step 12: Commit**

```bash
git add packages/daemon/src/sync/sync-db.ts packages/daemon/src/sync/sync-db.test.ts packages/daemon/src/sync/device-keys.ts \
  packages/daemon/src/sync/sync-client.ts packages/daemon/src/sync/sync-client.test.ts packages/daemon/src/sync/types.ts \
  packages/daemon/src/sync/project-info.ts packages/daemon/src/sync/rpc.ts packages/daemon/src/sync/rpc.test.ts \
  packages/daemon/src/testing/sync-harness.ts packages/daemon/src/service.ts \
  packages/daemon/src/main.ts packages/daemon/package.json bun.lock
git commit -m "feat(daemon): client de sync"
```

---

### Task 22: Publication et outillage marketplace

Publier un composant utilisateur sur la source d'équipe servie par `kibo-sync` (spec H §5.1 points 1 à 4), produire un `.kpkg` et un index statique signé pour un hébergement quelconque (§5.1 point 5), et prouver le critère de sortie « publication sur la source d'équipe puis installation sur un second démon, avec vérification complète » (§10).

**Files:**
- Create: `packages/daemon/src/market/publisher-keys.ts`, `packages/daemon/src/market/publish.ts`, `packages/cli/src/market.ts`, `packages/cli/src/market-index-builder.ts`
- Modify: `packages/daemon/src/market/market-service.ts` (`hasVersion`), `packages/daemon/src/market/rpc.ts` (`publishToMarket`, `exportKpkg`), `packages/daemon/src/main.ts` (branchement, `ca` de la sync pour `createHttpGet`), `packages/cli/src/main.ts` (sous-commande `market`), `packages/cli/src/component.ts` (`publish --to`), `packages/cli/package.json` (`@kibo/trust`)
- Test: `packages/daemon/src/market/publish.test.ts`, `packages/daemon/src/market/team-publish.integration.test.ts`, `packages/cli/src/market-index-builder.test.ts`, `packages/cli/src/market.test.ts`

**Interfaces:**
- Consumes: `packKpkg`, `encodeKpkg`, `decodeKpkg`, `verifyKpkgSignature`, `kpkgSourceFiles`, `signIndex`, `verifyIndex`, `generateKeyPair`, `signRequest`, `type KeyPair` (`@kibo/trust`, T2, T10) ; `startTestSyncServer`, `TeamMarket` (T16, T17) ; `MarketService`, `createHttpGet`, `openMarketDb`, `createMemoryRegistry` (T15) ; `installFromMarket`, `createSandboxedValidator`, `createMemoryComponentStore` (T20) ; `SyncConfig`, `SyncDb` (T21) ; `SecretStore`, `MemorySecretStore` (phase 5) ; `ComponentStore`, `RegistryPort`.
- Consumes aussi : `loadDeviceKeys(secrets): Promise<KeyPair>` (T21, `UNAUTHORIZED` si l'appareil n'a pas de clé), clé stockée en JSON `KeyPair` sous `SECRET_SYNC_DEVICE` (T1).
- `startTestSyncServer({ market: { id, name } })` (T17) initialise la source d'équipe avant le démarrage ; hypothèse à vérifier dans T16 : `POST /v1/market/packages` répond `200 { serial }` ou `{ ok: false, error: { code, message } }` avec le statut HTTP du code.
- Produces :
  - `MarketService.hasVersion(sourceId: string, id: string, version: string): boolean` (**méthode ajoutée**).
  - `type PublisherKeys = KeyPair & { name: string }` ; `loadPublisherKeys(secrets: SecretStore, name?: string): Promise<PublisherKeys>` (`INVALID_INPUT` si absente et sans nom).
  - `type PublishDeps = { store: ComponentStore; registry: RegistryPort; market: MarketService; secrets: SecretStore; syncConfig(): SyncConfig | null; caPem(): string | null; validate(id: string, version: string): Promise<{ ok: boolean; summary: string }>; now: () => number }`.
  - `exportKpkg(deps: PublishDeps, input: { id: string; version: string; publisherName?: string }): Promise<Kpkg>` ; `publishToMarket(deps: PublishDeps, input: { id: string; version: string; sourceId: string; publisherName?: string }): Promise<{ serial: number }>`.
  - `buildStaticIndex(input: { dir: string; keys: KeyPair; id: string; name: string; verified: string[]; now: Date }): Promise<{ serial: number; packages: number }>` (`packages/cli`).
  - `runMarketCommand(argv: string[], deps: { rpc(req: RpcRequest): Promise<unknown>; out(text: string): void; now(): Date }): Promise<number>`.

- [ ] **Step 1: Tests unitaires de la publication**

`packages/daemon/src/market/publish.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { kpkgSourceFiles, verifyKpkgSignature } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { MemorySecretStore } from "../secrets/secret-store";
import { createMemoryComponentStore } from "../testing/memory-component-store";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { exportKpkg, type PublishDeps, publishToMarket } from "./publish";

let deps: PublishDeps;
let secrets: MemorySecretStore;

beforeEach(async () => {
  secrets = new MemorySecretStore();
  const store = createMemoryComponentStore();
  const registry = createMemoryRegistry();
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown" } });
  const files = await kpkgSourceFiles(made.pkg);
  const { hash } = await store.put({ id: "burndown", version: "0.1.0", files });
  registry.port.put("burndown", "Burndown", {
    version: "0.1.0",
    hash,
    origin: "user",
    trust: "trusted",
    approvedHash: hash,
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 0,
    source: null,
    revoked: null,
  });
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: registry.port,
    now: () => 1,
    notify: mock(async () => {}),
    log: mock(() => {}),
  });
  deps = {
    store,
    registry: registry.port,
    market,
    secrets,
    syncConfig: () => null,
    caPem: () => null,
    validate: async () => ({ ok: true, summary: "" }),
    now: () => Date.parse("2026-09-26T10:00:00Z"),
  };
});

describe("exportKpkg", () => {
  test("requires a publisher name the first time", async () => {
    await expect(exportKpkg(deps, { id: "burndown", version: "0.1.0" })).rejects.toThrow("INVALID_INPUT");
  });

  test("signs the stored sources and keeps the publisher key for later", async () => {
    const pkg = await exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" });
    await verifyKpkgSignature(pkg);
    expect(pkg.publisher.name).toBe("Adam");
    expect(pkg.publishedAt).toBe("2026-09-26T10:00:00.000Z");
    const again = await exportKpkg(deps, { id: "burndown", version: "0.1.0" });
    expect(again.publisher.publicKey).toBe(pkg.publisher.publicKey);
    expect(await secrets.has("market:publisher")).toBe(true);
  });

  test("refuses a component that is not the user's own", async () => {
    const v = deps.registry.get("burndown", "0.1.0");
    if (!v) throw new Error("fixture missing");
    deps.registry.put("burndown", "Burndown", { ...v, origin: "marketplace" });
    await expect(exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });
});

describe("publishToMarket", () => {
  test("needs a configured sync server", async () => {
    await expect(
      publishToMarket(deps, { id: "burndown", version: "0.1.0", sourceId: "equipe", publisherName: "Adam" }),
    ).rejects.toThrow("SYNC_OFFLINE");
  });

  test("a failing validation stops the publication", async () => {
    deps = {
      ...deps,
      syncConfig: () => ({ serverUrl: "wss://127.0.0.1:1", caFile: null, userId: "u", deviceId: "d", displayName: "M" }),
      validate: async () => ({ ok: false, summary: "typecheck" }),
    };
    await expect(
      publishToMarket(deps, { id: "burndown", version: "0.1.0", sourceId: "equipe", publisherName: "Adam" }),
    ).rejects.toThrow("VALIDATION_FAILED");
  });
});
```

Run: `bun test packages/daemon/src/market/publish.test.ts`
Expected: FAIL avec « Cannot find module './publish' ».

- [ ] **Step 2: Implémenter les clés d'éditeur et la publication**

`packages/daemon/src/market/publisher-keys.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { generateKeyPair, type KeyPair } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../secrets/secret-store";

export type PublisherKeys = KeyPair & { name: string };
const Stored = z.object({ name: z.string().min(1).max(64), publicKey: z.string(), privateKey: z.string() });

export async function loadPublisherKeys(secrets: SecretStore, name?: string): Promise<PublisherKeys> {
  const raw = await secrets.get("market:publisher");
  if (raw !== null) {
    const parsed = Stored.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new KiboError("INTERNAL", "stored publisher key is unreadable");
    return parsed.data;
  }
  const trimmed = name?.trim() ?? "";
  if (!trimmed) throw new KiboError("INVALID_INPUT", "a publisher name is required the first time");
  const created: PublisherKeys = { name: trimmed.slice(0, 64), ...(await generateKeyPair()) };
  await secrets.set("market:publisher", JSON.stringify(created));
  return created;
}
```

`packages/daemon/src/market/publish.ts` :
```ts
import { ComponentManifest, KiboError, type Kpkg } from "@kibo/schema";
import { encodeKpkg, packKpkg, signRequest } from "@kibo/trust";
import type { ComponentStore } from "../components/component-store";
import type { SecretStore } from "../secrets/secret-store";
import { loadDeviceKeys } from "../sync/device-keys";
import type { SyncConfig } from "../sync/sync-db";
import type { MarketService, RegistryPort } from "./market-service";
import { loadPublisherKeys } from "./publisher-keys";

export type PublishDeps = {
  store: ComponentStore;
  registry: RegistryPort;
  market: MarketService;
  secrets: SecretStore;
  syncConfig(): SyncConfig | null;
  caPem(): string | null;
  validate(id: string, version: string): Promise<{ ok: boolean; summary: string }>;
  now: () => number;
};

const PUBLISH_PATH = "/v1/market/packages";
const OWN_ORIGINS = new Set(["user", "ai"]);

export async function exportKpkg(
  deps: PublishDeps,
  input: { id: string; version: string; publisherName?: string },
): Promise<Kpkg> {
  const v = deps.registry.get(input.id, input.version);
  if (!v) throw new KiboError("NOT_FOUND", `${input.id}@${input.version} is not published locally`);
  if (!OWN_ORIGINS.has(v.origin)) {
    throw new KiboError("INVALID_INPUT", `${input.id} is not one of your components (origin ${v.origin})`);
  }
  const keys = await loadPublisherKeys(deps.secrets, input.publisherName);
  const files = await deps.store.readSources(input.id, input.version, v.hash);
  const manifestFile = files.find((f) => f.path === "kibo.component.json");
  if (!manifestFile) throw new KiboError("INVALID_INPUT", `${input.id} has no manifest`);
  const manifest = ComponentManifest.parse(JSON.parse(new TextDecoder().decode(manifestFile.bytes)));
  return packKpkg({
    manifest,
    files,
    publisherName: keys.name,
    keys: { publicKey: keys.publicKey, privateKey: keys.privateKey },
    publishedAt: new Date(deps.now()),
  });
}

const httpOrigin = (serverUrl: string): string => {
  const url = new URL(serverUrl);
  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
};

const readErrorBody = (value: unknown): { code: string; message: string } | null => {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error = value.error;
  if (typeof error !== "object" || error === null || !("code" in error) || !("message" in error)) return null;
  return typeof error.code === "string" && typeof error.message === "string"
    ? { code: error.code, message: error.message }
    : null;
};

export async function publishToMarket(
  deps: PublishDeps,
  input: { id: string; version: string; sourceId: string; publisherName?: string },
): Promise<{ serial: number }> {
  const config = deps.syncConfig();
  if (!config) throw new KiboError("SYNC_OFFLINE", "connect to a sync server before publishing");
  const sourceUrl = deps.market.sourceUrl(input.sourceId);
  if (new URL(sourceUrl).host !== new URL(config.serverUrl).host) {
    throw new KiboError("INVALID_INPUT", "static source: use kibo market pack and kibo market index");
  }
  const report = await deps.validate(input.id, input.version);
  if (!report.ok) throw new KiboError("VALIDATION_FAILED", `${input.id}@${input.version}: ${report.summary}`);
  await deps.market.refresh(input.sourceId);
  if (deps.market.hasVersion(input.sourceId, input.id, input.version)) {
    throw new KiboError("VERSION_EXISTS", `${input.id}@${input.version} is already on ${input.sourceId}`);
  }
  const device = await loadDeviceKeys(deps.secrets);
  const body = encodeKpkg(await exportKpkg(deps, input));
  const headers = await signRequest({
    deviceId: config.deviceId,
    privateKey: device.privateKey,
    method: "POST",
    path: PUBLISH_PATH,
    body,
    now: deps.now(),
  });
  const ca = deps.caPem();
  const res = await fetch(`${httpOrigin(config.serverUrl)}${PUBLISH_PATH}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/octet-stream" },
    body,
    ...(ca ? { tls: { ca } } : {}),
  });
  const payload: unknown = await res.json();
  if (!res.ok) {
    const error = readErrorBody(payload);
    throw new KiboError(
      error && isKiboCode(error.code) ? error.code : "INTERNAL",
      error?.message ?? `publish failed with HTTP ${res.status}`,
    );
  }
  const serial = typeof payload === "object" && payload !== null && "serial" in payload ? payload.serial : null;
  if (typeof serial !== "number") throw new KiboError("INTERNAL", "publish answer has no serial");
  await deps.market.refresh(input.sourceId);
  return { serial };
}
```
`isKiboCode(code: string): code is KiboErrorCode` est ajouté à `packages/schema/src/errors.ts` (liste figée `KIBO_ERROR_CODES`, déjà nécessaire au client SDK pour relayer les codes) ; s'il existe déjà en v0.6, le réutiliser.

Ajouter à `MarketService` :
```ts
  hasVersion(sourceId: string, id: string, version: string): boolean {
    return this.indexes.get(sourceId)?.packages.find((p) => p.id === id)?.versions.some((v) => v.version === version) ?? false;
  }
```

Run: `bun test packages/daemon/src/market/publish.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Test d'intégration équipe → second démon**

`packages/daemon/src/market/team-publish.integration.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolchainDir } from "@kibo/devkit/toolchain";
import { JoinResponse } from "@kibo/schema";
import { TeamMarket } from "@kibo/sync-server";
import { startTestSyncServer } from "@kibo/sync-server/testing";
import { generateKeyPair, kpkgSourceFiles } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { detectSandbox, realDetectDeps } from "../sandbox/detect";
import { MemorySecretStore } from "../secrets/secret-store";
import { SECRET_SYNC_DEVICE } from "../secrets/secret-store";
import { createMemoryComponentStore } from "../testing/memory-component-store";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { installFromMarket } from "./install";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { publishToMarket } from "./publish";
import { createSandboxedValidator } from "./sandboxed-validator";

let server: Awaited<ReturnType<typeof startTestSyncServer>>;
let home: string;

beforeAll(async () => {
  server = await startTestSyncServer({ market: { id: "equipe", name: "Équipe" } });
  home = mkdtempSync(join(tmpdir(), "kibo-team-"));
});
afterAll(async () => {
  await server.stop();
  rmSync(home, { recursive: true, force: true });
});

const httpBase = () => server.url.replace(/^wss:/, "https:");

async function joinDevice(name: string) {
  const keys = await generateKeyPair();
  const res = await fetch(`${httpBase()}/v1/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: await server.inviteAccount(name), publicKey: keys.publicKey, deviceName: name }),
    tls: { ca: server.caPem },
  });
  return { keys, joined: JoinResponse.parse(await res.json()) };
}

function daemon(name: string) {
  const registry = createMemoryRegistry();
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: false, ca: server.caPem }),
    registry: registry.port,
    now: Date.now,
    notify: mock(async () => {}),
    log: mock(() => {}),
  });
  return { name, registry, market, store: createMemoryComponentStore(), secrets: new MemorySecretStore() };
}

test("a component published by A on the team source installs on B with full verification", async () => {
  const a = daemon("A");
  const b = daemon("B");
  const { keys, joined } = await joinDevice("Adam");
  const team = await TeamMarket.open(server.sdb, server.dataDir);
  if (!team) throw new Error("team market not initialised");
  team.grant(joined.userId, "publisher");
  await a.secrets.set(SECRET_SYNC_DEVICE, JSON.stringify(keys));

  const made = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown" } });
  const stored = await a.store.put({ id: "burndown", version: "0.1.0", files: await kpkgSourceFiles(made.pkg) });
  a.registry.port.put("burndown", "Burndown", {
    version: "0.1.0",
    hash: stored.hash,
    origin: "user",
    trust: "trusted",
    approvedHash: stored.hash,
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 0,
    source: null,
    revoked: null,
  });
  const sourceUrl = `${httpBase()}/market/`;
  const probe = await a.market.probe(sourceUrl);
  await a.market.addSource({ url: sourceUrl, publicKey: probe.publicKey });

  const { serial } = await publishToMarket(
    {
      store: a.store,
      registry: a.registry.port,
      market: a.market,
      secrets: a.secrets,
      syncConfig: () => ({
        serverUrl: server.url,
        caFile: null,
        userId: joined.userId,
        deviceId: joined.deviceId,
        displayName: "Adam",
      }),
      caPem: () => server.caPem,
      validate: async () => ({ ok: true, summary: "" }),
      now: Date.now,
    },
    { id: "burndown", version: "0.1.0", sourceId: probe.sourceId, publisherName: "Adam" },
  );
  expect(serial).toBeGreaterThan(probe.serial);

  await b.market.addSource({ url: sourceUrl, publicKey: probe.publicKey });
  const hit = b.market.search({ query: "burndown" })[0];
  expect(hit?.publisher).toMatchObject({ name: "Adam", verified: true });
  const probeSandbox = await detectSandbox(realDetectDeps(), process.execPath);
  const result = await installFromMarket(
    {
      market: b.market,
      store: b.store,
      registry: b.registry.port,
      validate: createSandboxedValidator({
        probe: () => probeSandbox,
        allowUnsandboxed: () => process.env.KIBO_REQUIRE_OS_SANDBOX !== "1" && !probeSandbox.available,
        toolchainDir: toolchainDir(),
        workRoot: join(home, "tmp"),
      }),
      tmpRoot: join(home, "tmp"),
      now: Date.now,
    },
    { sourceId: probe.sourceId, id: "burndown", version: "0.1.0" },
  );
  expect(result.hash).toBe(stored.hash);
  expect(b.registry.port.get("burndown", "0.1.0")).toMatchObject({ origin: "marketplace", trust: null });
  expect(result.preview.market?.newPublisher).toBe(true);
});
```
Le test tourne en CI sur macOS et Linux (serveur TLS en processus, aucun réseau réel).

Run: `bun test packages/daemon/src/market/team-publish.integration.test.ts`
Expected: PASS une fois T16 et T17 intégrés (FAIL « Cannot find module '@kibo/sync-server/testing' » tant qu'ils ne le sont pas, ce qui n'arrive pas en vague 6).

- [ ] **Step 4: RPC et branchement**

Dans `market/rpc.ts`, `createMarketRpc(market, install, publish)` traite :
```ts
      case "publishToMarket":
        return done(await publish.publish({ id: req.id, version: req.version, sourceId: req.sourceId, publisherName: req.publisherName }));
      case "exportKpkg":
        return done(await publish.exportKpkg({ id: req.id, version: req.version, publisherName: req.publisherName }));
```
avec `publish = { publish: (i) => publishToMarket(publishDeps, i), exportKpkg: (i) => exportKpkg(publishDeps, i) }` construit dans `main.ts` : `syncConfig: () => syncDb.config()`, `caPem: () => syncCaPem()` (lecture du `caFile` de la config, `null` sinon), `validate` : `validateComponent(storeSourceDir(id, version))` de la phase 4 ramené à `{ ok: report.ok, summary }`. `createHttpGet` reçoit aussi `ca: syncCaPem()` pour lire la source d'équipe auto-hébergée.

Run: `bun test packages/daemon/src/market`
Expected: PASS.

- [ ] **Step 5: Commit du démon**

```bash
git add packages/schema/src/errors.ts packages/daemon/src/market/publisher-keys.ts packages/daemon/src/market/publish.ts packages/daemon/src/market/publish.test.ts packages/daemon/src/market/team-publish.integration.test.ts packages/daemon/src/market/market-service.ts packages/daemon/src/market/rpc.ts packages/daemon/src/main.ts
git commit -m "feat(daemon): publication marketplace"
```

- [ ] **Step 6: Tests de l'index statique**

`packages/cli/src/market-index-builder.test.ts` :
```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeKpkg, generateKeyPair, type KeyPair, verifyIndex } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { buildStaticIndex } from "./market-index-builder";

let dir: string;
let keys: KeyPair;
const now = new Date("2026-09-26T10:00:00Z");

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-static-"));
  keys = await generateKeyPair();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function put(version: string, fileVersion = version) {
  const made = await makeTestPackage({ id: "burndown", version, manifest: { title: "Burndown" } });
  mkdirSync(join(dir, "packages", "burndown"), { recursive: true });
  writeFileSync(join(dir, "packages", "burndown", `${fileVersion}.kpkg`), made.bytes);
  return made;
}

const read = async (lastSerial: number | null) =>
  verifyIndex({
    bytes: new Uint8Array(readFileSync(join(dir, "index.json"))),
    sig: readFileSync(join(dir, "index.json.sig"), "utf8").trim(),
    expectedKey: keys.publicKey,
    lastSerial,
  });

describe("buildStaticIndex", () => {
  test("signs an index whose serial grows at each build", async () => {
    const made = await put("0.1.0");
    expect(await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [made.publisher.keys.publicKey], now })).toEqual({
      serial: 1,
      packages: 1,
    });
    const first = await read(null);
    expect(first.packages[0]?.versions[0]?.url).toBe("packages/burndown/0.1.0.kpkg");
    expect(first.publishers[0]?.verified).toBe(true);
    await put("0.2.0");
    expect((await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now })).serial).toBe(2);
    expect((await read(1)).packages[0]?.versions.map((v) => v.version)).toEqual(["0.1.0", "0.2.0"]);
  });

  test("a tampered package aborts the build and keeps the previous index", async () => {
    await put("0.1.0");
    await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now });
    const made = await put("0.2.0");
    const first = made.pkg.files[0];
    if (!first) throw new Error("fixture has no file");
    const tampered = { ...made.pkg, files: [{ ...first, content: btoa("changed") }, ...made.pkg.files.slice(1)] };
    writeFileSync(join(dir, "packages", "burndown", "0.2.0.kpkg"), encodeKpkg(tampered));
    await expect(buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now })).rejects.toThrow(
      "HASH_MISMATCH",
    );
    expect((await read(null)).serial).toBe(1);
  });

  test("a package stored under the wrong version is refused", async () => {
    await put("0.1.0", "0.3.0");
    await expect(buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });

  test("revoked.json is carried into the index", async () => {
    const made = await put("0.1.0");
    writeFileSync(join(dir, "revoked.json"), JSON.stringify([{ hash: made.pkg.hash, reason: "Faille" }]));
    await buildStaticIndex({ dir, keys, id: "perso", name: "Perso", verified: [], now });
    expect((await read(null)).revoked).toEqual([{ hash: made.pkg.hash, reason: "Faille" }]);
  });
});
```

Run: `bun test packages/cli/src/market-index-builder.test.ts`
Expected: FAIL avec « Cannot find module './market-index-builder' ».

- [ ] **Step 7: Implémenter le constructeur d'index**

`packages/cli/src/market-index-builder.ts` :
```ts
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareSemver, grantedPermissions, KiboError, type Kpkg, type MarketIndex, Sha256 } from "@kibo/schema";
import { decodeKpkg, type KeyPair, kpkgSourceFiles, signIndex, verifyKpkgSignature } from "@kibo/trust";
import { z } from "zod";

const Revoked = z.array(z.object({ hash: Sha256, reason: z.string().min(1) }));
const Previous = z.object({ serial: z.number().int().positive() });

type Loaded = { pkg: Kpkg; size: number; url: string };

async function loadPackages(dir: string): Promise<Loaded[]> {
  const root = join(dir, "packages");
  if (!existsSync(root)) return [];
  const out: Loaded[] = [];
  for (const id of readdirSync(root).sort()) {
    for (const file of readdirSync(join(root, id)).filter((f) => f.endsWith(".kpkg")).sort()) {
      const bytes = new Uint8Array(readFileSync(join(root, id, file)));
      const pkg = decodeKpkg(bytes);
      if (pkg.manifest.id !== id || `${pkg.manifest.version}.kpkg` !== file) {
        throw new KiboError("INVALID_INPUT", `packages/${id}/${file} contains ${pkg.manifest.id}@${pkg.manifest.version}`);
      }
      await verifyKpkgSignature(pkg);
      await kpkgSourceFiles(pkg);
      out.push({ pkg, size: bytes.byteLength, url: `packages/${id}/${file}` });
    }
  }
  return out;
}

export async function buildStaticIndex(input: {
  dir: string;
  keys: KeyPair;
  id: string;
  name: string;
  verified: string[];
  now: Date;
}): Promise<{ serial: number; packages: number }> {
  const loaded = await loadPackages(input.dir);
  const indexFile = join(input.dir, "index.json");
  const previous = existsSync(indexFile) ? Previous.parse(JSON.parse(readFileSync(indexFile, "utf8"))).serial : 0;
  const revokedFile = join(input.dir, "revoked.json");
  const revoked = existsSync(revokedFile) ? Revoked.parse(JSON.parse(readFileSync(revokedFile, "utf8"))) : [];
  const ids = [...new Set(loaded.map((l) => l.pkg.manifest.id))];
  const index: MarketIndex = {
    format: 1,
    source: { id: input.id, name: input.name, publicKey: input.keys.publicKey },
    serial: previous + 1,
    generatedAt: input.now.toISOString(),
    publishers: [...new Map(loaded.map((l) => [l.pkg.publisher.publicKey, l.pkg.publisher.name])).entries()].map(
      ([publicKey, name]) => ({ publicKey, name, verified: input.verified.includes(publicKey) }),
    ),
    packages: ids.map((id) => {
      const versions = loaded
        .filter((l) => l.pkg.manifest.id === id)
        .sort((a, b) => compareSemver(a.pkg.manifest.version, b.pkg.manifest.version));
      const latest = versions[versions.length - 1];
      if (!latest) throw new KiboError("INTERNAL", `no version for ${id}`);
      return {
        id,
        title: latest.pkg.manifest.title,
        description: latest.pkg.manifest.description ?? "",
        kind: latest.pkg.manifest.kind,
        versions: versions.map((l) => ({
          version: l.pkg.manifest.version,
          hash: l.pkg.hash,
          publisherKey: l.pkg.publisher.publicKey,
          size: l.size,
          permissions: grantedPermissions(l.pkg.manifest),
          publishedAt: l.pkg.publishedAt,
          url: l.url,
        })),
      };
    }),
    revoked,
  };
  const signed = await signIndex(index, input.keys.privateKey);
  writeFileSync(join(input.dir, "index.json.sig"), `${signed.sig}\n`, { mode: 0o644 });
  writeFileSync(indexFile, signed.bytes, { mode: 0o644 });
  return { serial: index.serial, packages: loaded.length };
}
```
Tout contrôle échoue avant la moindre écriture : l'index précédent reste en place.

Run: `bun test packages/cli/src/market-index-builder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Tests de la commande `kibo market`**

`packages/cli/src/market.test.ts` :
```ts
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RpcRequest } from "@kibo/schema";
import { decodeKpkg } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { runMarketCommand } from "./market";

let dir: string;
const out: string[] = [];
const now = () => new Date("2026-09-26T10:00:00Z");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kibo-cli-"));
  out.length = 0;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("keygen writes a private key file readable by its owner only", async () => {
  const file = join(dir, "source.key");
  expect(await runMarketCommand(["keygen", "--out", file], { rpc: mock(async () => null), out: (t) => out.push(t), now })).toBe(0);
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(out.join("")).toContain("SHA256");
});

test("pack asks the daemon for a signed package and writes it", async () => {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  const rpc = mock(async (_: RpcRequest) => made.pkg);
  const file = join(dir, "burndown-0.1.0.kpkg");
  expect(await runMarketCommand(["pack", "burndown@0.1.0", "--out", file], { rpc, out: (t) => out.push(t), now })).toBe(0);
  expect(rpc).toHaveBeenCalledWith({ method: "exportKpkg", id: "burndown", version: "0.1.0" });
  expect(decodeKpkg(new Uint8Array(readFileSync(file))).hash).toBe(made.pkg.hash);
});

test("an unknown sub-command prints the usage and fails", async () => {
  expect(await runMarketCommand(["nope"], { rpc: mock(async () => null), out: (t) => out.push(t), now })).toBe(1);
  expect(out.join("")).toContain("kibo market keygen");
});
```

Run: `bun test packages/cli/src/market.test.ts`
Expected: FAIL avec « Cannot find module './market' ».

- [ ] **Step 9: Implémenter `kibo market`**

`packages/cli/src/market.ts` :
```ts
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { KiboError, Kpkg, type RpcRequest } from "@kibo/schema";
import { encodeKpkg, formatFingerprint, generateKeyPair, keyFingerprint } from "@kibo/trust";
import { z } from "zod";
import { buildStaticIndex } from "./market-index-builder";

type Deps = { rpc(req: RpcRequest): Promise<unknown>; out(text: string): void; now(): Date };

const KeyFile = z.object({ publicKey: z.string(), privateKey: z.string() });
const USAGE = [
  "kibo market keygen --out <fichier>",
  "kibo market pack <id>@<version> [--out <fichier>]",
  "kibo market index --dir <dossier> --key <fichier> --id <source> --name <nom> [--verify <clé>]…",
  "",
].join("\n");

const splitRef = (ref: string | undefined): { id: string; version: string } => {
  const match = ref?.match(/^([a-z][a-z0-9.-]*)@(\d+\.\d+\.\d+)$/);
  if (!match?.[1] || !match[2]) throw new KiboError("INVALID_INPUT", `expected <id>@<version>, got ${ref ?? "nothing"}`);
  return { id: match[1], version: match[2] };
};

export async function runMarketCommand(argv: string[], deps: Deps): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "keygen") {
      const { values } = parseArgs({ args: rest, options: { out: { type: "string" } } });
      if (!values.out) throw new KiboError("INVALID_INPUT", "--out is required");
      const keys = await generateKeyPair();
      writeFileSync(values.out, `${JSON.stringify(keys)}\n`, { mode: 0o600, flag: "wx" });
      deps.out(`Clé de source écrite dans ${values.out}\nEmpreinte : SHA256 ${formatFingerprint(await keyFingerprint(keys.publicKey))}\n`);
      return 0;
    }
    if (command === "pack") {
      const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" } } });
      const ref = splitRef(positionals[0]);
      const pkg = Kpkg.parse(await deps.rpc({ method: "exportKpkg", ...ref }));
      const file = values.out ?? `${ref.id}-${ref.version}.kpkg`;
      writeFileSync(file, encodeKpkg(pkg), { mode: 0o644 });
      deps.out(`Paquet écrit dans ${file}\n`);
      return 0;
    }
    if (command === "index") {
      const { values } = parseArgs({
        args: rest,
        options: {
          dir: { type: "string" },
          key: { type: "string" },
          id: { type: "string" },
          name: { type: "string" },
          verify: { type: "string", multiple: true },
        },
      });
      if (!values.dir || !values.key || !values.id || !values.name) {
        throw new KiboError("INVALID_INPUT", "--dir, --key, --id and --name are required");
      }
      const keys = KeyFile.parse(JSON.parse(readFileSync(values.key, "utf8")));
      const result = await buildStaticIndex({
        dir: values.dir,
        keys,
        id: values.id,
        name: values.name,
        verified: values.verify ?? [],
        now: deps.now(),
      });
      deps.out(`Index n° ${result.serial} signé (${result.packages} paquets)\n`);
      return 0;
    }
    deps.out(USAGE);
    return 1;
  } catch (e) {
    deps.out(`${e instanceof KiboError ? e.message : String(e)}\n`);
    return 1;
  }
}
```

Dans `packages/cli/src/main.ts`, router `market` vers `runMarketCommand(argv.slice(1), { rpc, out: (t) => process.stdout.write(t), now: () => new Date() })` et sortir avec son code. Dans `packages/cli/src/component.ts`, `publish` accepte `--to <sourceId>` et `--publisher <nom>` : il lit la version du manifeste de `components/src/<id>` et appelle `rpc({ method: "publishToMarket", id, version, sourceId, publisherName })`, puis affiche « Publié sur <sourceId> : index n° <serial> ».

Run: `bun test packages/cli`
Expected: PASS.

- [ ] **Step 10: Vérifications et commit de la CLI**

Run: `bun run check && bun run typecheck`
Expected: aucune erreur.

```bash
git add packages/cli/package.json packages/cli/src/market.ts packages/cli/src/market.test.ts packages/cli/src/market-index-builder.ts packages/cli/src/market-index-builder.test.ts packages/cli/src/main.ts packages/cli/src/component.ts bun.lock
git commit -m "feat(cli): commandes kibo market"
```

---

### Task 23: Partager et rejoindre un projet

Vague 6. Spec G §3.3, §3.4, §5 (point 2), §6 (rôles, retrait), §6.2, §8 (opt-in, test des secrets) ; décisions 7, 9, 22. Review Focus 4.

**Files:**
- Create: `packages/daemon/src/sync/share.ts`
- Create: `packages/daemon/src/sync/share.test.ts`
- Modify: `packages/daemon/src/sync/rpc.ts` (RPC de partage)
- Modify: `packages/daemon/src/service.ts` (`meta.folder` lu depuis `project_settings` pour un projet partagé)
- Modify: `packages/core/src/keys.ts`, `packages/core/src/keys.test.ts` (`restoreLocalAllocation`)
- Modify: `packages/daemon/src/main.ts` (dépendances de partage passées à `handleSyncRpc`)

**Interfaces:**
- Consumes: `SyncClient` (`request`, `send`, `onFrame`, `attachProject`, `detachProject`, `status`, `membersOf`), `SyncDb`, `ProjectHostRegistry` (`host`, `setLocked`, `mutate`, `addJoinedProject`, `localUser`), `startSyncHarness` (T21) ; `migrateForSharing`, `allocateTicketKeys`, `getKeyAllocator`, `listTickets` (T6, T7) ; `toBase64`, `fromBase64`, `generateKeyPair` (T2) ; `MemberInfo`, `ProjectSyncInfo`, `Role` (T4) ; `listDomains(ws)` (phase 2) ; `project_settings` (phase 4).
- Produces :
```ts
export type ShareDeps = { client: SyncClient; db: SyncDb; hosts: ProjectHostRegistry;
  domains(): { id: string; name: string; color: string; guidelines: string }[];
  settings: { get(projectId: string, key: string): string | null; set(projectId: string, key: string, value: string | null): void };
  syncInfo(projectId: string): ProjectSyncInfo };
export function shareProject(deps: ShareDeps, projectId: string): Promise<ProjectSyncInfo>;
export function createProjectInvite(deps: ShareDeps, input: { projectId: string; role: "editor" | "viewer" }): Promise<{ code: string; expiresAt: number }>;
export function joinProject(deps: ShareDeps, input: { code: string; folder: string | null }): Promise<ProjectMeta>;
export function setMemberRole(deps: ShareDeps, input: { projectId: string; userId: string; role: Role | null }): Promise<MemberInfo[]>;
export function unshareProject(deps: ShareDeps, projectId: string): Promise<void>;
export function setBindingRunner(deps: ShareDeps, input: { projectId: string; bindingId: string }): void;
// core/keys.ts
export function restoreLocalAllocation(doc: LoroDoc): { ticketId: string; key: string }[];   // attribue les clés en attente puis keyAllocator = "local"
```
- `handleSyncRpc(client, req, ctx, share?: ShareDeps)` : quatrième paramètre ajouté.
- Hypothèse v0.6 (vérifiée en T0) : une liaison est lue par `doc.getMap("bindings").get(id)` sous forme d'objet `{ createdBy, runner, … }` ; la phase 5 compare `binding.runner` à l'identité locale via une fonction `localIdentity()` qui renverra désormais l'`userId` pour un projet partagé.

- [ ] **Step 1: Test de `restoreLocalAllocation`**

Ajout à `packages/core/src/keys.test.ts` :
```ts
test("restoreLocalAllocation keys pending tickets and gives allocation back to the daemon", () => {
  const doc = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#14B8A6" });
  enableServerAllocation(doc);
  createTicket(doc, { title: "En attente" });
  expect(listTickets(doc)[0]?.key).toBeNull();
  expect(restoreLocalAllocation(doc)).toEqual([{ ticketId: listTickets(doc)[0]?.id ?? "", key: "KIB-1" }]);
  expect(getKeyAllocator(doc)).toBe("local");
  expect(createTicket(doc, { title: "Local" }).key).toBe("KIB-2");
});
```

- [ ] **Step 2: Vérifier l'échec puis implémenter**

Run: `bun test packages/core/src/keys.test.ts`
Expected: FAIL « restoreLocalAllocation is not a function ».

Ajout à `packages/core/src/keys.ts` :
```ts
export function restoreLocalAllocation(doc: LoroDoc): { ticketId: string; key: string }[] {
  const allocated = allocateTicketKeys(doc);
  doc.getMap("meta").set("keyAllocator", "local");
  doc.commit();
  return allocated;
}
```

Run: `bun test packages/core/src/keys.test.ts`
Expected: PASS.

- [ ] **Step 3: Écrire les tests du partage**

`packages/daemon/src/sync/share.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listTickets } from "@kibo/core";
import type { ProjectMeta, RpcRequest } from "@kibo/schema";
import { ProjectRoom } from "@kibo/sync-server";
import { generateKeyPair } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import { startSyncHarness, type SyncHarness } from "../testing/sync-harness";
import { createProjectInvite, joinProject, type ShareDeps, setBindingRunner, setMemberRole, shareProject } from "./share";

let h: SyncHarness;
const ctx = { sessionHash: "t", remote: false };
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = (i: number, req: RpcRequest) => d(i).service.handle(req, ctx);
const deps = (i: number): ShareDeps => d(i).share;

beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2 });
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
});
afterEach(async () => {
  await h.stop();
});

async function sharedProject(): Promise<string> {
  const meta = (await rpc(0, {
    method: "createProject", name: "Kibo", key: "KIB", folder: "/Users/adam/goinfre/Kibo", color: "#14B8A6",
  })) as ProjectMeta;
  await rpc(0, {
    method: "command", projectId: meta.id,
    command: { method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "adam" } },
  });
  await shareProject(deps(0), meta.id);
  return meta.id;
}

function serverBytes(): Buffer {
  const dir = h.server.dataDir;
  return Buffer.concat(
    readdirSync(dir).filter((f) => f.startsWith("sync.db")).map((f) => readFileSync(join(dir, f))),
  );
}

test("the snapshot sent to the server has no local folder and migrated assignees", async () => {
  const p = await sharedProject();
  const room = ProjectRoom.load(h.server.server.sdb, p);
  const json = JSON.stringify(LoroDoc.fromSnapshot(room.snapshotBytes()).toJSON());
  expect(json).not.toContain("/Users/adam");
  const adamId = d(0).client.status().user?.id ?? "";
  expect(json).toContain(adamId);
  expect(json).not.toContain('"ref":"adam"');
  const snap = (await rpc(0, { method: "getProject", projectId: p })) as { meta: ProjectMeta };
  expect(snap.meta.folder).toBe("/Users/adam/goinfre/Kibo");
});

test("no fake secret ever reaches the server", async () => {
  await d(0).secrets.set("github", "ghp_TESTSECRET000");
  const publisher = await generateKeyPair();
  await d(0).secrets.set("market:publisher", JSON.stringify({ name: "Adam", ...publisher }));
  const p = await sharedProject();
  const code = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await joinProject(deps(1), { code: code.code, folder: null });
  await rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Depuis Léa" } });
  await h.waitUntil(() => listTickets(d(0).service.hosts.host(p).doc()).length === 2);
  const device = JSON.parse((await d(0).secrets.get("sync:device")) ?? "{}") as { privateKey: string };
  const bytes = serverBytes();
  expect(bytes.includes(Buffer.from("ghp_TESTSECRET000"))).toBe(false);
  for (const key of [device.privateKey, publisher.privateKey]) {
    expect(bytes.includes(Buffer.from(key))).toBe(false);
    expect(bytes.includes(Buffer.from(key, "base64"))).toBe(false);
  }
});

test("a share retried after a dropped connection is idempotent", async () => {
  const meta = (await rpc(0, { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" })) as ProjectMeta;
  const first = shareProject(deps(0), meta.id);
  h.server.server.hub.kickDevice(d(0).client.status().deviceId ?? "", 1011);
  await first.catch((e: unknown) => expect(e).toMatchObject({ code: "SYNC_OFFLINE" }));
  await h.waitUntil(() => d(0).client.status().state === "online", 30_000);
  const info = await shareProject(deps(0), meta.id);
  expect(info.shared).toBe(true);
  expect(((await rpc(0, { method: "listProjects" })) as unknown[]).length).toBe(1);
  await rpc(0, { method: "command", projectId: meta.id, command: { method: "createTicket", title: "Après" } });
}, 40_000);

test("commands wait out a share in progress with CONFLICT", async () => {
  const meta = (await rpc(0, { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" })) as ProjectMeta;
  const sharing = shareProject(deps(0), meta.id);
  await expect(
    rpc(0, { method: "command", projectId: meta.id, command: { method: "createTicket", title: "Pendant" } }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await sharing;
});

test("an editor joins and sees the tickets; the owner can remove her", async () => {
  const p = await sharedProject();
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  const meta = await joinProject(deps(1), { code: `  ${code.toLowerCase()} `, folder: "/Users/lea/Kibo" });
  expect(meta.key).toBe("KIB");
  expect(listTickets(d(1).service.hosts.host(p).doc()).map((t) => t.title)).toEqual(["Schéma"]);
  const leaId = d(1).client.status().user?.id ?? "";
  const members = await setMemberRole(deps(0), { projectId: p, userId: leaId, role: null });
  expect(members.map((m) => m.userId)).not.toContain(leaId);
  await h.waitUntil(() => d(1).client.status().projects.some((x) => x.projectId === p && x.accessRevoked));
  await expect(
    rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("a viewer joins read-only", async () => {
  const p = await sharedProject();
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "viewer" });
  await joinProject(deps(1), { code, folder: null });
  await expect(
    rpc(1, { method: "command", projectId: p, command: { method: "createTicket", title: "Non" } }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("joining a project whose key is already used locally fails clearly", async () => {
  const p = await sharedProject();
  await rpc(1, { method: "createProject", name: "Autre", key: "KIB", folder: null, color: "#14B8A6" });
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await expect(joinProject(deps(1), { code, folder: null })).rejects.toMatchObject({
    code: "INVALID_INPUT",
    detail: "duplicate project key KIB",
  });
  expect(d(1).client.status().projects.some((x) => x.projectId === p)).toBe(false);
});

test("an editor who does not own a binding cannot take its runner", async () => {
  const p = await sharedProject();
  d(0).service.hosts.mutate(p, (doc) => {
    doc.getMap("bindings").set("b1", { id: "b1", createdBy: d(0).client.status().user?.id, runner: d(0).client.status().user?.id });
    doc.commit();
  });
  const { code } = await createProjectInvite(deps(0), { projectId: p, role: "editor" });
  await joinProject(deps(1), { code, folder: null });
  await h.waitUntil(() => d(1).service.hosts.host(p).doc().getMap("bindings").get("b1") !== undefined);
  expect(() => setBindingRunner(deps(1), { projectId: p, bindingId: "b1" })).toThrow("FORBIDDEN");
  setBindingRunner(deps(0), { projectId: p, bindingId: "b1" });
});
```
Le harnais (T21) gagne `share: ShareDeps` sur chaque `HarnessDaemon`, construit comme dans `main.ts` (étape 6), avec des domaines vides et une table `project_settings` réelle.

Le test des secrets cherche le jeton GitHub en clair et chaque clé privée en base64 comme décodée, dans le fichier `sync.db` et ses fichiers WAL (qui contiennent snapshots et mises à jour).

- [ ] **Step 4: Vérifier l'échec**

Run: `bun test packages/daemon/src/sync/share.test.ts`
Expected: FAIL « Cannot find module './share' ».

- [ ] **Step 5: Implémenter `share.ts`**

`packages/daemon/src/sync/share.ts` :
```ts
import { getProjectMeta, listTickets, migrateForSharing, restoreLocalAllocation } from "@kibo/core";
import {
  KiboError,
  type MemberInfo,
  type ProjectMeta,
  type ProjectSyncInfo,
  type Role,
  type ServerFrame,
} from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc } from "loro-crdt";
import type { SyncClient } from "./sync-client";
import type { SyncDb } from "./sync-db";
import type { ProjectHostRegistry } from "./types";

export type ShareDeps = {
  client: SyncClient;
  db: SyncDb;
  hosts: ProjectHostRegistry;
  domains(): { id: string; name: string; color: string; guidelines: string }[];
  settings: { get(projectId: string, key: string): string | null; set(projectId: string, key: string, value: string | null): void };
  syncInfo(projectId: string): ProjectSyncInfo;
};

const SHARE_TIMEOUT_MS = 30_000;
const rid = () => crypto.randomUUID();

function requireOnline(deps: ShareDeps): { userId: string } {
  const config = deps.db.config();
  if (!config) throw new KiboError("INVALID_INPUT", "no sync server is configured");
  if (deps.client.status().state !== "online") throw new KiboError("SYNC_OFFLINE", "the sync server is unreachable");
  return { userId: config.userId };
}

function requireOwner(deps: ShareDeps, projectId: string): void {
  const row = deps.db.project(projectId);
  if (!row || row.accessRevoked) throw new KiboError("INVALID_INPUT", `project ${projectId} is not shared`);
  if (row.role !== "owner") throw new KiboError("FORBIDDEN", `only an owner can manage project ${projectId}`);
}

export async function shareProject(deps: ShareDeps, projectId: string): Promise<ProjectSyncInfo> {
  const { userId } = requireOnline(deps);
  const row = deps.db.project(projectId);
  if (row?.enabled && !row.accessRevoked) return deps.syncInfo(projectId);
  const host = deps.hosts.host(projectId);
  deps.hosts.setLocked(projectId, true);
  try {
    const doc = host.doc();
    const used = new Set(listTickets(doc).map((t) => t.domainId));
    const domains = deps.domains().filter((dm) => used.has(dm.id));
    const moved = { folder: null as string | null };
    deps.hosts.mutate(projectId, (d) => {
      moved.folder = migrateForSharing(d, { localUser: deps.hosts.localUser(), userId, domains }).folder;
    });
    if (moved.folder !== null) deps.settings.set(projectId, "folder", moved.folder);
    await deps.client.request(
      {
        type: "share",
        projectId,
        requestId: rid(),
        name: getProjectMeta(doc).name,
        snapshot: toBase64(host.doc().export({ mode: "snapshot" })),
      },
      "shared",
      SHARE_TIMEOUT_MS,
    );
    deps.client.attachProject(projectId, "owner");
    return deps.syncInfo(projectId);
  } finally {
    deps.hosts.setLocked(projectId, false);
  }
}

export async function createProjectInvite(
  deps: ShareDeps,
  input: { projectId: string; role: "editor" | "viewer" },
): Promise<{ code: string; expiresAt: number }> {
  requireOnline(deps);
  requireOwner(deps, input.projectId);
  const f = await deps.client.request({ type: "invite", projectId: input.projectId, requestId: rid(), role: input.role }, "invite-code");
  return { code: f.code, expiresAt: f.expiresAt };
}

function firstUpdate(deps: ShareDeps, projectId: string): Promise<Extract<ServerFrame, { type: "update" }>> {
  return new Promise((resolve, reject) => {
    const off = deps.client.onFrame((f) => {
      if (f.type === "update" && f.projectId === projectId) {
        off();
        clearTimeout(timer);
        resolve(f);
      }
    });
    const timer = setTimeout(() => {
      off();
      reject(new KiboError("SYNC_OFFLINE", `no data received for project ${projectId}`));
    }, SHARE_TIMEOUT_MS);
  });
}

export async function joinProject(deps: ShareDeps, input: { code: string; folder: string | null }): Promise<ProjectMeta> {
  requireOnline(deps);
  const joined = await deps.client.request({ type: "redeem", requestId: rid(), code: input.code }, "joined");
  const received = firstUpdate(deps, joined.projectId);
  deps.client.send({ type: "subscribe", projectId: joined.projectId, version: null });
  const update = await received;
  deps.client.send({ type: "unsubscribe", projectId: joined.projectId });
  const doc = new LoroDoc();
  doc.import(fromBase64(update.bytes));
  const key = getProjectMeta(doc).key;
  let meta: ProjectMeta;
  try {
    meta = deps.hosts.addJoinedProject(doc, input.folder);
  } catch (e) {
    if (e instanceof KiboError && e.code === "INVALID_INPUT") {
      throw new KiboError("INVALID_INPUT", `duplicate project key ${key}`);
    }
    throw e;
  }
  if (input.folder !== null) deps.settings.set(meta.id, "folder", input.folder);
  deps.db.upsertProject({
    projectId: meta.id,
    enabled: true,
    role: joined.role,
    lastServerVersion: fromBase64(update.version),
    lastSyncAt: null,
    lastError: null,
    accessRevoked: false,
  });
  deps.client.attachProject(meta.id, joined.role);
  return meta;
}

function nextMembers(deps: ShareDeps, projectId: string): Promise<MemberInfo[]> {
  return new Promise((resolve) => {
    const off = deps.client.onFrame((f) => {
      if (f.type === "members" && f.projectId === projectId) {
        off();
        resolve(f.members);
      }
    });
  });
}

export async function setMemberRole(
  deps: ShareDeps,
  input: { projectId: string; userId: string; role: Role | null },
): Promise<MemberInfo[]> {
  requireOnline(deps);
  requireOwner(deps, input.projectId);
  const members = nextMembers(deps, input.projectId);
  await deps.client.request({ type: "set-role", requestId: rid(), ...input }, "done");
  return members;
}

export async function unshareProject(deps: ShareDeps, projectId: string): Promise<void> {
  requireOnline(deps);
  requireOwner(deps, projectId);
  await deps.client.request({ type: "unshare", projectId, requestId: rid() }, "done");
  deps.client.detachProject(projectId);
  deps.hosts.mutate(projectId, (doc) => {
    restoreLocalAllocation(doc);
  });
}

export function setBindingRunner(deps: ShareDeps, input: { projectId: string; bindingId: string }): void {
  const config = deps.db.config();
  if (!config) throw new KiboError("INVALID_INPUT", "no sync server is configured");
  const row = deps.db.project(input.projectId);
  const doc = deps.hosts.host(input.projectId).doc();
  const binding = doc.getMap("bindings").get(input.bindingId) as { createdBy?: string } | undefined;
  if (!binding) throw new KiboError("NOT_FOUND", `binding ${input.bindingId} not found`);
  if (row?.role !== "owner" && binding.createdBy !== config.userId) {
    throw new KiboError("FORBIDDEN", "only the binding owner or a project owner can change its runner");
  }
  deps.hosts.mutate(input.projectId, (d) => {
    d.getMap("bindings").set(input.bindingId, { ...binding, runner: config.userId });
    d.commit();
  });
}
```

`rpc.ts` (T21) gagne le paramètre `share?: ShareDeps` et les cas :
```ts
    case "shareProject":
      return { handled: true, result: await shareProject(need(share), req.projectId) };
    case "createProjectInvite":
      return { handled: true, result: await createProjectInvite(need(share), req) };
    case "joinProject":
      return { handled: true, result: await joinProject(need(share), req) };
    case "setMemberRole":
      return { handled: true, result: await setMemberRole(need(share), req) };
    case "unshareProject":
      await unshareProject(need(share), req.projectId);
      return { handled: true, result: null };
    case "setBindingRunner":
      setBindingRunner(need(share), req);
      return { handled: true, result: null };
```
avec
```ts
const need = (share: ShareDeps | undefined): ShareDeps => {
  if (!share) throw new KiboError("INTERNAL", "sharing is not wired");
  return share;
};
```

- [ ] **Step 6: Dossier local et câblage**

Dans `service.ts`, `getProject` et `listProjects` remplacent `meta.folder` par `opts.localFolder?.(projectId) ?? meta.folder`, où l'option `localFolder` lit `project_settings(projectId, "folder")`. Un projet jamais partagé n'a pas cette clé : comportement v0.6 inchangé. Dans `main.ts` et dans `startSyncHarness`, `ShareDeps` est construit avec `client`, `syncDb`, `service.hosts`, `domains: () => listDomains(workspace)` (phase 2), `settings` (accès `project_settings`) et `syncInfo: (id) => projectSyncInfo({ row: syncDb.project(id), doc: service.hosts.host(id).doc(), members: client.membersOf(id) })`.

- [ ] **Step 7: Vérifier**

Run: `bun test packages/daemon/src/sync/share.test.ts packages/core/src/keys.test.ts`
Expected: PASS (8 tests de partage, 1 de `core`).

Run: `bun test packages components && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/daemon/src/sync/share.ts packages/daemon/src/sync/share.test.ts packages/daemon/src/sync/rpc.ts \
  packages/daemon/src/service.ts packages/daemon/src/main.ts packages/daemon/src/testing/sync-harness.ts \
  packages/core/src/keys.ts packages/core/src/keys.test.ts
git commit -m "feat(daemon): partager et rejoindre un projet"
```

---

### Task 24: Présence

Vague 6. Spec G §6.1 ; décision 10 (côté serveur, livrée en T17) ; décision 19 (exposition aux composants, T30).

**Files:**
- Create: `packages/daemon/src/sync/presence.ts`
- Create: `packages/daemon/src/sync/presence.test.ts`
- Modify: `packages/daemon/src/sync/rpc.ts` (`setPresence`, `getPresence`)
- Modify: `packages/daemon/src/main.ts` (création du hub, minuterie de 10 s, branchement des runs)
- Modify: `packages/daemon/src/testing/sync-harness.ts` (hub et faux runs par démon)

**Interfaces:**
- Consumes: `SyncClient.onFrame`, `SyncClient.send`, `SyncClient.status`, `SyncDb`, `startSyncHarness` (T21) ; `PresenceState`, `PresenceRun`, `PresencePeer`, `SYNC_LIMITS`, `ClientFrame`, `DaemonEvent` (T4) ; `toBase64`, `fromBase64` (T2) ; `EphemeralStore` (`loro-crdt`) ; runs actifs (phase 2).
- Produces :
```ts
export type PresenceDeps = {
  send(frame: ClientFrame): void;
  identity(): { userId: string; name: string; deviceId: string } | null;
  runs(projectId: string): PresenceRun[];
  shared(projectId: string): boolean;
  online(): boolean;
  emit(event: DaemonEvent): void;
  log(message: string, error?: unknown): void;
  timeoutMs: number;
};
export class PresenceHub {
  constructor(deps: PresenceDeps);
  set(projectId: string, where: { pageId: string | null; ticketId: string | null }): void;
  receive(projectId: string, bytes: Uint8Array): void;
  peers(projectId: string): PresencePeer[];
  refreshRuns(): void;
  tick(): void;
  forget(projectId: string): void;
  dispose(): void;
}
export type FakeRuns = { active(): (PresenceRun & { projectId: string; ticketId: string })[];
  set(runs: (PresenceRun & { projectId: string; ticketId: string })[]): void; onChange(listener: () => void): () => void };
```
- `HarnessDaemon` gagne `presence: PresenceHub` et `runs: FakeRuns` ; `startSyncHarness(opts: { daemons: number; presenceTimeoutMs?: number })`.
- Hypothèse v0.6 (vérifiée en T0) : chaque élément de `runs.active()` porte `projectId`, et `runs.onChange(listener)` notifie tout changement d'état d'un run.

- [ ] **Step 1: Écrire les tests**

`packages/daemon/src/sync/presence.test.ts` :
```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectMeta, RpcRequest } from "@kibo/schema";
import { startSyncHarness, type SyncHarness } from "../testing/sync-harness";
import { createProjectInvite, joinProject, shareProject } from "./share";

let h: SyncHarness;
let project: string;
const ctx = { sessionHash: "t", remote: false };
const d = (i: number) => {
  const x = h.daemons[i];
  if (!x) throw new Error("no daemon");
  return x;
};
const rpc = (i: number, req: RpcRequest) => d(i).service.handle(req, ctx);

beforeEach(async () => {
  h = await startSyncHarness({ daemons: 2, presenceTimeoutMs: 400 });
  await h.connect(0, "Adam");
  await h.connect(1, "Léa");
  const meta = (await rpc(0, { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" })) as ProjectMeta;
  project = meta.id;
  await shareProject(d(0).share, project);
  const { code } = await createProjectInvite(d(0).share, { projectId: project, role: "editor" });
  await joinProject(d(1).share, { code, folder: null });
});
afterEach(async () => {
  await h.stop();
});

test("two daemons see each other's page and ticket", async () => {
  await rpc(0, { method: "setPresence", projectId: project, pageId: "pg1", ticketId: "t1" });
  await h.waitUntil(() => d(1).presence.peers(project).some((p) => !p.self && p.pageId === "pg1"));
  const adam = d(1).presence.peers(project).find((p) => !p.self);
  expect(adam).toMatchObject({ name: "Adam", pageId: "pg1", ticketId: "t1", runs: [] });
  const mine = (await rpc(0, { method: "getPresence", projectId: project })) as { self: boolean }[];
  expect(mine.some((p) => p.self)).toBe(true);
});

test("a peer that stops refreshing expires", async () => {
  d(0).presence.set(project, { pageId: "pg1", ticketId: null });
  await h.waitUntil(() => d(1).presence.peers(project).some((p) => !p.self));
  d(0).client.stop();
  await Bun.sleep(800);
  d(1).presence.tick();
  expect(d(1).presence.peers(project).some((p) => !p.self)).toBe(false);
});

test("a colleague's run is visible without entering the local queue", async () => {
  d(0).presence.set(project, { pageId: null, ticketId: null });
  d(0).runs.set([{ projectId: project, ticketId: "t1", ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }]);
  await h.waitUntil(() => d(1).presence.peers(project).some((p) => p.runs.length === 1));
  const adam = d(1).presence.peers(project).find((p) => !p.self);
  expect(adam?.runs).toEqual([{ ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }]);
  expect(d(1).runs.active()).toEqual([]);
});

test("presence is never written to disk", async () => {
  d(0).presence.set(project, { pageId: null, ticketId: null });
  d(0).runs.set([{ projectId: project, ticketId: "t1", ticketKey: "KIB-12", profile: "presence-marker-profile", state: "running" }]);
  await h.waitUntil(() => d(1).presence.peers(project).some((p) => p.runs.length === 1));
  for (const i of [0, 1]) {
    const bytes = Buffer.concat(
      readdirSync(d(i).home).filter((f) => f.startsWith("kibo.db")).map((f) => readFileSync(join(d(i).home, f))),
    );
    expect(bytes.includes(Buffer.from("presence-marker-profile"))).toBe(false);
  }
});

test("presence is ignored for a project that is not shared", async () => {
  const meta = (await rpc(0, { method: "createProject", name: "Solo", key: "SOL", folder: null, color: "#14B8A6" })) as ProjectMeta;
  await rpc(0, { method: "setPresence", projectId: meta.id, pageId: "pg1", ticketId: null });
  expect(d(0).presence.peers(meta.id)).toEqual([]);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/daemon/src/sync/presence.test.ts`
Expected: FAIL « Cannot find module './presence' » (ou `presence` absent du harnais).

- [ ] **Step 3: Implémenter `presence.ts`**

`packages/daemon/src/sync/presence.ts` :
```ts
import {
  type ClientFrame,
  type DaemonEvent,
  type PresencePeer,
  type PresenceRun,
  PresenceState,
} from "@kibo/schema";
import { toBase64 } from "@kibo/trust";
import { EphemeralStore } from "loro-crdt";

export type PresenceDeps = {
  send(frame: ClientFrame): void;
  identity(): { userId: string; name: string; deviceId: string } | null;
  runs(projectId: string): PresenceRun[];
  shared(projectId: string): boolean;
  online(): boolean;
  emit(event: DaemonEvent): void;
  log(message: string, error?: unknown): void;
  timeoutMs: number;
};

type Where = { pageId: string | null; ticketId: string | null };
type Entry = { store: EphemeralStore; off: () => void; where: Where };

export class PresenceHub {
  private readonly projects = new Map<string, Entry>();

  constructor(private readonly deps: PresenceDeps) {}

  set(projectId: string, where: Where): void {
    if (!this.deps.shared(projectId)) return;
    const entry = this.entry(projectId);
    entry.where = where;
    this.publish(projectId, entry);
  }

  receive(projectId: string, bytes: Uint8Array): void {
    if (!this.deps.shared(projectId)) return;
    this.entry(projectId).store.apply(bytes);
  }

  peers(projectId: string): PresencePeer[] {
    const entry = this.projects.get(projectId);
    const me = this.deps.identity();
    if (!entry || !me) return [];
    const peers: PresencePeer[] = [];
    for (const [deviceId, value] of Object.entries(entry.store.getAllStates())) {
      const parsed = PresenceState.safeParse(value);
      if (!parsed.success) {
        this.deps.log(`invalid presence state from ${deviceId}: ${parsed.error.message}`);
        continue;
      }
      peers.push({ ...parsed.data, deviceId, self: deviceId === me.deviceId });
    }
    return peers.sort((a, b) => a.name.localeCompare(b.name));
  }

  refreshRuns(): void {
    for (const [projectId, entry] of this.projects) this.publish(projectId, entry);
  }

  tick(): void {
    for (const [projectId, entry] of this.projects) {
      this.publish(projectId, entry);
      this.deps.emit({ type: "presence", projectId });
    }
  }

  forget(projectId: string): void {
    const entry = this.projects.get(projectId);
    if (!entry) return;
    entry.off();
    entry.store.destroy();
    this.projects.delete(projectId);
  }

  dispose(): void {
    for (const id of [...this.projects.keys()]) this.forget(id);
  }

  private entry(projectId: string): Entry {
    const existing = this.projects.get(projectId);
    if (existing) return existing;
    const store = new EphemeralStore(this.deps.timeoutMs);
    const off = store.subscribe(() => this.deps.emit({ type: "presence", projectId }));
    const entry: Entry = { store, off, where: { pageId: null, ticketId: null } };
    this.projects.set(projectId, entry);
    return entry;
  }

  private publish(projectId: string, entry: Entry): void {
    const me = this.deps.identity();
    if (!me) return;
    const state = PresenceState.parse({
      userId: me.userId,
      name: me.name,
      pageId: entry.where.pageId,
      ticketId: entry.where.ticketId,
      runs: this.deps.runs(projectId).slice(0, 50),
    });
    entry.store.set(me.deviceId, state);
    if (!this.deps.online()) return;
    this.deps.send({ type: "presence", projectId, bytes: toBase64(entry.store.encode(me.deviceId)) });
  }
}
```

- [ ] **Step 4: RPC et câblage**

Dans `rpc.ts`, `handleSyncRpc` reçoit aussi `presence?: PresenceHub` (cinquième paramètre) :
```ts
    case "setPresence":
      needPresence(presence).set(req.projectId, { pageId: req.pageId, ticketId: req.ticketId });
      return { handled: true, result: null };
    case "getPresence":
      return { handled: true, result: needPresence(presence).peers(req.projectId) };
```
avec `needPresence` sur le modèle de `need` (T23). Dans `main.ts` :
```ts
const presence = new PresenceHub({
  send: (frame) => sync.send(frame),
  identity: () => {
    const s = sync.status();
    return s.user && s.deviceId ? { userId: s.user.id, name: s.user.name, deviceId: s.deviceId } : null;
  },
  runs: (projectId) =>
    runs.active().filter((r) => r.projectId === projectId)
      .map((r) => ({ ticketKey: r.ticketKey, profile: r.profile, state: r.state })),
  shared: (projectId) => syncDb.project(projectId)?.enabled === true,
  online: () => sync.status().state === "online",
  emit: events.publish,
  log: (message, error) => console.error(`[kibo-daemon] ${message}`, error ?? ""),
  timeoutMs: SYNC_LIMITS.presenceTimeoutMs,
});
sync.onFrame((f) => {
  if (f.type === "presence") presence.receive(f.projectId, fromBase64(f.bytes));
  if (f.type === "welcome") presence.tick();
  if (f.type === "revoked") presence.forget(f.projectId);
});
runs.onChange(() => presence.refreshRuns());
const presenceTimer = setInterval(() => presence.tick(), SYNC_LIMITS.presenceRefreshMs);
```
et `clearInterval(presenceTimer); presence.dispose();` dans `shutdown`. `startSyncHarness` construit le même hub par démon avec `presenceTimeoutMs` (défaut `SYNC_LIMITS.presenceTimeoutMs`) et un `FakeRuns` :
```ts
function fakeRuns(): FakeRuns {
  let current: ReturnType<FakeRuns["active"]> = [];
  const listeners = new Set<() => void>();
  return {
    active: () => current,
    set: (runs) => {
      current = runs;
      for (const l of listeners) l();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```
Le harnais branche `runs.onChange(() => presence.refreshRuns())` et les trames `presence` comme `main.ts`, mais n'installe pas la minuterie de 10 s : les tests appellent `tick()` quand ils en ont besoin.

- [ ] **Step 5: Vérifier**

Run: `bun test packages/daemon/src/sync/presence.test.ts`
Expected: PASS (5 tests).

Run: `bun test packages/daemon && bun run check && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/daemon/src/sync/presence.ts packages/daemon/src/sync/presence.test.ts packages/daemon/src/sync/rpc.ts \
  packages/daemon/src/main.ts packages/daemon/src/testing/sync-harness.ts
git commit -m "feat(daemon): présence"
```

---

### Task 25: UI Paramètres › Sécurité et appairage par code

Vague 3. Écrans à dessiner **S8** (Paramètres › Sécurité) et **M7** (bannière et ligne de l'écran 19), maquettes existantes **15** (« Accès web · Générer un code »), **19** (premier lancement) et **31** (appairage par code à 6 caractères). Prérequis : S8 et M7 dessinés dans Penpot, en sombre et en clair ; T9, T12, T13 intégrés. Tous les textes viennent des descriptions S8 / M7 du plan et de la maquette 31, mot pour mot, dans `fr.ts` (section `security`), au tutoiement.

**Files:**
- Create: `packages/ui/src/pages/settings/SecuritySettings.tsx`, `packages/ui/src/dialogs/EnableRemoteAccessDialog.tsx`, `packages/ui/src/dialogs/PairingCodeDialog.tsx`, `packages/ui/src/pages/components/SandboxBanner.tsx`, `packages/ui/src/lib/pairing-code.ts`, `packages/ui/src/state/use-rpc-query.ts` (si absent en v0.6)
- Modify: `packages/ui/src/i18n/fr.ts` (section `security`, `pairing`), `packages/ui/src/shell/PairingScreen.tsx`, `packages/ui/src/shell/screens.test.tsx` (attente du texte de pied de l'écran 31, voir Step 5), `packages/ui/src/pages/settings/sections.ts` (`SETTINGS_SECTIONS`), la section « Accès web » de l'écran 15 (`packages/ui/src/pages/settings/AppearanceSettings.tsx`), `packages/ui/src/pages/FirstRunPage.tsx`, `packages/ui/src/pages/components/ComponentsPage.tsx`
- Add (shadcn, si absents de `packages/sdk/src/ui`) : `switch`, `table`, `alert`, `alert-dialog`, `checkbox` par `cd packages/sdk && bunx --bun shadcn@latest add switch table alert alert-dialog checkbox` (aucune nouvelle dépendance npm : ils reposent sur `radix-ui`, déjà présent ; vérifier `bun.lock` inchangé hors `packages/sdk/src/ui`)
- Test: `packages/ui/src/pages/settings/security-settings.test.tsx`, `packages/ui/src/shell/pairing-screen.test.tsx`, `packages/ui/src/lib/pairing-code.test.ts`

**Interfaces:**
- Consumes: RPC `getRemoteAccess`, `enableRemoteAccess`, `disableRemoteAccess`, `createPairingCode`, `listSessions`, `revokeSession`, `getSandboxStatus`, `setAllowUnsandboxed` ; types `RemoteAccessStatus`, `SessionInfo`, `SandboxStatus`, `PairingCode` (T4) ; `client.pairWithCode(code)` (T13) ; événements `sessions` et `sandbox`.
- Produces (nouveau, signalé) :
  ```ts
  // packages/ui/src/lib/pairing-code.ts
  export function formatPairingCode(code: string): string;          // "K7Q4M2" ⇒ "K7Q-4M2"
  export function remaining(expiresAt: number, now: number): string; // "4:59", "0:00"
  // packages/ui/src/state/use-rpc-query.ts
  export function useRpcQuery<R extends RpcRequest>(req: R, refreshOn: DaemonEvent["type"][]): { data: RpcResult[R["method"]] | null; error: KiboError | null; reload(): void };
  // composants
  export function SecuritySettings(): JSX.Element;
  export function EnableRemoteAccessDialog(props: { status: RemoteAccessStatus; open: boolean; onOpenChange(o: boolean): void; onEnabled(s: RemoteAccessStatus): void }): JSX.Element;
  export function PairingCodeDialog(props: { open: boolean; onOpenChange(o: boolean): void; now?: () => number }): JSX.Element;
  export function SandboxBanner(): JSX.Element | null;
  ```
- Hypothèse v0.6 (vérifiée en T0) : le client expose `client.onEvent(listener: (e: DaemonEvent) => void): () => void` ; `SETTINGS_SECTIONS: { id: string; label: string; element: () => JSX.Element }[]` ; `FirstRunPage` affiche ses vérifications par un composant `CheckRow({ title, detail, state: "ok" | "warn" | "error", action? })`.

- [ ] **Step 1: Textes de l'interface**

Ajouter à `packages/ui/src/i18n/fr.ts` :
```ts
  security: {
    title: "Sécurité",
    remote: {
      title: "Accès distant",
      help: "Le démon n'écoute que sur 127.0.0.1. L'accès distant ouvre un second port, chiffré, sur une interface que tu choisis.",
      toggle: "Activer l'accès distant",
      dialogTitle: "Activer l'accès distant",
      iface: "Interface",
      port: "Port",
      certificate: "Certificat",
      selfSigned: "Auto-signé",
      provided: "Fourni",
      certFile: "Certificat (.pem)",
      keyFile: "Clé privée (.pem)",
      warning: "Cet appareil sera joignable depuis le réseau par toute personne qui obtient un code d'appairage.",
      consent: "Je comprends que cet appareil sera joignable depuis le réseau",
      enable: "Activer",
      enabling: "Activation…",
      url: "Adresse",
      fingerprint: "Empreinte SHA-256",
      verify: "Vérifie cette empreinte dans ton navigateur à la première connexion.",
      disable: "Désactiver",
      disableTitle: "Désactiver l'accès distant ?",
      disableHelp: "Les navigateurs distants perdront l'accès immédiatement.",
      failed: "Impossible d'activer l'accès distant.",
      resumeFailed: (why: string) => `L'accès distant n'a pas pu reprendre : ${why}`,
    },
    sessions: {
      title: "Sessions",
      help: "Une session expire après 30 jours sans activité.",
      device: "Appareil",
      type: "Type",
      created: "Créée",
      lastSeen: "Dernière activité",
      expires: "Expire",
      local: "Local",
      remote: "Distant",
      current: "Cette session",
      revoke: "Révoquer",
      empty: "Aucune session active.",
    },
    isolation: {
      title: "Isolation des composants",
      bwrap: "bubblewrap actif",
      sandboxExec: "sandbox-exec actif",
      unavailable: (reason: string) => `Indisponible : ${reason}`,
      fix: "Pour l'activer :",
      allow: "Autoriser les backends sandboxés sans isolation OS",
      allowTitle: "Autoriser sans isolation OS ?",
      allowWarning:
        "Un composant sandboxé pourra accéder au réseau et à tes fichiers si le runtime a une faille. Ne l'active que si tu fais confiance à tous tes composants.",
      allowConfirm: "Autoriser quand même",
      banner: "Les backends sandboxés sont arrêtés : isolation OS indisponible.",
      firstRun: "Isolation des composants",
      firstRunOk: (kind: string) => `${kind} détecté`,
    },
  },
```
Et remplacer la section `pairing` par :
```ts
  pairing: {
    title: "Appairer ce navigateur",
    help: "Dans l'app Kibo : Paramètres › Apparence & général › Accès web › Générer un code. Entre le code à 6 caractères ci-dessous.",
    code: "Code d'appairage",
    digit: (n: number) => `Caractère ${n} sur 6`,
    validity: "Code valable 5 minutes · usage unique",
    submit: "Appairer",
    invalid: "Code invalide ou expiré.",
    security:
      "Le démon n'écoute que sur 127.0.0.1. Le code est échangé contre un cookie HttpOnly, révocable dans Paramètres › Sécurité.",
    generate: "Générer un code",
    generateTitle: "Code d'appairage",
    generateHelp: "Saisis ce code dans le navigateur à appairer.",
    expiresIn: (left: string) => `Expire dans ${left}`,
    expired: "Code expiré.",
    regenerate: "Générer un nouveau code",
    copy: "Copier",
  },
```

- [ ] **Step 2: Écrire les tests des helpers et de l'écran 31**

`packages/ui/src/lib/pairing-code.test.ts` :
```ts
import { expect, test } from "bun:test";
import { formatPairingCode, remaining } from "./pairing-code";

test("formats a pairing code as two groups of three", () => {
  expect(formatPairingCode("K7Q4M2")).toBe("K7Q-4M2");
});
test("remaining time is m:ss and never negative", () => {
  expect(remaining(300_000, 1_000)).toBe("4:59");
  expect(remaining(300_000, 299_500)).toBe("0:01");
  expect(remaining(300_000, 400_000)).toBe("0:00");
});
```

`packages/ui/src/shell/pairing-screen.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const codes: string[] = [];
let outcome: () => Promise<void> = () => Promise.resolve();
mock.module("../api", () => ({
  client: {
    pairWithCode: (code: string) => {
      codes.push(code);
      return outcome();
    },
  },
}));
const { PairingScreen } = await import("./PairingScreen");

beforeEach(() => {
  codes.length = 0;
  outcome = () => Promise.resolve();
});

test("six boxes, typing advances, submit sends the normalised code", async () => {
  const paired = mock(() => {});
  render(<PairingScreen onPaired={paired} />);
  const boxes = screen.getAllByRole("textbox");
  expect(boxes).toHaveLength(6);
  await userEvent.type(boxes[0] as HTMLElement, "k7q4m2");
  expect(boxes.map((b) => (b as HTMLInputElement).value).join("")).toBe("K7Q4M2");
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
  expect(codes).toEqual(["K7Q4M2"]);
  expect(paired).toHaveBeenCalledTimes(1);
});

test("pasting a formatted code fills every box", async () => {
  render(<PairingScreen onPaired={() => {}} />);
  const boxes = screen.getAllByRole("textbox");
  (boxes[0] as HTMLInputElement).focus();
  await userEvent.paste("k7q-4m2");
  expect(boxes.map((b) => (b as HTMLInputElement).value).join("")).toBe("K7Q4M2");
});

test("a refused code shows the error and stays on the screen", async () => {
  outcome = () => Promise.reject(new KiboError("UNAUTHORIZED", "invalid or expired code"));
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "ZZZZZZ");
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
  expect(await screen.findByText("Code invalide ou expiré.")).toBeTruthy();
});

test("the submit button waits for six characters", async () => {
  render(<PairingScreen onPaired={() => {}} />);
  await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "K7Q");
  expect((screen.getByRole("button", { name: "Appairer" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Code valable 5 minutes · usage unique")).toBeTruthy();
});
```

Run: `bun test packages/ui/src/lib/pairing-code.test.ts packages/ui/src/shell/pairing-screen.test.tsx`
Expected: FAIL (`./pairing-code` introuvable ; l'écran n'a qu'un champ).

- [ ] **Step 3: Implémenter les helpers et l'écran 31**

`packages/ui/src/lib/pairing-code.ts` :
```ts
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}

export function remaining(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
```

`packages/ui/src/shell/PairingScreen.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Input } from "@kibo/sdk/ui/input";
import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useId, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { KiboLogo } from "./KiboLogo";

const ALLOWED = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;
const clean = (text: string) =>
  text
    .toUpperCase()
    .split("")
    .filter((c) => ALLOWED.test(c));

export function PairingScreen({ onPaired }: { onPaired: () => void }) {
  const groupId = useId();
  const [chars, setChars] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (from: number, typed: string[]) => {
    const next = [...chars];
    let i = from;
    for (const c of typed) {
      if (i > 5) break;
      next[i] = c;
      i += 1;
    }
    setChars(next);
    setError(false);
    refs.current[Math.min(i, 5)]?.focus();
  };
  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || chars[i]) return;
    e.preventDefault();
    const next = [...chars];
    if (i > 0) next[i - 1] = "";
    setChars(next);
    refs.current[Math.max(0, i - 1)]?.focus();
  };
  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, clean(e.clipboardData.getData("text")));
  };
  const code = chars.join("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await client.pairWithCode(code);
      onPaired();
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(true);
    }
  };

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="grid w-full max-w-md justify-items-center gap-6">
        <KiboLogo className="size-14" />
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{fr.pairing.title}</CardTitle>
            <CardDescription>{fr.pairing.help}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid justify-items-center gap-4">
              <fieldset aria-labelledby={groupId} className="flex items-center gap-2">
                <legend id={groupId} className="sr-only">
                  {fr.pairing.code}
                </legend>
                {chars.map((c, i) => (
                  <span key={`slot-${i.toString()}`} className="flex items-center gap-2">
                    {i === 3 && <span className="text-muted-foreground">–</span>}
                    <Input
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      aria-label={fr.pairing.digit(i + 1)}
                      value={c}
                      onChange={(e) => fill(i, clean(e.target.value).slice(-1))}
                      onKeyDown={onKeyDown(i)}
                      onPaste={onPaste(i)}
                      inputMode="text"
                      autoComplete="one-time-code"
                      autoFocus={i === 0}
                      className="size-11 text-center font-mono text-lg uppercase"
                    />
                  </span>
                ))}
              </fieldset>
              <p className="text-xs text-muted-foreground">{fr.pairing.validity}</p>
              {error && <p className="text-sm text-destructive">{fr.pairing.invalid}</p>}
              <Button type="submit" disabled={code.length !== 6}>
                {fr.pairing.submit}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">{fr.pairing.security}</p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
```
`userEvent.type` sur la première case dispatche chaque caractère dans l'élément focalisé : `fill` déplace le focus, donc la saisie continue dans la case suivante (c'est ce que vérifie le premier test).

- [ ] **Step 4: Lancer les tests**

Run: `bun test packages/ui/src/lib/pairing-code.test.ts packages/ui/src/shell/pairing-screen.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Aligner l'attente de l'écran 31 existante**

Dans `packages/ui/src/shell/screens.test.tsx`, le test « PairingScreen shows the logo, a centred title and the security notice » attend l'ancien pied de page ; la maquette 31 en a un nouveau. Remplacer seulement la ligne :
```ts
  expect(screen.getByText(/révocable dans Paramètres › Sécurité/)).toBeTruthy();
```
(c'est la seule attente existante modifiée par la phase ; elle suit la maquette 31, le chef d'équipe la signale au jalon.) L'appairage par jeton dans l'URL (`#pair=…`, `App.tsx`, utilisé par Tauri et l'E2E) est inchangé.

Run: `bun test packages/ui/src/shell/screens.test.tsx`
Expected: PASS.

- [ ] **Step 6: Écrire le test de Paramètres › Sécurité**

`packages/ui/src/pages/settings/security-settings.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { RemoteAccessStatus, RpcRequest, SandboxStatus, SessionInfo } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let remote: RemoteAccessStatus;
let sandbox: SandboxStatus;
let sessions: SessionInfo[];

const off: RemoteAccessStatus = {
  enabled: false,
  address: null,
  port: null,
  url: null,
  fingerprint: null,
  tls: null,
  interfaces: [
    { name: "lo0", address: "127.0.0.1" },
    { name: "en0", address: "192.168.1.20" },
  ],
  lastError: null,
};
const on: RemoteAccessStatus = {
  ...off,
  enabled: true,
  address: "192.168.1.20",
  port: 47832,
  url: "https://192.168.1.20:47832",
  fingerprint: "3F:9A:8B:21:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:01:23:45:67:89:AB:CD:EF:C2:1E:0A:0B",
  tls: "self-signed",
};
const DAY = 24 * 3600_000;

mock.module("../../api", () => ({
  client: {
    onEvent: () => () => {},
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      switch (req.method) {
        case "getRemoteAccess":
          return remote;
        case "enableRemoteAccess":
          remote = on;
          return on;
        case "disableRemoteAccess":
          remote = off;
          return null;
        case "listSessions":
          return sessions;
        case "revokeSession":
          sessions = sessions.filter((s) => s.id !== req.id);
          return null;
        case "getSandboxStatus":
          return sandbox;
        case "setAllowUnsandboxed":
          sandbox = { ...sandbox, allowUnsandboxed: req.allow };
          return sandbox;
        default:
          throw new Error(`unexpected ${req.method}`);
      }
    },
  },
}));
const { SecuritySettings } = await import("./SecuritySettings");

beforeEach(() => {
  calls.length = 0;
  remote = off;
  sandbox = { kind: "bwrap", available: true, reason: null, fix: null, allowUnsandboxed: false };
  sessions = [
    { id: "a".repeat(64), deviceName: "Chrome · macOS", remote: false, createdAt: 0, lastSeenAt: 0, expiresAt: 30 * DAY, current: true },
    { id: "b".repeat(64), deviceName: "Firefox · Linux", remote: true, createdAt: 0, lastSeenAt: 0, expiresAt: 30 * DAY, current: false },
  ];
});

test("remote access is off by default and explains why", async () => {
  render(<SecuritySettings />);
  expect(await screen.findByText(/L'accès distant ouvre un second port, chiffré/)).toBeTruthy();
  expect((screen.getByRole("switch", { name: "Activer l'accès distant" }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("false");
});

test("enabling needs an interface and the explicit consent", async () => {
  render(<SecuritySettings />);
  await userEvent.click(await screen.findByRole("switch", { name: "Activer l'accès distant" }));
  const dialog = await screen.findByRole("dialog");
  const submit = within(dialog).getByRole("button", { name: "Activer" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(within(dialog).getByText("en0 · 192.168.1.20")).toBeTruthy();
  expect((within(dialog).getByLabelText("Port") as HTMLInputElement).value).toBe("47832");
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /Je comprends/ }));
  await userEvent.click(submit);
  expect(calls).toContainEqual({ method: "enableRemoteAccess", address: "192.168.1.20", port: 47832, tls: { kind: "self-signed" } });
  expect(await screen.findByText("https://192.168.1.20:47832")).toBeTruthy();
  expect(screen.getByText(on.fingerprint ?? "")).toBeTruthy();
  expect(screen.getByText("Vérifie cette empreinte dans ton navigateur à la première connexion.")).toBeTruthy();
});

test("sessions list marks the current one and can revoke another", async () => {
  render(<SecuritySettings />);
  const row = (await screen.findByText("Firefox · Linux")).closest("tr") as HTMLElement;
  expect(within(row).getByText("Distant")).toBeTruthy();
  expect(screen.getByText("Cette session")).toBeTruthy();
  await userEvent.click(within(row).getByRole("button", { name: "Révoquer" }));
  expect(calls).toContainEqual({ method: "revokeSession", id: "b".repeat(64) });
  expect(screen.getByText("Une session expire après 30 jours sans activité.")).toBeTruthy();
});

test("isolation available shows the active mechanism", async () => {
  render(<SecuritySettings />);
  expect(await screen.findByText("bubblewrap actif")).toBeTruthy();
});

test("isolation unavailable shows the reason, the fix, and asks before allowing", async () => {
  sandbox = {
    kind: "bwrap",
    available: false,
    reason: "bwrap: setting up uid map: Permission denied",
    fix: "sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0",
    allowUnsandboxed: false,
  };
  render(<SecuritySettings />);
  expect(await screen.findByText("Indisponible : bwrap: setting up uid map: Permission denied")).toBeTruthy();
  expect(screen.getByText("sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0")).toBeTruthy();
  await userEvent.click(screen.getByRole("switch", { name: "Autoriser les backends sandboxés sans isolation OS" }));
  const confirm = await screen.findByRole("alertdialog");
  expect(within(confirm).getByText(/Ne l'active que si tu fais confiance/)).toBeTruthy();
  expect(calls.some((c) => c.method === "setAllowUnsandboxed")).toBe(false);
  await userEvent.click(within(confirm).getByRole("button", { name: "Autoriser quand même" }));
  expect(calls).toContainEqual({ method: "setAllowUnsandboxed", allow: true });
});

test("disabling asks for confirmation", async () => {
  remote = on;
  render(<SecuritySettings />);
  await userEvent.click(await screen.findByRole("switch", { name: "Activer l'accès distant" }));
  const confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: "Désactiver" }));
  expect(calls).toContainEqual({ method: "disableRemoteAccess" });
});
```

Run: `bun test packages/ui/src/pages/settings/security-settings.test.tsx`
Expected: FAIL avec « Cannot find module './SecuritySettings' ».

- [ ] **Step 7: Requête RPC réactive (si absente en v0.6)**

`packages/ui/src/state/use-rpc-query.ts` :
```ts
import { type DaemonEvent, KiboError, type RpcRequest, type RpcResult } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export function useRpcQuery<R extends RpcRequest>(req: R, refreshOn: DaemonEvent["type"][]) {
  const [data, setData] = useState<RpcResult[R["method"]] | null>(null);
  const [error, setError] = useState<KiboError | null>(null);
  const key = JSON.stringify(req);
  const events = refreshOn.join(",");
  const reload = useCallback(() => {
    client.rpc(JSON.parse(key) as R).then(
      (r) => {
        setData(r);
        setError(null);
      },
      (e: unknown) => {
        if (!(e instanceof KiboError)) throw e;
        setError(e);
      },
    );
  }, [key]);
  useEffect(() => {
    reload();
    const types = new Set(events.split(","));
    return client.onEvent((e) => {
      if (types.has(e.type)) reload();
    });
  }, [reload, events]);
  return { data, error, reload };
}
```
`JSON.parse(key) as R` : `key` est la sérialisation de `req` lui-même, la forme est donc exactement `R`.

- [ ] **Step 8: Implémenter le dialogue d'activation**

`packages/ui/src/dialogs/EnableRemoteAccessDialog.tsx` :
```tsx
import { KiboError, type RemoteAccessStatus } from "@kibo/schema";
import { Alert, AlertDescription } from "@kibo/sdk/ui/alert";
import { Button } from "@kibo/sdk/ui/button";
import { Checkbox } from "@kibo/sdk/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { TriangleAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = {
  status: RemoteAccessStatus;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEnabled: (s: RemoteAccessStatus) => void;
};
const t = fr.security.remote;
const DEFAULT_PORT = 47832;

export function EnableRemoteAccessDialog({ status, open, onOpenChange, onEnabled }: Props) {
  const ifaceId = useId();
  const portId = useId();
  const certId = useId();
  const keyId = useId();
  const consentId = useId();
  const candidates = status.interfaces.filter((i) => i.address !== "127.0.0.1" && i.address !== "::1");
  const [address, setAddress] = useState(candidates[0]?.address ?? status.interfaces[0]?.address ?? "");
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [kind, setKind] = useState<"self-signed" | "provided">("self-signed");
  const [certFile, setCertFile] = useState("");
  const [keyFile, setKeyFile] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = consent && address !== "" && Number(port) >= 1024 && (kind === "self-signed" || (certFile && keyFile));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tls = kind === "self-signed" ? { kind } : { kind, certFile, keyFile };
      onEnabled(await client.rpc({ method: "enableRemoteAccess", address, port: Number(port), tls }));
      onOpenChange(false);
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(`${t.failed} ${err.detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={ifaceId}>{t.iface}</Label>
            <Select value={address} onValueChange={setAddress}>
              <SelectTrigger id={ifaceId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {status.interfaces.map((i) => (
                  <SelectItem key={`${i.name}-${i.address}`} value={i.address}>
                    {`${i.name} · ${i.address}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={portId}>{t.port}</Label>
            <Input id={portId} inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{t.certificate}</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v === "provided" ? "provided" : "self-signed")}>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="self-signed" />
                {t.selfSigned}
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="provided" />
                {t.provided}
              </Label>
            </RadioGroup>
            {kind === "provided" && (
              <div className="grid gap-2 pl-6">
                <Label htmlFor={certId}>{t.certFile}</Label>
                <Input id={certId} value={certFile} onChange={(e) => setCertFile(e.target.value)} className="font-mono" />
                <Label htmlFor={keyId}>{t.keyFile}</Label>
                <Input id={keyId} value={keyFile} onChange={(e) => setKeyFile(e.target.value)} className="font-mono" />
              </div>
            )}
          </div>
          <Alert className="border-amber-500/50 text-amber-700 dark:text-amber-400">
            <TriangleAlert />
            <AlertDescription>{t.warning}</AlertDescription>
          </Alert>
          <div className="flex items-start gap-2">
            <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <Label htmlFor={consentId} className="font-normal leading-snug">
              {t.consent}
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {fr.common.cancel}
            </Button>
            <Button type="submit" disabled={!ready || busy}>
              {busy ? t.enabling : t.enable}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 9: Implémenter la page Sécurité**

`packages/ui/src/pages/settings/SecuritySettings.tsx` :
```tsx
import type { RemoteAccessStatus } from "@kibo/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@kibo/sdk/ui/alert-dialog";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Label } from "@kibo/sdk/ui/label";
import { Switch } from "@kibo/sdk/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kibo/sdk/ui/table";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { client } from "../../api";
import { EnableRemoteAccessDialog } from "../../dialogs/EnableRemoteAccessDialog";
import { fr } from "../../i18n/fr";
import { useRpcQuery } from "../../state/use-rpc-query";

const t = fr.security;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const fmt = (ms: number) => dateFmt.format(new Date(ms));

function RemoteSection() {
  const switchId = useId();
  const { data: status, reload } = useRpcQuery({ method: "getRemoteAccess" }, []);
  const [dialog, setDialog] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  if (!status) return null;
  const disable = async () => {
    await client.rpc({ method: "disableRemoteAccess" });
    setConfirmOff(false);
    reload();
  };
  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-6">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{t.remote.title}</h2>
          <p className="text-sm text-muted-foreground">{t.remote.help}</p>
        </div>
        <Switch
          id={switchId}
          aria-label={t.remote.toggle}
          checked={status.enabled}
          onCheckedChange={(on) => (on ? setDialog(true) : setConfirmOff(true))}
        />
      </div>
      {status.lastError && <p className="text-sm text-destructive">{t.remote.resumeFailed(status.lastError)}</p>}
      {status.enabled && <RemoteDetails status={status} />}
      <EnableRemoteAccessDialog status={status} open={dialog} onOpenChange={setDialog} onEnabled={() => reload()} />
      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.remote.disableTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.remote.disableHelp}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={disable}>{t.remote.disable}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function RemoteDetails({ status }: { status: RemoteAccessStatus }) {
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 rounded-md border p-4 text-sm">
      <dt className="text-muted-foreground">{t.remote.url}</dt>
      <dd className="font-mono">{status.url}</dd>
      <dt className="text-muted-foreground">{t.remote.fingerprint}</dt>
      <dd className="break-all font-mono text-xs">{status.fingerprint}</dd>
      <dd className="col-span-2 text-xs text-muted-foreground">{t.remote.verify}</dd>
    </dl>
  );
}

function SessionsSection() {
  const { data: sessions, reload } = useRpcQuery({ method: "listSessions" }, ["sessions"]);
  if (!sessions) return null;
  const revoke = async (id: string) => {
    await client.rpc({ method: "revokeSession", id });
    reload();
  };
  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{t.sessions.title}</h2>
        <p className="text-sm text-muted-foreground">{t.sessions.help}</p>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sessions.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.sessions.device}</TableHead>
              <TableHead>{t.sessions.type}</TableHead>
              <TableHead>{t.sessions.created}</TableHead>
              <TableHead>{t.sessions.lastSeen}</TableHead>
              <TableHead>{t.sessions.expires}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {s.deviceName}
                    {s.current && <Badge variant="secondary">{t.sessions.current}</Badge>}
                  </span>
                </TableCell>
                <TableCell>{s.remote ? t.sessions.remote : t.sessions.local}</TableCell>
                <TableCell>{fmt(s.createdAt)}</TableCell>
                <TableCell>{fmt(s.lastSeenAt)}</TableCell>
                <TableCell>{fmt(s.expiresAt)}</TableCell>
                <TableCell className="text-right">
                  {!s.current && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>
                      {t.sessions.revoke}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function IsolationSection() {
  const allowId = useId();
  const { data: status, reload } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox"]);
  const [confirm, setConfirm] = useState(false);
  if (!status) return null;
  const setAllow = async (allow: boolean) => {
    await client.rpc({ method: "setAllowUnsandboxed", allow });
    setConfirm(false);
    reload();
  };
  const active = status.kind === "sandbox-exec" ? t.isolation.sandboxExec : t.isolation.bwrap;
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold">{t.isolation.title}</h2>
      {status.available ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="size-4" />
          {active}
        </p>
      ) : (
        <div className="grid gap-2 text-sm">
          <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-4" />
            {t.isolation.unavailable(status.reason ?? "")}
          </p>
          {status.fix && (
            <p className="text-muted-foreground">
              {t.isolation.fix} <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{status.fix}</code>
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-6">
        <Label htmlFor={allowId} className="font-normal">
          {t.isolation.allow}
        </Label>
        <Switch
          id={allowId}
          aria-label={t.isolation.allow}
          checked={status.allowUnsandboxed}
          onCheckedChange={(on) => (on ? setConfirm(true) : setAllow(false))}
        />
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.isolation.allowTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-destructive">{t.isolation.allowWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setAllow(true)}>{t.isolation.allowConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function SecuritySettings() {
  return (
    <div className="grid max-w-3xl gap-10">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <RemoteSection />
      <SessionsSection />
      <IsolationSection />
    </div>
  );
}
```
Les couleurs d'état suivent les tokens de statut (vert / ambre / rouge), jamais l'orange réservé aux agents.

- [ ] **Step 10: Lancer le test**

Run: `bun test packages/ui/src/pages/settings/security-settings.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 11: Code d'appairage (écran 15), écran 19 et bannière M7**

`packages/ui/src/dialogs/PairingCodeDialog.tsx` :
```tsx
import { KiboError, type PairingCode } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { formatPairingCode, remaining } from "../lib/pairing-code";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; now?: () => number };

export function PairingCodeDialog({ open, onOpenChange, now = Date.now }: Props) {
  const [code, setCode] = useState<PairingCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(now());
  const generate = useCallback(() => {
    client.rpc({ method: "createPairingCode" }).then(setCode, (e: unknown) => {
      if (!(e instanceof KiboError)) throw e;
      setError(e.detail);
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    generate();
    const timer = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(timer);
  }, [open, generate, now]);
  const expired = code !== null && code.expiresAt <= tick;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.pairing.generateTitle}</DialogTitle>
          <DialogDescription>{fr.pairing.generateHelp}</DialogDescription>
        </DialogHeader>
        {code && !expired && (
          <div className="grid justify-items-center gap-2 py-4">
            <p className="font-mono text-3xl tracking-[0.3em]">{formatPairingCode(code.code)}</p>
            <p className="text-sm text-muted-foreground">{fr.pairing.expiresIn(remaining(code.expiresAt, tick))}</p>
          </div>
        )}
        {expired && <p className="py-4 text-center text-sm text-muted-foreground">{fr.pairing.expired}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {expired ? (
            <Button onClick={generate}>{fr.pairing.regenerate}</Button>
          ) : (
            <Button
              variant="outline"
              disabled={!code}
              onClick={() => code && navigator.clipboard.writeText(formatPairingCode(code.code))}
            >
              {fr.pairing.copy}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
Dans la section « Accès web » de l'écran 15, le bouton « Générer un code » ouvre ce dialogue (`useState` local). Ajouter au test de Paramètres › Sécurité un cas pour le dialogue :
```tsx
test("the pairing code dialog shows the code and its countdown", async () => {
  const { PairingCodeDialog } = await import("../../dialogs/PairingCodeDialog");
  render(<PairingCodeDialog open onOpenChange={() => {}} now={() => 1_000} />);
  expect(await screen.findByText("K7Q-4M2")).toBeTruthy();
  expect(screen.getByText("Expire dans 4:59")).toBeTruthy();
});
```
et, dans le `switch` du `mock.module`, `case "createPairingCode": return { code: "K7Q4M2", expiresAt: 300_000 };`.

`packages/ui/src/pages/components/SandboxBanner.tsx` :
```tsx
import { Alert, AlertDescription, AlertTitle } from "@kibo/sdk/ui/alert";
import { TriangleAlert } from "lucide-react";
import { fr } from "../../i18n/fr";
import { useRpcQuery } from "../../state/use-rpc-query";

export function SandboxBanner() {
  const { data } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox"]);
  if (!data || data.available || data.allowUnsandboxed) return null;
  return (
    <Alert className="border-amber-500/50 text-amber-700 dark:text-amber-400">
      <TriangleAlert />
      <AlertTitle>{fr.security.isolation.banner}</AlertTitle>
      {data.fix && (
        <AlertDescription>
          <code className="font-mono text-xs">{data.fix}</code>
        </AlertDescription>
      )}
    </Alert>
  );
}
```
`ComponentsPage` rend `<SandboxBanner />` au-dessus du tableau. `FirstRunPage` ajoute la ligne :
```tsx
const { data: sandbox } = useRpcQuery({ method: "getSandboxStatus" }, ["sandbox"]);
{sandbox && (
  <CheckRow
    title={fr.security.isolation.firstRun}
    detail={sandbox.available ? fr.security.isolation.firstRunOk(sandbox.kind === "sandbox-exec" ? "sandbox-exec" : "bubblewrap") : `${fr.security.isolation.unavailable(sandbox.reason ?? "")} ${sandbox.fix ?? ""}`}
    state={sandbox.available ? "ok" : "warn"}
  />
)}
```
Et `SETTINGS_SECTIONS` gagne `{ id: "security", label: fr.security.title, element: SecuritySettings }` entre Intégrations et Raccourcis s'il n'existe pas encore.

Tests ajoutés à `security-settings.test.tsx` pour la bannière (indisponible ⇒ texte M7 et commande ; disponible ⇒ rien ; autorisée sans isolation ⇒ rien) :
```tsx
test("the components banner only shows when backends are stopped", async () => {
  const { SandboxBanner } = await import("../components/SandboxBanner");
  sandbox = { kind: "bwrap", available: false, reason: "bubblewrap (bwrap) is not installed", fix: "sudo apt install bubblewrap", allowUnsandboxed: false };
  const { unmount } = render(<SandboxBanner />);
  expect(await screen.findByText("Les backends sandboxés sont arrêtés : isolation OS indisponible.")).toBeTruthy();
  expect(screen.getByText("sudo apt install bubblewrap")).toBeTruthy();
  unmount();
  sandbox = { ...sandbox, allowUnsandboxed: true };
  render(<SandboxBanner />);
  await new Promise((r) => setTimeout(r, 10));
  expect(screen.queryByText(/backends sandboxés sont arrêtés/)).toBeNull();
});
```

- [ ] **Step 12: Lancer les tests de l'UI**

Run: `bun test packages/ui`
Expected: PASS.

- [ ] **Step 13: Contrôle visuel**

Run: `bun run --cwd packages/ui build && bun packages/daemon/src/main.ts --ui packages/ui/dist` puis ouvrir Paramètres › Sécurité, l'écran 15, l'écran 19, la page Composants et `/pair` (appairage par code) en sombre et en clair.
Expected: conformes aux exports Penpot S8, M7, 15, 19 et 31 ; écarts corrigés avant le commit.

- [ ] **Step 14: Vérifier le lint et les types, commiter**

Run: `bun run check && bun run typecheck`
Expected: aucun diagnostic.

```bash
git add packages/ui/src/pages/settings/SecuritySettings.tsx packages/ui/src/pages/settings/security-settings.test.tsx packages/ui/src/pages/settings/sections.ts packages/ui/src/pages/settings/AppearanceSettings.tsx packages/ui/src/dialogs/EnableRemoteAccessDialog.tsx packages/ui/src/dialogs/PairingCodeDialog.tsx packages/ui/src/pages/components/SandboxBanner.tsx packages/ui/src/pages/components/ComponentsPage.tsx packages/ui/src/pages/FirstRunPage.tsx packages/ui/src/lib/pairing-code.ts packages/ui/src/lib/pairing-code.test.ts packages/ui/src/state/use-rpc-query.ts packages/ui/src/shell/PairingScreen.tsx packages/ui/src/shell/pairing-screen.test.tsx packages/ui/src/shell/screens.test.tsx packages/ui/src/i18n/fr.ts packages/sdk/src/ui
git commit -m "feat(ui): paramètres de sécurité"
```

---

### Task 26: UI Marketplace : catalogue, détail, sources, installation

Écrans **M1** (onglet Marketplace), **M2** (détail d'un paquet, « Voir le code »), **M3** (Paramètres › Composants › Sources) et **M5** (variantes marketplace de l'écran 30), en sombre et en clair, fidèles à leur dessin Penpot. Spec H §4 (écran 30), §5.2.

**Prérequis :** écrans M1, M2, M3 et M5 dessinés et exportés par le chef d'équipe.

**Files:**
- Create: `packages/ui/src/pages/components/MarketplaceTab.tsx`, `packages/ui/src/pages/components/MarketCard.tsx`, `packages/ui/src/pages/components/MarketPackageSheet.tsx`, `packages/ui/src/pages/components/SourceCode.tsx`, `packages/ui/src/pages/settings/ComponentSourcesSettings.tsx`, `packages/ui/src/dialogs/AddSourceDialog.tsx`, `packages/ui/src/lib/market-errors.ts`
- Modify: `packages/ui/src/pages/components/ComponentsPage.tsx` (onglets Installés / Marketplace), `packages/ui/src/dialogs/TrustDialog.tsx` (variantes M5), `packages/ui/src/pages/settings/sections.ts` (section « Composants »), `packages/ui/src/i18n/fr.ts` (section `market`), `packages/sdk/src/ui/tabs.tsx` (ajouté par `bunx shadcn@latest add tabs` s'il manque)
- Test: `packages/ui/src/pages/components/marketplace.test.tsx`, `packages/ui/src/pages/settings/sources.test.tsx`, `packages/ui/src/dialogs/trust-market.test.tsx`, `packages/ui/src/lib/market-errors.test.ts`

**Interfaces:**
- Consumes: RPC `listMarketSources`, `probeMarketSource`, `addMarketSource`, `removeMarketSource`, `refreshMarket`, `searchMarket`, `getMarketPackage` (T15), `installFromMarket` (T20) ; types `MarketSourceInfo`, `MarketProbe`, `MarketHit`, `MarketPackageDetail`, `MarketInstallResult`, `TrustPreview.market` (T5, T20) ; `formatFingerprint`, `shortHash` sont dans `@kibo/trust`, que l'UI n'importe pas : ils sont réécrits dans `packages/ui/src/lib/fingerprint.ts` (deux fonctions pures, testées, sans dépendance).
- Hypothèse v0.6 (vérifiée en T0) : `permissionLines(granted: GrantedPermissions): string[]` (`packages/ui/src/lib/permission-lines.ts`, textes de l'écran 30) ; `CodeBlock({ code, path }: { code: string; path: string })` (aperçu Shiki de la phase 3, `packages/ui/src/files/CodeBlock.tsx`) ; `TrustDialog({ preview, open, onApproved, onRefused })` (phase 4) ; `SETTINGS_SECTIONS: { id: string; label: string; render: () => JSX.Element }[]` ; `ComponentsPage` rend le tableau « Installés » dans `InstalledTable`.
- Produces :
  - `MarketplaceTab({ onInstalled }: { onInstalled(result: MarketInstallResult): void })`.
  - `MarketPackageSheet({ target, onClose, onInstalled, onUnlock }: { target: { sourceId: string; id: string; version: string } | null; onClose(): void; onInstalled(result: MarketInstallResult): void; onUnlock?(detail: MarketPackageDetail): void })` (réutilisé par T27).
  - `marketErrorText(error: unknown): string`, `marketErrorCodeText(code: string): string` (`lib/market-errors.ts`).
  - `TrustDialog` gagne `publisherLine?: string`, `newPublisher?: boolean`, `fromMarketplace?: boolean` ; `marketTrustProps(market: TrustPreview["market"]): { publisherLine?: string; newPublisher?: boolean; fromMarketplace?: boolean }`.
  - `groupFingerprint(hex: string): string`, `shortFingerprint(hex: string): string` (`lib/fingerprint.ts`).

- [ ] **Step 1: Textes `fr.ts`**

Ajouter à `fr` :
```ts
  market: {
    tabInstalled: "Installés",
    tabMarket: "Marketplace",
    search: "Rechercher un composant",
    allSources: "Toutes les sources",
    kind: { all: "Tous", widget: "Widget", view: "Vue", both: "Les deux" },
    noSource: "Aucune source de marketplace. Ajoute-en une dans Paramètres › Composants.",
    noResult: "Aucun composant ne correspond à ta recherche.",
    verified: "vérifié",
    unverified: "non vérifié",
    installed: (v: string) => `Installé ${v}`,
    available: (v: string) => `${v} disponible`,
    latest: (v: string) => `Dernière version ${v}`,
    publishedBy: (name: string, source: string, verified: boolean) =>
      verified ? `Publié par ${name} · vérifié par ${source}` : `Publié par ${name} · éditeur non vérifié`,
    newPublisher: "Nouvel éditeur",
    source: "Source",
    size: "Taille",
    hash: "Empreinte",
    versions: "Versions",
    revoked: (reason: string) => `Révoquée : ${reason}`,
    permissions: "Permissions",
    viewCode: "Voir le code",
    hideCode: "Masquer le code",
    codeVerified: "Code vérifié : signature et empreinte correspondent",
    install: "Installer",
    installing: "Installation…",
    unlock: "Débloquer…",
    fromMarketplace: "Ce code vient d'une marketplace.",
    kib: (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} Kio`,
    errors: {
      SIGNATURE_INVALID: "Signature invalide.",
      HASH_MISMATCH: "L'empreinte ne correspond pas.",
      REVOKED: "Cette version est révoquée.",
      PUBLISHER_CHANGED: "La clé de l'éditeur a changé.",
      INDEX_ROLLBACK: "Index refusé : numéro inférieur au dernier vu.",
      SANDBOX_UNAVAILABLE: "Isolation OS indisponible : impossible de valider ce composant.",
      VALIDATION_FAILED: "Le composant n'a pas passé la validation.",
      TIMEOUT: "La source ne répond pas.",
      NOT_FOUND: "Paquet introuvable sur la source.",
      TLS_REQUIRED: "Adresse non chiffrée : utilise https://.",
      VERSION_EXISTS: "Cette version est déjà installée avec un autre contenu.",
    },
  },
  sources: {
    title: "Sources",
    subtitle: "Les marketplaces où Kibo cherche des composants. Chaque source est vérifiée par sa clé.",
    name: "Nom",
    url: "Adresse",
    key: "Empreinte de la clé",
    serial: "Index n°",
    updated: "Mis à jour",
    state: "État",
    ok: "À jour",
    never: "Jamais",
    add: "Ajouter une source",
    refresh: "Rafraîchir",
    remove: "Retirer",
    actions: (name: string) => `Actions ${name}`,
    addTitle: "Ajouter une source",
    step1: "Adresse HTTPS de la source",
    next: "Continuer",
    step2: "Compare cette empreinte avec celle communiquée par l'éditeur de la source.",
    fingerprint: "Empreinte complète",
    back: "Retour",
    confirm: "Ajouter",
    empty: "Aucune source pour l'instant.",
  },
```
Ajouter `components: "Composants"` à la section `settings` existante (libellé de la nouvelle entrée du menu).

- [ ] **Step 2: Tests des utilitaires**

`packages/ui/src/lib/market-errors.test.ts` :
```ts
import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { groupFingerprint, shortFingerprint } from "./fingerprint";
import { marketErrorText } from "./market-errors";

test("known codes get their French message", () => {
  expect(marketErrorText(new KiboError("SIGNATURE_INVALID", "bad"))).toBe("Signature invalide.");
  expect(marketErrorText(new KiboError("INDEX_ROLLBACK", "x"))).toBe("Index refusé : numéro inférieur au dernier vu.");
});

test("unknown errors fall back to the generic message", () => {
  expect(marketErrorText(new Error("boom"))).toBe("Une erreur est survenue.");
  expect(marketErrorText(new KiboError("INTERNAL", "x"))).toBe("Une erreur est survenue.");
});

test("fingerprints are grouped by four and shortened", () => {
  const hex = "3f9a8b21".repeat(8);
  expect(groupFingerprint(hex).split(" ")).toHaveLength(16);
  expect(groupFingerprint(hex).startsWith("3f9a 8b21")).toBe(true);
  expect(shortFingerprint(hex)).toBe("3f9a…8b21");
});
```

Run: `bun test packages/ui/src/lib/market-errors.test.ts`
Expected: FAIL avec « Cannot find module './fingerprint' ».

`packages/ui/src/lib/fingerprint.ts` :
```ts
export function groupFingerprint(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? []).join(" ");
}

export function shortFingerprint(hex: string): string {
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}
```

`packages/ui/src/lib/market-errors.ts` :
```ts
import { KiboError } from "@kibo/schema";
import { fr } from "../i18n/fr";

const messages: Record<string, string> = fr.market.errors;

export function marketErrorCodeText(code: string): string {
  return messages[code] ?? fr.common.error;
}

export function marketErrorText(error: unknown): string {
  return error instanceof KiboError ? marketErrorCodeText(error.code) : fr.common.error;
}
```

Run: `bun test packages/ui/src/lib/market-errors.test.ts`
Expected: PASS.

- [ ] **Step 3: Tests du catalogue et du détail**

`packages/ui/src/pages/components/marketplace.test.tsx` :
```ts
import { beforeEach, expect, mock, test } from "bun:test";
import {
  KiboError,
  type MarketHit,
  type MarketPackageDetail,
  type MarketSourceInfo,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const answer = answers[req.method];
      return answer ? answer() : Promise.resolve(null);
    },
  },
}));

const { MarketplaceTab } = await import("./MarketplaceTab");
const { MarketPackageSheet } = await import("./MarketPackageSheet");

const source: MarketSourceInfo = {
  id: "equipe",
  name: "Équipe",
  url: "https://sync.kibo.test/market/",
  publicKey: "PK",
  fingerprint: "3f9a".repeat(16),
  lastSerial: 42,
  lastFetchedAt: 1,
  lastError: null,
  enabled: true,
};
const hit: MarketHit = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "burndown",
  title: "Burndown",
  description: "Graphe d'avancement du sprint",
  kind: "widget",
  latest: "0.3.0",
  publisher: { name: "Léa", publicKey: "LEA", verified: false },
  installed: null,
  updateAvailable: null,
};
const detail: MarketPackageDetail = {
  ...hit,
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  version: "0.3.0",
  hash: "c21e".repeat(16),
  size: 4096,
  permissions: { reads: ["ticket", "status"], writes: [], data: false, net: [] },
  versions: [
    { version: "0.3.0", hash: "c21e".repeat(16), size: 4096, permissions: { reads: ["ticket"], writes: [], data: false, net: [] }, publishedAt: "2026-09-20T10:00:00Z", revoked: null },
    { version: "0.2.0", hash: "aaaa".repeat(16), size: 4000, permissions: { reads: ["ticket"], writes: [], data: false, net: [] }, publishedAt: "2026-09-10T10:00:00Z", revoked: "Faille" },
  ],
  pinnedPublisher: null,
  newPublisher: true,
  publisherChanged: false,
  files: [
    { path: "kibo.component.json", content: '{ "id": "burndown" }' },
    { path: "ui.tsx", content: "export const Component = () => <div>Burndown</div>;" },
  ],
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("without any source the tab explains where to add one", async () => {
  answers.listMarketSources = () => Promise.resolve([]);
  render(<MarketplaceTab onInstalled={() => {}} />);
  expect(await screen.findByText("Aucune source de marketplace. Ajoute-en une dans Paramètres › Composants.")).toBeTruthy();
});

test("typing searches the cached index and shows the publisher status", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([hit]);
  render(<MarketplaceTab onInstalled={() => {}} />);
  expect(await screen.findByText("Burndown")).toBeTruthy();
  expect(screen.getByText(/non vérifié/)).toBeTruthy();
  await userEvent.setup().type(screen.getByLabelText("Rechercher un composant"), "burn");
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "burn" }));
});

test("the kind filter narrows the search", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([hit]);
  render(<MarketplaceTab onInstalled={() => {}} />);
  await screen.findByText("Burndown");
  await userEvent.setup().click(screen.getByRole("button", { name: "Vue" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "", kind: "view" }));
  expect(screen.getByRole("button", { name: "Vue" }).getAttribute("aria-pressed")).toBe("true");
});

test("an empty search result says so", async () => {
  answers.listMarketSources = () => Promise.resolve([source]);
  answers.searchMarket = () => Promise.resolve([]);
  render(<MarketplaceTab onInstalled={() => {}} />);
  expect(await screen.findByText("Aucun composant ne correspond à ta recherche.")).toBeTruthy();
});

test("the detail shows the verified publisher, revoked versions and the code", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  render(<MarketPackageSheet target={{ sourceId: "equipe", id: "burndown", version: "0.3.0" }} onClose={() => {}} onInstalled={() => {}} />);
  expect(await screen.findByText("Publié par Léa · vérifié par Équipe")).toBeTruthy();
  expect(screen.getByText("Nouvel éditeur")).toBeTruthy();
  expect(screen.getByText("Révoquée : Faille")).toBeTruthy();
  expect(screen.getByText("c21e…c21e")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Voir le code" }));
  expect(screen.getByText("Code vérifié : signature et empreinte correspondent")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "ui.tsx" }));
  expect(screen.getByText(/<div>Burndown<\/div>/)).toBeTruthy();
});

test("installing calls the daemon then hands the preview over", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  const result = { id: "burndown", version: "0.3.0", hash: detail.hash, preview: { market: null } };
  answers.installFromMarket = () => Promise.resolve(result);
  const onInstalled = mock((_: unknown) => {});
  render(<MarketPackageSheet target={{ sourceId: "equipe", id: "burndown", version: "0.3.0" }} onClose={() => {}} onInstalled={onInstalled} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Installer" }));
  await waitFor(() => expect(onInstalled).toHaveBeenCalledWith(result));
  expect(calls.at(-1)).toEqual({ method: "installFromMarket", sourceId: "equipe", id: "burndown", version: "0.3.0" });
});

test("a failed check is explained and nothing is handed over", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.reject(new KiboError("HASH_MISMATCH", "x"));
  const onInstalled = mock((_: unknown) => {});
  render(<MarketPackageSheet target={{ sourceId: "equipe", id: "burndown", version: "0.3.0" }} onClose={() => {}} onInstalled={onInstalled} />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Installer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("L'empreinte ne correspond pas.");
  expect(onInstalled).not.toHaveBeenCalled();
});

test("a changed publisher key disables install and offers to unlock", async () => {
  answers.getMarketPackage = () => Promise.resolve({ ...detail, publisherChanged: true, newPublisher: false });
  const onUnlock = mock((_: unknown) => {});
  render(<MarketPackageSheet target={{ sourceId: "equipe", id: "burndown", version: "0.3.0" }} onClose={() => {}} onInstalled={() => {}} onUnlock={onUnlock} />);
  expect(await screen.findByText("La clé de l'éditeur a changé.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Installer" }).hasAttribute("disabled")).toBe(true);
  await userEvent.setup().click(screen.getByRole("button", { name: "Débloquer…" }));
  expect(onUnlock).toHaveBeenCalled();
});
```
L'aperçu renvoyé par le démon est typé `TrustPreview` ; dans ce test, seul `market` est lu par le composant, le reste de l'objet transite tel quel vers `onInstalled`.

Run: `bun test packages/ui/src/pages/components/marketplace.test.tsx`
Expected: FAIL avec « Cannot find module './MarketplaceTab' ».

- [ ] **Step 4: Implémenter le catalogue**

`packages/ui/src/pages/components/MarketCard.tsx` :
```tsx
import type { MarketHit } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { fr } from "../../i18n/fr";

export function MarketCard({ hit, onOpen }: { hit: MarketHit; onOpen(): void }) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onOpen}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <button type="button" className="text-left hover:underline" onClick={onOpen}>
            {hit.title}
          </button>
          {hit.updateAvailable ? (
            <Badge variant="secondary">{fr.market.available(hit.updateAvailable)}</Badge>
          ) : hit.installed ? (
            <Badge variant="outline">{fr.market.installed(hit.installed)}</Badge>
          ) : null}
        </CardTitle>
        <span className="font-mono text-xs text-muted-foreground">{hit.id}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        <p className="line-clamp-2 text-muted-foreground">{hit.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant="outline">{fr.market.kind[hit.kind]}</Badge>
          <span className="inline-flex items-center gap-1">
            {hit.publisher.verified ? (
              <BadgeCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
            )}
            {hit.publisher.name} · {hit.publisher.verified ? fr.market.verified : fr.market.unverified}
          </span>
          <span>{fr.market.latest(hit.latest)}</span>
          <span>· {hit.sourceName}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

`packages/ui/src/pages/components/MarketplaceTab.tsx` :
```tsx
import type { ComponentKind, MarketHit, MarketInstallResult, MarketSourceInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { useEffect, useId, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { marketErrorText } from "../../lib/market-errors";
import { MarketCard } from "./MarketCard";
import { MarketPackageSheet } from "./MarketPackageSheet";

const KINDS: (ComponentKind | null)[] = [null, "widget", "view", "both"];

export function MarketplaceTab({ onInstalled }: { onInstalled(result: MarketInstallResult): void }) {
  const searchId = useId();
  const [sources, setSources] = useState<MarketSourceInfo[] | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ComponentKind | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [hits, setHits] = useState<MarketHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ sourceId: string; id: string; version: string } | null>(null);

  useEffect(() => {
    client
      .rpc({ method: "listMarketSources" })
      .then((s) => setSources(s as MarketSourceInfo[]))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, []);

  useEffect(() => {
    if (!sources?.length) return;
    client
      .rpc({
        method: "searchMarket",
        query,
        ...(sourceId ? { sourceId } : {}),
        ...(kind ? { kind } : {}),
      })
      .then((h) => {
        setHits(h as MarketHit[]);
        setError(null);
      })
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, [sources, query, kind, sourceId]);

  if (sources !== null && sources.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{fr.market.noSource}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor={searchId}>{fr.market.search}</Label>
          <Input id={searchId} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1" role="group" aria-label={fr.market.source}>
          <Button size="sm" variant={sourceId === null ? "secondary" : "ghost"} aria-pressed={sourceId === null} onClick={() => setSourceId(null)}>
            {fr.market.allSources}
          </Button>
          {(sources ?? []).map((s) => (
            <Button key={s.id} size="sm" variant={sourceId === s.id ? "secondary" : "ghost"} aria-pressed={sourceId === s.id} onClick={() => setSourceId(s.id)}>
              {s.name}
            </Button>
          ))}
        </div>
        <div className="flex gap-1" role="group">
          {KINDS.map((k) => (
            <Button key={k ?? "all"} size="sm" variant={kind === k ? "secondary" : "ghost"} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {fr.market.kind[k ?? "all"]}
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {hits !== null && hits.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{fr.market.noResult}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(hits ?? []).map((h) => (
            <MarketCard key={`${h.sourceId}/${h.id}`} hit={h} onOpen={() => setTarget({ sourceId: h.sourceId, id: h.id, version: h.latest })} />
          ))}
        </div>
      )}
      <MarketPackageSheet target={target} onClose={() => setTarget(null)} onInstalled={onInstalled} />
    </div>
  );
}
```
La requête `searchMarket` n'envoie `sourceId` et `kind` que lorsqu'ils sont choisis : le premier test attend `{ method: "searchMarket", query: "burn" }` exactement.

- [ ] **Step 5: Implémenter le détail et « Voir le code »**

`packages/ui/src/pages/components/SourceCode.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CodeBlock } from "../../files/CodeBlock";
import { fr } from "../../i18n/fr";

export function SourceCode({ files }: { files: { path: string; content: string }[] }) {
  const [path, setPath] = useState(files.find((f) => f.path === "ui.tsx")?.path ?? files[0]?.path ?? "");
  const current = files.find((f) => f.path === path);
  return (
    <div className="flex flex-col gap-2">
      <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" aria-hidden />
        {fr.market.codeVerified}
      </p>
      <div className="grid grid-cols-[10rem_1fr] gap-2 rounded-md border">
        <nav className="flex flex-col border-r p-1">
          {files.map((f) => (
            <Button key={f.path} size="sm" variant={f.path === path ? "secondary" : "ghost"} className="justify-start font-mono text-xs" onClick={() => setPath(f.path)}>
              {f.path}
            </Button>
          ))}
        </nav>
        <div className="max-h-96 overflow-auto p-2">{current ? <CodeBlock code={current.content} path={current.path} /> : null}</div>
      </div>
    </div>
  );
}
```

`packages/ui/src/pages/components/MarketPackageSheet.tsx` :
```tsx
import type { MarketInstallResult, MarketPackageDetail } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@kibo/sdk/ui/sheet";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { fr } from "../../i18n/fr";
import { shortFingerprint } from "../../lib/fingerprint";
import { marketErrorText } from "../../lib/market-errors";
import { permissionLines } from "../../lib/permission-lines";
import { SourceCode } from "./SourceCode";

type Target = { sourceId: string; id: string; version: string };
type Props = {
  target: Target | null;
  onClose(): void;
  onInstalled(result: MarketInstallResult): void;
  onUnlock?(detail: MarketPackageDetail): void;
};

export function MarketPackageSheet({ target, onClose, onInstalled, onUnlock }: Props) {
  const [detail, setDetail] = useState<MarketPackageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setShowCode(false);
    if (!target) return;
    client
      .rpc({ method: "getMarketPackage", ...target })
      .then((d) => setDetail(d as MarketPackageDetail))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, [target]);

  const install = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      onInstalled((await client.rpc({ method: "installFromMarket", ...target })) as MarketInstallResult);
    } catch (e) {
      setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={target !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.title ?? target?.id}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{target?.id}</SheetDescription>
        </SheetHeader>
        {detail ? (
          <div className="flex flex-col gap-4 px-4 text-sm">
            <p>{detail.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>{fr.market.publishedBy(detail.publisher.name, detail.sourceName, detail.publisher.verified)}</span>
              {detail.newPublisher ? <Badge variant="secondary">{fr.market.newPublisher}</Badge> : null}
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
              <dt className="text-muted-foreground">{fr.market.source}</dt>
              <dd>{detail.sourceName}</dd>
              <dt className="text-muted-foreground">{fr.market.size}</dt>
              <dd>{fr.market.kib(detail.size)}</dd>
              <dt className="text-muted-foreground">{fr.market.hash}</dt>
              <dd className="font-mono">{shortFingerprint(detail.hash)}</dd>
            </dl>
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">{fr.market.permissions}</h3>
              <ul className="list-disc pl-5">
                {permissionLines(detail.permissions).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">{fr.market.versions}</h3>
              <ul className="flex flex-col gap-1 text-xs">
                {detail.versions.map((v) => (
                  <li key={v.version} className="flex gap-2">
                    <span className={v.revoked ? "font-mono line-through" : "font-mono"}>{v.version}</span>
                    <span className="text-muted-foreground">{new Date(v.publishedAt).toLocaleDateString("fr-FR")}</span>
                    {v.revoked ? <span className="text-red-600 dark:text-red-400">{fr.market.revoked(v.revoked)}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
            {detail.publisherChanged ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-red-500/40 p-2">
                <span className="text-red-600 dark:text-red-400">{fr.market.errors.PUBLISHER_CHANGED}</span>
                {onUnlock ? (
                  <Button size="sm" variant="outline" onClick={() => onUnlock(detail)}>
                    {fr.market.unlock}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCode((s) => !s)}>
                {showCode ? fr.market.hideCode : fr.market.viewCode}
              </Button>
              <Button onClick={install} disabled={busy || detail.publisherChanged}>
                {busy ? fr.market.installing : fr.market.install}
              </Button>
            </div>
            {showCode ? <SourceCode files={detail.files} /> : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="px-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```
Les `as` sur les résultats de `client.rpc` suivent la convention existante de l'UI (le client renvoie `unknown`, le type vient du tableau RPC) ; si la phase 4 a introduit un `rpc<M>` typé, l'utiliser à la place.

Run: `bun test packages/ui/src/pages/components/marketplace.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Variantes M5 de l'écran 30**

`packages/ui/src/dialogs/trust-market.test.tsx` :
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { trustPreviewFixture } from "../testing/trust-preview-fixture";
import { marketTrustProps, TrustDialog } from "./TrustDialog";

test("a verified marketplace component names its publisher and source", () => {
  const props = marketTrustProps({ publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true });
  render(<TrustDialog preview={trustPreviewFixture} open onApproved={() => {}} onRefused={() => {}} {...props} />);
  expect(screen.getByText("Publié par Léa · vérifié par Équipe")).toBeTruthy();
  expect(screen.getByText("Nouvel éditeur")).toBeTruthy();
  expect(screen.getByText("Ce code vient d'une marketplace.")).toBeTruthy();
});

test("an unverified publisher is announced as such", () => {
  const props = marketTrustProps({ publisherName: "Léa", verified: false, sourceName: "Équipe", newPublisher: false });
  render(<TrustDialog preview={trustPreviewFixture} open onApproved={() => {}} onRefused={() => {}} {...props} />);
  expect(screen.getByText("Publié par Léa · éditeur non vérifié")).toBeTruthy();
  expect(screen.queryByText("Nouvel éditeur")).toBeNull();
});

test("a local component keeps the phase 4 dialog", () => {
  render(<TrustDialog preview={trustPreviewFixture} open onApproved={() => {}} onRefused={() => {}} {...marketTrustProps(null)} />);
  expect(screen.queryByText("Ce code vient d'une marketplace.")).toBeNull();
});
```
Hypothèse v0.6 (vérifiée en T0) : `packages/ui/src/testing/trust-preview-fixture.ts` (phase 4) exporte un `TrustPreview` de test ; sinon, le créer dans cette tâche avec les champs de `TrustPreview` et `market: null`.

Run: `bun test packages/ui/src/dialogs/trust-market.test.tsx`
Expected: FAIL avec « marketTrustProps is not exported ».

Dans `TrustDialog.tsx` : ajouter les props optionnelles `publisherLine?: string`, `newPublisher?: boolean`, `fromMarketplace?: boolean` ; rendre `publisherLine` comme sous-titre sous le titre (à la place de la ligne d'origine quand il est fourni), `newPublisher` en `<Badge variant="secondary">{fr.market.newPublisher}</Badge>` à côté, et sous l'option « Confiance totale », quand `fromMarketplace` est vrai, `<p className="text-xs text-amber-700 dark:text-amber-400">{fr.market.fromMarketplace}</p>` en plus de l'avertissement de la phase 4. Exporter :
```tsx
export function marketTrustProps(market: TrustPreview["market"]): {
  publisherLine?: string;
  newPublisher?: boolean;
  fromMarketplace?: boolean;
} {
  if (!market) return {};
  return {
    publisherLine: fr.market.publishedBy(market.publisherName, market.sourceName, market.verified),
    newPublisher: market.newPublisher,
    fromMarketplace: true,
  };
}
```
`ComponentsPage` et l'écran 3 passent `{...marketTrustProps(preview.market)}` partout où ils ouvrent `TrustDialog`.

Run: `bun test packages/ui/src/dialogs/trust-market.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Onglets de la page Composants**

Dans `ComponentsPage.tsx`, envelopper le tableau existant :
```tsx
<Tabs defaultValue="installed">
  <TabsList>
    <TabsTrigger value="installed">{fr.market.tabInstalled}</TabsTrigger>
    <TabsTrigger value="market">{fr.market.tabMarket}</TabsTrigger>
  </TabsList>
  <TabsContent value="installed">
    <InstalledTable />
  </TabsContent>
  <TabsContent value="market">
    <MarketplaceTab onInstalled={(result) => setTrust(result.preview)} />
  </TabsContent>
</Tabs>
```
où `setTrust` est l'état qui ouvre déjà `TrustDialog` (écran 30) pour un composant local ; `onApproved` appelle `approveComponent` (phase 4) avec `result.hash`.

Ajouter à `marketplace.test.tsx` :
```tsx
test("the components page offers the Installed and Marketplace tabs", async () => {
  answers.listComponents = () => Promise.resolve([]);
  answers.listMarketSources = () => Promise.resolve([]);
  const { ComponentsPage } = await import("./ComponentsPage");
  render(<ComponentsPage />);
  expect(screen.getByRole("tab", { name: "Installés" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("tab", { name: "Marketplace" }));
  expect(await screen.findByText("Aucune source de marketplace. Ajoute-en une dans Paramètres › Composants.")).toBeTruthy();
});
```

Run: `bun test packages/ui/src/pages/components`
Expected: PASS.

- [ ] **Step 8: Tests des sources (M3)**

`packages/ui/src/pages/settings/sources.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type MarketSourceInfo, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const answer = answers[req.method];
      return answer ? answer() : Promise.resolve(null);
    },
  },
}));

const { ComponentSourcesSettings } = await import("./ComponentSourcesSettings");
const { AddSourceDialog } = await import("../../dialogs/AddSourceDialog");

const source: MarketSourceInfo = {
  id: "equipe",
  name: "Équipe",
  url: "https://sync.kibo.test/market/",
  publicKey: "PK",
  fingerprint: "3f9a".repeat(16),
  lastSerial: 42,
  lastFetchedAt: Date.parse("2026-09-26T09:00:00Z"),
  lastError: null,
  enabled: true,
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("the table lists each source with its short key and serial", async () => {
  answers.listMarketSources = () => Promise.resolve([source, { ...source, id: "vieille", name: "Vieille", lastError: "INDEX_ROLLBACK: serial 3 < 4" }]);
  render(<ComponentSourcesSettings />);
  expect(await screen.findByText("Équipe")).toBeTruthy();
  expect(screen.getAllByText("3f9a…3f9a")).toHaveLength(2);
  expect(screen.getAllByText("42")).toHaveLength(2);
  expect(screen.getByText("Index refusé : numéro inférieur au dernier vu.")).toBeTruthy();
});

test("adding a source shows the full fingerprint before confirming", async () => {
  answers.probeMarketSource = () =>
    Promise.resolve({ sourceId: "equipe", name: "Équipe", publicKey: "PK", fingerprint: "3f9a".repeat(16), serial: 42, packages: 3 });
  answers.addMarketSource = () => Promise.resolve(source);
  const onAdded = mock(() => {});
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={onAdded} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Adresse HTTPS de la source"), "https://sync.kibo.test/market/");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect(await screen.findByText("Compare cette empreinte avec celle communiquée par l'éditeur de la source.")).toBeTruthy();
  expect(screen.getByText("3f9a ".repeat(15) + "3f9a")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(calls.at(-1)).toEqual({ method: "addMarketSource", url: "https://sync.kibo.test/market/", publicKey: "PK" });
});

test("going back returns to the address step without adding anything", async () => {
  answers.probeMarketSource = () =>
    Promise.resolve({ sourceId: "equipe", name: "Équipe", publicKey: "PK", fingerprint: "3f9a".repeat(16), serial: 42, packages: 3 });
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Adresse HTTPS de la source"), "https://sync.kibo.test/market/");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await user.click(await screen.findByRole("button", { name: "Retour" }));
  expect(screen.getByLabelText("Adresse HTTPS de la source")).toBeTruthy();
  expect(calls.some((c) => c.method === "addMarketSource")).toBe(false);
});

test("a probe failure is explained on the first step", async () => {
  answers.probeMarketSource = () => Promise.reject(new KiboError("TLS_REQUIRED", "x"));
  render(<AddSourceDialog open onOpenChange={() => {}} onAdded={() => {}} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Adresse HTTPS de la source"), "http://example.com/");
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Adresse non chiffrée : utilise https://.");
});
```

Run: `bun test packages/ui/src/pages/settings/sources.test.tsx`
Expected: FAIL avec « Cannot find module './ComponentSourcesSettings' ».

- [ ] **Step 9: Implémenter les sources**

`packages/ui/src/dialogs/AddSourceDialog.tsx` :
```tsx
import type { MarketProbe } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { groupFingerprint } from "../lib/fingerprint";
import { marketErrorText } from "../lib/market-errors";

type Props = { open: boolean; onOpenChange(open: boolean): void; onAdded(): void };

export function AddSourceDialog({ open, onOpenChange, onAdded }: Props) {
  const urlId = useId();
  const [url, setUrl] = useState("");
  const [probe, setProbe] = useState<MarketProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(marketErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => setProbe((await client.rpc({ method: "probeMarketSource", url: url.trim() })) as MarketProbe));
  };
  const confirm = () =>
    run(async () => {
      if (!probe) return;
      await client.rpc({ method: "addMarketSource", url: url.trim(), publicKey: probe.publicKey });
      onAdded();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.sources.addTitle}</DialogTitle>
          <DialogDescription>{probe ? fr.sources.step2 : fr.sources.subtitle}</DialogDescription>
        </DialogHeader>
        {probe ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{probe.name}</p>
            <p className="text-xs text-muted-foreground">{fr.sources.fingerprint}</p>
            <p className="break-all rounded-md bg-muted p-2 font-mono text-xs">{groupFingerprint(probe.fingerprint)}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProbe(null)}>
                {fr.sources.back}
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {fr.sources.confirm}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={next} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={urlId}>{fr.sources.step1}</Label>
              <Input id={urlId} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !url.trim()}>
                {fr.sources.next}
              </Button>
            </DialogFooter>
          </form>
        )}
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

`packages/ui/src/pages/settings/ComponentSourcesSettings.tsx` :
```tsx
import type { MarketSourceInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../api";
import { AddSourceDialog } from "../../dialogs/AddSourceDialog";
import { fr } from "../../i18n/fr";
import { shortFingerprint } from "../../lib/fingerprint";
import { marketErrorCodeText, marketErrorText } from "../../lib/market-errors";

const stateText = (s: MarketSourceInfo): string =>
  s.lastError ? marketErrorCodeText(s.lastError.split(":")[0] ?? "") : fr.sources.ok;

export function ComponentSourcesSettings() {
  const [sources, setSources] = useState<MarketSourceInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    client
      .rpc({ method: "listMarketSources" })
      .then((s) => setSources(s as MarketSourceInfo[]))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, []);
  useEffect(load, [load]);

  const act = (req: Parameters<typeof client.rpc>[0]) =>
    client
      .rpc(req)
      .then(load)
      .catch((e: unknown) => setError(marketErrorText(e)));

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{fr.sources.title}</h2>
          <p className="text-sm text-muted-foreground">{fr.sources.subtitle}</p>
        </div>
        <Button onClick={() => setAdding(true)}>{fr.sources.add}</Button>
      </header>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.sources.empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2">{fr.sources.name}</th>
              <th>{fr.sources.url}</th>
              <th>{fr.sources.key}</th>
              <th>{fr.sources.serial}</th>
              <th>{fr.sources.updated}</th>
              <th>{fr.sources.state}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2 font-medium">{s.name}</td>
                <td className="truncate font-mono text-xs">{s.url}</td>
                <td className="font-mono text-xs">{shortFingerprint(s.fingerprint)}</td>
                <td>{s.lastSerial ?? "—"}</td>
                <td className="text-xs">{s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString("fr-FR") : fr.sources.never}</td>
                <td className={s.lastError ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{stateText(s)}</td>
                <td>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={fr.sources.actions(s.name)}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => act({ method: "refreshMarket" })}>{fr.sources.refresh}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => act({ method: "removeMarketSource", id: s.id })}>{fr.sources.remove}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <AddSourceDialog open={adding} onOpenChange={setAdding} onAdded={load} />
    </section>
  );
}
```
Le `lastError` stocké par le démon commence par le code (`KiboError.message` = `CODE: détail`), d'où la lecture du préfixe.

Dans `sections.ts`, ajouter `{ id: "components", label: fr.settings.components, render: () => <ComponentSourcesSettings /> }` après « Intégrations ».

Run: `bun test packages/ui/src/pages/settings/sources.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Vérifications**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run --cwd packages/ui build`
Expected: aucune erreur. Contrôle visuel en sombre et en clair (`bun run --cwd packages/ui dev` avec un démon et `startFakeMarket`) face aux exports M1, M2, M3, M5 ; écarts corrigés avant la review.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/src/pages/components packages/ui/src/pages/settings/ComponentSourcesSettings.tsx packages/ui/src/pages/settings/sources.test.tsx packages/ui/src/pages/settings/sections.ts packages/ui/src/dialogs/AddSourceDialog.tsx packages/ui/src/dialogs/TrustDialog.tsx packages/ui/src/dialogs/trust-market.test.tsx packages/ui/src/lib/fingerprint.ts packages/ui/src/lib/market-errors.ts packages/ui/src/lib/market-errors.test.ts packages/ui/src/i18n/fr.ts packages/sdk/src/ui/tabs.tsx
git commit -m "feat(ui): marketplace"
```

---

### Task 27: UI Marketplace : mises à jour, révocation, composant absent, publication

Écrans **M4** (onglet Installés : mise à jour disponible, révoqué), **M6** (clé d'éditeur changée), **M8** (publier sur la marketplace) et **S7** (composant absent), en sombre et en clair. Spec H §4 (révocation), §5.1, §5.3, §5.5.

**Prérequis :** écrans M4, M6, M8 et S7 dessinés et exportés.

**Files:**
- Create: `packages/ui/src/pages/components/MarketUpdateFlow.tsx`, `packages/ui/src/dialogs/PublisherChangedDialog.tsx`, `packages/ui/src/dialogs/PublishToMarketDialog.tsx`, `packages/ui/src/shell/MissingComponent.tsx`, `packages/ui/src/lib/market-update.ts`
- Modify: `packages/ui/src/pages/components/InstalledTable.tsx` (colonne Origine, badges, menu `⋯`), `packages/ui/src/pages/PageView.tsx` (composant absent), `packages/ui/src/shell/AuthorizationRequired.tsx` (motif de révocation), `packages/ui/src/lib/fingerprint.ts` (`keyFingerprintHex`), `packages/ui/src/i18n/fr.ts`, `packages/daemon/src/components/rpc.ts` (`listComponents` enrichi), `packages/daemon/src/market/rpc.ts` (`getMarketPublisher`), `packages/schema/src/rpc.ts` et `packages/schema/src/market.ts`
- Test: `packages/ui/src/pages/components/market-update.test.tsx`, `packages/ui/src/dialogs/market-dialogs.test.tsx`, `packages/ui/src/shell/missing-component.test.tsx`, `packages/ui/src/lib/market-update.test.ts`, `packages/daemon/src/market/summary.test.ts`

**Interfaces:**
- Consumes: RPC `getMarketPackage`, `installFromMarket`, `unpinPublisher`, `findMarketSource`, `publishToMarket`, `listMarketSources` (T15, T20, T22), `getSyncStatus` (T21) ; `approveComponent`, `updateInstance`, `listComponents` (phase 4) ; `MarketPackageSheet`, `marketErrorText`, `marketTrustProps`, `shortFingerprint` (T26) ; `ProjectSnapshot.sync.members` (T6, T23) ; `MarketService.search`, `loadPublisherKeys` (T15, T22).
- Hypothèse v0.6 (vérifiée en T0) : `ComponentSummary = { id: string; title: string; origin: ComponentOrigin; versions: ComponentVersionSummary[] }` avec `ComponentVersionSummary = { version: string; hash: string; trust: TrustLevel | null; usages: { projectId: string; projectName: string; pageId: string; pageTitle: string; instanceId: string }[]; granted: GrantedPermissions }` ; `PublishDialog({ data, open, onConfirm, onCancel }: { data: PublishDialogData; open: boolean; onConfirm(strategy: "update-all" | "new-version"): void; onCancel(): void })` avec `PublishDialogData = Omit<PublishPreview, "validation">` ; `AuthorizationRequired({ reason }: { reason: string | null })` ; `PageView` affiche `fr.page.unknownComponent` quand `resolveComponent(ref)` rend `null`.
- Produces :
  - `ComponentVersionSummary.market: { sourceId: string; sourceName: string; updateAvailable: string | null } | null` et `ComponentVersionSummary.revoked: { reason: string; at: number } | null` (**champs ajoutés**, remplis par `listComponents`).
  - RPC `getMarketPublisher` → `{ name: string; fingerprint: string } | null` (**méthode ajoutée**, lecture seule de la clé `market:publisher`).
  - `buildUpdateData(input: { summary: ComponentSummary; from: string; detail: MarketPackageDetail }): PublishDialogData` (`lib/market-update.ts`).
  - `MarketUpdateFlow({ summary, from, to, sourceId, onDone })`, `PublisherChangedDialog({ detail, open, onOpenChange, onUnlocked })`, `PublishToMarketDialog({ component, open, onOpenChange })`, `MissingComponent({ projectId, instance, members })`.
  - `keyFingerprintHex(publicKey: string): Promise<string>` (`lib/fingerprint.ts`, WebCrypto du navigateur).

- [ ] **Step 1: Côté démon, test du résumé enrichi et de l'éditeur**

`packages/daemon/src/market/summary.test.ts` :
```ts
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { makeTestPackage } from "@kibo/trust/testing";
import { MemorySecretStore } from "../secrets/secret-store";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { marketPublisherInfo, marketVersionInfo } from "./summary";

let fake: FakeMarket;
let market: MarketService;
let registry: ReturnType<typeof createMemoryRegistry>;

beforeEach(async () => {
  fake = await startFakeMarket();
  registry = createMemoryRegistry();
  market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: registry.port,
    now: () => 1,
    notify: mock(async () => {}),
    log: mock(() => {}),
  });
});
afterEach(() => fake.stop());

test("a marketplace version reports its source and the newer version", async () => {
  const v1 = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown" } });
  await fake.publish(v1.bytes);
  await fake.publish((await makeTestPackage({ id: "burndown", version: "0.2.0", publisher: v1.publisher, manifest: { title: "Burndown" } })).bytes);
  await market.addSource({ url: fake.url, publicKey: fake.publicKey });
  const v = {
    version: "0.1.0",
    hash: v1.pkg.hash,
    origin: "marketplace" as const,
    trust: "sandboxed" as const,
    approvedHash: v1.pkg.hash,
    granted: { reads: [], writes: [], data: false, net: [] },
    publishedAt: 0,
    source: { sourceId: "equipe", publisherKey: v1.publisher.keys.publicKey },
    revoked: null,
  };
  registry.port.put("burndown", "Burndown", v);
  expect(marketVersionInfo(market, "burndown", v)).toEqual({ sourceId: "equipe", sourceName: "Équipe", updateAvailable: "0.2.0" });
  expect(marketVersionInfo(market, "burndown", { ...v, source: null })).toBeNull();
});

test("the publisher identity is readable without exposing the private key", async () => {
  const secrets = new MemorySecretStore();
  expect(await marketPublisherInfo(secrets)).toBeNull();
  await secrets.set("market:publisher", JSON.stringify({ name: "Adam", publicKey: "MCowBQYDK2VwAyEA", privateKey: "SECRET" }));
  const info = await marketPublisherInfo(secrets);
  expect(info?.name).toBe("Adam");
  expect(JSON.stringify(info)).not.toContain("SECRET");
});
```

Run: `bun test packages/daemon/src/market/summary.test.ts`
Expected: FAIL avec « Cannot find module './summary' ».

- [ ] **Step 2: Implémenter `summary.ts` et les RPC**

`packages/daemon/src/market/summary.ts` :
```ts
import type { RegistryVersion } from "@kibo/schema";
import { keyFingerprint } from "@kibo/trust";
import type { SecretStore } from "../secrets/secret-store";
import type { MarketService } from "./market-service";
import { loadPublisherKeys } from "./publisher-keys";

export function marketVersionInfo(
  market: MarketService,
  id: string,
  v: RegistryVersion,
): { sourceId: string; sourceName: string; updateAvailable: string | null } | null {
  if (!v.source) return null;
  const source = market.listSources().find((s) => s.id === v.source?.sourceId);
  const hit = market.search({ query: id, sourceId: v.source.sourceId }).find((h) => h.id === id);
  return {
    sourceId: v.source.sourceId,
    sourceName: source?.name ?? v.source.sourceId,
    updateAvailable: hit?.updateAvailable ?? null,
  };
}

export async function marketPublisherInfo(secrets: SecretStore): Promise<{ name: string; fingerprint: string } | null> {
  if (!(await secrets.has("market:publisher"))) return null;
  const keys = await loadPublisherKeys(secrets);
  return { name: keys.name, fingerprint: await keyFingerprint(keys.publicKey) };
}
```
`marketVersionInfo` compare à la version la plus haute installée depuis la même source, ce que `search` calcule déjà (`updateAvailable`).

Dans `packages/daemon/src/components/rpc.ts`, `listComponents` ajoute à chaque version `market: marketVersionInfo(market, id, v)` et `revoked: v.revoked`. Dans `market/rpc.ts`, `case "getMarketPublisher": return done(await marketPublisherInfo(secrets));`. Dans `packages/schema/src/rpc.ts`, ajouter `z.object({ method: z.literal("getMarketPublisher") })` à `RpcRequest` et `getMarketPublisher: { name: string; fingerprint: string } | null` à `RpcResult` ; dans `ComponentVersionSummary`, ajouter les deux champs.

Run: `bun test packages/daemon/src/market/summary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Textes `fr.ts`**

Ajouter à `fr.market` :
```ts
    originMarket: (source: string) => `Marketplace · ${source}`,
    update: "Mettre à jour",
    revokedBadge: "Révoqué",
    authRevoked: (reason: string) => `Révoqué : ${reason}`,
    missing: (ref: string) => `Composant absent : ${ref}`,
    askOwner: (name: string) => `Demande à ${name} de le publier sur la marketplace d'équipe.`,
    changedTitle: "La clé de l'éditeur a changé",
    changedHelp: "Ne débloque que si l'éditeur t'a confirmé ce changement.",
    oldKey: "Ancienne clé",
    newKey: "Nouvelle clé",
    unlockConfirm: "Débloquer",
    publish: "Publier sur la marketplace",
    publishTitle: (title: string, version: string) => `Publier « ${title} » ${version}`,
    publishSource: "Source",
    publishNoSource: "Aucune source d'équipe : connecte-toi à un serveur de sync et ajoute sa marketplace.",
    publisherName: "Nom d'éditeur",
    publisherNameHelp: "Ce nom accompagne tes composants publiés.",
    publishing: "Publication…",
    published: (serial: number) => `Publié : index n° ${serial}`,
    publishErrors: {
      VERSION_EXISTS: "Version déjà publiée.",
      FORBIDDEN: "Tu n'as pas le droit de publier sur cette source.",
    },
```

- [ ] **Step 4: Test du calcul de mise à jour**

`packages/ui/src/lib/market-update.test.ts` :
```ts
import { expect, test } from "bun:test";
import type { MarketPackageDetail } from "@kibo/schema";
import { buildUpdateData } from "./market-update";

const summary = {
  id: "burndown",
  title: "Burndown",
  origin: "marketplace" as const,
  versions: [
    {
      version: "0.1.0",
      hash: "a".repeat(64),
      trust: "sandboxed" as const,
      granted: { reads: ["ticket" as const], writes: [], data: false, net: [] },
      usages: [
        { projectId: "p1", projectName: "Kibo", pageId: "pg1", pageTitle: "Tableau de bord", instanceId: "i1" },
        { projectId: "p2", projectName: "Portfolio", pageId: "pg2", pageTitle: "Suivi", instanceId: "i2" },
      ],
      market: { sourceId: "equipe", sourceName: "Équipe", updateAvailable: "0.2.0" },
      revoked: null,
    },
  ],
};

const detail = {
  version: "0.2.0",
  hash: "b".repeat(64),
  title: "Burndown",
  permissions: { reads: ["ticket" as const, "status" as const], writes: [], data: true, net: [] },
  files: [{ path: "kibo.component.json", content: JSON.stringify({ changes: ["Ligne idéale", "Export CSV"] }) }],
} satisfies Partial<MarketPackageDetail>;

test("the update dialog lists usages, the publisher changes and the new permissions", () => {
  const data = buildUpdateData({ summary, from: "0.1.0", detail });
  expect(data).toMatchObject({ id: "burndown", title: "Burndown", from: "0.1.0", to: "0.2.0", hash: "b".repeat(64), migration: null });
  expect(data.usages.map((u) => u.projectName)).toEqual(["Kibo", "Portfolio"]);
  expect(data.changes).toEqual(["Ligne idéale", "Export CSV"]);
  expect(data.newPermissions).toEqual(["reads:status", "data"]);
});

test("a manifest without changes gives an empty list", () => {
  const data = buildUpdateData({ summary, from: "0.1.0", detail: { ...detail, files: [] } });
  expect(data.changes).toEqual([]);
});
```

Run: `bun test packages/ui/src/lib/market-update.test.ts`
Expected: FAIL avec « Cannot find module './market-update' ».

`packages/ui/src/lib/market-update.ts` :
```ts
import type { ComponentSummary, GrantedPermissions, MarketPackageDetail, PublishDialogData } from "@kibo/schema";
import { z } from "zod";

const Changes = z.object({ changes: z.array(z.string()).default([]) });

const permissionKeys = (g: GrantedPermissions): string[] => [
  ...g.reads.map((r) => `reads:${r}`),
  ...g.writes.map((w) => `writes:${w}`),
  ...(g.data ? ["data"] : []),
  ...g.net.map((n) => `net:${n}`),
];

export function buildUpdateData(input: {
  summary: ComponentSummary;
  from: string;
  detail: Pick<MarketPackageDetail, "version" | "hash" | "title" | "permissions" | "files">;
}): PublishDialogData {
  const current = input.summary.versions.find((v) => v.version === input.from);
  const manifest = input.detail.files.find((f) => f.path === "kibo.component.json");
  const parsed = manifest ? Changes.safeParse(JSON.parse(manifest.content)) : null;
  const before = new Set(current ? permissionKeys(current.granted) : []);
  return {
    id: input.summary.id,
    title: input.detail.title,
    from: input.from,
    to: input.detail.version,
    hash: input.detail.hash,
    usages: (current?.usages ?? []).map(({ projectId, projectName, pageId, pageTitle }) => ({
      projectId,
      projectName,
      pageId,
      pageTitle,
      version: input.from,
    })),
    changes: parsed?.success ? parsed.data.changes : [],
    newPermissions: permissionKeys(input.detail.permissions).filter((p) => !before.has(p)),
    migration: null,
  };
}
```
`newPermissions` suit la notation de l'écran 6 (`net:api.github.com/graphql`, spec B §3.1) ; la migration de configuration n'est connue qu'au moment de `updateInstance`, qui l'exécute dans le backend de la version cible (spec B §7.3), d'où `migration: null` dans l'aperçu. Si `PublishDialogData` ou `ComponentSummary` ne sont pas exportés par `@kibo/schema` en v0.6, les importer depuis leur module de la phase 4.

Run: `bun test packages/ui/src/lib/market-update.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests du flux de mise à jour et de l'onglet Installés**

`packages/ui/src/pages/components/market-update.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const a = answers[req.method];
      return a ? a() : Promise.resolve(null);
    },
  },
}));

const { InstalledTable } = await import("./InstalledTable");
const { MarketUpdateFlow } = await import("./MarketUpdateFlow");
const { trustPreviewFixture } = await import("../../testing/trust-preview-fixture");

const usage = (n: number) => ({ projectId: `p${n}`, projectName: `Projet ${n}`, pageId: `pg${n}`, pageTitle: "Page", instanceId: `i${n}` });
const summary = {
  id: "burndown",
  title: "Burndown",
  origin: "marketplace" as const,
  versions: [
    {
      version: "0.1.0",
      hash: "a".repeat(64),
      trust: "sandboxed" as const,
      granted: { reads: ["ticket" as const], writes: [], data: false, net: [] },
      usages: [usage(1), usage(2)],
      market: { sourceId: "equipe", sourceName: "Équipe", updateAvailable: "0.2.0" },
      revoked: null,
    },
  ],
};
const detail = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "burndown",
  title: "Burndown",
  description: "d",
  kind: "widget",
  latest: "0.2.0",
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  installed: "0.1.0",
  updateAvailable: "0.2.0",
  version: "0.2.0",
  hash: "b".repeat(64),
  size: 10,
  permissions: { reads: ["ticket"], writes: [], data: false, net: [] },
  versions: [],
  pinnedPublisher: "LEA",
  newPublisher: false,
  publisherChanged: false,
  files: [{ path: "kibo.component.json", content: '{"changes":["Ligne idéale"]}' }],
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("the installed table shows the marketplace origin, the update and a revoked version", async () => {
  answers.listComponents = () =>
    Promise.resolve([
      summary,
      {
        ...summary,
        id: "roadmap",
        title: "Feuille de route",
        versions: [{ ...summary.versions[0], market: { sourceId: "equipe", sourceName: "Équipe", updateAvailable: null }, revoked: { reason: "Faille", at: 1 } }],
      },
    ]);
  render(<InstalledTable />);
  expect((await screen.findAllByText("Marketplace · Équipe")).length).toBe(2);
  expect(screen.getByText("0.2.0 disponible")).toBeTruthy();
  expect(screen.getByText("Révoqué")).toBeTruthy();
  expect(screen.getByText("Révoqué : Faille")).toBeTruthy();
});

test("updating everywhere installs, asks for trust, approves then updates each usage", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () =>
    Promise.resolve({ id: "burndown", version: "0.2.0", hash: "b".repeat(64), preview: { ...trustPreviewFixture, market: null } });
  const onDone = mock(() => {});
  render(<MarketUpdateFlow summary={summary} from="0.1.0" to="0.2.0" sourceId="equipe" onDone={onDone} />);
  const user = userEvent.setup();
  expect(await screen.findByText("Ligne idéale")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Mettre à jour partout" }));
  await user.click(await screen.findByRole("radio", { name: /Sandboxé/ }));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(calls.map((c) => c.method)).toEqual([
    "getMarketPackage",
    "installFromMarket",
    "approveComponent",
    "updateInstance",
    "updateInstance",
  ]);
  expect(calls.slice(-2)).toEqual([
    { method: "updateInstance", projectId: "p1", instanceId: "i1", to: "0.2.0" },
    { method: "updateInstance", projectId: "p2", instanceId: "i2", to: "0.2.0" },
  ]);
});

test("creating a new version leaves the instances alone", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () =>
    Promise.resolve({ id: "burndown", version: "0.2.0", hash: "b".repeat(64), preview: { ...trustPreviewFixture, market: null } });
  render(<MarketUpdateFlow summary={summary} from="0.1.0" to="0.2.0" sourceId="equipe" onDone={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Créer une nouvelle version" }));
  await user.click(await screen.findByRole("radio", { name: /Sandboxé/ }));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(calls.some((c) => c.method === "approveComponent")).toBe(true));
  expect(calls.some((c) => c.method === "updateInstance")).toBe(false);
});

test("a changed publisher opens the unlock dialog instead of the update", async () => {
  answers.getMarketPackage = () => Promise.resolve({ ...detail, publisherChanged: true, pinnedPublisher: "OLD" });
  render(<MarketUpdateFlow summary={summary} from="0.1.0" to="0.2.0" sourceId="equipe" onDone={() => {}} />);
  expect(await screen.findByText("La clé de l'éditeur a changé")).toBeTruthy();
  expect(calls.some((c) => c.method === "installFromMarket")).toBe(false);
});
```
Les libellés « Mettre à jour partout », « Créer une nouvelle version », « Sandboxé » et « Autoriser » sont ceux des dialogues des écrans 6 et 30 de la phase 4 ; T0 confirme leur texte exact.

Run: `bun test packages/ui/src/pages/components/market-update.test.tsx`
Expected: FAIL avec « Cannot find module './MarketUpdateFlow' ».

- [ ] **Step 6: Implémenter le flux et l'onglet Installés**

`packages/ui/src/pages/components/MarketUpdateFlow.tsx` :
```tsx
import type { ComponentSummary, MarketInstallResult, MarketPackageDetail } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { PublishDialog } from "../../dialogs/PublishDialog";
import { PublisherChangedDialog } from "../../dialogs/PublisherChangedDialog";
import { marketTrustProps, TrustDialog } from "../../dialogs/TrustDialog";
import { marketErrorText } from "../../lib/market-errors";
import { buildUpdateData } from "../../lib/market-update";

type Props = { summary: ComponentSummary; from: string; to: string; sourceId: string; onDone(): void };
type Strategy = "update-all" | "new-version";

export function MarketUpdateFlow({ summary, from, to, sourceId, onDone }: Props) {
  const [detail, setDetail] = useState<MarketPackageDetail | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [installed, setInstalled] = useState<MarketInstallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .rpc({ method: "getMarketPackage", sourceId, id: summary.id, version: to })
      .then((d) => setDetail(d as MarketPackageDetail))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, [sourceId, summary.id, to]);

  const confirm = async (chosen: Strategy) => {
    setStrategy(chosen);
    try {
      setInstalled((await client.rpc({ method: "installFromMarket", sourceId, id: summary.id, version: to })) as MarketInstallResult);
    } catch (e) {
      setError(marketErrorText(e));
    }
  };

  const approve = async (trust: "trusted" | "sandboxed") => {
    if (!installed) return;
    try {
      await client.rpc({ method: "approveComponent", id: summary.id, version: to, hash: installed.hash, trust });
      if (strategy === "update-all") {
        const usages = summary.versions.find((v) => v.version === from)?.usages ?? [];
        for (const u of usages) {
          await client.rpc({ method: "updateInstance", projectId: u.projectId, instanceId: u.instanceId, to });
        }
      }
      onDone();
    } catch (e) {
      setError(marketErrorText(e));
    }
  };

  if (detail?.publisherChanged) {
    return <PublisherChangedDialog detail={detail} open onOpenChange={(o) => (o ? undefined : onDone())} onUnlocked={onDone} />;
  }
  return (
    <>
      {detail && !installed ? (
        <PublishDialog
          data={buildUpdateData({ summary, from, detail })}
          open
          onConfirm={(s) => void confirm(s)}
          onCancel={onDone}
        />
      ) : null}
      {installed ? (
        <TrustDialog
          preview={installed.preview}
          open
          onApproved={(trust) => void approve(trust)}
          onRefused={onDone}
          {...marketTrustProps(installed.preview.market)}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
```
Dans `InstalledTable.tsx` : la colonne Origine affiche `fr.market.originMarket(v.market.sourceName)` quand `v.market` n'est pas nul ; à côté de la version, `v.market?.updateAvailable` rend `<Badge variant="secondary">{fr.market.available(...)}</Badge>` et un bouton `fr.market.update` qui monte `<MarketUpdateFlow summary={c} from={v.version} to={v.market.updateAvailable} sourceId={v.market.sourceId} onDone={reload} />` ; `v.revoked` rend `<Badge variant="destructive">{fr.market.revokedBadge}</Badge>` et, en sous-texte, `fr.market.authRevoked(v.revoked.reason)`. Pour un composant d'origine `user` ou `ai`, le menu `⋯` gagne l'entrée `fr.market.publish` qui ouvre `PublishToMarketDialog`.

Dans `AuthorizationRequired.tsx`, quand `reason` est fourni, afficher `fr.market.authRevoked(reason)` sous le titre « Autorisation requise » ; l'hôte d'instance passe `version.revoked?.reason ?? null`.

Run: `bun test packages/ui/src/pages/components/market-update.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Tests des dialogues M6 et M8**

`packages/ui/src/dialogs/market-dialogs.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const a = answers[req.method];
      return a ? a() : Promise.resolve(null);
    },
  },
}));

const { PublisherChangedDialog } = await import("./PublisherChangedDialog");
const { PublishToMarketDialog } = await import("./PublishToMarketDialog");

const team = { id: "equipe", name: "Équipe", url: "https://sync.kibo.test/market/", publicKey: "PK", fingerprint: "f".repeat(64), lastSerial: 41, lastFetchedAt: 1, lastError: null, enabled: true };
const statik = { ...team, id: "perso", name: "Perso", url: "https://kibo.example.org/" };
const component = { id: "burndown", title: "Burndown", version: "0.3.0", hash: "c21e".repeat(16), permissions: { reads: ["ticket" as const], writes: [], data: false, net: [] } };

beforeEach(() => {
  calls.length = 0;
  answers = {
    listMarketSources: () => Promise.resolve([team, statik]),
    getSyncStatus: () => Promise.resolve({ state: "online", serverUrl: "wss://sync.kibo.test", user: null, deviceId: null, retryAt: null, lastError: null, projects: [] }),
  };
});

test("unlocking a changed publisher key unpins it after confirmation", async () => {
  const onUnlocked = mock(() => {});
  const detail = { sourceId: "equipe", id: "burndown", pinnedPublisher: "MCowBQYDK2VwAyEAb2xk", publisher: { name: "Léa", publicKey: "MCowBQYDK2VwAyEAbmV3", verified: true } };
  render(<PublisherChangedDialog detail={detail} open onOpenChange={() => {}} onUnlocked={onUnlocked} />);
  expect(screen.getByText("Ne débloque que si l'éditeur t'a confirmé ce changement.")).toBeTruthy();
  expect(await screen.findByText("Ancienne clé")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Débloquer" }));
  await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  expect(calls.at(-1)).toEqual({ method: "unpinPublisher", sourceId: "equipe", componentId: "burndown" });
});

test("the first publication asks for a publisher name and only offers team sources", async () => {
  answers.getMarketPublisher = () => Promise.resolve(null);
  answers.publishToMarket = () => Promise.resolve({ serial: 42 });
  render(<PublishToMarketDialog component={component} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(await screen.findByText("Ce nom accompagne tes composants publiés.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Équipe" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Perso" })).toBeNull();
  await user.type(screen.getByLabelText("Nom d'éditeur"), "Adam");
  await user.click(screen.getByRole("button", { name: "Publier sur la marketplace" }));
  expect(await screen.findByText("Publié : index n° 42")).toBeTruthy();
  expect(calls.at(-1)).toEqual({ method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "equipe", publisherName: "Adam" });
});

test("a known publisher publishes without the name field", async () => {
  answers.getMarketPublisher = () => Promise.resolve({ name: "Adam", fingerprint: "a".repeat(64) });
  answers.publishToMarket = () => Promise.resolve({ serial: 43 });
  render(<PublishToMarketDialog component={component} open onOpenChange={() => {}} />);
  await screen.findByRole("radio", { name: "Équipe" });
  expect(screen.queryByLabelText("Nom d'éditeur")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Publier sur la marketplace" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "publishToMarket", id: "burndown", version: "0.3.0", sourceId: "equipe" }));
});

test("publication errors are explained", async () => {
  answers.getMarketPublisher = () => Promise.resolve({ name: "Adam", fingerprint: "a".repeat(64) });
  answers.publishToMarket = () => Promise.reject(new KiboError("FORBIDDEN", "x"));
  render(<PublishToMarketDialog component={component} open onOpenChange={() => {}} />);
  await screen.findByRole("radio", { name: "Équipe" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Publier sur la marketplace" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Tu n'as pas le droit de publier sur cette source.");
});

test("without a team source the dialog says how to get one", async () => {
  answers.listMarketSources = () => Promise.resolve([statik]);
  answers.getMarketPublisher = () => Promise.resolve(null);
  render(<PublishToMarketDialog component={component} open onOpenChange={() => {}} />);
  expect(await screen.findByText("Aucune source d'équipe : connecte-toi à un serveur de sync et ajoute sa marketplace.")).toBeTruthy();
});
```

Run: `bun test packages/ui/src/dialogs/market-dialogs.test.tsx`
Expected: FAIL avec « Cannot find module './PublisherChangedDialog' ».

- [ ] **Step 8: Implémenter M6 et M8**

Ajouter à `packages/ui/src/lib/fingerprint.ts` :
```ts
export async function keyFingerprintHex(publicKey: string): Promise<string> {
  const raw = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```
Elle calcule la même empreinte que `keyFingerprint` de `@kibo/trust` (SHA-256 des octets SPKI). Ajouter à `packages/ui/src/lib/market-errors.test.ts` :
```ts
import { keyFingerprintHex } from "./fingerprint";

test("the browser fingerprint matches a SHA-256 of the SPKI bytes", async () => {
  const key = "MCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const expected = new Bun.CryptoHasher("sha256").update(Buffer.from(key, "base64")).digest("hex");
  expect(await keyFingerprintHex(key)).toBe(expected);
});
```

`packages/ui/src/dialogs/PublisherChangedDialog.tsx` :
```tsx
import type { MarketPackageDetail } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { groupFingerprint, keyFingerprintHex } from "../lib/fingerprint";
import { marketErrorText } from "../lib/market-errors";

type Detail = Pick<MarketPackageDetail, "sourceId" | "id" | "pinnedPublisher" | "publisher">;
type Props = { detail: Detail; open: boolean; onOpenChange(open: boolean): void; onUnlocked(): void };

export function PublisherChangedDialog({ detail, open, onOpenChange, onUnlocked }: Props) {
  const [prints, setPrints] = useState<{ old: string; next: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([keyFingerprintHex(detail.pinnedPublisher ?? ""), keyFingerprintHex(detail.publisher.publicKey)])
      .then(([old, next]) => setPrints({ old, next }))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, [detail]);

  const unlock = async () => {
    try {
      await client.rpc({ method: "unpinPublisher", sourceId: detail.sourceId, componentId: detail.id });
      onUnlocked();
    } catch (e) {
      setError(marketErrorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.market.changedTitle}</DialogTitle>
          <DialogDescription>{fr.market.changedHelp}</DialogDescription>
        </DialogHeader>
        {prints ? (
          <dl className="grid gap-2 text-xs">
            <dt className="text-muted-foreground">{fr.market.oldKey}</dt>
            <dd className="break-all font-mono">{groupFingerprint(prints.old)}</dd>
            <dt className="text-muted-foreground">{fr.market.newKey}</dt>
            <dd className="break-all font-mono">{groupFingerprint(prints.next)}</dd>
          </dl>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {fr.common.cancel}
          </Button>
          <Button variant="destructive" onClick={unlock}>
            {fr.market.unlockConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`packages/ui/src/dialogs/PublishToMarketDialog.tsx` :
```tsx
import { KiboError, type GrantedPermissions, type MarketSourceInfo, type SyncStatus } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { RadioGroup, RadioGroupItem } from "@kibo/sdk/ui/radio-group";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { shortFingerprint } from "../lib/fingerprint";
import { marketErrorText } from "../lib/market-errors";
import { permissionLines } from "../lib/permission-lines";

type Component = { id: string; title: string; version: string; hash: string; permissions: GrantedPermissions };
type Props = { component: Component; open: boolean; onOpenChange(open: boolean): void };
const publishErrors: Record<string, string> = fr.market.publishErrors;

export function PublishToMarketDialog({ component, open, onOpenChange }: Props) {
  const nameId = useId();
  const [sources, setSources] = useState<MarketSourceInfo[] | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done"; serial: number } | { kind: "error"; text: string }>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    Promise.all([client.rpc({ method: "listMarketSources" }), client.rpc({ method: "getSyncStatus" }), client.rpc({ method: "getMarketPublisher" })])
      .then(([all, status, publisher]) => {
        const serverUrl = (status as SyncStatus).serverUrl;
        const host = serverUrl ? new URL(serverUrl).host : null;
        const team = (all as MarketSourceInfo[]).filter((s) => host !== null && new URL(s.url).host === host);
        setSources(team);
        setSourceId(team[0]?.id ?? "");
        setNeedsName(publisher === null);
      })
      .catch((e: unknown) => setState({ kind: "error", text: marketErrorText(e) }));
  }, [open]);

  const publish = async () => {
    setState({ kind: "busy" });
    try {
      const result = (await client.rpc({
        method: "publishToMarket",
        id: component.id,
        version: component.version,
        sourceId,
        ...(needsName ? { publisherName: name.trim() } : {}),
      })) as { serial: number };
      setState({ kind: "done", serial: result.serial });
    } catch (e) {
      const text = e instanceof KiboError ? (publishErrors[e.code] ?? marketErrorText(e)) : marketErrorText(e);
      setState({ kind: "error", text });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.market.publishTitle(component.title, component.version)}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{shortFingerprint(component.hash)}</DialogDescription>
        </DialogHeader>
        {sources !== null && sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.market.publishNoSource}</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs text-muted-foreground">{fr.market.publishSource}</legend>
              <RadioGroup value={sourceId} onValueChange={setSourceId}>
                {(sources ?? []).map((s) => (
                  <Label key={s.id} className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value={s.id} aria-label={s.name} />
                    {s.name}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            {needsName ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={nameId}>{fr.market.publisherName}</Label>
                <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
                <p className="text-xs text-muted-foreground">{fr.market.publisherNameHelp}</p>
              </div>
            ) : null}
            <ul className="list-disc pl-5 text-xs">
              {permissionLines(component.permissions).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {state.kind === "done" ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{fr.market.published(state.serial)}</p> : null}
        {state.kind === "error" ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.text}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            onClick={publish}
            disabled={state.kind === "busy" || state.kind === "done" || !sourceId || (needsName && !name.trim())}
          >
            {state.kind === "busy" ? fr.market.publishing : fr.market.publish}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Run: `bun test packages/ui/src/dialogs/market-dialogs.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 9: Test et implémentation du composant absent (S7)**

`packages/ui/src/shell/missing-component.test.tsx` :
```tsx
import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const a = answers[req.method];
      return a ? a() : Promise.resolve(null);
    },
  },
}));

const { MissingComponent } = await import("./MissingComponent");

const instance = {
  id: "i1",
  pageId: "pg1",
  component: "burndown@0.3.0",
  layout: { x: 0, y: 0, w: 6, h: 6 },
  config: {},
  componentHash: "c".repeat(64),
};
const members = [
  { userId: "u-lea", name: "Léa", role: "owner" as const },
  { userId: "u-adam", name: "Adam", role: "editor" as const },
];

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("a component offered by a known source can be installed with the same hash", async () => {
  answers.findMarketSource = () => Promise.resolve({ sourceId: "equipe" });
  render(<MissingComponent projectId="p1" instance={instance} members={members} />);
  expect(screen.getByText("Composant absent : burndown@0.3.0")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Installer" })).toBeTruthy();
  expect(calls[0]).toEqual({ method: "findMarketSource", id: "burndown", version: "0.3.0", hash: "c".repeat(64) });
  await userEvent.setup().click(screen.getByRole("button", { name: "Installer" }));
  expect(calls.at(-1)).toEqual({ method: "getMarketPackage", sourceId: "equipe", id: "burndown", version: "0.3.0" });
});

test("otherwise the owner is asked to publish it", async () => {
  answers.findMarketSource = () => Promise.resolve(null);
  render(<MissingComponent projectId="p1" instance={instance} members={members} />);
  expect(await screen.findByText("Demande à Léa de le publier sur la marketplace d'équipe.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Installer" })).toBeNull();
});
```

Run: `bun test packages/ui/src/shell/missing-component.test.tsx`
Expected: FAIL avec « Cannot find module './MissingComponent' ».

`packages/ui/src/shell/MissingComponent.tsx` :
```tsx
import type { Instance, MemberInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { marketErrorText } from "../lib/market-errors";
import { MarketPackageSheet } from "../pages/components/MarketPackageSheet";

type Props = { projectId: string; instance: Instance; members: MemberInfo[] };

export function MissingComponent({ instance, members }: Props) {
  const [id = "", version = ""] = instance.component.split("@");
  const [source, setSource] = useState<{ sourceId: string } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = members.find((m) => m.role === "owner");

  useEffect(() => {
    client
      .rpc({ method: "findMarketSource", id, version, hash: instance.componentHash ?? null })
      .then((s) => setSource(s as { sourceId: string } | null))
      .catch((e: unknown) => setError(marketErrorText(e)));
  }, [id, version, instance.componentHash]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center text-sm">
      <Package className="size-5 text-muted-foreground" aria-hidden />
      <p className="font-medium">{fr.market.missing(instance.component)}</p>
      {source ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          {fr.market.install}
        </Button>
      ) : source === null && owner ? (
        <p className="text-muted-foreground">{fr.market.askOwner(owner.name)}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <MarketPackageSheet
        target={open && source ? { sourceId: source.sourceId, id, version } : null}
        onClose={() => setOpen(false)}
        onInstalled={() => setOpen(false)}
      />
    </div>
  );
}
```
Après l'installation, l'écran 30 s'ouvre par le même chemin que dans la page Composants : `PageView` écoute l'événement `market` du démon et recharge le registre ; l'instance passe d'« absent » à « Autorisation requise » puis s'affiche une fois approuvée.

Dans `PageView.tsx`, remplacer le texte `fr.page.unknownComponent(ref)` par `<MissingComponent projectId={project.meta.id} instance={instance} members={project.sync.members} />` quand la référence n'est ni intégrée ni présente au registre.

Run: `bun test packages/ui/src/shell/missing-component.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 10: Vérifications**

Run: `bun run check && bun run typecheck && bun test packages/ui packages/daemon/src/market && bun run --cwd packages/ui build`
Expected: aucune erreur. Contrôle visuel en sombre et en clair face aux exports M4, M6, M8 et S7.

- [ ] **Step 11: Commit**

```bash
git add packages/schema/src/rpc.ts packages/schema/src/market.ts packages/daemon/src/market/summary.ts packages/daemon/src/market/summary.test.ts packages/daemon/src/market/rpc.ts packages/daemon/src/components/rpc.ts packages/ui/src/pages/components/MarketUpdateFlow.tsx packages/ui/src/pages/components/InstalledTable.tsx packages/ui/src/pages/components/market-update.test.tsx packages/ui/src/dialogs/PublisherChangedDialog.tsx packages/ui/src/dialogs/PublishToMarketDialog.tsx packages/ui/src/dialogs/market-dialogs.test.tsx packages/ui/src/shell/MissingComponent.tsx packages/ui/src/shell/missing-component.test.tsx packages/ui/src/shell/AuthorizationRequired.tsx packages/ui/src/pages/PageView.tsx packages/ui/src/lib/market-update.ts packages/ui/src/lib/market-update.test.ts packages/ui/src/lib/fingerprint.ts packages/ui/src/lib/market-errors.test.ts packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): mises à jour et composant absent"
```

---

### Task 28: UI Paramètres › Sync et indicateur

Vague 6. Écrans à dessiner **S1** (Paramètres › Sync, dialogues « Se connecter à un serveur » et « Ajouter un appareil ») et **S9** (indicateur de la barre d'état), en sombre et en clair. Spec G §4, §8 ; décisions 17, 20.

**Files:**
- Create: `packages/ui/src/state/use-sync-status.ts`
- Create: `packages/ui/src/lib/relative-time.ts`, `packages/ui/src/lib/relative-time.test.ts`
- Create: `packages/ui/src/pages/settings/SyncSettings.tsx`
- Create: `packages/ui/src/dialogs/ConnectServerDialog.tsx`
- Create: `packages/ui/src/dialogs/AddDeviceDialog.tsx`
- Create: `packages/ui/src/shell/SyncIndicator.tsx`
- Create: `packages/ui/src/pages/settings/sync-settings.test.tsx`
- Modify: `packages/ui/src/pages/settings/sections.ts` (section « Sync » après « Intégrations »)
- Modify: `packages/ui/src/shell/StatusBar.tsx` (remplace le libellé fixe « ● Démon local » par `SyncIndicator`)
- Modify: `packages/ui/src/i18n/fr.ts` (section `sync`)

**Interfaces:**
- Consumes: RPC `getSyncStatus`, `connectSyncServer`, `disconnectSyncServer`, `listDevices`, `addDevice`, `revokeDevice` (T21) ; `SyncStatus`, `DeviceInfo`, `KiboError` (T4, T1) ; événement `{ type: "sync" }`.
- Produces : `useSyncStatus(): SyncStatus | null` ; `relativeTime(at: number, now: number): string` ; composants `SyncSettings`, `ConnectServerDialog({ open, onOpenChange, viewer })`, `AddDeviceDialog({ open, onOpenChange })`, `SyncIndicator()`.
- Hypothèse v0.6 (vérifiée en T0) : `client.onEvent(listener: (e: DaemonEvent) => void): () => void` ; `SETTINGS_SECTIONS: { id: string; label: string; Component: ComponentType<{ viewer: string }> }[]` ; la barre d'état est `packages/ui/src/shell/StatusBar.tsx`. Si `lib/relative-time.ts` existe déjà (phase 2), il est réutilisé et seuls les libellés manquants sont ajoutés.

- [ ] **Step 1: Textes**

Ajout à `packages/ui/src/i18n/fr.ts` :
```ts
  sync: {
    section: "Sync",
    title: "Sync",
    subtitle:
      "Partage tes projets avec ton équipe via ton propre serveur. Rien ne part tant que tu n'as pas cliqué « Partager ».",
    empty: "Aucun serveur de sync configuré.",
    connect: "Se connecter à un serveur",
    dialogTitle: "Se connecter à un serveur",
    serverUrl: "Adresse du serveur",
    code: "Code d'invitation",
    codeHelp: "Donné par l'administrateur du serveur, valable 48 h.",
    deviceName: "Nom de cet appareil",
    defaultDevice: (user: string) => `Ordinateur de ${user}`,
    caFile: "Certificat racine (optionnel)",
    caFileHelp: "Seulement pour un serveur auto-hébergé avec sa propre autorité.",
    submit: "Se connecter",
    submitting: "Connexion…",
    errors: {
      TLS_REQUIRED: "Adresse non chiffrée : utilise wss://",
      INVITE_INVALID: "Code invalide ou expiré",
      SYNC_OFFLINE: "Serveur injoignable",
    } as Record<string, string>,
    unreachable: "Serveur injoignable",
    server: "Serveur",
    online: "Connecté",
    retrying: (seconds: number) => `Reconnexion dans ${seconds} s`,
    offline: "Hors ligne",
    disconnect: "Se déconnecter",
    disconnectConfirm: "Tes projets partagés resteront lisibles sur cette machine mais ne seront plus synchronisés.",
    account: "Compte",
    devices: "Appareils",
    device: "Nom",
    added: "Ajouté",
    seen: "Vu",
    thisDevice: "Cet appareil",
    revoke: "Révoquer",
    addDevice: "Ajouter un appareil",
    addDeviceTitle: "Ajouter un appareil",
    addDeviceHelp: "Valable 15 minutes. Saisis-le sur l'autre appareil dans Paramètres › Sync.",
    copy: "Copier",
    copied: "Copié",
    projects: "Projets partagés",
    project: "Projet",
    role: "Rôle",
    lastSync: "Dernière sync",
    state: "État",
    roles: { owner: "Propriétaire", editor: "Éditeur", viewer: "Lecteur" },
    accessRevoked: "Accès retiré",
    upToDate: "À jour",
    never: "Jamais",
    indicator: {
      local: "Démon local",
      synced: "synchronisé",
      syncing: "synchronisation…",
      offline: "hors ligne",
      error: "erreur de sync",
    },
  },
  time: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
  },
```

- [ ] **Step 2: Test de `relativeTime`**

`packages/ui/src/lib/relative-time.test.ts` :
```ts
import { expect, test } from "bun:test";
import { relativeTime } from "./relative-time";

test("formats elapsed time in French", () => {
  const now = 1_000_000_000;
  expect(relativeTime(now - 5_000, now)).toBe("à l'instant");
  expect(relativeTime(now - 3 * 60_000, now)).toBe("il y a 3 min");
  expect(relativeTime(now - 2 * 3_600_000, now)).toBe("il y a 2 h");
  expect(relativeTime(now - 3 * 86_400_000, now)).toBe("il y a 3 j");
});
```

Run: `bun test packages/ui/src/lib/relative-time.test.ts`
Expected: FAIL « Cannot find module './relative-time' ».

`packages/ui/src/lib/relative-time.ts` :
```ts
import { fr } from "../i18n/fr";

export function relativeTime(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return fr.time.now;
  if (s < 3600) return fr.time.minutes(Math.floor(s / 60));
  if (s < 86_400) return fr.time.hours(Math.floor(s / 3600));
  return fr.time.days(Math.floor(s / 86_400));
}
```

Run: `bun test packages/ui/src/lib/relative-time.test.ts`
Expected: PASS.

- [ ] **Step 3: Écrire les tests des écrans**

`packages/ui/src/pages/settings/sync-settings.test.tsx` :
```ts
import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, type RpcRequest, type SyncStatus } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let results: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return (results[req.method] ?? (() => Promise.resolve(null)))();
    },
    onEvent: () => () => {},
  },
}));

const { SyncSettings } = await import("./SyncSettings");
const { SyncIndicator } = await import("../../shell/SyncIndicator");

const NOW = Date.now();
const unconfigured: SyncStatus = {
  state: "unconfigured", serverUrl: null, user: null, deviceId: null, retryAt: null, lastError: null, projects: [],
};
const online: SyncStatus = {
  state: "online",
  serverUrl: "wss://sync.kibo.test",
  user: { id: "u-adam-0001", name: "Adam" },
  deviceId: "d1",
  retryAt: null,
  lastError: null,
  projects: [
    { projectId: "p1", name: "Kibo", role: "owner", lastSyncAt: NOW - 2_000, lastError: null, accessRevoked: false },
    { projectId: "p2", name: "Portfolio", role: "editor", lastSyncAt: NOW - 60_000, lastError: null, accessRevoked: false },
    { projectId: "p3", name: "API Facturation", role: "viewer", lastSyncAt: null, lastError: "Accès retiré", accessRevoked: true },
  ],
};
const devices = [
  { deviceId: "d1", name: "MacBook d'Adam", createdAt: NOW - 86_400_000, lastSeenAt: NOW, revokedAt: null },
  { deviceId: "d2", name: "iMac bureau", createdAt: NOW - 5 * 86_400_000, lastSeenAt: NOW - 2 * 3_600_000, revokedAt: null },
];

beforeEach(() => {
  calls.length = 0;
  results = { getSyncStatus: () => Promise.resolve(online), listDevices: () => Promise.resolve(devices) };
});

test("unconfigured shows the empty state and the connect button", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  render(<SyncSettings viewer="adam" />);
  expect(await screen.findByText("Aucun serveur de sync configuré.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Se connecter à un serveur" })).toBeTruthy();
});

test("the connect dialog sends the form and maps server errors", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  results.connectSyncServer = () => Promise.reject(new KiboError("INVITE_INVALID", "bad code"));
  render(<SyncSettings viewer="Adam" />);
  await userEvent.click(await screen.findByRole("button", { name: "Se connecter à un serveur" }));
  const dialog = screen.getByRole("dialog");
  expect((within(dialog).getByLabelText("Nom de cet appareil") as HTMLInputElement).value).toBe("Ordinateur de Adam");
  await userEvent.type(within(dialog).getByLabelText("Adresse du serveur"), "wss://sync.kibo.test");
  await userEvent.type(within(dialog).getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(within(dialog).getByRole("button", { name: "Se connecter" }));
  expect(await within(dialog).findByText("Code invalide ou expiré")).toBeTruthy();
  expect(calls.find((c) => c.method === "connectSyncServer")).toEqual({
    method: "connectSyncServer", serverUrl: "wss://sync.kibo.test", code: "ABCD", deviceName: "Ordinateur de Adam", caFile: null,
  });
});

test("an unencrypted address is explained", async () => {
  results.getSyncStatus = () => Promise.resolve(unconfigured);
  results.connectSyncServer = () => Promise.reject(new KiboError("TLS_REQUIRED", "ws"));
  render(<SyncSettings viewer="Adam" />);
  await userEvent.click(await screen.findByRole("button", { name: "Se connecter à un serveur" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.type(within(dialog).getByLabelText("Adresse du serveur"), "ws://10.0.0.2");
  await userEvent.type(within(dialog).getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(within(dialog).getByRole("button", { name: "Se connecter" }));
  expect(await within(dialog).findByText("Adresse non chiffrée : utilise wss://")).toBeTruthy();
});

test("connected shows server, account, devices and shared projects", async () => {
  render(<SyncSettings viewer="Adam" />);
  expect(await screen.findByText("wss://sync.kibo.test")).toBeTruthy();
  expect(screen.getByText("Connecté")).toBeTruthy();
  const table = await screen.findByRole("table", { name: "Appareils" });
  expect(within(table).getByText("Cet appareil")).toBeTruthy();
  expect(within(table).getByText("il y a 2 h")).toBeTruthy();
  const projects = screen.getByRole("table", { name: "Projets partagés" });
  expect(within(projects).getByText("Propriétaire")).toBeTruthy();
  expect(within(projects).getByText("Accès retiré")).toBeTruthy();
});

test("revoking another device calls the daemon", async () => {
  render(<SyncSettings viewer="Adam" />);
  const table = await screen.findByRole("table", { name: "Appareils" });
  const row = within(table).getByText("iMac bureau").closest("tr");
  if (!row) throw new Error("no row");
  await userEvent.click(within(row).getByRole("button", { name: "Révoquer" }));
  await waitFor(() => expect(calls.some((c) => c.method === "revokeDevice" && c.deviceId === "d2")).toBe(true));
});

test("adding a device shows the code once, grouped by four", async () => {
  results.addDevice = () => Promise.resolve({ code: "ABCDEFGHJKMNPQRS", expiresAt: NOW + 900_000 });
  render(<SyncSettings viewer="Adam" />);
  await userEvent.click(await screen.findByRole("button", { name: "Ajouter un appareil" }));
  expect(await screen.findByText("ABCD EFGH JKMN PQRS")).toBeTruthy();
  expect(screen.getByText("Valable 15 minutes. Saisis-le sur l'autre appareil dans Paramètres › Sync.")).toBeTruthy();
});

test("the status bar indicator follows the connection", async () => {
  const cases: [SyncStatus, string][] = [
    [unconfigured, "Démon local"],
    [online, "Démon local · synchronisé"],
    [{ ...online, state: "connecting" }, "Démon local · synchronisation…"],
    [{ ...online, state: "offline", retryAt: NOW + 12_000 }, "Démon local · hors ligne"],
    [{ ...online, state: "offline", lastError: "Appareil révoqué" }, "Démon local · erreur de sync"],
  ];
  for (const [status, label] of cases) {
    results.getSyncStatus = () => Promise.resolve(status);
    const { unmount } = render(<SyncIndicator />);
    expect(await screen.findByText(label)).toBeTruthy();
    unmount();
  }
});

test("a reconnection countdown is shown in settings", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "offline", retryAt: Date.now() + 12_400 });
  render(<SyncSettings viewer="Adam" />);
  expect(await screen.findByText(/Reconnexion dans 1[23] s/)).toBeTruthy();
});
```

- [ ] **Step 4: Vérifier l'échec**

Run: `bun test packages/ui/src/pages/settings/sync-settings.test.tsx`
Expected: FAIL « Cannot find module './SyncSettings' ».

- [ ] **Step 5: Implémenter le hook et l'indicateur**

`packages/ui/src/state/use-sync-status.ts` :
```ts
import { KiboError, type SyncStatus } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function useSyncStatus(): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "getSyncStatus" }).then(
        (s) => alive && setStatus(s),
        (e: unknown) => {
          if (!(e instanceof KiboError && e.code === "UNAUTHORIZED")) throw e;
        },
      );
    void load();
    const off = client.onEvent((e) => {
      if (e.type === "sync") void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return status;
}
```

`packages/ui/src/shell/SyncIndicator.tsx` :
```tsx
import { cn } from "@kibo/sdk/lib/utils";
import { fr } from "../i18n/fr";
import { navigate } from "../route";
import { useSyncStatus } from "../state/use-sync-status";

const DOT = {
  local: "bg-emerald-500",
  synced: "bg-emerald-500",
  syncing: "bg-amber-500 animate-pulse",
  offline: "bg-zinc-400 dark:bg-zinc-500",
  error: "bg-red-600 dark:bg-red-500",
} as const;

export function SyncIndicator() {
  const status = useSyncStatus();
  const kind =
    !status || status.state === "unconfigured"
      ? "local"
      : status.lastError !== null && status.state !== "online"
        ? "error"
        : status.state === "online"
          ? "synced"
          : status.state === "connecting"
            ? "syncing"
            : "offline";
  const label = kind === "local" ? fr.sync.indicator.local : `${fr.sync.indicator.local} · ${fr.sync.indicator[kind]}`;
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => navigate.settings("sync")}
      disabled={kind === "local"}
    >
      <span aria-hidden className={cn("size-2 rounded-full", DOT[kind])} />
      <span>{label}</span>
    </button>
  );
}
```
Hypothèse v0.6 (vérifiée en T0) : `navigate.settings(sectionId)` ouvre Paramètres sur une section.

- [ ] **Step 6: Implémenter les dialogues**

`packages/ui/src/dialogs/ConnectServerDialog.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; viewer: string };

export function ConnectServerDialog({ open, onOpenChange, viewer }: Props) {
  const ids = { url: useId(), code: useId(), device: useId(), ca: useId() };
  const [serverUrl, setServerUrl] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState(fr.sync.defaultDevice(viewer));
  const [caFile, setCaFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await client.rpc({
        method: "connectSyncServer",
        serverUrl: serverUrl.trim(),
        code: code.trim(),
        deviceName: deviceName.trim(),
        caFile: caFile.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      setError(fr.sync.errors[err.code] ?? fr.sync.unreachable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.sync.dialogTitle}</DialogTitle>
            <DialogDescription>{fr.sync.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={ids.url}>{fr.sync.serverUrl}</Label>
            <Input id={ids.url} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://sync.kibo.test" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.code}>{fr.sync.code}</Label>
            <Input id={ids.code} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono"
              aria-describedby={`${ids.code}-help`} required />
            <p id={`${ids.code}-help`} className="text-xs text-muted-foreground">{fr.sync.codeHelp}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.device}>{fr.sync.deviceName}</Label>
            <Input id={ids.device} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.ca}>{fr.sync.caFile}</Label>
            <Input id={ids.ca} value={caFile} onChange={(e) => setCaFile(e.target.value)} className="font-mono"
              aria-describedby={`${ids.ca}-help`} />
            <p id={`${ids.ca}-help`} className="text-xs text-muted-foreground">{fr.sync.caFileHelp}</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{fr.common.cancel}</Button>
            <Button type="submit" disabled={busy}>{busy ? fr.sync.submitting : fr.sync.submit}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`packages/ui/src/dialogs/AddDeviceDialog.tsx` :
```tsx
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { useEffect, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";

export const groupByFour = (code: string): string => code.match(/.{1,4}/g)?.join(" ") ?? code;

export function AddDeviceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) {
      setCode(null);
      setCopied(false);
      return;
    }
    let alive = true;
    void client.rpc({ method: "addDevice" }).then((r) => alive && setCode(r.code));
    return () => {
      alive = false;
    };
  }, [open]);
  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fr.sync.addDeviceTitle}</DialogTitle>
          <DialogDescription>{fr.sync.addDeviceHelp}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
          <span className="font-mono text-lg tracking-wider">{code ? groupByFour(code) : "…"}</span>
          <Button variant="outline" size="sm" onClick={() => void copy()} disabled={!code}>
            {copied ? fr.sync.copied : fr.sync.copy}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```
Un échec de `addDevice` remonte à la frontière d'erreur de l'UI (pas de `catch` muet).

- [ ] **Step 7: Implémenter `SyncSettings`**

`packages/ui/src/pages/settings/SyncSettings.tsx` :
```tsx
import type { DeviceInfo, SyncStatus } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kibo/sdk/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { AddDeviceDialog } from "../../dialogs/AddDeviceDialog";
import { ConnectServerDialog } from "../../dialogs/ConnectServerDialog";
import { fr } from "../../i18n/fr";
import { relativeTime } from "../../lib/relative-time";
import { useSyncStatus } from "../../state/use-sync-status";

function StateDot({ status }: { status: SyncStatus }) {
  const retryIn = status.retryAt ? Math.max(0, Math.round((status.retryAt - Date.now()) / 1000)) : null;
  const [color, label] =
    status.state === "online"
      ? ["bg-emerald-500", fr.sync.online]
      : retryIn !== null
        ? ["bg-amber-500", fr.sync.retrying(retryIn)]
        : ["bg-zinc-400", fr.sync.offline];
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span aria-hidden className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Devices({ status }: { status: SyncStatus }) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const online = status.state === "online";
  useEffect(() => {
    if (!online) return;
    let alive = true;
    void client.rpc({ method: "listDevices" }).then((d) => alive && setDevices(d));
    return () => {
      alive = false;
    };
  }, [online]);
  const revoke = async (deviceId: string) => {
    await client.rpc({ method: "revokeDevice", deviceId });
    setDevices(await client.rpc({ method: "listDevices" }));
  };
  const now = Date.now();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{fr.sync.devices}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={!online}>
          {fr.sync.addDevice}
        </Button>
      </CardHeader>
      <CardContent>
        <table aria-label={fr.sync.devices} className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th>{fr.sync.device}</th><th>{fr.sync.added}</th><th>{fr.sync.seen}</th><th /></tr>
          </thead>
          <tbody>
            {devices.filter((d) => d.revokedAt === null).map((d) => (
              <tr key={d.deviceId} className="border-t">
                <td className="py-2">
                  {d.name}{" "}
                  {d.deviceId === status.deviceId && <Badge variant="secondary">{fr.sync.thisDevice}</Badge>}
                </td>
                <td>{relativeTime(d.createdAt, now)}</td>
                <td>{d.lastSeenAt ? relativeTime(d.lastSeenAt, now) : fr.sync.never}</td>
                <td className="text-right">
                  {d.deviceId !== status.deviceId && (
                    <Button variant="ghost" size="sm" onClick={() => void revoke(d.deviceId)}>{fr.sync.revoke}</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
      <AddDeviceDialog open={adding} onOpenChange={setAdding} />
    </Card>
  );
}

function Projects({ status }: { status: SyncStatus }) {
  const now = Date.now();
  return (
    <Card>
      <CardHeader><CardTitle>{fr.sync.projects}</CardTitle></CardHeader>
      <CardContent>
        <table aria-label={fr.sync.projects} className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th>{fr.sync.project}</th><th>{fr.sync.role}</th><th>{fr.sync.lastSync}</th><th>{fr.sync.state}</th></tr>
          </thead>
          <tbody>
            {status.projects.map((p) => (
              <tr key={p.projectId} className="border-t">
                <td className="py-2">{p.name}</td>
                <td>{fr.sync.roles[p.role]}</td>
                <td>{p.lastSyncAt ? relativeTime(p.lastSyncAt, now) : fr.sync.never}</td>
                <td className={p.accessRevoked || p.lastError ? "text-red-600 dark:text-red-400" : undefined}>
                  {p.accessRevoked ? fr.sync.accessRevoked : (p.lastError ?? fr.sync.upToDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function SyncSettings({ viewer }: { viewer: string }) {
  const status = useSyncStatus();
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const disconnect = async () => {
    await client.rpc({ method: "disconnectSyncServer" });
    setConfirming(false);
  };
  if (!status) return null;
  return (
    <section className="grid max-w-3xl gap-4">
      <header>
        <h1 className="text-lg font-semibold">{fr.sync.title}</h1>
        <p className="text-sm text-muted-foreground">{fr.sync.subtitle}</p>
      </header>
      {status.state === "unconfigured" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CloudOff className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm">{fr.sync.empty}</p>
            <Button onClick={() => setConnecting(true)}>{fr.sync.connect}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{fr.sync.server}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                {fr.sync.disconnect}
              </Button>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="font-mono text-sm">{status.serverUrl}</span>
              <StateDot status={status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{fr.sync.account}</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {status.user?.name} <span className="font-mono text-muted-foreground">{status.user?.id.slice(0, 8)}</span>
            </CardContent>
          </Card>
          <Devices status={status} />
          <Projects status={status} />
        </>
      )}
      <ConnectServerDialog open={connecting} onOpenChange={setConnecting} viewer={viewer} />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fr.sync.disconnect}</DialogTitle>
            <DialogDescription>{fr.sync.disconnectConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>{fr.common.cancel}</Button>
            <Button variant="destructive" onClick={() => void disconnect()}>{fr.sync.disconnect}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```
La confirmation de déconnexion est un `Dialog` shadcn avec bouton destructif (même motif que les confirmations existantes).

- [ ] **Step 8: Section et barre d'état**

Dans `sections.ts`, insérer `{ id: "sync", label: fr.sync.section, Component: SyncSettings }` après la section `integrations`. Dans `StatusBar.tsx`, remplacer l'élément « ● Démon local » par `<SyncIndicator />`.

- [ ] **Step 9: Vérifier**

Run: `bun test packages/ui/src/pages/settings/sync-settings.test.tsx packages/ui/src/lib/relative-time.test.ts`
Expected: PASS (9 tests).

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build`
Expected: PASS.

Contrôle visuel : Paramètres › Sync (non configuré, dialogue, connecté) et la barre d'état face aux exports S1 et S9, en sombre et en clair.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/state/use-sync-status.ts packages/ui/src/lib/relative-time.ts packages/ui/src/lib/relative-time.test.ts \
  packages/ui/src/pages/settings/SyncSettings.tsx packages/ui/src/pages/settings/sync-settings.test.tsx \
  packages/ui/src/pages/settings/sections.ts packages/ui/src/dialogs/ConnectServerDialog.tsx \
  packages/ui/src/dialogs/AddDeviceDialog.tsx packages/ui/src/shell/SyncIndicator.tsx packages/ui/src/shell/StatusBar.tsx \
  packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): paramètres de sync"
```

---

### Task 29: UI Partage, rejoindre, lecture seule

Vague 7. Écrans à dessiner **S2** (Partager le projet), **S3** (Rejoindre un projet), **S6** (lecture seule, « Accès retiré »), en sombre et en clair. Spec G §3.4, §6 (rôles, retrait), §6.2, §8 (opt-in) ; décisions 9, 22. Le glisser-déposer du Kanban en lecture seule est traité par T30 (accès exposé par le SDK).

**Files:**
- Create: `packages/ui/src/dialogs/ShareProjectDialog.tsx`
- Create: `packages/ui/src/dialogs/JoinProjectDialog.tsx`
- Create: `packages/ui/src/shell/ProjectAccessBanner.tsx`
- Create: `packages/ui/src/dialogs/share.test.tsx`
- Modify: `packages/ui/src/shell/AppSidebar.tsx` (menu `⋯` d'un projet avec « Partager », bouton « Rejoindre un projet », « Ajouter une page » masqué en lecture seule)
- Modify: `packages/ui/src/shell/Shell.tsx` (dialogues, bandeau, bouton « Partager » de l'en-tête, `openNewTicket` inactif en lecture seule)
- Modify: `packages/ui/src/pages/PageView.tsx` (« Ajouter un composant » masqué en lecture seule)
- Modify: `packages/ui/src/pages/components/InstanceMenu.tsx` (entrée « Exécuter la sync sur cette machine »)
- Modify: `packages/ui/src/i18n/fr.ts` (section `share`)

**Interfaces:**
- Consumes: RPC `shareProject`, `createProjectInvite`, `joinProject`, `setMemberRole`, `unshareProject`, `setBindingRunner` (T23) ; `useSyncStatus` (T28) ; `ProjectSnapshot.sync: ProjectSyncInfo`, `MemberInfo`, `Role`, `KiboError` (T4, T6).
- Produces : `ShareProjectDialog({ project, open, onOpenChange })`, `JoinProjectDialog({ open, onOpenChange })`, `ProjectAccessBanner({ access })`, `canEdit(project: ProjectSnapshot): boolean` (dans `packages/ui/src/state/access.ts`).
- Hypothèse v0.6 (vérifiée en T0) : `ProjectSnapshot.bindings: { id: string; createdBy: string; runner: string }[]` (phase 5) ; le menu `⋯` d'une instance est `packages/ui/src/pages/components/InstanceMenu.tsx` avec les props `{ project, instance }` (phase 4) ; `navigate.settings(sectionId)` (T28).

- [ ] **Step 1: Textes**

Ajout à `packages/ui/src/i18n/fr.ts` :
```ts
  share: {
    action: "Partager",
    title: (name: string) => `Partager « ${name} »`,
    sent: "Envoyé au serveur",
    sentItems: ["Tickets et sous-tickets", "Pages et leur mise en page", "Liens entre tickets", "Workflow",
      "Domaines du projet", "Configuration des composants"],
    kept: "Reste sur ta machine",
    keptItems: ["Dossier local", "Notes .md", "Runs et journaux des agents", "Secrets et serveurs MCP",
      "Code des composants", "Confiance accordée aux composants"],
    plaintext: "Le serveur voit les données en clair.",
    noServer: "Configure un serveur dans Paramètres › Sync",
    submit: "Partager",
    sharing: "Partage en cours…",
    offline: "Serveur injoignable, réessaie quand tu es en ligne",
    members: "Membres",
    remove: "Retirer",
    invite: "Inviter",
    inviteRole: "Rôle de l'invité",
    generate: "Générer un code",
    codeHelp: "Valable 48 h, usage unique",
    copy: "Copier",
    stop: "Arrêter le partage",
    stopConfirm: "Le projet sera supprimé du serveur. Les autres membres garderont une copie en lecture seule.",
    join: "Rejoindre un projet",
    joinTitle: "Rejoindre un projet",
    joinHelp: "Colle le code d'invitation reçu d'un propriétaire du projet.",
    code: "Code d'invitation",
    folder: "Dossier local",
    folderHelp: "Facultatif. Le dossier reste sur ta machine.",
    joinSubmit: "Rejoindre",
    invalidCode: "Code invalide ou expiré",
    duplicateKey: (key: string) => `Un projet local utilise déjà la clé ${key}`,
    readOnly: "Lecture seule — tu es lecteur de ce projet.",
    revoked: "Accès retiré — ta copie locale reste lisible mais n'est plus synchronisée.",
    runHere: "Exécuter la sync sur cette machine",
  },
```
Les rôles réutilisent `fr.sync.roles` (T28).

- [ ] **Step 2: Écrire les tests**

`packages/ui/src/dialogs/share.test.tsx` :
```ts
import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  KiboError,
  type ProjectSnapshot,
  type ProjectSyncInfo,
  type RpcRequest,
  type SyncStatus,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let results: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return (results[req.method] ?? (() => Promise.resolve(null)))();
    },
    onEvent: () => () => {},
  },
}));

const { ShareProjectDialog } = await import("./ShareProjectDialog");
const { JoinProjectDialog } = await import("./JoinProjectDialog");
const { ProjectAccessBanner } = await import("../shell/ProjectAccessBanner");

const local: ProjectSyncInfo = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
const owned: ProjectSyncInfo = {
  shared: true, keyAllocator: "server", role: "owner", access: "write",
  members: [
    { userId: "u-adam", name: "Adam", role: "owner" },
    { userId: "u-lea", name: "Léa", role: "editor" },
  ],
};
const project = (sync: ProjectSyncInfo): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW, pages: [], tickets: [], links: [], instances: [], nextTicketKey: null, sync,
});
const online = { state: "online", serverUrl: "wss://sync.kibo.test", user: { id: "u-adam", name: "Adam" },
  deviceId: "d1", retryAt: null, lastError: null, projects: [] } as SyncStatus;

beforeEach(() => {
  calls.length = 0;
  results = { getSyncStatus: () => Promise.resolve(online) };
});

test("before sharing, the dialog lists what leaves and what stays", async () => {
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Partager « Kibo »")).toBeTruthy();
  const sent = within(dialog).getByRole("list", { name: "Envoyé au serveur" });
  expect(within(sent).getByText("Tickets et sous-tickets")).toBeTruthy();
  const kept = within(dialog).getByRole("list", { name: "Reste sur ta machine" });
  expect(within(kept).getByText("Dossier local")).toBeTruthy();
  expect(within(kept).getByText("Secrets et serveurs MCP")).toBeTruthy();
  expect(within(dialog).getByText("Le serveur voit les données en clair.")).toBeTruthy();
});

test("without a server the share button is disabled", async () => {
  results.getSyncStatus = () => Promise.resolve({ ...online, state: "unconfigured", serverUrl: null } as SyncStatus);
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  expect(await screen.findByText("Configure un serveur dans Paramètres › Sync")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Partager" }) as HTMLButtonElement).disabled).toBe(true);
});

test("sharing offline explains the failure", async () => {
  results.shareProject = () => Promise.reject(new KiboError("SYNC_OFFLINE", "down"));
  render(<ShareProjectDialog project={project(local)} open onOpenChange={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Partager" }));
  expect(await screen.findByText("Serveur injoignable, réessaie quand tu es en ligne")).toBeTruthy();
  expect(calls.some((c) => c.method === "shareProject" && c.projectId === "p1")).toBe(true);
});

test("an owner sees members, changes roles, removes and invites", async () => {
  results.setMemberRole = () => Promise.resolve([owned.members[0], { ...owned.members[1], role: "viewer" }]);
  results.createProjectInvite = () => Promise.resolve({ code: "ABCDEFGHJKMNPQRSTUVWXYZ234", expiresAt: Date.now() });
  render(<ShareProjectDialog project={project(owned)} open onOpenChange={() => {}} />);
  const members = screen.getByRole("list", { name: "Membres" });
  expect(within(members).getByText("Léa")).toBeTruthy();
  const lea = within(members).getByText("Léa").closest("li");
  if (!lea) throw new Error("no member row");
  await userEvent.click(within(lea).getByRole("combobox", { name: "Rôle de Léa" }));
  await userEvent.click(await screen.findByRole("option", { name: "Lecteur" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "setMemberRole")).toEqual({
      method: "setMemberRole", projectId: "p1", userId: "u-lea", role: "viewer",
    }),
  );
  await userEvent.click(within(lea).getByRole("button", { name: "Retirer" }));
  await waitFor(() => expect(calls.some((c) => c.method === "setMemberRole" && c.role === null)).toBe(true));
  await userEvent.click(screen.getByRole("button", { name: "Générer un code" }));
  expect(await screen.findByText("ABCDEFGHJKMNPQRSTUVWXYZ234")).toBeTruthy();
  expect(screen.getByText("Valable 48 h, usage unique")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Arrêter le partage" })).toBeTruthy();
});

test("an editor sees roles as text and no owner actions", () => {
  render(<ShareProjectDialog project={project({ ...owned, role: "editor" })} open onOpenChange={() => {}} />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Générer un code" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Arrêter le partage" })).toBeNull();
});

test("joining maps invalid codes and duplicate keys", async () => {
  results.joinProject = () => Promise.reject(new KiboError("INVITE_INVALID", "bad"));
  render(<JoinProjectDialog open onOpenChange={() => {}} />);
  await userEvent.type(screen.getByLabelText("Code d'invitation"), "ABCD");
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  expect(await screen.findByText("Code invalide ou expiré")).toBeTruthy();
  results.joinProject = () => Promise.reject(new KiboError("INVALID_INPUT", "duplicate project key KIB"));
  await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
  expect(await screen.findByText("Un projet local utilise déjà la clé KIB")).toBeTruthy();
  expect(calls.at(-1)).toEqual({ method: "joinProject", code: "ABCD", folder: null });
});

test("the banner explains read-only and revoked access", () => {
  const { rerender, container } = render(<ProjectAccessBanner access="write" />);
  expect(container.childElementCount).toBe(0);
  rerender(<ProjectAccessBanner access="read-only" />);
  expect(screen.getByRole("status").textContent).toBe("Lecture seule — tu es lecteur de ce projet.");
  rerender(<ProjectAccessBanner access="revoked" />);
  expect(screen.getByRole("status").textContent).toBe(
    "Accès retiré — ta copie locale reste lisible mais n'est plus synchronisée.",
  );
});
```
Ajout à `packages/ui/src/shell/shell.test.tsx` (tests existants inchangés) :
```ts
test("a read-only project hides page creation and shows the banner", async () => {
  renderShellWith({ ...snapshot, sync: { shared: true, keyAllocator: "server", role: "viewer", access: "read-only", members: [] } });
  expect(await screen.findByRole("status")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nouvelle page" })).toBeNull();
});

test("Rejoindre un projet appears only once a server is configured", async () => {
  syncStatus = { ...syncStatus, state: "unconfigured" };
  const { unmount } = renderShellWith(snapshot);
  expect(screen.queryByRole("button", { name: "Rejoindre un projet" })).toBeNull();
  unmount();
  syncStatus = { ...syncStatus, state: "online" };
  renderShellWith(snapshot);
  expect(await screen.findByRole("button", { name: "Rejoindre un projet" })).toBeTruthy();
});
```
`renderShellWith` et `syncStatus` s'ajoutent aux utilitaires de `shell.test.tsx` : le module `../api` simulé renvoie `snapshot` pour `getProject`, `[snapshot.meta]` pour `listProjects` et `syncStatus` pour `getSyncStatus`.

- [ ] **Step 3: Vérifier l'échec**

Run: `bun test packages/ui/src/dialogs/share.test.tsx packages/ui/src/shell/shell.test.tsx`
Expected: FAIL « Cannot find module './ShareProjectDialog' ».

- [ ] **Step 4: Implémenter le bandeau et l'accès**

`packages/ui/src/state/access.ts` :
```ts
import type { ProjectSnapshot } from "@kibo/schema";

export const canEdit = (project: ProjectSnapshot): boolean => project.sync.access === "write";
```

`packages/ui/src/shell/ProjectAccessBanner.tsx` :
```tsx
import type { ProjectAccess } from "@kibo/schema";
import { Eye, Unplug } from "lucide-react";
import { fr } from "../i18n/fr";

export function ProjectAccessBanner({ access }: { access: ProjectAccess }) {
  if (access === "write") return null;
  const revoked = access === "revoked";
  const Icon = revoked ? Unplug : Eye;
  return (
    <div
      role="status"
      className={
        revoked
          ? "flex items-center gap-2 border-b bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "flex items-center gap-2 border-b bg-muted px-3 py-1.5 text-sm text-muted-foreground"
      }
    >
      <Icon className="size-4" aria-hidden />
      {revoked ? fr.share.revoked : fr.share.readOnly}
    </div>
  );
}
```

- [ ] **Step 5: Implémenter `ShareProjectDialog`**

`packages/ui/src/dialogs/ShareProjectDialog.tsx` :
```tsx
import { KiboError, type MemberInfo, type ProjectSnapshot, type Role } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kibo/sdk/ui/select";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { navigate } from "../route";
import { useSyncStatus } from "../state/use-sync-status";

type Props = { project: ProjectSnapshot; open: boolean; onOpenChange: (open: boolean) => void };
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);

function WhatLeaves() {
  const sentId = useId();
  const keptId = useId();
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <h3 id={sentId} className="mb-1 font-medium">{fr.share.sent}</h3>
        <ul aria-labelledby={sentId} className="list-disc pl-4 text-muted-foreground">
          {fr.share.sentItems.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </div>
      <div>
        <h3 id={keptId} className="mb-1 font-medium">{fr.share.kept}</h3>
        <ul aria-labelledby={keptId} className="list-disc pl-4 text-muted-foreground">
          {fr.share.keptItems.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Members({ project, members, setMembers }: {
  project: ProjectSnapshot; members: MemberInfo[]; setMembers: (m: MemberInfo[]) => void;
}) {
  const listId = useId();
  const owner = project.sync.role === "owner";
  const change = async (userId: string, role: Role | null) => {
    setMembers(await client.rpc({ method: "setMemberRole", projectId: project.meta.id, userId, role }));
  };
  return (
    <section className="grid gap-2">
      <h3 id={listId} className="text-sm font-medium">{fr.share.members}</h3>
      <ul aria-labelledby={listId} className="grid gap-2">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="grid size-6 place-items-center rounded-full bg-muted text-xs">{initials(m.name)}</span>
            <span className="flex-1">{m.name}</span>
            {owner && m.role !== "owner" ? (
              <>
                <Select value={m.role} onValueChange={(r) => void change(m.userId, r as Role)}>
                  <SelectTrigger className="h-8 w-32" aria-label={`${fr.sync.role} de ${m.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["owner", "editor", "viewer"] as const).map((r) => (
                      <SelectItem key={r} value={r}>{fr.sync.roles[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => void change(m.userId, null)}>{fr.share.remove}</Button>
              </>
            ) : (
              <span className="text-muted-foreground">{fr.sync.roles[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Invite({ projectId }: { projectId: string }) {
  const roleId = useId();
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [code, setCode] = useState<string | null>(null);
  const generate = async () => {
    setCode((await client.rpc({ method: "createProjectInvite", projectId, role })).code);
  };
  return (
    <section className="grid gap-2 border-t pt-3">
      <h3 className="text-sm font-medium">{fr.share.invite}</h3>
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(r) => setRole(r as "editor" | "viewer")}>
          <SelectTrigger id={roleId} className="h-8 w-36" aria-label={fr.share.inviteRole}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">{fr.sync.roles.editor}</SelectItem>
            <SelectItem value="viewer">{fr.sync.roles.viewer}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void generate()}>{fr.share.generate}</Button>
      </div>
      {code && (
        <div className="grid gap-1 rounded-md border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm">{code}</span>
            <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(code)}>{fr.share.copy}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{fr.share.codeHelp}</p>
        </div>
      )}
    </section>
  );
}

export function ShareProjectDialog({ project, open, onOpenChange }: Props) {
  const status = useSyncStatus();
  const [members, setMembers] = useState<MemberInfo[]>(project.sync.members);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => setMembers(project.sync.members), [project.sync.members]);
  const configured = status !== null && status.state !== "unconfigured";

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.rpc({ method: "shareProject", projectId: project.meta.id });
    } catch (e) {
      if (!(e instanceof KiboError)) throw e;
      setError(e.code === "SYNC_OFFLINE" ? fr.share.offline : fr.common.error);
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    await client.rpc({ method: "unshareProject", projectId: project.meta.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{fr.share.title(project.meta.name)}</DialogTitle>
          <DialogDescription>{fr.share.plaintext}</DialogDescription>
        </DialogHeader>
        {!project.sync.shared ? (
          <>
            <WhatLeaves />
            {!configured && (
              <button type="button" className="text-left text-sm underline" onClick={() => navigate.settings("sync")}>
                {fr.share.noServer}
              </button>
            )}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <DialogFooter>
              <Button onClick={() => void share()} disabled={!configured || busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {busy ? fr.share.sharing : fr.share.submit}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Members project={project} members={members} setMembers={setMembers} />
            {project.sync.role === "owner" && <Invite projectId={project.meta.id} />}
            {project.sync.role === "owner" && (
              <DialogFooter className="border-t pt-3">
                {confirmStop ? (
                  <div className="grid gap-2">
                    <p className="text-sm text-muted-foreground">{fr.share.stopConfirm}</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setConfirmStop(false)}>{fr.common.cancel}</Button>
                      <Button variant="destructive" onClick={() => void stop()}>{fr.share.stop}</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={() => setConfirmStop(true)}>{fr.share.stop}</Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Implémenter `JoinProjectDialog`**

`packages/ui/src/dialogs/JoinProjectDialog.tsx` :
```tsx
import { KiboError } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@kibo/sdk/ui/dialog";
import { Input } from "@kibo/sdk/ui/input";
import { Label } from "@kibo/sdk/ui/label";
import { type FormEvent, useId, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { navigate } from "../route";

const DUPLICATE = /^duplicate project key ([A-Z]{2,6})$/;

export function JoinProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const codeId = useId();
  const folderId = useId();
  const [code, setCode] = useState("");
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const meta = await client.rpc({ method: "joinProject", code: code.trim(), folder: folder.trim() || null });
      onOpenChange(false);
      navigate(meta.id, null);
    } catch (err) {
      if (!(err instanceof KiboError)) throw err;
      const dup = DUPLICATE.exec(err.detail);
      setError(
        err.code === "INVITE_INVALID"
          ? fr.share.invalidCode
          : dup?.[1]
            ? fr.share.duplicateKey(dup[1])
            : err.code === "SYNC_OFFLINE"
              ? fr.share.offline
              : fr.common.error,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{fr.share.joinTitle}</DialogTitle>
            <DialogDescription>{fr.share.joinHelp}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={codeId}>{fr.share.code}</Label>
            <Input id={codeId} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={folderId}>{fr.share.folder}</Label>
            <Input id={folderId} value={folder} onChange={(e) => setFolder(e.target.value)} aria-describedby={`${folderId}-help`} />
            <p id={`${folderId}-help`} className="text-xs text-muted-foreground">{fr.share.folderHelp}</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{fr.common.cancel}</Button>
            <Button type="submit" disabled={busy}>{fr.share.joinSubmit}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```
`KiboError.detail` porte le message brut du démon (`client.rpc` construit `new KiboError(code, message)`).

- [ ] **Step 7: Brancher le shell**

- `Shell.tsx` : états `share: boolean`, `join: boolean` ; sous l'en-tête, `{project && <ProjectAccessBanner access={project.sync.access} />}` ; à droite de l'en-tête, `{project && <Button variant="outline" size="sm" onClick={() => setShare(true)}>{fr.share.action}</Button>}` ; `host.openNewTicket` n'ouvre le dialogue que si `project && canEdit(project)` ; rendu de `ShareProjectDialog` et `JoinProjectDialog`.
- `AppSidebar.tsx` : nouvelles props `canEdit: boolean`, `syncConfigured: boolean`, `onShare(projectId)`, `onJoin()` ; `SidebarMenuAction` `⋯` sur chaque projet ouvrant un `DropdownMenu` avec l'entrée « Partager » ; bouton « Rejoindre un projet » sous « Nouveau projet » si `syncConfigured` ; `SidebarGroupAction` « Nouvelle page » et « Ajouter une page » rendus seulement si `canEdit`.
- `PageView.tsx` : bouton « Ajouter un composant » et mode édition seulement si `canEdit(project)`.
- `InstanceMenu.tsx` : si `instance.config.source` contient `bindingId` et que la liaison correspondante a un `runner` différent de l'utilisateur de la session, entrée `fr.share.runHere` qui appelle `client.rpc({ method: "setBindingRunner", projectId, bindingId })`.

- [ ] **Step 8: Vérifier**

Run: `bun test packages/ui/src/dialogs/share.test.tsx packages/ui/src/shell/shell.test.tsx`
Expected: PASS.

Run: `bun test packages/ui && bun run check && bun run typecheck && bun run --cwd packages/ui build`
Expected: PASS.

Contrôle visuel face aux exports S2, S3, S6, en sombre et en clair.

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/dialogs/ShareProjectDialog.tsx packages/ui/src/dialogs/JoinProjectDialog.tsx \
  packages/ui/src/dialogs/share.test.tsx packages/ui/src/shell/ProjectAccessBanner.tsx packages/ui/src/state/access.ts \
  packages/ui/src/shell/AppSidebar.tsx packages/ui/src/shell/Shell.tsx packages/ui/src/shell/shell.test.tsx \
  packages/ui/src/pages/PageView.tsx packages/ui/src/pages/components/InstanceMenu.tsx packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): partage de projet"
```

---

### Task 30: UI présence et clé provisoire

Vague 7. Écrans à dessiner **S4** (présence) et **S5** (ticket à clé provisoire), en sombre et en clair. Spec G §5 (point 6), §6.1, §3.3 (assignés par `userId`) ; décision 19. Deux commits : le SDK d'abord (les composants intégrés en dépendent), puis l'UI.

**Files:**
- Modify: `packages/schema/src/rpc.ts` (`ComponentCall` gagne `{ kind: "presence.list" }`)
- Modify: `packages/sdk/src/types.ts`, `packages/sdk/src/sdk.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/react.tsx`, `packages/sdk/src/mock.ts`, `packages/sdk/src/conformance.tsx`, `packages/sdk/src/index.ts`
- Modify: `packages/sdk/src/sandbox/runtime.ts` (appel `presence.list` relayé par l'iframe, phase 4)
- Create: `packages/sdk/src/members.ts`, `packages/sdk/src/ticket-key.tsx`, `packages/sdk/src/fr.ts`, `packages/sdk/src/presence.test.tsx`
- Modify: `packages/daemon/src/components/component-call.ts` (contrôle `presence.list`, `reads: ticket`)
- Modify: `components/kanban/src/KanbanCard.tsx`, `components/kanban/src/Kanban.tsx`, `components/kanban/src/fr.ts`, `components/kanban/src/kanban.test.tsx`
- Modify: `components/tickets/src/TicketsTree.tsx`, `components/tickets/src/tickets.test.tsx`
- Create: `packages/ui/src/shell/PresenceAvatars.tsx`, `packages/ui/src/shell/KeyRequired.tsx`, `packages/ui/src/state/use-presence.ts`, `packages/ui/src/shell/presence.test.tsx`
- Modify: `packages/ui/src/shell/TicketSheet.tsx`, `packages/ui/src/shell/TabBar.tsx`, `packages/ui/src/pages/PageView.tsx`, `packages/ui/src/shell/Shell.tsx`, `packages/ui/src/i18n/fr.ts`

**Interfaces:**
- Consumes: RPC `getPresence`, `setPresence` (T24) ; événement `{ type: "presence"; projectId }` ; `PresencePeer`, `ProjectSyncInfo`, `MemberInfo`, `Assignee`, `ticketKeyLabel` (T4, T6) ; `enableServerAllocation` (T7) ; `ProjectSnapshot.sync` (T21).
- Produces (`@kibo/sdk`) :
```ts
export type KiboSdk = { /* existant */ presence: { list(): Promise<PresencePeer[]> }; sharing(): Promise<ProjectSyncInfo>;
  projectKey(): Promise<string> };
export function useProjectKey(): string;                     // "" tant que non chargé
export type ProjectBackend = { /* existant */ presence(): Promise<PresencePeer[]>; onPresence(listener: () => void): () => void };
export function usePresence(): PresencePeer[];
export function useSharing(): ProjectSyncInfo;
export function useMembers(): MemberInfo[];
export function useReadOnly(): boolean;
export function assigneeLabel(assignee: Assignee, members: MemberInfo[]): string;
export function remoteRuns(peers: PresencePeer[], ticketKey: string | null): { label: string; state: string }[];
export function TicketKeyLabel(props: { ticketKey: string | null; projectKey: string; className?: string }): JSX.Element;
export type MockSdkOptions = { /* existant */ presence?: PresencePeer[]; shared?: boolean; members?: MemberInfo[] };
```
- Produces (UI) : `PresenceAvatars({ project: { id: string; name: string }; pages: { id: string; title: string }[]; pageId?: string | null })`, `KeyRequired({ ticket, children })`, `usePresencePeers(projectId: string | null): PresencePeer[]`, `usePresenceReporter(input: { projectId: string | null; pageId: string | null; ticketId: string | null; shared: boolean })`.
- Hypothèse v0.6 (vérifiée en T0) : `ComponentCall` est défini dans `packages/schema/src/rpc.ts` ; le contrôle du démon vit dans `packages/daemon/src/components/component-call.ts` avec `checkCall(granted, call)` ; le runtime iframe est `packages/sdk/src/sandbox/runtime.ts` ; `TicketSheet` porte les boutons « Assigner à un agent » (phase 2) et « Créer la branche » (phase 3), et la vue Changements le bouton « Générer le message de commit » alimenté par le ticket de la branche ; `TabBar.tsx` (phase 3) ; `client.onEvent` (T28).

- [ ] **Step 1: Tests du SDK**

`packages/sdk/src/presence.test.tsx` :
```ts
import { expect, test } from "bun:test";
import { ComponentManifest, type PresencePeer } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import { assigneeLabel, remoteRuns } from "./members";
import { createMockSdk } from "./mock";
import { TicketKeyLabel } from "./ticket-key";

const manifest = (reads: ("ticket" | "status")[]) =>
  ComponentManifest.parse({ id: "probe", version: "1.0.0", kind: "widget", title: "Sonde", reads, writes: [] });
const lea: PresencePeer = {
  deviceId: "d2", self: false, userId: "u-lea", name: "Léa", pageId: "pg1", ticketId: "t1",
  runs: [{ ticketKey: "KIB-12", profile: "opus-dev-1", state: "running" }],
};

test("presence.list needs the ticket read permission", async () => {
  const denied = createMockSdk(manifest(["status"]), { presence: [lea] });
  await expect(denied.sdk.presence.list()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  expect(denied.violations).toEqual(["read presence"]);
  const allowed = createMockSdk(manifest(["ticket"]), { presence: [lea] });
  expect(await allowed.sdk.presence.list()).toEqual([lea]);
});

test("a shared mock project creates tickets with a provisional key", async () => {
  const m = createMockSdk(manifest(["ticket"]), {
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    seed: (run) => run({ method: "createTicket", title: "En attente" }),
  });
  const [ticket] = await m.sdk.list("ticket");
  expect(ticket?.key).toBeNull();
  expect((await m.sdk.sharing()).members).toEqual([{ userId: "u-lea", name: "Léa", role: "editor" }]);
});

test("assignee names come from members, agents keep their profile", () => {
  const members = [{ userId: "u-lea", name: "Léa", role: "editor" as const }];
  expect(assigneeLabel({ kind: "human", ref: "u-lea" }, members)).toBe("Léa");
  expect(assigneeLabel({ kind: "human", ref: "adam" }, members)).toBe("adam");
  expect(assigneeLabel({ kind: "agent", ref: "opus-dev-1" }, members)).toBe("opus-dev-1");
});

test("remote runs are labelled with the colleague's name", () => {
  expect(remoteRuns([lea, { ...lea, self: true, name: "Adam" }], "KIB-12")).toEqual([
    { label: "opus-dev-1 · Léa", state: "running" },
  ]);
  expect(remoteRuns([lea], null)).toEqual([]);
});

test("a provisional key is shown in italics with an explanation", () => {
  render(<TicketKeyLabel ticketKey={null} projectKey="KIB" />);
  const label = screen.getByText("KIB-…");
  expect(label.className).toContain("italic");
  expect(label.getAttribute("title")).toBe("Clé attribuée à la prochaine synchronisation");
  render(<TicketKeyLabel ticketKey="KIB-12" projectKey="KIB" />);
  expect(screen.getByText("KIB-12").className).not.toContain("italic");
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun test packages/sdk/src/presence.test.tsx`
Expected: FAIL « Cannot find module './members' ».

- [ ] **Step 3: Implémenter le SDK**

`packages/sdk/src/fr.ts` (textes propres au SDK, sur le modèle des `fr.ts` des composants) :
```ts
export const fr = {
  pendingKey: "Clé attribuée à la prochaine synchronisation",
};
```

`packages/sdk/src/members.ts` :
```ts
import type { Assignee, MemberInfo, PresencePeer } from "@kibo/schema";

export function assigneeLabel(assignee: Assignee, members: MemberInfo[]): string {
  if (assignee.kind === "agent") return assignee.ref;
  return members.find((m) => m.userId === assignee.ref)?.name ?? assignee.ref;
}

export function remoteRuns(peers: PresencePeer[], ticketKey: string | null): { label: string; state: string }[] {
  if (ticketKey === null) return [];
  return peers
    .filter((p) => !p.self)
    .flatMap((p) => p.runs.filter((r) => r.ticketKey === ticketKey).map((r) => ({ label: `${r.profile} · ${p.name}`, state: r.state })));
}
```

`packages/sdk/src/ticket-key.tsx` :
```tsx
import { ticketKeyLabel } from "@kibo/schema";
import { fr } from "./fr";
import { cn } from "./lib/utils";

export function TicketKeyLabel({ ticketKey, projectKey, className }: { ticketKey: string | null; projectKey: string; className?: string }) {
  const pending = ticketKey === null;
  return (
    <span
      className={cn("font-mono text-xs text-muted-foreground", pending && "italic opacity-70", className)}
      title={pending ? fr.pendingKey : undefined}
    >
      {ticketKeyLabel({ key: ticketKey }, projectKey)}
    </span>
  );
}
```
L'infobulle native (`title`) suffit ici : le composant vit dans les cartes Kanban et l'arbre, où une infobulle Radix par ligne coûterait cher ; l'UI du shell (T30, `KeyRequired`) utilise le `Tooltip` shadcn.

`packages/sdk/src/types.ts` : `KiboSdk` gagne `presence: { list(): Promise<PresencePeer[]> }` et `sharing(): Promise<ProjectSyncInfo>` ; `ProjectBackend` gagne `presence(): Promise<PresencePeer[]>` et `onPresence(listener: () => void): () => void`.

`packages/sdk/src/sdk.ts`, dans l'objet renvoyé par `createSdk` :
```ts
    presence: {
      async list() {
        if (!manifest.reads.includes("ticket")) {
          throw new KiboError("PERMISSION_DENIED", `${manifest.id} does not declare read ticket (presence)`);
        }
        return backend.presence();
      },
    },
    async sharing() {
      return (await backend.snapshot()).sync;
    },
    async projectKey() {
      return (await backend.snapshot()).meta.key;
    },
    subscribe: (listener) => {
      const offProject = backend.subscribe(listener);
      const offPresence = backend.onPresence(listener);
      return () => {
        offProject();
        offPresence();
      };
    },
```

`packages/sdk/src/client.ts`, dans `projectBackend` :
```ts
    presence: () => client.rpc({ method: "getPresence", projectId }),
    onPresence: (listener) =>
      client.onEvent((e) => {
        if (e.type === "presence" && e.projectId === projectId) listener();
      }),
```

`packages/sdk/src/react.tsx` :
```tsx
const EMPTY_SHARING: ProjectSyncInfo = { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };

function useSdkValue<T>(read: (sdk: KiboSdk) => Promise<T>, initial: T): T {
  const sdk = useSdk();
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      read(sdk).then(
        (v) => alive && setValue(v),
        (e: unknown) => {
          if (!(e instanceof KiboError && e.code === "PERMISSION_DENIED")) throw e;
        },
      );
    void load();
    const off = sdk.subscribe(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, [sdk, read]);
  return value;
}

const readPresence = (sdk: KiboSdk) => sdk.presence.list();
const readSharing = (sdk: KiboSdk) => sdk.sharing();

export function usePresence(): PresencePeer[] {
  return useSdkValue(readPresence, []);
}
export function useSharing(): ProjectSyncInfo {
  return useSdkValue(readSharing, EMPTY_SHARING);
}
export function useMembers(): MemberInfo[] {
  return useSharing().members;
}
export function useReadOnly(): boolean {
  return useSharing().access !== "write";
}
const readProjectKey = (sdk: KiboSdk) => sdk.projectKey();
export function useProjectKey(): string {
  return useSdkValue(readProjectKey, "");
}
```
Un composant sans `reads: ticket` qui appelle `usePresence` reçoit une liste vide (le refus reste compté comme violation par le SDK simulé, donc visible en conformité).

`packages/sdk/src/mock.ts` : options `presence`, `shared`, `members`. Si `shared`, `enableServerAllocation(doc)` avant `seed` ; le `ProjectBackend` simulé renvoie `presence: async () => opts.presence ?? []`, `onPresence: () => () => {}`, et `snapshot` fixe `sync` à `{ shared: true, keyAllocator: "server", role: "editor", access: "write", members: opts.members ?? [] }` quand `shared`. `record` enregistre `read presence` pour un refus de `presence.list`. `packages/sdk/src/index.ts` exporte `members`, `ticket-key`.

`packages/sdk/src/conformance.tsx` : la boucle des cas gagne `["shared project with provisional keys", seed, { shared: true, presence: [COLLEAGUE] }]`, où `COLLEAGUE` est un `PresencePeer` fictif (Léa, un run `opus-dev-1`) ; le test vérifie comme les autres le rendu et l'absence de violation, ce qui garantit qu'aucun composant conforme ne plante sur `key: null`.

Démon (`component-call.ts`) : `presence.list` exige `granted.reads` contenant `ticket` (sinon `PERMISSION_DENIED` journalisé dans `component_events`) et renvoie `presence.peers(projectId)` ; le runtime iframe relaie `sdk.presence.list()` en `{ kind: "presence.list" }`. Test ajouté au fichier de tests existant de `component-call` :
```ts
test("presence.list is refused without reads ticket", async () => {
  const call = await callAs({ reads: ["status"], writes: [], data: false, net: [] }, { kind: "presence.list" });
  expect(call).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
});
```
(`callAs` est l'utilitaire de test de ce fichier en phase 4 ; hypothèse vérifiée en T0.)

- [ ] **Step 4: Vérifier le SDK**

Run: `bun test packages/sdk components packages/daemon/src/components`
Expected: PASS, y compris la conformité de Kanban et Tickets avec le nouveau cas (le Kanban et l'arbre affichent `ticket.key` directement : ils rendent « null » mais ne plantent pas ; l'étape suivante corrige l'affichage).

- [ ] **Step 5: Commit du SDK**

```bash
git add packages/schema/src/rpc.ts packages/sdk/src packages/daemon/src/components/component-call.ts \
  packages/daemon/src/components/component-call.test.ts
git commit -m "feat(sdk): présence et membres"
```

- [ ] **Step 6: Tests des composants et du shell**

Ajouts à `components/kanban/src/kanban.test.tsx` :
```ts
test("shows a colleague's run, member names and provisional keys", async () => {
  const m = createMockSdk(manifest, {
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    presence: [{
      deviceId: "d2", self: false, userId: "u-lea", name: "Léa", pageId: null, ticketId: null,
      runs: [{ ticketKey: null, profile: "opus-dev-1", state: "running" }],
    }],
    seed: (run) => run({ method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "u-lea" } }),
  });
  render(<SdkProvider sdk={m.sdk}><Kanban /></SdkProvider>);
  expect(await screen.findByText("KIB-…")).toBeTruthy();
  expect(screen.getByText("Léa")).toBeTruthy();
});

test("cards cannot be dragged in a read-only project", async () => {
  const m = createMockSdk(manifest, { shared: true, seed: (run) => run({ method: "createTicket", title: "Lecture" }) });
  m.setAccess("read-only");
  render(<SdkProvider sdk={m.sdk}><Kanban /></SdkProvider>);
  const key = await screen.findByText("KIB-…");
  expect(key.closest("[aria-roledescription='draggable']")).toBeNull();
  expect(screen.queryByRole("button", { name: /Nouveau ticket dans/ })).toBeNull();
});
```
`MockSdk.setAccess(access: ProjectAccess)` s'ajoute au SDK simulé (modifie `sync.access` et notifie les abonnés). Un test gémeau pour le run distant utilise un ticket à clé définitive (projet non partagé, `presence` avec `ticketKey: "KIB-1"`) et attend « opus-dev-1 · Léa ».

Ajout à `components/tickets/src/tickets.test.tsx` :
```ts
test("the tree shows provisional keys and member names", async () => {
  const m = createMockSdk(manifest, {
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    seed: (run) => run({ method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "u-lea" } }),
  });
  render(<SdkProvider sdk={m.sdk}><TicketsTree /></SdkProvider>);
  expect(await screen.findByText("KIB-…")).toBeTruthy();
  expect(screen.getByText("Léa")).toBeTruthy();
});
```

`packages/ui/src/shell/presence.test.tsx` :
```ts
import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, type PresencePeer, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";

const calls: RpcRequest[] = [];
let peers: PresencePeer[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return Promise.resolve(req.method === "getPresence" ? peers : null);
    },
    onEvent: () => () => {},
  },
}));

const { PresenceAvatars } = await import("./PresenceAvatars");
const { TicketSheet } = await import("./TicketSheet");
const { KeyRequired } = await import("./KeyRequired");
const { usePresenceReporter } = await import("../state/use-presence");

const peer = (name: string, i: number, extra: Partial<PresencePeer> = {}): PresencePeer => ({
  deviceId: `d${i}`, self: false, userId: `u${i}`, name, pageId: null, ticketId: null, runs: [], ...extra,
});
const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "pg1", title: "Kanban", kind: "view", parentId: null }],
  tickets: [{
    id: "t1", key: null, pendingSeq: 1, title: "Schéma", description: "", statusId: "todo", blockedReason: null,
    domainId: null, assignee: null, parentId: null, progress: { done: 0, total: 0 }, waitingOn: [],
  }],
  links: [], instances: [], nextTicketKey: null,
  sync: { shared: true, keyAllocator: "server", role: "editor", access: "write", members: [] },
};

beforeEach(() => {
  calls.length = 0;
  peers = [];
});

test("the avatar stack shows three colleagues then a counter, never self", async () => {
  peers = [peer("Léa", 1), peer("Sam", 2), peer("Noé", 3), peer("Inès", 4), peer("Zoé", 5), { ...peer("Adam", 0), self: true }];
  render(<PresenceAvatars project={{ id: "p1", name: "Kibo" }} pages={project.pages} />);
  expect(await screen.findByText("+2")).toBeTruthy();
  expect(screen.getAllByRole("img").map((a) => a.getAttribute("aria-label"))).toEqual(["Inès", "Léa", "Noé"]);
});

test("a page header only shows the colleagues on that page", async () => {
  peers = [peer("Léa", 1, { pageId: "pg1" }), peer("Sam", 2, { pageId: "other" })];
  render(<PresenceAvatars project={{ id: "p1", name: "Kibo" }} pages={project.pages} pageId="pg1" />);
  expect(await screen.findByRole("img", { name: "Léa" })).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Sam" })).toBeNull();
});

test("the sheet says who is looking at the ticket and shows the provisional key", async () => {
  peers = [peer("Léa", 1, { ticketId: "t1" })];
  render(<TicketSheet project={project} ticketId="t1" onClose={() => {}} />);
  expect(await screen.findByText("Léa regarde ce ticket")).toBeTruthy();
  expect(screen.getByText("KIB-…")).toBeTruthy();
});

test("actions that need a key are disabled with an explanation", () => {
  const ticket = project.tickets[0];
  if (!ticket) throw new Error("no ticket");
  render(<KeyRequired ticket={ticket}><button type="button">Assigner à un agent</button></KeyRequired>);
  const button = screen.getByRole("button", { name: "Assigner à un agent" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.closest("[data-key-required]")?.getAttribute("title")).toBe("Clé attribuée à la prochaine synchronisation");
});

function Reporter(props: Parameters<typeof usePresenceReporter>[0]) {
  usePresenceReporter(props);
  return null;
}

test("navigation reports presence only for shared projects", async () => {
  const { rerender } = render(<Reporter projectId="p1" pageId="pg1" ticketId={null} shared />);
  await waitFor(() =>
    expect(calls).toContainEqual({ method: "setPresence", projectId: "p1", pageId: "pg1", ticketId: null }),
  );
  calls.length = 0;
  rerender(<Reporter projectId="p2" pageId="pgX" ticketId={null} shared={false} />);
  await Bun.sleep(20);
  expect(calls.filter((c) => c.method === "setPresence")).toEqual([]);
});
```

- [ ] **Step 7: Vérifier l'échec**

Run: `bun test components packages/ui/src/shell/presence.test.tsx`
Expected: FAIL (« KIB-… » introuvable dans le Kanban, `./PresenceAvatars` introuvable).

- [ ] **Step 8: Implémenter les composants intégrés**

`KanbanCard.tsx` : nouvelles props `projectKey: string`, `members: MemberInfo[]`, `runs: { label: string; state: string }[]`, `readOnly: boolean` ; `useDraggable({ id: t.id, disabled: readOnly })` ; `{t.key}` devient `<TicketKeyLabel ticketKey={t.key} projectKey={projectKey} />` ; `fr.actions(t.key)` devient `fr.actions(ticketKeyLabel(t, projectKey))` ; le menu « Déplacer vers » est masqué si `readOnly` ; badge d'assigné humain `assigneeLabel(t.assignee, members)` ; pour chaque entrée de `runs` :
```tsx
<Badge key={r.label} variant="outline" className="gap-1 border-brand/40 text-brand-strong dark:text-brand">
  <Bot className="size-3" /> {r.label}
</Badge>
```
`Kanban.tsx` : `const peers = usePresence(); const members = useMembers(); const readOnly = useReadOnly(); const projectKey = useProjectKey();` ; `onAdd` des colonnes et `DndContext.onDragEnd` inactifs si `readOnly`. Chaque carte reçoit `runs={remoteRuns(peers, t.key)}`.

`TicketsTree.tsx` : la clé passe par `TicketKeyLabel`, `AssigneeCell` affiche `assigneeLabel(assignee, members)` et les initiales de ce libellé.

- [ ] **Step 9: Implémenter l'UI du shell**

`packages/ui/src/state/use-presence.ts` :
```ts
import { KiboError, type PresencePeer } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function usePresencePeers(projectId: string | null): PresencePeer[] {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  useEffect(() => {
    setPeers([]);
    if (!projectId) return;
    let alive = true;
    const load = () =>
      client.rpc({ method: "getPresence", projectId }).then(
        (p) => alive && setPeers(p),
        (e: unknown) => {
          if (!(e instanceof KiboError && e.code === "UNAUTHORIZED")) throw e;
        },
      );
    void load();
    const off = client.onEvent((e) => {
      if (e.type === "presence" && e.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  return peers;
}

export function usePresenceReporter(input: {
  projectId: string | null;
  pageId: string | null;
  ticketId: string | null;
  shared: boolean;
}): void {
  const { projectId, pageId, ticketId, shared } = input;
  useEffect(() => {
    if (!projectId || !shared) return;
    void client.rpc({ method: "setPresence", projectId, pageId, ticketId });
  }, [projectId, pageId, ticketId, shared]);
}
```

`packages/ui/src/shell/PresenceAvatars.tsx` :
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { fr } from "../i18n/fr";
import { usePresencePeers } from "../state/use-presence";

const MAX = 3;
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);

type Props = { project: { id: string; name: string }; pages: { id: string; title: string }[]; pageId?: string | null };

export function PresenceAvatars({ project, pages, pageId }: Props) {
  const place = (id: string | null) => {
    const page = pages.find((p) => p.id === id);
    return page ? `${project.name} › ${page.title}` : null;
  };
  const peers = usePresencePeers(project.id)
    .filter((p) => !p.self && (pageId === undefined || p.pageId === pageId))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (peers.length === 0) return null;
  const shown = peers.slice(0, MAX);
  return (
    <div className="flex items-center -space-x-1.5" aria-label={fr.presence.label}>
      {shown.map((p) => (
        <Tooltip key={p.deviceId}>
          <TooltipTrigger asChild>
            <span
              role="img"
              aria-label={p.name}
              className="grid size-6 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold"
            >
              {initials(p.name)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{fr.presence.where(p.name, place(p.pageId))}</TooltipContent>
        </Tooltip>
      ))}
      {peers.length > MAX && (
        <span className="grid size-6 place-items-center rounded-full border-2 border-background bg-muted text-[10px]">
          {`+${peers.length - MAX}`}
        </span>
      )}
    </div>
  );
}
```
L'infobulle affiche « Léa · Kibo › Kanban », ou seulement « Léa » si la page n'existe pas (ou plus) dans le projet.

`packages/ui/src/shell/KeyRequired.tsx` :
```tsx
import type { Ticket } from "@kibo/schema";
import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import { fr } from "../i18n/fr";

export function KeyRequired({ ticket, children }: { ticket: Pick<Ticket, "key">; children: ReactElement<{ disabled?: boolean }> }) {
  if (ticket.key !== null) return children;
  const child = Children.only(children);
  return (
    <span data-key-required title={fr.presence.pendingKey} className="inline-flex">
      {isValidElement(child) ? cloneElement(child, { disabled: true }) : child}
    </span>
  );
}
```

`fr.ts` :
```ts
  presence: {
    label: "Personnes présentes",
    where: (name: string, place: string | null) => (place ? `${name} · ${place}` : name),
    watching: (name: string) => `${name} regarde ce ticket`,
    pendingKey: "Clé attribuée à la prochaine synchronisation",
  },
```

`TicketSheet.tsx` : `const peers = usePresencePeers(project.meta.id).filter((p) => !p.self && p.ticketId === ticketId);` ; au-dessus de l'en-tête, pour chaque pair, `<p className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">{fr.presence.watching(p.name)}</p>` ; `SheetDescription` contient `<TicketKeyLabel ticketKey={t.key} projectKey={project.meta.key} />` ; les sous-tickets aussi ; les boutons « Assigner à un agent » et « Créer la branche » sont enveloppés dans `KeyRequired`. Dans la vue Changements, « Générer le message de commit » est enveloppé dans `KeyRequired` avec le ticket reconnu dans la branche.

`TabBar.tsx` : `{project && <PresenceAvatars project={{ id: project.meta.id, name: project.meta.name }} pages={project.pages} />}` à droite des onglets (projet de l'onglet actif). `PageView.tsx` : `<PresenceAvatars project={{ id: project.meta.id, name: project.meta.name }} pages={project.pages} pageId={page.id} />` à droite du titre. `Shell.tsx` : `usePresenceReporter({ projectId: route.projectId, pageId: route.pageId, ticketId, shared: project?.sync.shared ?? false })`.

- [ ] **Step 10: Vérifier**

Run: `bun test packages components`
Expected: PASS, conformité de Kanban et Tickets verte sur les quatre cas.

Run: `bun run check && bun run typecheck && bun run --cwd packages/ui build`
Expected: PASS.

Contrôle visuel face aux exports S4 et S5, en sombre et en clair.

- [ ] **Step 11: Commit de l'UI**

```bash
git add components/kanban/src components/tickets/src packages/sdk/src/mock.ts packages/ui/src/shell/PresenceAvatars.tsx \
  packages/ui/src/shell/KeyRequired.tsx packages/ui/src/state/use-presence.ts packages/ui/src/shell/presence.test.tsx \
  packages/ui/src/shell/TicketSheet.tsx packages/ui/src/shell/TabBar.tsx packages/ui/src/pages/PageView.tsx \
  packages/ui/src/shell/Shell.tsx packages/ui/src/pages/changes packages/ui/src/i18n/fr.ts
git commit -m "feat(ui): présence et clé provisoire"
```

---

### Task 31: E2E sync à deux utilisateurs

Vague 8. Spec G §9 (ligne e2e) et §10 (scénario à deux utilisateurs vert sur macOS et Linux). Aucun compte réel : serveur de sync TLS et démons démarrés par le test sur des ports loopback.

**Files:**
- Create: `e2e/serve-sync.ts`
- Create: `e2e/sync.spec.ts`
- Create: `e2e/sync-fixture.ts`
- Modify: `e2e/playwright.config.ts` (second `webServer`, projets inchangés)
- Modify: `e2e/package.json` (`dependencies` : `"@kibo/sync-server": "workspace:*"`, `"@kibo/trust": "workspace:*"`)

**Interfaces:**
- Consumes: `startTestSyncServer({ port, dataDir, cert })`, `stop({ keepData })` et `inviteAccount(name)` (T17) ; écrans S1 (T28), S2, S3 (T29), S4, S5 (T30) ; `E2E_TOKEN` (`e2e/token.ts`).
- Produces : `e2e/sync-fixture.ts` exporte `SYNC_PORTS = { server: 4393, control: 4396, dark: { a: 4391, b: 4392 }, light: { a: 4394, b: 4395 } }`, `SYNC_STATE_FILE` (chemin du JSON d'état) et `readSyncState(): SyncE2eState` avec `SyncE2eState = { caFile: string; serverUrl: string; codes: Record<"darkA" | "darkB" | "lightA" | "lightB", string> }`.

Deux paires de démons (une par projet Playwright `dark` et `light`) évitent qu'un démon déjà connecté par le premier projet fausse le second. Un petit serveur de contrôle (`:4396`) arrête et relance le serveur de sync pour observer la clé provisoire, qui sinon ne dure que quelques millisecondes.

- [ ] **Step 1: Fixture partagée**

`e2e/sync-fixture.ts` :
```ts
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SYNC_PORTS = { server: 4393, control: 4396, dark: { a: 4391, b: 4392 }, light: { a: 4394, b: 4395 } } as const;
export const SYNC_STATE_FILE = join(tmpdir(), "kibo-e2e-sync-state.json");
export type SyncE2eState = {
  caFile: string;
  serverUrl: string;
  codes: Record<"darkA" | "darkB" | "lightA" | "lightB", string>;
};

export function readSyncState(): SyncE2eState {
  return JSON.parse(readFileSync(SYNC_STATE_FILE, "utf8")) as SyncE2eState;
}
```

- [ ] **Step 2: Lanceur**

`e2e/serve-sync.ts` :
```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startTestSyncServer } from "@kibo/sync-server/testing";
import { SYNC_PORTS, SYNC_STATE_FILE } from "./sync-fixture";
import { E2E_TOKEN } from "./token";

const root = resolve(import.meta.dir, "..");
const base = mkdtempSync(join(tmpdir(), "kibo-e2e-sync-"));
const dataDir = join(base, "server");
let server = await startTestSyncServer({ dataDir, port: SYNC_PORTS.server });
const { cert } = server;
const caFile = join(base, "ca.pem");
writeFileSync(caFile, server.caPem, { mode: 0o600 });
writeFileSync(
  SYNC_STATE_FILE,
  JSON.stringify({
    caFile,
    serverUrl: server.url,
    codes: {
      darkA: await server.inviteAccount("Adam"),
      darkB: await server.inviteAccount("Léa"),
      lightA: await server.inviteAccount("Adam"),
      lightB: await server.inviteAccount("Léa"),
    },
  }),
);

const ports = [SYNC_PORTS.dark.a, SYNC_PORTS.dark.b, SYNC_PORTS.light.a, SYNC_PORTS.light.b];
const daemons = ports.map((port) => {
  const kiboHome = join(base, `home-${port}`);
  mkdirSync(kiboHome, { recursive: true, mode: 0o700 });
  writeFileSync(join(kiboHome, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
  return Bun.spawn(
    ["bun", join(root, "packages/daemon/src/main.ts"), "--port", String(port), "--ui", join(root, "packages/ui/dist")],
    { env: { ...process.env, KIBO_HOME: kiboHome }, stdout: "inherit", stderr: "inherit" },
  );
});

const control = Bun.serve({
  hostname: "127.0.0.1",
  port: SYNC_PORTS.control,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (req.method === "POST" && path === "/stop") {
      await server.stop({ keepData: true });
      return new Response(null, { status: 204 });
    }
    if (req.method === "POST" && path === "/start") {
      server = await startTestSyncServer({ dataDir, port: SYNC_PORTS.server, cert });
      return new Response(null, { status: 204 });
    }
    if (path === "/") return new Response("ok");
    return new Response("not found", { status: 404 });
  },
});

const shutdown = async () => {
  for (const d of daemons) d.kill("SIGTERM");
  await Promise.all(daemons.map((d) => d.exited));
  control.stop(true);
  await server.stop();
  rmSync(base, { recursive: true, force: true });
  rmSync(SYNC_STATE_FILE, { force: true });
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
```

- [ ] **Step 3: Configuration Playwright**

`e2e/playwright.config.ts`, `webServer` devient un tableau (le serveur MVP existant reste le premier) :
```ts
  webServer: [
    {
      command: "bun serve.ts",
      url: "http://127.0.0.1:4390/",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      command: "bun serve-sync.ts",
      url: "http://127.0.0.1:4396/",
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
```
L'URL de contrôle ne répond qu'une fois les codes écrits ; les démons, lancés juste avant, sont attendus par le test (`waitForDaemon`).

- [ ] **Step 4: Écrire le scénario**

`e2e/sync.spec.ts` :
```ts
import { type Browser, expect, type Page, test } from "@playwright/test";
import { readSyncState, SYNC_PORTS } from "./sync-fixture";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });

async function waitForDaemon(port: number) {
  await expect.poll(async () => (await fetch(`http://127.0.0.1:${port}/`).catch(() => null))?.status ?? 0, {
    timeout: 20_000,
  }).toBe(200);
}

async function openAs(browser: Browser, port: number, colorScheme: "dark" | "light"): Promise<Page> {
  await waitForDaemon(port);
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${port}`, colorScheme });
  const page = await context.newPage();
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Nouveau projet" }).first()).toBeVisible();
  return page;
}

async function connect(page: Page, code: string, device: string) {
  const { caFile, serverUrl } = readSyncState();
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Sync" }).click();
  await page.getByRole("button", { name: "Se connecter à un serveur" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse du serveur").fill(serverUrl);
  await dialog.getByLabel("Code d'invitation").fill(code);
  await dialog.getByLabel("Nom de cet appareil").fill(device);
  await dialog.getByLabel("Certificat racine (optionnel)").fill(caFile);
  await dialog.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Connecté")).toBeVisible();
  await expect(page.getByText("Démon local · synchronisé")).toBeVisible();
}

test("deux utilisateurs voient les mêmes tickets en temps réel", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const theme = info.project.name === "light" ? "light" : "dark";
  const ports = SYNC_PORTS[theme];
  const { codes } = readSyncState();
  const key = theme === "light" ? "SYL" : "SYD";
  const adam = await openAs(browser, ports.a, theme);
  const lea = await openAs(browser, ports.b, theme);

  await connect(adam, theme === "light" ? codes.lightA : codes.darkA, "MacBook d'Adam");
  await connect(lea, theme === "light" ? codes.lightB : codes.darkB, "MacBook de Léa");

  await adam.getByRole("button", { name: "Nouveau projet" }).first().click();
  await adam.getByLabel("Nom").fill(`Partagé ${key}`);
  await adam.getByLabel("Clé").fill(key);
  await adam.getByRole("button", { name: "Créer le projet" }).click();
  await adam.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await adam.getByLabel("Nom").fill("Kanban");
  await adam.getByRole("radio", { name: "Vue", exact: true }).click();
  await adam.getByRole("button", { name: "Créer la page" }).click();
  await adam.getByRole("button", { name: "Ajouter un composant" }).click();
  await adam.getByRole("radio", { name: "Kanban", exact: true }).click();
  await adam.getByRole("button", { name: "Ajouter à la page" }).click();

  await adam.getByRole("button", { name: "Partager" }).click();
  const share = adam.getByRole("dialog");
  await expect(share.getByRole("list", { name: "Reste sur ta machine" })).toContainText("Dossier local");
  await share.getByRole("button", { name: "Partager" }).click();
  await expect(share.getByRole("list", { name: "Membres" })).toContainText("Adam");
  await share.getByRole("button", { name: "Générer un code" }).click();
  const code = (await share.locator(".font-mono").first().textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z2-7]{26}$/);
  await adam.keyboard.press("Escape");

  await lea.getByRole("button", { name: "Rejoindre un projet" }).click();
  await lea.getByLabel("Code d'invitation").fill(code);
  await lea.getByRole("button", { name: "Rejoindre" }).click();
  await lea.getByRole("button", { name: "Kanban" }).click();
  await expect(lea.getByRole("region", { name: "À faire" })).toBeVisible();

  await expect(adam.getByRole("img", { name: "Léa" })).toBeVisible({ timeout: 5_000 });
  await expect(lea.getByRole("img", { name: "Adam" })).toBeVisible({ timeout: 5_000 });

  await adam.getByRole("button", { name: "Nouveau ticket dans À faire" }).click();
  await adam.getByLabel("Titre").fill("Visible chez Léa");
  await adam.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(lea.getByText("Visible chez Léa")).toBeVisible({ timeout: 1_000 });
  await expect(adam.getByText(`${key}-1`)).toBeVisible();
  await expect(lea.getByText(`${key}-1`)).toBeVisible();

  await fetch(`http://127.0.0.1:${SYNC_PORTS.control}/stop`, { method: "POST" });
  await expect(adam.getByText("Démon local · hors ligne")).toBeVisible({ timeout: 10_000 });
  await adam.getByRole("button", { name: "Nouveau ticket dans À faire" }).click();
  await adam.getByLabel("Titre").fill("Créé hors ligne");
  await adam.getByRole("button", { name: "Créer le ticket" }).click();
  const pending = adam.getByText(`${key}-…`);
  await expect(pending).toBeVisible();
  await expect(pending).toHaveCSS("font-style", "italic");
  await expect(pending).toHaveAttribute("title", "Clé attribuée à la prochaine synchronisation");

  await fetch(`http://127.0.0.1:${SYNC_PORTS.control}/start`, { method: "POST" });
  await expect(adam.getByText(`${key}-2`)).toBeVisible({ timeout: 70_000 });
  await expect(adam.getByText(`${key}-…`)).toHaveCount(0);
  await expect(lea.getByText("Créé hors ligne")).toBeVisible({ timeout: 70_000 });
  await expect(lea.getByText(`${key}-2`)).toBeVisible();

  await adam.context().close();
  await lea.context().close();
});
```
Le délai de 70 s après la relance couvre le pire backoff (60 s plus gigue) ; en pratique la reconnexion a lieu en quelques secondes.

- [ ] **Step 5: Vérifier**

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test -- sync.spec.ts`
Expected: PASS dans les projets `dark` et `light` ; le parcours MVP (`mvp.spec.ts`) et ceux des phases 2 à 6 restent verts : `bun run --cwd e2e test`.

La CI (job `e2e`, macOS et Linux) exécute le nouveau fichier sans changement de workflow ; en cas d'échec, l'artefact `playwright-<os>` contient les traces des deux contextes.

- [ ] **Step 6: Commit**

```bash
git add e2e/serve-sync.ts e2e/sync.spec.ts e2e/sync-fixture.ts e2e/playwright.config.ts e2e/package.json bun.lock
git commit -m "test(e2e): sync à deux utilisateurs"
```

---

### Task 32: E2E marketplace

Parcours Playwright de la spec H §9 (ligne e2e) et §10 : ajout d'une source en deux étapes, recherche, détail, « Voir le code », installation jusqu'à l'écran 30, ajout à une page, puis mise à jour via l'écran 6, en **sombre et en clair**, sur macOS et Linux, sans réseau réel.

**Files:**
- Create: `e2e/serve-market.ts`, `e2e/market.spec.ts`, `e2e/market-fixture.ts`
- Modify: `e2e/playwright.config.ts` (second `webServer`), `e2e/package.json` (dépendances de workspace `@kibo/trust`, `@kibo/daemon`), `.github/workflows/ci.yml` (le job `e2e` Linux a déjà bubblewrap et le `sysctl` depuis T8 ; vérifier qu'il précède `bun run --cwd e2e test`)
- Test: `e2e/market.spec.ts`

**Interfaces:**
- Consumes: `startFakeMarket` (`@kibo/daemon/testing/fake-market`, T15) ; `makeTestPackage` (`@kibo/trust/testing`, T10) ; `keyFingerprint` (T2) ; écrans M1, M2, M3, M4, M5 (T26, T27) et 30, 6 (phase 4) ; `E2E_TOKEN` (`e2e/token.ts`).
- Hypothèse v0.6 (vérifiée en T0) : `@kibo/daemon` exporte `./testing/*` ; le démon lu par `KIBO_MARKET_ALLOW_LOOPBACK=1` accepte une source `http://127.0.0.1` (T15, `main.ts`) ; les fichiers par défaut de `makeTestPackage` forment un composant valide qui passe la suite de conformité générique et affiche son titre (`<div>{title}</div>`) ; la sidebar mène à Paramètres par le bouton « Paramètres » et à la page Composants par « Composants ».
- Produces : `e2e/market-fixture.ts` exporte `MARKET_STATE_FILE` et `type MarketE2eState = Record<"dark" | "light", { daemon: string; market: string; fingerprint: string; control: string }>`.

Chaque projet Playwright (`dark`, `light`) a **son démon et sa fausse source** : le parcours installe et met à jour, il ne peut pas partager l'état d'un autre thème.

- [ ] **Step 1: Écrire le parcours**

`e2e/market-fixture.ts` :
```ts
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MARKET_STATE_FILE = join(tmpdir(), "kibo-e2e-market.json");
export type MarketE2eTheme = { daemon: string; market: string; fingerprint: string; control: string };
export type MarketE2eState = Record<"dark" | "light", MarketE2eTheme>;
```

`e2e/market.spec.ts` :
```ts
import { readFileSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { MARKET_STATE_FILE, type MarketE2eState } from "./market-fixture";
import { E2E_TOKEN } from "./token";

const state = (info: TestInfo) => {
  const all: MarketE2eState = JSON.parse(readFileSync(MARKET_STATE_FILE, "utf8"));
  return info.project.name === "light" ? all.light : all.dark;
};
const grouped = (hex: string) => (hex.match(/.{1,4}/g) ?? []).join(" ");

async function openSettingsSources(page: Page) {
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Composants" }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
}

async function approveSandboxed(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Publié par Léa · vérifié par Équipe")).toBeVisible();
  await expect(dialog.getByText("Ce code vient d'une marketplace.")).toBeVisible();
  await dialog.getByRole("radio", { name: /Sandboxé/ }).click();
  await dialog.getByRole("button", { name: "Autoriser" }).click();
  await expect(dialog).toBeHidden();
}

test("source, catalogue, installation puis mise à jour partout", async ({ page, request }, info) => {
  test.setTimeout(120_000);
  const s = state(info);
  await page.goto(`${s.daemon}/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name === "dark") await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);

  await openSettingsSources(page);
  await page.getByRole("button", { name: "Ajouter une source" }).click();
  await page.getByLabel("Adresse HTTPS de la source").fill(s.market);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText(grouped(s.fingerprint))).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Équipe" })).toBeVisible();

  await page.getByRole("button", { name: "Composants" }).first().click();
  await page.getByRole("tab", { name: "Marketplace" }).click();
  await page.getByLabel("Rechercher un composant").fill("burn");
  await page.getByRole("button", { name: "Burndown" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Publié par Léa · vérifié par Équipe")).toBeVisible();
  await sheet.getByRole("button", { name: "Voir le code" }).click();
  await expect(sheet.getByText("Code vérifié : signature et empreinte correspondent")).toBeVisible();
  await sheet.getByRole("button", { name: "ui.tsx" }).click();
  await expect(sheet.getByText(/export const Component/)).toBeVisible();
  await sheet.getByRole("button", { name: "Installer" }).click();
  await approveSandboxed(page);

  await page.getByRole("tab", { name: "Installés" }).click();
  const row = page.getByRole("row", { name: /Burndown/ });
  await expect(row.getByText("Marketplace · Équipe")).toBeVisible();
  await expect(row.getByText("0.1.0")).toBeVisible();

  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  const key = info.project.name === "light" ? "MKL" : "MKD";
  await page.getByLabel("Nom").fill(`Market ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom").fill("Suivi");
  await page.getByRole("radio", { name: "Tableau de bord", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: "Burndown", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à la page" }).click();
  const frame = page.frameLocator("iframe[sandbox='allow-scripts']");
  await expect(frame.getByText("Burndown")).toBeVisible();

  const published = await request.post(`${s.control}/__control/publish-next`);
  expect(published.ok()).toBe(true);
  await openSettingsSources(page);
  await page.getByRole("button", { name: "Actions Équipe" }).click();
  await page.getByRole("menuitem", { name: "Rafraîchir" }).click();

  await page.getByRole("button", { name: "Composants" }).first().click();
  await page.getByRole("tab", { name: "Installés" }).click();
  await expect(row.getByText("0.2.0 disponible")).toBeVisible();
  await row.getByRole("button", { name: "Mettre à jour" }).click();
  const update = page.getByRole("dialog");
  await expect(update.getByText("Ligne idéale")).toBeVisible();
  await update.getByRole("button", { name: "Mettre à jour partout" }).click();
  await approveSandboxed(page);
  await expect(row.getByText("0.2.0", { exact: true })).toBeVisible();
  await expect(row.getByText("0.2.0 disponible")).toHaveCount(0);

  await page.getByRole("button", { name: `Market ${key}` }).click();
  await page.getByRole("button", { name: "Suivi" }).click();
  await expect(frame.getByText("Burndown")).toBeVisible();
  await expect(page.getByText("burndown@0.2.0")).toHaveCount(0);
});
```
La dernière assertion vérifie qu'aucune instance n'est restée « Composant absent » ni « Autorisation requise » après la mise à jour ; la version 0.2.0 de l'instance est lue dans l'onglet Installés (colonne « Utilisé dans » de la ligne 0.2.0, écran 6).

- [ ] **Step 2: Lancer pour le voir échouer**

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test -- market.spec.ts`
Expected: FAIL (`ENOENT … kibo-e2e-market.json` : le serveur de marketplace n'existe pas encore).

- [ ] **Step 3: Serveur de test**

`e2e/serve-market.ts` :
```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startFakeMarket } from "@kibo/daemon/testing/fake-market";
import { keyFingerprint } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { MARKET_STATE_FILE, type MarketE2eState } from "./market-fixture";
import { E2E_TOKEN } from "./token";

const root = resolve(import.meta.dir, "..");
const CONTROL_PORT = 4395;
const THEMES = [
  { theme: "dark", port: 4394 },
  { theme: "light", port: 4396 },
] as const;

const lea = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown", kind: "widget" } });
const publisher = { name: "Léa", keys: lea.publisher.keys };
const next = await makeTestPackage({
  id: "burndown",
  version: "0.2.0",
  publisher,
  manifest: { title: "Burndown", kind: "widget", changes: ["Ligne idéale"] },
});

const homes: string[] = [];
const procs: ReturnType<typeof Bun.spawn>[] = [];
const markets = new Map<string, Awaited<ReturnType<typeof startFakeMarket>>>();
const state: Partial<MarketE2eState> = {};

for (const { theme, port } of THEMES) {
  const market = await startFakeMarket({ id: "equipe", name: "Équipe", verified: true });
  await market.publish(lea.bytes);
  markets.set(theme, market);
  const home = mkdtempSync(join(tmpdir(), `kibo-e2e-market-${theme}-`));
  homes.push(home);
  writeFileSync(join(home, "token"), `${E2E_TOKEN}\n`, { mode: 0o600 });
  procs.push(
    Bun.spawn(["bun", join(root, "packages/daemon/src/main.ts"), "--port", String(port), "--ui", join(root, "packages/ui/dist")], {
      env: { ...process.env, KIBO_HOME: home, KIBO_MARKET_ALLOW_LOOPBACK: "1" },
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  state[theme] = {
    daemon: `http://127.0.0.1:${port}`,
    market: market.url,
    fingerprint: await keyFingerprint(market.publicKey),
    control: `http://127.0.0.1:${CONTROL_PORT}/${theme}`,
  };
}
writeFileSync(MARKET_STATE_FILE, JSON.stringify(state));

const control = Bun.serve({
  hostname: "127.0.0.1",
  port: CONTROL_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return new Response("ok");
    const match = url.pathname.match(/^\/(dark|light)\/__control\/publish-next$/);
    const market = match?.[1] ? markets.get(match[1]) : undefined;
    if (req.method !== "POST" || !market) return new Response("not found", { status: 404 });
    await market.publish(next.bytes);
    return new Response(null, { status: 204 });
  },
});

const shutdown = () => {
  control.stop(true);
  for (const m of markets.values()) m.stop();
  for (const p of procs) p.kill("SIGTERM");
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
await Promise.all(procs.map((p) => p.exited));
for (const h of homes) rmSync(h, { recursive: true, force: true });
rmSync(MARKET_STATE_FILE, { force: true });
process.exit(0);
```
`POST /<thème>/__control/publish-next` publie 0.2.0 sur la source du thème ; `GET /` sert à Playwright pour attendre le démarrage.

Dans `e2e/playwright.config.ts`, `webServer` devient un tableau :
```ts
  webServer: [
    {
      command: "bun serve.ts",
      url: "http://127.0.0.1:4390/",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      command: "bun serve-market.ts",
      url: "http://127.0.0.1:4395/",
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
```
Le démarrage des deux démons précède l'écoute du port de contrôle : quand `http://127.0.0.1:4395/` répond, le fichier d'état est écrit. `market.spec.ts` attend en plus la page d'appairage de son démon (`page.goto` échoue sinon, Playwright réessaie dans `expect`).

- [ ] **Step 4: Relancer**

Run: `bun run --cwd packages/ui build && bun run --cwd e2e test`
Expected: PASS pour `mvp.spec.ts` et `market.spec.ts` dans les projets `dark` et `light`. Sous Linux sans bubblewrap utilisable, le test échoue à l'installation (`SANDBOX_UNAVAILABLE`) : c'est voulu, la CI installe bubblewrap (T8).

- [ ] **Step 5: Vérifications**

Run: `bun run check && bun run typecheck`
Expected: aucune erreur (le paquet `e2e` est déjà dans le `typecheck` racine).

- [ ] **Step 6: Commit**

```bash
git add e2e/serve-market.ts e2e/market.spec.ts e2e/market-fixture.ts e2e/playwright.config.ts e2e/package.json bun.lock
git commit -m "test(e2e): parcours marketplace"
```

---

## Jalon v1.0

- [ ] `main` verte en CI sur macOS et Linux : `bun run check`, `bun run typecheck`, `bun test packages components` (dont la propriété de convergence à 200 exécutions, le test `escape` avec isolation OS active, `KIBO_REQUIRE_OS_SANDBOX=1`), E2E sombre et clair (`mvp`, phases 2 à 6, `sync`, `market`), smoke Tauri, build `kibo-sync`.
- [ ] Critères de sortie de la spec G §10 : propriété verte ; scénario à deux utilisateurs vert sur les deux OS ; projets non partagés inchangés (aucune attente de test existante modifiée, vérifié par `git diff v0.6 -- '*.test.ts' '*.test.tsx' '*.spec.ts'` : seuls des ajouts, plus les fixtures complétées par les nouveaux champs `pendingSeq`, `keyLabel`, `sync` (T6) et le texte de pied de l'écran 31 aligné sur sa maquette (T25), deux écarts à citer au rapport) ; écrans S1 à S9 conformes en sombre et en clair.
- [ ] Critères de sortie de la spec H §10 : `escape` vert sur les deux OS ; publication sur la source d'équipe puis installation sur un second démon (T22) ; tous les refus du §4 couverts (T10, T15, T20) ; écrans M1 à M8 conformes en sombre et en clair.
- [ ] Contrôle visuel du chef d'équipe : chaque écran S et M face à son export Penpot, plus les écrans 3, 6, 15, 19, 30 et 31 modifiés ; écarts listés dans le rapport.
- [ ] Contrôle manuel de sécurité (liste dans le rapport) : aucune clé privée dans `kibo.db` ni dans `sync.db` (recherche des préfixes PKCS8 `MC4CAQAw`), fichiers `0600`, démon toujours sur `127.0.0.1` sans accès distant activé, `ws://` vers une IP non loopback refusé.
- [ ] Les décisions nouvelles 1 à 26 sont reportées dans les specs G et H ; `CLAUDE.md` à jour (monorepo, arêtes).
- [ ] Tag `v1.0`, rapport final `docs/superpowers/rapports/<date>-jalon-v1.0.md` : livré par sous-système (G, H, durcissement), écarts (dont la décision 14 si le repli a servi, seccomp reporté), risques (ci-dessous), comptes nécessaires à un usage réel (spec G et H « Comptes et secrets réels »), puis **arrêt** jusqu'à la validation d'Adam.

**Risques à suivre dans le rapport** : `sandbox-exec` déprécié par Apple ; espaces de noms utilisateur restreints sur certaines distributions ; profil macOS sensible aux versions de Bun et de macOS ; option `tls.ca` du client WebSocket de Bun (T3) ; coût de `LoroDoc.fork()` par lot pour les gros projets (T14) ; le serveur lit les données en clair (pas de chiffrement de bout en bout) ; seccomp non livré.

## Couverture des specs

| Exigence | Tâches |
|---|---|
| G §3.1 modèle serveur, `0600` | T11, T14 |
| G §3.2 modèle client | T1 (réglages), T9 (`remote_sessions`), T21 (`sync_config`, `sync_projects`) |
| G §3.3 doc projet (clé nullable, `keyAllocator`, `members`, assignés, domaines) | T6, T7, T23 |
| G §3.4 ce qui ne se synchronise pas | T7 (`folder`), T23 (dialogue, test des secrets), T27 (composant absent) |
| G §4 authentification, appareils, révocation | T2, T11, T17, T21, T28 |
| G §5 clés de ticket | T6, T7, T14, T19, T30 |
| G §6 protocole, rôles, retrait, reconnexion | T4, T17, T18, T21, T23 |
| G §6.1 présence | T24, T30 |
| G §6.2 intégrations (`runner`) | T7, T23, T29 |
| G §7 accès distant, sessions persistées | T9, T13, T25 |
| G §8 chiffrement, opt-in, quotas, audit | T3, T11, T14, T17, T21, T23 |
| G §9 tests (dont e2e à deux) | T7, T11, T14, T17, T19, T21, T23, T24, T31 |
| H §3 `.kpkg`, index, tables client, registre | T5, T10, T15 |
| H §4 confiance et révocation | T10, T15, T20, T26, T27 |
| H §5.1 publier (équipe et statique) | T16, T22, T27 |
| H §5.2 découvrir et installer | T15, T20, T26 |
| H §5.3 mettre à jour | T15, T27 |
| H §5.4 désinstaller (épinglage conservé) | T20 |
| H §5.5 composant absent | T5, T27 |
| H §6 API | T15, T16, T20, T22 |
| H §7 sécurité (validation sandboxée, HTTPS) | T15, T20 |
| H §8 durcissement OS | T8, T12, T25 |
| H §9 tests (dont e2e) | T10, T12, T15, T16, T20, T32 |
