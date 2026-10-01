# Kibo · Finitions UI/UX, vague 4 (phase 9, v1.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer les deux derniers lots du plan d'action UI/UX avant le jalon `v1.1.0` : le **tableau de bord éditable et les formats de composant** (cinq formats nommés déclarés par le manifeste, commande `setInstanceLayout` bornée à la grille et contrôlée par le serveur de sync, mode « Modifier la disposition » avec dnd-kit, grille adaptative, conformité qui rend chaque format : lot 5) ; puis la **création de composants par l'IA** (brouillons multiples en arrière-plan dans la file d'attente, images jointes hors CRDT, écran « Créations » et indicateur d'en-tête, aperçu du brouillon validé dans le bac à sable avec données simulées et retour à l'agent, contexte enrichi de l'agent, validation par format et sans largeur fixe, dialogues bornés : lot 9), en ouvrant par une tâche budget et sans consommer un token.

**Architecture:** le schéma gagne `ComponentFormat` (cinq formats, tailles en cellules), `manifest.formats` et `setInstanceLayout` ; le core refuse toute disposition hors grille, hors format ou qui chevauche, et `validateProjectUpdate` (donc le serveur de sync, par `room.ts:215`) contrôle les instances écrites. Le SDK expose `sdk.format`, le SDK simulé et la conformité rendent chaque format, le devkit refuse les largeurs fixes. L'interface rend la grille avec résolution déterministe des chevauchements et une colonne sous `lg`, et charge le mode disposition à la demande. Côté IA, rien ne change au cycle d'un brouillon : les images vivent dans un dossier frère du brouillon (jamais dans le dossier ni dans un CRDT), `reviseComponentDraft` relance la même session, `previewComponentDraft` construit le bundle sandbox du brouillon dans `.kibo/preview/<hash>/` servi par le listener sandbox, et l'hôte répond à l'iframe avec le SDK simulé. L'écran Créations et l'indicateur lisent `listComponentDrafts`, `draft.changed` et l'état des runs. Aucune dépendance nouvelle.

**Tech Stack:** Bun 1.4.2, TypeScript 5.9 strict, Zod 3.25.76, loro-crdt, bun:sqlite, React 19 + shadcn/ui (`packages/sdk/src/ui` : `tabs`, `toggle-group`, `checkbox`, `collapsible`, `confirm-dialog`, `dropdown-menu`, `sheet`, `skeleton` déjà présents), `@dnd-kit/core` 6.3.1 (déjà présent : `TabBar.tsx:1`, `Kanban.tsx:1-10`), Tailwind 4 (requêtes de conteneur natives, `index.css:1`), fast-check, happy-dom 18 + Testing Library, Playwright 1.55, faux binaire `claude` (`packages/daemon/src/agents/fake-claude.ts`).

