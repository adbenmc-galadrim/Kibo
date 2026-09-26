# Kibo — Spec H : marketplace de composants et durcissement OS du sandbox (phase 7)

- **Date** : 2026-09-26 · **Phase** : 7 (v1.0) · **Statut** : à valider
- **Parent** : `2026-09-25-kibo-design.md` §6, §10, §12 · **Spec B** (`2026-09-26-kibo-composants.md`) : paquet source, empreinte, magasin, registre, confiance, backend · **Spec G** (`2026-09-26-kibo-sync.md`) : comptes et serveur d'équipe · **Maquettes** : écrans 3, 6, 30 (le catalogue marketplace est à dessiner, §10)

## 1. Objectif

Publier, découvrir et installer des composants entre utilisateurs, avec une intégrité vérifiable de bout en bout (on exécute exactement le code publié, qu'on peut relire) ; et donner au backend sandboxé l'isolation réseau et disque **au niveau de l'OS** annoncée par la spec §10.

## 2. Périmètre

- Format de paquet `.kpkg`, signature Ed25519, clés d'éditeur, épinglage.
- Sources de marketplace : index HTTPS statique signé (toute hébergement) et source d'équipe servie par `kibo-sync` (publication par API).
- Découverte (catalogue), installation, mises à jour, révocation, désinstallation.
- Durcissement OS du processus backend sandboxé : bubblewrap (Linux), `sandbox-exec` (macOS).

## 3. Modèle de données

### 3.1 Paquet `.kpkg` (JSON UTF-8)

```ts
export const Kpkg = z.object({
  format: z.literal(1),
  manifest: ComponentManifest,
  files: z.array(z.object({ path: z.string(), sha256: Sha256, content: z.string() /* base64 */ })),   // sources (spec B §3.2), triées
  hash: Sha256,                        // empreinte spec B §3.2, recalculée à l'installation
  publisher: z.object({ name: z.string().min(1).max(64), publicKey: z.string() /* Ed25519 SPKI base64 */ }),
  publishedAt: z.string().datetime(),
  signature: z.string(),               // Ed25519 base64 sur signingPayload(pkg)
});
// signingPayload = "kibo-kpkg-v1\n" + id + "@" + version + "\n" + hash + "\n" + publisher.publicKey + "\n" + publishedAt
```

- **Le paquet contient les sources, pas un build** : Kibo reconstruit localement (spec B §3.3). Raison : ce qui s'exécute est ce qu'on peut relire, et l'empreinte affichée à l'écran 30 est la même que pour un composant local.
- Mêmes règles d'imports que spec B §3.2 (aucune dépendance npm). Taille max : 2 Mio décodés.

### 3.2 Index d'une source

```ts
export const MarketIndex = z.object({
  format: z.literal(1),
  source: z.object({ id: z.string(), name: z.string(), publicKey: z.string() }),
  serial: z.number().int().positive(),            // croissant à chaque publication
  generatedAt: z.string().datetime(),
  publishers: z.array(z.object({ publicKey: z.string(), name: z.string(), verified: z.boolean() })),
  packages: z.array(z.object({
    id: ComponentId, title: z.string(), description: z.string(), kind: ComponentKind,
    versions: z.array(z.object({ version: SemVer, hash: Sha256, publisherKey: z.string(), size: z.number().int(),
                                 permissions: GrantedPermissions, publishedAt: z.string().datetime(), url: z.string() })),
  })),
  revoked: z.array(z.object({ hash: Sha256, reason: z.string() })),
});
```

Servi à `<source>/index.json` avec sa signature détachée `<source>/index.json.sig` (Ed25519 de la clé de source sur les octets exacts du fichier).

### 3.3 Client (local)

```
market_sources(id, url, name, publicKey, lastSerial, lastFetchedAt, enabled)          -- SQLite
market_pins(sourceId, componentId, publisherKey, pinnedAt)                              -- TOFU par composant
```

Registre (spec B §3.4) : `origin: "marketplace"` et `source: { sourceId, publisherKey }` ajoutés à `RegistryVersion`.

Clé privée d'éditeur : `SecretStore` (`market:publisher`), distincte de la clé d'appareil de sync. Raison : publier et se connecter sont deux droits distincts, révocables séparément.

## 4. Confiance

- **Ajout d'une source** (Paramètres › Composants › Sources) : URL HTTPS + empreinte de sa clé publique, affichée et à confirmer (comparaison hors bande conseillée). Aucune source par défaut en v1.0 (§11).
- **Index** : refusé si signature invalide, si `serial` < dernier `serial` vu (anti-rejeu, anti-retour en arrière), ou si `source.publicKey` a changé.
- **Paquet** : refusé si (1) signature invalide, (2) empreinte recalculée ≠ `hash`, (3) `hash` absent de l'index ou révoqué, (4) `publisherKey` ≠ clé épinglée pour ce composant sur cette source (premier install : épinglage, affiché « nouvel éditeur » ; changement ultérieur : refus « la clé de l'éditeur a changé », déblocage explicite par l'utilisateur uniquement).
- **Écran 30** : sous-titre « Publié par <nom> · vérifié par <source> » si `verified`, sinon « Publié par <nom> · éditeur non vérifié » ; empreinte ; permissions ; Sandboxé présélectionné. « Confiance totale » reste possible, avec l'avertissement supplémentaire « Ce code vient d'une marketplace ».
- **Révocation** : à chaque rafraîchissement d'index (au démarrage, puis toutes les 6 h), une version installée dont le `hash` est révoqué passe `trust = null`, ses instances en « Autorisation requise » avec le motif, backend arrêté ; notification système.

## 5. Flux

### 5.1 Publier

1. Menu `⋯` d'un composant utilisateur → « Publier sur la marketplace » (ou `kibo component publish <id> --to <sourceId>`) : validation complète (spec B §7.4), la version ne doit pas exister sur la source.
2. Génération de la clé d'éditeur au premier usage (nom d'éditeur demandé).
3. Construction du `.kpkg` (sources exactes du magasin local pour cette version), signature.
4. Source d'équipe (`kibo-sync`) : `POST /v1/market/packages` authentifié par la session d'appareil (spec G §4), rôle `publisher` ou `owner` sur la source ; le serveur vérifie signature et empreinte, ajoute la version, incrémente `serial`, re-signe l'index avec la clé de source (conservée côté serveur, fichier `0600`).
5. Source statique : `kibo market pack <id>@<version>` produit le `.kpkg` ; `kibo market index --dir <dossier> --key <fichier>` (ou clé du trousseau) régénère et signe `index.json` pour un hébergement quelconque (ex. GitHub Pages).

