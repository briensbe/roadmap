## Why

L'application Roadmap Vision ne propose actuellement qu'un thème clair, ce qui peut causer de la fatigue visuelle lors d'utilisations prolongées ou dans des environnements à faible luminosité. L'introduction d'un mode sombre (ticket JIRA SIDE-89), géré proprement via des variables CSS sémantiques et un service réactif, répond à un besoin fort d'ergonomie, d'accessibilité visuelle et de personnalisation utilisateur.

## What Changes

- **Système de Tokens CSS sémantiques** : Définition des variables de couleurs globales dans `:root` et `body.dark-mode` pour éviter la duplication de règles CSS spécifiques dans chaque composant.
- **ThemeService réactif (Angular 20 Signals)** : Gestion centralisée de l'état du thème avec support des 3 modes (`light`, `dark`, `system`), détection dynamique des préférences de l'OS (`prefers-color-scheme`) et persistance dans `localStorage`.
- **Anti-FOUC (Flash of Unstyled Content)** : Injection d'un micro-script inline dans `index.html` pour appliquer immédiatement la bonne classe au DOM avant le rendu initial de l'application.
- **Contrôles UI dédiés** :
  - Bouton d'action rapide (toggle Soleil / Lune) accessible directement depuis la barre de navigation latérale (Sidebar).
  - Sélecteur de thème complet (Clair, Sombre, Système) sur la page Profil utilisateur.
- **Harmonisation des vues** : Adaptation des écrans transverses, authentification et de la **vue Tableau de bord** (`DashboardComponent`) aux tokens de couleurs sémantiques.

## Capabilities

### New Capabilities
- `theme-management`: Gestion de la sélection, persistance et application dynamique des thèmes d'affichage (Clair, Sombre, Système/Auto) à travers l'ensemble de l'application (Sidebar, Profil, Auth et Dashboard).

### Modified Capabilities
<!-- Aucune spécification existante modifiée -->

## Impact

- **Code affecté** :
  - `src/global_styles.css` (variables CSS & thèmes)
  - `src/index.html` (script anti-flicker)
  - `src/services/theme.service.ts` (nouveau service injectable)
  - `src/components/sidebar-navigation.component.ts` / `html` / `css` (bouton toggle rapide)
  - `src/auth/profile/profile.component.ts` / `html` / `css` (sélecteur 3 modes)
  - `src/components/dashboard/dashboard.component.css` / `html` (adaptation thème sombre)
- **Dépendances** : Utilisation des icônes Lucide (`Sun`, `Moon`, `Monitor`). Aucune dépendance externe supplémentaire.
- **Performance & Sécurité** : Stockage exclusivement local (`localStorage`), aucune requête réseau supplémentaire requise.
