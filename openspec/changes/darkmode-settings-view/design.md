## Context

Le composant `settings.component.ts` est actuellement un fichier monolithique de près de 1300 lignes qui contient son template HTML et ses styles CSS inlinés. Comme pour le Dashboard et la vue Projets, l'objectif est d'aligner ce composant sur le système de design Dark Mode de `global_styles.css` tout en appliquant la règle d'architecture obligatoire du projet (fichiers séparés HTML, CSS et TS).

## Goals / Non-Goals

**Goals:**
- Extraire `settings.component.html` et `settings.component.css` pour séparer proprement la structure, le style et la logique du composant `settings.component.ts`.
- Adapter toutes les sections au Dark Mode en s'inspirant des tokens utilisés dans `dashboard.component.css` (`var(--bg-app)`, `var(--bg-card)`, `var(--bg-muted)`, `var(--text-main)`, etc.).
- Intégrer une palette sombre pour la coloration syntaxique Highlight.js dans le visualiseur de code.
- Adapter les badges (`.scope-badge`, `.type-tag`) avec des fonds translucides (`rgba(...)`) pour un rendu harmonieux en mode sombre.
- Utiliser exclusivement la nouvelle syntaxe native Angular `@if` et `@for`.

**Non-Goals:**
- Modifier la logique métier des requêtes de configuration (`SettingsService`).
- Modifier le script du bookmarklet Jira ou le comportement d'exécution.

## Decisions

### 1. Séparation HTML / CSS / TS
- **Décision** : Créer `settings.component.html` et `settings.component.css`.
- **Raison** : Règle stricte du projet et amélioration notable de la lisibilité et de la maintenabilité.

### 2. Adaptation de la coloration syntaxique (Highlight.js)
- **Décision** : Ajouter des sélecteurs `body.dark-mode .hljs-*` avec des teintes vives et douces (cyan, rose pastel, jaune ambre, vert menthe) sur fond sombre.
- **Raison** : Les styles Atom One Light d'origine sont illisibles sur fond sombre.

### 3. Badges translucides pour les scopes et types
- **Décision** : Définir des fonds `rgba(...)` avec des textes éclatants pour les types (`string`, `number`, `boolean`, `json`) et pour les scopes (`global`, `user`) en Dark Mode.
- **Raison** : Cohérence avec les badges de statut de `dashboard` et `projects-view`.

## Risks / Trade-offs

- **[Risque] Animations Angular (@slideInOut)** → *Atténuation* : Conserver les triggers d'animations dans le fichier `.ts` tout en liant le template et le style externe.