### 5.2 Découvrir et installer

1. Page Composants, onglet **Marketplace** ; et section « Marketplace » du catalogue de l'écran 3. Recherche locale sur l'index en cache (titre, description, id), filtres par source et par type.
2. Détail : description, versions, éditeur (vérifié ou non), permissions en langage clair, taille, « Voir le code » (aperçu de fichier en lecture des sources du paquet, avant installation).
3. « Installer » : téléchargement (délai 30 s, 2 Mio max), contrôles §4, copie au magasin, build local, suite de conformité, écran 30, puis ajout à la page si on vient de l'écran 3.
4. Échec d'un contrôle : message précis, rien n'est écrit dans le magasin ni le registre.

### 5.3 Mettre à jour

- Au rafraîchissement d'index, les versions plus récentes d'un composant installé apparaissent (« 0.4.0 disponible ») dans la page Composants ; **jamais d'installation automatique**.
- « Mettre à jour » ouvre le dialogue de l'écran 6 (usages, changements, nouvelles permissions, « Mettre à jour partout » / « Créer une nouvelle version ») après les contrôles §4.

### 5.4 Désinstaller

Possible seulement sans usage ; supprime le magasin de cette version et l'entrée du registre ; conserve l'épinglage de l'éditeur.

### 5.5 Projets partagés (lien avec la spec G)

Une instance d'un composant absent localement affiche « Composant absent : id@x.y.z » avec « Installer » si une source connue le propose (même empreinte exigée), sinon « Demande à <membre> de le publier sur la marketplace d'équipe ».

