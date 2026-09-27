# Domaine Sync

Spec : `docs/superpowers/specs/2026-09-26-kibo-sync.md` (G), décisions D1 à D46 au §13.
- Partage opt-in explicite : rien ne quitte la machine sans serveur configuré et clic « Partager » ; le dossier local, `notesDir`, les runs, les secrets et la confiance des composants ne se synchronisent jamais (§3.4).
- Dans un projet partagé, seul le serveur attribue les clés de ticket ; un client n'écrit jamais `key`, `meta.ticketSeq`, `meta.keyAllocator` ni `meta.members` (§5).
- Chaque lot client est validé contre le doc serveur (`validateProjectUpdate`, fonction pure de `core`) ; un doc refusé suspend le projet sans bloquer l'édition locale (D45).
- Transport `wss://` obligatoire, `ws://` seulement vers le loopback ; clé d'appareil Ed25519 au trousseau, jamais sur disque en clair.
- Présence en mémoire seulement, bornée et ré-horodatée à la réception.
- Toute évolution garde la propriété de convergence fast-check verte (deux et trois pairs).
