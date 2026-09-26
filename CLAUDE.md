# Kibo — règles du projet

Valables pour les humains comme pour les agents. Référence : `docs/superpowers/specs/2026-09-25-kibo-design.md`.
En cas de doute ou de conflit, la spec prime ; toute décision nouvelle y est d'abord écrite.
Feuille de route : `docs/superpowers/plans/2026-09-25-kibo-feuille-de-route.md`.

## Principes non négociables

- **Local-first** : les données vivent sur la machine ; tout fonctionne hors ligne, sauf les appels aux agents.
- **Zéro token pour l'état** : un état change sur un événement déterministe (hook, git, fichier, API), jamais sur la parole d'un LLM.
- **Un seul langage** : TypeScript partout (sauf la coque Tauri). Contrats typés avec Zod.
- **Dogfooding** : les composants intégrés utilisent le SDK public, sans accès privilégié.
- **Sécurité** : démon sur `127.0.0.1` uniquement, secrets dans le trousseau système, jamais dans le CRDT.
  Jamais `--dangerously-skip-permissions` par défaut.
- **Agents** : tout run passe par la file d'attente (créneaux et seuils CPU/RAM), sans exception.

## Monorepo

```
apps/desktop/        coque Tauri 2 (Rust minimal) qui lance le démon en sidecar
packages/schema/     schémas Zod partagés (ticket, page, statut, lien, manifest) — aucune dépendance runtime hors zod
packages/core/       domaine : docs Loro (workspace, projet), arbres, workflow — pur, sans I/O
packages/devkit/     outillage des composants : empreinte, imports, build, validation (CLI et démon)
packages/daemon/     serveur Bun : persistance SQLite, API HTTP/WS, appairage, sert l'UI
packages/sdk/        SDK des composants (client, SDK simulé, suite de conformité)
packages/cli/        commande kibo (création, test, aperçu, publication de composants)
packages/ui/         application React (shadcn/ui, Tailwind) servie par le démon
components/<id>/     composants intégrés (kanban, tickets, github-issues sans UI, mcp-source…) écrits avec le SDK public
e2e/                 parcours Playwright
design/  docs/       maquettes, spec, plans
```

Dépendances autorisées entre paquets : `schema ← core ← daemon`, `schema ← sdk ← components ← ui`, `schema ← devkit ← daemon`, `devkit ← cli` ; `core ← sdk/mock` (SDK simulé uniquement).
`core` ne fait aucune I/O ; `ui` ne parle qu'au démon (jamais au disque).

## Code

- Code, identifiants et messages d'erreur internes en **anglais**. Specs, plans, commits, PR et textes d'interface en **français** (textes UI dans `packages/ui/src/i18n/fr.ts`).
- TypeScript `strict`, ESM, pas de `any` ni de `as` non justifié. Les types viennent des schémas Zod (`z.infer`).
- **Aucun commentaire** dans le code : noms explicites et petites fonctions suffisent. Seule exception : une contrainte externe invisible dans le code (bug d'une dépendance, exigence d'un OS), en une ligne.
- Exports nommés uniquement. Fichiers en `kebab-case.ts`, composants React en `PascalCase.tsx`. Un fichier = une responsabilité ; au-delà de ~300 lignes, découper.
- Erreurs du domaine : `KiboError` avec un `code` stable (`packages/schema/src/errors.ts`) ; jamais d'erreur avalée.
- Formatage et lint : **Biome** (`bun run check`). Aucun commit si `bun run check` ou `bun test` échoue.
- Dépendance nouvelle : justifiée dans le commit ou le plan, version figée par `bun.lock`, aucun script `postinstall`.
- UI : composants shadcn/ui d'abord (`packages/sdk/src/ui`, réexportés par le SDK), tokens zinc, orange réservé aux agents, chaque écran en sombre et en clair.

## Tests

TDD : le test d'abord, le voir échouer, puis le code minimal. Tests à côté du code (`*.test.ts`).
Les tests ne consomment jamais de tokens : agents testés avec le faux binaire `claude`, composants avec la suite de conformité, CRDT avec fast-check.

## Équipe d'agents

| Rôle | Modèle | Responsabilité |
|---|---|---|
| Chef d'équipe | Fable (session principale) | Suit la feuille de route, choisit la tâche suivante, délègue, vérifie, intègre, tient le plan à jour |
| Lead dev | Opus 5.5 (`kibo-lead`) | Écrit le plan de chaque phase, tranche les choix techniques, relit les tâches à risque |
| Devs | Opus 5.5 (`kibo-dev`) | Implémentent une tâche du plan en TDD, dans leur worktree |
| Reviewer | Sonnet (`kibo-reviewer`) | Relit chaque tâche : conformité au plan et à la spec, qualité, tests |
| Exécutant | Haiku (`kibo-runner`) | Tâches mécaniques : lancer les tests, corriger le lint, chercher dans le code |

Boucle, jusqu'au jalon de la phase :
1. Fable prend la première tâche non cochée du plan de phase et la confie à un `kibo-dev`, avec le chemin du worktree (`.claude/worktrees/<phase>-<tâche>`) et la branche `feat/<phase>-<tâche>`.
2. Le dev livre : tests verts, `bun run check` vert, un ou plusieurs commits conformes.
3. `kibo-reviewer` relit. Refus ⇒ retour au dev avec les remarques (3 refus sur la même tâche ⇒ `kibo-lead` reprend).
4. Accepté ⇒ Fable rebase sur `main`, intègre en fast-forward, pousse, coche la tâche dans le plan.
5. CI rouge sur `main` ⇒ tout s'arrête jusqu'à la correction.

**Jalon** (fin de phase) : Fable vérifie la conformité aux maquettes, tague `v0.<n>`, écrit un rapport (ce qui est livré, écarts, risques) dans `docs/superpowers/rapports/`, puis enchaîne la phase suivante sans attendre, jusqu'à la phase 7 (décision d'Adam). Adam peut demander un arrêt à tout moment.
**Escalade vers Adam** : décision absente de la spec, conflit avec la spec, 3 échecs de `kibo-lead` sur une tâche, besoin d'un secret ou d'un compte.

## Git

- Une branche par tâche depuis `main` ; seul le chef d'équipe intègre dans `main`, après review.
- Commit : une ligne, en français, préfixe conventionnel (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`), moins de 50 caractères, sans body.
- Aucune mention d'IA : pas de `Co-Authored-By`, pas de signature ni de lien d'outil, nulle part (commits, PR, issues).
- Stager les fichiers explicitement ; ne pas embarquer de modification sans rapport.
- Ne pas répondre à une review humaine sans accord d'Adam.

## Design

- Penpot est la source de vérité des maquettes (`design/penpot/README.md`) ; données affichées : `design/donnees-fictives.md`.
- Tout écran existe en **sombre et en clair** ; thème système par défaut.
- Un écran modifié ⇒ réexporter `kibo.penpot.xz` et les PDF (`design/pdf/`), et mettre à jour la spec si le comportement change.
