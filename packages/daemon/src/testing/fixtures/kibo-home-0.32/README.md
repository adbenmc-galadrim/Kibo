# kibo-home-0.32

Dossier `~/.kibo` fictif d'une version 0.32, avant le retrait de l'ancien Kibo (spec §49.3).
Il sert aux tests de `packages/daemon/src/migrations/legacy-*`.

Contenu :

- `runs.db` : 3 runs `ticket` avec `ticket_id`, 1 run `ticket` sans `ticket_id` (création IA),
  2 runs `project` (`p1`, `p2`) avec événements et jetons, une session, un lot (dont une action
  retirée `assignAgent`), un réveil et une réponse en attente ; toutes les tables mortes de §49.3
  avec une ligne ; déclencheurs append-only posés.
- `kibo.db` : le doc de l'espace de travail, `project_events`, `component_events` (gardée),
  `remote_sessions` (une locale, une distante) et les tables mortes `agent_settings`,
  `file_versions`, `component_drafts`, `market_*`, `sync_items`, `sync_cursors`, `sync_outbox`
  (liaisons GitHub Issues), `sync_config` et `sync_projects` (sync d'équipe).
- `runs/<id>/` : un dossier par run.

Régénérer depuis `packages/daemon` :

```sh
bun src/testing/make-home-0.32.ts
```
