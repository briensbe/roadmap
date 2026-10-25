# Règles Shell, Terminal et Outils

## Package Manager & Build
- **Règle :** Utiliser systématiquement `pnpm` plutôt que `npm` pour les commandes et scripts de ce projet.
- **Action :** Pour compiler et vérifier le projet, exécuter obligatoirement `pnpm build` (ou `pnpm run build`) au lieu de `npm run build`.

## Règles de recherche, d'exploration et de comptage
- Utilise systématiquement `rg` (ripgrep) pour rechercher du texte, lister les fichiers d'un dossier ou compter les lignes.
- N'utilise JAMAIS les cmdlets PowerShell d'exploration, de lecture ou de comptage (`Get-Content`, `(Get-Content ...).Length`, `Get-ChildItem`, `Select-String`, `dir`, `ls`, `gci`).
- Syntaxes courantes :
  - Compter les lignes d'un fichier (règle des 1000 lignes) : `rg -c "^" <chemin>`
  - Lister les fichiers d'un dossier : `rg --files <chemin>`
  - Chercher du texte dans les fichiers : `rg "<motif>" <chemin>`
  - Filtrer par extensions de fichier : `rg -g "*.{ts,html}" "<motif>" <chemin>`
- Privilégie systématiquement les commandes atomiques SANS pipe (`|`), sans redirection ni chaînage (`&&`, `;`) pour respecter l'Allowlist du terminal.
- Si `rg` n'est pas disponible, demande confirmation avant d'utiliser une alternative.

## Documentation & Artefacts Markdown (OpenSpec, ADRs)
- **Règle :** Dans tous les fichiers Markdown générés ou modifiés (spécifications, propositions, designs, ADRs, tasks, docs), ne JAMAIS insérer de chemins de fichiers absolus (ex: `file:///c:/...` ou `C:\...`).
- **Action :** Utiliser systématiquement des chemins relatifs par rapport au fichier courant ou à la racine du projet (ex: `src/...` ou `../../../src/...`).
