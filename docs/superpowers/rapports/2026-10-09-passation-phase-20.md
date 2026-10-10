# Passation : phase 19 livrée, phase 20 en attente de validation

Ce document permet de reprendre sans réanalyse. Délégation d'Adam du 2026-10-09 : le chef d'équipe décide, vérifie, fusionne et tague chaque phase lui-même jusqu'à la fin de la feuille de route. **Exception** : la phase 20 ne se planifie ni ne se code avant qu'Adam ait validé la spec écrite (§26 à §27).

## Où en est tout

- **Phase 19** (jeux itch.io et Storybook) : toutes les tâches (T1 à T9) et trois correctifs intégrés dans `phase/19`, gate verte (budget 223,4 kB, 5 951 tests unitaires, 138 E2E). PR #20 fusionnée (CI verte), tag `v0.19.0-alpha.1` posé, release publiée en pré-release avec `latest.json`. Rapport : `docs/superpowers/rapports/2026-10-09-jalon-v0.19.md`.
- **Phase 20** (voir et comprendre ce que font les agents) : spec écrite sur la branche `docs/p20-spec` (worktree `.claude/worktrees/p20-spec`), §26.1 à §26.10 ; feuille de route à jour (phases 20 et 21). **En attente de la validation d'Adam.**
- **Phase 21** (les agents parlent à l'agent de projet) : spec §27 sur la même branche, après la phase 20.
- **Maquettes de travail** (pistes, hors PDF) : branche `docs/p20-pistes` (worktree `.claude/worktrees/p20-pistes`), page Penpot « 28 · Pistes visibilité agents » et « 28c · Graphe » ; scripts `32b` à `32e` ; captures `screens/2026-10-09-pistes-agents/` et `screens/2026-10-09-pistes-epurees/`.

## Choix d'Adam pour la phase 20 (brainstorming du 2026-10-09)

- Pistes retenues : première série (`2026-10-09-pistes-agents`), pas les pistes épurées.
- Volet Agents du pied de page : **P2-A** (trois colonnes), barre entière cliquable, redimensionnable.
- Onglet Activité de la fiche : **P3-B** si la fiche fait au moins 1 100 px, sinon **P3-A**.
- Mention d'un agent : carte au survol par défaut, qui mène à la fiche latérale puis à une page dédiée.
- Progression : plan et compte rendu par l'outil MCP `ticket_progress` (fichiers vérifiés contre le diff git), repli sur TodoWrite ; rappels par hooks, jamais bloquants.
- Questions : destinataire proposé par l'agent et corrigeable ; liste des destinataires **par projet et modifiable** (`moi`, `produit`, `client` par défaut) ; export et collage de réponse (P6).
- Tickets **démarrables** : calculés (aucune dépendance bloquante ouverte), pastille neutre et filtre.
- Graphe lisible, **validé écran par écran le 2026-10-10** (spec §26.8 et §26.9) : 188 vagues tel quel (terminés repliés, liens directs seulement, bascule Vagues / Hiérarchique) ; 188b focus sur deux niveaux ; 188c regroupement par étiquette en option du menu « Affichage », désactivé par défaut ; 188d **zoom sémantique toujours actif** ; 188k pastille et filtre « Démarrables », filtre **après** « Grouper ».
- Couleurs du graphe, **variante A choisie le 2026-10-10** : fond teint à environ 15 % de la couleur du statut et bordure pleine de la même couleur, aussi sur les pilules du zoom éloigné ; plus de petite pastille de statut sur les cartes ; badge « Démarrable » neutre agrandi (11 px, contour, fond opaque). Couleurs : en sombre `#A1A1AA` (Backlog, À faire), `#3B82F6` (En cours), `#A855F7` (En review), `#EF4444` (Bloqué), `#22C55E` (Terminé) ; en clair `#71717A`, `#2563EB`, `#9333EA`, `#DC2626`, `#16A34A`. Planche de comparaison : page Penpot « 28d · Couleurs du graphe », script `32f-couleurs-graphe.js`, captures `screens/2026-10-10-couleurs-graphe/variante-{A..E}-{dark,light}.png`.
- Deux phases (20 puis 21).

## Écarts connus des maquettes

- 188c : liens entre chapitres d'une même colonne non tracés.
- 188k : filtre « Démarrables » avant « Grouper ».
- En clair, logo de l'espace de travail absent de l'en-tête de la barre latérale du modèle Kanban partagé.

## Retrait des composants « Jeu itch.io » et « Serpent » (décision d'Adam du 2026-10-10)

Spec §26.11. À faire comme **première tâche de la phase 20** (ou en correctif isolé avant elle), en TDD, branche dédiée depuis `main` :

1. Retirer `itch` et `snake` de `BUILTIN_IDS` (`packages/schema/src/component.ts`), de `packages/daemon/src/components/builtin-manifests.json`, du registre de l'interface (`packages/ui/src/registry.ts`, `packages/ui/package.json`, `packages/ui/tsconfig.json`) et du `package.json` racine ; supprimer `components/itch` et `components/snake`.
2. Mettre à jour les tests qui les citent : `registry.test.ts`, `registry-service.test.ts`, `gate-handlers.test.ts`, `embed-gate.test.ts`, `bootstrap.test.ts` ; `e2e/game.spec.ts` (Serpent) et la partie jeu de `e2e/embeds.spec.ts` disparaissent ou sont réécrites. Garder `fake-itch.ts` seulement s'il couvre encore la vérification d'intégrabilité générique (sinon faux site neutre).
3. Vérifier qu'un widget déjà posé (comme sur le tableau de bord d'un vrai projet) s'affiche « composant introuvable » avec « Retirer de la page », sans erreur.
4. Garder une preuve des capacités `fullscreen`, `audio`, `gamepad` (composant intégré restant ou suite de conformité ; sinon composant de démonstration réservé aux tests).
5. La capacité `embed`, le relais `/e/<jeton>` et la vérification restent pour Storybook. Le budget de l'entrée doit baisser ; noter le nouveau chiffre.
6. Écrans Penpot du Serpent (157) et du jeu (178 à 179) : marquer comme retirés dans `design/penpot/README.md` au prochain export.

