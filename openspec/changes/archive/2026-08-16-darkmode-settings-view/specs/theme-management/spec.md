## ADDED Requirements

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
