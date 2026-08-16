## Context

L'application Roadmap Vision utilise un système de thèmes piloté par une classe globale `body.dark-mode` et des variables CSS définies dans `src/global_styles.css`. Alors que les pages `profile` et `dashboard` s'appuient sur ces variables sémantiques, le composant `projects-view` et ses modales filles (`project-modal`, `chiffres-modal`, `confirm-modal`) comportent encore de nombreuses couleurs en dur (hex/rgb), des styles inline et du code dupliqué.

## Goals / Non-Goals

**Goals:**
- Mutualiser les composants d'UI récurrents dans `global_styles.css` (`.status-badge`, `.dropdown-menu`, `.view-toggle`, `.table-wrapper`, `.modal-overlay`, `.modal`).
- Rendre la vue `projects-view` 100% compatible Dark Mode sans régression visuelle en mode clair.
- Adapter les 3 modales filles (`project-modal`, `chiffres-modal`, `confirm-modal`) au Dark Mode.
- Refactorer `confirm-modal.component.ts` en séparant template et styles (`.html`, `.css`, `.ts`) conformément aux règles d'architecture du projet.
- Migrer l'intégralité des templates concernés vers le contrôle de flux natif Angular (`@if`, `@for`).

**Non-Goals:**
- Modifier la logique métier de calcul des rangs (LexoRank) ou les requêtes TanStack Query.
- Ajouter de nouveaux types de statuts ou champs de métadonnées de projet.
- Modifier le comportement fonctionnel de l'import/export Excel.

## Decisions

### 1. Centralisation des composants transverses dans `global_styles.css`
- **Décision** : Extraire les classes de badges (`.status-badge`), menus déroulants (`.dropdown-menu`), bascules de vue (`.view-toggle`) et tableaux (`.projects-table`) dans `global_styles.css`.
- **Raison** : Évite la duplication de centaines de lignes de CSS entre composants et garantit une cohérence visuelle immédiate pour toute nouvelle vue.
- **Alternative considérée** : Créer un fichier SCSS partagé ou dupliquer les règles dans chaque composant. Rejeté car le projet utilise Vanilla CSS et privilégie un fichier de tokens global.

### 2. Adaptation des badges de statut en Dark Mode
- **Décision** : En mode sombre, utiliser des fonds avec opacité (`rgba(...)`) et des textes clairs contrastés (ex: `rgba(16, 185, 129, 0.2)` et `#34d399` pour le statut Actif).
- **Raison** : Les fonds pastel opaques du mode clair créent un éblouissement agressif sur fond sombre (`#1e293b`).

### 3. Restructuration de `confirm-modal`
- **Décision** : Extraire le template et les styles inline de `src/components/confirm-modal.component.ts` vers `confirm-modal.component.html` et `confirm-modal.component.css`.
- **Raison** : Respect strict de la règle du projet : *"toujours utiliser la structure séparée html, CSS et ts"*.

## Risks / Trade-offs

- **[Risque] Spécificité CSS lors de la mutualisation** → *Atténuation* : S'assurer que les classes globales dans `global_styles.css` utilisent des sélecteurs simples sans écraser involontairement les règles locales spécifiques.
- **[Risque] Lisibilité des couleurs personnalisées de projet (`projet.color`)** → *Atténuation* : Conserver l'indicateur de couleur sur la bordure gauche et le point indicateur sans forcer la couleur de fond des cartes.