## Maquettes du graphe à redessiner (avant le plan de la phase 20)

Dans `design/penpot/scripts/32e-graphe-lisible.js` (branche `docs/p20-pistes`, worktree `.claude/worktrees/p20-pistes`), page Penpot « 28c · Graphe », sombre et clair, puis réexport des 10 captures `screens/2026-10-09-pistes-agents/p7-graphe-*-{dark,light}.png` :

1. Style A sur 188, 188b, 188c (cartes dans les cadres), 188d (pilules) ; retirer la pastille de statut des cartes ; badge « Démarrable » neutre 11 px avec contour.
2. 188b : cartes estompées teintées mais atténuées ; cartes mises en avant gardent leur bordure colorée (plus de bordure blanche).
3. 188c : retirer « Zoom sémantique » du menu « Affichage » (il reste « Regrouper par étiquette », « Déplier tous les cadres », « Replier tous les cadres »).
4. 188k : filtre « Démarrables » après « Grouper » ; badge agrandi ; corriger le logo manquant en clair si possible sans casser les autres pages.
5. Vérifier le nombre de formes serveur = local et relire chaque capture. Une première tentative a été interrompue le 2026-10-10 : la page 28c sur le serveur peut différer du script, qui fait foi (le script redessine la page).

## Points ouverts hérités de la phase 19

- Aucun jeu itch.io réel ne s'affiche hors d'itch.io (défi Cloudflare sur l'iframe) : le composant est retiré (voir plus haut).
- Dialogue « Ajouter un composant » : pied non fixe (bouton sous le pli à 860 px).
- Comparaison Maquette : bande vide au-dessus des surfaces quand la story est plus haute.
- `packages/sdk/src/mock.ts` à 308 lignes.
- E2E sensibles à la charge : `catalog.spec.ts:55` (près de sa limite de 240 s) et `design.spec.ts` (30 s) ; ne jamais lancer deux gates en parallèle (le verrou de `integ19.sh` est un `mkdir` en boucle : une seule gate à la fois, mais l'ordre n'est pas garanti).
- Instables constatés sur `main` après la fusion de la PR #20 (verts à la relance) : `components/mockup/src/mockup-compare.test.tsx` « a mockup that fails to load is not offered… » (15 sur 15 en local) et `e2e/agents.spec.ts:174` (« pair this browser first »).

## État local

- Démon d’Adam : lancé sur `v0.19.0-alpha.1` depuis le worktree détaché `.claude/worktrees/run-v0.19` (journal `~/.kibo-daemon-v019.log`). Sauvegarde : `~/.kibo-avant-phase19-2026-10-09`.
- Penpot : backend `kibo-penpot-penpot-backend-1` (heap 4 Go, à redémarrer s'il dépasse 4,2 Gio), Chromium headless `hl/serve.mjs` (CDP 9333) dans le dossier temporaire de la session.
- Worktrees supprimables après la fusion : `p19-spec`, `p19-t1` à `p19-t9`, `p19-projet`, `p19-questions`, `p19-minimap`, `p19-passation`.

## Pour Adam

- Relire et valider le reste de la spec de la phase 20 (`docs/p20-spec`, §26.1 à §26.7 et §27 ; le graphe et « démarrable » sont validés) et les maquettes (`screens/2026-10-09-pistes-agents/`).
- Alertes Dependabot (1 élevée, 1 modérée) sur la branche par défaut.
- Fichiers temporaires à supprimer : artefacts Playwright, `/tmp/kibo-*`.

## Reprise

1. Si la PR #20 n'est pas fusionnée : `gh pr checks 20`, corriger la CI jusqu'au vert, `gh pr merge 20 --merge`, tag `v0.19.0-alpha.1`, vérifier la release.
2. Retirer les composants « Jeu itch.io » et « Serpent » (section dédiée).
3. Redessiner les maquettes du graphe (section ci-dessus) par un `kibo-dev`, avec Penpot.
4. Attendre la validation d'Adam sur `docs/p20-spec`, puis faire écrire le plan de la phase 20 par `kibo-lead` (`docs/superpowers/plans/<date>-kibo-phase-20.md`), en suivant §26 et les maquettes 183 à 188d.
