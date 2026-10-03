# ADR 0004: Séparation du Layout Applicatif Authentifié et Initialisation Globale du Thème

- **Statut** : Accepté
- **Date** : 2026-10-03
- **Auteurs** : Antigravity & Équipe Roadmap

## Contexte

Dans Roadmap, le composant racine `App` incluait directement la barre de navigation latérale et le conteneur `.main-content` avec une marge fixe à gauche de 256px.
Cela impactait négativement l'expérience utilisateur :
1. Sur les pages publiques non authentifiées (`/login`, `/signup`, `/forgot-password`, `/reset-password`), la barre latérale était chargée dans le DOM et le formulaire d'authentification subissait un décalage de marge.
2. L'initialisation de `ThemeService` devait être garantie de manière systématique au bootstrap d'Angular.

## Décisions

1. **Architecture par `MainLayoutComponent`** :
   - Création de `MainLayoutComponent` sous `src/components/layout/main-layout/` regroupant `<app-sidebar-navigation>`, `<main class="main-content">`, `<router-outlet>` et `<app-release-notes>`.
   - Simplification du composant racine `App` au simple `<router-outlet>` racine, au conteneur de toasts et à l'easter egg.
2. **Restructuration du routage** :
   - Association de `MainLayoutComponent` à la route parente protégée par `AuthGuard` dans `src/app.routes.ts`.
   - Maintien des routes d'authentification au niveau racine du routeur.
3. **Initialisation globale du thème** :
   - Utilisation de `provideAppInitializer(() => inject(ThemeService))` au bootstrap de l'application.

## Conséquences

- **Positives** :
  - Pages d'authentification complètement indépendantes du layout applicatif, sans menu ni décalage de marge.
  - Découplage propre entre le conteneur racine de l'application et les zones protégées.
  - Initialisation fiable et déterministe du thème sur l'ensemble des routes.
