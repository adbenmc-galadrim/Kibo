# Domaine CI

Workflow : `.github/workflows/ci.yml` (macOS et Linux).
- CI rouge sur `main` : tout s'arrête jusqu'à la correction.
- Commandes de référence : `bun run check`, `bun run typecheck`, `bun test packages components`, `bun run --cwd e2e test`.
- Tests déterministes : graine fixe pour fast-check, aucun compte réel, aucun token consommé.
- Un échec qui n'apparaît que sous Linux se reproduit avant d'être corrigé ; ne jamais désactiver un test pour passer.
