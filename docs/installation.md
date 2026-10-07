# Installer Kibo

Kibo s'installe comme une application de bureau sur macOS (Apple Silicon et Intel) et sur Linux x86_64, ou se lance dans un navigateur depuis les sources. Toutes les versions sont sur la [page des releases](https://github.com/adbenmc-galadrim/Kibo/releases).

<!-- release-start -->
## Installer

Kibo est en alpha (`0.<phase>.0-alpha.N`) jusqu'au lancement ; les releases sont marquées pré-release et le canal de mise à jour est la release `alpha`.

### macOS

1. Télécharge le `.dmg` de ton Mac : `aarch64` pour Apple Silicon, `x64` pour Intel. Ouvre-le et glisse Kibo dans Applications.
2. L'application est signée par Kibo, pas par Apple. Ouvre Kibo une première fois : macOS refuse. Réglages Système ▸ Confidentialité et sécurité ▸ « Ouvrir quand même ».
3. Sur macOS 14 et avant, clic droit sur Kibo ▸ Ouvrir ▸ Ouvrir suffit.
4. Avancé : `xattr -d com.apple.quarantine /Applications/Kibo.app`.

Ensuite, les mises à jour s'installent depuis Paramètres › Général, sans question.

### Linux (x86_64)

```sh
curl -fsSL https://github.com/adbenmc-galadrim/Kibo/releases/download/alpha/install.sh | bash
```

Le script choisit le paquet de ta distribution (`.deb` avec `apt`, `.rpm` avec `dnf`, sinon l'AppImage dans `~/.local/bin` avec son raccourci et son icône), vérifie sa somme dans `SHA256SUMS` et s'arrête si elle ne correspond pas. Il ne demande `sudo` que pour `apt` ou `dnf`. Tu peux aussi télécharger le `.deb`, le `.rpm` ou l'`.AppImage` à la main ; seule l'AppImage se met à jour toute seule.

### Navigateur

Depuis les sources, avec [Bun](https://bun.sh) : `bun install` puis `bun run start`.
<!-- release-end -->

## Vérifier un téléchargement

Chaque release publie `SHA256SUMS`, la somme de tous ses fichiers. Dans le dossier du téléchargement, avec `SHA256SUMS` à côté :

```sh
shasum -a 256 -c SHA256SUMS --ignore-missing
```

Sur Linux, `sha256sum -c SHA256SUMS --ignore-missing` fait la même chose. Chaque fichier présent doit afficher `OK`.

Les sommes SHA256SUMS protègent d'un téléchargement corrompu, pas d'une release compromise : elles sont publiées au même endroit que les paquets. Pour plus de garantie, utilise le `.dmg` ou le `.deb` de la release officielle, ou vérifie le tag de la version dans le dépôt.

## Où sont tes données

Tout vit dans `~/.kibo` : bases `kibo.db` et `runs.db`, composants (`components/`), notes (`notes/`), fichiers des projets (`files/`). Rien n'est envoyé ailleurs, sauf ce que tu partages par la synchronisation et les appels aux agents.

## Sauvegardes et restauration

Kibo sauvegarde `~/.kibo` une fois par jour au plus et avant chaque mise à jour, dans `~/.kibo/backups` par défaut (dossier modifiable dans Paramètres › Général › Sauvegardes). Une sauvegarde contient `kibo.db`, `runs.db`, `components/` et `notes/` ; jamais le jeton, l'accès distant ni les fichiers des projets (`files/`).

Restaurer se fait à la main :

1. Quitte Kibo.
2. Dans `~/.kibo`, remplace `kibo.db`, `runs.db`, `components/` et `notes/` par ceux du dossier de la sauvegarde choisie.
3. Relance Kibo.

## Désinstaller

1. Supprime l'application : `/Applications/Kibo.app` sur macOS ; sur Linux, `sudo apt remove kibo`, `sudo dnf remove kibo`, ou, pour l'AppImage, `~/.local/bin/kibo`, `~/.local/share/applications/kibo.desktop` et `~/.local/share/icons/hicolor/512x512/apps/kibo.png`.
2. Si « Lancer au démarrage » était activé : supprime `~/Library/LaunchAgents/Kibo.plist` (macOS) ou `~/.config/autostart/Kibo.desktop` (Linux).
3. Pour effacer aussi tes données : supprime `~/.kibo` (pense à garder une sauvegarde).
