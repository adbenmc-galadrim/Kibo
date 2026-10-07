# Kibo

Centre de contrôle de projets de code, local-first, piloté par l'IA.
Un workspace contient des projets ; un projet contient des pages ; une page contient des composants
(Kanban, tickets, graphe de dépendances, notes…) que l'utilisateur peut créer lui-même.

État : phase 7 · Sync et marketplace livrée (`v1.0`), MVP complet. Rapports dans `docs/superpowers/rapports/`.

## Lancer

```sh
bun install
bun run start
```

`bun run start` construit l'UI puis lance le démon : ouvrir l'URL `KIBO_READY` affichée.
Développement de l'UI : `bun packages/daemon/src/main.ts --dev` puis `bun run --cwd packages/ui dev` (Vite sur `http://localhost:5173`, appairage avec le jeton de `~/.kibo/token`).
Tests : `bun test packages components`, `bun run check`, `bun run typecheck`, E2E : `bun run --cwd e2e test`.

### Commandes `just`

Toutes les commandes courantes sont des recettes du [`justfile`](justfile) : installer `just` (`brew install just` sur macOS, `sudo apt install just` ou `cargo install just` sous Linux), puis `just` pour la liste.

- `just up` construit l'UI et lance le démon en arrière-plan (`--port`, `--home` pour `KIBO_HOME`, `--no-build`) ; `just open`, `just status`, `just logs`, `just restart`, `just down`. PID et journal dans `.kibo-dev/`.
- `just dev` (démon `--dev` + Vite), `just start` (premier plan), `just desktop` (Tauri en développement).
- `just dmg`, `just app` (macOS), `just appimage`, `just deb`, `just rpm` (Linux), `just bundle` : paquets de l'hôte, signés ad hoc, sans artefacts de mise à jour.
- `just check`, `just typecheck`, `just test [chemin]`, `just e2e [--headed] [--theme dark]`, `just ci` (la CI en local).

## Installer l'application de bureau

Les versions sont publiées sur la [page des releases](https://github.com/adbenmc-galadrim/Kibo/releases) : `.dmg` pour macOS Apple Silicon et Intel, `.AppImage`, `.deb` et `.rpm` pour Linux x86_64. Le guide complet (première ouverture, vérification, sauvegardes, désinstallation) est dans [`docs/installation.md`](docs/installation.md).

Kibo est en alpha (`0.<phase>.0-alpha.N`) jusqu'au lancement ; les releases sont marquées pré-release et le canal de mise à jour est la release `alpha`.

- **macOS** : l'application est signée par Kibo (ad hoc), pas par Apple. Ouvre Kibo une première fois : macOS refuse. Réglages Système ▸ Confidentialité et sécurité ▸ « Ouvrir quand même ». Sur macOS 14 et avant, clic droit ▸ Ouvrir ▸ Ouvrir suffit. Avancé : `xattr -d com.apple.quarantine /Applications/Kibo.app`.
- **Linux** : `curl -fsSL https://github.com/adbenmc-galadrim/Kibo/releases/download/alpha/install.sh | bash` installe le bon paquet après avoir vérifié sa somme dans `SHA256SUMS`.

Ensuite, Kibo vérifie les nouvelles versions au lancement puis toutes les six heures et les propose dans **Paramètres › Général** ; rien ne s'installe sans ton clic (signature minisign vérifiée, spec `docs/superpowers/specs/2026-09-27-kibo-mises-a-jour.md`). Sur Linux, seule l'AppImage se met à jour toute seule.

Publier une version alpha : `bun apps/desktop/scripts/version.ts set 0.N.0-alpha.M`, section `## 0.N.0-alpha.M — AAAA-MM-JJ` dans `CHANGELOG.md` (le tag est refusé sans elle), commit, puis tag `v0.N.0-alpha.M` poussé sur `main` ; le workflow `release` construit, signe, publie une pré-release et met à jour le canal `alpha`.

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
