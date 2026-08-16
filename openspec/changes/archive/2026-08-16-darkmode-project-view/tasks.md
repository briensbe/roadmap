## 1. Mutualisation du socle d'UI (global_styles.css)

- [x] 1.1 Ajouter les styles et variantes Dark Mode pour les badges de statut (`.status-badge`)
- [x] 1.2 Ajouter les classes mutualisées pour les menus déroulants (`.dropdown-menu`, `.dropdown-item`, `.dropdown-header`)
- [x] 1.3 Ajouter les classes mutualisées pour le sélecteur de vue (`.view-toggle`, `.toggle-btn`)
- [x] 1.4 Mutualiser les styles de base pour les modales (`.modal-overlay`, `.modal`, `.modal-header`, `.modal-close`) et tableaux


## 2. Refactoring et adaptation de projects-view

- [x] 2.1 Nettoyer `projects-view.component.html` en supprimant les styles inline et en migrant vers `@if` et `@for`
- [x] 2.2 Alléger et adapter `projects-view.component.css` en consommant les design tokens (`--bg-card`, `--text-main`, etc.)
- [x] 2.3 Vérifier le contraste et l'alignement des vues Cartes, Liste et Tableau en Dark Mode


## 3. Adaptation des modales de gestion de projet

- [x] 3.1 Restructurer `confirm-modal.component` en fichiers distincts (`confirm-modal.component.html`, `confirm-modal.component.css`, `confirm-modal.component.ts`) avec syntaxe native `@if` et tokens Dark Mode
- [x] 3.2 Adapter `project-modal.component.html` et `project-modal.component.css` au Dark Mode (formulaires, color picker, projets similaires) avec `@if`/`@for`
- [x] 3.3 Adapter `chiffres-modal.component.html` et `chiffres-modal.component.css` au Dark Mode (tableau de chiffrage, synthèse, inputs) avec `@if`/`@for`


## 4. Validation et Contrôle Qualité

- [x] 4.1 Valider le build TypeScript / Angular sans erreur
- [x] 4.2 Tester la bascule dynamique Clair / Sombre sur l'écran des projets et l'ensemble des modales

