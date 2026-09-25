# Kibo

Centre de contrôle de projets de code, local-first, piloté par l'IA.
Un workspace contient des projets ; un projet contient des pages ; une page contient des composants
(Kanban, tickets, graphe de dépendances, notes…) que l'utilisateur peut créer lui-même.

État : conception. Pas encore de code.

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
