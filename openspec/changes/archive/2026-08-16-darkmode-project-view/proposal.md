## Why

La vue de gestion des projets (`projects-view`) et ses modales associées (`project-modal`, `chiffres-modal`, `confirm-modal`) utilisent actuellement des styles et couleurs en dur (fonds blancs `#ffffff`, bordures et textes statiques), provoquant des ruptures visuelles majeures lorsque l'utilisateur active le Dark Mode. Cette évolution permet d'harmoniser l'expérience utilisateur avec les vues déjà migrées (`profile`, `dashboard`) et de mutualiser les briques d'UI réutilisables (badges, menus déroulants, sélecteurs de vue, modales) directement dans `global_styles.css`.

## What Changes

- **Mutualisation des composants d'UI dans `global_styles.css`** :
  - Centralisation des styles Dark Mode pour `.status-badge`, `.dropdown-menu`, `.view-toggle`, `.table-wrapper` et le squelette standard des modales.
- **Adaptation de la vue Projets (`projects-view.component`)** :
  - Consommation des design tokens (`var(--bg-app)`, `var(--bg-card)`, `var(--text-main)`, etc.) pour les vues Cartes, Liste et Tableau.
  - Nettoyage des styles inline et migration complète vers la syntaxe native Angular (`@if` et `@for`).
- **Adaptation des modales filles** :
  - `project-modal` : intégration des tokens pour les formulaires, sélecteur de couleur et suggestions de projets similaires.
  - `chiffres-modal` : intégration des tokens pour la grille d'édition des chiffres et la synthèse budgétaire.
  - `confirm-modal` : restructuration propre en fichiers séparés (HTML, CSS, TS) et application des styles thématiques.

## Capabilities

### New Capabilities
<!-- Aucune nouvelle capability requise -->

### Modified Capabilities
- `theme-management`: Extension des exigences du mode sombre pour couvrir la vue Projets, les modales filles et le socle de composants d'UI mutualisés.

## Impact

- **Fichiers de style globaux** : `src/global_styles.css`
- **Composants Projets** : `src/components/projects/projects-view.component.{html,css,ts}`
- **Modales** :
  - `src/components/project-modal.component.{html,css,ts}`
  - `src/components/chiffres/chiffres-modal.component.{html,css,ts}`
  - `src/components/confirm-modal.component.{html,css,ts}`
- **Règles architecturales** : Respect strict du contrôle de flux natif `@if`/`@for` et de la séparation HTML/CSS/TS.