## 6. API

- Source (HTTP, lecture) : `GET /index.json`, `GET /index.json.sig`, `GET /packages/<id>/<version>.kpkg`.
- `kibo-sync` (écriture) : `POST /v1/market/packages` (corps : `.kpkg`), `POST /v1/market/revoke { hash, reason }` (`owner` de la source ou éditeur du paquet), `kibo-sync market init` (clé de source), `kibo-sync market grant <userId> publisher`.
- RPC démon : `listMarketSources`, `addMarketSource { url, publicKey }`, `removeMarketSource { id }`, `refreshMarket`, `searchMarket { query, sourceId? }`, `getMarketPackage { sourceId, id, version }` (sources incluses pour « Voir le code »), `installFromMarket { sourceId, id, version }` → `{ hash, preview }` puis approbation par `approveComponent` (spec B), `publishToMarket { id, version, sourceId }`, `unpinPublisher { sourceId, componentId }` (confirmation requise).
- Nouveaux codes : `SIGNATURE_INVALID`, `PUBLISHER_CHANGED`, `REVOKED`, `INDEX_ROLLBACK`.

## 7. Sécurité (marketplace)

- Chaîne : clé de source → index signé (serial) → hash du paquet → signature de l'éditeur épinglé → empreinte recalculée → build local depuis ces sources → approbation utilisateur de ce hash.
- Le paquet ne contient pas les tests de l'éditeur (exclus de l'empreinte, spec B §3.2) ; à l'installation, Kibo exécute typecheck, build et **sa propre** suite de conformité générique, dans le bac à sable OS du §8 (sans réseau, disque en lecture seule sur le paquet). Aucun autre code du paquet ne s'exécute avant l'approbation.
- Pas de dépendances, pas de script d'installation.
- Téléchargements en HTTPS seulement (sauf loopback en test), redirections limitées au même hôte.

## 8. Durcissement OS du backend sandboxé

Livré dès la phase 4 (spec B, décision 24) pour `ProcessHost` et les tests de la validation. Restent en phase 7 : le réglage « Autoriser les backends sandboxés sans isolation OS », l'écran 19, le filtre seccomp, et l'exécution des tests d'installation du marketplace dans ce bac à sable.

Le `ProcessHost` (spec B §4.4) lance désormais le runtime dans un bac à sable de l'OS. Les protections de la phase 4 (retrait des capacités, imports refusés) restent en place.

### 8.1 Linux : bubblewrap

```
bwrap --unshare-all --die-with-parent --new-session --cap-drop ALL \
      --ro-bind <runtime binaire> /kibo/runtime \
      --ro-bind <store>/<id>/<version>/<hash>/build /kibo/component \
      --ro-bind /usr /usr --ro-bind-try /lib /lib --ro-bind-try /lib64 /lib64 \
      --proc /proc --dev /dev --tmpfs /tmp --chdir /tmp \
      --clearenv --setenv KIBO_COMPONENT <id>@<version> \
      -- /kibo/runtime component-runtime
```

- `--unshare-all` retire le réseau (namespace sans interface) ; seuls le binaire, le build du composant et les bibliothèques système en lecture sont visibles ; `/tmp` en mémoire ; IPC par stdin/stdout.
- Filtre seccomp additionnel (`--seccomp <fd>`) interdisant `ptrace`, `mount`, `keyctl`, `bpf`, `perf_event_open` : **à valider** (nécessite de générer le programme BPF ; si trop coûteux, reporté après v1.0 et noté).
- `bwrap` absent ou espaces de noms utilisateur interdits (ex. Ubuntu 24.04 avec `kernel.apparmor_restrict_unprivileged_userns=1`) : **les backends sandboxés ne démarrent pas** (`SANDBOX_UNAVAILABLE`, explication et commande d'installation dans l'écran 19 et la page Composants). L'UI sandboxée continue de fonctionner. Un réglage « Autoriser les backends sandboxés sans isolation OS » existe dans Paramètres › Sécurité, désactivé par défaut, avec avertissement.
- Landlock : non retenu en v1.0. Raison : il faudrait appeler les syscalls Landlock depuis un binaire dédié (le runtime Bun ne les expose pas), bubblewrap couvre réseau et disque.

