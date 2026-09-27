# Domaine Démon

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` §4 et §5, compléments des specs de phase.
- Le démon est l'unique porte d'entrée : il détient les données, lance les agents et sert l'UI.
- Docs Loro (workspace, projets) persistés dans SQLite ; runs, hooks et logs en append-only hors CRDT ; index dérivés toujours reconstructibles.
- Toute requête passe par `RpcRequest` (Zod) ; une méthode nouvelle s'ajoute au schéma avant le code.
- Erreurs du domaine en `KiboError` avec un code stable (`packages/schema/src/errors.ts`), jamais avalées.
- Dépendances autorisées : `schema ← core ← daemon`, `schema ← devkit ← daemon`, `schema ← trust ← daemon` ; `core` reste pur, sans I/O.
- Tests d'intégration avec un `KIBO_HOME` temporaire et le trousseau en mémoire.
