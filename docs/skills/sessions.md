# Sessions T3 Code dans Kibo

Kibo signale qu'un ticket est travaillé dans T3 Code par un point orange (« session · T3 Code »). Le signal est facultatif et ne change jamais le statut du ticket (spec §38.3).

## Commandes

```bash
kibo tickets session <CLÉ> start   # au début du run (étape du worktree de full-delivery)
kibo tickets session <CLÉ> ping    # entretient la session ouverte
kibo tickets session <CLÉ> stop    # à la fin du run
```

Sans clé, la commande trouve le projet par `--project`, sinon par le dossier courant (du plus profond au moins profond), et le ticket par la branche courante.

## Branche et PR (`kibo tickets set`)

```bash
kibo tickets set <CLÉ> branch=<branche> base=<base>   # À faire ou Backlog ⇒ En cours
kibo tickets set <CLÉ> pr=<n|url>                     # À faire, Backlog ou En cours ⇒ En review
```

La CLI déclare la référence au démon (RPC `declareTicketRef`), qui applique les mêmes règles et le même journal que l'observateur git : `branch_created`, `pr_opened`, puis `pr_merged` quand le démon voit la fusion. Un ticket *En review*, *Bloqué* ou *Terminé* ne recule pas ; une référence déjà déclarée ne change rien. La sortie nomme le nouveau statut : `✓ SILO-12 : branche feat/x (base dev) · En cours`.

Le projet vient de `--project`, sinon du préfixe de la clé (`SILO-12` ⇒ `SILO`), sinon du dossier courant. Une clé de fonctionnalité (`F5`) ou un identifiant du plan (`C2-5`) demande `--project` hors du dossier du projet.

Le démon visé est celui de `$KIBO_HOME/daemon.json` (défaut `~/.kibo`), ou de `--home <dossier>`.

## Hook d'activité facultatif

Dans `.claude/settings.json` du dépôt, un hook `PostToolUse` entretient la session tant que l'agent travaille :

```json
{
  "hooks": {
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "kibo tickets session ping >/dev/null 2>&1 || true" }] }
    ]
  }
}
```

Un `ping` sans session ouverte ne fait rien : il n'ouvre jamais de session.

## Retouche d'un ticket livré (`update-delivery`)

```bash
kibo tickets set <CLÉ> branch=<branche-de-retouche>
kibo tickets step <CLÉ> <n> --update
```
