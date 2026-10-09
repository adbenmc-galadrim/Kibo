# Jeu de données des maquettes

Source unique pour tous les écrans : un ticket a le même statut, le même assigné et les mêmes liens partout.
Utilisateur : Adam. Workspace « Perso », projets Kibo (KIB), Portfolio (POR), API Facturation (FAC).

## Tickets Kibo (24 au total, ceux-ci sont montrés)

| Clé | Titre | Parent | Statut | Domaine | Assigné |
|---|---|---|---|---|---|
| KIB-3 | Noyau de données | — | En cours | Core | — |
| KIB-12 | Schéma Loro des tickets (LoroTree) | KIB-3 | En cours | Core | opus-dev-1 |
| KIB-24 | Types Zod Ticket / Link / Status | KIB-12 | Terminé | Core | opus-dev-1 |
| KIB-25 | Opérations move / reparent | KIB-12 | Terminé | Core | opus-dev-1 |
| KIB-26 | Index SQLite dérivé | KIB-12 | Terminé | Core | opus-dev-1 |
| KIB-27 | Tests de convergence (fast-check) | KIB-12 | En cours | Core | opus-dev-1 |
| KIB-28 | Générateur d'opérations concurrentes | KIB-27 | En cours | Core | haiku-tests (sous-agent) |
| KIB-29 | Migration v0 → v1 | KIB-12 | À faire | Core | opus-dev (en file #3) |
| KIB-13 | Snapshots Loro ↔ SQLite | KIB-3 | Terminé | Core | Adam |
| KIB-5 | Monorepo Bun workspaces | — | Terminé | DevOps | Adam |
| KIB-4 | Orchestration des agents | — | En cours | Agents | — |
| KIB-14 | Récepteur de hooks Claude Code | KIB-4 | En cours | Agents | opus-dev-2 (attend) |
| KIB-16 | Moteur de règles déclaratif | KIB-4 | En cours | Agents | opus-dev-3 |
| KIB-10 | Watcher git et gh | — | En cours | Agents | opus-dev (en file #1) |
| KIB-6 | UI de base | — | En cours | UI | — |
| KIB-7 | Tokens shadcn + thème sombre | KIB-6 | En review · PR #12 | UI | Adam (review : sonnet-review) |
| KIB-15 | Kanban : drag & drop entre colonnes | KIB-6 | À faire · attend KIB-12 | UI | Adam |
| KIB-9 | Setup Tauri + sidecar Bun | — | À faire | DevOps | Adam |
| KIB-11 | Démon : auth par jeton local | — | En review · PR #15 | Sécurité | Adam |
| KIB-18 | Adaptateur GitHub Issues | — | À faire | Intégrations | opus-dev (en file #2) |
| KIB-21 | Sandbox iframe des composants | — | Bloqué · « Audit sécurité externe en attente » | Sécurité | Adam |
| KIB-22 | Export Markdown / Obsidian | — | Backlog | Intégrations | Adam |

Compteurs de sous-tickets (enfants directs terminés / total) : KIB-3 1/2, KIB-12 3/5, KIB-27 0/1, KIB-4 0/2, KIB-6 0/2, KIB-9 2/3, KIB-21 0/4.

## Liens `blocks`

KIB-5 → KIB-12 · KIB-13 → KIB-12 · KIB-12 → KIB-15 · KIB-11 → KIB-21 · KIB-21 → KIB-22 · KIB-16 → KIB-22.
Lien `relates` : KIB-12 — KIB-16.
Chemin critique (tickets non terminés) : KIB-11 → KIB-21 → KIB-22.

## Kanban « Kibo » (filtre : moi + agents · 13 / 24)

Backlog KIB-22 · À faire KIB-9, KIB-15, KIB-18 · En cours KIB-12, KIB-14, KIB-16, KIB-10 ·
En review KIB-7, KIB-11 · Bloqué KIB-21 · Terminé KIB-5, KIB-13.

## Agents et file (hôte : 3 créneaux ; opus-dev : 2 par profil)

| Run | Ticket | État |
|---|---|---|
| opus-dev-1 | KIB-12 | En cours, créneau 1 · 12 min (sous-agent haiku-tests sur KIB-28, même créneau) |
| opus-dev-3 | KIB-16 | En cours, créneau 2 · 4 min |
| sonnet-review | KIB-7 | En cours, créneau 3 · review de la PR #12 · 1 min |
| opus-dev-2 | KIB-14 | Attend une réponse (« Quel port pour le récepteur ? ») · créneau libéré |
| opus-dev | KIB-10 | En file #1 · prioritaire (réponse reçue, reprise `--resume`) |
| opus-dev | KIB-18 | En file #2 · attend un créneau opus-dev (2/2) |
| opus-dev | KIB-29 | En file #3 · attend un créneau hôte (3/3) |
| sonnet-review | KIB-11 | Terminé il y a 41 min · review de la PR #15 postée |

PR : #12 (KIB-7) et #15 (KIB-11) ouvertes par Adam. KIB-12 n'a pas de PR (branche `kib-12`, 4 fichiers modifiés).

## Mes tickets (Adam, ouverts : 9)

KIB-21 Bloqué · KIB-15 À faire · KIB-9 À faire · KIB-7 En review · KIB-11 En review · KIB-22 Backlog ·
FAC-31 En cours · FAC-34 À faire · POR-9 À faire.

## Domaines

Core (3 guidelines : core.md, loro-patterns.md, tests.md) · Agents · UI · Sécurité · DevOps · Intégrations · Facturation.

## Étiquettes (phase 17)

KIB-12 `area:core`, `phase:p1` · KIB-14 `area:agents`, `urgent` · KIB-16 `area:agents`, `phase:p2` · KIB-15 `area:ui`, `phase:p1` ·
KIB-11 `area:securite`, `phase:p1`, `urgent` · KIB-7 `area:ui`. Branche de KIB-12 : `feat/schema-loro` (base `feat/noyau-donnees`), PR #18.

## Questions (phase 17)

Les deux décisions d'EMIS-11, transposées : posées par opus-dev-2 sur KIB-14 par `ask_question`, options Oui / Non, provisoire « Non » pour les deux.

| Ticket | Question | Par | Options · provisoire | État |
|---|---|---|---|---|
| KIB-14 | Un composant non autorisé lit-il les fichiers du projet ? | opus-dev-2 | Oui / Non · Non (accès refusé pour l'instant) | Ouverte |
| KIB-14 | Bloquer l'écriture sur un projet archivé ? | opus-dev-2 | Oui / Non · Non (écriture autorisée pour l'instant) | Répondue « Oui » par Adam, à transmettre |
| KIB-14 | Quel port pour le récepteur ? (bloquante, `ask_user`) | opus-dev-2 | 7420 / Port libre choisi au lancement | Ouverte |
| KIB-11 | Exiger une review humaine avant fusion ? | sonnet-review | Oui / Non · Oui | Ouverte |
| KIB-11 | Renouveler le jeton local à chaque démarrage ? | sonnet-review | Oui / Non · Non | Répondue « Non », transmise à sonnet-review |

Pastilles : KIB-14 « 2 questions », KIB-11 « 1 question ». Session principale de KIB-14 : opus-dev-2 · 3 tours ; de KIB-11 : sonnet-review · 2 tours, 12 k tokens.

## Agent de projet (phase 18)

Panneau « Agent de projet · Kibo » ouvert sur le Kanban. Session actuelle : nouvelle (repartie de zéro). Anciens agents : « Session du 6 octobre à 18:42 »
et « Session du 29 septembre à 10:05 ». Note mémoire : `agent-de-projet/memoire.md`. Profil « Agent de projet » : Claude Opus 5.5, 1 tour à la fois par
projet, guidelines `guidelines/lots.md` (« Huit actions au plus par lot ; une raison courte pour chacune. ») et `guidelines/priorites.md`
(« Les tickets urgents et les questions bloquantes d'abord. »).

Conversation : Adam « Que proposes-tu pour la semaine ? » · lectures « lit le projet, lit 12 tickets, lit les questions » · réponse :
KIB-11 en review depuis 2 jours (PR #15 relue par sonnet-review, il manque la review d'Adam) ; KIB-14, opus-dev-2 attend la réponse sur le port, une
réponse est prête à transmettre ; KIB-21 bloqué par l'audit externe, bloque KIB-22 ; KIB-9, 2 sous-tickets sur 3 terminés.

Lot n° 1 « Avancer KIB-9, débloquer KIB-14 et garder la mémoire à jour » (5 actions, 4 cochées, « Valider (4) ») ; après décision : Appliqué en partie.

| Groupe | Action | Avant → après · pourquoi | Cochée | Résultat |
|---|---|---|---|---|
| Tickets | Créer le ticket « Tests du récepteur de hooks » | KIB-14 n'a pas encore de test d'intégration | oui | Appliquée, KIB-30 |
| Tickets | KIB-9 : passer en En cours | À faire → En cours · 2 sous-tickets sur 3 terminés | oui | Périmée, statut modifié depuis la proposition |
| Agents | Transmettre les réponses de KIB-14 | Une réponse attend depuis 5 min | oui | Appliquée |
| Questions | Question sur KIB-21 : « Lancer l'audit sans attendre KIB-11 ? » | Bloqué depuis 6 jours | non | Ignorée |
| Notes | Mettre à jour la note agent-de-projet/memoire.md | contenu remplacé · Mémoire de la semaine | oui | Appliquée |

Ancien agent du 6 octobre (lecture seule) : « Qu'est-ce qui bloque KIB-21 ? » ; lot n° 1 « Relancer l'audit et préparer KIB-22 » refusé
(KIB-22 : Backlog → À faire ; question sur KIB-21 « Faut-il un second auditeur ? »).
