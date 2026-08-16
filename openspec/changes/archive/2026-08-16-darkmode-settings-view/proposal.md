## Why

La vue des paramètres système (`src/components/settings/settings.component.ts`) utilise actuellement des couleurs en dur (fonds blancs `#ffffff`, bordures `#e2e8f0`, textes `#1e293b`), provoquant une rupture visuelle lorsque l'utilisateur bascule en Dark Mode. De plus, son template et ses styles sont actuellement inlinés dans le fichier TypeScript. Cette évolution permet d'adapter l'ensemble de la vue Paramètres au Dark Mode (dans la continuité de ce qui a été fait pour le Dashboard) et de restructurer le composant en fichiers séparés (HTML, CSS, TS).

## What Changes

- **Restructuration du composant en fichiers séparés** :
  - `src/components/settings/settings.component.html` (template avec syntaxe native `@if` et `@for`).
  - `src/components/settings/settings.component.css` (styles dédiés avec tokens Dark Mode).
  - `src/components/settings/settings.component.ts` (composant épuré).
- **Adaptation Dark Mode de l'ensemble des sections** :
  - En-tête avec barre de recherche et bouton d'action.
  - Tableau des paramètres (clés, valeurs de prévisualisation, badges de scopes et tags de types de données).
  - Section Outils & Bookmarklets (cartes d'outils, visualiseur de code avec coloration syntaxique Highlight.js adaptée au Dark Mode).
  - Section Guide FAQ dépliable (étapes numérotées, blocs de code, conteneurs de médias).
  - Modale de création / édition de paramètre (formulaires, inputs, textareas, sélecteurs).

## Capabilities

### New Capabilities
<!-- Aucune nouvelle capability de premier niveau requise -->

### Modified Capabilities
- `theme-management`: Extension des exigences du mode sombre pour couvrir la vue Paramètres, la section Outils/Bookmarklets et la modale d'édition de paramètre.

## Impact

- **Composant Paramètres** :
  - `src/components/settings/settings.component.html`
  - `src/components/settings/settings.component.css`
  - `src/components/settings/settings.component.ts`
- **Règles architecturales** : Respect de la structure séparée HTML/CSS/TS et de la syntaxe de contrôle de flux native d'Angular.
