# 5. Grid Interaction Controllers via Composition over Inheritance

Date: 2026-10-25

## Status

accepted

## Context

Dans la version précédente de l'application, `PlanViewComponent` héritait d'une classe abstraite monolithique `PlanGridInteractionController` (1239 lignes). Parallèlement, `CapacityViewComponent` dupliquait une grande partie de cette même logique physique d'interaction avec la grille hebdomadaire (sélection rectangulaire à la souris, détection des bordures de déplacement, timers de survol d'infobulles et calculs de position de toolbar).

Cette structure enfreignait le principe architectural du projet privilégiant la composition et l'injection de dépendances plutôt que l'héritage comportemental, et bloquait toute réutilisation propre sans couplage fort.

## Decision

Nous décidons de :
1. Remplacer définitivement l'héritage de `PlanGridInteractionController` par une injection de contrôleurs légers et focalisés (`GridSelectionController`, `HoverTooltipController`).
2. Déplacer la logique physique et pure dans un sous-domaine transverse `src/shared/grid/` :
   - `week-calendar.utils.ts` : calculs de calendrier purs testables sans TestBed.
   - `grid-selection.controller.ts` : gestion de l'état de sélection réactif en Signals.
   - `hover-tooltip.controller.ts` : gestion des délais et du positionnement des infobulles.
   - `floating-toolbar-positioner.ts` : algorithme de positionnement de la barre d'outils.
3. Déclarer ces contrôleurs au niveau des composants consommateurs via `providers: [...]` pour garantir une isolation stricte des états interactifs par instance de vue.

## Consequences

### Positive
- Respect des règles SOLID et suppression de l'héritage de composants Angular.
- Composants plus modulaires, testables unitairement de manière isolée.
- Possibilité pour `CapacityViewComponent` (lot 6) de réutiliser ces mêmes contrôleurs sans duplication.

### Negative / Trade-offs
- Légère augmentation du nombre de fichiers (`shared/grid/`).
- Nécessite d'exposer des méthodes de délégation dans le composant de façade pour préserver les bindings des templates existants.
