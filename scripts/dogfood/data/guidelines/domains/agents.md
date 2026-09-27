# Domaine Agents

Spec : `docs/superpowers/specs/2026-09-26-kibo-agents.md` et `docs/superpowers/specs/2026-09-25-kibo-design.md` §7.
- Tout run passe par la file d'attente (créneaux et seuils CPU/RAM), sans exception.
- L'état d'un run et d'un ticket change sur un hook ou un événement déterministe, jamais sur la parole de l'agent.
- Guidelines matérialisées dans l'ordre workspace → projet → domaine → profil.
- Tests sans token : faux binaire `claude` qui rejoue des scripts d'événements de hooks.
- Worktree par ticket recommandé ; jamais `--dangerously-skip-permissions` par défaut.
