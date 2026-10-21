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

Les deux décisions du ticket SILO-11, transposées : posées par opus-dev-2 sur KIB-14 par `ask_question`, options Oui / Non, provisoire « Non » pour les deux.

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

## Jeux et Storybook (phase 19)

Tableau de bord du projet Kibo. Widget « Jeu itch.io » : jeu « Una war » de sigmatronic (`https://sigmatronic.itch.io/una-war`), code d'intégration
collé depuis Partager › Intégrer (`https://itch.io/embed-upload/<id>`), « Fourni par itch.io ». Hors ligne : « Ce jeu a besoin d'Internet. » ;
jeu non intégrable : « itch.io n'autorise pas l'intégration de ce jeu hors de son site. Ouvre-le sur itch.io. ».

Storybook du projet : `http://localhost:6006`, variable `STORYBOOK_PORT` ; worktree `feat/login` avec `STORYBOOK_PORT=6007` (injoignable dans 180b et 180c).
Stories : `Screens / Home` (montrée), `Screens / Login`. Maquette de référence : cadre Figma « Accueil » ; comparaison en superposition à 50 % d'opacité, curseur à 40 %.

## Visibilité des agents (phase 20)

Barre repliée : 3/3 places · 3 en file · 1 attend une réponse ; puces opus-dev-1 KIB-12 · 12m, opus-dev-3 KIB-16 · 2/5 · Corriger la validation,
sonnet-review KIB-7 · 1m, puis opus-dev-2 KIB-14 · attend et « Répondre ». Volet : Actifs · 4 (les mêmes, opus-dev-2 sélectionné, 0s), En file · 3
(opus-dev KIB-10 Watcher git et gh, KIB-18 Adaptateur GitHub Issues, KIB-29 Migration v0 → v1).

