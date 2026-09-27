# Kibo · Mises à jour de l'application (phase 8, v1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'application de bureau se met à jour depuis les releases GitHub, signature vérifiée, jamais sans le clic de l'utilisateur.

**Architecture:** spec I (`docs/superpowers/specs/2026-09-27-kibo-mises-a-jour.md`). Coque : deux plugins et une capacité IPC accordée à l'origine du démon. UI : magasin d'état + planification + carte Paramètres › Général, en TypeScript testé. Démon : CSP seulement. CI : `release.yml` sur tag `v*`.

**Tech Stack:** Tauri 2.11 (`tauri-plugin-updater`, `tauri-plugin-process`, `tauri::ipc::CapabilityBuilder`), `@tauri-apps/api` 2.12.0, `@tauri-apps/plugin-updater` 2.13.0, `@tauri-apps/plugin-process` 2.4.0, `tauri-apps/tauri-action@v0`, minisign (CLI Tauri).

## Tâches

- [x] **T1 · Décision** : spec I écrite ; pointeurs ajoutés à la spec de conception (§4, §12) et à la feuille de route.
- [x] **T2 · Démon** : `connect-src` de la CSP accepte `ipc:` et `http://ipc.localhost` (`ui-route.ts`, test `server-ui.test.ts`).
- [x] **T3 · Version** : `packages/devkit/src/release-version.ts` (lecture de `tauri.conf.json`, recopie dans `Cargo.toml`, `Cargo.lock`, `package.json`, contrôle du tag) en TDD ; CLI `apps/desktop/scripts/version.ts set|check` ; version de l'application portée à `1.0.0`.
- [x] **T4 · Coque** : `Cargo.toml` (+ `tauri-plugin-updater`, `tauri-plugin-process`), `tauri.conf.json` (`plugins.updater` avec clé publique et endpoint, `bundle.createUpdaterArtifacts`), `main.rs` (plugins, capacité IPC à l'origine de `KIBO_READY`, test unitaire de l'origine). Compilation vérifiée par `desktop-smoke` uniquement.
- [x] **T5 · UI, état** : `packages/ui/src/updates/update-state.ts` (machine à états pure) et `update-store.ts` (magasin, port `UpdaterPort`), `tauri-updater.ts` (port réel, imports dynamiques), `update-schedule.ts` (10 s puis 6 h, temporisateurs injectés), textes `i18n/fr-updates.ts`. Tests unitaires.
- [x] **T6 · UI, carte** : `updates/UpdateCard.tsx` dans `GeneralPage` : version, état, notes, progression, erreurs (dont AppImage absente), blocage par les runs actifs ; test `update-card.test.tsx` ; branchement de la planification dans le `Shell` quand `inTauri()` ; `FORBIDDEN_IN_ENTRY` étendu (`@tauri-apps`, `fr-updates`, `UpdateCard`).
- [x] **T7 · Publication** : `.github/workflows/release.yml` (tag `v*` et `workflow_dispatch` avec `intel`), contrôle tag/version, sidecar + chaîne d'outils + `tauri-action`, release brouillon puis publiée, `latest.json`.
- [x] **T8 · Documentation** : README (installer, mettre à jour), spec I §6 (publier), rapport final au chef d'équipe (clé, secrets, ce qui n'est vérifié qu'en CI).
- [ ] **T9 · Vérification en CI** (chef d'équipe) : `desktop-smoke` vert avec les plugins ; `Cargo.lock` régénéré par la CI recopié dans le dépôt ; secrets `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` posés par Adam ; premier tag `v1.1.0` ; mise à jour effective observée depuis une `1.0.0` installée.
