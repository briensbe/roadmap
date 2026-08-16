## Purpose

Permettre aux utilisateurs de basculer facilement entre les modes clair, sombre ou automatique (système) avec persistance locale et application fluide sans scintillement.

## Requirements

### Requirement: Sélection de la préférence de thème
Le système DOIT permettre à l'utilisateur de choisir entre trois préférences de thème : `Clair` (`light`), `Sombre` (`dark`) ou `Système / Navigateur` (`system`).

#### Scenario: Sélection du mode sombre depuis le profil
- **WHEN** l'utilisateur clique sur le bouton "Sombre" dans la page de profil
- **THEN** la classe `dark-mode` est appliquée au `body` et la préférence `dark` est enregistrée dans le `localStorage`

#### Scenario: Sélection du mode clair depuis le profil
- **WHEN** l'utilisateur clique sur le bouton "Clair" dans la page de profil
- **THEN** la classe `dark-mode` est retirée du `body` et la préférence `light` est enregistrée dans le `localStorage`

#### Scenario: Sélection du mode système depuis le profil
- **WHEN** l'utilisateur clique sur le bouton "Navigateur" (système) dans la page de profil
- **THEN** l'application applique dynamiquement le thème selon la valeur actuelle de `prefers-color-scheme` de l'OS et enregistre la préférence `system` dans le `localStorage`

### Requirement: Bascule rapide du thème depuis la navigation
Le système DOIT fournir un bouton d'action rapide dans la barre de navigation latérale pour basculer instantanément entre le mode clair et le mode sombre.

#### Scenario: Clic sur le bouton de bascule rapide en mode clair
- **WHEN** l'utilisateur clique sur le bouton toggle alors que le thème actif est clair
- **THEN** l'application bascule immédiatement en mode sombre et enregistre la préférence `dark`

#### Scenario: Clic sur le bouton de bascule rapide en mode sombre
- **WHEN** l'utilisateur clique sur le bouton toggle alors que le thème actif est sombre
- **THEN** l'application bascule immédiatement en mode clair et enregistre la préférence `light`

### Requirement: Persistance locale de la préférence
Le système DOIT sauvegarder la préférence de thème dans le `localStorage` sous la clé `roadmap_theme_preference` et restaurer cette préférence à chaque visite.

#### Scenario: Rechargement de l'application
- **WHEN** l'application est rechargée après une précédente sélection de mode sombre
- **THEN** l'application restaure la préférence enregistrée et active immédiatement le mode sombre

### Requirement: Synchronisation avec le thème du système d'exploitation
Lorsque la préférence est définie sur `system`, le système DOIT réagir en temps réel aux changements du mode de couleur du système d'exploitation.

#### Scenario: Changement du mode OS en cours d'utilisation
- **WHEN** la préférence est `system` et que le système d'exploitation bascule du mode clair au mode sombre
- **THEN** l'application applique immédiatement la classe `dark-mode` sans nécessiter de rechargement de page

### Requirement: Prévention du scintillement au chargement (Anti-FOUC (Flash Of Unstyled Content) )
Le système DOIT exécuter un script d'initialisation synchrone avant le chargement complet d'Angular pour appliquer la classe du thème au document et éviter tout flash blanc.

#### Scenario: Chargement initial avec thème sombre actif
- **WHEN** un utilisateur ayant une préférence sombre ou un OS en mode sombre ouvre l'application
- **THEN** la page s'affiche directement avec le fond sombre sans transition ni flash blanc visible

### Requirement: Adaptation de la vue Tableau de bord au mode sombre
Le système DOIT adapter les composants du tableau de bord (cartes de jalons, listes de livraisons/MEP/sprints, indicateurs de délais, graphiques et KPI) aux couleurs sémantiques sombres pour préserver la lisibilité et le confort visuel.

#### Scenario: Consultation du Dashboard en mode sombre
- **WHEN** l'utilisateur accède au tableau de bord alors que le mode sombre est actif
- **THEN** les conteneurs de cartes, badges, textes et métriques utilisent les variables de surface sombres avec un contraste WCAG AA

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

### Requirement: Adaptation de la vue Paramètres au mode sombre
Le système DOIT adapter l'ensemble de la vue Paramètres (`settings.component`), incluant le tableau de configuration, la barre de recherche, la section des outils bookmarklets, le guide d'aide et la modale d'édition, aux variables sémantiques sombres.

#### Scenario: Consultation du tableau des paramètres en mode sombre
- **WHEN** l'utilisateur consulte la liste des paramètres avec le mode sombre activé
- **THEN** la carte des paramètres utilise le fond de carte sombre (`--bg-card`), les en-têtes de tableau utilisent `--bg-muted`, les lignes survolées utilisent `--bg-hover` et les badges de type/scope conservent un contraste lisible

#### Scenario: Consultation de la section Outils et du visualiseur de code en mode sombre
- **WHEN** l'utilisateur déplie le visualiseur de code de l'extracteur Jira en mode sombre
- **THEN** le conteneur de code utilise un fond sombre (`--bg-app`), l'en-tête de code et le bouton de copie utilisent les tokens de surface, et la coloration syntaxique Highlight.js s'affiche avec une palette sombre adaptée

#### Scenario: Consultation du guide FAQ en mode sombre
- **WHEN** l'utilisateur consulte les étapes du guide d'utilisation en mode sombre
- **THEN** les cartes d'étapes utilisent `--bg-surface`, le texte d'explication et les balises inline de code sont lisibles et les conteneurs de médias s'intègrent sans contour blanc éblouissant

#### Scenario: Ouverture de la modale de paramètre en mode sombre
- **WHEN** l'utilisateur ouvre la modale de création ou d'édition d'un paramètre en mode sombre
- **THEN** la modale s'affiche avec un fond `--bg-surface`, un voile d'arrière-plan flouté sombre, et les champs de formulaire (inputs, select, textarea) utilisent `--bg-input` avec bordures contrastées
