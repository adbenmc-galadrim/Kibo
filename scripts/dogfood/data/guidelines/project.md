# Kibo : règles du projet

Les règles complètes sont dans `CLAUDE.md` à la racine du dépôt : Claude Code le charge déjà dans le worktree du run, cette guideline ne le recopie pas. La spec `docs/superpowers/specs/2026-09-25-kibo-design.md` prime ; toute décision nouvelle y est d'abord écrite. Feuille de route : `docs/superpowers/plans/2026-09-25-kibo-feuille-de-route.md`.

Rappel des principes non négociables :
- Local-first : tout fonctionne hors ligne, sauf les appels aux agents.
- Zéro token pour l'état : un état change sur un événement déterministe (hook, git, fichier, API), jamais sur la parole d'un LLM.
- TypeScript partout (sauf la coque Tauri), contrats Zod, pas de `any` ni de `as` non justifié, aucun commentaire.
- Dogfooding : les composants intégrés utilisent le SDK public.
- Sécurité : démon sur `127.0.0.1`, secrets au trousseau, jamais dans le CRDT ; jamais `--dangerously-skip-permissions` par défaut.
- TDD : test d'abord ; `bun test packages components` et `bun run check` verts avant tout commit.
