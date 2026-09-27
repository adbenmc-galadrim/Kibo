# Conventions de travail (tous les projets)

## Attribution
- Aucune mention d'IA dans un artefact : pas de trailer « Generated with », pas de `Co-Authored-By`, pas de lien vers un outil d'IA, aucune signature. Vaut pour les commits, PR, issues, reviews et tout texte produit.

## Commits
- Préfixe conventionnel obligatoire : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`… Scope optionnel.
- Une seule ligne de moins de 50 caractères, préfixe inclus, en français. Pas de body : un seul `git commit -m "…"`.
- Stager les fichiers concernés explicitement, jamais `git add -A` ; ne pas embarquer une modification sans rapport.

## Pull requests
- Ne pas créer la PR avec `gh pr create` par défaut : pousser la branche puis fournir la description.
- Ne jamais nommer une PR future : dire « dans une prochaine PR ».
- Ne jamais répondre à une review sans l'accord explicite de l'utilisateur : proposer le texte et attendre.

## Sous-agents
- Toujours préciser à un sous-agent le worktree de travail.
