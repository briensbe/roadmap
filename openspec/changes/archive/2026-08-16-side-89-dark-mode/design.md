## Context

Voir `proposal.md` pour les motivations. L'application Roadmap Vision (Angular 20) utilise actuellement des styles CSS globaux et locaux avec des couleurs hexadécimales en dur. Quelques composants comportent d'anciens sélecteurs `:host-context(body.dark-mode)` non maintenables, et le composant Profil possède du code commenté pour la sélection de thème.

## Goals / Non-Goals

**Goals:**
- Mettre en place un système robuste et extensible de Design Tokens CSS sémantiques.
- Créer un `ThemeService` réactif basé sur les Signals Angular 20 et l'API `window.matchMedia`.
- Sauvegarder la préférence de thème localement dans `localStorage` sans dépendre d'une authentification ou de Supabase.
- Fournir un basculement rapide (icône ☀️/🌙) dans la `SidebarNavigation` et un sélecteur complet (3 options) dans la page `Profile`.
- Éliminer tout scintillement blanc au rechargement (Anti-FOUC) via un script d'initialisation synchrone dans `index.html`.
- Adapter la **vue Tableau de bord** (`DashboardComponent`) aux tokens CSS du mode sombre.

**Non-Goals:**
- Pas de persistance dans la table Supabase `profiles` pour le moment (choix explicite de stockage `localStorage` pur).
- Les vues Planification/Gantt et Capacité restent pour une étape dédiée ultérieure.

## Decisions

### 1. Variables CSS Globales vs `:host-context`
- **Décision** : Remplacer l'approche par composants `:host-context(body.dark-mode)` par des variables CSS déclarées dans `:root` et `body.dark-mode`.
- **Raison** : Les variables CSS traversent nativement les limites de l'encapsulation de vue Angular (`ViewEncapsulation.Emulated`) sans coût de performance ni duplication de code.
- **Alternatives considérées** :
  - *Sass/Mixins* : Non nécessaire, les CSS custom properties standards fonctionnent en temps réel sans recompilation.
  - *Tailwind / CSS-in-JS* : L'application utilise du Vanilla CSS structuré, les tokens CSS natifs respectent l'architecture du projet.

### 2. Gestion de l'état avec Angular Signals dans `ThemeService`
- **Décision** : Implémenter un service singleton (`providedIn: 'root'`) utilisant `signal<ThemePreference>` et un signal calculé `computed<EffectiveTheme>`.
- **Raison** : Cohérence avec Angular 20, réactivité granulaire et intégration propre dans les templates.
- **Détails de l'API** :
  - `preference: Signal<'light' | 'dark' | 'system'>`
  - `effectiveTheme: Signal<'light' | 'dark'>`
  - `toggleTheme(): void`
  - `setPreference(pref: ThemePreference): void`

### 3. Anti-FOUC (Flash Of Unstyled Content)
- **Décision** : Ajouter un script synchrone ultra-léger dans `<head>` de `index.html` qui lit `localStorage.getItem('roadmap_theme_preference')` et évalue le `prefers-color-scheme` avant le rendu du premier pixel.
- **Raison** : Évite le flash blanc éblouissant lorsque l'utilisateur recharge l'application en mode sombre.

### 4. Adaptation de la vue Dashboard
- **Décision** : Mettre à jour `src/components/dashboard/dashboard.component.css` pour utiliser les tokens `--bg-app`, `--bg-card`, `--text-main`, `--text-secondary`, `--border-subtle`, `--bg-hover`, tout en conservant les couleurs d'accentuation des types de jalons (rouge pour livraisons, bleu pour MEP, vert pour sprints) avec des fonds transparents/assombris adaptés.

## Risks / Trade-offs

- **[Contraste des badges et indicateurs de dates sur fond sombre]** → Ajuster les opacités et les couleurs de texte pour garantir un ratio WCAG AA.
