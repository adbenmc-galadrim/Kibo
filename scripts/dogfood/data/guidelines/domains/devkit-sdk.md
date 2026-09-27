# Domaine Devkit et SDK

Spec : `docs/superpowers/specs/2026-09-26-kibo-composants.md` (B).
- Un seul SDK à API asynchrone, identique en trusted et en sandboxed : le code d'un composant ne change pas avec le niveau de confiance.
- Les composants intégrés (`components/<id>/`) n'utilisent que le SDK public, sans accès privilégié.
- Tout composant passe la suite de conformité commune sur le SDK simulé ; les permissions déclarées sont comparées aux permissions utilisées.
- Validation avant enregistrement : typecheck, tests, conformité, build (`packages/devkit`), dans le bac à sable OS.
- Manifeste v1 validé par Zod (`packages/schema/src/manifest.ts`) ; migrations pures et synchrones par version majeure.
- Dépendances : `schema ← sdk ← components ← ui`, `devkit ← cli` ; `core ← sdk/mock` pour le SDK simulé seulement.
