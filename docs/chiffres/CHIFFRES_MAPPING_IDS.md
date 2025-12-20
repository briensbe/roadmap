## IMPORTANT: Mapping des ID Projet et Service

### Structure actuelle vs nouvelle structure

#### Avant (Structure existante)
- La table `projets` a une colonne `id` (UUID) et une colonne `code_projet` (string)
- La table `services` a une colonne `id` (UUID)

#### Après (Avec la table chiffres)
- La table `projets` a maintenant une colonne `id_projet` (INTEGER) en addition à `id` (UUID)
- La table `services` a maintenant une colonne `id_service` (INTEGER) en addition à `id` (UUID)

### Adaptation nécessaire

Pour utiliser la modal ChiffresModalComponent correctement, vous devez vous assurer que:

1. **La colonne `id_projet` est populée** dans votre base de données pour chaque projet
2. **La colonne `id_service` est populée** dans votre base de données pour chaque service

### Exemple de requête de migration pour remplir les IDs

```sql
-- Pour chaque projet, assigner un id_projet unique
UPDATE projets 
SET id_projet = ROW_NUMBER() OVER (ORDER BY created_at) 
WHERE id_projet IS NULL;

-- Pour chaque service, assigner un id_service unique  
UPDATE services 
SET id_service = ROW_NUMBER() OVER (ORDER BY created_at)
WHERE id_service IS NULL;
```

### Adapter le composant parent

Quand vous ouvrez la modale, vous devez passer l'`id_projet` (numérique) et non l'`id` (UUID):

```typescript
async openChiffresModal(projetId: string) {
  // Récupérez d'abord le projet pour obtenir son id_projet
  const projet = await this.projetService.getProjet(projetId);
  if (projet && projet.id_projet) {
    this.selectedProjetId = projet.id_projet;
    this.showChiffresModal = true;
  }
}
```

### Ou adapter votre requête Supabase

Si vous chargez les projets avec les chiffres, assurez-vous que la jointure fonctionne correctement:

```typescript
// Exemple: obtenir projets avec leurs chiffres associés
const { data: projetsAvecChiffres } = await this.supabase.client
  .from('projets')
  .select(`
    id,
    id_projet,
    nom_projet,
    code_projet,
    chiffres (
      id_chiffres,
      id_service,
      initial,
      revise,
      previsionnel,
      consomme,
      date_mise_a_jour
    )
  `);
```

## Relation avec la table charges

La table `charges` a une structure légèrement différente:
- Elle utilise `projet_id` (pas `id_projet`) qui référence l'UUID du projet
- Elle utilise `service_id` (pas `id_service`) qui pourrait référencer différentes choses selon votre schema

Pour que le calcul du RAF fonctionne correctement, vous devez adapter la requête dans `ChiffresService.getRAFByDate()` selon votre structure réelle.

## Alternative: Utiliser des UUIDs

Si vous préférez ne pas ajouter les colonnes `id_projet` et `id_service`, vous pouvez:

1. Adapter la migration SQL pour utiliser les UUID existantes
2. Modifier `ChiffresService` et `ChiffresModalComponent` pour utiliser les UUID

Cela nécessiterait plus de changements mais éviterait les migrations de colonnes supplémentaires.
