# Modal Chiffres - Guide d'Utilisation

## Vue d'ensemble
Le composant modal `ChiffresModalComponent` permet de gérer les chiffres budgétaires par service pour un projet. Il offre des opérations CRUD complètes et des champs calculés automatiques.

## Fichiers créés

1. **src/models/chiffres.type.ts** - Interfaces TypeScript pour les chiffres
2. **src/services/chiffres.service.ts** - Service pour gérer les opérations CRUD
3. **src/components/chiffres-modal.component.ts** - Composant modal
4. **src/components/chiffres-modal.component.html** - Template HTML
5. **src/components/chiffres-modal.component.css** - Styles CSS

## Installation et utilisation

### 1. Ajouter le composant dans votre composant parent

```typescript
import { ChiffresModalComponent } from './components/chiffres-modal.component';

@Component({
  selector: 'app-projects-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent],
  // ...
})
export class ProjectsViewComponent {
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  openChiffresModal(projetId: number) {
    this.selectedProjetId = projetId;
    this.showChiffresModal = true;
  }

  onChiffresModalClose() {
    this.showChiffresModal = false;
    this.selectedProjetId = null;
  }

  onChiffresModalSaved(chiffres: any[]) {
    console.log('Chiffres sauvegardés:', chiffres);
    // Rafraîchir les données si nécessaire
  }
}
```

### 2. Ajouter le template dans votre composant parent

```html
<!-- Bouton pour ouvrir la modale -->
<button (click)="openChiffresModal(projet.id_projet)">
  Gérer les chiffres
</button>

<!-- Modal -->
<app-chiffres-modal 
  [visible]="showChiffresModal"
  [idProjet]="selectedProjetId"
  (close)="onChiffresModalClose()"
  (saved)="onChiffresModalSaved($event)">
</app-chiffres-modal>
```

### 3. Utilisation directe depuis un service (exemple)

```typescript
// Dans votre composant parent
constructor(private projetService: ProjetService) {}

async viewChiffres(projetId: number) {
  const projet = await this.projetService.getProjet(projetId.toString());
  // Ouvrir la modale avec le projetId
}
```

## Fonctionnalités

### Champs modifiables
- **Initial**: Chiffrage initial du projet
- **Révisé**: Chiffrage révisé
- **Prévisionnel**: Chiffrage prévisionnel
- **Consommé**: Ressources/temps déjà consommés
- **Date de mise à jour**: Date de dernière modification

### Champs calculés (lecture seule)
- **Delta**: Prévisionnel - Révisé
- **Restant**: Prévisionnel - Consommé
- **RAF**: Ressources affectées à partir de la date sélectionnée

### Fonctionnalités spéciales

#### 1. Sélection de date pour RAF
Sélectionnez une date pour calculer automatiquement le RAF (Ressources Affectées à partir de cette date).

#### 2. Copier-coller Excel
Vous pouvez copier des cellules directement depuis Excel et les coller dans la modale:
- Sélectionnez les cellules dans Excel (ex: Initial, Révisé, Prévisionnel, Consommé pour plusieurs services)
- Copiez (Ctrl+C)
- Cliquez sur le champ Initial du premier service
- Collez (Ctrl+V)
- Les valeurs seront remplies automatiquement pour les services suivants

#### 3. Totaux automatiques
Les totaux de chaque colonne sont calculés automatiquement en bas du tableau.

## Opérations CRUD

### Create
Saisissez les valeurs dans les champs et cliquez sur "Enregistrer". Si le chiffre n'existe pas, il sera créé.

### Read
Les chiffres existants sont automatiquement chargés depuis la base de données lors de l'ouverture de la modale.

### Update
Modifiez les valeurs et cliquez sur "Enregistrer" pour mettre à jour.

### Delete
Actuellement, la suppression se fait via la modale chiffres-modal en vidant tous les champs et en enregistrant.
Pour une suppression complète, vous pouvez utiliser directement le service:

```typescript
constructor(private chiffresService: ChiffresService) {}

async deleteChiffre(idChiffres: number) {
  await this.chiffresService.deleteChiffre(idChiffres);
}
```

## API du Service ChiffresService

```typescript
// Récupérer tous les chiffres
getAllChiffres(): Promise<Chiffre[]>

// Récupérer les chiffres d'un projet
getChiffresByProject(idProjet: number): Promise<Chiffre[]>

// Récupérer un chiffre spécifique
getChiffre(idProjet: number, idService: number): Promise<Chiffre | null>

// Créer un nouveau chiffre
createChiffre(chiffre: Chiffre): Promise<Chiffre>

// Mettre à jour un chiffre
updateChiffre(idChiffres: number, chiffre: Partial<Chiffre>): Promise<Chiffre>

// Supprimer un chiffre
deleteChiffre(idChiffres: number): Promise<void>

// Calculer le RAF pour une date donnée
getRAFByDate(idProjet: number, idService: number, fromDate: string): Promise<number>
```

## Notes technique

### Relation entre Chiffres et Charges
- La table `chiffres` contient `id_projet` et `id_service`
- La table `charges` contient `projet_id` et `service_id` (ou associations via équipes)
- Le RAF est calculé en sommant les `unite_ressource` des charges postérieures à la date sélectionnée

### Cache
Le service utilise un cache simple pour améliorer les performances. Le cache est invalidé après chaque opération CRUD.

### Validation
- Les champs numériques acceptent les décimales avec jusqu'à 3 décimales
- Les dates sont au format ISO (YYYY-MM-DD)
- Les opérations récursives sur DELETE CASCADE sont gérées au niveau de la base de données

## Customization

### Ajouter des colonnes supplémentaires
1. Mettez à jour la migration SQL Supabase
2. Ajoutez les propriétés à l'interface `Chiffre` dans `chiffres.type.ts`
3. Mettez à jour le template HTML avec les nouveaux champs
4. Mettez à jour le service avec la logique CRUD appropriée

### Modifier les styles
Editez `chiffres-modal.component.css` pour personnaliser l'apparence.

### Ajouter des validations
Ajoutez des validations personnalisées dans la méthode `save()` du composant.

## Troubleshooting

### La modale ne s'affiche pas
- Vérifiez que `[visible]` est à `true`
- Vérifiez que `[idProjet]` est défini correctement
- Vérifiez les erreurs en console (F12)

### Les services ne se chargent pas
- Vérifiez que le `ResourceService` est bien importé
- Vérifiez les permissions Supabase pour la table `services`
- Vérifiez les erreurs en console

### Copier-coller ne fonctionne pas
- Assurez-vous de copier les cellules avec Tab comme séparateur (format Excel standard)
- Les valeurs doivent être numériques ou vides
- Les décimales doivent utiliser le point (.) ou la virgule (,)
