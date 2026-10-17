# Sessions T3 Code dans Kibo

Kibo signale qu'un ticket est travaillé dans T3 Code par un point orange (« session · T3 Code »). Le signal est facultatif et ne change jamais le statut du ticket (spec §38.3).

## Commandes

```bash
kibo tickets session <CLÉ> start   # au début du run (étape du worktree de full-delivery)
kibo tickets session <CLÉ> ping    # entretient la session ouverte
kibo tickets session <CLÉ> stop    # à la fin du run
```

Sans clé, la commande trouve le projet par `--project`, sinon par le dossier courant (du plus profond au moins profond), et le ticket par la branche courante.

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
