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

Graphe (188 à 188d) : projet de la taille d'Emis repris de `32e-graphe-lisible.js` (69 tickets, 38 ouverts sur 5 vagues, 31 terminés repliés,
6 démarrables, chapitres C0 à C9, 36 liens tracés et 24 implicites masqués, focus sur KIB-65). Kanban 188k : « Démarrable » sur KIB-22 et KIB-9 ;
KIB-18 (en file #2) et KIB-15 (attend KIB-12) ne le sont pas.

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
3 140 tokens (workspace 420, projet 1 380, domaine Agents 260, agent 610, protocole 470), `brief.md` 540, `agents.json` 1 920.
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