### 8.2 macOS : `sandbox-exec`

Profil SBPL généré par le démon (`packages/daemon/src/sandbox/macos.sb.ts`) :

```
(version 1)
(deny default)
(allow process-exec (literal "<runtime>"))
(allow file-read* (subpath "<store>/<id>/<version>/<hash>/build") (literal "<runtime>")
       (subpath "/usr/lib") (subpath "/System/Library") (subpath "/private/var/db/dyld") (literal "/dev/urandom"))
(allow file-read-metadata)
(allow file-write* (subpath "<tmp propre au processus>"))
(allow sysctl-read) (allow mach-lookup (global-name "com.apple.system.logger"))
(deny network*)
```

- Ajustements du profil pilotés par les tests (§9) : Bun peut exiger d'autres lectures (`/private/etc`, fuseaux horaires) ; chaque ajout est commenté et testé.
- `sandbox-exec` est déprécié par Apple mais présent et fonctionnel ; risque de retrait noté (§12). Si la commande échoue au démarrage : même comportement que `bwrap` absent.

### 8.3 Ce que le durcissement garantit

| Tentative depuis `server.js` | Phase 4 | Phase 7 |
|---|---|---|
| Connexion réseau | bloqué par l'OS (décision 24) | bloquée par l'OS |
| Lecture de `~/.kibo/token`, `~/.ssh` | bloqué par l'OS (décision 24) | bloquée par l'OS |
| Écriture hors `/tmp` du processus | bloqué par l'OS (décision 24) | bloquée par l'OS |
| Lancement d'un processus | bloqué par l'OS (décision 24) | bloqué par l'OS |

## 9. Tests

| Niveau | Cas |
|---|---|
| paquets | signature valide / altérée ; fichier modifié ⇒ empreinte ≠ `hash` ; clé d'éditeur changée ⇒ `PUBLISHER_CHANGED` ; paquet révoqué ⇒ refus puis désactivation d'une version installée ; index à `serial` inférieur ⇒ `INDEX_ROLLBACK` ; index signé par une autre clé ⇒ refus |
| faux source | `packages/daemon/src/testing/fake-market.ts` (Bun.serve) : index, signature, paquets, manipulables par le test |
| `kibo-sync` | publication (rôle requis), re-signature de l'index, révocation |
| install | installation complète vers écran 30 avec la fausse source ; « Voir le code » ; échec ⇒ magasin et registre intacts |
| durcissement | composant fixture `escape` dont les actions tentent : `fetch`, socket TCP via une API restante, lecture de `$HOME/.kibo/token` (fichier factice), écriture dans `$HOME`, `Bun.spawn` ⇒ toutes échouent ; même composant sans durcissement (réglage) ⇒ au moins les tentatives neutralisées par la phase 4 échouent |
| CI Linux | job qui installe `bubblewrap` et exécute `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` si nécessaire ; test `SANDBOX_UNAVAILABLE` quand `bwrap` est absent (PATH simulé) |
| CI macOS | profil `sandbox-exec` exercé par le test `escape` |
| e2e | onglet Marketplace (sombre et clair) : recherche, détail, installation, mise à jour via l'écran 6 |

## 10. Critères de sortie

