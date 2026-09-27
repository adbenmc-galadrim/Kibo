# Domaine Desktop

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` §4 (Tauri 2, démon en sidecar).
- Tauri n'est qu'une fenêtre : Rust minimal, aucune logique métier dans la coque.
- Le binaire du sidecar est le point d'entrée unique (démon, CLI `kibo`, runtime sandboxé).
- Aucune capacité donnée à la fenêtre au-delà du nécessaire ; navigation de sous-cadre hors de l'origine sandbox refusée.
- Notifications natives via `KIBO_NOTIFY` écrit par le démon sur sa sortie.
- macOS et Linux dès le départ ; le smoke test Tauri passe en CI sur les deux.
