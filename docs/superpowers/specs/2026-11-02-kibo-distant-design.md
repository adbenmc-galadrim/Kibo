# Kibo sur téléphone, via kibo.shinseo.fr

Demande d'Adam du 2026-11-02. Intégré en §52 de la spec principale le 2026-11-03 ; la spec principale prime. Remplace la « décision future » de la spec principale §49.6. Une fois validé, ce document devient la section 52 de la spec principale.

## Intention

Dehors, depuis son téléphone, Adam veut savoir où en sont ses projets et les faire avancer : voir le graphe, répondre à une question, parler à l'agent de projet, lancer un ticket. Tailscale n'est pas la réponse : l'accès distant précédent a été retiré en phase 33 parce que son TLS local et son appairage pesaient sur chaque version, et le démon refuse tout autre hôte que `127.0.0.1`.

Réussite : Adam, sur son iPhone, ouvre Kibo comme une application, comprend l'état d'un projet en quelques secondes, et lance un ticket dont il voit ensuite l'avancement. La qualité de l'expérience ne se juge pas sur maquette : **Adam la validera sur un exemple réel une fois le développement fait**, ce qui fait partie du livrable.

## Objectifs

Sur téléphone, avec un projet réel :

- **Graphe** : vues Fonctionnalités et PRs.
- **Kanban**, **Planning**, **Dashboard** (la Vue d'ensemble du Mac).
- **Fiche d'un ticket**.
- **Questions** : les lire et y répondre.
- **Agent de projet** : conversation et propositions de lots.
- **Lancer un ticket**, comme le fait le Mac : `t3.launch`, dans T3 Code et sa propre file (§50.12), sans nouvelle file côté Kibo.
- **Changer de projet** parmi les projets activés pour le téléphone.
- **Mac éteint ou hors ligne** : le dernier état connu reste consultable, avec son heure.

**Aucune régression** : sur ces écrans, chaque fonctionnalité du Mac existe aussi sur téléphone, **écritures comprises** : statut, sprint, assigné, description, labels et liens d'un ticket, mise en attente, déplacement des cartes, création, modification et suppression des questions (décision d'Adam). Seule exception : ce qui n'a pas de sens sur un téléphone, comme ouvrir un dossier local, un lien `t3-thread://` ou une action qui renvoie vers Paramètres. Le plan en dresse l'inventaire écran par écran, avec chaque exception justifiée. Le style, lui, n'a pas à être celui du bureau : l'expérience est conçue pour le téléphone (décision d'Adam).

## Hors périmètre

- Agents et skills, Paramètres : restent sur le Mac.
- Plusieurs utilisateurs, partage, plusieurs Mac, synchronisation entre ordinateurs : Adam et ce Mac uniquement.
- Reprendre sur le site la page d'accueil de shinseo.fr : elle reçoit seulement un lien.

## Ce qui serait un échec, même si ça marche techniquement

- Le serveur peut lire les données d'un projet client.
- Le démon écoute autre chose que `127.0.0.1`, ou un port est ouvert sur le Mac.
- Le Mac change d'apparence ou de comportement.
- Une fonctionnalité d'un écran retenu manque sur téléphone.
- Un graphe de bureau simplement rétréci, pénible à utiliser au pouce.
- L'état affiché semble à jour alors qu'il est ancien.

## Parcours décidés par Adam

- **Navigation** : onglets en bas, dans cet ordre : Graphe, Kanban, Planning, Questions, Dashboard. Chaque libellé tient sur une ligne ; « Dashboard » remplace « Vue d'ensemble » sur téléphone pour cette raison.
- **Agent de projet** : bouton dans l'en-tête, avec son compteur.
- **Graphe** : présenté par fonctionnalités, comme le Mac (cadres, segments, étapes). La maquette validée a des sprints en colonnes, le suivant dépassant sur le bord pour inviter au glissement ; elle est à reporter dans Penpot, en sombre et en clair.
- **Mac éteint** : tout reste en lecture seule. Toute écriture (lancer un ticket, répondre à une question, écrire à l'agent, modifier un ticket) est **refusée** avec un message clair ; **rien n'est mis en attente** pour le retour du Mac. Une bande indique « Mac éteint · dernier état à HH:MM ».
- **Sombre et clair** : les deux, thème système par défaut, comme tout Kibo.

## Fonctionnement décidé (choix de l'auteur présentés à Adam, sauf mention contraire)

- **Le Mac se connecte au serveur** par une connexion sortante ; aucun port entrant. Le démon reste sur `127.0.0.1`.
- **Service séparé** sur `kibo.shinseo.fr`, déployé par Coolify sur le serveur existant (116.202.20.62, le DNS pointe déjà dessus), comme les autres sous-domaines. Le dépôt `shinseo` ne reçoit qu'un lien.
- **Chiffrement de bout en bout** : données et demandes sont chiffrées sur le Mac et le téléphone. Le serveur ne stocke et ne transmet que des blocs illisibles, plus ce qu'il faut pour router (identifiants techniques, heure du dernier contact). La clé naît sur le Mac et passe au téléphone une seule fois, par un QR code ou un code affiché sur le Mac, jamais envoyé au serveur.
- **Clé perdue** : on refait l'appairage depuis le Mac, qui renvoie tout. Le serveur ne contient rien d'irremplaçable : l'effacer ne fait rien perdre.
- **Limite assumée du chiffrement** : le serveur ne peut lire ni ce qu'il stocke ni ce qu'il transmet. Mais il livre aussi l'application au téléphone : quelqu'un qui en prendrait le contrôle pourrait y glisser du code lisant la clé. Limite acceptée, le serveur étant celui d'Adam ; pas de voie de livraison indépendante.
- **Projets envoyés** : choix projet par projet sur le Mac, **tous désactivés au départ** (décision d'Adam). Pour un projet activé, tout ce que les écrans retenus affichent reste consultable Mac éteint : activité des tickets, images des questions, PRs, conversations avec l'agent. Le Mac pousse donc ces données à l'avance.
- **Connexion au site** : passkey, pour ne pas retaper de mot de passe. La première n'est créée qu'avec le code affiché sur le Mac : personne d'autre ne peut s'inscrire.
- **Appairage depuis l'application installée** : scanner intégré ou code à coller, pour que la clé arrive bien dans l'application et non dans Safari. À vérifier sur iPhone.
- **Application installée sur l'écran d'accueil** (PWA) : c'est le mode d'usage visé, car Safari efface après 7 jours sans visite les données d'un site non installé, clé comprise.
- **Mêmes données, même code** : le site réutilise les composants de Kibo pour la logique et les données (`components/*`, `packages/sdk`, `packages/ui`), avec une présentation adaptée au téléphone. Une seule source de vérité évite qu'une fonctionnalité existe sur le Mac et manque sur téléphone. Le travail de la branche `feat/mobile` (§47, jamais fusionnée) sert de départ. Les règles de requêtes de conteneur de §47 protègent le bureau : au-dessus des seuils, les références pixel restent valables.
- **Aucun secret ne quitte le Mac** : ni jeton, ni clé d'intégration, ni `~/.kibo/token`. Seul ce que les écrans retenus affichent est envoyé.
- **Liste fermée de demandes** : le démon n'accepte du téléphone que les actions des écrans retenus. Toute autre méthode est refusée, y compris celles qui touchent aux réglages. La session distante est marquée `remote: true` ; `server.ts` fixe aujourd'hui `remote: false` et `t3Rpc` comme `projectAgentRpc` exigent `requireLocal` sur toutes leurs méthodes. Ces gardes s'assouplissent donc pour les seules méthodes de la liste. `resetProjectAgent` reste réservé au Mac.
- **Lancement réel sur le Mac** : le serveur n'exécute rien. Un ticket lancé suit le chemin habituel du démon, file d'attente comprise.
- **Activable et désactivable depuis le Mac** : désactivé par défaut ; le désactiver coupe la connexion et révoque le téléphone.

## Contraintes

- Règles du dépôt (`CLAUDE.md`) : TypeScript, Zod, TDD, Biome, aucun token dans les tests, nouvelles dépendances justifiées.
- **Dépôt public** : aucune donnée de projet client, ni dans le code ni dans les maquettes ou fixtures ; données fictives de `design/donnees-fictives.md`. Le test réel d'Adam se fait sur son instance, hors dépôt.
- Budget d'entrée de l'interface de bureau inchangé (§49) : le code propre au téléphone est différé ou dans une entrée séparée.
- Les références pixel du bureau restent vertes.
- Écrans téléphone en sombre et en clair, maquettes Penpot à jour.

## Laissé au constructeur

- Format du canal et des instantanés, primitives de chiffrement (bibliothèque auditée ou WebCrypto), stockage côté serveur.
- Emplacement du service (paquet du monorepo recommandé, par exemple `packages/remote-server`) et de l'entrée téléphone.
- Découpage de la présentation de chaque écran sur téléphone, dans l'esprit de la maquette, et traitement des flèches de dépendance du graphe.
- Fréquence d'envoi des états, tant que le téléphone reste réactif quand le Mac est allumé.
- Découpage en tâches ; une PR au jalon, version `0.35.0-alpha.N`.

## Vérification

- Tests automatiques : serveur incapable de déchiffrer (il ne reçoit jamais la clé), méthode hors liste refusée, refus Mac éteint, démon toujours limité à `127.0.0.1`, bureau inchangé.
- Parcours Playwright à 390 px, sombre et clair, sur chaque écran retenu, et inventaire des fonctionnalités du Mac écran par écran.
- **Validation d'Adam sur son iPhone avec un projet réel** : une version alpha est fusionnée, publiée et déployée pour ce test, puis ses retours sont corrigés dans les alphas suivantes. La phase se clôt quand Adam valide.

## À faire par Adam

- Créer la passkey et appairer le téléphone au premier usage.
- Créer dans Coolify l'application `kibo.shinseo.fr` si elle ne peut pas l'être par l'API avec les accès existants.