**Spec:** `docs/superpowers/specs/2026-09-25-kibo-design.md` **§16** (écrit avec ce plan : 16.1 formats, 16.2 `setInstanceLayout` et mode disposition, 16.3 créations, 16.4 dialogues bornés, 16.5 ports et écrans), §11 (ports E2E), §14.2 (bornes des images), §15.2 (confirmations) ; `docs/superpowers/specs/2026-09-26-kibo-composants.md` **§17** (manifeste `formats`, SDK `format`, composants intégrés, conformité et largeurs fixes, aperçu d'un brouillon), §3.5, §3.6, §4.2, §7.4 ; `docs/superpowers/specs/2026-09-26-kibo-ia.md` **§13** (brouillons en arrière-plan, Créations, indicateur, images, formats, aperçu et révision, contexte, RPC, faux `claude`), §4.2, §5.2, §12 (I16, I21, I26, I39, I43, I46) ; `docs/superpowers/specs/2026-09-26-kibo-sync.md` **D48** (instances contrôlées), D8, D30 ; `docs/superpowers/specs/2026-09-26-kibo-agents.md` **§12** (profil générateur). Plan d'action : `docs/superpowers/plans/2026-09-27-kibo-plan-action-ui-ux.md` (lots 5 et 9). Repérage : `docs/superpowers/rapports/2026-09-27-reperage-ui-ux.md` (section A bis, points 11 à 14). Rapport de la vague 3 (mineures à caser) : `docs/superpowers/rapports/2026-10-01-phase-9-vague-3.md`. Plans des vagues précédentes (forme et contrats hérités) : `docs/superpowers/plans/2026-10-01-kibo-phase-9-vague-3.md`. Données des maquettes : `design/donnees-fictives.md`.

## Points pour Adam (défaut retenu en attendant)

Ces points sont écrits dans la spec avec leur défaut ; le plan les applique tels quels. Une réponse différente d'Adam change la tâche indiquée, rien d'autre.

| # | Question | Défaut retenu (spec) | Tâches concernées |
|---|---|---|---|
| A11 | Les **cinq formats** (petit 3 × 3, moyen 6 × 3, large 6 × 6, demi-page 12 × 6, plein écran 12 × 9) et leurs tailles en cellules | La table de §16.1 | T46 (`FORMAT_SIZES`, `FORMAT_PREFERENCE`), T47 (manifestes intégrés, libellés du SDK), T48 (libellés `fr-layout.ts`), T51 (table du skill de l'agent) : **seules ces quatre constantes et listes changent** si la liste change |
| A12 | « Plein écran » sur un **tableau de bord** = 12 × 9 (≈ 850 px de haut) ; sur une page vue = toute la page | 12 × 9 (§16.1) | T46 |
| A13 | Grille **étroite** (< 1024 px) : une seule colonne dans l'ordre de lecture, mode disposition réservé au large | Une colonne, mode à partir de `lg` (§16.1) | T48 |
| A14 | Chevauchement de deux widgets (édition hors ligne concurrente) : **non refusé** par le serveur, résolu au rendu | Résolution déterministe au rendu (D48, §16.1) | T46 (`validate-instances.ts`), T48 (`resolveOverlaps`) |
| A15 | Mode disposition avec **brouillon local** (Enregistrer / Annuler) plutôt qu'application immédiate de chaque geste | Brouillon local (§16.2) | T48 |
| A16 | Profil `generateur` : **2 runs en parallèle** par défaut, `maxParallel` modifiable (1 à 4) | 2, modifiable (IA §13.1, agents §12) | T50 (core), T53 (fiche du profil) |
| A17 | Images jointes : **4 au plus, 256 kB chacune**, PNG/JPEG/WebP (bornes de `setIcon`) | 4 × 256 kB (IA §13.4) | T50 (`MAX_DRAFT_ATTACHMENTS`), T52 (refus côté interface) |
| A18 | Révisions après aperçu : **10 par brouillon**, chaque révision redonne 3 tentatives de correction | 10, `attempts` remis à 1 (IA §13.6) | T50 (`MAX_DRAFT_REVISIONS`, machine) |
| A19 | L'aperçu d'un brouillon montre des **données simulées** (jeu `seedDemo` du SDK), jamais le projet réel | Simulées (composants §17.5) | T54 |
| A20 | Formats d'un composant généré : **cases à cocher** préremplies selon le type, ou tous les formats d'office | Cases préremplies (IA §13.5) | T52 |
| A21 | Écran Créations sans entrée dans la **barre latérale** (en-tête, page Composants, palette suffisent) | Pas d'entrée (IA §13.2) | T53 |
| A22 | L'aperçu d'un brouillon a besoin de **WebAssembly** pour ses données de démonstration : politique à part pour le seul worker de l'aperçu, ou WebAssembly autorisé pour toute l'interface | Politique à part pour le worker ; la CSP du document ne change pas (composants §17, point 6) | T54 |

## Vérifié sur le code (`phase/9` = `001e4c5`, vagues 1 à 3 intégrées)

Le plan d'action et le repérage citaient des noms de mémoire ; tout a été confronté au code. Colonne « Réel » : ce qui fait foi pour toutes les tâches.

| Besoin | Supposé | Réel (vérifié) |
|---|---|---|
| Budget UI | 220,1 kB | **220,1 kB** gzip (rapport de la vague 3), plafond `ENTRY_GZIP_BUDGET = 230_000` (`packages/ui/scripts/bundle-report.ts:21`), 33 motifs dans `FORBIDDEN_IN_ENTRY` (l. 23-56). Les deux replis « connus » sont **déjà faits** par T29 : `ProjectHeaderMenu` et `project-menu.ts` (l. 46), `TabMenuContent` (l. 45). Repli disponible : `InstanceMenu.tsx` (175 l.) est dans l'entrée par `PageView.tsx:13` et tire `dropdown-menu`, `config-form`, `trust-target`, `components-page/rows` ; son contenu peut se charger à l'ouverture (≈ −0,8 kB). |
| Disposition des widgets | `instanceLayout` ? | `Instance.layout: { x, y, w, h }` entiers (`packages/schema/src/instance.ts:6-12`), stocké en **valeur simple** dans la `LoroMap` `instances` (`packages/core/src/instances.ts:45`, `set(id, parsed.data)` : dernière écriture gagnante par instance) ; défaut du core `{ 0, 0, 12, 6 }` (l. 6), de l'interface `6 × 6` à la première place libre (`packages/ui/src/lib/next-layout.ts:3-16`, `COLUMNS = 12`) ; rendu `grid-cols-12 auto-rows-[80px] gap-4` avec `gridColumn`/`gridRow` (`packages/ui/src/pages/PageView.tsx:94-102`) ; **aucune commande** de déplacement (`packages/schema/src/command.ts:52-60, 76-95` : `addInstance { layout? }`, `setInstanceComponent`, `setInstanceConfig`, `setInstanceData`) ; `COMMAND_WRITES` l. 108-117, `CommandResult` l. 135-144 ; commandes réservées au shell dans `packages/core/src/commands.ts:99-100` (`assertShellCommand`, appelé par `packages/daemon/src/projects/project-rpc.ts:74`). Retrait d'un widget **déjà confirmé** (`packages/ui/src/pages/InstanceMenu.tsx:146-157`). |
| `Surface` | format | `Surface = "widget" \| "view"` (`packages/schema/src/protocol.ts:8`), dans `SdkContext` (`packages/sdk/src/types.ts:69, 103`), passé par `InstanceFrame` (`packages/ui/src/pages/InstanceFrame.tsx:32, 54`) et par le message `init` de l'iframe (`protocol.ts:38-47`, `SandboxFrame.tsx:68-74`, `createFrameSdk` `sandbox.tsx:95-99`) ; simulé par `createMockSdk(manifest, { surface })` (`mock.ts:55, 224`). Aucun composant intégré ne lit `surface` (`grep -rn surface components/*/src/*.tsx` vide) ; la seule requête de conteneur est `@container` dans `TicketsTree.tsx:139` et `card.tsx:22`. |
| Manifeste | `formats` | Absent : `ComponentManifest` est un `z.object` (`packages/schema/src/manifest.ts:17-47`) dont d'autres modules lisent `.shape` (`ai.ts:35`) et `.pick` (`daemon/components/asset-path.ts:12`) : **pas de `superRefine`** sur l'objet (il perdrait `.shape`). `kind` = `widget \| view \| both \| adapter` (l. 14). Manifestes intégrés sans `formats` : kanban/tickets/graph/notes `both`, mcp-source `widget`, github-issues `adapter` (`components/*/kibo.component.json`). |
| `DataKey` | — | `^[A-Za-z0-9._-]{1,128}$`, `INSTANCE_DATA_LIMIT = 262_144` (`instance.ts:23-24`) ; inchangés. |
| Serveur de sync | valide les commandes | Le serveur ne voit pas les commandes : il valide chaque `push` par `validateProjectUpdate(before, after, actor)` (`packages/sync-server/src/room.ts:215`) et le premier snapshot par `validateSharedSnapshot` (l. 84), tous deux dans `packages/core/src/validate-update.ts:87-98` et `validate-snapshot.ts` ; **aucun contrôle des instances** aujourd'hui (`grep -n instances validate-update.ts` vide). D'où D48 : ajouter `instancesUpdateViolation` et `instancesSnapshotViolation` dans le core suffit, le serveur les applique sans changer. |
| Suite de conformité | par format | `runConformance(mod, seed?, opts)` (`packages/sdk/src/conformance.tsx:45-110`) boucle sur `surfaces` dérivées de `kind` (l. 62-63) × thèmes × trois projets, imprime `USED_MARKER` et vérifie `used ⊆ declared`. `createMockSdk` (`mock.ts:85`, 315 l.) construit un `ProjectBackend` interne avec `call: handle` (l. 142-212) non exposé. `mountDev` (`dev.tsx:16-60`) a un sélecteur de surface et de thème. |
| Bac à sable | aperçu | Listener séparé `startSandboxServer` (`packages/daemon/src/components/sandbox-server.ts:42-70`) : `parseAssetPath(pathname, "c", SANDBOX_FILES)` exige `/c/<id>/<version semver>/<sha256>/<fichier>` (`asset-path.ts:14-27`), `lookupAsset` lit le magasin ; `SANDBOX_INDEX` l. 6 ; en-têtes `sandboxHeaders` l. 17. Hôte : `SandboxFrame.tsx` (`createFrameBridge({ frame, init, call, onOpen…, onResize, onReady })`, `frame-bridge.ts:15-27`, `createLoadGuard`). `buildComponent(srcDir, toolchain)` ⇒ `{ manifest, files: { "ui.sandbox.js", "ui.css", … } }` (`packages/devkit/src/build.ts:12-13, 80`). Le dossier `.kibo/` d'un brouillon est ignoré par l'empreinte, le diff et la restauration (`draft-fs.ts:7`, IA I26). |
| Brouillons IA | un seul, modal | Démon : table `component_drafts` avec index unique **par composant actif** (`draft-store.ts:98-99`), donc plusieurs brouillons coexistent déjà ; chaque brouillon est un run `generateur` soumis à l'orchestrateur (`draft-lifecycle.ts:154-162` → `runsFromOrchestrator` `adapters.ts:104-118` → `Orchestrator.submit` `orchestrator.ts:204-224`) : file, créneaux et seuils s'appliquent. Machine : `draft-machine.ts:40-91` (événements `enqueued`, `run_ended`, `restored`, `validation_started`, `validated`, `validation_crashed`, `config_changed`, `reviewed`, `finalized`, `abandoned`, `interrupted`), `MAX_DRAFT_ATTEMPTS = 3` (`schema/ai.ts:60`). Fichiers : `draftPaths(home, id)` = `components/drafts/<id>` et `<id>.base` (`draft-files.ts:35-38`), `prepareDraft` refuse un dossier présent (l. 65), `verifyAndRestore` (l. 161-173) restaure tout fichier Kibo, `agentFiles` (l. 175-182), `removeDraft` (l. 232-238). Garde-fou : `createDraftGuard({ draftDir, readRoots, allowServer })` (`draft-guard.ts:61-130`) : `Read` limité à `readRoots` (l. 79-84), `..` refusé (`pathArg` l. 39-42), chemin absolu accepté s'il est sous une racine. Prompt : `generatorPrompt` (`prompts.ts:77-92`), `fixPrompt` (l. 96-117), `SKILL` (l. 119-145), `draftKiboFiles` (l. 147-159) : ni formats, ni exemple, ni jetons. Profil `generateur` : `maxParallel: 1`, `SYSTEM_EDITABLE = model, enabled` (`packages/core/src/agent-profiles.ts:20-24, 49-67`). RPC : `AI_RPC` (`schema/ai-rpc.ts:16-29`), routage `methods.ts:34-71`, assemblage `bootstrap.ts:111-168` (`lifecycle`, `publisher`, `devkitPort` `live-ports.ts:28-55` qui écrit `title` dans le manifeste du brouillon l. 41). Publication : `details` (`draft-publish.ts:154-164`, `diff`, `manifest`, `publish` visibles en `review`/`permissions`), `finalize` (l. 198-232). UI : `CreateComponentDialog` (104 l., `draftId` local, `ResumeDraftBanner` = premier brouillon inachevé `DescribeCard.tsx:158-181`), `AiDraftPanel` (164 l.), `DescribeCard` (181 l., texte seul), `DraftStepper`, `use-component-draft.ts` (`subscribeAi` `draft.changed`), `ModifyWithAiDialog` (160 l.). `ComponentsPage.tsx:213` monte déjà `CreateComponentDialog open={creating} target={null}` (T34). |
| Images | `setIcon` | `IconInput { mime, data }` (`schema/icon.ts:9-16`, `MAX_ICON_BYTES = 256 kB`, `MAX_ICON_BASE64 = 350_000`), signature vérifiée par `decodeIcon` (`packages/daemon/src/icons/decode-icon.ts`, utilisé par `projects/admin.ts:111`), lecture côté interface `readIconFile` (`packages/ui/src/dialogs/icon-file.ts:33-40`, `sniffIconMime`). Réutilisés tels quels pour les pièces jointes. |
| Dialogues | hauteur libre | `DialogContent` sans `max-h` ni `overflow` (`packages/sdk/src/ui/dialog.tsx:63-64`) ; `cn` passe par tailwind-merge (une classe locale l'emporte). |
| En-tête | — | `ShellHeader.tsx` (90 l.) : `ScreenActions`, `ShareButton`, « Ticket », `RunHistoryButton` (cloche, `shell/RunHistoryButton.tsx`), `UserMenu`. `Screen` enum (`schema/tabs.ts:8-23`, 14 valeurs), `SCREENS` (`packages/ui/src/tabs/screens.ts`), `ScreenView.tsx` (97 l.), écrans chargés par `lazy-screens.ts`. `Shell.tsx` **301 l.** : aucune tâche de cette vague ne le touche (l'indicateur vit dans `ShellHeader`). |
| Journal d'un run | — | `useRunLog(runId)` ⇒ `{ log, missing }` (`packages/ui/src/state/use-agents.ts:51`), `missing` vrai sur `NOT_FOUND` **et** sur liste vide (mineure « `missing` vrai pour un run tout juste lancé »). `RunJournal({ label, log, files })`. |
| Faux `claude` | scénarios | `FakeStep` (`fake-claude-scenario.ts:6-17` : `hook`, `sleepMs`, `hold`, `stderr`, `write { fixture }`), `FakeTurn.result`, routes par préfixe de prompt (`e2e-routes.json`), un scénario = plusieurs tours (`turns`) rejoués à chaque `--resume` ; `generate-ok.json` écrit `burndown/ui.tsx.fixture`. Env du run : `PATH` et `KIBO_TOOLCHAIN` (`bootstrap.ts:139`). |
| Tests UI | helpers | `mock.module("../api", …)` une seule fois par fichier puis `await import` (modèles : `pages/page-view.test.tsx:1-20`, `pages/instance.test.tsx:1-30`, `ai/ai-dialog.test.tsx:1-45` avec `answer` réassignable) ; composants avec `createMockSdk` et `runConformance`. |
| Tests démon | — | `ai/generation.int.test.ts` (174 l., faux `claude` de bout en bout), `draft-lifecycle*.test.ts`, `draft-guard.test.ts`, `sandbox-server` testé dans `components/`. Serveur : `packages/sync-server/src/room.test.ts`. |
| E2E | ports | 4390–4422 pris (`e2e/playwright.config.ts:5-45`) ; ce plan prend **4423–4426** ; `ia.spec.ts` (ports 4404-4405, scénario `ai/e2e-routes`) couvre déjà la création jusqu'au rendu sandboxé ; `serve.ts` lance le démon avec `--claude-bin fake-claude.ts` et le scénario. Aucun script `gate.sh` dans le dépôt : la gate locale du chef d'équipe vérifie la plage §11 à la main. |
| Penpot | écran libre | Dernier écran scripté : 106 ; 107 à 126 décrits textuellement (vagues 2 et 3). Ce plan prend **127 à 135**, décrits ci-dessous. |

## Global Constraints

- Bun **1.4.2**, dépendances figées par `bun.lock`, aucun `postinstall`, **aucune dépendance nouvelle** (dnd-kit, fast-check, Tailwind 4 sont présents).
- **Aucun commentaire dans le code** ; code, identifiants et messages d'erreur internes en anglais ; textes d'interface en français, tutoiement, sans jargon. Un texte nouveau d'un module chargé à la demande vit dans son `i18n/fr-<sujet>.ts` importé directement : `fr-layout.ts` (T48, mode disposition), `fr-creations.ts` (T52, T53, T54 : pièces jointes, formats, Créations, aperçu, révision) ; ce qui entre dans l'entrée (un bouton, une entrée d'écran) va dans `fr.ts` (`page.editLayout`, `nav.creations`, `header.creations`) et reste de quelques mots.
- **Budget de 230 kB jamais relevé** : T45 ouvre la vague, mesure (attendu 220,1 kB), exécute le repli `InstanceMenuContent` et fixe l'exigence de fin de vague **≤ 222,0 kB** ; tout écran, dialogue, éditeur, aperçu ou contenu de menu nouveau est chargé à la demande et **ajouté à `FORBIDDEN_IN_ENTRY` par T45 d'avance** ; `@kibo/sdk/mock` et `@kibo/sdk/fixtures` (core + loro) n'entrent jamais dans l'entrée ; chaque tâche UI note sa mesure `bun run budget` dans son rapport ; le chef d'équipe la relance après chaque intégration et refuse une tâche qui dépasse 222,0 kB.
- **Pas de taille libre** : toute disposition écrite est la taille d'un format (`isFormatLayout`), dans la grille ; l'interface ne propose que les formats déclarés (`formatsOf`).
- **Zéro token** : l'état d'un brouillon vient de la machine (`draft.changed`) et des runs ; aucun test ne lance un vrai `claude` (faux binaire, scénarios dans `agents/scenarios/ai/`).
- **Jamais dans un CRDT ni dans le dossier du brouillon** : les images jointes vivent dans `<draftId>.attachments/`, hors empreinte, diff, restauration et installation ; supprimées avec le brouillon.
- **Aperçu = code tiers** : l'iframe d'aperçu est `sandbox="allow-scripts"` sur l'origine sandbox, répond avec le SDK simulé seulement ; jamais de chargement trusted d'un brouillon.
- **Toute action destructive est confirmée** (§15.2) : retirer un widget (déjà), abandonner une création (T53).
- **Lecture seule et session distante** : en projet `read-only` ou `revoked`, pas de bouton « Modifier la disposition » (`canEdit`) ; l'aperçu d'un brouillon n'est pas proposé en session distante (`isRemoteView()`, les iframes sandboxées n'y chargent pas, D37).
- Chaque écran ou dialogue existe **en sombre et en clair** (jetons seulement) ; captures dans `screens/t<n>/` à la fin de chaque tâche UI.
- **Tests** : TDD ; `bun test` sans horloge murale, sans dépendance à l'ordre, `mock.module` seulement sur `../api` et une seule fois par fichier ; démon avec `openStore(tmp())` et faux ports ; composants avec `createMockSdk` et `runConformance` ; CRDT avec fast-check (T46) ; E2E en T49 (4423–4424) et T55 (4425–4426).
- Aucune erreur avalée : chaque `catch` affiche (`role="alert"`) ou relance ; jamais `catch {}` vide.
- Fichiers ≤ ~300 lignes : `sdk/mock.ts` (315) redescend sous 300 en T47 (`mock-calls.ts`) ; `draft-lifecycle.ts` (275) extrait `draft-launch.ts` en T50 ; `prompts.ts` extrait `prompts-skill.ts` en T51 ; `DescribeCard.tsx` (181) extrait `DescribeFields.tsx` en T52 ; `AiDraftPanel.tsx` (164) extrait `DraftReviewStep.tsx` en T54 ; `PageView.tsx` extrait `DashboardGrid.tsx` en T48 ; `Shell.tsx` (301) et `service.ts` (295) ne sont pas touchés (suivi inchangé).
- Git : une branche `feat/p9-t<n>` par tâche depuis `phase/9`, worktree `.claude/worktrees/p9-t<n>` ; commits d'une ligne en français, préfixe conventionnel, < 50 caractères, fichiers stagés explicitement, jamais `git stash`, aucune mention d'IA. `bun run check`, `bun run typecheck`, `bun test packages components ./scripts` (et `bun run budget` pour une tâche UI) verts avant chaque commit final.

## Review Focus

1. **Serveur de sync** (T46) : un `push` qui écrit une instance avec `w: 5` (hors format), `x: 8, w: 6` (hors grille), un conteneur Loro, un `id` différent de sa clé ou un `layout` manquant ⇒ `UPDATE_REJECTED` audité et doc intact ; un `push` qui pose deux widgets au même endroit ⇒ **accepté** ; un snapshot initial avec une instance 5 × 5 ⇒ `INVALID_INPUT` ; un doc hérité avec une instance 5 × 5 **non modifiée** par le lot ⇒ accepté.
2. **Aucun widget perdu** (T48) : propriété fast-check sur `resolveOverlaps` : pour toute liste d'instances (dispositions aléatoires de tailles de format), la sortie contient chaque id, aucune paire ne se chevauche, chaque disposition reste dans la grille, et une liste sans chevauchement est rendue à l'identique.
3. **Images étanches** (T50) : après `startComponentDraft` avec deux images, `<draftId>/` et `<draftId>.base/` ne contiennent aucun fichier image, `agentFiles` ne les liste pas, `hash(dir)` est inchangé par leur ajout, `verifyAndRestore` ne les touche pas, `removeDraft` supprime `<draftId>.attachments/` ; un `data` dont la signature n'est pas celle du `mime` ⇒ `INVALID_INPUT` sans rien écrire ; une cinquième image ⇒ `INVALID_INPUT` ; `Write` de l'agent dans le dossier des images ⇒ refusé par le garde-fou, `Read` accepté.
4. **Aperçu borné** (T51, T54) : `GET /c/drafts/<id>/<hash>/ui.sandbox.js` répond 404 pour un brouillon `generating`, `done` ou `abandoned`, pour une empreinte différente de la courante, pour un id qui n'est pas un UUID ; répond 200 avec les en-têtes CSP du sandbox pour un brouillon `review` ; après `reviseComponentDraft`, l'ancien `hash` répond 404. Côté hôte, un appel `run` du composant d'aperçu ne produit **aucune** requête `componentCall` au démon (le mock répond) et `openTicket` n'ouvre rien.
5. **Révision** (T50, T54) : `reviseComponentDraft` en `generating` ou `failed` ⇒ `INVALID_INPUT` ; en `review` ⇒ `generating`, `revisions = 1`, `attempts = 1`, même `sessionId`, prompt qui contient le retour ; au bout de 10 révisions ⇒ `INVALID_INPUT` et l'interface masque le formulaire ; pendant `review`/`finalize` en cours ⇒ `CONFLICT`.
6. **Arrière-plan** (T52, T53) : fermer le dialogue pendant `generating` ne déclenche aucune RPC (`abandonComponentDraft` n'est jamais appelé) ; l'indicateur d'en-tête apparaît avec le badge « 1 » quand un brouillon passe `review`, disparaît quand tous sont `done` ou `abandoned` ; « Ouvrir » depuis Créations rouvre le dialogue sur le brouillon et son état courant.
7. **Dialogues bornés** (T52) : `DialogContent` porte `max-h-[calc(100dvh-2rem)]` et `overflow-y-auto` ; la palette garde `overflow-hidden` ; le dialogue de création avec un diff de 300 lignes défile en interne (test DOM sur les classes ; vérification visuelle en E2E, écran 135).

## Décisions

Les décisions de schéma, de démon, de sync et de vocabulaire sont en spec (§16, composants §17, IA §13, sync D48, agents §12) ; le plan ne les répète pas. Décisions d'implémentation prises par ce plan, à reporter au rapport du jalon :

1. **`formats` facultatif dans le schéma, cohérence dans le devkit** : `ComponentManifest` reste un `z.object` (lecteurs de `.shape` et `.pick`) ; `formatIssue(manifest)` est appelé par le pas `manifest` de `validateComponent` et par le registre à la publication (via la revalidation existante).
2. **Format d'une instance = taille de sa disposition** : aucune donnée nouvelle dans l'instance ; `instanceFormat(instance, page)` dérive le format (`full` sur une page vue, `formatOf(layout) ?? nearestFormat(layout)` sinon). Un composant reçoit `sdk.format` et `sdk.surface`.
3. **Chevauchements résolus au rendu** (`resolveOverlaps`), jamais écrits : le doc ne change pas tout seul ; une écriture n'a lieu qu'au geste de l'utilisateur.
4. **Mode disposition à la demande** : `LayoutEditor`, `FormatMenu`, `LayoutToolbar` et `fr-layout.ts` dans leur chunk ; `PageView` ne garde qu'un bouton ; `DashboardGrid` (rendu pur des cellules) sert aux deux modes.
5. **`InstanceMenuContent` à la demande** (repli de budget, T45) : `InstanceMenu` garde le bouton « ⋯ » et charge son contenu à l'ouverture (modèle `TabMenuContent`).
6. **Images = fichiers frères du brouillon** (`<draftId>.attachments/`), jamais dans le dossier du brouillon : zéro impact sur l'empreinte, le diff, la restauration, l'installation ; `DraftPaths` gagne `attachmentsDir`.
7. **Révision = relance de la même session** avec un prompt de retour ; `attempts` repart à 1, `revisions` compte ; `MAX_DRAFT_REVISIONS = 10`.
8. **Aperçu servi par le listener sandbox** sous `/c/drafts/…` avec un parseur dédié (`parseDraftAssetPath`), bundle construit à la demande dans `.kibo/preview/<hash>/` ; l'hôte répond avec `MockSdk.backend` (nouveau champ exposé par `createMockSdk`) ; `@kibo/sdk/mock` et `@kibo/sdk/fixtures` restent hors de l'entrée (chunk de `DraftPreviewFrame`).
9. **Créations = page à la demande + hook d'entrée minuscule** : `useComponentDrafts()` (liste + `draft.changed`) vit dans `state/` pour l'indicateur ; la page, ses lignes et ses textes sont dans `creations/` (chunk).
10. **Ouvrir un brouillon depuis Créations** : `CreateComponentDialog` et `ModifyWithAiDialog` acceptent `draftId?: string` (reprise directe) ; la page héberge ces dialogues elle-même, sans toucher `ShellDialogs` ni `Shell.tsx`.
11. **Écrans Penpot** : décrits textuellement ci-dessous (127 à 135) ; Penpot reste un écart assumé listé au jalon.

12. **`format` facultatif dans le message `init`, obligatoire à l'envoi** : le schéma du protocole tolère son absence (un composant construit avec ce SDK doit démarrer dans un hôte antérieur, même logique que `formats?`) ; l'iframe retombe sur `defaultFormatOf(manifest)` ; l'hôte l'envoie toujours, garanti par le type de `BridgeDeps.init`.

## Écrans décrits (127 à 135 ; 29 et 116 amendés)

Page Penpot « 15 · Formats et créations » si elle est dessinée un jour ; sinon ces descriptions font foi, en sombre et en clair, données de `design/donnees-fictives.md` (workspace « Perso », projet Kibo (KIB), page « Tableau de bord » avec Kanban, Tickets, Graphe, Notes ; utilisateur Adam). Chaque tâche UI cite les écrans qu'elle implémente.

- **127 · Tableau de bord en mode disposition** (T48) : en-tête de page « Tableau de bord », bouton « Modifier la disposition » devenu barre d'outils « Disposition · 2 changements » avec « Annuler » et « Enregistrer » (orange réservé aux agents : boutons neutres) ; chaque widget garde son contenu, son en-tête prend le curseur `grab` et un libellé « Déplacer Kanban » (ARIA), un menu « Format : Large ▾ » à droite de l'en-tête et un bouton « Retirer Kanban » ; pendant un glisser, un contour accentué dessine la cellule visée (3 colonnes plus à droite), destructif si la place est prise ; une grille de points discrète (fond) matérialise les cellules.
- **128 · Menu Format** (T48) : menu déroulant du widget Tickets : « Moyen · 6 × 3 », « Large · 6 × 6 ✓ », « Demi-page · 12 × 6 », « Plein écran · 12 × 9 (Pas de place) » désactivé ; sous-texte « Un composant s'adapte à chacun de ses formats. »
- **129 · Tableau de bord étroit** (T48) : fenêtre de 900 px : une seule colonne, Kanban (6 rangées), Tickets (6), Graphe (6), Notes (3) dans l'ordre de lecture ; pas de bouton « Modifier la disposition » ; aide dans le menu de la page : « Élargis la fenêtre pour modifier la disposition. »
- **130 · Créations** (T53) : fil d'Ariane « Composants › Créations », en-tête « Créations », sous-titre « Les composants que l'IA écrit pour toi. Une création continue même si tu fermes son dialogue. » ; section « En cours (2) » : lignes « Burndown du sprint · burndown · Création · 2 · Générer (agent) · En cours · mis à jour il y a 1 min » avec « Ouvrir », « Journal », « Abandonner… » ; « Météo · meteo · Modification · 3 · Tests de conformité · En file #2 · 1 tentative » ; section « Terminées (1) » : « Hello · hello · Création · Publié en 0.1.0 · il y a 2 h » ; état vide : « Aucune création pour l'instant. » avec « Créer un composant ». Dialogue « Abandonner Burndown du sprint ? » (« Le brouillon et ses images sont supprimés ; le run en cours est arrêté. »).
- **131 · Indicateur d'en-tête** (T53) : à gauche de la cloche, icône `Sparkles` avec badge « 1 » (une création attend une action) ; infobulle « Créations · 1 attend une action, 1 en cours » ; absent quand aucune création n'est active.
- **132 · Décrire avec images et formats** (T52) : colonne « Décrire à l'IA » : description, titre, identifiant, type, « Avec backend », groupe « Formats » (cases Petit, Moyen ✓, Large ✓, Demi-page ✓, Plein écran), zone « Maquettes (facultatif) : glisse, colle ou choisis jusqu'à 4 images (PNG, JPEG, WebP, 256 ko max) » avec deux vignettes « maquette-kanban.png · 84 ko » et bouton « Retirer » ; message d'erreur sous la zone pour un fichier refusé (« Format non pris en charge : PNG, JPEG ou WebP. »).
- **133 · Aperçu du brouillon** (T54) : étape 3 avec onglets « Diff » et « Aperçu » (Aperçu actif) ; sélecteur de format « Moyen · Large · Demi-page » (Large actif) ; cadre du composant à la taille du format, données simulées (tickets KIB-…) ; mention « Aperçu isolé avec des données de démonstration. Rien n'est enregistré. » ; boutons « J'ai relu, continuer » et « Demander une modification ».
- **134 · Demander une modification** (T54) : sous l'aperçu, champ « Ce qu'il faut changer » (« Mets le total en gros et ajoute un filtre par domaine »), zone Maquettes (facultatif), bouton « Envoyer à l'agent » (variante agent) ; après envoi : étape 2 « Générer (agent) », ligne « Révision 1 sur 10 ».
- **135 · Dialogue borné** (T52) : fenêtre de 700 px de haut : le dialogue « Créer un composant » tient dans la fenêtre (marge 16 px), son contenu défile en interne, l'en-tête reste visible en haut du dialogue.
- **29 amendé** (T52) : la colonne « Décrire à l'IA » gagne Formats et Maquettes ; le pied du dialogue gagne « Continuer en arrière-plan » dès qu'un brouillon est lancé ; la bannière de reprise liste jusqu'à trois brouillons actifs (« Reprendre ») et « Voir les créations ».
- **116 amendé** (T53) : l'en-tête de la page Composants gagne le lien « Créations (2) » à côté de « Créer un composant » ; les Détails d'une version listent « Formats : Moyen, Large, Demi-page ».

## File Structure

```
packages/ui/scripts/bundle-report.ts                                          FORBIDDEN_IN_ENTRY : chunks de la vague ajoutés d'avance (T45)
packages/ui/src/pages/InstanceMenuContent.tsx  InstanceMenu.tsx  instance.test.tsx   contenu du menu à la demande (T45)
packages/ui/src/shell/ProjectHeaderMenu.tsx  ProjectPages.tsx  project-header-menu.test.tsx   mineure « ⋯ » (T45)
packages/schema/src/format.ts  format.test.ts  index.ts                      NOUVEAU (T46) : ComponentFormat, FORMAT_SIZES, formatOf, nearestFormat, layoutFor, inGrid, overlaps
packages/schema/src/manifest.ts  manifest.test.ts                             formats?, DEFAULT_FORMATS, formatsOf, defaultFormatOf, formatIssue (T46)
packages/schema/src/protocol.ts  command.ts  command.test.ts                  surfaceFor ; init.format ; setInstanceLayout (T46)
packages/core/src/instances.ts  instances.test.ts  commands.ts                setInstanceLayout, SHELL_ONLY (T46)
packages/core/src/validate-instances.ts  validate-instances.test.ts  validate-update.ts  validate-snapshot.ts  index.ts   NOUVEAU (T46, D48)
packages/sync-server/src/room.test.ts                                         push d'instance refusé / accepté (T46)
packages/sdk/src/types.ts  sdk.ts  sandbox.tsx  react.tsx                     format dans le contexte (T47)
packages/sdk/src/mock.ts  mock-calls.ts  mock-v1.test.ts                      option format, backend exposé, dispatcher extrait (T47)
packages/sdk/src/conformance.tsx  dev.tsx  dev-fr.ts  dev.test.tsx            un rendu par format ; sélecteur de format (T47)
packages/devkit/src/validate.ts  validate.test.ts                             formatIssue au pas manifest (T47)
components/*/kibo.component.json  components/mcp-source/src/McpSource.tsx  mcp-source.test.tsx   formats déclarés ; small (T47)
components/kanban/src/KanbanCard.tsx  components/tickets/src/TicketsTree.tsx  tests   mineures (T47)
packages/ui/src/lib/format-grid.ts  format-grid.test.ts                       NOUVEAU (T48) : cellMetrics, formatBox, resolveOverlaps, readingOrder, nextLayout, dropTarget, canPlace, instanceFormat ; remplace lib/next-layout.ts
packages/ui/src/pages/DashboardGrid.tsx  PageView.tsx  page-view.test.tsx  use-wide-grid.ts   grille adaptative (T48)
packages/ui/src/pages/LayoutEditor.tsx  LayoutToolbar.tsx  FormatMenu.tsx  layout-editor.test.tsx   NOUVEAU (T48, chunk)
packages/ui/src/pages/InstanceFrame.tsx  shell/SandboxFrame.tsx  dialogs/AddComponentDialog.tsx  i18n/fr.ts  i18n/fr-layout.ts   format (T48)
e2e/layout.spec.ts  e2e/playwright.config.ts                                  (T49)
packages/schema/src/ai.ts  ai-rpc.ts  ai.test.ts                              attachments, formats, revisions, reviseComponentDraft, previewComponentDraft, DraftPreview (T50)
packages/core/src/agent-profiles.ts  agent-profiles.test.ts                   maxParallel système (T50)
packages/daemon/src/ai/draft-attachments.ts  draft-attachments.test.ts        NOUVEAU (T50)
packages/daemon/src/ai/draft-store.ts  draft-files.ts  draft-machine.ts  draft-guard.ts  draft-new.ts  tests   colonnes, attachmentsDir, revised, readRoots (T50)
packages/daemon/src/ai/draft-launch.ts  draft-lifecycle.ts  methods.ts  ports.ts  tests   revise, launch extrait (T50)
packages/daemon/src/ai/prompts.ts  prompts-skill.ts  prompts.test.ts  live-ports.ts  bootstrap.ts   contexte, formats, exemple (T51)
packages/daemon/src/ai/draft-preview.ts  draft-preview.test.ts               NOUVEAU (T51)
packages/daemon/src/components/sandbox-server.ts  asset-path.ts  tests  daemon.ts   /c/drafts (T51)
packages/devkit/src/responsive.ts  responsive.test.ts  validate.ts            largeurs fixes (T51)
packages/daemon/src/agents/fake-claude.ts  scenarios/ai/*.json  fixtures/burndown/*.fixture  ai/revision.int.test.ts   (T51)
packages/sdk/src/ui/dialog.tsx  primitives.test.tsx                           hauteur bornée (T52)
packages/ui/src/ai/attachments.ts  attachments.test.ts  AttachmentsField.tsx  FormatsField.tsx  DescribeFields.tsx  DescribeCard.tsx  describe-card.test.tsx   (T52)
packages/ui/src/ai/ModifyWithAiDialog.tsx  modify.test.tsx  dialogs/CreateComponentDialog.tsx  dialogs/icon-file.ts  i18n/fr-creations.ts   (T52)
packages/schema/src/tabs.ts  packages/ui/src/tabs/screens.ts  shell/ScreenView.tsx  palette/palette-items.ts  i18n/fr.ts   écran creations (T53)
packages/ui/src/state/use-component-drafts.ts  use-agents.ts                 NOUVEAU hook ; useRunLog.empty (T53)
packages/ui/src/creations/CreationsPage.tsx  CreationRow.tsx  creation-status.ts  creation-status.test.ts  creations-page.test.tsx   NOUVEAU (T53, chunk)
packages/ui/src/shell/CreationsIndicator.tsx  ShellHeader.tsx  shell-header.test.tsx  components-page/ComponentsPage.tsx  agents/ProfileSheet.tsx  agents/AgentDrawer.tsx   (T53)
packages/ui/src/ai/DraftReviewStep.tsx  DraftPreview.tsx  DraftPreviewFrame.tsx  FormatPicker.tsx  ReviseForm.tsx  AiDraftPanel.tsx  draft-flow.ts  draft-preview.test.tsx   (T54)
e2e/creations.spec.ts  e2e/playwright.config.ts  packages/daemon/src/agents/scenarios/ai/e2e-routes.json   (T55)
docs/superpowers/specs/*.md (§16, composants §17, IA §13, sync D48, agents §12)   écrits avec ce plan
```

## Contrats partagés

Chaque tâche ne voit que sa propre section : ces signatures font foi entre tâches. Une tâche qui doit en changer une le signale au chef d'équipe, qui corrige ici avant d'intégrer.

### Schéma (T46, T50)

```ts
// packages/schema/src/format.ts (T46)
export const COMPONENT_FORMATS = ["small", "medium", "large", "half", "full"] as const;
export const ComponentFormat = z.enum(COMPONENT_FORMATS);
export type ComponentFormat = z.infer<typeof ComponentFormat>;
export type FormatSize = { w: number; h: number };
export const GRID_COLUMNS = 12;
export const MAX_GRID_ROWS = 400;
export const FORMAT_SIZES: Readonly<Record<ComponentFormat, FormatSize>> = {
  small: { w: 3, h: 3 }, medium: { w: 6, h: 3 }, large: { w: 6, h: 6 }, half: { w: 12, h: 6 }, full: { w: 12, h: 9 },
};
export const FORMAT_PREFERENCE: readonly ComponentFormat[] = ["medium", "large", "half", "small", "full"];
export const inGrid = (l: Layout): boolean => l.x + l.w <= GRID_COLUMNS && l.y + l.h <= MAX_GRID_ROWS;
export const overlaps = (a: Layout, b: Layout): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const formatOf = (size: FormatSize): ComponentFormat | null;      // taille exacte, sinon null
export const isFormatLayout = (l: Layout): boolean => formatOf(l) !== null;
export const nearestFormat = (size: FormatSize): ComponentFormat;        // formatOf, sinon aire la plus proche, égalité tranchée par FORMAT_PREFERENCE
export const layoutFor = (format: ComponentFormat, x: number, y: number): Layout => ({ x, y, ...FORMAT_SIZES[format] });

// packages/schema/src/manifest.ts (T46) : ComponentManifest gagne  formats: z.array(ComponentFormat).min(1).max(5).optional()
export const DEFAULT_FORMATS: Readonly<Record<ComponentKind, readonly ComponentFormat[]>> = {
  widget: ["medium", "large", "half"], view: ["full"], both: ["medium", "large", "half", "full"], adapter: [],
};
export const formatsOf = (m: Pick<ComponentManifest, "kind" | "formats">): ComponentFormat[];
export const defaultFormatOf = (m: Pick<ComponentManifest, "kind" | "formats">): ComponentFormat; // FORMAT_PREFERENCE ∩ formatsOf, sinon "half"
export const formatIssue = (m: Pick<ComponentManifest, "kind" | "formats">): string | null; // doublon, view sans full, widget seulement full, adapter avec formats

// packages/schema/src/protocol.ts (T46)
export const surfaceFor = (m: Pick<ComponentManifest, "kind">, format: ComponentFormat): Surface; // "view" si full et kind ≠ widget
// HostToFrame init gagne  format: ComponentFormat.optional()
//   facultatif sur le fil, définitivement : un hôte antérieur ne l'envoie pas ; l'iframe lit init.format ?? defaultFormatOf(manifest) (T47) ;
//   l'hôte de cette version l'envoie toujours, imposé par le type de BridgeDeps.init (T48)

// packages/schema/src/command.ts (T46)
z.object({ method: z.literal("setInstanceLayout"), instanceId: z.string(), layout: Layout }),
// COMMAND_WRITES.setInstanceLayout = null ; CommandResult.setInstanceLayout = Instance ; commande du shell : absente de DAEMON_ONLY_COMMANDS (assertShellCommand l'accepte), refusée aux composants par isReservedCommand (gate.ts)

// packages/schema/src/ai.ts (T50)
export const DraftAttachmentName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
export const DraftAttachmentInput = IconInput.extend({ name: DraftAttachmentName });
export type DraftAttachmentInput = z.infer<typeof DraftAttachmentInput>;
export const MAX_DRAFT_ATTACHMENTS = 4;
export const DraftAttachments = z.array(DraftAttachmentInput).max(MAX_DRAFT_ATTACHMENTS).default([]);
export const DraftAttachment = z.object({ name: DraftAttachmentName, mime: IconMime, bytes: z.number().int().positive() });
export type DraftAttachment = z.infer<typeof DraftAttachment>;
export const MAX_DRAFT_REVISIONS = 10;
export const MAX_DRAFT_ATTACHMENTS_TOTAL = MAX_DRAFT_ATTACHMENTS * (MAX_DRAFT_REVISIONS + 1);
// ComponentDraft gagne  attachments: z.array(DraftAttachment).max(MAX_DRAFT_ATTACHMENTS_TOTAL).default([]), revisions: z.number().int().min(0).max(MAX_DRAFT_REVISIONS).default(0)
// Démon (T50, après relecture lead) : writeAttachments(dir, inputs: readonly DraftAttachmentInput[], existing: readonly DraftAttachment[]) ; checkAttachments(inputs): void ; DraftStore gagne feedback(id): string | null, saveFeedback(id, text: string | null): void ; LaunchInput, launchDraft, draftBrief, ATTACHMENTS_ENV dans draft-launch.ts ; prepareNewDraft dans draft-new.ts
// Démon (T51) : GeneratorBrief.attachments: readonly string[] ; revisePrompt(b, feedback, attachments: readonly string[])
// Démon (T50, livré) : removeAttachmentFiles(paths) dans draft-attachments.ts ; retryPrompt(d, { report, feedback, images }) dans draft-launch.ts ; launchDraft répond STORE_CORRUPT si le dossier du brouillon manque
// Démon (T51, après relecture lead) :
//   draft-launch.ts : type BriefContext = { formats: readonly ComponentFormat[]; attachments: readonly string[] } ; draftBrief(d, ctx: BriefContext): GeneratorBrief ;
//     retryPrompt(d, { report, feedback, images, formats }) (formats relus dans le manifeste du brouillon)
//   prompts-skill.ts : SKILL, EXAMPLE_COMPONENT (chaîne, validée par prompts-example.int.test.ts avec validateComponent réel), FORMAT_LABELS, formatLine(f), formatTable(declared)
//   draft-preview.ts : type DraftFile = SandboxFile ; DraftAssets = { lookup(draftId, hash, file): Promise<Uint8Array | string | null> } (empreinte recalculée à chaque appel) ;
//     preview(draftId) : INVALID_INPUT hors review/permissions, NOT_FOUND, CONFLICT si le brouillon change pendant la construction, VALIDATION_FAILED si la construction échoue, STORE_CORRUPT
//   agents/fake-claude-ai.ts : fakeToolUses(stateDir, sessionId): { tool: string; input: Record<string, unknown>; denied: boolean }[]
// StartComponentDraftInput.create gagne  formats: z.array(ComponentFormat).min(1).max(5).optional(), attachments: DraftAttachments
// StartComponentDraftInput.modify gagne  attachments: DraftAttachments
export const ReviseComponentDraftInput = z.object({ draftId: DraftId, feedback: z.string().trim().min(5).max(2000), attachments: DraftAttachments });
export type DraftPreview = { hash: string; path: string };   // path = `/c/drafts/${draftId}/${hash}/index.html`, relatif à sandboxOrigin

// packages/schema/src/ai-rpc.ts (T50)
z.object({ method: z.literal("reviseComponentDraft"), ...ReviseComponentDraftInput.shape }),
z.object({ method: z.literal("previewComponentDraft"), draftId: DraftId }),
// AiRpcResult gagne  reviseComponentDraft: ComponentDraft ; previewComponentDraft: DraftPreview

// packages/schema/src/tabs.ts (T53) : Screen gagne "creations"
```

### Core (T46, T50)

```ts
// packages/core/src/instances.ts (T46)
export function setInstanceLayout(doc: LoroDoc, instanceId: string, layout: Layout): Instance;
// NOT_FOUND ; INVALID_INPUT "layout is outside the grid" | "layout is not a component format" | `layout overlaps instance ${id}`
// packages/core/src/validate-instances.ts (T46)
export function instancesUpdateViolation(before: LoroDoc, after: LoroDoc): string | null;
export function instancesSnapshotViolation(doc: LoroDoc): string | null;
// packages/core/src/agent-profiles.ts (T50)
export const SYSTEM_MAX_PARALLEL = 4;
export const SYSTEM_DEFAULT_PARALLEL: Readonly<Record<SystemProfileId, number>> = { assistant: 1, generateur: 2 };
```

### SDK (T47)

```ts
// packages/sdk/src/types.ts : KiboSdk et SdkContext gagnent  format: ComponentFormat
// packages/sdk/src/mock.ts
export type MockSdkOptions = { …; format?: ComponentFormat };            // défaut defaultFormatOf(manifest)
export type MockSdk = { …; backend: ProjectBackend };                   // le backend interne, pour répondre à une iframe
// packages/sdk/src/conformance.tsx : un rendu par format de formatsOf(manifest), surface = surfaceFor(manifest, format)
// packages/sdk/src/dev-fr.ts : devFr.format, devFr.formats: Record<ComponentFormat, string>
```

### Démon (T50, T51)

```ts
// packages/daemon/src/ai/draft-files.ts (T50) : DraftPaths = { dir; baseDir; attachmentsDir }
export const draftPaths = (home: string, draftId: string): DraftPaths;  // attachmentsDir = components/drafts/<id>.attachments
// packages/daemon/src/ai/draft-attachments.ts (T50)
export function writeAttachments(dir: string, inputs: DraftAttachmentInput[], existing: DraftAttachment[]): DraftAttachment[]; // crée dir 0700, fichiers `${n}-${name}` 0600 wx, n = existing.length + i + 1
export function attachmentPaths(dir: string, list: DraftAttachment[]): string[];  // chemins absolus, même ordre
// packages/daemon/src/ai/draft-machine.ts (T50)
| { type: "revised"; runId: string }   // review | permissions → generating, attempts 1, revisions + 1, failure null, incidents []
export const canRevise = (d: ComponentDraft): boolean;
// packages/daemon/src/ai/draft-lifecycle.ts (T50)
export type DraftLifecycle = { …; revise(input: ReviseComponentDraftInput): Promise<ComponentDraft> };
export type LifecycleDeps = { …; sdkDir; previewDir?: never };          // env() gagne KIBO_DRAFT_ATTACHMENTS par launch
// packages/daemon/src/ai/draft-launch.ts (T50)
export type LaunchInput = { draft: ComponentDraft; sdkDir: string; prompt: string; resumeSessionId: string | null; event: "enqueued" | "revised" };
// packages/daemon/src/ai/ports.ts (T50, T51)
export type ScaffoldOptions = { …; formats: ComponentFormat[] };
export type Devkit = { …; buildPreview(dir: string): Promise<{ "ui.sandbox.js": Uint8Array; "ui.css": Uint8Array }> };
// packages/daemon/src/ai/prompts.ts (T51)
export type GeneratorBrief = { …; formats: ComponentFormat[]; attachments: string[] };
export function revisePrompt(b: GeneratorBrief, feedback: string, attachments: string[]): string;
// packages/daemon/src/ai/prompts-skill.ts (T51)
export const SKILL: string; export const EXAMPLE_COMPONENT: string; export function formatTable(declared: ComponentFormat[]): string;
// packages/daemon/src/ai/draft-preview.ts (T51)
export type DraftFile = "index.html" | "ui.sandbox.js" | "ui.css";
export type DraftAssets = { lookup(draftId: string, hash: string, file: DraftFile): Uint8Array | string | null };
export function createDraftPreview(deps: { store: DraftStore; home: string; devkit: Pick<Devkit, "hash" | "buildPreview"> }): { preview(draftId: string): Promise<DraftPreview>; assets: DraftAssets };
// packages/daemon/src/components/sandbox-server.ts (T51) : SandboxServerOptions gagne  drafts?: DraftAssets
// packages/daemon/src/components/asset-path.ts (T51)
export function parseDraftAssetPath(pathname: string): { draftId: string; hash: string; file: DraftFile } | null; // /c/drafts/<uuid>/<sha256>/<file>
// packages/daemon/src/ai/bootstrap.ts (T51) : startAi ⇒ { port; stop; draftAssets: DraftAssets }
// packages/devkit/src/responsive.ts (T51)
export function responsiveViolations(source: string, file?: string): string[];
```

### UI (`packages/ui`)

```ts
// lib/format-grid.ts (T48)
export const ROW_HEIGHT = 80; export const GAP = 16; export const WIDE_QUERY = "(min-width: 1024px)";
export type CellMetrics = { column: number; row: number; gap: number };
export const cellMetrics = (width: number): CellMetrics;
export const formatBox = (format: ComponentFormat, width: number): { width: number; height: number };
export const readingOrder = (instances: readonly Instance[]): Instance[];           // y, x, id
export const resolveOverlaps = (instances: readonly Instance[]): Map<string, Layout>;
export const nextLayout = (taken: readonly Layout[], size: FormatSize): Layout;      // première place libre, y puis x
export const dropTarget = (layout: Layout, delta: { x: number; y: number }, metrics: CellMetrics): Layout;
export const canPlace = (layout: Layout, others: readonly Layout[]): boolean;        // inGrid et aucun chevauchement
export const instanceFormat = (instance: Instance, page: Pick<Page, "kind">): ComponentFormat;
// pages/use-wide-grid.ts (T48)
export function useWideGrid(): boolean;
// pages/DashboardGrid.tsx (T48)
export type DashboardGridProps = { instances: Instance[]; layouts: ReadonlyMap<string, Layout>; narrow: boolean; renderWidget(instance: Instance, layout: Layout): ReactNode; trailing?: ReactNode; overlay?: ReactNode };
// pages/LayoutEditor.tsx (T48, chunk)
export type LayoutEditorProps = { projectId: string; page: Page; instances: Instance[]; formatsFor(instance: Instance): ComponentFormat[]; renderWidget(instance: Instance, layout: Layout): ReactNode; onClose(): void };
// pages/InstanceFrame.tsx (T48) : Props gagne  format: ComponentFormat  (transmis à createSdk et à SandboxFrame)
// pages/InstanceMenu.tsx (T45) : inchangé en props ; InstanceMenuContent.tsx porte le contenu
// dialogs/CreateComponentDialog.tsx (T52) : Props gagne  draftId?: string ; onOpenCreations?(): void
// ai/ModifyWithAiDialog.tsx (T52) : Props = { component: ModifyTarget | null; draftId?: string; open; onOpenChange }
// ai/AttachmentsField.tsx (T52)
export type AttachmentsFieldProps = { value: DraftAttachmentInput[]; onChange(next: DraftAttachmentInput[]): void; disabled?: boolean };
// ai/attachments.ts (T52)
export type AttachmentRefusal = "count" | "format" | "too-large";
export function attachmentName(fileName: string, mime: IconMime): string;
export function addAttachment(list: DraftAttachmentInput[], item: DraftAttachmentInput): { ok: true; list: DraftAttachmentInput[] } | { ok: false; refusal: AttachmentRefusal };
// ai/FormatsField.tsx (T52) : { kind: DraftKind; value: ComponentFormat[]; onChange(next: ComponentFormat[]): void }
// state/use-component-drafts.ts (T53)
export function useComponentDrafts(): { drafts: ComponentDraft[] | null; error: string | null; reload(): void };
// creations/creation-status.ts (T53)
export const awaitingAction = (d: ComponentDraft): boolean;            // failed | review | permissions
export const groupDrafts = (drafts: ComponentDraft[]): { active: ComponentDraft[]; finished: ComponentDraft[] };
export const indicatorState = (drafts: ComponentDraft[], runs: RunView[]): { visible: boolean; awaiting: number; busy: boolean };
// creations/CreationsPage.tsx (T53) : { onOpen(target: TabTarget): void }
// shell/CreationsIndicator.tsx (T53) : { onOpen(): void }
// state/use-agents.ts (T53) : RunLog = { log; missing; empty }  (missing seulement sur NOT_FOUND)
// ai/DraftPreviewFrame.tsx (T54)
export type DraftPreviewFrameProps = { draftId: string; manifest: ComponentManifest; format: ComponentFormat; theme: Theme };
// ai/draft-flow.ts (T54) : draftActions gagne  canRevise: boolean
```

### Textes

- `fr.ts` (entrée) : `page.editLayout` « Modifier la disposition », `page.editLayoutNarrow` « Élargis la fenêtre pour modifier la disposition. », `nav.creations` « Créations », `header.creations(awaiting, busy)`.
- `fr-layout.ts` (T48, chunk) : `frLayout.formats: Record<ComponentFormat, string>` (Petit, Moyen, Large, Demi-page, Plein écran), `size(w, h)`, `toolbar(n)`, `save`, `cancel`, `move(title)`, `format(title)`, `remove(title)`, `noRoom`, `help`, `saveFailed(title)`.
- `fr-creations.ts` (T52, T53, T54, chunk) : `frCreations.attachments`, `formats`, `background`, `banner`, `page`, `row`, `abandon`, `preview`, `revise` (textes des écrans 130 à 135).

## Vagues d'exécution

Une vague démarre quand toutes les tâches dont elle dépend sont intégrées dans `phase/9`. Dans une vague, chaque tâche a son worktree `.claude/worktrees/p9-t<n>` et sa branche `feat/p9-t<n>` ; le chef d'équipe lance les `kibo-dev` de la vague en parallèle et intègre ensuite **dans l'ordre du tableau**, en rebasant chaque branche sur la précédente (les conflits listés sont des ajouts de quelques lignes : `schema/index.ts`, `bundle-report.ts`, `fr.ts`, `ai-rpc.ts`, `ports.ts`). Après chaque intégration d'une tâche UI : `bun run budget`.

| Vague | Tâches en parallèle | Dépendances (tâche ← tâches) | Fichiers partagés dans la vague | Écrans |
|---|---|---|---|---|
| 0 | T45, T46, T50 | aucune (spec écrite). **T45 est intégrée la première** et conditionne toute tâche UI ; T50 ← T46 pour le seul champ `formats` de `StartComponentDraftInput` (T50 démarre en parallèle, importe `ComponentFormat` depuis `./format` et rebase) | T45 = UI seule (`pages/InstanceMenu*`, `shell/ProjectHeaderMenu`, `ProjectPages`, `bundle-report.ts`) ; T46 = schéma (`format.ts`, `manifest.ts`, `protocol.ts`, `command.ts`, `index.ts`), core (`instances.ts`, `commands.ts`, `validate-*.ts`), `sync-server/room.test.ts` ; T50 = schéma (`ai.ts`, `ai-rpc.ts`), core (`agent-profiles.ts`), démon (`ai/draft-*`, `methods.ts`, `ports.ts`). T46 et T50 touchent tous deux `schema/index.ts` (une ligne chacun : **T46 avant T50**) | — |
| 1 | T47, T48, T51, T52 | T47 ← T46 ; T48 ← T45, T46, T47 (`SdkContext.format`) ; T51 ← T46, T50 ; T52 ← T45, T50 | T47 = `sdk/*`, `devkit/validate.ts`, `components/*` ; T48 = `ui/lib/format-grid.ts`, `ui/pages/*` (sauf `InstanceMenu*`), `shell/SandboxFrame.tsx`, `dialogs/AddComponentDialog.tsx`, `fr.ts`, `fr-layout.ts` ; T51 = `daemon/ai/prompts*`, `draft-preview.ts`, `live-ports.ts`, `bootstrap.ts`, `components/sandbox-server.ts`, `asset-path.ts`, `daemon.ts`, `devkit/responsive.ts`, `devkit/validate.ts`, `agents/fake-claude.ts`, scénarios ; T52 = `sdk/ui/dialog.tsx`, `ui/ai/*` (sauf `AiDraftPanel`, `DraftReview*`, `DraftPreview*`), `dialogs/CreateComponentDialog.tsx`, `dialogs/icon-file.ts`, `fr-creations.ts`. T47 et T51 touchent tous deux `devkit/validate.ts` (deux pas différents : **T47 avant T51**) ; T51 touche `ports.ts` après T50 | T48 : 127, 128, 129 · T52 : 132, 135, 29 amendé |
| 2 | T49, T53, T54 | T49 ← T48 ; T53 ← T50, T52 (`draftId` des dialogues, `fr-creations.ts`) ; T54 ← T47 (`MockSdk.backend`), T51 (`previewComponentDraft`), T52 (`AttachmentsField`, `fr-creations.ts`) | T53 = `schema/tabs.ts`, `ui/tabs/screens.ts`, `shell/ScreenView.tsx`, `shell/ShellHeader.tsx`, `shell/CreationsIndicator.tsx`, `state/*`, `creations/*`, `components-page/ComponentsPage.tsx`, `agents/ProfileSheet.tsx`, `agents/AgentDrawer.tsx`, `palette/palette-items.ts`, `fr.ts` ; T54 = `ui/ai/AiDraftPanel.tsx`, `DraftReviewStep.tsx`, `DraftPreview*.tsx`, `FormatPicker.tsx`, `ReviseForm.tsx`, `draft-flow.ts` ; T49 = `e2e/layout.spec.ts`, `playwright.config.ts`. T53 et T54 ajoutent tous deux des clés à `fr-creations.ts` (sections distinctes : **T53 avant T54**) | T53 : 130, 131, 116 amendé · T54 : 133, 134 |
| 3 | T55 | T55 ← T53, T54 (et T49 pour `playwright.config.ts`) | `e2e/creations.spec.ts`, `playwright.config.ts`, `scenarios/ai/e2e-routes.json` | — |
| Jalon | `bun run budget` (≤ 222,0 kB), contrôle visuel 127–135 (et 29, 116) sombre et clair, rapport de vague au chef d'équipe, puis jalon `v1.1.0` (version, PR `phase/9` → `main`, CI verte, tag) | tout | — | toutes |

Ordre d'intégration : vague 0 : **T45**, T46, T50 ; vague 1 : T47, T48, T51, T52 ; vague 2 : T53, T54, T49 ; vague 3 : T55. Tâches à risque relues aussi par `kibo-lead` : **T45** (budget), **T46** (core, contrôle serveur), **T50** (démon, images, garde-fou), **T51** (listener sandbox, aperçu, prompt), **T54** (iframe d'aperçu et SDK simulé).

Chemin critique : T46 → T47 → T48 → T49 (lot 5) et T50 → T51 → T54 → T55 (lot 9), quatre vagues.

**Budget attendu** : 220,1 kB au départ ; T45 : −0,8 kB (`InstanceMenuContent`) ⇒ ≈ 219,3 kB ; entrées ensuite : T48 (+0,5 kB : bouton, `DashboardGrid`, `resolveOverlaps`, `useWideGrid`, `format` dans `InstanceFrame`), T53 (+0,7 kB : `CreationsIndicator`, `useComponentDrafts`, entrée d'écran), T52 (+0,1 kB : classes de `DialogContent`), le reste à la demande ⇒ **≈ 220,6 kB à la fin de la vague**, exigence ≤ 222,0 kB, marge ≥ 8 kB pour la suite.

---

### Task 45: Budget : `InstanceMenuContent` à la demande, chunks de la vague interdits d'avance, mineure « ⋯ »

Vague 0, **intégrée la première**. Spec §16 (budget, Global Constraints). Décision 5. Mesure de départ **220,1 kB**. Un gain (`InstanceMenu` charge son contenu à l'ouverture), la liste des chunks de la vague ajoutée à `FORBIDDEN_IN_ENTRY` avant qu'ils existent (une tâche qui les importerait depuis l'entrée casserait `bun run budget`), et la mineure « “⋯” du projet courant décalé sur la pastille » reproduite puis corrigée avec un test DOM.

**Files:**
- Create: `packages/ui/src/pages/InstanceMenuContent.tsx`
- Modify: `packages/ui/src/pages/InstanceMenu.tsx`, `packages/ui/src/pages/instance.test.tsx`, `packages/ui/scripts/bundle-report.ts`, `packages/ui/src/shell/ProjectHeaderMenu.tsx` et/ou `packages/ui/src/shell/ProjectPages.tsx` (selon le diagnostic), `packages/ui/src/shell/project-header-menu.test.tsx`

**Interfaces:**
- Consumes: `lazyPanel` (`@kibo/sdk`, `fallback: "sr-only"`), `DropdownMenu*` (`@kibo/sdk/ui/dropdown-menu`), `ProjectHeaderMenu`, `ProjectEntry`, `ProjectPages`.
- Produces: `InstanceMenuContent` (contenu du menu d'instance), `FORBIDDEN_IN_ENTRY` complété.

- [x] **Step 1: Mesure de départ**

Run: `bun install --frozen-lockfile && bun run budget` — Expected: `gzip : 220.1 kB (budget 230.0 kB)` (noter la valeur exacte dans le rapport).

- [x] **Step 2: Chunks de la vague interdits dans l'entrée (test rouge puis vert)**

`packages/ui/scripts/bundle-report.test.ts` (existe : `ls packages/ui/scripts/*.test.ts`) : ajouter un test qui vérifie que chaque chemin ci-dessous est reconnu par `FORBIDDEN_IN_ENTRY` :
```ts
test("the wave 4 chunks are forbidden in the entry", () => {
  const paths = [
    "/x/packages/ui/src/pages/InstanceMenuContent.tsx",
    "/x/packages/ui/src/pages/LayoutEditor.tsx",
    "/x/packages/ui/src/pages/LayoutToolbar.tsx",
    "/x/packages/ui/src/pages/FormatMenu.tsx",
    "/x/packages/ui/src/i18n/fr-layout.ts",
    "/x/packages/ui/src/creations/CreationsPage.tsx",
    "/x/packages/ui/src/creations/creation-status.ts",
    "/x/packages/ui/src/i18n/fr-creations.ts",
    "/x/packages/ui/src/ai/DraftPreviewFrame.tsx",
    "/x/packages/sdk/src/mock.ts",
    "/x/packages/sdk/src/mock-calls.ts",
    "/x/packages/sdk/src/mock-notes.ts",
    "/x/packages/sdk/src/fixtures.ts",
  ];
  for (const p of paths) expect(FORBIDDEN_IN_ENTRY.some((r) => r.test(p))).toBe(true);
  expect(FORBIDDEN_IN_ENTRY.some((r) => r.test("/x/packages/ui/src/pages/DashboardGrid.tsx"))).toBe(false);
});
```
Run: `bun test packages/ui/scripts` — Expected: FAIL.

`bundle-report.ts`, à la fin de `FORBIDDEN_IN_ENTRY` :
```ts
  /\/packages\/ui\/src\/(pages\/(InstanceMenuContent|LayoutEditor|LayoutToolbar|FormatMenu)\.tsx|i18n\/fr-layout\.ts)$/,
  /\/packages\/ui\/src\/(creations\/[A-Za-z-]+\.tsx?|i18n\/fr-creations\.ts)$/,
  /\/packages\/sdk\/src\/(mock|mock-calls|mock-notes|fixtures)\.tsx?$/,
```
(`ai/DraftPreviewFrame.tsx` est déjà couvert par `ai\/[A-Za-z]+\.tsx`.) Run: `bun test packages/ui/scripts` — Expected: PASS.

- [x] **Step 3: Contenu du menu d'instance à la demande (test rouge puis vert)**

`packages/ui/src/pages/instance.test.tsx` : repérer le test existant qui ouvre le menu « Actions <titre> » (`grep -n "Actions" packages/ui/src/pages/instance.test.tsx`) et ajouter :
```tsx
test("the instance menu content is loaded when the menu opens", async () => {
  const user = userEvent.setup();
  render(<HostProvider host={host}><InstanceMenu projectId="p1" instance={instance} title="Kanban" /></HostProvider>);
  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions Kanban" }));
  expect(await screen.findByRole("menuitem", { name: "Retirer de la page…" })).toBeTruthy();
});
```
(`host` et `instance` : reprendre les fixtures du fichier.) Run: `bun test packages/ui/src/pages/instance.test.tsx` — Expected: FAIL (le `menu` n'est pas chargé par `lazyPanel`, ou le test passe déjà : dans ce cas garder le test comme garde et poursuivre).

`InstanceMenuContent.tsx` : déplacer tout ce qui est sous `<DropdownMenuContent>` et les dialogues (`NotesDirDialog`, `InstanceSettingsDialog`, `ConfirmDialog`, `ModifyWithAiDialog`, `TrustDialog`) ainsi que les états `notesDir`, `pending`, `modifying`, `settings`, `removing`, les calculs `schema`, `summary`, `higher`, `target`, `update`, `remove`, `pick` dans un composant `InstanceMenuContent({ projectId, instance, title, flash })` ; `InstanceMenu.tsx` garde `useFlash`, le `DropdownMenu`, le `DropdownMenuTrigger` et rend `<InstanceMenuContent …/>` à l'intérieur de `<DropdownMenuContent align="end">` via `const Content = lazyPanel(() => import("./InstanceMenuContent").then((m) => m.InstanceMenuContent), fr.lazy, { fallback: "sr-only" })` ; les dialogues restent montés **hors** du `DropdownMenuContent` (ils doivent survivre à la fermeture du menu) : `InstanceMenuContent` rend un fragment `<>{items}</>` et expose les dialogues par un rendu dans un `Portal`, ou plus simplement `InstanceMenu` monte `<Content …>` une fois ouvert et le garde monté (`opened` state à `true` au premier `onOpenChange(true)`), `InstanceMenuContent` rendant `<DropdownMenuContent>` + dialogues lui-même. Retenir la seconde forme (un seul chunk, un seul état). `useInstanceTitle` reste exporté par `InstanceMenu.tsx` (importé par `PageView.tsx:13`).
Run: `bun test packages/ui/src/pages` — Expected: PASS ; `bun run budget` — Expected: ≈ 219,3 kB, aucun module interdit.

- [x] **Step 4: Mineure « ⋯ » du projet courant (reproduction, test rouge puis vert)**

Reproduire : `bun run --cwd packages/ui dev` (ou `bun run build` + démon), ouvrir un projet avec des pages, observer le bouton « Menu du projet <nom> » du projet courant ; capturer `screens/t45/avant-sombre.png` et `avant-clair.png`. Deux suspects, à vérifier dans l'ordre : (a) `ProjectPages.tsx:224` enveloppe l'en-tête du projet courant dans `RootDrop` (l. 44-51), dont le `div` devient le parent du `SidebarMenuAction` absolu alors que, pour un projet non courant, le parent est le `SidebarMenuItem` ; (b) `ProjectHeaderMenu.tsx:49-52` applique `right-7` quand `shifted` mais `SidebarMenuAction` (`@kibo/sdk/ui/sidebar`) impose aussi `right-1` par ses classes de base : `tailwind-merge` doit garder la dernière, vérifier avec `getAttribute("class")`.
Test dans `project-header-menu.test.tsx` (monter `ProjectEntry` avec `active` non nul pour passer par `ProjectPages`, dans un `DndContext` si `useDroppable` l'exige) :
```tsx
test("the ⋯ action of the current project is positioned by its menu item, not by the drop zone", () => {
  mountCurrentProjectWithPages();
  const more = screen.getByRole("button", { name: "Menu du projet Kibo" });
  const positioned = more.closest('[data-sidebar="menu-item"], .relative');
  expect(positioned?.getAttribute("data-sidebar")).toBe("menu-item");
  expect(more.className).toMatch(/\bright-7\b/);
  expect(more.className).not.toMatch(/\bright-1\b/);
});
```
Run: `bun test packages/ui/src/shell/project-header-menu.test.tsx` — Expected: FAIL sur la cause réelle. Corriger la cause (pour (a) : `RootDrop` rend `children` sans `div` positionné, en posant `setNodeRef` et la classe de surbrillance sur le `SidebarMenuItem` par un `className` transmis, ou en donnant `relative` au `SidebarMenuItem` et `static` au `div` ; pour (b) : `cn("right-7")` doit remplacer `right-1`, sinon passer par `style={{ right: "1.75rem" }}`). Run: PASS. Capturer `screens/t45/apres-sombre.png` et `apres-clair.png`.

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS, budget ≤ 220,1 kB.
```bash
git add packages/ui/scripts/bundle-report.ts packages/ui/scripts/bundle-report.test.ts
git commit -m "build(ui): chunks de la vague 4 interdits d'entrée"
git add packages/ui/src/pages/InstanceMenu.tsx packages/ui/src/pages/InstanceMenuContent.tsx packages/ui/src/pages/instance.test.tsx
git commit -m "feat(ui): menu d'instance chargé à l'ouverture"
git add packages/ui/src/shell/ProjectHeaderMenu.tsx packages/ui/src/shell/ProjectPages.tsx packages/ui/src/shell/project-header-menu.test.tsx
git commit -m "fix(ui): menu du projet courant bien placé"
```

---

### Task 46: Schéma, core et contrôle serveur : formats, `setInstanceLayout`, instances validées

> **Amendement après relecture lead (accepté).** `nearestFormat` : aire la plus proche, égalité tranchée par `FORMAT_PREFERENCE` (5 × 5 ⇒ `"medium"`). `protocol.ts` : `format: ComponentFormat.optional()` dans `init`. `setInstanceLayout` est une commande du shell : `DAEMON_ONLY_COMMANDS` n'est pas modifié ; le test vérifie `assertShellCommand(cmd)` sans erreur, `isReservedCommand(cmd.method)` vrai et `COMMAND_WRITES.setInstanceLayout` nul. Tests serveur dans `packages/sync-server/src/room-instances.test.ts`, propriétés dans `packages/core/src/format.property.test.ts`.

Vague 0 ← rien. Spec §16.1, §16.2, composants §17.1, sync **D48**. Décisions 1, 2, 3. Le schéma gagne les formats et la commande ; le core refuse toute disposition invalide et contrôle les instances écrites d'un lot de sync (ce que le serveur applique sans changer, `room.ts:215`) ; une propriété fast-check garantit qu'une suite de commandes valides produit toujours un doc accepté par le serveur. Relue par `kibo-lead`.

**Files:**
- Create: `packages/schema/src/format.ts`, `format.test.ts`, `packages/core/src/validate-instances.ts`, `validate-instances.test.ts`
- Modify: `packages/schema/src/manifest.ts`, `manifest.test.ts` (créer s'il n'existe pas : `ls packages/schema/src/manifest*.test.ts`), `protocol.ts`, `command.ts`, `command.test.ts` (ou `compat.test.ts`), `index.ts` ; `packages/core/src/instances.ts`, `instances.test.ts`, `commands.ts`, `validate-update.ts`, `validate-snapshot.ts`, `index.ts` ; `packages/sync-server/src/room.test.ts`

**Interfaces:**
- Consumes: `Layout`, `Instance` (`schema/instance.ts`), `ComponentKind`, `Surface`, `LoroDoc`, `isContainer`, `executeProjectCommand`, `validateProjectUpdate`, `validateSharedSnapshot`, `ProjectRoom` (sync-server).
- Produces: contrat « Schéma (T46) » et « Core (T46) » ci-dessus.

- [x] **Step 1: Formats purs (tests rouges puis verts)**

`packages/schema/src/format.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { FORMAT_SIZES, formatOf, inGrid, isFormatLayout, layoutFor, nearestFormat, overlaps } from "./format";

describe("formats", () => {
  test("every format has a distinct size and formatOf finds it back", () => {
    const sizes = Object.values(FORMAT_SIZES).map((s) => `${s.w}x${s.h}`);
    expect(new Set(sizes).size).toBe(sizes.length);
    for (const [format, size] of Object.entries(FORMAT_SIZES)) expect(formatOf(size)).toBe(format);
    expect(formatOf({ w: 5, h: 5 })).toBeNull();
  });
  test("legacy defaults are formats", () => {
    expect(formatOf({ w: 6, h: 6 })).toBe("large");
    expect(formatOf({ w: 12, h: 6 })).toBe("half");
  });
  test("nearestFormat picks the closest area and breaks ties by preference", () => {
    expect(nearestFormat({ w: 5, h: 5 })).toBe("medium");
    expect(nearestFormat({ w: 4, h: 4 })).toBe("medium");
    expect(nearestFormat({ w: 12, h: 12 })).toBe("full");
  });
  test("inGrid and overlaps", () => {
    expect(inGrid(layoutFor("half", 0, 394))).toBe(true);
    expect(inGrid(layoutFor("half", 0, 395))).toBe(false);
    expect(inGrid(layoutFor("small", 10, 0))).toBe(false);
    expect(overlaps(layoutFor("small", 0, 0), layoutFor("small", 2, 2))).toBe(true);
    expect(overlaps(layoutFor("small", 0, 0), layoutFor("small", 3, 0))).toBe(false);
    expect(isFormatLayout({ x: 0, y: 0, w: 3, h: 3 })).toBe(true);
  });
});
```
Run: `bun test packages/schema/src/format.test.ts` — Expected: FAIL (module absent). Écrire `format.ts` selon le contrat (`nearestFormat` : `formatOf(size) ?? ` le format dont `|w·h − size.w·size.h|` est minimal, égalité tranchée par l'ordre de `FORMAT_PREFERENCE`). Exporter depuis `index.ts`. Run: PASS.

- [x] **Step 2: Manifeste (tests rouges puis verts)**

`packages/schema/src/manifest.test.ts` :
```ts
test("formats are optional and derived from the kind", () => {
  const base = { id: "x", version: "1.0.0", title: "X", reads: [], writes: [] };
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "widget" }))).toEqual(["medium", "large", "half"]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "view" }))).toEqual(["full"]);
  expect(formatsOf(ComponentManifest.parse({ ...base, kind: "both", formats: ["small", "full"] }))).toEqual(["small", "full"]);
  expect(defaultFormatOf({ kind: "both", formats: ["small", "full"] })).toBe("small");
  expect(defaultFormatOf({ kind: "adapter" })).toBe("half");
  expect(ComponentManifest.safeParse({ ...base, kind: "widget", formats: [] }).success).toBe(false);
  expect(ComponentManifest.safeParse({ ...base, kind: "widget", formats: ["huge"] }).success).toBe(false);
});
test("formatIssue names the inconsistency", () => {
  expect(formatIssue({ kind: "view", formats: ["large"] })).toMatch(/view.*full/);
  expect(formatIssue({ kind: "widget", formats: ["full"] })).toMatch(/widget/);
  expect(formatIssue({ kind: "both", formats: ["large", "large"] })).toMatch(/unique/);
  expect(formatIssue({ kind: "adapter", formats: ["small"] })).toMatch(/adapter/);
  expect(formatIssue({ kind: "both", formats: ["large", "full"] })).toBeNull();
  expect(formatIssue({ kind: "widget" })).toBeNull();
});
test("surfaceFor", () => {
  expect(surfaceFor({ kind: "both" }, "full")).toBe("view");
  expect(surfaceFor({ kind: "widget" }, "full")).toBe("widget");
  expect(surfaceFor({ kind: "both" }, "large")).toBe("widget");
});
```
Run: FAIL. `manifest.ts` : `formats: z.array(ComponentFormat).min(1).max(5).optional()` (après `sdk`), `DEFAULT_FORMATS`, `formatsOf`, `defaultFormatOf`, `formatIssue` (messages : `INVALID_MANIFEST: formats must be unique`, `… a view declares the full format`, `… a widget declares a format other than full`, `… an adapter has no format`) ; `protocol.ts` : `surfaceFor` et `format: ComponentFormat` dans le message `init`. Vérifier que `manifest.ts` reste un `z.object` (`ComponentManifest.shape.version` compile dans `ai.ts`). Run: PASS ; `bun test packages/schema` — Expected: PASS (les manifestes v0 des tests `compat.test.ts` passent sans `formats`).

- [x] **Step 3: Commande `setInstanceLayout` (tests rouges puis verts)**

`packages/core/src/instances.test.ts` :
```ts
test("setInstanceLayout moves and resizes within the grid, as a format, without overlap", () => {
  const doc = createProjectDoc(META);
  const page = addPage(doc, { title: "Tableau", kind: "dashboard", parentId: null });
  const a = addInstance(doc, { pageId: page.id, component: "kanban@1.0.0", layout: layoutFor("large", 0, 0) });
  const b = addInstance(doc, { pageId: page.id, component: "tickets@1.0.0", layout: layoutFor("large", 6, 0) });
  expect(setInstanceLayout(doc, a.id, layoutFor("medium", 0, 6)).layout).toEqual({ x: 0, y: 6, w: 6, h: 3 });
  expect(() => setInstanceLayout(doc, a.id, { x: 0, y: 0, w: 5, h: 5 })).toThrow(/not a component format/);
  expect(() => setInstanceLayout(doc, a.id, layoutFor("half", 1, 0))).toThrow(/outside the grid/);
  expect(() => setInstanceLayout(doc, a.id, layoutFor("large", 6, 3))).toThrow(new RegExp(`overlaps instance ${b.id}`));
  expect(() => setInstanceLayout(doc, "nope", layoutFor("small", 0, 0))).toThrow(/not found/);
  expect(executeProjectCommand(doc, { method: "setInstanceLayout", instanceId: b.id, layout: layoutFor("half", 0, 9) })).toMatchObject({ layout: { x: 0, y: 9, w: 12, h: 6 } });
});
test("setInstanceLayout is reserved to the shell", () => {
  expect(() => assertShellCommand({ method: "setInstanceLayout", instanceId: "i", layout: layoutFor("small", 0, 0) })).toThrow();
});
```
(`META`, `addPage` : reprendre les fixtures du fichier ; `executeProjectCommand` et `assertShellCommand` viennent de `commands.ts`.) Run: FAIL. `command.ts` : variante, `COMMAND_WRITES`, `CommandResult` ; `instances.ts` : `setInstanceLayout` ; `commands.ts` : `case "setInstanceLayout"` et ajout à la liste des commandes réservées (l. 99-100). Run: `bun test packages/core packages/schema` — Expected: PASS.

- [x] **Step 4: Contrôle des instances d'un lot (tests rouges puis verts, D48)**

`packages/core/src/validate-instances.test.ts` (modèle : `validate-update.test.ts` pour construire `before`/`after` : fork du doc, modification, `validateProjectUpdate(before, after, author)`) :
```ts
test("an updated instance must be a plain Instance stored under its id, inside the grid, with a format size", () => {
  const { before, after } = forkWithInstance(layoutFor("large", 0, 0));
  expect(instancesUpdateViolation(before, after)).toBeNull();
  expect(instancesUpdateViolation(before, withLayout(before, { x: 0, y: 0, w: 5, h: 5 }))).toMatch(/not a component format/);
  expect(instancesUpdateViolation(before, withLayout(before, { x: 8, y: 0, w: 6, h: 3 }))).toMatch(/outside the grid/);
  expect(instancesUpdateViolation(before, withRawInstance(before, "i9", { id: "other" }))).toMatch(/stored under another key|invalid/);
  expect(instancesUpdateViolation(before, withContainerInstance(before))).toMatch(/plain value/);
});
test("overlaps are accepted and untouched legacy instances are not checked", () => {
  const legacy = docWithRawInstance({ x: 0, y: 0, w: 5, h: 5 });
  const after = withNewInstance(legacy, layoutFor("small", 0, 0));
  expect(instancesUpdateViolation(legacy, after)).toBeNull();
});
test("validateProjectUpdate and validateSharedSnapshot apply the instance rules", () => {
  const { before } = forkWithInstance(layoutFor("large", 0, 0));
  const bad = withLayout(before, { x: 0, y: 0, w: 5, h: 5 });
  expect(validateProjectUpdate(before, bad, EDITOR)).toMatchObject({ ok: false });
  expect(instancesSnapshotViolation(docWithRawInstance({ x: 0, y: 0, w: 5, h: 5 }))).toMatch(/not a component format/);
  expect(validateSharedSnapshot(docWithRawInstance({ x: 0, y: 0, w: 5, h: 5 }), "p1", "u1")).toMatchObject({ ok: false });
});
```
(Helpers du test : `forkWithInstance`, `withLayout` (`doc.fork()` puis `setInstanceLayout` ou écriture brute `doc.getMap("instances").set(id, {...})` pour contourner le core), `withRawInstance`, `withContainerInstance` (`setContainer(id, new LoroMap())`), `docWithRawInstance`, `EDITOR = { userId: "u1", role: "editor" }`.) Run: FAIL. `validate-instances.ts` : parcourir `after.getMap("instances")` ; pour chaque clé dont la valeur diffère de `before` (`JSON.stringify` des deux valeurs simples, ou présence d'un conteneur) : `isContainer` ⇒ `instance <id> must be a plain value` ; `Instance.safeParse` ⇒ `instance <id> has an invalid value` ; `value.id !== key` ⇒ `instance <id> is stored under another key` ; `!inGrid` ⇒ `instance <id>: layout is outside the grid` ; `!isFormatLayout` ⇒ `instance <id>: layout is not a component format`. `instancesSnapshotViolation` applique les mêmes règles à toutes les instances. Brancher dans `validateProjectUpdate` (après `keyViolation`) et dans `validateSharedSnapshot`. Exporter depuis `core/index.ts`. Run: PASS.

- [x] **Step 5: Propriété fast-check et serveur (tests rouges puis verts)**

`validate-instances.test.ts`, propriété : une suite aléatoire de commandes `addInstance` (format et position aléatoires, rejetées si `INVALID_INPUT`) et `setInstanceLayout` (format et position aléatoires, rejetées si `INVALID_INPUT`) sur un doc projet produit, à chaque pas, un `after` tel que `validateProjectUpdate(before, after, EDITOR).ok === true` et aucune paire d'instances de la même page ne se chevauche :
```ts
test("commands never produce a doc the server rejects", () => {
  fc.assert(fc.property(fc.array(fc.record({ format: fc.constantFrom(...COMPONENT_FORMATS), x: fc.nat(11), y: fc.nat(30), op: fc.constantFrom("add", "move") }), { maxLength: 25 }), (ops) => {
    const doc = createProjectDoc(META);
    const page = addPage(doc, { title: "T", kind: "dashboard", parentId: null });
    for (const op of ops) {
      const before = doc.fork();
      const layout = layoutFor(op.format, op.x, op.y);
      try {
        if (op.op === "add" || listInstances(doc).length === 0) addInstance(doc, { pageId: page.id, component: "kanban@1.0.0", layout });
        else setInstanceLayout(doc, listInstances(doc)[0]!.id, layout);
      } catch (e) { if (!(e instanceof KiboError && e.code === "INVALID_INPUT")) throw e; }
      expect(validateProjectUpdate(before, doc, EDITOR)).toEqual({ ok: true });
    }
  }));
});
```
(`addInstance` avec un `layout` explicite doit lui aussi refuser hors grille / hors format / chevauchement : l'ajouter dans `addInstance` (`instances.ts:36-44`) en réutilisant la même vérification que `setInstanceLayout` ; un `layout` absent garde le défaut `half` à `(0, 0)` **sans** contrôle de chevauchement, comme aujourd'hui.) `packages/sync-server/src/room.test.ts` : un test « a push that resizes an instance to 5 × 5 is rejected and audited » et un test « a push that overlaps two instances is accepted » (modèle : les tests de `push` existants du fichier, `RoomReject` avec code `UPDATE_REJECTED`). Run: `bun test packages/core packages/sync-server` — Expected: PASS.

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/schema packages/core packages/sync-server packages/daemon` — Expected: PASS (le démon compile avec la nouvelle variante de commande ; `project-rpc.test.ts` inchangé).
```bash
git add packages/schema/src/format.ts packages/schema/src/format.test.ts packages/schema/src/manifest.ts packages/schema/src/manifest.test.ts packages/schema/src/protocol.ts packages/schema/src/index.ts
git commit -m "feat(schema): formats de composant"
git add packages/schema/src/command.ts packages/schema/src/command.test.ts packages/core/src/instances.ts packages/core/src/instances.test.ts packages/core/src/commands.ts
git commit -m "feat(core): commande setInstanceLayout"
git add packages/core/src/validate-instances.ts packages/core/src/validate-instances.test.ts packages/core/src/validate-update.ts packages/core/src/validate-snapshot.ts packages/core/src/index.ts packages/sync-server/src/room.test.ts
git commit -m "feat(core): instances contrôlées à la sync"
```

---

### Task 47: SDK : `format` dans le contexte, SDK simulé, conformité par format, composants intégrés

> **Amendement (relecture lead de T46).** `packages/sdk/src/sandbox.test.tsx` : le message `init` avec `format: "large"` donne `useSdk().format === "large"` ; **sans `format`** (hôte antérieur : la fixture `init` existante, inchangée), `useSdk().format === defaultFormatOf(manifest)` (`"medium"` pour le manifeste `widget` du fichier). `sandbox.tsx` : `format: init.format ?? defaultFormatOf(manifest)`. Un `view` qui déclare `full` et d'autres formats est rendu en surface `widget` pour ces derniers par la conformité.

Vague 1 ← T46. Spec composants §17.2, §17.3, §17.4 (première moitié : conformité par format ; les largeurs fixes sont en T51). Décision 2, 8 (`MockSdk.backend`). `mock.ts` (315 l.) descend sous 300 en extrayant son dispatcher `handle` dans `mock-calls.ts`. Mineures casées : `article` focusable en lecture seule (Kanban), ancêtre de contexte non atténué (arbre Tickets).

**Files:**
- Create: `packages/sdk/src/mock-calls.ts`
- Modify: `packages/sdk/src/types.ts`, `sdk.ts`, `sandbox.tsx`, `sandbox.test.tsx`, `mock.ts`, `mock-v1.test.ts`, `conformance.tsx`, `dev.tsx`, `dev-fr.ts`, `dev.test.tsx`, `packages/devkit/src/validate.ts`, `validate.test.ts` ; `components/kanban/kibo.component.json`, `components/tickets/kibo.component.json`, `components/graph/kibo.component.json`, `components/notes/kibo.component.json`, `components/mcp-source/kibo.component.json`, `components/mcp-source/src/McpSource.tsx`, `components/mcp-source/src/mcp-source.test.tsx` (nom réel : `ls components/mcp-source/src/*.test.tsx`), `components/kanban/src/KanbanCard.tsx`, `kanban.test.tsx`, `components/tickets/src/TicketsTree.tsx`, `tickets.test.tsx`, `packages/ui/src/registry.ts` si les manifestes y sont recopiés (`grep -n "formats\|kind" packages/ui/src/registry.ts`)

**Interfaces:**
- Consumes: `ComponentFormat`, `formatsOf`, `defaultFormatOf`, `surfaceFor`, `FORMAT_SIZES`, `formatIssue` (T46).
- Produces: contrat « SDK (T47) ».

- [x] **Step 1: `format` dans le contexte du SDK (tests rouges puis verts)**

`packages/sdk/src/mock-v1.test.ts` :
```ts
test("the mock exposes the format, defaulting to the manifest's default format", () => {
  const m = createMockSdk({ ...manifest, kind: "both", formats: ["small", "full"] });
  expect(m.sdk.format).toBe("small");
  expect(createMockSdk(manifest, { format: "half" }).sdk.format).toBe("half");
  expect(typeof m.backend.call).toBe("function");
});
```
`packages/sdk/src/sandbox.test.tsx` : le message `init` avec `format: "large"` donne `useSdk().format === "large"` dans le composant monté (modèle : le test d'`init` existant du fichier). Run: FAIL. `types.ts` (`format` dans `KiboSdk` et `SdkContext`), `sdk.ts` (recopie `ctx.format`), `sandbox.tsx` (`format: init.format ?? defaultFormatOf(manifest)`), `mock.ts` (`format: opts.format ?? defaultFormatOf(manifest)`, `backend` exposé = l'objet passé à `createSdk`), extraction de `handle` et `listEntity` dans `mock-calls.ts` (`createMockCalls(deps): (c: ComponentCall) => Promise<unknown>`), `mock.ts` < 300 lignes. Run: `bun test packages/sdk` — Expected: PASS.

- [x] **Step 2: Conformité par format (test rouge puis vert)**

`packages/sdk/src/conformance.test.tsx` (existe ? sinon `sdk-v1.test.ts` ; vérifier avec `grep -ln runConformance packages/sdk/src/*.test.ts*`) : une fixture `both` avec `formats: ["small", "full"]` dont le composant rend `useSdk().format` ; après `runConformance`, les noms des tests générés contiennent `small (widget)` et `full (view)` (lire `describe`/`test` enregistrés via un `bun:test` réel : le plus simple est de faire de ce test un fichier qui appelle `runConformance` sur la fixture et vérifie, dans un `afterAll`, que le composant a été rendu avec les deux formats : la fixture pousse `sdk.format` dans un tableau partagé).
`conformance.tsx` : `for (const format of formatsOf(manifest))` avec `surface = surfaceFor(manifest, format)`, `createMockSdk(manifest, { …, surface, format })`, nom `renders an ${label} as ${format} (${surface}) in ${theme} within its declared permissions`. Run: `bun test packages/sdk components` — Expected: PASS (les intégrés passent dans leurs formats par défaut).

- [x] **Step 3: Aperçu `kibo component dev` par format et `formatIssue` à la validation (tests rouges puis verts)**

`dev.test.tsx` : un bouton par format déclaré (`devFr.formats[f]`), le cadre de l'aperçu a `style.width`/`style.height` de `formatBox` (`FORMAT_SIZES[f]` × 80 px et colonne `(1200 − 11 × 16) / 12`, écart 16 : définir `formatBox` dans `dev.tsx` localement, l'interface aura le sien dans `format-grid.ts`). `packages/devkit/src/validate.test.ts` : un manifeste `view` avec `formats: ["large"]` fait échouer le pas `manifest` avec le message de `formatIssue`. Run: FAIL puis PASS.

- [x] **Step 4: Composants intégrés : formats déclarés et `small` de Source MCP (tests rouges puis verts)**

Manifestes : kanban `"formats": ["large", "half", "full"]`, tickets `["medium", "large", "half", "full"]`, graph `["large", "half", "full"]`, notes `["medium", "large", "half", "full"]`, mcp-source `["small", "medium", "large", "half"]`. Test mcp-source : avec `createMockSdk(manifest, { format: "small", … })`, le composant rend le titre, « n éléments » et un bouton « Ouvrir la source », et pas la liste ; en `medium`, la liste. Implémenter dans `McpSource.tsx` (`useSdk().format === "small"`). Run: `bun test components` — Expected: PASS (la conformité de chaque intégré rend chaque format déclaré).

- [x] **Step 5: Mineures Kanban et Tickets (tests rouges puis verts)**

`kanban.test.tsx` : en lecture seule (`shared: true`, membre `viewer`), l'`article` d'une carte n'a pas `tabIndex` (`getAttribute("tabindex")` null) ; en écriture, il en a un. `KanbanCard.tsx` : `tabIndex` seulement quand `useSortable` n'est pas désactivé. `tickets.test.tsx` : avec la recherche « schéma », l'ancêtre affiché pour le contexte porte `data-context="true"` et la classe `text-muted-foreground`, la ligne qui correspond non. `TicketsTree.tsx` : marquer les ancêtres de contexte (déjà calculés par `filter-tickets.ts`). Run: PASS.

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/sdk packages/devkit components packages/ui` — Expected: PASS.
```bash
git add packages/sdk/src/types.ts packages/sdk/src/sdk.ts packages/sdk/src/sandbox.tsx packages/sdk/src/sandbox.test.tsx packages/sdk/src/mock.ts packages/sdk/src/mock-calls.ts packages/sdk/src/mock-v1.test.ts
git commit -m "feat(sdk): format dans le contexte et le mock"
git add packages/sdk/src/conformance.tsx <test de conformité> packages/sdk/src/dev.tsx packages/sdk/src/dev-fr.ts packages/sdk/src/dev.test.tsx packages/devkit/src/validate.ts packages/devkit/src/validate.test.ts
git commit -m "feat(sdk): conformité et aperçu par format"
git add components/*/kibo.component.json components/mcp-source/src/McpSource.tsx <test mcp-source> components/kanban/src/KanbanCard.tsx components/kanban/src/kanban.test.tsx components/tickets/src/TicketsTree.tsx components/tickets/src/tickets.test.tsx
git commit -m "feat(components): formats déclarés"
```

---

### Task 48: UI : grille adaptative, chevauchements résolus, mode « Modifier la disposition », menu Format

> **Amendement (relecture lead de T46).** Files › Modify : ajouter `packages/ui/src/shell/frame-bridge.ts`, `frame-bridge.test.ts`, `sandbox-frame.test.tsx` (à stager au pas 5). `BridgeDeps.init(): Omit<InitMessage, "kibo" | "type"> & { format: ComponentFormat }` : l'envoi de `format` est imposé par le type, le schéma `HostToFrame` reste tolérant et n'est pas modifié. `instanceFormat` d'une instance 5 × 5 vaut `"medium"`. `addInstance` avec disposition explicite refuse désormais un chevauchement (`INVALID_INPUT`) : `AddComponentDialog` doit calculer la place sur l'état courant.

Vague 1 ← T45, T46, T47. Spec §16.1, §16.2 ; écrans **127, 128, 129**. Décisions 2, 3, 4. `PageView` garde le rendu de lecture (via `DashboardGrid`) et un bouton ; le mode disposition est un chunk. Chaque instance reçoit son `format` (`InstanceFrame`, `SandboxFrame`). `lib/next-layout.ts` disparaît au profit de `lib/format-grid.ts`.

**Files:**
- Create: `packages/ui/src/lib/format-grid.ts`, `format-grid.test.ts`, `packages/ui/src/pages/DashboardGrid.tsx`, `use-wide-grid.ts`, `LayoutEditor.tsx`, `LayoutToolbar.tsx`, `FormatMenu.tsx`, `layout-editor.test.tsx`, `packages/ui/src/i18n/fr-layout.ts`
- Modify: `packages/ui/src/pages/PageView.tsx`, `page-view.test.tsx`, `InstanceFrame.tsx`, `instance.test.tsx`, `packages/ui/src/shell/SandboxFrame.tsx`, `packages/ui/src/dialogs/AddComponentDialog.tsx` (et son test : `grep -ln "nextLayout\|AddComponentDialog" packages/ui/src/dialogs/*.test.tsx`), `packages/ui/src/i18n/fr.ts`
- Delete: `packages/ui/src/lib/next-layout.ts`, `next-layout.test.ts`

**Interfaces:**
- Consumes: `ComponentFormat`, `FORMAT_SIZES`, `formatOf`, `nearestFormat`, `layoutFor`, `inGrid`, `overlaps`, `formatsOf`, `defaultFormatOf`, `surfaceFor` (T46) ; `SdkContext.format` (T47) ; `DndContext`, `PointerSensor`, `useDraggable`, `DragMoveEvent`, `DragEndEvent` (`@dnd-kit/core`) ; `DropdownMenu*`, `ConfirmDialog` (lazy-dialogs) ; `InstanceMenu` (T45) ; `canEdit`, `useFlash`, `errorMessage`, `client`.
- Produces: contrat « UI (T48) » : `format-grid.ts`, `useWideGrid`, `DashboardGrid`, `LayoutEditor`, `InstanceFrame.format`, `frLayout`.

- [x] **Step 1: Grille pure (tests rouges puis verts, propriété fast-check)**

`packages/ui/src/lib/format-grid.test.ts` :
```ts
import { describe, expect, test } from "bun:test";
import { COMPONENT_FORMATS, type Instance, layoutFor, overlaps } from "@kibo/schema";
import fc from "fast-check";
import { canPlace, cellMetrics, dropTarget, formatBox, instanceFormat, nextLayout, readingOrder, resolveOverlaps } from "./format-grid";

const inst = (id: string, layout: Instance["layout"]): Instance => ({ id, pageId: "pg", component: "kanban@1.0.0", layout, config: {}, componentHash: null });

describe("format grid", () => {
  test("cellMetrics and formatBox at 1200 px", () => {
    const m = cellMetrics(1200);
    expect(m).toEqual({ column: (1200 - 16 * 11) / 12, row: 80, gap: 16 });
    expect(formatBox("small", 1200)).toEqual({ width: 3 * m.column + 2 * 16, height: 3 * 80 + 2 * 16 });
  });
  test("readingOrder sorts by y, x then id", () => {
    const out = readingOrder([inst("b", layoutFor("small", 3, 0)), inst("a", layoutFor("small", 0, 0)), inst("c", layoutFor("small", 0, 3))]);
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  test("resolveOverlaps pushes the later widget down and keeps a clean grid intact", () => {
    const clean = [inst("a", layoutFor("large", 0, 0)), inst("b", layoutFor("large", 6, 0))];
    expect([...resolveOverlaps(clean).values()]).toEqual(clean.map((i) => i.layout));
    const dirty = [inst("a", layoutFor("large", 0, 0)), inst("b", layoutFor("medium", 0, 3))];
    expect(resolveOverlaps(dirty).get("b")).toEqual(layoutFor("medium", 0, 6));
  });
  test("resolveOverlaps never loses a widget nor leaves an overlap (property)", () => {
    const arb = fc.array(fc.record({ format: fc.constantFrom(...COMPONENT_FORMATS), x: fc.nat(11), y: fc.nat(40) }), { maxLength: 12 });
    fc.assert(fc.property(arb, (specs) => {
      const instances = specs.map((s, i) => inst(`i${i}`, layoutFor(s.format, Math.min(s.x, 12 - s.format.length), s.y)));
      const out = resolveOverlaps(instances);
      expect(out.size).toBe(instances.length);
      const layouts = [...out.values()];
      for (let a = 0; a < layouts.length; a++) for (let b = a + 1; b < layouts.length; b++) expect(overlaps(layouts[a]!, layouts[b]!)).toBe(false);
    }));
  });
  test("nextLayout, dropTarget, canPlace, instanceFormat", () => {
    expect(nextLayout([layoutFor("large", 0, 0)], { w: 6, h: 6 })).toEqual(layoutFor("large", 6, 0));
    expect(nextLayout([layoutFor("half", 0, 0)], { w: 3, h: 3 })).toEqual(layoutFor("small", 0, 6));
    const m = cellMetrics(1200);
    expect(dropTarget(layoutFor("small", 0, 0), { x: 2 * (m.column + 16) + 10, y: -5 }, m)).toEqual(layoutFor("small", 2, 0));
    expect(dropTarget(layoutFor("half", 0, 0), { x: 500, y: 0 }, m)).toEqual(layoutFor("half", 0, 0));
    expect(canPlace(layoutFor("small", 0, 0), [layoutFor("small", 2, 2)])).toBe(false);
    expect(instanceFormat(inst("a", { x: 0, y: 0, w: 5, h: 5 }), { kind: "dashboard" })).toBe("medium");
    expect(instanceFormat(inst("a", layoutFor("small", 0, 0)), { kind: "view" })).toBe("full");
  });
});
```
(Dans la propriété, `Math.min(s.x, 12 - s.format.length)` n'est qu'un exemple de borne : utiliser `12 - FORMAT_SIZES[s.format].w`.) Run: FAIL. Implémenter `format-grid.ts` : `resolveOverlaps` parcourt `readingOrder`, garde chaque disposition si `canPlace` par rapport aux déjà posées, sinon incrémente `y` jusqu'à la première rangée libre (bornée par `MAX_GRID_ROWS - h`) ; `dropTarget` arrondit `delta.x / (column + gap)` et `delta.y / (row + gap)` puis borne dans la grille ; `instanceFormat` = `full` sur une page `view`, sinon `formatOf(layout) ?? nearestFormat(layout)`. Supprimer `next-layout.ts` et son test. Run: PASS.

- [x] **Step 2: Grille de lecture adaptative et format transmis (tests rouges puis verts, écran 129)**

`page-view.test.tsx` : (a) deux instances qui se chevauchent dans le snapshot sont rendues sans chevauchement (`gridRow` de la seconde commence à `7`) ; (b) `useWideGrid` à `false` (simuler `window.matchMedia` qui renvoie `matches: false` : happy-dom expose `matchMedia`, sinon le remplacer dans le test par `Object.defineProperty(window, "matchMedia", …)`) ⇒ les cellules n'ont ni `gridColumn` ni `gridRow`, le conteneur a `grid-cols-1`, l'ordre DOM suit `readingOrder`, le bouton « Modifier la disposition » est absent ; (c) en large et éditable, le bouton est présent ; en `read-only`, absent. `instance.test.tsx` : le `Probe` monté par `InstanceFrame` avec `format="small"` voit `useSdk().format === "small"` ; `SandboxFrame` reçoit `format` et le met dans `init` (test existant du pont : `grep -n "init" packages/ui/src/shell/*.test.ts*`). Run: FAIL. `DashboardGrid.tsx` : `grid gap-4 p-4` + `grid-cols-12 auto-rows-[80px]` ou `grid-cols-1 auto-rows-[80px]` selon `narrow` ; `@container` sur le corps de chaque widget (`<div className="@container min-h-0 flex-1 overflow-auto">`) ; `PageView.tsx` : `layouts = resolveOverlaps(instances)`, `wide = useWideGrid()`, `format = instanceFormat(i, page)` passé à `InstanceFrame` ; `use-wide-grid.ts` : `matchMedia(WIDE_QUERY)` + `change` (modèle `packages/sdk/src/hooks/use-mobile.ts`) ; `InstanceFrame.tsx` : `format` dans `createSdk` et `SandboxFrame` ; `SandboxFrame.tsx` : `format` dans `init` ; `frame-bridge.ts` : `BridgeDeps.init(): Omit<InitMessage, "kibo" | "type"> & { format: ComponentFormat }` (l'oubli ne compile pas ; le schéma `HostToFrame` reste tolérant et n'est pas modifié) ; `frame-bridge.test.ts` et `sandbox-frame.test.tsx` : la fixture `init` porte `format`, et le message posté contient `format: "large"` pour une instance 6 × 6. `PageView.tsx` reste < 130 lignes. Run: PASS.

- [x] **Step 3: Mode disposition (tests rouges puis verts, écrans 127 et 128)**

`layout-editor.test.tsx` (mock `../api` avec `calls` et `answer` réassignable ; `LayoutEditor` importé après) :
```tsx
test("screen 127/128: Format menu offers the declared formats, disables what does not fit, and Save sends one command per change", async () => {
  const user = userEvent.setup();
  render(<LayoutEditor projectId="p1" page={dashboard} instances={[kanban(layoutFor("large", 0, 0)), tickets(layoutFor("large", 6, 0))]} formatsFor={() => ["medium", "large", "half", "full"]} renderWidget={(i) => <p>{i.component}</p>} onClose={onClose} />);
  expect(screen.getByRole("toolbar", { name: "Disposition" })).toHaveTextContent("Aucun changement");
  await user.click(screen.getByRole("button", { name: "Format de Tickets" }));
  expect(screen.getByRole("menuitemradio", { name: /Large · 6 × 6/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("menuitemradio", { name: /Plein écran/ }).getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ }));
  expect(screen.getByRole("toolbar", { name: "Disposition" })).toHaveTextContent("1 changement");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(calls).toContainEqual({ method: "command", projectId: "p1", command: { method: "setInstanceLayout", instanceId: "tickets", layout: layoutFor("medium", 6, 0) } }));
  expect(onClose).toHaveBeenCalled();
});
test("a refused command keeps the editor open with the error, Cancel and Escape restore", async () => { /* answer = () => new KiboError("FORBIDDEN", "read only") ; alert visible ; onClose non appelé ; Échap ⇒ onClose */ });
test("dropInGrid moves a widget when the target cell is free and ignores an occupied one", () => {
  // fonction pure extraite de onDragEnd : moveWidget(draft, id, delta, metrics, others) ⇒ { draft, placed: boolean }
});
```
(Le glisser ne se simule pas sous happy-dom : la logique de dépôt est une fonction pure `moveWidget(layouts, id, delta, metrics)` testée directement ; `onDragMove` calcule la cellule visée pour l'aperçu, `onDragEnd` applique `moveWidget`.) Run: FAIL. `LayoutEditor.tsx` : `DndContext` (`PointerSensor`, `activationConstraint: { distance: 6 }`), `useDraggable({ id })` sur l'en-tête de chaque widget (libellé `frLayout.move(title)`, `cursor-grab`), état `draft: Map<id, Layout>` initialisé par `resolveOverlaps(instances)`, `ghost` (cellule visée) rendu par `DashboardGrid.overlay`, `ResizeObserver` sur la grille pour `cellMetrics(width)`, `FormatMenu` (`DropdownMenuRadioGroup`, un item par format déclaré avec `frLayout.formats[f]` et `frLayout.size(w, h)`, désactivé si `!canPlace(layoutFor(f, x, y), others)` avec aide `noRoom`), bouton « Retirer <titre> » qui ouvre le `ConfirmDialog` existant d'`InstanceMenu` (réutiliser `InstanceMenu` tel quel dans l'en-tête), `LayoutToolbar` (`role="toolbar"`, compteur, Annuler, Enregistrer), Échap = Annuler, Enregistrer = commandes dans `readingOrder` ; une erreur laisse les ids refusés dans `draft` et affiche `saveFailed(title)` + `errorMessage(e)`. `PageView.tsx` : `editing` ⇒ `<LayoutEditor …/>` via `lazyPanel(() => import("./LayoutEditor"))`, sinon la grille de lecture ; `fr.ts` : `page.editLayout`, `page.editLayoutNarrow`. `fr-layout.ts` : textes des écrans 127 et 128. Run: PASS.

- [x] **Step 4: Ajout d'un composant à la taille de son format (test rouge puis vert)**

Test du dialogue d'ajout : ajouter `kanban` sur une page qui a déjà un `large` en (0, 0) ⇒ `addInstance` avec `layout: layoutFor("large", 6, 0)` ; ajouter un composant tiers `widget` à formats `["small"]` ⇒ `layoutFor("small", …)`. `AddComponentDialog.tsx` : `nextLayout(taken, FORMAT_SIZES[defaultFormatOf(manifest)])` où `manifest` = `findBuiltin(id)?.manifest ?? summary.versions.find((v) => v.version === version)?.manifest`, et `{ w: 6, h: 6 }` si le manifeste est inconnu. Run: PASS.

- [x] **Step 5: Captures, gate et commits**

Captures `screens/t48/` : 127, 128, 129 en sombre et en clair (projet Kibo avec Kanban, Tickets, Graphe, Notes ; fenêtre 1440 px puis 900 px).
Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS, budget ≤ 220,0 kB, aucun module interdit.
```bash
git add packages/ui/src/lib/format-grid.ts packages/ui/src/lib/format-grid.test.ts packages/ui/src/pages/DashboardGrid.tsx packages/ui/src/pages/use-wide-grid.ts packages/ui/src/pages/PageView.tsx packages/ui/src/pages/page-view.test.tsx packages/ui/src/pages/InstanceFrame.tsx packages/ui/src/pages/instance.test.tsx packages/ui/src/shell/SandboxFrame.tsx packages/ui/src/i18n/fr.ts
git rm -q packages/ui/src/lib/next-layout.ts packages/ui/src/lib/next-layout.test.ts
git commit -m "feat(ui): grille adaptative et format des widgets"
git add packages/ui/src/pages/LayoutEditor.tsx packages/ui/src/pages/LayoutToolbar.tsx packages/ui/src/pages/FormatMenu.tsx packages/ui/src/pages/layout-editor.test.tsx packages/ui/src/i18n/fr-layout.ts packages/ui/src/pages/PageView.tsx
git commit -m "feat(ui): mode Modifier la disposition"
git add packages/ui/src/dialogs/AddComponentDialog.tsx <test du dialogue>
git commit -m "feat(ui): ajout à la taille du format par défaut"
```

---

### Task 49: Parcours E2E de la disposition

Vague 2 ← T48. Une spec Playwright, en sombre et en clair (ports **4423–4424**, scénario `question`), qui capture les écrans 127 à 129 et vérifie de bout en bout : format changé par le menu, widget déplacé par glisser, enregistrement, persistance après rechargement, annulation, grille étroite.

**Files:**
- Create: `e2e/layout.spec.ts`
- Modify: `e2e/playwright.config.ts`

**Interfaces:**
- Consumes: `pairAndCreateProject`, `createPage`, `addComponent` (`e2e/helpers.ts`), `shot` (`e2e/repo-project.ts`), `rpc` (`e2e/agents-seed.ts`).
- Produces: rien.

- [x] **Step 1: Deux démons de plus**

`e2e/playwright.config.ts`, après `confort-light` :
```ts
  { name: "layout-dark", scheme: "dark", port: 4423, spec: /layout\.spec\.ts/, scenario: "question" },
  { name: "layout-light", scheme: "light", port: 4424, spec: /layout\.spec\.ts/, scenario: "question" },
```

- [x] **Step 2: Disposition (rouge tant que T48 n'est pas intégrée, vert ensuite)**

`e2e/layout.spec.ts` :
```ts
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

const widget = (page: Page, title: string): Locator => page.locator("[data-instance]").filter({ has: page.getByText(title, { exact: true }) }).first();
const layoutOf = (w: Locator) => w.getAttribute("data-layout");

test("formats et disposition d'un tableau de bord", async ({ page }, info) => {
  await pairAndCreateProject(page, info, "LAY");
  await createPage(page, "Tableau de bord", "dashboard");
  await addComponent(page, "Kanban");
  await addComponent(page, "Tickets");
  await expect(widget(page, "Kanban")).toHaveAttribute("data-layout", "0,0,6,6");
  await expect(widget(page, "Tickets")).toHaveAttribute("data-layout", "6,0,6,6");

  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: "Format de Tickets" }).click();
  await shot(page, info, "ecran-128");
  await page.getByRole("menuitemradio", { name: /Moyen/ }).click();
  const handle = page.getByRole("button", { name: "Déplacer Tickets" });
  const box = await handle.boundingBox();
  if (!box) throw new Error("no handle");
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 10 + 96 * 4, { steps: 12 });
  await shot(page, info, "ecran-127");
  await page.mouse.up();
  await expect(page.getByRole("toolbar", { name: "Disposition" })).toContainText("2 changements");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("toolbar", { name: "Disposition" })).toHaveCount(0);
  await page.reload();
  await expect(widget(page, "Tickets")).toHaveAttribute("data-layout", "6,4,6,3");

  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: "Format de Kanban" }).click();
  await page.getByRole("menuitemradio", { name: /Demi-page/ }).click();
  await page.keyboard.press("Escape");
  await expect(widget(page, "Kanban")).toHaveAttribute("data-layout", "0,0,6,6");

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole("button", { name: "Modifier la disposition" })).toHaveCount(0);
  await expect(widget(page, "Kanban")).not.toHaveAttribute("data-layout", /./);
  await shot(page, info, "ecran-129");
  expect(await layoutOf(widget(page, "Tickets"))).toBeNull();
});
```
(`DashboardGrid` pose `data-instance={id}` et, en large, `data-layout="x,y,w,h"` sur chaque cellule : T48 l'ajoute si ce n'est pas fait ; le déplacement de 4 rangées = 4 × (80 + 16) px.) Run: `cd e2e && bunx playwright test --project=layout-dark --project=layout-light` — Expected: PASS, captures `ecran-127/128/129.png`.

- [x] **Step 3: Gate et commit**

Run: `bun run check && bun run typecheck` — Expected: PASS.
```bash
git add e2e/layout.spec.ts e2e/playwright.config.ts
git commit -m "test(e2e): disposition et formats"
```

---

### Task 50: Schéma, core et démon : images jointes, révision, parallélisme du générateur

> **Amendement après relecture lead (1er refus).** `start` : `checkAttachments(input.attachments)` avant `newDraft` (rien n'est créé si une image est refusée), `writeAttachments` juste après `prepareDraft` (`prepareNewDraft`), `removeDraft` si l'écriture échoue. `revise` : contrôles (`revised` à blanc), `writeAttachments` en ajout (refus `INVALID_INPUT` au-delà de `MAX_DRAFT_ATTACHMENTS_TOTAL`, extension du nom conforme au format détecté), `store.saveFeedback`, puis `launchDraft` avec `revisePrompt` ; la liste des images est persistée par l'événement `revised` (pas de `store.save` intermédiaire) ; si le lancement lève, les fichiers écrits par l'appel sont retirés et l'erreur relancée ; refus `CONFLICT` si la version relue est déjà publiée. `retry` : `fixPrompt` si le rapport est en échec, sinon `revisePrompt(brief, store.feedback(id), images)` quand `revisions > 0`, sinon `generatorPrompt`. Tests ajoutés : `revise` dont `runs.enqueue` lève ⇒ état et dossier inchangés ; `revise` puis run `failed`/`cancelled` puis `retry` ⇒ prompt qui contient le retour ; lien symbolique à la place de `<id>.attachments` ; total dépassé ⇒ `INVALID_INPUT` sans écriture ; `isProcessing` devenu vrai pendant `settled()` ⇒ `CONFLICT`.

Vague 0 ← T46 (pour `ComponentFormat` dans `StartComponentDraftInput.create.formats` ; démarrer en parallèle, rebaser). Spec IA **§13.1, §13.4, §13.6, §13.9**, agents §12, §14.2 (bornes). Décisions 6, 7. Les images vivent dans `<draftId>.attachments/`, hors du dossier du brouillon ; `reviseComponentDraft` relance la même session ; le profil `generateur` accepte 2 runs. `draft-lifecycle.ts` (275 l.) extrait `draft-launch.ts`. Relue par `kibo-lead`.

**Files:**
- Create: `packages/daemon/src/ai/draft-attachments.ts`, `draft-attachments.test.ts`, `draft-launch.ts`
- Modify: `packages/schema/src/ai.ts`, `ai.test.ts` (créer si absent), `ai-rpc.ts`, `index.ts` ; `packages/core/src/agent-profiles.ts`, `agent-profiles.test.ts` ; `packages/daemon/src/ai/draft-store.ts`, `draft-store.test.ts`, `draft-files.ts`, `draft-files.test.ts`, `draft-machine.ts`, `draft-machine.test.ts`, `draft-guard.ts`, `draft-guard.test.ts`, `draft-new.ts`, `draft-lifecycle.ts`, `draft-lifecycle.test.ts`, `draft-recovery.ts`, `methods.ts`, `methods.test.ts`, `ports.ts`, `live-ports.ts`, `prompts.ts` (champ `attachments` du brief seulement ; le contenu est en T51)

**Interfaces:**
- Consumes: `IconInput`, `IconMime` (`schema/icon.ts`), `decodeIcon` (`daemon/icons/decode-icon.ts`), `ComponentFormat`, `formatsOf` (T46), `DraftStore`, `applyDraftEvent`, `createDraftGuard`, `AgentRuns`.
- Produces: contrat « Schéma (T50) », « Core (T50) », « Démon (T50) ».

- [x] **Step 1: Schéma (tests rouges puis verts)**

`packages/schema/src/ai.test.ts` :
```ts
test("drafts carry attachments and revisions with defaults", () => {
  const d = ComponentDraft.parse(baseDraft);
  expect(d.attachments).toEqual([]);
  expect(d.revisions).toBe(0);
  expect(DraftAttachmentInput.safeParse({ name: "maquette.png", mime: "image/png", data: "AAAA" }).success).toBe(true);
  expect(DraftAttachmentInput.safeParse({ name: "../x.png", mime: "image/png", data: "AAAA" }).success).toBe(false);
  expect(DraftAttachments.parse(Array(5).fill({ name: "a.png", mime: "image/png", data: "AAAA" }))).toBeUndefined;
  expect(DraftAttachments.safeParse(Array(5).fill({ name: "a.png", mime: "image/png", data: "AAAA" })).success).toBe(false);
  expect(StartComponentDraftInput.parse({ mode: "create", id: "x", title: "X", kind: "widget", withServer: false, description: "a".repeat(20) })).toMatchObject({ attachments: [] });
  expect(ReviseComponentDraftInput.safeParse({ draftId: crypto.randomUUID(), feedback: "ok", attachments: [] }).success).toBe(false);
});
```
(Retirer la ligne `.toBeUndefined` sans appel : garder seulement le `safeParse`.) Run: FAIL. Écrire le contrat « Schéma (T50) » dans `ai.ts`, `ai-rpc.ts` (`reviseComponentDraft`, `previewComponentDraft`, résultats). Run: `bun test packages/schema` — Expected: PASS.

- [x] **Step 2: Profil générateur (tests rouges puis verts)**

`packages/core/src/agent-profiles.test.ts` : `ensureSystemProfiles` sur un workspace neuf crée `generateur` avec `maxParallel: 2` et `assistant` avec 1 ; un workspace où `generateur` existe avec 1 le garde ; `updateProfile(ws, "generateur", { maxParallel: 3 })` passe, `{ maxParallel: 5 }` ⇒ `INVALID_INPUT`, `{ workspace: "repo" }` ⇒ `INVALID_INPUT`. Run: FAIL. `agent-profiles.ts` : `SYSTEM_EDITABLE` + `maxParallel`, `SYSTEM_MAX_PARALLEL`, `SYSTEM_DEFAULT_PARALLEL`, `systemProfile` (`maxParallel: current?.maxParallel ?? SYSTEM_DEFAULT_PARALLEL[id]`), `assertEditable` borne. Run: PASS.

- [x] **Step 3: Images jointes (tests rouges puis verts)**

`draft-attachments.test.ts` :
```ts
test("writeAttachments decodes, numbers, protects and lists; a wrong signature writes nothing", () => {
  const dir = join(tmp(), "d.attachments");
  const png = { name: "maquette.png", mime: "image/png" as const, data: pngBase64() };
  const list = writeAttachments(dir, [png, { ...png, name: "b.webp" }], []);
  expect(list.map((a) => a.name)).toEqual(["maquette.png", "b.webp"]);
  expect(readdirSync(dir).sort()).toEqual(["1-maquette.png", "2-b.webp"]);
  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(attachmentPaths(dir, list)).toEqual([join(dir, "1-maquette.png"), join(dir, "2-b.webp")]);
  expect(() => writeAttachments(dir, [{ name: "evil.png", mime: "image/png", data: btoa("GIF89a…") }], list)).toThrow(KiboError);
  expect(readdirSync(dir).length).toBe(2);
  expect(writeAttachments(dir, [png], list).map((a) => a.name)).toEqual(["maquette.png", "b.webp", "maquette.png"]);
  expect(readdirSync(dir)).toContain("3-maquette.png");
});
```
(`pngBase64()` : les 8 octets de signature PNG suivis de quelques octets ; `decodeIcon` lit la signature.) `draft-files.test.ts` : `draftPaths(home, id).attachmentsDir` = `…/<id>.attachments` ; `removeDraft` supprime le dossier des images ; `prepareDraft` refuse si `attachmentsDir` existe déjà ; `verifyAndRestore` et `agentFiles` ignorent le dossier (il est hors de `dir`). `draft-guard.test.ts` : avec `readRoots: [sdkDir, attachmentsDir]`, `Read` d'un fichier du dossier des images est accepté, `Write` refusé (« writes are limited to the draft folder »), `Glob` sur ce dossier accepté. Run: FAIL puis PASS.

- [x] **Step 4: Magasin et machine (tests rouges puis verts)**

`draft-store.test.ts` : une base créée par l'ancien `CREATE TABLE` (sans `attachmentsJson` ni `revisions`) est migrée à l'ouverture (`PRAGMA table_info`), `save` persiste `attachments` et `revisions`, une ligne ancienne se lit avec `[]` et `0`. `draft-machine.test.ts` : `revised` depuis `review` ⇒ `generating`, `runId`, `attempts: 1`, `revisions: 1`, `failure: null`, `incidents: []` ; depuis `permissions` idem ; depuis `generating`, `failed`, `done` ⇒ `INVALID_INPUT` ; à `revisions: 10` ⇒ `INVALID_INPUT` (« no revision left ») ; `canRevise`. Run: FAIL puis PASS (`UpdateParams` gagne `attachmentsJson`, `revisions`).

- [x] **Step 5: `revise` dans le cycle (tests rouges puis verts)**

`draft-lifecycle.test.ts` (faux ports du fichier) :
```ts
test("revise relaunches the same session with the feedback and new attachments, from review", async () => {
  const { lifecycle, runs, store } = setup();
  const d = await lifecycle.start({ mode: "create", id: "burndown", title: "Burndown", kind: "widget", withServer: false, description: "x".repeat(20), attachments: [png("a.png")] });
  await endRun(runs, d.runId!, "done"); await validated(store, d.id);
  const revised = await lifecycle.revise({ draftId: d.id, feedback: "Mets le total en gros", attachments: [png("b.png")] });
  expect(revised).toMatchObject({ status: "generating", revisions: 1, attempts: 1 });
  expect(revised.attachments.map((a) => a.name)).toEqual(["a.png", "b.png"]);
  const last = runs.requests.at(-1)!;
  expect(last.resumeSessionId).toBe(d.sessionId);
  expect(last.prompt).toContain("Mets le total en gros");
  expect(last.prompt).toContain("2-b.png");
  expect(last.env.KIBO_DRAFT_ATTACHMENTS).toBe(draftPaths(home, d.id).attachmentsDir);
  await expect(lifecycle.revise({ draftId: d.id, feedback: "encore", attachments: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
```
(Adapter `setup`, `endRun`, `validated`, `png` aux helpers du fichier.) `methods.test.ts` : `reviseComponentDraft` route vers `lifecycle.revise`, refusé en `CONFLICT` si `publisher.isProcessing(draftId)` (même garde que `abandon`). Run: FAIL. `draft-launch.ts` : `launchDraft(deps, input: LaunchInput)` (extrait de `launch`, l. 145-167 : `markUnrestored`, `enqueue` avec `guard` dont `readRoots: [sdkDir, attachmentsDir]`, `env: { ...deps.env(), KIBO_DRAFT_ATTACHMENTS: attachmentsDir }`, événement `enqueued` ou `revised`) ; `draft-lifecycle.ts` : `start` écrit les images (`writeAttachments`) avant `prepare`, `revise` (contrôles, `writeAttachments` en ajout, `store.save` des `attachments`, `launchDraft` avec `revisePrompt` de `prompts.ts` : en T50 un texte minimal « Retour de l'utilisateur après aperçu : « … » » + liste des chemins + consigne de test ; T51 l'enrichit), `draft-new.ts` : `attachments: []`, `revisions: 0`, `formats` transmis au `scaffold` (`ScaffoldOptions.formats`, `live-ports.ts` l'écrit dans le manifeste : `formats: input.formats ?? formatsOf({ kind })` pour `create`, `formatsOf(latest.manifest)` pour `modify`) ; `draft-recovery.ts` : `abandon` et `removeDraft` couvrent `attachmentsDir` (déjà par `removeDraft`). `draft-lifecycle.ts` < 300 lignes. Run: `bun test packages/daemon/src/ai` — Expected: PASS.

- [x] **Step 6: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/schema packages/core packages/daemon` — Expected: PASS.
```bash
git add packages/schema/src/ai.ts packages/schema/src/ai.test.ts packages/schema/src/ai-rpc.ts packages/schema/src/index.ts
git commit -m "feat(schema): images jointes et révision d'un brouillon"
git add packages/core/src/agent-profiles.ts packages/core/src/agent-profiles.test.ts
git commit -m "feat(core): parallélisme du profil générateur"
git add packages/daemon/src/ai/draft-attachments.ts packages/daemon/src/ai/draft-attachments.test.ts packages/daemon/src/ai/draft-files.ts packages/daemon/src/ai/draft-files.test.ts packages/daemon/src/ai/draft-guard.ts packages/daemon/src/ai/draft-guard.test.ts packages/daemon/src/ai/draft-store.ts packages/daemon/src/ai/draft-store.test.ts
git commit -m "feat(daemon): images jointes d'un brouillon"
git add packages/daemon/src/ai/draft-machine.ts packages/daemon/src/ai/draft-machine.test.ts packages/daemon/src/ai/draft-launch.ts packages/daemon/src/ai/draft-lifecycle.ts packages/daemon/src/ai/draft-lifecycle.test.ts packages/daemon/src/ai/draft-new.ts packages/daemon/src/ai/draft-recovery.ts packages/daemon/src/ai/methods.ts packages/daemon/src/ai/methods.test.ts packages/daemon/src/ai/ports.ts packages/daemon/src/ai/live-ports.ts packages/daemon/src/ai/prompts.ts
git commit -m "feat(daemon): révision d'un brouillon par retour"
```

---

### Task 51: Démon et devkit : contexte de l'agent, aperçu d'un brouillon dans le bac à sable, largeurs fixes refusées, faux `claude`

> **Amendement après relecture lead (1er refus).** `preview()` : après `buildPreview` et avant toute écriture (mémoire, disque), relire l'état et recalculer l'empreinte ; différence ⇒ `CONFLICT` sans rien conserver ; une erreur de construction sur un brouillon qui n'est plus en `review`/`permissions` ⇒ `CONFLICT`. `buildComponent` : `componentCss(stageSources(stage), toolchain)`. `verifyAndRestore` supprime `.kibo/preview` à chaque fin de run. `responsive.ts` : règle de la spec composants §17.4 amendée (`max-w` retiré, `size-[Npx]` et nombre sans unité d'un `style={{ … }}` ajoutés, variante de conteneur et condition de requête exemptées). Jeton `bg-muted` ajouté au skill. `GRID_COLUMNS` importé du schéma. `fake-claude.test.ts` redescend sous 300 lignes. Tests : trois cas de course dans `draft-preview.test.ts`, classe hors sources absente de `ui.css` dans `build.test.ts`, cache planté purgé dans `draft-verify.test.ts`, cas de la règle dans `responsive.test.ts`.

> **Amendement (relecture lead de T50).** T50 livre `previewComponentDraft` en `KiboError("INTERNAL", …)` (test « the draft preview is refused until it is served » de `methods.test.ts`) : T51 remplace le cas et ce test. `generatorPrompt` et `revisePrompt` listent déjà les chemins des images (`imageLines`) : T51 enrichit le texte sans dupliquer la liste.

Vague 1 ← T46, T50. Spec IA **§13.7, §13.8, §13.11**, composants **§17.4** (largeurs fixes), **§17.5** (aperçu). Décision 8. `prompts.ts` (159 l.) extrait son skill et son exemple dans `prompts-skill.ts`. Relue par `kibo-lead` (listener sandbox, garde-fou, prompt).

**Files:**
- Create: `packages/daemon/src/ai/prompts-skill.ts`, `draft-preview.ts`, `draft-preview.test.ts`, `revision.int.test.ts`, `packages/devkit/src/responsive.ts`, `responsive.test.ts`, `packages/daemon/src/agents/scenarios/ai/generate-revise.json`, `generate-fixed-width.json`, `fixtures/burndown/ui-revised.tsx.fixture`, `ui-fixed-width.tsx.fixture`
- Modify: `packages/daemon/src/ai/prompts.ts`, `prompts.test.ts`, `live-ports.ts`, `bootstrap.ts`, `methods.ts`, `methods.test.ts`, `ports.ts` ; `packages/daemon/src/components/sandbox-server.ts`, `sandbox-server.test.ts` (nom réel : `ls packages/daemon/src/components/sandbox*.test.ts`), `asset-path.ts`, `asset-path.test.ts`, `packages/daemon/src/daemon.ts` ; `packages/devkit/src/validate.ts`, `validate.test.ts` ; `packages/daemon/src/agents/fake-claude.ts`, `fake-claude.test.ts`

**Interfaces:**
- Consumes: `ComponentFormat`, `FORMAT_SIZES`, `formatsOf` (T46) ; `GeneratorBrief.attachments`, `revisePrompt` (T50), `DraftPaths.attachmentsDir`, `KIBO_DRAFT_ATTACHMENTS` ; `buildComponent`, `hashSources` (devkit) ; `sandboxHeaders`, `SANDBOX_INDEX`, `startSandboxServer` ; `FakeStep`.
- Produces: contrat « Démon (T51) » : `prompts-skill.ts`, `revisePrompt` enrichi, `createDraftPreview`, `DraftAssets`, `parseDraftAssetPath`, `SandboxServerOptions.drafts`, `startAi().draftAssets`, `responsiveViolations`, scénarios.

- [x] **Step 1: Contexte de l'agent (tests rouges puis verts)**

`prompts.test.ts` :
```ts
test("the generator prompt names the declared formats, the attachments and the example", () => {
  const p = generatorPrompt({ ...brief, formats: ["medium", "half"], attachments: ["/h/d.attachments/1-maquette.png"] });
  expect(p).toContain("Formats à prendre en charge : medium (Moyen, 6 × 3");
  expect(p).toContain("half (Demi-page, 12 × 6");
  expect(p).not.toContain("small (");
  expect(p).toContain("Maquettes jointes");
  expect(p).toContain("/h/d.attachments/1-maquette.png");
  expect(p).toContain("exemple.tsx");
});
test("the kibo files carry the skill with formats, tokens, responsive rules and the example", () => {
  const files = draftKiboFiles({ ...brief, formats: ["large"], attachments: [] });
  expect(Object.keys(files).sort()).toEqual([".claude/skills/kibo-component/SKILL.md", ".claude/skills/kibo-component/exemple.tsx", "CLAUDE.md"]);
  const skill = files[".claude/skills/kibo-component/SKILL.md"]!;
  for (const needle of ["sdk.format", "@container", "@md:", "bg-card", "text-muted-foreground", "largeur fixe", "Petit", "Plein écran", "1200 px"]) expect(skill).toContain(needle);
  expect(files[".claude/skills/kibo-component/exemple.tsx"]).toContain("useEntities(\"ticket\")");
});
test("revisePrompt carries the feedback, the new images and the test order", () => {
  const p = revisePrompt(brief, "Mets le total en gros", ["/h/d.attachments/2-b.png"]);
  expect(p).toContain("Retour de l'utilisateur après aperçu : « Mets le total en gros »");
  expect(p).toContain("/h/d.attachments/2-b.png");
  expect(p).toContain("kibo component test .");
});
```
Run: FAIL. `prompts-skill.ts` : `SKILL` (sections API, Formats avec `formatTable(declared)` : identifiant, libellé, cellules, pixels à 1200 px de large : colonne ≈ 85 px, rangée 80 px, écart 16 px ; Style : jetons autorisés et interdiction des couleurs codées ; Responsive : racine `@container`, variantes `@md:`/`@lg:`, `sdk.format`, jamais `w-[Npx]`, `h-full min-h-0 overflow-auto` ; Tests), `EXAMPLE_COMPONENT` (un composant complet d'environ 40 lignes : `useSdk`, `useEntities("ticket")`, `StatusDot`, bascule par `sdk.format` entre un compteur (`small`), une liste courte (`medium`) et une liste groupée par statut (autres), `@container` à la racine, `openTicket` au clic, textes en français) ; `prompts.ts` : `generatorPrompt` et `revisePrompt` selon les tests, `draftKiboFiles` écrit le skill et `exemple.tsx` (fichiers Kibo : restaurés par `verifyAndRestore` puisque hors `isAgentFile`). Vérifier que l'exemple passe la conformité : `prompts.test.ts` écrit `EXAMPLE_COMPONENT` dans un dossier temporaire avec un manifeste `both` et appelle `runConformance` ? Non : `runConformance` déclare des tests au chargement ; écrire plutôt un test dédié `prompts-example.test.tsx` qui importe l'exemple **comme module** (fichier `prompts-example.tsx` exportant le même code, et `EXAMPLE_COMPONENT` = `readFileSync(import.meta.dir + "/prompts-example.tsx", "utf8")`) et appelle `runConformance({ manifest: EXAMPLE_MANIFEST, Component })`. Run: PASS.

- [x] **Step 2: Largeurs fixes refusées (tests rouges puis verts)**

`packages/devkit/src/responsive.test.ts` :
```ts
test("responsiveViolations flags fixed widths of 240px and more, in classes and styles", () => {
  expect(responsiveViolations('<div className="w-[480px] min-w-[300px] max-w-[200px]">')).toEqual([
    "ui.tsx : largeur fixe w-[480px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
    "ui.tsx : largeur fixe min-w-[300px] ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)",
  ]);
  expect(responsiveViolations('style={{ width: "640px" }}', "ui.tsx")).toHaveLength(1);
  expect(responsiveViolations('<div className="w-full md:w-1/2 @lg:w-[200px]">')).toEqual([]);
});
```
`validate.test.ts` : une fixture dont `ui.tsx` contient `w-[480px]` ⇒ `report.conformance.ok === false` et `errors` contient « largeur fixe ». Run: FAIL. `responsive.ts` + branchement dans `validate.ts` après le pas de conformité (lecture de `ui.tsx` dans le dossier validé). Run: PASS.

- [x] **Step 3: Aperçu servi par le listener sandbox (tests rouges puis verts)**

`asset-path.test.ts` : `parseDraftAssetPath("/c/drafts/<uuid>/<sha256>/ui.sandbox.js")` ⇒ `{ draftId, hash, file }` ; refuse un id non UUID, une empreinte non hex, un fichier inconnu, un chemin à 5 ou 7 segments. `draft-preview.test.ts` (faux `store`, `devkit.hash` et `devkit.buildPreview` comptés) :
```ts
test("preview builds once per hash, only for a visible draft, and the assets follow the draft's state", async () => {
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await expect(preview(generating.id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const p = await preview(review.id);
  expect(p).toEqual({ hash: HASH, path: `/c/drafts/${review.id}/${HASH}/index.html` });
  expect(devkit.builds).toBe(1);
  await preview(review.id);
  expect(devkit.builds).toBe(1);
  expect(assets.lookup(review.id, HASH, "ui.sandbox.js")).toEqual(BUNDLE);
  expect(assets.lookup(review.id, HASH, "index.html")).toBe(SANDBOX_INDEX);
  expect(assets.lookup(review.id, "0".repeat(64), "ui.css")).toBeNull();
  store.save({ ...review, status: "done" });
  expect(assets.lookup(review.id, HASH, "ui.sandbox.js")).toBeNull();
  expect(statSync(join(home, "components", "drafts", review.id, ".kibo", "preview", HASH)).mode & 0o777).toBe(0o700);
});
```
`sandbox-server.test.ts` : avec `drafts` fourni, `GET /c/drafts/<id>/<hash>/ui.sandbox.js` ⇒ 200 avec les en-têtes de `sandboxHeaders` et `cache-control: no-store`, `content-type: text/javascript` ; 404 quand `lookup` renvoie `null` ; sans `drafts`, 404. `methods.test.ts` : `previewComponentDraft` route vers `preview`. Run: FAIL. Implémenter `draft-preview.ts`, `asset-path.ts`, `sandbox-server.ts` (branche `drafts` avant `parseAssetPath`), `ports.ts` (`Devkit.buildPreview`), `live-ports.ts` (`buildPreview: (dir) => buildComponent(dir, toolchain)` réduit aux deux fichiers ; vérifier avec `grep -n "toolchain\|node_modules" packages/devkit/src/build.ts build-resolve.ts` que la construction résout `@kibo/sdk` depuis la toolchain sans `node_modules` dans le dossier ; sinon construire sur une copie liée comme `validate.ts` le fait, `grep -n "symlink\|copy" packages/devkit/src/validate.ts`), `bootstrap.ts` (`createDraftPreview`, `startAi` renvoie `draftAssets`), `daemon.ts` (`startSandboxServer({ …, drafts: ai.draftAssets })` : si le listener démarre avant `startAi`, passer un `DraftAssets` indirect `{ lookup: (...a) => assets?.lookup(...a) ?? null }` rempli après ; un test d'intégration dans `daemon.test.ts` ou `sandbox-server.test.ts` vérifie le 404 avant tout brouillon). Run: PASS.

- [x] **Step 4: Faux `claude` et cycle complet (tests rouges puis verts)**

`fake-claude.test.ts` : une étape `hook` dont `input.file_path` vaut `$KIBO_DRAFT_ATTACHMENTS/1-a.png` est envoyée au hook avec le chemin résolu depuis `process.env.KIBO_DRAFT_ATTACHMENTS`. Scénarios : `generate-revise.json` (tour 1 : Read `CLAUDE.md`, write `ui.tsx` ← `burndown/ui.tsx.fixture`, Bash test ; tour 2 : Read `$KIBO_DRAFT_ATTACHMENTS/1-maquette.png`, write `ui.tsx` ← `burndown/ui-revised.tsx.fixture`, Bash test) ; `generate-fixed-width.json` (tour 1 : write ← `ui-fixed-width.tsx.fixture` ; tour 2 : write ← `ui.tsx.fixture`). Fixtures : `ui-revised.tsx.fixture` = le burndown avec `@container` à la racine, un `switch (sdk.format)` (`small` ⇒ le chiffre seul) et le texte « tickets restants (révisé) » ; `ui-fixed-width.tsx.fixture` = le burndown avec `className="w-[480px]"`. `revision.int.test.ts` (modèle `generation.int.test.ts`) :
```ts
test("attachments are read by the agent, the preview is served, a revision rewrites the component, the fixed width is refused", async () => {
  // scénario generate-revise : start avec une image ⇒ review ; fakeCalls montre Read accepté sur <attachmentsDir>/1-maquette.png ;
  // previewComponentDraft ⇒ { hash, path } et GET sur le listener sandbox ⇒ 200 ; reviseComponentDraft ⇒ generating ⇒ review ;
  // le diff contient « (révisé) » ; l'ancien hash ⇒ 404 ; finalize ⇒ done ; attachmentsDir supprimé.
  // scénario generate-fixed-width : start ⇒ failed avec report.conformance.errors[0] qui contient « largeur fixe » ; retry ⇒ review.
});
```
Run: FAIL puis PASS (`bun test packages/daemon/src/ai packages/daemon/src/agents packages/daemon/src/components`).

- [x] **Step 5: Gate et commits**

Run: `bun run check && bun run typecheck && bun test packages/daemon packages/devkit` — Expected: PASS.
```bash
git add packages/daemon/src/ai/prompts.ts packages/daemon/src/ai/prompts-skill.ts packages/daemon/src/ai/prompts-example.tsx packages/daemon/src/ai/prompts.test.ts packages/daemon/src/ai/prompts-example.test.tsx
git commit -m "feat(daemon): contexte formats et exemple de l'agent"
git add packages/devkit/src/responsive.ts packages/devkit/src/responsive.test.ts packages/devkit/src/validate.ts packages/devkit/src/validate.test.ts
git commit -m "feat(devkit): largeurs fixes refusées"
git add packages/daemon/src/ai/draft-preview.ts packages/daemon/src/ai/draft-preview.test.ts packages/daemon/src/ai/ports.ts packages/daemon/src/ai/live-ports.ts packages/daemon/src/ai/bootstrap.ts packages/daemon/src/ai/methods.ts packages/daemon/src/ai/methods.test.ts packages/daemon/src/components/sandbox-server.ts <test sandbox> packages/daemon/src/components/asset-path.ts packages/daemon/src/components/asset-path.test.ts packages/daemon/src/daemon.ts
git commit -m "feat(daemon): aperçu d'un brouillon dans le bac à sable"
git add packages/daemon/src/agents/fake-claude.ts packages/daemon/src/agents/fake-claude.test.ts packages/daemon/src/agents/scenarios/ai/generate-revise.json packages/daemon/src/agents/scenarios/ai/generate-fixed-width.json packages/daemon/src/agents/scenarios/ai/fixtures/burndown/ui-revised.tsx.fixture packages/daemon/src/agents/scenarios/ai/fixtures/burndown/ui-fixed-width.tsx.fixture packages/daemon/src/ai/revision.int.test.ts
git commit -m "test(daemon): révision et aperçu avec le faux claude"
```

---

### Task 52: UI : décrire avec images et formats, dialogues bornés, création en arrière-plan

> **Amendement (relecture lead de T50).** Le démon refuse un nom d'image hors `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` ou dont l'extension ne suit pas le format détecté (`.png` ; `.jpg`/`.jpeg` ; `.webp`, sans tenir compte de la casse). L'interface normalise donc le nom avant l'envoi (espaces et accents des captures d'écran remplacés, extension déduite du format lu dans les octets), avec un test : un fichier « Capture d'écran 2026-10-01 à 10.12.33.png » glissé est envoyé sous un nom accepté. `attachments: []` posé par T50 dans `DescribeCard.tsx` et `ModifyWithAiDialog.tsx` est remplacé par le champ réel.

Vague 1 ← T45, T50. Spec IA **§13.4, §13.5, §13.10**, §16.4 ; écrans **132, 135, 29 amendé**. Décision 10 (`draftId` des dialogues). Mineure casée : état `copied` qui ne revient pas à `idle` (`CreateComponentDialog.tsx:20`). `DescribeCard.tsx` (181 l.) extrait `DescribeFields.tsx`.

**Files:**
- Create: `packages/ui/src/ai/attachments.ts`, `attachments.test.ts`, `AttachmentsField.tsx`, `FormatsField.tsx`, `DescribeFields.tsx`, `packages/ui/src/i18n/fr-creations.ts`
- Modify: `packages/sdk/src/ui/dialog.tsx`, `packages/sdk/src/primitives.test.tsx` ; `packages/ui/src/ai/DescribeCard.tsx`, `describe-card.test.tsx`, `ModifyWithAiDialog.tsx`, `modify.test.tsx`, `ai-dialog.test.tsx` ; `packages/ui/src/dialogs/CreateComponentDialog.tsx`, `icon-file.ts` (export `bytesToBase64`, `sniffIconMime` déjà exportés : vérifier), `packages/ui/src/palette/CommandPalette.tsx` (classe `overflow-hidden` si nécessaire)

**Interfaces:**
- Consumes: `DraftAttachmentInput`, `MAX_DRAFT_ATTACHMENTS`, `ComponentFormat`, `COMPONENT_FORMATS`, `formatsOf` ; `readIconFile`, `IconFileError` (`dialogs/icon-file.ts`) ; `Checkbox`, `Tabs` (SDK) ; `client.rpc` (`startComponentDraft` avec `attachments` et `formats`, `listComponentDrafts`).
- Produces: contrat « UI (T52) » : `attachments.ts`, `AttachmentsField`, `FormatsField`, `CreateComponentDialog { draftId?, onOpenCreations? }`, `ModifyWithAiDialog { component: ModifyTarget | null, draftId? }`, `frCreations.attachments`, `formats`, `background`, `banner`.

- [x] **Step 1: Pièces jointes pures (tests rouges puis verts)**

`attachments.test.ts` :
```ts
test("attachmentName keeps letters, digits, dots and dashes, bounds to 64 and matches the mime", () => {
  expect(attachmentName("Maquette Kanban (v2).PNG", "image/png")).toBe("Maquette-Kanban-v2.png");
  expect(attachmentName("x".repeat(90) + ".jpeg", "image/jpeg").length).toBeLessThanOrEqual(64);
  expect(attachmentName("", "image/webp")).toBe("image.webp");
});
test("addAttachment refuses the fifth image", () => {
  const four = Array.from({ length: 4 }, (_, i) => ({ name: `${i}.png`, mime: "image/png" as const, data: "AAAA" }));
  expect(addAttachment(four, { name: "5.png", mime: "image/png", data: "AAAA" })).toEqual({ ok: false, refusal: "count" });
  expect(addAttachment([], { name: "a.png", mime: "image/png", data: "AAAA" })).toMatchObject({ ok: true });
});
```
Run: FAIL puis PASS.

- [x] **Step 2: Champs images et formats (tests rouges puis verts, écran 132)**

`describe-card.test.tsx` :
```tsx
test("screen 132: formats are pre-checked by kind and sent; an image is attached by the file picker, shown, removable", async () => {
  const user = userEvent.setup();
  render(<DescribeCard onStarted={() => {}} />);
  expect(screen.getByRole("checkbox", { name: "Moyen" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: "Petit" }).getAttribute("aria-checked")).toBe("false");
  await user.click(screen.getByRole("checkbox", { name: "Petit" }));
  const file = new File([pngBytes()], "maquette kanban.png", { type: "image/png" });
  await user.upload(screen.getByLabelText("Ajouter des images"), file);
  expect(await screen.findByRole("img", { name: "maquette-kanban.png" })).toBeTruthy();
  await user.type(screen.getByLabelText("Ce que doit faire le composant"), "Burndown du sprint avec total");
  await user.click(screen.getByRole("button", { name: "Générer avec un agent" }));
  const req = calls.find((c) => c.method === "startComponentDraft");
  expect(req?.draft).toMatchObject({ formats: ["small", "medium", "large", "half"], attachments: [{ name: "maquette-kanban.png", mime: "image/png" }] });
});
test("a GIF is refused with a message and nothing is attached", async () => { /* « Format non pris en charge : PNG, JPEG ou WebP. » role=alert */ });
test("pasting an image into the description attaches it", async () => { /* user.paste avec clipboardData files */ });
```
(`pngBytes()` : signature PNG + quelques octets ; `readIconFile` lit `file.type` et la signature.) `modify.test.tsx` : le formulaire « Modifier avec l'IA » a la zone images et envoie `attachments`. Run: FAIL. `AttachmentsField.tsx` (zone `onDrop`/`onDragOver`, `<input type="file" accept="image/png,image/jpeg,image/webp" multiple class="sr-only">` étiqueté « Ajouter des images », vignettes `<img alt={name} src={`data:${mime};base64,${data}`}>` avec « Retirer <name> », message `role="alert"` par `AttachmentRefusal`), `FormatsField.tsx` (cases par format avec `frCreations.formats.labels[f]`, au moins une cochée, `kind` change ⇒ `formatsOf({ kind })`), `DescribeFields.tsx` (titre, identifiant, type, backend, formats), `DescribeCard.tsx` (état, `onPaste` du textarea relayé à `addAttachment`, envoi), `ModifyWithAiDialog.tsx` (zone images). Run: PASS.

- [x] **Step 3: Dialogues bornés (test rouge puis vert, écran 135)**

`packages/sdk/src/primitives.test.tsx` : `DialogContent` rendu porte `max-h-[calc(100dvh-2rem)]` et `overflow-y-auto` ; avec `className="overflow-hidden"`, `overflow-hidden` l'emporte (tailwind-merge). Run: FAIL. `dialog.tsx:63` : ajouter les deux classes. Vérifier la palette (`grep -n "DialogContent" packages/ui/src/palette/CommandPalette.tsx`) : si elle rend un `DialogContent`, lui passer `overflow-hidden`. Run: `bun test packages/sdk packages/ui/src/palette` — Expected: PASS.

- [x] **Step 4: Arrière-plan, reprise et `copied` (tests rouges puis verts, écran 29 amendé)**

`ai-dialog.test.tsx` :
```tsx
test("the dialog can be closed while generating without any RPC, and reopens on a draft id", async () => {
  runState = "running";
  render(<CreateComponentDialog open onOpenChange={onOpenChange} target={null} draftId={DRAFT_ID} />);
  expect(await screen.findByText(/génération en cours/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Continuer en arrière-plan" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(calls.some((c) => c.method === "abandonComponentDraft")).toBe(false);
});
test("the banner lists up to three active drafts and links to Créations", async () => {
  answer = (req) => (req.method === "listComponentDrafts" ? [d1, d2, d3, d4] : null);
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} onOpenCreations={onOpenCreations} />);
  expect(await screen.findAllByRole("button", { name: "Reprendre" })).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "Voir les créations" }));
  expect(onOpenCreations).toHaveBeenCalled();
});
test("« Commandes copiées. » disappears after two seconds", async () => { /* horloge injectée : useFlash ou timer via prop now ; pas de setTimeout nu non nettoyé */ });
```
`CreateComponentDialog.tsx` : `draftId` initial, `DialogFooter` avec « Continuer en arrière-plan » quand un brouillon est affiché et non terminé, `ActiveDraftsBanner` (remplace `ResumeDraftBanner` : jusqu'à trois lignes « <titre> · <étape> » avec « Reprendre », lien « Voir les créations » si `onOpenCreations`), `copied` remis à `false` par `useFlash` (déjà présent dans `lib/use-flash.ts`). `ModifyWithAiDialog.tsx` : `draftId?` ouvre directement le panneau du brouillon (`component` peut être `null`). Run: PASS.

- [x] **Step 5: Captures, gate et commits**

Captures `screens/t52/` : 132 et 135 (fenêtre 1440 × 700) en sombre et en clair.
Run: `bun run check && bun run typecheck && bun test packages/sdk packages/ui && bun run budget` — Expected: PASS, budget ≤ 220,1 kB.
```bash
git add packages/sdk/src/ui/dialog.tsx packages/sdk/src/primitives.test.tsx packages/ui/src/palette/CommandPalette.tsx
git commit -m "feat(sdk): dialogues à hauteur bornée"
git add packages/ui/src/ai/attachments.ts packages/ui/src/ai/attachments.test.ts packages/ui/src/ai/AttachmentsField.tsx packages/ui/src/ai/FormatsField.tsx packages/ui/src/ai/DescribeFields.tsx packages/ui/src/ai/DescribeCard.tsx packages/ui/src/ai/describe-card.test.tsx packages/ui/src/ai/ModifyWithAiDialog.tsx packages/ui/src/ai/modify.test.tsx packages/ui/src/i18n/fr-creations.ts packages/ui/src/dialogs/icon-file.ts
git commit -m "feat(ui): décrire avec images et formats"
git add packages/ui/src/dialogs/CreateComponentDialog.tsx packages/ui/src/ai/ai-dialog.test.tsx packages/ui/src/ai/ModifyWithAiDialog.tsx packages/ui/src/i18n/fr-creations.ts
git commit -m "feat(ui): création en arrière-plan et reprise"
```

---

### Task 53: UI : écran « Créations », indicateur d'en-tête, liens, profil générateur

Vague 2 ← T50, T52. Spec IA **§13.1, §13.2, §13.3**, agents §12 ; écrans **130, 131, 116 amendé**. Décisions 9, 10. Mineure casée : `missing` vrai pour un run tout juste lancé (`useRunLog`). `Shell.tsx` n'est pas touché : l'indicateur vit dans `ShellHeader` avec son propre hook ; la page héberge ses dialogues.

**Files:**
- Create: `packages/ui/src/state/use-component-drafts.ts`, `packages/ui/src/creations/CreationsPage.tsx`, `CreationRow.tsx`, `creation-status.ts`, `creation-status.test.ts`, `creations-page.test.tsx`, `packages/ui/src/shell/CreationsIndicator.tsx`
- Modify: `packages/schema/src/tabs.ts`, `tabs.test.ts` ; `packages/ui/src/tabs/screens.ts`, `shell/ScreenView.tsx`, `shell/ShellHeader.tsx`, `shell/shell-header.test.tsx` (nom réel : `ls packages/ui/src/shell/*header*.test.tsx`), `shell/lazy-screens.ts`, `palette/palette-items.ts` (vérifier si les écrans viennent de `SCREENS` : `grep -n "SCREENS\|screen" packages/ui/src/palette/palette-items.ts`), `components-page/ComponentsPage.tsx`, `components-page.test.tsx`, `state/use-agents.ts`, `agents/AgentDrawer.tsx`, `agents/agent-panel.test.tsx`, `agents/ProfileSheet.tsx`, `agents/profile-sheet.test.tsx` (nom réel), `i18n/fr.ts`, `i18n/fr-creations.ts`

**Interfaces:**
- Consumes: `ComponentDraft`, `DraftStatus`, `RunView`, `AgentsState` ; `client.rpc({ method: "listComponentDrafts" })`, `client.subscribeAi`, `useAgents`, `useRunLog`, `RunJournal`, `draftStep` (`ai/draft-flow.ts`), `fr.ai.steps` ; `CreateComponentDialog { draftId, onOpenCreations }`, `ModifyWithAiDialog { draftId }` (T52) ; `ConfirmDialog` (lazy-dialogs) ; `errorMessage`.
- Produces: contrat « UI (T53) » : `useComponentDrafts`, `creation-status.ts`, `CreationsPage`, `CreationsIndicator`, `Screen` `creations`, `RunLog.empty`.

- [x] **Step 1: État pur (tests rouges puis verts)**

`creation-status.test.ts` : `awaitingAction` vrai pour `failed`, `review`, `permissions`, faux sinon ; `groupDrafts` sépare actifs et terminés en gardant l'ordre reçu (`updatedAt` décroissant côté démon) ; `indicatorState([], [])` ⇒ `{ visible: false, awaiting: 0, busy: false }` ; avec un brouillon `generating` dont le run est `running` ⇒ `{ visible: true, awaiting: 0, busy: true }` ; avec un `review` ⇒ `awaiting: 1` ; avec seulement des `done` ⇒ `visible: false`. Run: FAIL puis PASS.

- [x] **Step 2: Écran enregistré et page (tests rouges puis verts, écran 130)**

`packages/schema/src/tabs.test.ts` : `Screen.parse("creations")`. `creations-page.test.tsx` (mock `../api` : `listComponentDrafts` ⇒ fixtures de `ai/draft-fixtures.ts` dans trois états ; `getAgents` ⇒ un run `queued` à la position 2 pour le second ; `getRunLog` ⇒ `NOT_FOUND` pour l'un, `[]` pour un autre) :
```tsx
test("screen 130: drafts are grouped, each row shows step, run state and actions; Journal and Abandonner work", async () => {
  render(<CreationsPage onOpen={onOpen} />);
  const active = await screen.findByRole("region", { name: /En cours \(2\)/ });
  expect(within(active).getByRole("row", { name: /Burndown du sprint/ })).toHaveTextContent("2 · Générer (agent)");
  expect(within(active).getByRole("row", { name: /Météo/ })).toHaveTextContent("En file #2");
  expect(screen.getByRole("region", { name: /Terminées \(1\)/ })).toHaveTextContent("Publié en 0.1.0");
  await user.click(within(active).getByRole("button", { name: "Journal de Burndown du sprint" }));
  expect(await screen.findByText("Journal indisponible pour ce run.")).toBeTruthy();
  await user.click(within(active).getByRole("button", { name: "Abandonner Burndown du sprint" }));
  expect(screen.getByRole("dialog", { name: "Abandonner Burndown du sprint ?" })).toHaveTextContent("Le brouillon et ses images sont supprimés");
  await user.click(screen.getByRole("button", { name: "Annuler" }));
  expect(calls.some((c) => c.method === "abandonComponentDraft")).toBe(false);
});
test("Ouvrir mounts the create or modify dialog on the draft", async () => { /* CreateComponentDialog avec draftId pour create ; ModifyWithAiDialog pour modify */ });
test("empty state offers Créer un composant", async () => { /* listComponentDrafts ⇒ [] */ });
```
Run: FAIL. `tabs.ts` + `screens.ts` (`creations: { title: fr.nav.creations, icon: Sparkles, crumbs: [fr.nav.components, fr.nav.creations] }`), `lazy-screens.ts` (`CreationsPage`), `ScreenView.tsx` (`if (screen === "creations") return <CreationsPage onOpen={onOpen} />`), `use-component-drafts.ts` (liste au montage, `subscribeAi` `draft.changed` ⇒ recharge, `UNAUTHORIZED` ignoré, erreur ⇒ `error`), `CreationsPage.tsx`/`CreationRow.tsx` (`table` par groupe avec `role="region"` et en-tête, étape par `draftStep` + `fr.ai.steps`, état du run par `useAgents()` : `queued` ⇒ « En file #n » (`state.queue.indexOf(runId) + 1`), `running`/`starting` ⇒ « En cours », `waiting_input` ⇒ « Attend une réponse », sinon rien ; « Journal » = `Collapsible` avec `RunJournal` et `useRunLog(draft.runId)` ; « Abandonner… » = `ConfirmDialog` ⇒ `abandonComponentDraft` ; « Ouvrir » monte le dialogue), `fr.ts › nav.creations`, `fr-creations.ts › page, row, abandon`. Run: PASS.

- [x] **Step 3: Indicateur, liens et palette (tests rouges puis verts, écran 131, 116 amendé)**

`shell-header.test.tsx` : sans brouillon actif, aucun bouton « Créations » ; avec un `review` et un `generating` (run `running`), le bouton « Créations · 1 attend une action, 1 en cours » est présent avec le badge « 1 » et `data-busy="true"` ; clic ⇒ `onOpen({ kind: "screen", screen: "creations" })`. `components-page.test.tsx` : l'en-tête montre « Créations (2) » quand deux brouillons sont actifs et appelle `onOpen` sur l'écran ; les Détails d'une version listent « Formats : Moyen, Large, Demi-page ». Palette : « Créations » ouvre l'écran (si les écrans sont dérivés de `SCREENS`, aucun code ; sinon ajouter l'entrée). Run: FAIL puis PASS (`CreationsIndicator.tsx` : `useComponentDrafts` + `useAgents` + `indicatorState`, `Sparkles` avec `animate-pulse` quand `busy`, badge comme `RunHistoryButton.tsx:41-45`, `fr.header.creations(awaiting, busy)`).

- [x] **Step 4: `useRunLog.empty` et profil générateur (tests rouges puis verts)**

`agents/agent-panel.test.tsx` : pour un run `running` dont le journal est `[]`, le tiroir n'affiche pas « Journal indisponible » ; pour un run `done` avec `[]`, il l'affiche ; `NOT_FOUND` ⇒ affiché quel que soit l'état. `use-agents.ts` : `RunLog = { log, missing, empty }`, `missing` seulement sur `NOT_FOUND`, `empty` quand la liste chargée est vide ; `AgentDrawer.tsx` et `CreationRow.tsx` affichent « indisponible » si `missing || (empty && terminal)`. Fiche du profil : pour un profil système, le champ « Parallèle » est modifiable (1 à 4) et envoyé ; `profile-sheet` test. Run: PASS.

- [x] **Step 5: Captures, gate et commits**

Captures `screens/t53/` : 130 (deux créations en cours : lancer deux brouillons avec le faux `claude` via `bun packages/daemon/src/main.ts --claude-bin packages/daemon/src/agents/fake-claude.ts` et le scénario `ai/generate-ok.json` en `hold`, ou avec les fixtures en test), 131, 116 amendé, en sombre et en clair.
Run: `bun run check && bun run typecheck && bun test packages/schema packages/ui && bun run budget` — Expected: PASS, budget ≤ 221,0 kB.
```bash
git add packages/schema/src/tabs.ts packages/schema/src/tabs.test.ts packages/ui/src/tabs/screens.ts packages/ui/src/shell/lazy-screens.ts packages/ui/src/shell/ScreenView.tsx packages/ui/src/state/use-component-drafts.ts packages/ui/src/creations/CreationsPage.tsx packages/ui/src/creations/CreationRow.tsx packages/ui/src/creations/creation-status.ts packages/ui/src/creations/creation-status.test.ts packages/ui/src/creations/creations-page.test.tsx packages/ui/src/i18n/fr.ts packages/ui/src/i18n/fr-creations.ts
git commit -m "feat(ui): écran Créations"
git add packages/ui/src/shell/CreationsIndicator.tsx packages/ui/src/shell/ShellHeader.tsx <test en-tête> packages/ui/src/components-page/ComponentsPage.tsx packages/ui/src/components-page/components-page.test.tsx packages/ui/src/palette/palette-items.ts
git commit -m "feat(ui): indicateur des créations dans l'en-tête"
git add packages/ui/src/state/use-agents.ts packages/ui/src/agents/AgentDrawer.tsx packages/ui/src/agents/agent-panel.test.tsx packages/ui/src/agents/ProfileSheet.tsx <test profil>
git commit -m "fix(ui): journal vide d'un run en cours, parallèle système"
```

---

### Task 54: UI : aperçu du brouillon dans le bac à sable et révision

> **Amendement (relecture lead de T54).** Le SDK simulé tourne dans un Web Worker dédié (`draft-preview-worker`), émis sous `workers/` et servi avec sa propre CSP (composants §17, point 6 ; A22) ; la CSP du document ne change pas. Fichiers ajoutés à la tâche : `packages/daemon/src/ui-route.ts`, `server.ts`, `server-ui.test.ts`, `packages/ui/vite.config.ts`, `packages/ui/scripts/bundle-budget.ts`, `bundle-report.ts` et son test. Garde de navigation : un second `load` du cadre arrête l'aperçu sans relance ; seule l'absence de `ready` est relancée, une fois par session. Une révision envoyée remet à zéro la relecture (`refused`, `reviewed`). Libellés retenus (écrans 133 et 134, IA §13.6) : « Demander une modification », « Ce qu'il faut changer », « Envoyer à l'agent ».

> **Amendement (relecture lead de T51).** `previewComponentDraft` répond `{ hash, path }` ; `path` n'est servi que par le démon qui a répondu, tant que le brouillon reste en `review` ou `permissions` avec cette empreinte. `DraftPreviewFrame` appelle la RPC à chaque montage et à chaque `draft.changed` du brouillon, ne mémorise jamais un `path` d'un montage à l'autre, et traite un échec de chargement de l'iframe (`createLoadGuard`) par un nouvel appel, une seule fois, avant `frCreations.preview.unavailable`. Un changement de format ne rappelle pas la RPC (même bundle, `format` passe par `init`). Refus affichés en `role="alert"` : `INVALID_INPUT` (hors `review`/`permissions`), `CONFLICT` (brouillon modifié pendant la construction : un nouvel essai suffit), `VALIDATION_FAILED`, `NOT_FOUND`, `STORE_CORRUPT`. La RPC est permise pendant une relecture ou une publication en cours. Suivi de T52 à prendre ici : `AiDraftPanel` gagne `onStatus` pour supprimer le double `getComponentDraft` de `ContinueInBackground`.

Vague 2 ← T47, T51, T52. Spec IA **§13.6, §13.8**, composants §17.5 ; écrans **133, 134**. Décision 8. Mineure casée : squelette d'attente sans `role="status"` (`DraftReviewStep`). Relue par `kibo-lead` (pont iframe, SDK simulé côté hôte, budget).

**Files:**
- Create: `packages/ui/src/ai/DraftPreview.tsx`, `DraftPreviewFrame.tsx` (chunk paresseux), `draft-preview.test.tsx`, `FormatPicker.tsx`, `ReviseForm.tsx`, `revise-form.test.tsx`
- Modify: `packages/ui/src/ai/DraftReviewStep.tsx`, `draft-review.test.tsx` (nom réel : `ls packages/ui/src/ai/*review*.test.tsx`), `draft-actions.ts`, `draft-actions.test.ts`, `packages/ui/src/i18n/fr-creations.ts`, `packages/ui/scripts/bundle-report.ts` (`FORBIDDEN_IN_ENTRY` : `DraftPreviewFrame` déjà ajouté par T45 ; vérifier)

**Interfaces:**
- Consumes: `previewComponentDraft`, `reviseComponentDraft` (T50 RPC), `DraftPreview { hash, path }` ; `SandboxFrame`, `createFrameBridge`, `createLoadGuard` (`components/sandbox/`) ; `createMockSdk({ manifest, format, seed: seedDemo, … })` et `MockSdk.backend` (T47) ; `surfaceFor`, `formatsOf`, `FORMAT_SIZES` ; `useTheme` ; `AttachmentsField` (T52) ; `draftStep`, `fr.ai.steps`.
- Produces: contrat « UI (T54) » : `DraftPreviewFrame { draftId, manifest, format, theme }`, `FormatPicker { formats, value, onChange }`, `ReviseForm { onSubmit, busy }`, `draftActions.canRevise`, `frCreations.preview`, `revise`.

- [x] **Step 1: Actions pures (test rouge puis vert)**

`draft-actions.test.ts` : `canRevise({ status: "review", revisions: 3 })` vrai ; faux pour `generating`, `done`, `failed` ; faux à `revisions === MAX_DRAFT_REVISIONS`. Run: FAIL puis PASS.

- [x] **Step 2: Cadre d'aperçu (tests rouges puis verts, écran 133)**

`draft-preview.test.tsx` (mock `../api` : `previewComponentDraft` ⇒ `{ hash: HASH, path }` ; `SandboxFrame` rend un `iframe` réel sous happy-dom, le pont est testé par un faux `frame` : `vi`-like via `mock.module("../components/sandbox/frame-bridge", …)` est interdit par la règle « mock.module seulement sur ../api » ⇒ injecter `bridge` par prop facultative `createBridge?: typeof createFrameBridge` avec `createFrameBridge` par défaut) :
```tsx
test("screen 133: the preview requests the build once per format change, mounts the sandbox at the draft path and answers the frame with the mock backend", async () => {
  const bridges: BridgeInit[] = [];
  render(<DraftPreviewFrame draftId={DRAFT_ID} manifest={manifest} format="medium" theme="dark" createBridge={(o) => { bridges.push(o.init); return { dispose() {} }; }} />);
  const frame = await screen.findByTitle("Aperçu de Burndown du sprint");
  expect(frame.getAttribute("src")).toBe(`/c/drafts/${DRAFT_ID}/${HASH}/index.html`);
  expect(bridges[0]).toMatchObject({ format: "medium", theme: "dark", surface: surfaceFor(manifest, "medium") });
  expect(calls.filter((c) => c.method === "previewComponentDraft")).toHaveLength(1);
  const result = await bridges[0]!.call({ method: "listEntities", kind: "ticket" });
  expect(Array.isArray(result)).toBe(true);
});
test("the frame is sized by the format and a build error is shown with role=alert", async () => { /* style width/height depuis FORMAT_SIZES à 85 px la colonne, 80 px la rangée ; INVALID_INPUT ⇒ frCreations.preview.unavailable */ });
```
`DraftPreviewFrame.tsx` : `useEffect` sur `[draftId, hash]` ⇒ `client.rpc({ method: "previewComponentDraft", draftId })` ; `useMemo` ⇒ `createMockSdk({ manifest, format, seed: seedDemo })` ; `createFrameBridge({ frame, init: { surface, theme, format, … mêmes champs que PageView », call: (req) => mock.backend.call(req), … })` ; `createLoadGuard` pour l'erreur de chargement ; `Skeleton` avec `role="status"` pendant la construction. `DraftPreview.tsx` : `FormatPicker` (segmented `ToggleGroup` ou `Tabs` : libellés `frCreations.formats.labels`), cadre centré dans une zone `overflow-auto` de hauteur bornée (`max-h-[60vh]`). Import paresseux : `const DraftPreviewFrame = lazy(() => import("./DraftPreviewFrame"))` encapsulé par `lazyPanel` (fallback squelette). Run: PASS.

- [x] **Step 3: Onglets Diff/Aperçu et formulaire de révision (tests rouges puis verts, écran 134)**

`draft-review.test.tsx` : en `review`, deux onglets « Diff » (actif) et « Aperçu » ; « Aperçu » monte `DraftPreview` ; le bouton « Demander une révision » ouvre `ReviseForm` ; envoi avec « Mets le total en gros » et une image ⇒ `reviseComponentDraft { draftId, feedback, attachments: [{ name, mime, data }] }` ; le brouillon passe à `generating` et l'étape « 2 · Générer (agent) » s'affiche ; à 10 révisions, le bouton est absent et « Dix révisions atteintes : publiez ou abandonnez. » est visible ; le squelette d'attente a `role="status"`. `revise-form.test.tsx` : moins de 5 caractères ⇒ bouton désactivé ; `busy` ⇒ désactivé ; Échap ⇒ `onCancel`. Run: FAIL puis PASS (`DraftReviewStep.tsx` : `Tabs` du SDK, `ReviseForm` dans un `Collapsible` ; `revisions` lus depuis `ComponentDraft`).

- [x] **Step 4: Captures, gate et commits**

Captures `screens/t54/` : 133 (aperçu en `medium` puis `half`) et 134, en sombre et en clair. Pour l'aperçu réel : démon avec le faux `claude` et le scénario `ai/generate-revise.json`.
Run: `bun run check && bun run typecheck && bun test packages/ui && bun run budget` — Expected: PASS, budget ≤ 221,0 kB ; `DraftPreviewFrame` et `createMockSdk` absents de l'entrée (le rapport le vérifie).
```bash
git add packages/ui/src/ai/draft-actions.ts packages/ui/src/ai/draft-actions.test.ts packages/ui/src/ai/DraftPreview.tsx packages/ui/src/ai/DraftPreviewFrame.tsx packages/ui/src/ai/draft-preview.test.tsx packages/ui/src/ai/FormatPicker.tsx packages/ui/src/i18n/fr-creations.ts
git commit -m "feat(ui): aperçu d'un brouillon dans le bac à sable"
git add packages/ui/src/ai/DraftReviewStep.tsx <test review> packages/ui/src/ai/ReviseForm.tsx packages/ui/src/ai/revise-form.test.tsx packages/ui/src/i18n/fr-creations.ts
git commit -m "feat(ui): révision d'un brouillon après aperçu"
```

---

### Task 55: E2E : créations en arrière-plan, aperçu, révision, publication

> **Amendement (relecture lead de T54).** Libellés réels : « Demander une modification », « Ce qu'il faut changer », « Envoyer à l'agent » ; onglets « Diff » (actif par défaut, y compris au retour d'une révision) et « Aperçu » ; `radiogroup` « Format de l'aperçu » ; iframe `title="Aperçu de <titre du manifeste>"` ; ligne « Révision 1 sur 10 » pendant la génération ; une création terminée affiche « Publié » sans numéro de version (écart de T53). À vérifier sur l'aperçu réel, sans aucune interception de réponse : `tickets restants` visible dans le cadre ; aucune alerte « Aperçu indisponible. » ; aucun message de console ni `pageerror` contenant « Refused to » ou « Content Security Policy » ; `page.waitForEvent("worker")` dont l'URL correspond à `/workers/draft-preview-worker-[\w-]+\.js`, un `GET` de cette URL porte exactement la politique du worker et un `GET /` une CSP sans `wasm-unsafe-eval` ; « Demi-page » : iframe de 1196 px de large sans second `previewComponentDraft` ; après la révision, retour sur « Aperçu » : texte `(révisé)`.

Vague 3 ← T53, T54. Spec IA §13 entière ; écrans 130 à 135. Ports **4425–4426** (`§11` : plage 4390–4430).

**Files:**
- Create: `e2e/creations.spec.ts`, `packages/daemon/src/agents/scenarios/ai/e2e-routes.json` (si le scénario de routage existant, `grep -rn "routes" packages/daemon/src/agents/scenarios/ai/*.json e2e/*.ts`, ne permet pas d'ajouter une route ; sinon modifier ce fichier)
- Modify: `e2e/helpers.ts` (nom réel : `ls e2e/*.ts`), `e2e/playwright.config.ts` (si les ports y sont listés)

**Interfaces:**
- Consumes: aides E2E existantes (`startDaemon({ port, claudeBin, scenario })`, `pair`, `openProject`) ; `page.setInputFiles` ; scénarios `generate-revise.json`, `generate-fixed-width.json` (T51).

- [ ] **Step 1: Parcours (test rouge puis vert)**

```ts
test("créer deux composants en arrière-plan, prévisualiser, réviser, publier", async ({ page }) => {
  // démon sur 4425 avec le faux claude et une route : titre contenant « large » ⇒ generate-fixed-width, sinon generate-revise
  await page.getByRole("button", { name: "Créer un composant" }).click();
  await page.getByLabel("Ce que doit faire le composant").fill("Burndown du sprint avec total");
  await page.getByLabel("Ajouter des images").setInputFiles("e2e/fixtures/maquette.png");
  await page.getByRole("button", { name: "Générer avec un agent" }).click();
  await page.getByRole("button", { name: "Continuer en arrière-plan" }).click();
  await page.getByRole("button", { name: "Créer un composant" }).click();
  await page.getByLabel("Ce que doit faire le composant").fill("Compteur large");
  await page.getByRole("button", { name: "Générer avec un agent" }).click();
  await page.getByRole("button", { name: "Continuer en arrière-plan" }).click();
  await page.getByRole("button", { name: /Créations/ }).click();
  await expect(page.getByRole("region", { name: /En cours/ })).toContainText("Burndown du sprint");
  await expect(page.getByRole("row", { name: /Compteur large/ })).toContainText("Échec", { timeout: 60_000 });
  await page.getByRole("row", { name: /Burndown du sprint/ }).getByRole("button", { name: "Ouvrir" }).click();
  await page.getByRole("tab", { name: "Aperçu" }).click();
  const frame = page.frameLocator('iframe[title="Aperçu de Burndown du sprint"]');
  await expect(frame.getByText(/tickets restants/)).toBeVisible();
  await page.getByRole("button", { name: "Demander une révision" }).click();
  await page.getByLabel("Ce qui doit changer").fill("Mets le total en gros");
  await page.getByRole("button", { name: "Envoyer la révision" }).click();
  await expect(page.getByRole("tab", { name: "Aperçu" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(frame.getByText(/\(révisé\)/)).toBeVisible();
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("region", { name: /Terminées/ })).toContainText("Publié en 0.1.0");
});
test("la fenêtre reste bornée à 700 px de haut", async ({ page }) => { /* viewport 1440 × 700 ; le dialogue de création a boundingBox().height ≤ 668 et un scroll interne */ });
```
`e2e/fixtures/maquette.png` : un PNG 1 × 1 valide généré par le test (`Buffer.from(base64)`) écrit dans un dossier temporaire plutôt que commis, si les fixtures binaires sont absentes de `e2e/` (`ls e2e/fixtures 2>/dev/null`). Run: `bunx playwright test e2e/creations.spec.ts` — Expected: PASS deux fois de suite.

- [ ] **Step 2: Captures, gate et commit**

Captures `screens/t55/` : 130 à 135 en sombre et en clair, prises par le test (`page.screenshot`) après `page.emulateMedia({ colorScheme })`.
Run: `bun run check && bun run typecheck && bunx playwright test` — Expected: PASS.
```bash
git add e2e/creations.spec.ts <helpers et scénario de routage>
git commit -m "test(e2e): créations, aperçu, révision, publication"
```

---

## Auto-revue du plan

**Couverture des specs.**
- Design §16.1 (formats, grille, défauts, une colonne, chevauchements) : T46 (schéma), T48 (`format-grid.ts`, `DashboardGrid`), T47 (SDK `format`). §16.2 (`setInstanceLayout`, garde, mode de disposition, Échap, Annuler) : T46 (commande), T47 (core + démon), T48 (`LayoutEditor`), T49 (E2E). §16.3 (résumé créations) : T50 à T55. §16.4 (dialogues bornés) : T52 pas 3. §16.5 (ports, écrans, codes) : T49, T55 ; aucun code d'erreur nouveau — vérifié dans chaque tâche (`INVALID_INPUT`, `NOT_FOUND`, `CONFLICT` existants).
- Composants §17.1 (`formats?`, `formatsOf`, `formatIssue`) : T46 ; devkit valide `formatIssue` : T47 pas 4. §17.2 (SDK `format`, init, mock, `mountDev`, `surfaceFor`) : T47. §17.3 (formats des intégrés) : T47 pas 5. §17.4 (conformité par format, largeurs fixes) : T47 pas 3, T51 pas 2. §17.5 (aperçu d'un brouillon) : T51 pas 3, T54.
- IA §13.1 (arrière-plan, parallélisme) : T50 (profil générateur 2), T52 pas 4, T53 pas 4. §13.2 (Créations) : T53. §13.3 (indicateur) : T53 pas 3. §13.4 (pièces jointes) : T50 (démon), T52 (UI), T51 pas 4 (faux `claude`). §13.5 (formats cochés) : T52 pas 2. §13.6 (aperçu, révision) : T50 (RPC), T51, T54. §13.7 (contexte) : T51 pas 1. §13.8 (validation par format) : T47 pas 3, T51 pas 2. §13.9 (RPC) : T50. §13.10 (dialogues bornés, arrière-plan) : T52. §13.11 (faux `claude`) : T51 pas 4.
- Sync D48 : T46 pas 4 et 5 (`validate-instances.ts`, `room.ts`). Agents §12 : T50 (`SYSTEM_MAX_PARALLEL`, défauts), T53 pas 4 (fiche).
- Points pour Adam A11 à A22 : chacun a un défaut retenu et une tâche isolée (A11 liste des formats ⇒ T46 seul ; A12 pas de taille libre ⇒ T48 ; A14 chevauchements non refusés ⇒ T46 pas 4 ; A17 images jointes ⇒ T50 ; A16 parallélisme 2 ⇒ T50 ; A18 dix révisions ⇒ T50/T54 ; A17 aperçu via le listener sandbox ⇒ T51 ; A18 `InstanceMenuContent` paresseux ⇒ T45 ; A19 vignettes en `data:` ⇒ T52 ; A20 largeur fixe ≥ 240 px ⇒ T51 ; A21 écran Créations sous Composants ⇒ T53).

**Review Focus.** 1 (disposition hors grille envoyée par un pair) ⇒ T47 pas 2 ; 2 (deux éditeurs simultanés) ⇒ T47 pas 1 (dernier écrit), T49 test 2 ; 3 (cinquième image, GIF, 300 kB) ⇒ T50 pas 1, T52 pas 1 et 2 ; 4 (révision pendant une génération) ⇒ T50 pas 3 (`canRevise` démon), T54 pas 1 ; 5 (aperçu d'un brouillon abandonné ou publié) ⇒ T51 pas 3 (`lookup` suit l'état) ; 6 (page étroite pendant l'édition) ⇒ T48 pas 4 ; 7 (chemin de pièce jointe hors `readRoots`) ⇒ T50 pas 2 (garde-fou).

**Mineures du rapport de la vague 3.** « ⋯ » décalé ⇒ T45 pas 4 ; `copied` non remis à zéro ⇒ T52 pas 4 ; `missing` d'un run tout juste lancé ⇒ T53 pas 4 ; squelette sans `role="status"` ⇒ T54 pas 3 ; `InstanceMenu` 157 lignes avec contenu lourd ⇒ T45 (découpe paresseuse). Pas de tâche fourre-tout.

**Cohérence des noms.** `setInstanceLayout` (schéma, core, démon, UI, E2E) ; `formatsOf`/`defaultFormatOf`/`formatIssue` ; `FORMAT_SIZES`/`GRID_COLUMNS`/`MAX_GRID_ROWS` ; `DraftAttachmentInput`/`DraftAttachment`/`MAX_DRAFT_ATTACHMENTS`/`MAX_DRAFT_REVISIONS` ; `previewComponentDraft`/`reviseComponentDraft` ; `createDraftPreview`/`DraftAssets.lookup`/`parseDraftAssetPath` ; `DraftPreviewFrame { draftId, manifest, format, theme }` ; `useComponentDrafts`/`indicatorState` ; `frLayout`/`frCreations` : relus d'une tâche à l'autre, identiques aux « Contrats partagés ».

**Fichiers > 300 lignes.** `Shell.tsx` (301) n'est touché par aucune tâche (T53 passe par `ShellHeader` et `ScreenView`). `sdk/mock.ts` (315) : T47 extrait `mock-backend.ts`. `prompts.ts` : T51 extrait `prompts-skill.ts`. `DescribeCard.tsx` : T52 extrait `DescribeFields.tsx`. `InstanceMenu.tsx` : T45 extrait `InstanceMenuContent.tsx`. `PageView.tsx` : T48 extrait `DashboardGrid.tsx`.

**Laissé à l'exécutant (vérifié avant d'écrire).** T51 pas 3 : construction d'un brouillon sans `node_modules` (copie liée comme `validate.ts` si nécessaire). T53 : la palette dérive-t-elle ses écrans de `SCREENS` ? T55 : fichier des aides E2E et support d'une route par scénario. T52 : nom exact du test de l'en-tête et de la fiche de profil. Chaque tâche cite la commande `ls`/`grep` qui lève le doute.

**Budget.** Entrée à 220,1 kB au départ ; T45 ≈ −0,8 kB (`InstanceMenuContent`) ; T48 ≈ +0,5 kB (`DashboardGrid`, `use-wide-grid`, bouton) ; T52 ≈ +0,1 kB (classes de `DialogContent` ; bannière et bouton dans le dialogue paresseux) ; T53 ≈ +0,7 kB (`CreationsIndicator`, hook, écran enregistré) ; T54 ≈ 0 (`lazy` dans un chunk déjà paresseux) ; `LayoutEditor`, `CreationsPage`, `DraftPreviewFrame`, `AttachmentsField`/`FormatsField` (via `CreateComponentDialog` déjà paresseux), `fr-layout.ts`, `fr-creations.ts` hors entrée. Attendu ≈ 220,6 kB, gate ≤ 222,0 kB, plafond 230 kB jamais relevé.
