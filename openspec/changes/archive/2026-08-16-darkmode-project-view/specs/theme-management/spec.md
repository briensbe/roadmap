## ADDED Requirements

### Requirement: Socle de composants d'UI thématiques et mutualisés
Le système DOIT fournir un ensemble de classes CSS et tokens sémantiques mutualisés dans les styles globaux pour standardiser l'apparence des composants récurrents (badges de statut, menus déroulants, sélecteurs de vue, modales et tableaux) en modes clair et sombre.

#### Scenario: Affichage des badges de statut en mode sombre
- **WHEN** le mode sombre est actif et qu'un badge de statut (`Actif`, `En cours`, `Planifié`, `Terminé`, `En pause`) est rendu
- **THEN** le badge utilise un fond translucide adapté et un texte contrasté conforme aux normes d'accessibilité sans éblouissement

#### Scenario: Affichage des menus déroulants en mode sombre
- **WHEN** l'utilisateur ouvre un menu déroulant ou un filtre contextuel en mode sombre
- **THEN** le conteneur du menu s'affiche avec le fond de surface sombre, une bordure subtile et les éléments survolés utilisent la couleur de survol du thème

#### Scenario: Affichage du sélecteur de bascule de vue en mode sombre
- **WHEN** le sélecteur de mode de vue est affiché en mode sombre
- **THEN** le conteneur et les boutons inactifs utilisent les couleurs de surface sombres et le bouton actif utilise la couleur primaire d'accentuation

### Requirement: Adaptation de la vue Projets au mode sombre
Le système DOIT adapter l'ensemble des modes d'affichage de la vue Projets (`Cartes`, `Liste`, `Tableau`), ainsi que la barre de recherche et les filtres, aux variables de thème sombres.

#### Scenario: Consultation de la vue Cartes en mode sombre
- **WHEN** l'utilisateur consulte la vue Projets en mode Cartes avec le mode sombre activé
- **THEN** les cartes de projet utilisent le fond de carte sombre (`--bg-card`), les textes principaux et secondaires restent parfaitement lisibles et la barre de progression s'intègre harmonieusement

#### Scenario: Consultation de la vue Tableau en mode sombre
- **WHEN** l'utilisateur consulte la vue Projets en mode Tableau avec le mode sombre activé
- **THEN** l'en-tête de tableau utilise le fond atténué (`--bg-muted`), les lignes utilisent le fond sombre avec un effet de survol distinct et les séparateurs de ligne restent discrets

#### Scenario: Saisie dans le champ de recherche de projet en mode sombre
- **WHEN** l'utilisateur clique et saisit du texte dans la barre de recherche de projets en mode sombre
- **THEN** le champ de saisie utilise le fond d'input sombre, le texte de saisie est clair et le contour de focus utilise la couleur d'accentuation

### Requirement: Adaptation des modales de gestion de projet au mode sombre
Le système DOIT adapter toutes les modales associées à la gestion des projets (`project-modal`, `chiffres-modal`, `confirm-modal`) au mode sombre sans rupture visuelle.

#### Scenario: Ouverture de la modale de projet en mode sombre
- **WHEN** l'utilisateur ouvre la modale de création ou d'édition d'un projet en mode sombre
- **THEN** la fenêtre modale s'affiche avec le fond de surface sombre, les champs de formulaire utilisent les couleurs d'input sombres et la section des projets similaires reste lisible

#### Scenario: Édition des chiffres dans la modale de chiffrage en mode sombre
- **WHEN** l'utilisateur ouvre la modale des chiffres en mode sombre
- **THEN** le tableau matriciel de chiffrage, les cellules de saisie, les en-têtes et les totaux calculés utilisent les couleurs du thème sombre tout en préservant le contraste des indicateurs

#### Scenario: Affichage de la modale de confirmation en mode sombre
- **WHEN** une action de confirmation (ex: suppression de projet ou confirmation d'import) est déclenchée en mode sombre
- **THEN** la carte de confirmation s'affiche sur un fond sombre avec un voile d'arrière-plan flouté et des boutons d'action clairement contrastés
