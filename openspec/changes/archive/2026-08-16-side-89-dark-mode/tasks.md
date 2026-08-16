## 1. Socle CSS & Anti-FOUC

- [x] 1.1 Définir le système de variables CSS sémantiques dans `src/global_styles.css` pour `:root` et `body.dark-mode` (fonds, textes, bordures, ombres, inputs, modales).
- [x] 1.2 Mettre à jour les styles génériques dans `src/global_styles.css` (`body`, `button`, `input`, `.card`, `.modal`, `.selection-toolbar`) pour consommer les tokens CSS `var(...)`.
- [x] 1.3 Ajouter le script synchrone anti-scintillement (anti-FOUC) dans le `<head>` de `src/index.html` pour initialiser la classe `dark-mode` avant le bootstrap d'Angular.

## 2. Service de Thème Angular (ThemeService)

- [x] 2.1 Créer `src/services/theme.service.ts` avec la gestion de l'état basée sur les Angular Signals (`preference`, `effectiveTheme`).
- [x] 2.2 Implémenter l'écouteur `window.matchMedia('(prefers-color-scheme: dark)')` pour la réactivité au changement de thème de l'OS.
- [x] 2.3 Implémenter la persistance de la préférence dans `localStorage` sous la clé `roadmap_theme_preference`.
- [x] 2.4 Implémenter les méthodes `toggleTheme()` (bascule rapide) et `setPreference(pref)` (choix explicite).

## 3. Contrôles Utilisateur (Sidebar & Profil)

- [x] 3.1 Intégrer le bouton de bascule rapide (toggle Soleil / Lune avec icônes Lucide) dans `src/components/sidebar-navigation.component.ts`.
- [x] 3.2 Réactiver et mettre à jour le sélecteur à 3 modes (Clair / Sombre / Système) dans `src/auth/profile/profile.component.ts`, `profile.component.html` et `profile.component.css`.

## 4. Harmonisation du Layout & Composants Transverses

- [x] 4.1 Adapter les styles de `src/main.ts` et `src/components/sidebar-navigation.component.ts` pour utiliser les variables CSS de surface, texte et bordures.
- [x] 4.2 Adapter les composants d'authentification (`Login`, `Signup`, `ForgotPassword`, `UpdatePassword`) pour consommer les variables de thème au lieu des anciens sélecteurs `:host-context`.
- [x] 4.3 Adapter `ToastContainerComponent` et les modales partagées pour un affichage contrasté en mode sombre.

## 5. Validation & Tests Initiaux

- [x] 5.1 Valider le basculement dynamique et la persistance lors d'un rechargement complet de page.
- [x] 5.2 Valider l'absence de flash blanc au rechargement initial.
- [x] 5.3 Exécuter `ng lint` et `pnpm run build` pour s'assurer de l'intégrité du code TypeScript et des styles.

## 6. Vue Dashboard

- [x] 6.1 Adapter `src/components/dashboard/dashboard.component.css` pour utiliser les tokens CSS (`--bg-app`, `--bg-card`, `--text-main`, `--text-secondary`, `--border-subtle`, `--bg-hover`, etc.).
- [x] 6.2 Vérifier la lisibilité et le contraste des cartes de jalons (Livraisons, MEP, Sprints), des badges et des jauges en mode sombre.
- [x] 6.3 Valider la compilation via `pnpm run build` et `ng lint`.