- Le test `escape` passe sur macOS et Linux en CI avec le durcissement actif.
- Publication sur la source d'équipe puis installation sur un second démon (même CI) avec vérification complète.
- Tous les refus du §4 couverts par des tests verts.
- Écrans marketplace conformes à leurs maquettes (à dessiner : onglet Marketplace, détail d'un paquet, sources, paquet révoqué, « Composant absent », éditeur non vérifié, backend indisponible faute de sandbox OS), en sombre et en clair.

## 11. Hors périmètre

- Marketplace publique officielle hébergée par Kibo (demande hébergement, domaine et clé de source d'Adam) : le format et l'outillage statique la permettent, la mise en ligne est une décision à part.
- Paiement, notes et avis, statistiques de téléchargement.
- Dépendances npm dans les composants ; paquets binaires.
- Landlock, seccomp complet (si non validé), isolation de l'UI au-delà de l'iframe (déjà en place).
- Templates de projet sur la marketplace (spec §3 H « templates ») : format à définir dans une spec ultérieure.

## 12. Risques

- `sandbox-exec` déprécié : un retrait par Apple casserait le durcissement macOS (repli : backends sandboxés désactivés).
- Espaces de noms utilisateur restreints par défaut sur certaines distributions : les utilisateurs devront installer ou autoriser `bwrap`.
- Profil macOS minimal difficile à stabiliser selon les versions de Bun et de macOS.

## 13. Décisions d'implémentation (plan de phase 7)

Reprises du plan `docs/superpowers/plans/2026-09-26-kibo-sync-marketplace.md` (« Décisions nouvelles »), recalées sur le code de v0.6 par la tâche 0 ; la numérotation (D1 à D41) est celle du plan, les décisions qui relèvent de la sync sont dans la spec G §13. Le filtre seccomp de §8.1 (« à valider ») est reporté après v1.0 (D14).

- **D1** · **Paquet `packages/trust`** (WebCrypto et Zod, sans I/O) : Ed25519, codes, empreinte canonique des sources (spec B §3.2), X.509, `.kpkg`, index signés, signature des requêtes HTTP. `packages/devkit` y délègue `hashSources` pour qu'il n'existe qu'une implémentation de l'empreinte. Arêtes : `schema ← trust ← {devkit, daemon, sync-server, cli}` et `schema ← core ← sync-server`.
- **D5** · **Requêtes HTTP de la marketplace d'équipe** (`POST /v1/market/*`) signées par la clé d'appareil : en-têtes `x-kibo-device`, `x-kibo-date`, `x-kibo-nonce`, `x-kibo-signature` sur `"kibo-http-v1\n" + méthode + "\n" + chemin + "\n" + date + "\n" + nonce + "\n" + sha256(corps)` ; écart d'horloge ≤ 5 min ; nonce refusé s'il a servi dans les 10 dernières minutes.
- **D11** · **`Instance.componentHash`** (optionnel, `null` pour les intégrés) : écrit par le démon à l'ajout ou à la mise à jour d'une instance non intégrée ; c'est « la même empreinte » exigée par spec H §5.5 pour installer un composant absent.
- **D12** · **`RegistryVersion.source` et `RegistryVersion.revoked`** (`{ reason, at } | null`) pour afficher le motif de révocation (spec H §4).
- **D13** · **Ajout d'une source en deux temps** : `probeMarketSource { url }` lit l'index, vérifie sa signature avec la clé qu'il annonce et renvoie nom et empreinte ; l'utilisateur compare hors bande puis confirme `addMarketSource { url, publicKey }`.
- **D14** · **Isolation Linux** : sans objet en phase 7, livrée en phase 4 (spec B décision 24) avec des montages déjà minimaux (`/usr/lib`, `/lib`… jamais tout `/usr`) et le lancement de processus déjà bloqué (test `exit.test.ts`). T8 n'ajoute que le diagnostic (`diagnose()` : type, raison, commande de correction). Le filtre seccomp (spec H §8.1, « à valider ») est **reporté après v1.0**.
- **D15** · **Profil macOS sans commentaires dans le code** : chaque règle ajoutée est une donnée `{ rule, reason }` ; le générateur émet `reason` en ligne `;` dans le SBPL produit.
- **D16** · **Validation à l'installation** : `validateComponent` exécute déjà les tests dans le bac à sable OS (phase 4) ; T20 ajoute seulement `conformanceOnly` (la suite générique de Kibo remplace les tests de l'éditeur, ni fournis ni exécutés). Une installation marketplace **n'utilise jamais** le réglage « sans isolation OS » : sans bac à sable utilisable, elle échoue en `SANDBOX_UNAVAILABLE` avant toute écriture.
- **D23** · **Canal du backend par lignes JSON** : sans objet, livré en phase 4 (spec B décision 25, descripteurs 3 et 4).
- **D24** · **Un paquet de marketplace demande toujours l'approbation de son empreinte** (écran 30 à chaque installation et mise à jour) : l'héritage de confiance de spec B §7.2 point 4 ne vaut que pour les composants de l'utilisateur. Raison : le code vient d'un tiers et son empreinte change à chaque version (T20).
- **D34** · **Version révoquée** : ne peut pas être réapprouvée (`approveComponent` refuse une version dont `revoked` n'est pas `null`, T20) ; on installe une autre version.
- **D35** · **Source d'équipe** : une source de marketplace est « d'équipe » (publication possible, écran M8) quand son URL est `<origine HTTPS du serveur de sync>/market/` (décision 21) ; aucune autre source n'accepte de publication depuis l'UI.
- **D40** · **Garde-fous des sources de marketplace dans le démon** (choix du chef d'équipe, T15) : supprimer une source conserve ses épinglages d'éditeur (`market_pins`), si bien qu'un changement de clé d'éditeur reste détecté (`PUBLISHER_CHANGED`) quand la source revient ; `probeMarketSource` et `removeMarketSource` sont réservées aux sessions locales, comme `addMarketSource` et `unpinPublisher` ; les erreurs réseau renvoyées au client restent génériques (ni hôte ni port), le détail va au journal du démon ; une URL de source mal formée ou portant un identifiant ou un mot de passe est refusée en `INVALID_INPUT`, au sondage comme à l'ajout ; l'URL d'un paquet doit avoir la même origine que sa source (§6), sinon `INVALID_INPUT` avant tout téléchargement. La numérotation reste celle du plan : D36 à D39 relèvent de la spec G.
- **D41** · **Preuve de possession de la clé d'éditeur** (sécurité, choix du chef d'équipe) : sur une source d'équipe (`kibo-sync`), le premier enregistrement d'une clé d'éditeur exige une signature de cette clé sur `"kibo-publisher-claim-v1\n" + sourceId + "\n" + userId` (`userId` du compte qui publie), jointe à `POST /v1/market/packages` dans l'en-tête `x-kibo-publisher-claim` ; absente ou invalide ⇒ `SIGNATURE_INVALID`. Une clé déjà enregistrée n'en demande plus ; elle reste liée à ce compte et à son nom d'éditeur, figé à la première publication (texte visible uniquement, NFC, sans blanc de bord ni double blanc ; refusés : catégories `Cc`, `Cf`, `Co`, `Cn`, `Cs`, `Zl`, `Zp` et les blancs invisibles U+00AD, U+034F, U+115F-1160, U+17B4-17B5, U+180B-180F, U+200B-200F, U+202A-202E, U+2060-206F, U+2800, U+3164, U+FE00-FE0F, U+FEFF, U+FFA0, U+E0000-E0FFF ; les marques combinantes visibles restent admises ; un nom qui contient une lettre latine ne contient que des caractères d'écriture latine, commune ou héritée). Les motifs de révocation suivent les mêmes règles de texte, sans la règle d'écritures. Risque accepté : les homoglyphes d'une seule écriture et le squelette de confusion UTS #39 ne sont pas traités. Raison : sans cette preuve, un membre `publisher` pourrait téléverser un `.kpkg` signé par la clé d'un autre, copié d'une autre source, et s'approprier cette clé et ce nom sur la source.
- **D43** · **Installation marketplace réservée aux sessions locales** (choix du chef d'équipe, T20) : `installFromMarket` exige une session locale (`requireLocal`, comme `addMarketSource`) ; une session distante reçoit `FORBIDDEN`. Raison : installer du code tiers sur la machine est une action locale, et la surface distante reste limitée. L'épinglage de l'éditeur est écrit avant l'entrée au registre et retiré si celle-ci échoue.

## Comptes et secrets réels

Aucun pour la CI (fausse source, clés de test générées à la volée). Une marketplace réelle demande à Adam : un hébergement HTTPS (source statique ou serveur `kibo-sync`), et la garde de la clé privée de source.
