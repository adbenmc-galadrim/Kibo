# Domaine Sécurité

Spec : `docs/superpowers/specs/2026-09-25-kibo-design.md` §10, spec B §4 (bac à sable), spec H §8 (durcissement OS).
- Démon sur `127.0.0.1` uniquement ; appairage par jeton local échangé contre un cookie `HttpOnly` ; `Origin` et `Host` contrôlés ; accès distant seulement en opt-in, avec TLS.
- Secrets au trousseau système, jamais dans le CRDT ; fichiers de données en `0600`.
- Backends sandboxés sous `sandbox-exec` (macOS) ou `bwrap` (Linux) : ni réseau, ni disque hors du dossier temporaire, ni processus ; sans bac à sable, `SANDBOX_UNAVAILABLE`.
- Toute modification du code d'un composant change son hash et redemande la confiance.
- Agents : jamais `--dangerously-skip-permissions` par défaut, arguments réservés refusés, un jeton de hook par run.
- Une tâche sensible est relue par le lead avant intégration.
