## Context

Les composants `guide.component.ts`, `organization-view.component.ts` et `resource-manager.component.ts` gèrent respectivement la documentation utilisateur, la structure hiérarchique de l'entreprise (Sociétés, Départements, Services, Équipes) et la gestion des personnes et rôles. Leurs templates et styles sont actuellement inlinés avec des palettes claires en dur.

## Goals / Non-Goals

**Goals:**
- Restructurer les 3 composants en fichiers séparés `.html`, `.css` et `.ts`.
- Appliquer les variables de design sémantiques (`var(--bg-app)`, `var(--bg-card)`, `var(--bg-surface)`, `var(--bg-muted)`, `var(--text-main)`, `var(--text-secondary)`, `var(--border-default)`, etc.) sur l'ensemble de leurs éléments.
- Adapter les styles de documentation Markdown (`:host ::ng-deep ...`) dans le composant Guide.
- Harmoniser les boutons d'action avec les règles transverses définies dans `global_styles.css`.
- Remplacer toute utilisation éventuelle de directives obsolètes par `@if` / `@for`.

**Non-Goals:**
- Modifier la logique métier de manipulation des entités d'organisation ou de ressources.
- Modifier le contenu textuel de la documentation ou les modèles de données.

## Decisions

### 1. Séparation propre des composants
- `src/components/guide/` : `guide.component.html`, `guide.component.css`, `guide.component.ts`.
- `src/components/` : `organization-view.component.html`, `organization-view.component.css`, `organization-view.component.ts`.
- `src/components/` : `resource-manager.component.html`, `resource-manager.component.css`, `resource-manager.component.ts`.

### 2. Arborescence et Cartes imbriquées (Organisation)
- Utilisation de `var(--bg-card)` pour les cartes racines, `var(--bg-surface)` pour les sous-niveaux et de bordures subtiles (`var(--border-subtle)`) pour maintenir une hiérarchie visuelle claire sans surcharge.

### 3. Onglets & Listes de ressources
- Alignement du sélecteur d'onglets (Rôles / Personnes) sur le composant `.view-toggle` / `var(--color-primary)` et adaptation des badges et indicateurs de couleur.

## Risks / Trade-offs

- **[Risque] Styles Markdown dynamiques injectés via innerHTML dans Guide** → *Atténuation* : Utilisation de sélecteurs `:host ::ng-deep` avec des variables CSS sur les balises de base (`h1`, `h2`, `h3`, `p`, `blockquote`, `pre`, `code`, `table`).
