# Standards de Développement Frontend (Angular & TypeScript)

## Composants & Architecture
- Angular avec composants autonomes obligatoires (`standalone: true`).
- Toujours utiliser la structure séparée en 3 fichiers pour les composants : `.html`, `.css` et `.ts`.

## Syntaxe & Typage
- Utiliser exclusivement la nouvelle syntaxe de contrôle de flux native d''Angular (blocs `@if`, `@for`, `@switch`) à la place des anciennes directives structurelles (`*ngIf`, `*ngFor`, `*ngSwitch`).
- Typages stricts obligatoires (`strict: true`, aucun `any` non justifié).
