export const frAi = {
  welcome: {
    title: "Bienvenue dans Kibo",
    subtitle:
      "Kibo suit tes projets : sprints, fonctionnalités, branches, PR et CI, mis à jour depuis git et GitHub.",
    claude: "Claude Code · pour l'agent de projet",
    claudeReady: "claude détecté · connecté à ton abonnement",
    claudeUnverified: "claude détecté · connexion non vérifiée",
    claudeLoggedOut: "claude détecté · non connecté, l'agent de projet n'est pas disponible",
    claudeMissing: "claude introuvable · l'agent de projet n'est pas disponible",
    claudeInstallHelp: "Installe Claude Code, puis lance claude et tape /login :",
    claudeLoginHelp: "Lance claude dans un terminal, puis tape /login :",
    git: "Git",
    gitDetail: (git: string | null) =>
      git === null ? "git introuvable · sans lui, Kibo ne suit pas les branches" : `git ${git} détecté`,
    gh: "GitHub CLI",
    ghDetail: (gh: string | null) =>
      gh === null
        ? "gh introuvable · sans lui, ni PR, ni review, ni CI dans Kibo"
        : `gh ${gh} · remonte les PR, leur review et la CI`,
    ghInstallHelp: "Installe gh, puis connecte ton compte GitHub :",
    github: "Compte GitHub",
    githubDetail: "Pour lier tes dépôts : issues, PR et CI",
    githubConnect: "Connecter",
    githubConnected: "Connecté",
    importFolder: "Importer un dossier existant",
    createFirst: "Créer mon premier projet",
    retry: "Réessayer",
    showHelp: "Comment corriger",
  },
} as const;
