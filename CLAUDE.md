# Kibo — règles du projet

Valables pour les humains comme pour les agents. Référence : `docs/superpowers/specs/2026-09-25-kibo-design.md`.
En cas de doute ou de conflit, la spec prime ; toute décision nouvelle y est d'abord écrite.

## Principes non négociables

- **Local-first** : les données vivent sur la machine ; tout fonctionne hors ligne, sauf les appels aux agents.
- **Zéro token pour l'état** : un état change sur un événement déterministe (hook, git, fichier, API), jamais sur la parole d'un LLM.
- **Un seul langage** : TypeScript partout (sauf la coque Tauri). Contrats typés avec Zod.
- **Dogfooding** : les composants intégrés utilisent le SDK public, sans accès privilégié.
- **Sécurité** : démon sur `127.0.0.1` uniquement, secrets dans le trousseau système, jamais dans le CRDT.
  Jamais `--dangerously-skip-permissions` par défaut.
- **Agents** : tout run passe par la file d'attente (créneaux et seuils CPU/RAM), sans exception.

## Git

- Branche par sujet depuis `main` (`feat/…`, `fix/…`, `docs/…`) ; jamais de commit direct sur `main`.
- Commit : une ligne, en français, préfixe conventionnel (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`), moins de 50 caractères, sans body.
- Aucune mention d'IA : pas de `Co-Authored-By`, pas de signature ni de lien d'outil, nulle part (commits, PR, issues).
- Stager les fichiers explicitement ; ne pas embarquer de modification sans rapport.
- PR : pousser la branche, puis rédiger la description. Ne pas répondre à une review sans accord de l'auteur de la PR.

## Design

- Penpot est la source de vérité des maquettes (`design/penpot/README.md`).
- Tout écran existe en **sombre et en clair** ; thème système par défaut.
- shadcn/ui en priorité, tokens zinc, accent `#F97316`, Geist, Lucide.
- Un écran modifié ⇒ réexporter `kibo.penpot` et les PDF (`design/pdf/`), et mettre à jour la spec si le comportement change.

## Tests

Pas de fonctionnalité sans test (stratégie : spec §11). Les tests ne consomment jamais de tokens :
agents testés avec le faux binaire `claude`, composants avec la suite de conformité.

## À définir

Conventions de code, arborescence du monorepo et organisation de l'équipe d'agents : ajoutées ici
lors de la feuille de route, avant la première ligne de code.
