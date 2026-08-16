## ADDED Requirements

### Requirement: Adaptation de la vue Guide Utilisateur au mode sombre
Le système DOIT adapter la page du Guide Utilisateur (`guide.component`), incluant le conteneur de documentation, le rendu HTML issu du Markdown (titres, paragraphes, code, tableaux, blocs de citations), aux variables sémantiques sombres.

#### Scenario: Consultation de la documentation en mode sombre
- **WHEN** l'utilisateur accède à la page Guide alors que le mode sombre est activé
- **THEN** le conteneur principal utilise le fond de carte sombre (`--bg-card`), les textes utilisent `--text-main` et `--text-secondary`, et les séparateurs utilisent `--border-subtle` sans éblouissement

### Requirement: Adaptation de la vue Organisation au mode sombre
Le système DOIT adapter l'ensemble de la vue Organisation (`organization-view.component`), incluant le menu d'ajout déroulant, les compteurs statistiques (Sociétés, Départements, Services, Équipes), l'arborescence hiérarchique dépliable et la modale d'édition d'entité, au mode sombre.

#### Scenario: Consultation de l'arborescence organisationnelle en mode sombre
- **WHEN** l'utilisateur consulte l'arborescence de l'organisation en mode sombre
- **THEN** les nœuds de l'arborescence utilisent `--bg-card` ou `--bg-surface`, les niveaux hiérarchiques imbriqués restent clairement délimités par `--border-subtle` et les boutons d'actions contextuels s'intègrent harmonieusement

#### Scenario: Ouverture de la modale de création d'entité en mode sombre
- **WHEN** l'utilisateur ouvre la modale d'ajout ou d'édition d'une société, département, service ou équipe en mode sombre
- **THEN** la modale s'affiche avec le fond de surface sombre (`--bg-surface`), les sélecteurs et champs de saisie utilisent `--bg-input` avec un contour de focus contrasté

### Requirement: Adaptation de la vue Ressources au mode sombre
Le système DOIT adapter l'ensemble de la vue Gestion des Ressources (`resource-manager.component`), incluant la barre de recherche, la bascule d'onglets (Rôles / Personnes), les cartes de ressources et la modale de saisie, au mode sombre.

#### Scenario: Consultation des listes de rôles et personnes en mode sombre
- **WHEN** l'utilisateur consulte l'onglet Rôles ou Personnes en mode sombre
- **THEN** les onglets actifs et inactifs utilisent les couleurs sémantiques adaptées, les cartes de ressources utilisent `--bg-card` et les indicateurs colorés restent bien visibles

#### Scenario: Édition d'une ressource en mode sombre
- **WHEN** l'utilisateur ouvre la modale de création ou d'édition d'un rôle ou d'une personne en mode sombre
- **THEN** la modale utilise `--bg-surface`, le sélecteur de couleur et les formulaires consomment les variables d'input sombres
