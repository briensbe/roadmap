/**
 * SNIPPETS PRÊTS À COPIER-COLLER
 * 
 * Utilisez ces snippets pour intégrer rapidement la modale des chiffres
 * dans votre application.
 */

// ============================================================================
// SNIPPET 1: Import du composant dans votre composant parent
// ============================================================================

/*
import { ChiffresModalComponent } from './components/chiffres-modal.component';

@Component({
  selector: 'app-your-component',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ChiffresModalComponent  // ← Ajouter ici
  ],
  // ...
})
*/

// ============================================================================
// SNIPPET 2: Déclarer les propriétés pour gérer la modale
// ============================================================================

/*
export class YourComponent {
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  // ...
}
*/

// ============================================================================
// SNIPPET 3: Méthode pour ouvrir la modale
// ============================================================================

/*
openChiffresModal(projetId: number) {
  this.selectedProjetId = projetId;
  this.showChiffresModal = true;
}
*/

// ============================================================================
// SNIPPET 4: Méthode pour fermer la modale
// ============================================================================

/*
closeChiffresModal() {
  this.showChiffresModal = false;
  this.selectedProjetId = null;
}
*/

// ============================================================================
// SNIPPET 5: Gestionnaire d'événement quand les chiffres sont sauvegardés
// ============================================================================

/*
onChiffresModalSaved(chiffres: Chiffre[]) {
  console.log('Chiffres sauvegardés:', chiffres);
  
  // Options:
  // 1. Afficher une notification
  // 2. Rafraîchir les données du projet
  // 3. Mettre à jour le cache local
  // 4. Fermer la modale
  
  this.closeChiffresModal();
  
  // Exemple avec une notification simple
  alert(`${chiffres.length} chiffre(s) sauvegardé(s)`);
}
*/

// ============================================================================
// SNIPPET 6: Ajouter le composant modal au template HTML
// ============================================================================

/*
<!-- Dans votre template .html -->

<!-- Bouton pour ouvrir la modale -->
<button (click)="openChiffresModal(projet.id_projet)">
  📊 Gérer les chiffres
</button>

<!-- Composant modal -->
<app-chiffres-modal 
  [visible]="showChiffresModal"
  [idProjet]="selectedProjetId"
  (close)="closeChiffresModal()"
  (saved)="onChiffresModalSaved($event)"
></app-chiffres-modal>
*/

// ============================================================================
// SNIPPET 7: Utiliser le ChiffresService directement
// ============================================================================

/*
import { ChiffresService } from '../services/chiffres.service';

export class YourComponent {
  constructor(private chiffresService: ChiffresService) {}

  async loadChiffres(idProjet: number) {
    try {
      const chiffres = await this.chiffresService.getChiffresByProject(idProjet);
      console.log('Chiffres chargés:', chiffres);
    } catch (error) {
      console.error('Erreur:', error);
    }
  }

  async saveChiffre(chiffre: Partial<Chiffre>) {
    try {
      const newChiffre = await this.chiffresService.createChiffre(chiffre as Chiffre);
      console.log('Chiffre créé:', newChiffre);
    } catch (error) {
      console.error('Erreur:', error);
    }
  }
}
*/

// ============================================================================
// SNIPPET 8: Calculer les champs dérivés manuellement
// ============================================================================

/*
// Si vous avez besoin de calculer Delta et Restant en dehors du composant:

interface ChiffresWithCalculated {
  initial: number;
  revise: number;
  previsionnel: number;
  consomme: number;
  delta: number;      // prévisionnel - révisé
  restant: number;    // prévisionnel - consommé
}

function calculateChiffres(chiffre: any): ChiffresWithCalculated {
  const delta = chiffre.previsionnel - chiffre.revise;
  const restant = chiffre.previsionnel - chiffre.consomme;
  
  return {
    ...chiffre,
    delta,
    restant
  };
}
*/

// ============================================================================
// SNIPPET 9: Obtenir le RAF (Ressources Affectées) pour une date
// ============================================================================

/*
async getRessourcesAffectees(idProjet: number, idService: number, fromDate: string) {
  const raf = await this.chiffresService.getRAFByDate(idProjet, idService, fromDate);
  return raf;
}

// Utilisation:
const raf = await this.getRessourcesAffectees(1, 1, '2024-01-15T00:00:00');
console.log('RAF:', raf);
*/

// ============================================================================
// SNIPPET 10: Boucle pour traiter plusieurs projets
// ============================================================================

/*
async processAllProjets() {
  try {
    const projets = await this.projetService.getAllProjets();
    
    for (const projet of projets) {
      const idProjet = (projet as any).id_projet;
      if (!idProjet) {
        console.warn('Pas d\'id_projet pour:', projet.code_projet);
        continue;
      }
      
      const chiffres = await this.chiffresService.getChiffresByProject(idProjet);
      console.log(`Projet ${projet.code_projet}: ${chiffres.length} chiffre(s)`);
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
}
*/

// ============================================================================
// SNIPPET 11: Gérer les erreurs lors de la sauvegarde
// ============================================================================

