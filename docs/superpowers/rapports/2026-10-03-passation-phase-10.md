# Passation : phase 10 close, jalon v1.2.0

Seuil d'usage hebdomadaire fixé par Adam : 100 %. Ce document permet de reprendre sans réanalyse.

## Où en est tout

- `main` (`855914cf`) : phase 10 fusionnée par la PR « suivis après v1.1, version 1.2.0 » ; CI verte sur la PR (check, unit ×2, e2e, desktop-smoke ubuntu et macOS) et sur `main` après fusion. Version de l'application `1.2.0`.
- Rapport de jalon : `docs/superpowers/rapports/2026-10-03-jalon-v1.2.md` (livré, mesures, décisions de spec à valider, écarts, release).
- Plan : `docs/superpowers/plans/2026-10-03-kibo-phase-10.md`, 13 tâches cochées.
- Tous les lots du plan d'action UI/UX (`2026-09-27-kibo-plan-action-ui-ux.md`, lots 1 à 9) sont livrés depuis v1.1. La feuille de route s'arrête à la phase 8 : la suite dépend des décisions d'Adam ci-dessous.

## Release : en attente d'Adam

Aucun tag posé depuis `v1.0.0`. Au choix d'Adam, après validation :

- poser seulement `v1.2.0` sur `main` (la mise à jour automatique passe de 1.0.0 à 1.2.0) ;
- ou poser `v1.1.0` sur `654f32cd`, puis `v1.2.0`.

Commande depuis `main` à jour : `git tag v1.2.0 && git push origin v1.2.0`, puis suivre `gh run list --workflow release.yml` et contrôler `latest.json` (`darwin-aarch64`, `linux-x86_64`).

## Pour Adam

- Alerte Dependabot `glib` (n° 1) : à rejeter par Adam, commande dans le rapport de jalon.
- Vérification manuelle : lancer Kibo deux fois sur le même dossier de données (réutilisation du démon en place).
- Décisions : `run_done` à chaque fin de tour (une règle « run terminé → En review » bascule le ticket en pleine conversation) ; A22, A11, écran Créations, Source MCP en petit format, écran 114, projets partagés, « PR ouverte → En review », second run sur un ticket, `answerRun` sur un projet en lecture seule (section « En attente d'Adam » du plan de phase 10).

## Suivis techniques sans décision

- Libellé « réponse reçue · reprise de la session » aussi pour un simple message (`QueueItem.tsx`).
- Run interrompu par un redémarrage du démon : le temps d'arrêt compte dans sa durée.
- Test instable sous charge : « a skeleton with role=status is shown while the build runs » (`draft-preview.test.tsx`).
- Aperçu en Demi-page : le contenu de la carte n'occupe que le haut du cadre.

## Maquettes Penpot (écrans 98 à 135)

- Branche `feat/p10-design` (worktree `.claude/worktrees/p10-design`) : scripts de dessin `design/penpot/scripts/17-finitions.js`, `18-socle.js` à `23-formats-creations.js`, README. Intégration après relecture.
- Dessinés et enregistrés dans Penpot, page « 14 · Finitions UI », sombre et clair : 98, 99, 100, 100b, 100c, 101, 101b, 101c, 101d. Restent sur la page : deux plans « base · … » à retirer (`S.dropBases()`) et la planche 100b sombre à redessiner (liste déroulante mal placée).
- À dessiner : 102 à 106b (page 14), 107 à 135 (pages 15 à 19), puis exports (`storage.exportPage`, PDF `design/pdf/kibo-design-{sombre,clair}.pdf` par `pdfunite`, `pack-penpot.sh` pour `kibo.penpot.xz`).
- Méthode : lots de 4 à 6 écrans ; après chaque lot, laisser Penpot enregistrer, recharger l'onglet et vérifier les planches. Un rechargement avant l'enregistrement perd le travail, et l'onglet Chrome a planté vers 3 Go. Chargement : `01` à `08`, puis `17-finitions`, `18-socle`, `19` à `23` ; `S.job(...)` avec `S.FINITIONS`, `S.PROJETS`, `S.TICKETS`, `S.COMPOSANTS`, `S.AGENTS_CODE`, `S.CREATIONS`. Récepteur local sur le port 8787 à arrêter en fin de séance.

## Commandes

- Gate locale : `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run --cwd packages/ui build`, `bun run budget`, `bun test packages components ./scripts` (0 échec), `bun run --cwd apps/desktop smoke` si `apps/desktop` change, `bun run --cwd e2e test`.
- État sur GitHub : `gh pr list --state all --limit 3`, `gh run list --limit 5`, `git tag --list 'v1.*'`.
