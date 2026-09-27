# Domaine Marketplace

Spec : `docs/superpowers/specs/2026-09-26-kibo-marketplace.md` (H).
- Chaîne de confiance complète : clé de source, index signé (`serial` croissant), hash du paquet, signature de l'éditeur épinglé, empreinte recalculée, build local, approbation de ce hash (§7).
- Un paquet est refusé si l'un des contrôles du §4 échoue ; un changement de clé d'éditeur n'est débloqué que par l'utilisateur.
- Aucune dépendance ni script d'installation dans un paquet ; aucun code du paquet ne s'exécute avant l'approbation.
- Installation : Sandboxé présélectionné à l'écran 30 ; les actions qui donnent de la confiance restent réservées au poste local (D43, D44).
- Téléchargements en HTTPS seulement (loopback en test), redirections limitées au même hôte, tailles bornées.