/*
onChiffresModalSaved(chiffres: Chiffre[]) {
  // Vérifier s'il y a des erreurs
  if (!chiffres || chiffres.length === 0) {
    console.warn('Aucun chiffre n\'a été sauvegardé');
    return;
  }

  // Traiter les chiffres sauvegardés
  chiffres.forEach(chiffre => {
    console.log(
      `Chiffre ${chiffre.id_service}: ` +
      `Initial=${chiffre.initial}, ` +
      `Prévi=${chiffre.previsionnel}`
    );
  });

  // Fermer la modale et afficher un message
  this.showChiffresModal = false;
  alert(`✓ ${chiffres.length} chiffre(s) sauvegardé(s) avec succès`);
}
*/

// ============================================================================
// SNIPPET 12: Intégration avec un composant de tableau de bord
// ============================================================================

/*
import { Chiffre } from '../models/chiffres.type';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent],
  template: `
    <div class="dashboard">
      <h1>Tableau de bord - Projets et Chiffres</h1>
      
      <table class="projects-table">
        <thead>
          <tr>
            <th>Code Projet</th>
            <th>Nom</th>
            <th>Initial</th>
            <th>Prévisionnel</th>
            <th>Consommé</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let projet of projets">
            <td>{{ projet.code_projet }}</td>
            <td>{{ projet.nom_projet }}</td>
            <td>{{ projet.chiffrage_initial }}</td>
            <td>{{ projet.chiffrage_previsionnel }}</td>
            <td>{{ projet.temps_consomme }}</td>
            <td>
              <button (click)="openChiffresModal((projet as any).id_projet)">
                Éditer
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <app-chiffres-modal 
        [visible]="showChiffresModal"
        [idProjet]="selectedProjetId"
        (close)="showChiffresModal = false"
        (saved)="onChiffresModalSaved($event)"
      ></app-chiffres-modal>
    </div>
  `,
  styles: [`
    .projects-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .projects-table th,
    .projects-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    .projects-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  `]
})
export class DashboardComponent implements OnInit {
  projets: Projet[] = [];
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  constructor(private projetService: ProjetService) {}

  ngOnInit() {
    this.loadProjets();
  }

  async loadProjets() {
    this.projets = await this.projetService.getAllProjets();
  }

  openChiffresModal(idProjet: number) {
    this.selectedProjetId = idProjet;
    this.showChiffresModal = true;
  }

  onChiffresModalSaved(chiffres: Chiffre[]) {
    console.log('Chiffres mis à jour:', chiffres);
    this.loadProjets(); // Rafraîchir le tableau
  }
}
*/

// ============================================================================
// SNIPPET 13: Télécharger les chiffres en CSV
// ============================================================================

/*
async exportChiffresAsCSV(idProjet: number) {
  const chiffres = await this.chiffresService.getChiffresByProject(idProjet);
  
  if (chiffres.length === 0) {
    alert('Aucun chiffre à exporter');
    return;
  }

  // Créer le CSV
  const headers = ['Service', 'Initial', 'Révisé', 'Prévisionnel', 'Consommé', 'Date'];
  const rows = chiffres.map(c => [
    c.id_service,
    c.initial,
    c.revise,
    c.previsionnel,
    c.consomme,
    c.date_mise_a_jour
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Télécharger
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chiffres_projet_${idProjet}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}
*/

// ============================================================================
// SNIPPET 14: Validation avant sauvegarde
// ============================================================================

/*
onChiffresModalSaved(chiffres: Chiffre[]) {
  // Valider les données
  for (const chiffre of chiffres) {
    if (!chiffre.id_projet || !chiffre.id_service) {
      alert('Erreur: Données incomplètes');
      return;
    }

    if (chiffre.consomme && chiffre.previsionnel && chiffre.consomme > chiffre.previsionnel) {
      alert(`⚠️ Projet ${chiffre.id_projet}: Consommé > Prévisionnel`);
    }
  }

  console.log('✓ Validation réussie');
  this.showChiffresModal = false;
}
*/

// ============================================================================
// Notes importantes
// ============================================================================

/*
POINTS CLÉS À RETENIR:

1. ID PROJET:
   - Utilisez toujours l'id_projet (numérique) et non l'id (UUID)
   - Vérifiez que cette colonne existe et est populée dans votre BD

2. SERVICES:
   - Les services doivent avoir une colonne id_service (numérique)
   - Le composant charge automatiquement tous les services disponibles

3. CALCULS AUTOMATIQUES:
   - Delta = Prévisionnel - Révisé
   - Restant = Prévisionnel - Consommé
   - RAF = Somme des charges après la date sélectionnée

4. COPIER-COLLER EXCEL:
   - Sélectionnez les 4 colonnes dans Excel (Initial, Révisé, Prévisionnel, Consommé)
   - Copiez (Ctrl+C)
   - Cliquez sur le champ Initial du premier service
   - Collez (Ctrl+V)
   - Les valeurs se propagent aux services suivants

5. PERFORMANCES:
   - Le service utilise un cache simple
   - Le cache est invalidé après chaque opération CRUD
   - Pour des projets volumineux, envisagez un cache persistant

6. PERMISSIONS:
   - Vérifiez les permissions RLS Supabase sur les tables chiffres et charges
   - Les utilisateurs authentifiés doivent pouvoir lire/écrire les chiffres
*/
