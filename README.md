# Kibo

Centre de contrôle de projets de code, local-first, piloté par l'IA.
Un workspace contient des projets ; un projet contient des pages ; une page contient des composants
(Kanban, tickets, graphe de dépendances, notes…) que l'utilisateur peut créer lui-même.

État : phase 5 · Intégrations livrée (`v0.5`), phase 6 · IA dans le produit en cours. Rapports dans `docs/superpowers/rapports/`.

## Lancer

```sh
bun install
bun run start
```

`bun run start` construit l'UI puis lance le démon : ouvrir l'URL `KIBO_READY` affichée.
Développement de l'UI : `bun packages/daemon/src/main.ts --dev` puis `bun run --cwd packages/ui dev` (Vite sur `http://localhost:5173`, appairage avec le jeton de `~/.kibo/token`).
Tests : `bun test packages components`, `bun run check`, `bun run typecheck`, E2E : `bun run --cwd e2e test`.

## Agents

Kibo lance Claude Code en local (`claude -p`, sur ton abonnement) : installe le CLI (version 2.1.259 ou plus récente) et connecte-toi une fois avec `claude`. Le démon le cherche dans le `PATH`, `~/.local/bin`, `~/.claude/local`, `/opt/homebrew/bin` et `/usr/local/bin` ; sinon, passe `--claude-bin <chemin>` au démon.

- Crée un profil dans **Agents** (modèle, espace de travail, permissions, runs en parallèle), puis « Assigner à un agent » depuis la fiche d'un ticket.
- Tout run passe par la file (**Files d'attente**) : créneaux hôte, créneaux du profil, seuils CPU 85 % et RAM 90 %.
- Un run qui pose une question attend ta réponse dans la barre des agents, sans occuper de créneau.
- Les guidelines (**Paramètres › Domaines & guidelines**) sont injectées dans l'ordre workspace → projet → domaine → profil.
- Les tests n'utilisent jamais le vrai CLI : `packages/daemon/src/agents/fake-claude.ts` le remplace.

## Où trouver quoi

| Chemin | Contenu |
|---|---|
| `docs/superpowers/specs/2026-09-25-kibo-design.md` | Spec de référence (architecture, données, agents, UI) |
| `design/pdf/` | Maquettes exportées, sombre et clair |
| `design/penpot/` | Penpot auto-hébergé, fichier source et scripts de génération |
| `design/donnees-fictives.md` | Jeu de données unique affiché dans toutes les maquettes |
| `design/revue-flows.md` | Revue des flows : décisions, corrections, écrans restant à dessiner |
| `docs/superpowers/plans/2026-09-25-kibo-feuille-de-route.md` | Feuille de route par phases et jalons |
| `docs/superpowers/plans/2026-09-25-kibo-mvp.md` | Plan détaillé de la phase 1 (MVP) |
| `CLAUDE.md` | Règles de travail (humains et agents) |
| `.claude/agents/` | Agents de l'équipe (lead, dev, reviewer, runner) |

## Stack prévue

Tauri 2 · démon Bun/TypeScript · React + shadcn/ui + Tailwind · Loro (CRDT) + SQLite · Zod.
macOS et Linux.

## Licence

MIT
