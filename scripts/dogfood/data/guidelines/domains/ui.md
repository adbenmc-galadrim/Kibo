# Domaine UI

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` §8, maquettes Penpot (`design/penpot/README.md`, PDF dans `design/pdf/`).
- L'UI ne parle qu'au démon, jamais au disque.
- Composants shadcn/ui d'abord (réexportés par le SDK), tokens zinc ; orange réservé aux agents et à la marque.
- Chaque écran existe en sombre et en clair, thème système par défaut ; un écran modifié se vérifie dans les deux.
- Textes d'interface en français dans `packages/ui/src/i18n/fr.ts`.
- Budget de chargement : `bun run budget` (230 kB) ; charger à la demande ce qui n'est pas sur le premier écran.
- Composants React en `PascalCase.tsx`, un fichier par responsabilité, découper au-delà de ~300 lignes.
