## 1. Vue Guide Utilisateur (`src/components/guide/`)

- [ ] 1.1 Séparer le composant en `guide.component.html`, `guide.component.css` et mettre à jour `guide.component.ts`
- [ ] 1.2 Adapter les styles de documentation et du rendu Markdown au Dark Mode dans `guide.component.css`

## 2. Vue Organisation (`src/components/organization-view`)

- [ ] 2.1 Extraire le template vers `organization-view.component.html` avec syntaxe native `@if` / `@for`
- [ ] 2.2 Extraire et adapter les styles dans `organization-view.component.css` (en-tête, dropdown, compteurs stats, arbre hiérarchique, modale)
- [ ] 2.3 Mettre à jour `organization-view.component.ts` pour utiliser `templateUrl` et `styleUrl`

## 3. Vue Gestion des Ressources (`src/components/resource-manager`)

- [ ] 3.1 Extraire le template vers `resource-manager.component.html` avec syntaxe native `@if` / `@for`
- [ ] 3.2 Extraire et adapter les styles dans `resource-manager.component.css` (recherche, onglets, cartes de ressources, modale)
- [ ] 3.3 Mettre à jour `resource-manager.component.ts` pour utiliser `templateUrl` et `styleUrl`

## 4. Validation et Contrôle Qualité

- [ ] 4.1 Valider la compilation `npm run build` sans erreur
- [ ] 4.2 Vérifier la cohérence visuelle des 3 vues en mode clair et sombre
