import type { DesiredTicket } from "../src/desired";

const V1 = "Source : rapport du jalon v1.0 (docs/superpowers/rapports/2026-09-27-jalon-v1.0.md)";
const risk = (text: string) => `${text}\n\n${V1}, section Risques.`;
const open = (text: string) => `${text}\n\n${V1}, section Points ouverts.`;
const dogfood = (text: string) =>
  `${text}\n\nSource : import dogfood du projet Kibo (scripts/dogfood), fonction absente de l'API publique.`;

export const TICKETS: DesiredTicket[] = [
  {
    title: "Vérifier bwrap et les E2E sync et marketplace sous Linux",
    domain: "Sécurité",
    description: risk(
      "L'isolation bwrap et les parcours E2E sync et marketplace n'ont été vérifiés que sous macOS ; seule la CI de la PR fait foi pour Linux. Rejouer ces parcours sur une machine Linux et consigner l'écart éventuel.",
    ),
  },
  {
    title: "Suivre la dépréciation de sandbox-exec sous macOS",
    domain: "Sécurité",
    description: risk(
      "sandbox-exec est déprécié par Apple et le profil est sensible aux versions de Bun et de macOS ; certaines distributions restreignent les espaces de noms utilisateur. Évaluer une alternative et ajouter un test qui détecte la régression du profil.",
    ),
  },
  {
    title: "Livrer le filtre seccomp des backends Linux",
    domain: "Sécurité",
    description: risk(
      "Le filtre seccomp prévu par la spec H §8 (interdire execve dans le bac à sable) a été reporté en v1.0. L'ajouter à bwrap et couvrir l'évasion par components/exit.test.ts.",
    ),
  },
  {
    title: "Retirer la clé de test dev.kibo du trousseau",
    domain: "Sécurité",
    description: open(
      "Les premiers essais E2E ont écrit la clé dev.kibo / sync:device dans le trousseau de connexion : security delete-generic-password -s dev.kibo -a sync:device. Vérifier qu'aucun test ne l'écrit encore (trousseau en mémoire).",
    ),
  },
  {
    title: "Étudier le chiffrement de bout en bout de la sync",
    domain: "Sync",
    description: risk(
      "Le serveur kibo-sync lit les données en clair (spec G §8 et §12). Chiffrer de bout en bout, ou documenter le modèle de confiance retenu.",
    ),
  },
  {
    title: "Faire accepter localement une liaison attribuée",
    domain: "Sync",
    description: risk(
      "Un serveur compromis peut attribuer une liaison d'intégration à un membre ; l'acceptation locale est hors v1.0 (D46). Demander au membre de confirmer une liaison avant de l'exécuter.",
    ),
  },
  {
    title: "Éprouver tls.ca du client WebSocket de Bun",
    domain: "Sync",
    description: risk(
      "L'option tls.ca du client WebSocket de Bun est peu éprouvée. Tester la connexion à un serveur auto-hébergé avec une CA propre (caFile) et le refus d'un certificat inconnu.",
    ),
  },
  {
    title: "Réduire le coût des updates reçus en sync",
    domain: "Sync",
    description: risk(
      "Copie complète du doc à chaque update reçu (D45) côté démon et fork() par lot côté serveur : coûteux sur un gros projet actif. Mesurer, puis valider sans copie complète.",
    ),
  },
  {
    title: "Une clé d'appareil par démon au trousseau",
    domain: "Sync",
    description: risk(
      "La clé d'appareil est rangée au trousseau sous un nom fixe : deux démons sur une même machine se l'écrasent. Dériver le nom du KIBO_HOME ou de l'identifiant d'appareil.",
    ),
  },
  {
    title: "Présence : retrait perdu si l'horloge avance",
    domain: "Sync",
    description: risk(
      "Le retrait immédiat de présence est perdu si l'horloge du démon avance sur celle du serveur (repli : expiration à 30 s). Ne plus dépendre de l'horloge du démon pour l'effacement.",
    ),
  },
  {
    title: "Jonction : code consommé puis refusé",
    domain: "Sync",
    description: risk(
      "Un code d'invitation consommé puis refusé localement laisse un membre sans copie locale ; la seule sortie est retrait puis réinvitation. Rendre la jonction reprenable.",
    ),
  },
  {
    title: "Limites par IP derrière un NAT partagé",
    domain: "Sync",
    description: risk(
      "Un NAT partagé peut occuper les places non authentifiées ou bloquer l'IP 5 minutes. Revoir les limites par IP du serveur (par appareil une fois authentifié).",
    ),
  },
  {
    title: "Détecter les homoglyphes d'une seule écriture",
    domain: "Marketplace",
    description: risk(
      "Les homoglyphes d'une seule écriture ne sont pas détectés dans les noms de composants ou d'éditeurs ; le rempart actuel est l'empreinte affichée à l'écran 30.",
    ),
  },
  {
    title: "Quota de stockage par éditeur",
    domain: "Marketplace",
    description: risk(
      "La source d'équipe n'a pas de quota de stockage par éditeur. En ajouter un, refusé en clair.",
    ),
  },
  {
    title: "SIGNATURE_INVALID : montrer l'empreinte reçue",
    domain: "Marketplace",
    description: risk(
      "Le refus SIGNATURE_INVALID n'affiche que l'empreinte attendue. Afficher aussi l'empreinte reçue pour comparer.",
    ),
  },
  {
    title: "Lecture seule dans la fiche ticket et les composants",
    domain: "UI",
    description: risk(
      "La lecture seule d'un projet partagé (viewer) n'est pas appliquée dans la fiche ticket ni dans l'édition des composants ; seul le démon refuse. Désactiver les contrôles d'édition.",
    ),
  },
  {
    title: "Erreurs de partage reconnues par code",
    domain: "UI",
    description: risk(
      "Les cas d'erreur de partage sont reconnus au texte du message. Les reconnaître par le code KiboError.",
    ),
  },
  {
    title: "Regagner de la marge sur le budget de chargement",
    domain: "UI",
    description: risk(
      "Marge de 1,1 kB sur le budget de 230 kB (228,9 kB au tag). Trouver ce qui peut être chargé à la demande.",
    ),
  },
  {
    title: "Découper AddComponentDialog.tsx",
    domain: "UI",
    description: risk("AddComponentDialog.tsx dépasse 300 lignes (règle du projet) : le découper."),
  },
  {
    title: "Découper packages/sdk/src/mock.ts",
    domain: "Devkit et SDK",
    description: risk("packages/sdk/src/mock.ts dépasse 300 lignes (règle du projet) : le découper."),
  },
  {
    title: "Ajouter timeout-minutes au job E2E",
    domain: "CI",
    description: risk(
      "Le job E2E n'a pas de timeout-minutes (E2E macOS ≈ 10 min) : un blocage coûterait jusqu'à 6 h de runner.",
    ),
  },
  {
    title: "Faire taire le poller de PR des démons E2E",
    domain: "CI",
    description: risk(
      "Le poller de PR est bruyant dans les démons E2E. Le désactiver ou le rendre silencieux en E2E.",
    ),
  },
  {
    title: "Rendre les tests indépendants de leur ordre",
    domain: "CI",
    description: risk(
      "Des tests d'un même fichier dépendent de leur ordre. Les isoler et passer la suite avec --randomize.",
    ),
  },
  {
    title: "bun test nu ne doit plus lancer Playwright",
    domain: "CI",
    description: risk(
      "bun test nu à la racine exécute les specs Playwright. Les exclure (bunfig) pour que bun test seul reste sûr.",
    ),
  },
  {
    title: "Plusieurs workspaces : création et bascule",
    domain: "Démon",
    description: open(
      "Point E6 : créer un workspace et basculer depuis l'en-tête de la barre latérale. Piste du plan de phase 4 : un dossier par workspace, bascule = redémarrage du démon sur l'autre dossier. En attente de la décision d'Adam ; la spec est à compléter avant tout code.",
    ),
  },
  {
    title: "Décider de la suite après v1.0",
    domain: null,
    description: open("Valider v1.0 et choisir la suite : phase 8 ou corrections. Décision d'Adam."),
  },
  {
    title: "Supprimer l'export Penpot en double",
    domain: null,
    description: open(
      "Supprimer ~/Downloads/Kibo (1).penpot (177 Mo) ; la source de vérité est design/penpot (kibo.penpot.xz, 69 Mo).",
    ),
  },
  {
    title: "Profils d'agent : accepter le modèle fable",
    domain: "Agents",
    description: dogfood(
      "AgentModel n'accepte que opus, sonnet et haiku : le profil kibo-lead (model: fable dans .claude/agents/kibo-lead.md) a été importé en opus. Ajouter fable au schéma et au lancement des runs.",
    ),
  },
  {
    title: "Profils d'agent : description et outils autorisés",
    domain: "Agents",
    description: dogfood(
      "ProfileInput n'a ni description ni liste d'outils : la description et les consignes des agents de .claude/agents sont importées en guideline de profil, et la restriction d'outils (tools: Read, Grep, Glob, Bash du reviewer) est perdue. Ajouter ces champs et les passer au CLI (--allowedTools).",
    ),
  },
  {
    title: "Notes : ouvrir un PDF ou un fichier du dépôt",
    domain: "UI",
    description: dogfood(
      "Un lien de note ne s'ouvre que vers une autre note .md du dossier de notes : les PDF Penpot (design/pdf) et les fichiers hors du dossier de notes ne sont pas cliquables. Ouvrir ces liens dans l'onglet Code ou avec l'application du système.",
    ),
  },
];
