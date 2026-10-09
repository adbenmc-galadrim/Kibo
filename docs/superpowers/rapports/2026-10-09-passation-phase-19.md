# Passation : phase 19 en cours, vague 2 intégrée

Ce document permet de reprendre la phase 19 (jeux itch.io et Storybook) sans réanalyse. Délégation d'Adam du 2026-10-09 : le chef d'équipe décide, vérifie, fusionne et tague chaque phase lui-même jusqu'à la fin de la feuille de route.

## Où en est tout

- `main` (`79afa25b`) : phase 18 fusionnée, tag `v0.18.0-alpha.1` posé, release publiée.
- `phase/19` (`5c98b913`, poussée) : spec §25, plan, feuille de route, puis T1 à T6 intégrées, chacune après relecture `kibo-reviewer` et gate locale complète (`integ19.sh`). Aucune PR ouverte.
- Plan : `docs/superpowers/plans/2026-10-09-kibo-phase-19.md`, T1 à T6 cochées.
- Budget de l'entrée UI à la dernière gate : **223,0 kB** (226,3 avant la phase ; 222,2 après la compensation de T1 ; exigence de fin de phase ≤ 226,4 ; plafond 230 jamais relevé).
- Tests unitaires à la dernière gate : 5 892, 0 échec ; E2E : 134 verts.

## Livré dans `phase/19`

| Tâche | Contenu | Relecture |
|---|---|---|
| T1 | Capacité `embed` et `manifest.embeds`, fournisseur `storybook`, `FrameMime` HTML, réglage local `storybook` (hors CRDT), `sdk.embed.open`, `sdk.design.storybooks`, `EmbedFrame`, simulations ; textes marketplace, sécurité et collab sortis de l'entrée (`FORBIDDEN_IN_ENTRY`) | acceptée |
| T2 | Page relais `GET /e/<jeton>` (CSP fermée, une iframe, aucun script), vérification d'intégrabilité par en-têtes seulement, porte `embed.open` (hôte exact, quotas, journal), `frame-src 'self'` pour les composants `design`/`embed` | acceptée |
| T3 | Fournisseur Storybook sans cache, origines du projet et des worktrees (`.env.local` puis `.env`, première définition trouvée), réglage `storybook` du projet (`requireLocal`) | 1 refus (repli sur `.env` après une définition invalide) ; corrigé |
| T4 | Composant « Jeu itch.io » (`components/itch`), `itch` dans `BUILTIN_IDS`, ligne de permission qui nomme les hôtes déclarés | 1 refus (limite des sauvegardes absente de l'aide) ; corrigé |
| T5 | Maquette : story en iframe, menu des origines (éphémère, sans `setConfig`), comparaison côte à côte et en superposition | acceptée ; E2E `design.spec.ts` cassé à la gate par un texte vide modifié, remis selon §21.6 |
| T6 | Section « Storybook » de « Modifier le projet », masquée en session distante | acceptée |

## Reste à faire

1. **T7 (vague 3)** : câblage final et E2E. Point bloquant connu : `packages/daemon/src/design/module.ts:40` lève encore `INTERNAL "embed relay not wired"` ; le remplacer par `kit.embed` (T2 expose `IntegrationKit.embed: EmbedService`, déjà créé avant `designModule` dans `integrations/bootstrap.ts`). Tant que ce n'est pas fait, une story déclarée échoue dans le vrai démon. Puis `embed.integration.test.ts`, `storybook.integration.test.ts`, `e2e/embeds.spec.ts` (ports 4461–4462, `fakeItchPort` +5000, `fakeStorybookPort` +6000, `serve.ts --embeds`), captures 178 à 182 dans `screens/`.
2. **T8 (vague 4)** : Penpot, page 27, écrans 178 à 182, d'après les captures de T7. Worktree déjà créé : `.claude/worktrees/p19-t8` (branche `feat/p19-t8`, à rebaser sur `phase/19`).
3. **T9 (jalon)** : vérification réelle du chef d'équipe (jeu `sigmatronic.itch.io/una-war`, un jeu non intégrable, Storybook d'Emis et un worktree sur 6007, `curl -I` du relais), version `0.19.0-alpha.1`, CHANGELOG, rapport `2026-10-<jj>-jalon-v0.19.md`, PR `phase/19` → `main`, CI verte, fusion, tag `v0.19.0-alpha.1` posé par le chef d'équipe.

## À reporter au rapport de jalon

- Fiche, installation et publication marketplace : la permission `embed` garde le texte générique, sans nommer les hôtes (`GrantedPermissions`, signé, inchangé).
- `parseEnvPort` / `findEnvPort` : la spec (« première définition trouvée ») l'emporte sur la décision 7 du plan (« premier port valide ») ; aligner le plan. Spec §25.2 : nommage du mock (`embedCalls`, `embed: { error }`) à aligner sur le plan.
- Journal Storybook en `console.warn` (pas d'`IntegrationId` `storybook`).
- Dossier du projet pour les worktrees : réglage local puis registre de l'espace de travail.
- Erreurs de transport de la vérification d'intégrabilité non mises en cache (le widget redemande au retour du réseau).
- `packages/sdk/src/mock.ts` à 308 lignes : extraire à la prochaine modification.

## Gate et charge de la machine

- Trois échecs de gate sans lien avec les tâches, tous passés à la relance : `single-instance.test.ts` (sonde, 1 s), quatre scénarios longs (suite unitaire à 2 456 s au lieu de ~410 s), `viewer.spec.ts` en sombre. Des simulateurs iOS tournaient sur la machine (pas les nôtres, laissés tels quels).
- La suite unitaire complète dépasse 600 s quand plusieurs devs travaillent : les devs lancent leurs tests par paquet au premier plan ; la gate (`integ19.sh`, alarme 1 800 s) fait la suite complète.
- Le motif de résumé de la gate (`grep "(fail)"`) ne voit pas les échecs colorés : lire `gate-unit-p19-<t>.log` après `perl -pe 's/\e\[[0-9;]*m//g'` et chercher `^✗`.

## État local

- Démon d'Adam : lancé depuis `.claude/worktrees/p17-t16` (détaché sur `79afa25b`, version 0.18), processus `bun packages/daemon/src/main.ts --ui packages/ui/dist`. À relancer sur `phase/19` pour la vérification du jalon, après une sauvegarde de `~/.kibo`.
- Worktrees de la phase : `p19-spec`, `p19-t1` à `p19-t6` (intégrées, supprimables), `p19-t8` (à venir), `p19-passation` (ce document).
- Script d'intégration : `.claude/worktrees/_outils/integ19.sh <tâche>` (rebase sur `phase/19`, gate, avance rapide, push) ; verrou `.integ.lock`.

## Pour Adam

- Alertes Dependabot (1 élevée, 1 modérée) sur la branche par défaut.
- Fichiers temporaires à supprimer : artefacts Playwright (`/var/folders/.../playwright-artifacts-*`), `/tmp/kibo-*`, `/tmp/p19-t4-harness/`, `/tmp/p19t5-shots`.

## Commandes

- Gate locale : `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts` (0 échec), `bun run --cwd e2e test`.
- État sur GitHub : `gh pr list --state all --limit 3`, `gh run list --limit 5`, `git log --oneline origin/main..origin/phase/19`.