Run 3 de KIB-14 (opus-dev-2, worktree `kib-14`, aujourd'hui 10:37, attend une réponse). Plan 2/5 tenu par l'agent (`ticket_progress`) :

| Étape | Texte | État |
|---|---|---|
| 1 | Relire le récepteur et ses tests | Faite · 2 moments |
| 2 | Corriger la validation du corps | En cours · 4 moments |
| 3 | Choisir le port du récepteur | À faire |
| 4 | Brancher le récepteur sur le démon | Bloquée · attend KIB-12 |
| 5 | Documenter le format des hooks | À faire |

Fil : « Kibo a rappelé de déclarer le plan » ; 10:37 Étape 1 « Je relis le récepteur et ses tests avant de toucher au port. » (A lu 2 fichiers) ;
10:39 Étape 2 « La validation laisse passer un corps vide. Je la corrige dans receiver.ts. » (A modifié 1 fichier et lancé les tests, 12 réussis,
1 échec : Modifié `packages/daemon/src/hooks/receiver.ts` +8 −3, Tests `bun test packages/daemon/src/hooks` 12 ✓ 1 ✗) ; 10:40 raisonnement « Le corps
vide passe parce que le test ne couvre que null. » ; 10:42 Étape 2 « Un test échoue encore : quel port veux-tu pour le récepteur ? » et la question
« Quel port pour le récepteur : 7420 fixe ou un port libre choisi au lancement ? ».

Compte rendu du run 2 (hier 17:52 → 18:40, « Fait, 2 points à vérifier, 1 fichier non mentionné ») : fait « Le récepteur accepte les hooks signés et
rejette les corps vides. » ; décision « Port 7420 gardé pour l'instant : la question à Adam est encore ouverte. » ; à vérifier « Le délai de 5 s
convient-il aux gros dépôts ? », « Le message d'erreur est-il assez clair ? » ; fichiers `packages/daemon/src/hooks/receiver.ts`,
`packages/daemon/src/hooks/README.md`, 1 fichier modifié non mentionné, 1 fichier cité sans modification ; suite « Brancher le récepteur sur le démon. ».
Run 1 (opus-dev-1, 7 oct. 10:04 → 10:31) : annulé, pas de compte rendu.

Destinataires des questions du projet Kibo : Moi (technique) par défaut (4 ouvertes), Produit (3), Client (2), Design (aucune). Questions montrées :
« Quel port pour le récepteur ? » (KIB-14, Moi, bloquante) ; « Un composant non autorisé lit-il les fichiers du projet ? » (KIB-14, Produit proposé par
l'agent, provisoire Non) ; « Faut-il garder l'historique des tickets supprimés ? » (KIB-12, Client, envoyée il y a 2 j) ; « Le client modifie-t-il
lui-même les règles d'automatisation ? » (KIB-16, Client) avec la réponse collée « Oui pour les règles simples (statut, assignation). Les règles qui
touchent la facturation restent chez Adam. — Claire, côté client ». Filtre Client : « Exporter tout (2) ».

Graphe (188 à 188d) : projet de la taille de Silo repris de `32e-graphe-lisible.js` (69 tickets, 38 ouverts sur 5 vagues, 31 terminés repliés,
6 démarrables, chapitres C0 à C9, 36 liens tracés et 24 implicites masqués, focus sur KIB-65). Kanban 188k : « Démarrable » sur KIB-22 et KIB-9 ;
KIB-18 (en file #2) et KIB-15 (attend KIB-12) ne le sont pas.

## Signaux des agents (phase 21)

Quatre signaux du projet Kibo (P5), du plus récent au plus ancien : `sig:4` Blocage de opus-dev-3 sur KIB-16, 14:28, « Attend le schéma Loro de
KIB-12 pour brancher les transitions » ; `sig:3` Ticket à créer de opus-dev-2 sur KIB-14, 14:26, « Tests du récepteur de hooks » ; `sig:2` Question
de sonnet-review sur KIB-7, 14:12, « Garder deux tons de zinc pour les bordures ? » ; `sig:1` Contexte de opus-dev-1 sur KIB-12, 13:52, « Le
reparentage garde l'ordre des enfants : rien à changer côté Kanban ». Notification système à 14:28 : « Blocage signalé par opus-dev-3 · KIB-16 ».

Réveil automatique à 14:31 (« Réveil automatique · 2 signaux »), prochain réveil à 14:41 ; l'agent de projet lit `list_signals`, KIB-14, KIB-16 et
KIB-12, puis propose le lot n° 2 « Traiter les signaux de opus-dev-2 et opus-dev-3 », 3 actions, après réveil : Tickets « Créer le ticket « Tests du
récepteur de hooks » » (parent KIB-14 ; signal Ticket à créer de opus-dev-2) et « KIB-16 : passer en Bloqué » (En cours → Bloqué, motif « attend
KIB-12 » ; signal Blocage de opus-dev-3) ; Liens « Lier KIB-12 → KIB-16 (bloque) » (signal Blocage de opus-dev-3). Avant validation : 4 signaux en
boîte, pastille « 4 ». Après « Valider (3) » : trois actions « Appliquée », ticket **KIB-31** créé ; `sig:3` « traité dans le lot n° 2 · KIB-31 »,
`sig:4` « traité dans le lot n° 2 » ; en boîte, Question et Contexte ; pastille « 2 ».

Run 4 de KIB-14 (opus-dev-2, worktree `kib-14`, aujourd'hui 14:21, en cours, session reprise du run 3, 4 tours ; nom de run au format de la phase 21).
Plan 3/5 : Relire le récepteur et ses tests (faite), Corriger la validation du corps (faite), Choisir le port du récepteur (faite, réponse d'Adam :
7420), Brancher le récepteur sur le démon (bloquée, attend KIB-12), Documenter le format des hooks (en cours). Fil : 14:22 Étape 3 « Adam a choisi le
port 7420. Je le fixe dans la config et je relance les tests. » (14 réussis) ; 14:25 Étape 5 « Le récepteur n'a aucun test d'intégration. Je le
signale à l'agent de projet plutôt que de créer un ticket moi-même. », ligne « Signal à l'agent de projet · Ticket à créer · « Tests du récepteur
de hooks » · 14:26 », action « Signalé « Tests du récepteur de hooks » à l'agent de projet » (`sig:3`) ; 14:27 Étape 5 « Je documente le format des
hooks dans le README du récepteur. ». Run 3 (opus-dev-2, 11 oct. 10:37 → 11:20) : fait, 2 points à vérifier.

## Agents et skills (phase 22)

Noms parlants (§28.12) ; un run porte le nom `portée ou projet · agent · ticket`, deux runs du même agent sur le même ticket se distinguent
par leur heure de début.

| Agent | Portée | Fichier | Description | Modèle | Skills · sous-agents | État |
|---|---|---|---|---|---|---|
| `livraison` | Global | `~/.claude/agents/livraison.md` | Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR. | Opus | Liste de 3 · aucun | run `global · livraison · KIB-14` en cours |
| `review-pr` | Global | `~/.claude/agents/review-pr.md` | Relit une PR en lecture seule et rend un verdict accepté ou refusé, avec des remarques actionnables. | Sonnet | 2 · aucun | masqué dans Kibo par l'agent de projet du même nom |
| `seo-contenu` | Global | `~/.claude/agents/seo-contenu.md` | Audite les pages publiques et propose des corrections SEO classées par impact. | Sonnet | 1 · aucun | |
| `chef-orchestre` | Global | `~/.claude/agents/chef-orchestre.md` | Enchaîne livraison, review-pr puis seo-contenu comme sous-agents et rend un compte rendu. | Opus | Liste de 3 · `livraison`, `review-pr`, `seo-contenu` + génériques | gabarit « Chef d'orchestre » |
| `kibo-dev` | Projet Kibo | `~/code/kibo/.claude/agents/kibo-dev.md` | Implémente une tâche d'un plan de phase Kibo en TDD, dans le worktree et la branche fournis. | Opus | Tous · génériques | écrit à la main, réglages par défaut |
| `review-pr` | Projet Kibo | `~/code/kibo/.claude/agents/review-pr.md` | Relit une PR de Kibo selon CLAUDE.md : Biome, TDD, commits en français, aucun commentaire. | Sonnet | 2 · aucun | run `kibo · review-pr · KIB-12` en cours |
| `sonnet-dev` | Global | `~/.claude/agents/sonnet-dev.md` | Agent migré du profil Kibo sonnet-dev. | Sonnet | Tous · génériques | « Nom peu parlant : renommer » |
| `ux-audit` | Global | `~/.claude/agents/ux-audit.md` | — | — | — | fichier illisible : ligne 3, « description » sans valeur |

Agents de Kibo (repliés) : `kibo-assistant`, `kibo-generateur`, `kibo-demo`, `kibo-project-agent` dans `~/.claude/agents/`.
Réglages de `livraison` : worktree par ticket, demande à chaque action, `Bash(bun test *)` et `Bash(git commit *)`, 2 runs en parallèle, activé ;
autres champs du frontmatter `color: orange`, `maxTurns: 80`, `effort: high`. Skills autorisés de `chef-orchestre` : `porte-qualite`,
`apply-review`, `superpowers:test-driven-development` ; préchargé par le fichier : `porte-qualite`. « Ce que reçoit l'agent » sur KIB-16 :
2 670 tokens (workspace 420, projet 1 380, domaine Agents 260, agent 610), puis `CLAUDE.md` complet, `brief.md` et `agents.json` repliés.
Conflit d'écriture : `~/.claude/agents/livraison.md` modifié dans le terminal à 14:02 (ligne « Lance bun run check avant de commiter. »).
Historique des runs : `global · livraison · KIB-14` 18m 312k en cours ; `kibo · review-pr · KIB-12` 6m 88k en cours ;
`global · chef-orchestre · KIB-16` 41m 1,1M « Fait, 1 point à vérifier » ; `global · sonnet-dev · FAC-4` 12m 240k échec.

Skills (4 notes à traiter) :

| Source | Skill | Description | Notes | Usage |
|---|---|---|---|---|
| Cet ordinateur | `porte-qualite` | Porte qualité d'une branche avant son push, à deux volets : correctness et conventions. | 2 | il y a 2 h · 9 runs/30 j |
| Cet ordinateur | `apply-review` | Récupère les reviews d'une PR, traite chaque point, corrige, vérifie, commite et pousse. | 1 | il y a 1 j · 4 runs/30 j |
| Cet ordinateur | `clean-pr` | Démonte l'environnement local d'une PR fusionnée : worktree, branche, conteneurs. | | il y a 5 j · 2 runs/30 j |
| Cet ordinateur | `captures-ui` | Capture chaque écran modifié en sombre et en clair dans screens/. | | jamais utilisé |
| Projet Kibo | `penpot-maquettes` | Dessine un écran Kibo dans Penpot avec les scripts de design/penpot. | | il y a 3 j · 3 runs/30 j |
| Projet Kibo | `clean-pr` | masqué par le skill personnel du même nom | | jamais utilisé |
| Projet API Facturation | `factures-pdf` | Génère une facture PDF de test à partir d'un devis du dossier fixtures/. | | il y a 9 j · 1 run/30 j |
| Plugin superpowers 5.0.7 | `superpowers:brainstorming`, `superpowers:test-driven-development`, `superpowers:writing-plans` | lecture seule | 1 (brainstorming) | |
| Plugin frontend-design 1.2.0 | `frontend-design:frontend-design` | lecture seule | | jamais utilisé |

`porte-qualite` : `~/.claude/skills/porte-qualite/SKILL.md` (1,9 Ko), annexes `volets/correctness.md`, `volets/conventions.md`,
`scripts/diff-stat.sh`, `exemple-verdict.png` (48 Ko, non texte) ; `allowed-tools: Read, Grep, Bash(git diff *)`, `context: fork`.
Page Skills (0.22.0-alpha.2, §28.8) : groupes repliables (en-tête : nombre de skills et « n notes »), plugins repliés par défaut, « Tout déplier » ;
filtres « Tous · 11 », « Utilisés · 8 », « Avec notes · 3 ».
Copie du plugin : `brainstorming-kibo` sur Cet ordinateur, autorisée aussi pour `livraison` et `chef-orchestre`.

Notes de review :

| Skill | Verdict | Run | Quand | Note | Suite |
|---|---|---|---|---|---|
| `porte-qualite` | À améliorer | `global · livraison · KIB-14` | il y a 2 h | Le volet conventions a relu tout le fichier au lieu du diff. Il manque la règle « aucun commentaire » de CLAUDE.md. Je bornerais la relecture aux lignes modifiées. | suggestion jointe, intégrée en 195c (1 bloc sur 2) |
| `porte-qualite` | OK | `kibo · review-pr · KIB-12` | hier | Les deux volets ont trouvé le test manquant de receiver.ts. Rien à changer. | « Ouvrir ici » |
| `apply-review` | À améliorer | `global · livraison · KIB-16` | il y a 3 j | Le skill ne dit pas quoi faire d'un commentaire déjà résolu sur GitHub. J'ai perdu un tour à le retraiter. | suggestion jointe |
| `apply-review` | OK | `global · livraison · KIB-14` | aujourd'hui | Les étapes ont suffi pour les 3 remarques de la PR. Rien à changer. | ignorée |

Historique de `porte-qualite/SKILL.md` : 12 oct. 14:32 Intégration (actuelle, 4,1 Ko) ; 11 oct. 18:40 Externe ; 11 oct. 10:05 Kibo (comparée) ;
9 oct. 16:20 Restauration ; 6 oct. 09:12 Kibo. Fil du run `global · livraison · KIB-14` (14:05 → 14:23) : a utilisé
`superpowers:test-driven-development` puis `porte-qualite`, Kibo a refusé `clean-pr`, rappel de la review, review de 2 skills ; le run de la
veille (17:52 → 18:40) : « Pas de review des skills ».

## Doublons entre agents (phase 23)

Projet **Boutique** (clé `BOU`, dossier `~/code/boutique`, Storybook `http://localhost:6006`), à côté de Kibo, Portfolio et API Facturation.
Tickets : **BOU-12** « Format des dates de livraison », **BOU-15** « Page de suivi de commande », BOU-9 « Codes promo du panier ».
Agent `livraison` de portée Projet · Boutique (`~/code/boutique/.claude/agents/livraison.md`). Runs, 2/3 places :

| Run | Ticket | Espace | Démarré | Plan déclaré |
|---|---|---|---|---|
| `bou · livraison · BOU-12` (`owner`) | BOU-12 | worktree `bou-12` | 14:28 | 2/4 : Lire les formats de date existants (faite), Écrire formatDate et formatDeliveryWindow (faite), Brancher le format sur le récapitulatif (en cours), Tests des formats |
| `bou · livraison · BOU-15` (`other`) | BOU-15 | worktree `bou-15` | 14:40, fini 14:57 | 2/4 : Relire la page de suivi et l'API commandes (faite), Afficher la date de livraison estimée (faite), Reprendre formatDate de BOU-12 (en cours), Tests de la page de suivi |
| `bou · review-pr · BOU-9` | BOU-9 | | 11:02 | fait |

Travail de BOU-12 : `src/lib/format-date.ts` ajouté (+24 −0 ; exporte `formatDate` et `formatDeliveryWindow`), `src/lib/format.ts` modifié
(+3 −1, réexporte `formatDate`), `src/i18n/fr.ts` modifié (+6 −2). BOU-15 écrit son propre `formatDate` dans `src/utils/date.ts` à 14:46.

Chronologie : 14:48 recouvrement `export` ouvert, « `formatDate` exporté deux fois » (`src/lib/format.ts` chez BOU-12, `src/utils/date.ts`
chez BOU-15) ; 14:49 alerte livrée à BOU-15 (« à factoriser ») et information à BOU-12 (« ne le renomme pas et ne le déplace pas ») ;
14:49 BOU-15 « A regardé le travail de BOU-12 » (`peek_work`) ; 14:50 « Kibo a rappelé de factoriser » ; 14:52 BOU-15 supprime sa copie et
reprend `src/lib/format-date.ts` à l'identique (9 tests réussis), le recouvrement est **réglé 14:52** ; 14:52 lien automatique « Kibo a lié
BOU-12 → BOU-15 (BOU-12 bloque BOU-15) : `src/lib/format-date.ts` repris de BOU-12 » (raison `copy`), badge « par Kibo » sur la fiche ;
15:03 lien **annulé par Adam**. Compte rendu de BOU-15 : « La page de suivi affiche la date de livraison estimée », décision « Repris `formatDate`
de BOU-12 (`src/lib/format-date.ts`) », suite « Fusionner BOU-12 avant BOU-15 » ; « Recouvrements : 1 réglé · 0 ouvert ».
`src/i18n/fr.ts`, modifié des deux côtés : recouvrement `file` **ignoré** par Adam le 12 oct.

Réglages « Doublons entre agents » de Boutique : détection activée, lignes minimales d'un bloc **8**, tests exclus, fichiers ignorés
`src/generated/**`, exports génériques par défaut (`default`, `Props`, `meta`, `config`, `loader`, `action`, `handler`, `main`, `GET`, `POST`, `PUT`, `PATCH`,
`DELETE`, `HEAD`, `OPTIONS`, `generateMetadata`, `getServerSideProps`, `getStaticProps`, `getStaticPaths`, `Route`, `Page`, `Layout`, `Component`,
`schema`, `routes`, `index`, `up`, `down`, `migrate`, `seed`, `setup`, `teardown`), recouvrement ignoré `` `src/i18n/fr.ts` `` · fichier · 12 oct. · Adam · « Réactiver ».

Section « Travail en cours sur le projet » telle que la reçoit BOU-15 (premier tour, dans `brief.md` après « ## Commits de la branche » ;
« Ce que reçoit l'agent » la montre à part, « Travail en cours sur le projet (exemple) ») :

```
## Travail en cours sur le projet

### bou · livraison · BOU-12 · Format des dates de livraison

- démarré il y a 12 min · étape : Brancher le format sur le récapitulatif
- Plan :
  1. [done] Lire les formats de date existants
  2. [done] Écrire formatDate et formatDeliveryWindow
  3. [doing] Brancher le format sur le récapitulatif
  4. [todo] Tests des formats
- Fichiers créés ou modifiés :
  - `src/i18n/fr.ts` (+6 −2)
  - `src/lib/format-date.ts` (+24 −0)
  - `src/lib/format.ts` (+3 −1)
- Exports nouveaux :
  - `formatDate` (`src/lib/format-date.ts`)
  - `formatDeliveryWindow` (`src/lib/format-date.ts`)
- Espace : worktree `bou-12`

### bou · livraison · BOU-9 · Codes promo du panier

- démarré il y a 31 min · étape : Valider le code côté serveur
- aucun plan déclaré
- Fichiers créés ou modifiés :
  - `src/cart/cart.ts` (+12 −3)
  - `src/cart/promo.ts` (+41 −0)
- Exports nouveaux :
  - `applyPromoCode` (`src/cart/promo.ts`)
- Espace : worktree `bou-9`

Avant de créer un utilitaire, un type ou un composant, vérifie qu'il n'existe pas déjà dans le code ni dans ce qui précède ;
`mcp__kibo__peek_work` lit le travail d'un autre run.
```

Ajusté sur les captures `screens/2026-10-12-p23-t11` : en-tête du run « Agent livraison · Projet · BOU · <titre> · démarré à 14:40 », « Terminé »
une fois fini, « Arrêter » ; fil ouvert par « Session : nouvelle (première session du ticket) » et fermé par « Écrire à l'agent » (« L'agent travaille :
ton message lui sera remis au début de son prochain tour. », « Reprend la session » une fois fini) ; colonne de droite « Travail en parallèle » (carte
du run : titre · démarré il y a 22 min, étape, worktree, « 3 fichiers » repliés, « 2 exports nouveaux », recouvrement ouvert, « Voir son travail »),
puis le plan (« 3/4 » : rang de l'étape en cours) et « Compte rendu » (« Pas de compte rendu pour ce run » tant que le run tourne). Barre des agents :
puces « BOU-15 · 3/4 · Reprendre formatDate ⧉ 1 » et « BOU-12 · 3/4 · Brancher le format ⧉ 1 », « 1/3 place » au singulier. 197c « Fichiers du
recouvrement » : `src/lib/format.ts` de BOU-12 (ligne 1 en rouge) et `src/utils/date.ts` de BOU-15 (lignes 1 à 3 en vert), « Fermer ».
199 fiche BOU-15 onglet Détails, « Bloqué par » BOU-12 avec « par Kibo » et sa bulle « Reprise de `src/lib/format-date.ts` · 12 oct. 14:52 ·
Annuler » ; 199b onglet Activité (compte rendu « Run 1 · bou · livraison · BOU-15 », fichiers `src/lib/format-date.ts` et `src/pages/track.ts`,
« Recouvrements : 1 réglé · 0 ouvert », chronologie) ; 200 fiche BOU-12 et barre « 2/3 places · 1 recouvrement », bulle « 1 recouvrement ouvert » ;
200b page du run BOU-15 à 14:41 (BOU-12 à l'étape 2, « démarré il y a 13 min »).

Le second run (BOU-9) est un exemple propre à « Ce que reçoit l'agent » ; la barre des agents des écrans 197 à 201 n'en montre que deux.

## Questions : modification et archivage (phase 23)

Page 33, d'après la spec §30.6 à §30.8 et les captures `screens/2026-10-12-p23-t16`, `p23-t17` et `p23-qactions` : les actions « Modifier la réponse »,
« Retirer la réponse », « Rouvrir » et « Archiver » sont dans l'en-tête de la carte, à droite du titre (demande d'Adam).

| Ticket | Question | Pour | Par | État | Actions |
|---|---|---|---|---|---|
| KIB-14 | Bloquer l'écriture sur un projet archivé ? (Oui / Non · provisoire Non) | Produit | opus-dev-2 | Répondue « Oui » par Adam il y a 5 min, à transmettre | Modifier la réponse, Retirer la réponse, Archiver |
| KIB-11 | Renouveler le jeton local à chaque démarrage ? (Oui / Non · provisoire Non) | Moi (technique) | sonnet-review | Répondue « Non » par Adam hier, « transmise à sonnet-review · figée » | Rouvrir, Archiver |
| KIB-14 | Quel port pour le récepteur ? (7420 / Port libre choisi au lancement) | Client | opus-dev-2 | Archivée par Adam il y a 2 j | Restaurer |

Historique de la question archivée (3) : « il y a 2 j · Adam · Archivée » ; « … · Rouverte (réponse « Remplacée par la même question sans préfixe »
retirée) » ; « … · Modifiée (titre : « Client - Quel port… » → « Quel port pour le récepteur ? » ; destinataire : Moi (technique) → Client) ».
202b : formulaire de réponse rouvert, prérempli sur « Oui », « Annuler » et « Enregistrer ».

Lot n° 3 « Nettoyer les questions préfixées » (5 actions, « Valider (5) »), après « Range les questions préfixées par le client » :
« Ajouter le destinataire « Galadrim » » ; « Question sur KIB-14 pour Client : « Quel navigateur minimal ? » » ; « Modifier la question « Client - Quel
port pour le récepteur ? » » (Titre : « Client - Quel port pour le récepteur ? » → « Quel port pour le récepteur ? » ; Destinataire : Moi (technique)
→ Client) ; « Rouvrir « Renouveler le jeton local à chaque démarrage ? » (réponse retirée) » ; « Archiver « Client - Faut-il garder l'historique des
tickets supprimés ? » ».
Aperçu de la pastille « 2 questions » de KIB-14 : « Quel port pour le récepteur ? » (Moi (technique) · ouverte · il y a 3 min, bloquante) et « Un composant
non autorisé lit-il les fichiers du projet ? » (Produit · ouverte · il y a 8 min). Aperçu d'une question du lot : « KIB-14 · Récepteur de hooks Claude
Code », options, « Pour : Moi (technique) · ouverte », « posée par opus-dev-2 · il y a 3 j ». Question mise en évidence (206) : « Un composant non
autorisé lit-il les fichiers du projet ? », adresse `#/p/kibo/questions?question=7f3a9c2e-…`.

## Domaines & guidelines (phase 23)

Page 34, d'après la spec §31.8. Projets **Kibo**, **Portail**, **Facturation** et **Boutique** (Portail et Facturation sont, sur cette page, les noms
de Portfolio et API Facturation ; la barre latérale est renommée en conséquence). Couleurs : Kibo orange, Portail violet, Facturation vert,
Boutique sarcelle.

| Dossier | Fichiers | Domaines (fichiers) | « n .md » |
|---|---|---|---|
| Workspace | `guidelines/conventions.md`, `guidelines/git.md` | du workspace : Sécurité (`guidelines/securite.md`), utilisé par 6 tickets dans 2 projets (Kibo, Portail) | 2 |
| Kibo (projet courant, `~/code/galadrim/kibo-monorepo`) | `guidelines/kibo.md`, `guidelines/tests.md`, `guidelines/ui.md` | Sync (`guidelines/sync.md`, 8 tickets), UI (`ui.md`, 5), CI (`ci.md`, 4), Démon (`demon.md`, 1) | 7 |
| Portail (partagé, Adam lecteur, `~/code/equipe/portail-client`) | `guidelines/portail.md` | aucun | 1 |
| Facturation (`~/code/galadrim/api-facturation`) | aucun | aucun | 0 |
| Boutique | `guidelines/boutique.md` | Livraison (`livraison.md`) | 2 |

Couleurs de domaine : Sync bleu ciel, UI rose, CI ardoise, Démon indigo, Sécurité ocre, Livraison citron.
Injection : Workspace ⇒ « Workspace » ; projet ⇒ « Workspace → Projet Kibo » (≈ 610 tokens) ; domaine de projet ⇒ « Workspace → Projet Kibo →
Domaine Sync » (≈ 790) ; domaine du workspace ⇒ « Workspace → Domaine Sécurité » (≈ 260, s'applique à tout projet local) ; Facturation ≈ 180 ;
Portail ≈ 240 (« Workspace → Projet Portail »). Sous-titre d'un projet : dossier tronqué, puis « n fichiers · m domaines » ; un projet partagé en
lecture seule porte le badge « Lecture seule ». `guidelines/portail.md` : application Next.js du portail client, partagée par l'équipe Produit
(composants dans `src/components`, textes en français et dates JJ/MM/AAAA, revue d'accessibilité des pages publiques).
Encart « Comment les agents sont configurés » : Workspace → Projet du ticket → Domaine du ticket → Profil de l'agent (spec et skills), liens
« Ouvrir la page Agents → » et « Skills → », « Le panneau Injection, en bas, montre la chaîne du dossier choisi. ».
Fiche **KIB-14** « Récepteur de hooks Claude Code », domaine **Démon** ; sélecteur : « Aucun », « Domaines de Kibo » (Sync, UI, CI, Démon),
« Domaines du workspace » (Sécurité). « Modifier le projet » de Kibo (`~/code/kibo`) : « 7 fichiers .md · 4 domaines ».


## Projet Silo (phase 28)

Projet fictif de suivi : une application de location de box en libre-service (centres, box, constats avec photos, contrats,
import Excel, rapport journalier, dossier client). Il sert aux tests, aux semis E2E, au projet de démonstration, aux textes
d'aide, aux maquettes du redesign (pages 35 et 36, Proposition, Choix) et aux docs. Date des écrans : vendredi 16 octobre 2026,
14:52 (S42). Colonne « Δ » : écart de longueur, en caractères, admis pour la mise en page des maquettes (0 = même largeur que le
texte déjà dessiné, ±3 au plus pour un titre).

### Identité

| Champ | Valeur |
|---|---|
| Nom | Silo |
| Clé | `SILO` (tickets `SILO-45`) |
| Description, sous-titre | Location de box (Δ −2) |
| Client | Silo SA (« client Silo SA », « Questions pour Silo SA · 16 oct. 2026 ») |
| Dépôt | `https://github.com/silo-labs/silo-location` (remote `silo-labs/silo-location`, `git@github.com:silo-labs/silo-location.git`, PR `…/silo-location/pull/<n>`) |
| Branche de base | `dev` |
| Dossier | `/Users/adam/Documents/silo` (`~/Documents/silo`, `~/Documents/silo/delivery-profile.md`, `~/Documents/silo/TODO.md`, `~/Documents/silo/kibo-notes/briefs`) |
| Worktrees | `../silo-{slug}`, `~/Documents/silo/silo-{dashed}`, `/home/dev/projects/silo/silo-feat-compte` |
| Couleur | `#14B8A6` |
| Workspace | Galadrim |
| Scénario du faux `claude` | `e2e/agents/scenarios/silo-maquettes.json` (nom `silo-maquettes`) |
| Dernier ticket | 93 ; étape de livraison « Livré » = 11 |
| Pages | Vue d'ensemble, Planning, Tickets, Kanban, Graphe, Notes, Questions |
| Identifiants | `SILO_…` pour les constantes, `silo…` / `Silo…` en camelCase (`siloKey`, `seedSiloMaquettes`, `siloPageUrl`, `siloGhState`) |

Autres projets de la barre latérale, dans cet ordre : Silo `#14B8A6`, Kibo (KIB) `#6366F1`, **Atlas** (ATL, `atlas`) `#84CC16`,
**Nimbus** (NIM, `nimbus`) `#EC4899`.
Registre `full-delivery` des tests (trois projets, même forme partout) :

| Projet | Format du plan | Dépôt | Base | Dossier | Particularités |
|---|---|---|---|---|---|
| `atlas` | `plan-data-js` | `acme/atlas` | `staging` | `~/Documents/atlas` | tableau sur le port 4848 ; worktrees `~/Documents/atlas/atlas-{slug}`, copie depuis `~/Documents/atlas/atlas-staging`, puis `~/Documents/atlas/bin/atlas-sweep --reap --keep {slug} --yes` |
| `nimbus` | `plan-data-js` | `acme/nimbus` | `main` | `~/Documents/nimbus` | `env.ports` ; base `nimbus_{slug_}`, conteneur `nimbus-postgres`, worktrees `~/Documents/nimbus/nimbus-{slug}` |
| `silo` | `kibo` (projet `SILO`) | `silo-labs/silo-location` | `dev` | `~/Documents/silo` | tableau sur le port 4858 ; `env.ports` ; détail `~/Documents/silo/archive-2026-10-08/plan-data.js`, notes `~/Documents/silo/kibo-notes/{briefs,revues}`, worktrees `~/Documents/silo/silo-{dashed}` |

Boîte de réception : « Relire le compte rendu de la réunion client », « Idée : export CSV des contrats ».

### Personnes

| Rôle | Valeur |
|---|---|
| Utilisateur | Adam |
| Destinataires par défaut | Moi (tech), Produit, Silo SA (« Client » dans les listes) |
| Personnes nommées (exemples de destinataires) | Camille, Malik, Léa |

### Sprints

| Code | Nom | Δ | Dates | État au 16 oct. |
|---|---|---|---|---|
| S41 | Accès | 0 | 5-9 oct. (2026-10-05 → 2026-10-09) | terminé |
| S42 | Saisie hors ligne | −1 | 12-16 oct. | en cours, finit ce soir |
| S43 | Import et contrats | 0 | 19-23 oct. | à venir |
| S44 | Rapports | 0 | 26-30 oct. | à venir |

Projet neuf (dialogue « Nouveau projet ») : 6 sprints d'une semaine, S1 19-23 oct., S2 26-30 oct., S3 2-6 nov., S4 9-13 nov.,
S5 16-20 nov., S6 23-27 nov. 2026.

### Fonctionnalités et étapes

Ordre des racines : 1, 9, 17, 40, 30, 50, 61, 62, 70, 80, 90. Étape de livraison des étapes terminées : 11 (« Livré »).
Les PR sont décrites plus bas.

| Fonctionnalité | Ticket | Titre | Δ | Sprint | Étapes (n° · titre · statut · étape de livraison · PR) |
|---|---|---|---|---|---|
| F1 | 1 | Se connecter avec Microsoft | 0 | S41 | 2 Application Azure · 3 Route de connexion · 4 Écran de connexion · 5 Démo client : terminées |
| F2 | 9 | Voir ses box affectés | 0 | S41 | 10 Modèle des affectations · 11 Périmètre côté serveur · 12 Règles de synchro · 13 Liste des box · 14 Démo client : terminées |
| F3 | 17 | Réaffecter un box | 0 | S42 | 18 Historique des affectations · 19 Route de réaffectation · 20 Écran de réaffectation · 21 Démo client (PR #18) : terminées |
| F4 | 40 | Saisir un constat hors ligne | 0 | S42 | 41 Schéma local des constats (PR #12) · 42 Formulaire de saisie (#14) · 43 Synchro au retour du réseau (#16) : terminées ; 45 Conflits de saisie, en review, étape 9, PR #20, branche `feat/silo-45`, à moi ; 46 Démo client, à faire, à moi, facultative |
| F5 | 30 | Envoyer les photos d'un constat | 0 | S42 | 31 Stockage des photos sur MinIO (PR #19) : terminée ; 32 Route d'envoi des photos, en review, étape 10, PR #22, à moi ; 33 Écran d'envoi hors ligne, en cours, étape 7, branche `feat/envoi-hors-ligne`, à moi ; 34 Tests E2E de l'envoi, à faire, à moi ; 35 Démo client, à faire, à moi |
| F6 | 50 | Importer les box depuis Excel | 0 | S43 | 51 Lecture du fichier Excel (à faire, étape 3) · 52 Contrôle des numéros · 53 Écran d'import · 54 Démo client : à faire |
| F7 | 80 | Rapport de centre journalier | −2 | S44 | 81 Modèle du rapport · 82 Génération PDF · 83 Photos dans le rapport · 84 Envoi le soir · 85 Démo client : à faire |
| F8 | 70 | Valider les contrats par lot | 0 | S43 | 71 Statuts de contrat · 72 Sélection multiple · 73 Validation par lot · 74 Démo client : à faire |
| F9 | 90 | Exporter le dossier client | 0 | à planifier | 91 Format du dossier · 92 Archive ZIP · 93 Démo client : à faire |

Résultats attendus :
- F4 : « Sans réseau, un chef de centre saisit un constat ; la saisie remonte seule au retour du réseau. » (Δ −2)
- F5 : « Dans un centre sans réseau, un chef de centre photographie un constat. Les photos partent seules au retour du réseau et
  apparaissent dans le dossier du client. » (Δ −6, texte sur deux lignes)

Description du ticket 45 : « Deux saisies hors ligne du même constat : garder la plus récente et signaler l'autre au chef de
centre au retour du réseau. » (Δ −2).
Livraisons récentes, dans l'ordre : 42, 43, 31, 21, 32, 45, 33.

### Tickets libres

| Ticket | Titre | Statut | Sprint | PR |
|---|---|---|---|---|
| SILO-61 | Passage à Expo SDK 54 | en review | S42 | #23 |
| SILO-62 | Journal des erreurs avec Sentry | à faire | à planifier | aucune |

### Liens

Entre étapes : 33 → 34, 34 → 35.
Entre fonctionnalités : F2 → F3, F2 → F4, F3 → F5, F2 → F6, F4 → F8, F4 → F7, F5 → F7, F7 → F9.

### Questions

| Question | Ticket | Titre | Δ | Destinataire | Bloquante |
|---|---|---|---|---|---|
| Q14 | SILO-51 | Un box réaffecté garde-t-il ses photos ? | 0 | Client | oui (bloque F6, prévue en S43) |
| Q16 | SILO-34 | Quota par client : 2 Go ou 5 Go ? | −1 | Produit | non |
| Q17 | SILO-81 | Un rapport par chef de centre ou par client ? | −3 | Client | non |

### PR

| PR | Ticket | État | Review | CI |
|---|---|---|---|---|
| #12 | SILO-41 | fusionnée | approuvée | verte |
| #14 | SILO-42 | fusionnée | approuvée | verte |
| #16 | SILO-43 | fusionnée | approuvée | verte |
| #18 | SILO-21 | fusionnée (livre F3) | approuvée | verte |
| #19 | SILO-31 | fusionnée | approuvée | verte |
| #20 | SILO-45 | ouverte, en retard | changements demandés | rouge |
| #22 | SILO-32 | ouverte | aucune | verte |
| #23 | SILO-61 | ouverte | aucune | en cours |

### Suivi et agent de projet

Sessions T3 Code sur SILO-33 (« 7 · Porte qualité », depuis 42 min) et SILO-45. Demande à l'agent : « Fais le point du jour ».
Résumé du jour : « F3 est livrée : 3 fonctionnalités sur 9. » puis « S42 finit ce soir et F5 n'y tiendra pas : il lui reste
4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. »

Lot n° 7 (trois actions) :
1. SILO-30 (F5) vers S43 : « 4 étapes restantes, S42 finit aujourd'hui ».
2. SILO-90 (F9) vers S44 : « seule fonctionnalité à planifier ».
3. Relancer Q14 : « bloque F6, prévue en S43 ».

Clôture du jour : PR #18 fusionnée (livre F3), SILO-33 à l'étape 7, PR #22 ouverte sur SILO-32. Derniers faits du journal, du
plus ancien au plus récent : `pr_merged` SILO-21 (#18, F3), `batch_proposed` (lot n° 7), `step_set` SILO-33 (étape 7),
`pr_opened` SILO-32 (#22).

### Phase 29 · étapes en attente

Scénario `silo-attente` (spec §41) : le jeu des fonctionnalités ci-dessus, plus trois attentes propres posées après le semis
complet, toutes depuis le vendredi 16 octobre 2026 (`since` = `2026-10-16`). Maquettes : boards « … · en attente » et « P8c ·
Mettre en attente » de la page « Proposition » (`design/redesign/scripts/56-phase-29.js`), exports `proposition-attente-*`.

| Ticket | Titre | Fonctionnalité | Statut gardé | Raison (≤ 80 caractères) | Raison courte (24 + « … ») |
|---|---|---|---|---|---|
| SILO-45 | Conflits de saisie | F4 | en review (PR #20) | Règle de fusion à valider par le client | Règle de fusion à valide… |
| SILO-33 | Écran d'envoi hors ligne | F5 | en cours (session) | Serveur MinIO de recette indisponible | Serveur MinIO de recette… |
| SILO-82 | Génération PDF | F7 | à faire | Serveur MinIO de recette indisponible | Serveur MinIO de recette… |

Attentes par dépendance (dérivées des liens 33 → 34 → 35, jamais stockées) : SILO-34 et SILO-35 « attend SILO-33 ».
Ordre des groupes par raison : première `since`, puis raison (« Règle de fusion… » avant « Serveur MinIO… ») ; étapes par clé.

États attendus :
- F4 « livrée · 1 en attente » (41, 42, 43 terminées ; 46 facultative à faire) : 3/4 étapes, plus de « F4 ne tiendra pas » ; SILO-46
  n'attend plus SILO-45 (une étape en attente n'est pas la dernière étape active) et devient démarrable.
- F5 ouverte, **en cours** (et non à risque : « à risque » ne compte pas les étapes en attente, il reste une étape pour un jour
  ouvré) : « 1 étape livrée sur 2 · 3 en attente », sans « ne tiendra pas dans S42 » ni « F5 ne tiendra pas » ; prochaine à finir
  du sprint (SILO-32 en review), sans bloc « Étape suivante » (aucune étape à lancer : SILO-32 attend sa review).
- F7 : 0/4 étapes ; S42 « 2/3 livrées », « 10 étapes prévues · capacité 5 » ; S44 « 4 étapes prévues · capacité 5 ».
- Vue d'ensemble : « 4 livrées sur 9 », sous-ligne « 3 en attente » (à la place des cases et des « à risque », comme « 1 en retard »
  au 18 oct.) ; « En cours 1 / 2 · bloquée : F6 », sans note de limite ; Échéances sans F4 (livrée), F5 en deux cases ; carte « En
  attente » 3 sous Échéances : « Règle de fusion à valider par le client · SILO-45 », « Serveur MinIO de recette indisponible ·
  SILO-33, SILO-82 · 2 en dépendent » ; Sprint S42 : F5 « en cours » ; Activité (quatre lignes) : « Mise en attente · Serveur MinIO
  de recette i… » (SILO-82, F7), même texte (SILO-33, F5), « Mise en attente · Règle de fusion à valider p… » (SILO-45, F4),
  « PR #22 ouverte » (SILO-32, F5).
- Planning : « 4 fonctionnalités livrées sur 9 · 1 à planifier », « En cours : 1 / 2 », F5 « en cours » ; en pied de « À planifier », « En attente (3) »,
  une carte par étape sur deux lignes (« SILO-45 · F4 » et « ⋯ », puis le titre) : groupe « Règle de fusion à valider par le client »
  (« SILO-45 · F4 » / « Conflits de saisie »), groupe « Serveur MinIO de recette indisponible » (« SILO-33 · F5 » / « Écran d'envoi
  hors ligne », « SILO-82 · F7 » / « Génération PDF », puis « 2 en dépendent »). Menu de la carte SILO-45 : « Reprendre », et
  « Reprendre dans ▸ » (« S43 · Import et contrats », « S44 · Rapports ») quand le sprint de la fonctionnalité est terminé ou absent.
- Menu « ⋯ » de la fiche : « Ouvrir dans un onglet », « Copier la clé », « Mettre en attente… » (étape sans attente) ou « Reprendre »
  (étape en attente), séparateur, « Supprimer… ».
- Fiche F5 : frise 31, 32 puis « En attente · 3 » : SILO-33 « Serveur MinIO de recette indisponible · depuis le 16 oct. » et
  « Reprendre », SILO-34 et SILO-35 « attend SILO-33 » ; Activité « Mise en attente · Serveur MinIO de r… ».
- Kanban : SILO-45 garde sa colonne *En review* avec la puce « Règle de fusion à valide… », SILO-33 *En cours* avec « Serveur
  MinIO de recette… », SILO-34 et SILO-35 « attend SILO-33 » ; filtre « En attente » 5 (propres et par dépendance) après
  « À reprendre » ; « Démarrable 2 » (SILO-46 s'ajoute) ; puce « Adam » sur les étapes à moi (46, 34, 35, 33, 45, 32), « 1 question »
  sur SILO-34 (Q16) ; *À faire* : 46, 34, 35, 52, 53, 54 (« attend SILO-51, SILO-52, … »), 62, 71… ; *Terminé* dans l'ordre des
  clés : SILO-2 à SILO-5 (F1), SILO-10 à SILO-14 (F2), SILO-18, SILO-19 (F3)…
- Fiche SILO-45 : bandeau « En attente · Règle de fusion à valider par le client · depuis le 16 oct. » et « Reprendre », au-dessus
  du bandeau « PR #20 · changements demandés · CI cassée ».
- Dialogue « Mettre SILO-82 en attente » : raison « Serveur MinIO de recette indisponible » saisie, « 37/80 », « Raisons déjà
  employées » : « Règle de fusion à valider par le client », « Serveur MinIO de recette indisponible ».

### 0.29.0-alpha.2 · questions sans transmission

Jeu des questions ci-dessus (Q14, Q16, Q17), vendredi 16 octobre. Maquettes : boards « P9b · Questions, menu », « P9c · Supprimer
la question », « P9d · Questions, répondues » de la page « Proposition » (`design/redesign/scripts/57-alpha2-questions.js`),
exports `proposition-questions-{menu,supprimer,repondues}-*`.

| Question | Ticket | Titre | Réponse | Répondue par | Quand |
|---|---|---|---|---|---|
| Q16 | SILO-34 | Quota par client : 2 Go ou 5 Go ? | 5 Go | Adam | il y a 2 h |

États attendus :
- Menu « ⋯ » de Q16 (ouverte) : « Archiver », séparateur, « Supprimer » (destructif).
- Dialogue : « Supprimer « Quota par client : 2 Go ou 5 Go ? » ? », aide « Suppression définitive, pour tous les membres du projet :
  la question, sa réponse et son historique. Pour la masquer sans la perdre, archive-la. », « Annuler » et « Supprimer ».
- Filtre « Répondues » : groupe SILO-34 « Tests E2E de l'envoi » (F5) seul ; Q16 « Pour : Produit », posée par Adam hier, bloc
  « Réponse : 5 Go » et « Répondu par Adam · il y a 2 h », actions « Modifier la réponse », « Retirer la réponse » et « ⋯ » ; aucune
  mention « à transmettre », « transmise » ni « Transmettre à l'agent ». Comptes des destinataires sur les ouvertes : « Tous 2 »,
  « Silo SA 2 » (« Produit » masqué, sans ouverte) ; Questions 2 dans la barre latérale ; « Exporter pour le client (2) ».
- Une question supprimée garde son numéro : la suivante créée prend le numéro d'après, jamais celui libéré.

### 0.29.0-alpha.3 · réveil sur réponse

Jeu des questions ci-dessus, vendredi 16 octobre : Adam répond à Q16 à 14:52 et l'agent de projet se réveille. Maquette : board
« Agent · réveil sur réponse » de la page « Proposition » (`design/redesign/scripts/58-alpha3-reveil.js`, clone de « Agent · question »),
exports `proposition-agent-reveil-*` ; page « 36 · Suivi seul » du fichier « Kibo », écran 235.

| Question | Ticket | Réponse | Répondue par | Quand | Lot | Action | Pourquoi |
|---|---|---|---|---|---|---|---|
| Q16 | SILO-34 | 5 Go | Adam | 14:52 | n° 8, après réveil | Modifier SILO-34 | Quota de 5 Go par client à inscrire dans l'étape. |

États attendus (panneau Suivi) :
- Résumé du jour épinglé (14:40) inchangé, puis la ligne de réveil « Q16 répondue : « 5 Go » » (icône réveil, « 14:52 » à droite, texte
  secondaire), à la place de la bulle d'Adam ; jamais « Toi » ni « Adam · … ».
- Texte de l'agent : « Q16 répondue : le quota est de 5 Go par client. Je propose : », puis « Lu : Q16, SILO-34 ».
- Lot n° 8 « 1 action · après réveil » : « Modifier SILO-34 », « Quota de 5 Go par client à inscrire dans l'étape. », « Valider (1) » et
  « Refuser ».
- Message reçu par l'agent : « Réveil automatique : 1 réponse à lire. », « - Q16 répondue : « 5 Go » », puis la consigne de lecture (§43).

### Phase 30 · PR empilées

Scénario `silo-prs` (spec §44.4) : le jeu des fonctionnalités ci-dessus, vendredi 16 octobre, puis deux PR, une branche et un
statut posés après le semis complet (comme `silo-attente`) ; `silo-maquettes` n'est pas modifié. Maquettes : boards « P5c · Graphe,
PRs » et « P5e · Graphe, aucune PR » de la page « Proposition » (`design/redesign/scripts/59-graphe-prs.js`), exports
`proposition-graphe-prs-*` et `proposition-graphe-prs-vide-*`.

| PR | Ticket | État | Review | CI | Base | Head |
|---|---|---|---|---|---|---|
| #22 | SILO-32 | ouverte | aucune | verte | `dev` | `feat/silo-32` |
| #20 | SILO-45 | ouverte | changements demandés | rouge | `dev` | `feat/silo-45` |
| #23 | SILO-61 | ouverte | aucune | en cours | `dev` | `chore/expo-54` |
| #24 | SILO-33 | brouillon | aucune | en cours | `feat/silo-32` | `feat/envoi-hors-ligne` |
| #25 | SILO-34 | brouillon | aucune | verte | `feat/envoi-hors-ligne` | `feat/silo-34` |

Branches et statuts : SILO-34 passe **en cours** sur `feat/silo-34` (base `feat/envoi-hors-ligne`) ; SILO-33 déclare sa branche
`feat/envoi-hors-ligne` sur `feat/silo-32`. Les PR fusionnées (#12 à #19) n'apparaissent pas.

| Pile (de bas en haut) | En-tête | Fonctionnalité |
|---|---|---|
| #22 → #24 → #25 | « 3 PR empilées » · « F5 · Envoyer les photos d'un constat · #22 à #25 » | F5 |
| #20 | « 1 PR » · « F4 · Saisir un constat hors ligne · #20 » | F4 |
| #23 | « 1 PR » · « Hors fonctionnalité · #23 » | aucune (ticket libre) |

États attendus (vue « PRs » du Graphe) :
- Rail « dev · branche de base » ; compteur « 5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger ».
- Marques : « session » sur #24 et #20 (sessions T3 Code de SILO-33 et SILO-45) ; aucune « en retard » au 16 oct. (aucune
  fonctionnalité n'est en retard) ; bordure rouge sur #20 (changements demandés) ; « sur feat/silo-32 » entre #22 et #24,
  « sur feat/envoi-hors-ligne » entre #24 et #25.
- Légende : Brouillon, En attente de review, Changements demandés, Approuvée, CI verte, CI rouge, CI en cours, | Basée sur la PR
  du dessous, Session active, Clic : fiche du ticket.
- État vide (aucune PR vivante) : « Aucune PR ouverte », puis « Les PR ouvertes des étapes apparaissent ici, empilées sur leur
  branche de base. », compteur « 0 PR ouverte · 0 pile », ni rail ni légende.

### Phase 30 · Aperçu de maquette

Scénario `silo-apercu` (spec §44.8) = `silo-maquettes`, puis Figma connecté (jeton de test, secrets en mémoire) et un cadre lié à
SILO-45 ; ces données ne touchent pas `silo-maquettes` (la fiche de SILO-45 y garde « Maquettes · 0 »). Maquettes : boards
« P8f · Fiche ticket, Maquettes » et « P8g · Maquette en plein écran » de la page « Proposition »
(`design/redesign/scripts/59b-apercu-maquette.js`), exports `proposition-fiche-ticket-maquettes-*`, `proposition-apercu-maquette-*`
et `proposition-apercu-maquette-cadre.png` (le cadre seul, image servie par le faux Figma).

| Ticket | Cadre | Fournisseur | Fichier | Nœud | Taille | URL |
|---|---|---|---|---|---|---|
| SILO-45 « Conflits de saisie » | « Conflit de saisie » | Figma | `AbC123xyz` (« Silo ») | `45:1` | 444 × 960 | `https://www.figma.com/design/AbC123xyz/Silo?node-id=45-1` |

Contenu du cadre (écran mobile de l'app Silo, mêmes couleurs en sombre et en clair : fond blanc, bleu `#2563EB`, gris) :
- barre d'état « 14:02 » ; titre « Conflit de saisie » ; texte « Deux saisies du constat du box B-114 » ;
- carte « Version hors ligne · 14:02 » : état « Occupé », 3 photos, note « Cadenas changé » ;
- carte « Version du serveur · 13:47 » : état « Libre », 2 photos, note vide ;
- bouton plein « Garder la plus récente », bouton contour « Comparer ».

États attendus :
- Fiche de SILO-45 (P8f) : propriété « Maquette · Conflit de saisie » ; section « Maquettes » ouverte, « 1 » ; vignette du cadre,
  puis la ligne d'actions « Plein écran » (en tête) · « Conflit de saisie » · « Actualiser » · « Ouvrir dans Figma » · « Retirer » ;
  champ « Colle l'URL d'un cadre Figma ou d'un board Penpot » et bouton « Lier un cadre ».
- Plein écran (P8g) : barre « SILO-45 · Conflit de saisie · Figma · Actualiser · Ouvrir dans Figma · Quitter le plein écran
  (Échap) » ; un seul cadre, donc aucune navigation « 1 / 1 » ; cadre à l'échelle 1, centré ; zoom « 100 % ».

### Phase 31 · Graphe en attente et couleur de l'attente

Couleur de l'attente (spec §45.2) : jeton `--tracking-hold`, cyan `#0e7490` en clair et `#22d3ee` en sombre, fond
`--tracking-hold-soft` `#ecfeff` / `#082f35` ; icône ⏸ (`Pause`). Une étape en attente, propre ou par dépendance, est montrée à sa
place, en cyan, partout où une fonctionnalité affiche ses étapes (§45.3) ; les comptes ne changent pas.

Scénario `silo-graphe` (spec §45.4) = `silo-attente`, puis F1 renommée « Connexion, environnements et hébergement » (36 caractères,
trois lignes à 126 px) ; les étapes SILO-2 à SILO-5 gardent leurs titres ; `silo-maquettes` et `silo-attente` ne sont pas modifiés.
Maquette : board « P5b · Graphe · en attente » de la page « Proposition » (`design/redesign/scripts/59c-graphe-attente.js`, clone de
« P5b · Graphe, Fonctionnalités »), exports `proposition-attente-graphe-*`.

États attendus (Graphe, vue « Fonctionnalités », 16 oct.) :
- S41 : F1 repliée (livrée), titre « Connexion, environnements et hébergement » sur **trois lignes**, cadre 126 × 96 (81 + 15) ; F2
  à y = 70 + 96 + 30 = 196.
- S42 : F3 repliée ; **F4 « 3/4 ⏸ 1 ✓ »**, livrée avec une attente : seule la ligne SILO-45 « Conflits de saisie » reste visible
  (point cyan, ⏸ cyan, infobulle « En attente : Règle de fusion à valider par le client », icône PR ambre), segments terminé ×3,
  **cyan**, à faire ; **F5 « 1/2 ⏸ 3 »** : 31 (terminé), 32 (en review, PR violette), 33 (cyan, ⏸ « En attente : Serveur MinIO de
  recette indisponible », bordure orange de session, icône branche), 34 et 35 (cyan, ⏸ « En attente de SILO-33 ») ; segments
  terminé, review, cyan ×3.
- S44 : **F7 « 0/4 ⏸ 1 »**, ligne SILO-82 cyan, segments à faire, **cyan**, à faire ×3.
- Légende : « À faire · En cours · En review · Bloqué · **En attente** · Fonctionnalité · Colonne = sprint · Session active » ;
  compteur inchangé (masqué au pixel).

États attendus (scénario `silo-attente`, boards 226 à 229 refaits) :
- Vue d'ensemble : sous-ligne « ⏸ 3 en attente » en cyan sous Fonctionnalités ; carte Sprint : F4 cases ■■■◆□ et « ⏸ 1 », F5 cases
  ■■◆◆◆ et « ⏸ 3 » (◆ = case cyan) ; Prochaine à finir : F5 cases ■■◆◆◆ ; carte « En attente » : ⏸ cyan devant chaque ligne (⏸
  du titre en gris) ; Activité inchangée (⏸ gris).
- Planning : F4 cases ■■■◆□, F5 ■■◆◆◆, F7 □◆□□□ ; textes inchangés (« livrée · 1 en attente », « 1/2 étapes », « 0/4 étapes ») ;
  « En attente (3) » avec ⏸ cyan.
- Fiche F5 : barre ■■◆◆◆ « 1 étape livrée sur 2 · 3 en attente » ; section « En attente · 3 » : ⏸ cyan en titre, pastilles
  `hold-soft` avec ⏸ cyan, ⏸ cyan devant « Serveur MinIO de recette indisponible · depuis le 16 oct. » (le lien de « attend
  SILO-33 » reste gris).
- Kanban : puces pleines cyan, sans bordure, « ⏸ Règle de fusion à valide… », « ⏸ Serveur MinIO de recette… », « ⏸ attend
  SILO-33 » ; filtre « En attente 5 » avec ⏸ cyan.
- Restent gris : bandeau « En attente · … » de la fiche SILO-45 (230), événements « Mise en attente » de l'Activité, menus et
  dialogue (231 à 231d).

### Phase 31 · Agent de projet en conversation

Spec §46 : le volet de l'agent de projet ne montre plus que la conversation de l'agent choisi. Maquettes : boards « P1 bis · Agent
agrandi », « Agent de projet, volet » et « Agent de projet, agrandi, liste rétractée » de la page « Proposition »
(`design/redesign/scripts/59d-agent-conversation.js`), et le volet redessiné de P1 bis v3, « En retard », P6 et « en attente ».

Conversation de l'agent en cours, vendredi 16 octobre (volet au repos, l'état « L'agent lit le projet… » n'est pas montré) :
- Bulle d'Adam, à droite : « Fais le point du jour », heure « 14:38 ».
- Réponse de l'agent : « F3 est livrée : 3 fonctionnalités sur 9. » puis « S42 finit ce soir et F5 n'y tiendra pas : il lui reste
  4 étapes sur 5. F4 n'attend plus que la correction de la PR #20 et sa démo. »
- Ligne de lecture : « Lu : Planning, F5, journal des étapes ».
- Lot n° 7, « 3 actions » (les trois actions de « Suivi et agent de projet »), « Valider (3) » et « Refuser ».
- Saisie : « Écris à l'agent de projet… ».

En-tête : « Agent de projet · Silo », boutons « Liste des agents », « Nouvel agent », « Agrandir », « Fermer ».

Liste des agents (agent en cours en tête, puis les anciens du plus récent au plus ancien) :

| Agent | Date | Messages | État |
|---|---|---|---|
| Fais le point du jour | 14:38 | 4 messages | en cours |
| Point de sprint S41 | 9 oct. | 6 messages | |
| Relances client | 2 oct. | 3 messages | |

Un agent commencé le jour même montre son heure de début (« 14:38 »), les autres leur date. « + Nouvel agent » en tête de la
liste. Les deux anciens agents remplacent « Session du 6 octobre » et « Session du 29 septembre »
de la phase 18 (désormais nommés par leur première question). Agrandi : volet de 720 px, liste de 210 px, colonne de lecture de
520 px ; en étroit (340 px), la liste s'ouvre par-dessus la conversation (titre « Agents », bouton « Fermer la liste »).

### Pistes A, B, C (`design/redesign/scripts/02-data.js`)

Ce jeu est indépendant de celui des fonctionnalités : les mêmes numéros de tickets y portent d'autres titres et d'autres statuts.

Projet : 41 tickets terminés sur 68, 27 ouverts (3 en cours, 4 en review, 1 bloqué, 19 à faire), 3 questions, « ven. 16 oct. », S42.

| Ensemble | Ticket | Titre | Δ | Avancement | Échéance | Ligne |
|---|---|---|---|---|---|---|
| C0 | SILO-1 | Socle et déploiement | 0 | 12/12 | 3 oct. | |
| C1 | SILO-9 | Connexion et comptes | 0 | 8/8 | 10 oct. | |
| C2 | SILO-17 | Périmètre et affectations | 0 | 4/6 | lun. 19 oct. | Chaque chef de centre ne voit que ses box. (Δ −2) |
| C3 | SILO-36 | Saisie des box et constats | 0 | 9/14 | ven. 23 oct. | Saisie hors ligne, contrats et import Excel. |
| C4 | SILO-30 | Fichiers et photos | 0 | 1/5 | ven. 30 oct. | Photos de constat, aperçu hors ligne, quotas. |
| C5 | SILO-50 | Rapports de centre | −2 | 0/6 | ven. 13 nov. | Rapport journalier PDF et export client. |

| Ticket | Ensemble | Titre | Δ | Statut | Git | Étape | Mis à jour | Échéance |
|---|---|---|---|---|---|---|---|---|
| SILO-23 | C2 | 404 indiscernable hors périmètre | 0 | En cours | `feat/perimetre-404`, session | 6 | il y a 4 min | 19 oct. |
| SILO-33 | C4 | Aperçu des photos hors ligne | 0 | En cours | `feat/apercu-hors-ligne`, session | 7 | il y a 9 min | 30 oct. |
| SILO-22 | C2 | Périmètre côté serveur et côté synchro | 0 | En review | PR #21, 2 commentaires, CI verte | 9 | il y a 26 min | 19 oct. |
| SILO-32 | C4 | Envoi des photos de constat | 0 | En review | PR #22, CI verte | 10 | il y a 1 h | 30 oct. |
| SILO-41 | C3 | Saisie d'un constat hors ligne | 0 | En review | PR #20, changements demandés, CI rouge | 9 | il y a 3 h | 23 oct. |
| SILO-60 | — | Passage à Expo SDK 54 | 0 | En review | PR #23, CI en cours | — | il y a 5 h | — |
| SILO-43 | C3 | Validation des contrats par lot | 0 | En cours | `feat/contrats-lot` | 4 | il y a 5 h | 23 oct. |
| SILO-44 | C3 | Import des box depuis Excel | 0 | Bloqué | attend Q14 | 3 | hier | 23 oct. |
| SILO-21 | C2 | Réaffectation d'un box | 0 | Terminé | PR #18 fusionnée | 11 | il y a 2 h | — |
| SILO-31 | C4 | Stockage des fichiers sur MinIO | 0 | Terminé | PR #19 fusionnée | 11 | hier | — |
| SILO-34 | C4 | Quotas de stockage par client | −1 | À faire | attend SILO-32 | — | hier | 30 oct. |
| SILO-46 | C3 | Recherche d'un box par numéro | 0 | À faire | — | — | mar. 13 | 23 oct. |
| SILO-35 | C4 | Purge des fichiers orphelins | 0 | À faire | — | — | lun. 12 | 30 oct. |
| SILO-52 | C5 | Rapport journalier en PDF | 0 | À faire | attend SILO-23 | — | lun. 12 | 6 nov. |

Questions des pistes : Q14 sur SILO-44 (Client, il y a 3 j, bloquante), Q16 sur SILO-34 (Produit, hier), Q17 sur SILO-52 (Client,
il y a 2 h), mêmes titres que plus haut.

Activité (aujourd'hui, puis hier) : 15:04 PR #22 ouverte (SILO-32) · 14:51 Étape 7 · Porte qualité (SILO-33) · 14:40 Suivi mis à
jour · lot n° 6 proposé · 14:36 PR #18 fusionnée dans dev (SILO-21) · 14:20 Branche feat/perimetre-404 poussée (SILO-23) · 13:47
Étape 9 · Review · 2 commentaires à traiter (SILO-22) · 13:10 Q17 posée au client (SILO-52) · 11:58 CI rouge sur PR #20 (SILO-41) ;
hier 18:22 PR #19 fusionnée dans dev (SILO-31) · 16:05 Étape 3 · Questions · attend Q14 (SILO-44).

Session : T3 Code sur SILO-33, « 7 · Porte qualité », depuis 42 min. Lot n° 6 des pistes : « Créer SILO-61 · Compresser les
photos avant envoi » (dans C4 · après SILO-32 ; ici SILO-61 est un ticket à créer, propre aux pistes, sans lien avec le
SILO-61 « Passage à Expo SDK 54 » du jeu des fonctionnalités) ; « Lier SILO-34 : attend la fusion de PR #22 » (SILO-34 → SILO-32) ; « Relancer
le client sur Q14 » (SILO-44 bloqué depuis 3 j).

### Vocabulaire métier

| Mot | Formes |
|---|---|
| centre | « chef de centre », « Rapport de centre journalier », « Rapports de centre », « Centre 1 », « Travailler hors ligne au centre », « Carnet de centre » (style 1 de la page Styles), « location de box » (sous-titre en minuscules) |
| box (masculin, invariable) | « Voir ses box affectés », « Réaffecter un box », « Liste des box », « Recherche d'un box par numéro », « Import Excel des box », « Plans des box et fichiers », « Plans box » |
| constat, constats | « Saisir un constat hors ligne », « Saisir un constat… », « Constat hors ligne », « Schéma local des constats », « Saisie des box et constats », « Constats et étapes », « Constats », « Fiche constat », « Gérer un constat », « Photographier un constat », « Voir les constats d'un client », « Importer les constats depuis Excel » |
| contrat, contrats | « Valider les contrats par lot », « Valider les contrats », « Contrats par lot », « Statuts de contrat », « Import et contrats », « S43 Import et contrats », branche `feat/contrats-lot` |
| client (masculin) | « Quota par client », « Quotas par client », « dossier du client », « Créer et consulter ses clients », « Clients », « Constituer l'équipe d'un client », « Organigramme de client », « Clôturer, archiver, exporter un client », « Qui peut créer un client ? », « la création de client », « chargé de clientèle », « Bloquer le dépôt sur un client archivé ? », branche `feat/schema-clients` ; titre coupé sur deux lignes : « … ou par » / « client ? » |
| numéro, numéros | « Contrôle des numéros », « Recherche par numéro » |
| saisie | « Saisie hors ligne » (S42, « Sprint S42 · Saisie hors ligne »), libellé court « Saisie », troncature « Saisie ho… » |
| accueil, badge, lecteur | « Piloter l'accueil au Kanban », « Kanban accueil », « Encoder les badges d'accès », « Badges accès », « Scanner au lecteur », « Scan lecteur » |
| libération, état des lieux, caution | « Libérer les box : état des lieux et caution », libellé court « Libération » |

Fonctionnalités de la page Styles qui portent ce vocabulaire (les autres suivent les règles ci-dessus) :

| Fonctionnalité | Titre | Δ | Libellé court | Δ |
|---|---|---|---|---|
| F07 | Piloter l'accueil au Kanban | 0 | Kanban accueil | 0 |
| F08 | Encoder les badges d'accès | −1 | Badges accès | 0 |
| F12 | Scanner au lecteur | −1 | Scan lecteur | −1 |
| F13 | Libérer les box : état des lieux et caution | 0 | Libération | 0 |

Mots communs gardés tels quels : Galadrim, Adam, Microsoft, Microsoft Entra ID, Azure, AWS, MinIO, Expo SDK 54, Sentry, DSI,
staging, « Démo client », « Import des factures », « Export CSV ».
Numéros inchangés partout : tickets, `shortKey` F1 à F9, sprints S41 à S44 et leurs dates, PR #12 à #23, Q14, Q16, Q17, lot n° 7,
« 42 min », ports.
