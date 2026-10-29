# Signature de la release macOS

Kibo n'a pas de compte développeur Apple (décision du 2026-10-04) : pas d'identité « Developer ID », pas de notarisation. Les releases macOS sont signées par un certificat **auto-signé et stable**, « Kibo Code Signing » (spec §49.7).

## Pourquoi

macOS lie l'accès à chaque entrée du trousseau à l'exigence désignée du binaire qui l'a créée. Signé ad hoc (`signingIdentity: "-"`), `kibo-daemon` change d'exigence à chaque build : le trousseau redemande l'accès après chaque mise à jour. Signé par un certificat qui ne change pas, l'exigence (`certificate leaf = H"…"`) survit aux mises à jour et l'accès accordé une fois reste valable.

## Ce qui est signé, et quand

- `apps/desktop/src-tauri/tauri.conf.json` garde `"signingIdentity": "-"` : un build local ou le build d'un fork reste ad hoc.
- `.github/workflows/release.yml`, job `build`, sur macOS seulement et **seulement si** le secret `MACOS_SIGNING_P12` existe :
  1. « Importer le certificat de signature » : trousseau temporaire, import du `.p12`, `set-key-partition-list`, confiance `codeSign` accordée au certificat, puis `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` et `APPLE_SIGNING_IDENTITY=Kibo Code Signing` ajoutées à l'environnement du job ;
  2. `tauri-action` signe l'application et ses binaires embarqués avec cette identité, qui prend le pas sur `"-"` ;
  3. « Supprimer le trousseau de signature », même en cas d'échec.
- Sans le secret, ces étapes sont sautées et la release est signée ad hoc comme avant.
- Aucune variable de compte Apple (`APPLE_ID`, `APPLE_TEAM_ID`, notarisation) n'apparaît : `release-signing.test.ts` et `bundle-conf.test.ts` le vérifient.

## Générer le certificat (une fois, sur un Mac)

```sh
bash apps/desktop/scripts/make-signing-cert.sh ~/Documents/kibo-signing
```

- Le dossier de sortie doit être **hors de tout dépôt git** et vide : le script refuse sinon.
- Le script demande le mot de passe du `.p12` deux fois (ou le lit dans `KIBO_SIGNING_P12_PASSWORD`).
- Il écrit `kibo-signing.p12` (clé privée et certificat, droits `600`) et `kibo-signing.crt` (certificat public). La clé en clair n'est jamais laissée sur le disque.
- Certificat : ECDSA P-256, `CN=Kibo Code Signing`, `keyUsage=digitalSignature`, `extendedKeyUsage=codeSigning`, 3 650 jours.
- Le script ne touche pas au trousseau du Mac.

## Déposer les secrets

Les deux commandes sont affichées par le script :

```sh
base64 < ~/Documents/kibo-signing/kibo-signing.p12 | tr -d '\n' | gh secret set MACOS_SIGNING_P12 --repo adbenmc-galadrim/Kibo
gh secret set MACOS_SIGNING_P12_PASSWORD --repo adbenmc-galadrim/Kibo
```

La seconde demande le mot de passe sans l'écrire dans l'historique du shell. `gh secret list --repo adbenmc-galadrim/Kibo` doit lister les deux noms.

## Vérifier une release signée

Sur l'application installée :

```sh
codesign -dv --verbose=2 /Applications/Kibo.app 2>&1 | grep Authority
codesign -dv --verbose=2 /Applications/Kibo.app/Contents/MacOS/kibo-daemon 2>&1 | grep Authority
```

Les deux affichent `Authority=Kibo Code Signing`. Une release ad hoc affiche `Signature=adhoc`.

## Rotation

Le certificat vaut dix ans. Le remplacer (expiration, perte du `.p12`, fuite de la clé) :

1. Générer un nouveau certificat dans un nouveau dossier vide, avec le script.
2. Redéposer les deux secrets.
3. La release suivante est signée par le nouveau certificat : son exigence désignée change, donc macOS redemande l'accès au trousseau **une fois**, puis plus rien.

En cas de fuite, supprimer d'abord les secrets (`gh secret delete MACOS_SIGNING_P12 --repo adbenmc-galadrim/Kibo`, idem pour le mot de passe) : les releases suivantes redeviennent ad hoc jusqu'au nouveau dépôt.

## Ce que voit l'utilisateur

- **Installation** : rien ne change. Gatekeeper traite un certificat auto-signé comme une signature ad hoc ; l'ouverture la première fois passe toujours par Réglages Système ▸ Confidentialité et sécurité ▸ « Ouvrir quand même » (voir [installation](installation.md)).
- **Première mise à jour signée** : macOS demande une dernière fois l'accès au trousseau pour `kibo-daemon` ; répondre « Toujours autoriser ».
- **Mises à jour suivantes** : aucune demande.
