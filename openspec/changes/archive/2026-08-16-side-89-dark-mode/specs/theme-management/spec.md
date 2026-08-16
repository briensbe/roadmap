## Purpose

Permettre aux utilisateurs de basculer facilement entre les modes clair, sombre ou automatique (système) avec persistance locale et application fluide sans scintillement.

## ADDED Requirements

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

### Requirement: Prévention du scintillement au chargement (Anti-FOUC)
Le système DOIT exécuter un script d'initialisation synchrone avant le chargement complet d'Angular pour appliquer la classe du thème au document et éviter tout flash blanc.

#### Scenario: Chargement initial avec thème sombre actif
- **WHEN** un utilisateur ayant une préférence sombre ou un OS en mode sombre ouvre l'application
- **THEN** la page s'affiche directement avec le fond sombre sans transition ni flash blanc visible

### Requirement: Adaptation de la vue Tableau de bord au mode sombre
Le système DOIT adapter les composants du tableau de bord (cartes de jalons, listes de livraisons/MEP/sprints, indicateurs de délais, graphiques et KPI) aux couleurs sémantiques sombres pour préserver la lisibilité et le confort visuel.

#### Scenario: Consultation du Dashboard en mode sombre
- **WHEN** l'utilisateur accède au tableau de bord alors que le mode sombre est actif
- **THEN** les conteneurs de cartes, badges, textes et métriques utilisent les variables de surface sombres avec un contraste WCAG AA
