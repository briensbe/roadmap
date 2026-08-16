## Why

Les vues annexes suivantes utilisent actuellement des styles codés en dur (fonds blancs `#ffffff`, bordures `#e5e7eb`, textes foncés) et leurs templates et styles sont inlinés dans les fichiers `.ts` :
1. **Guide Utilisateur** (`src/components/guide/guide.component.ts`)
2. **Organisation** (`src/components/organization-view.component.ts`)
3. **Gestion des Ressources** (`src/components/resource-manager.component.ts`)

Cette proposition vise à étendre le Dark Mode à l'ensemble de ces 3 vues de manière cohérente avec le reste de l'application (Dashboard, Projets, Paramètres) et à restructurer leurs composants en fichiers séparés HTML / CSS / TS conformément aux règles du projet.

## What Changes

- **1. Vue Guide Utilisateur (`src/components/guide/`)** :
  - Séparation en `guide.component.html`, `guide.component.css`, `guide.component.ts`.
  - Adaptation du conteneur de documentation, des titres, citations, tableaux et styles markdown au Dark Mode.
- **2. Vue Organisation (`src/components/organization/` ou `organization-view.*`)** :
  - Séparation en `organization-view.component.html`, `organization-view.component.css`, `organization-view.component.ts`.
  - Adaptation de l'en-tête, du sélecteur d'ajout d'entité (Société, Département, Service, Équipe), des cartes statistiques, de l'arbre hiérarchique dépliable et de la modale de création / édition.
- **3. Vue Ressources (`src/components/resources/` ou `resource-manager.*`)** :
  - Séparation en `resource-manager.component.html`, `resource-manager.component.css`, `resource-manager.component.ts`.
  - Adaptation de la barre de recherche, des onglets (Rôles / Personnes), des cartes de ressources, des sélecteurs de couleur et de la modale d'édition.

## Capabilities

### Modified Capabilities
- `theme-management`: Extension du Dark Mode aux vues d'administration et d'organisation (`guide`, `organisation`, `ressources`).

## Impact

- `src/components/guide/guide.component.*`
- `src/components/organization-view.component.*`
- `src/components/resource-manager.component.*`
- Respect des règles de contrôle de flux natif Angular (`@if`, `@for`) et de séparation de code.
