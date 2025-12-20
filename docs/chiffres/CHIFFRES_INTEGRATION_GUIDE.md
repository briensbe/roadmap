/**
 * INTEGRATION GUIDE: Utiliser ChiffresModalComponent avec ProjetService
 * 
 * Ce fichier démontre comment intégrer le composant modal des chiffres
 * directement dans votre flux de gestion de projets.
 */

// ============================================================================
// OPTION 1: Intégration basique dans le composant projects-view
// ============================================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Projet } from '../models/types';
import { ProjetService } from '../services/projet.service';
import { ChiffresModalComponent } from './chiffres-modal.component';

@Component({
  selector: 'app-projects-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent],
  template: `
    <div class="container">
      <h1>Projets</h1>
      
      <div class="projects-grid">
        <div *ngFor="let projet of projets" class="project-card">
          <h3>{{ projet.nom_projet }}</h3>
          <p>Code: {{ projet.code_projet }}</p>
          <p>Statut: {{ projet.statut }}</p>
          
          <!-- Bouton pour ouvrir la modale -->
          <button 
            (click)="openChiffresModal(projet.id)"
            class="btn-primary"
          >
            📊 Gérer les chiffres
          </button>
        </div>
      </div>

      <!-- Modal -->
      <app-chiffres-modal 
        [visible]="showChiffresModal"
        [idProjet]="selectedProjetId"
        (close)="closeChiffresModal()"
        (saved)="onChiffresModalSaved($event)"
      ></app-chiffres-modal>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .project-card {
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 8px;
      background-color: #f9f9f9;
    }

    .btn-primary {
      padding: 10px 20px;
      background-color: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 12px;
    }

    .btn-primary:hover {
      background-color: #4f46e5;
    }
  `]
})
export class ProjectsViewComponent implements OnInit {
  projets: Projet[] = [];
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  constructor(private projetService: ProjetService) {}

  ngOnInit() {
    this.loadProjets();
  }

  async loadProjets() {
    try {
      this.projets = await this.projetService.getAllProjets();
    } catch (err) {
      console.error('Erreur:', err);
    }
  }

  // IMPORTANT: Vous devez avoir accès à id_projet (numérique)
  // Soit en mettant à jour la requête Supabase pour le récupérer,
  // soit en créant une méthode de conversion
  openChiffresModal(projetUUID: string | undefined) {
    if (!projetUUID) return;

    // Option A: Si vous avez récupéré id_projet via Supabase
    const projet = this.projets.find(p => p.id === projetUUID);
    const idProjet = (projet as any)?.id_projet;

    if (idProjet) {
      this.selectedProjetId = idProjet;
      this.showChiffresModal = true;
    } else {
      console.warn('id_projet non trouvé pour le projet', projetUUID);
    }
  }

  closeChiffresModal() {
    this.showChiffresModal = false;
    this.selectedProjetId = null;
  }

  onChiffresModalSaved(chiffres: any[]) {
    console.log('Chiffres sauvegardés:', chiffres);
    // Vous pouvez:
    // - Rafraîchir les données du projet
    // - Afficher une notification
    // - Mettre à jour le cache
  }
}

// ============================================================================
// OPTION 2: Intégration avancée avec un service dédié
// ============================================================================

/**
 * Service pour gérer l'interaction avec la modale des chiffres
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChiffresModalService {
  private showModal$ = new BehaviorSubject<boolean>(false);
  private selectedProjetId$ = new BehaviorSubject<number | null>(null);

  getShowModal(): Observable<boolean> {
    return this.showModal$.asObservable();
  }

  getSelectedProjetId(): Observable<number | null> {
    return this.selectedProjetId$.asObservable();
  }

  openChiffresModal(idProjet: number) {
    this.selectedProjetId$.next(idProjet);
    this.showModal$.next(true);
  }

  closeChiffresModal() {
    this.showModal$.next(false);
    this.selectedProjetId$.next(null);
  }
}

// Utilisation du service:
// Dans ProjectsViewComponent:
/*
export class ProjectsViewComponent implements OnInit {
  showChiffresModal$: Observable<boolean>;
  selectedProjetId$: Observable<number | null>;

  constructor(
    private projetService: ProjetService,
    private chiffresModalService: ChiffresModalService
  ) {
    this.showChiffresModal$ = this.chiffresModalService.getShowModal();
    this.selectedProjetId$ = this.chiffresModalService.getSelectedProjetId();
  }

  openChiffresModal(idProjet: number) {
    this.chiffresModalService.openChiffresModal(idProjet);
  }

  closeChiffresModal() {
    this.chiffresModalService.closeChiffresModal();
  }
}

// Dans le template:
<app-chiffres-modal 
  [visible]="showChiffresModal$ | async"
  [idProjet]="selectedProjetId$ | async"
  (close)="closeChiffresModal()"
  (saved)="onChiffresModalSaved($event)"
></app-chiffres-modal>
*/

// ============================================================================
// OPTION 3: Appeler la modale depuis un menu contextuel
// ============================================================================

/**
 * Exemple: Ajouter une option "Gérer les chiffres" dans un menu
 */
export function setupProjectContextMenu() {
  // Dans votre composant parent:
  
  /*
  onProjectRightClick(event: MouseEvent, projet: Projet) {
    event.preventDefault();
    
    // Afficher un menu contextuel
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.top = event.clientY + 'px';
    menu.style.left = event.clientX + 'px';
    
    const option = document.createElement('button');
    option.textContent = '📊 Gérer les chiffres';
    option.onclick = () => {
      this.openChiffresModal(projet.id);
      menu.remove();
    };
    
    menu.appendChild(option);
    document.body.appendChild(menu);
  }
  */
}

// ============================================================================
// OPTION 4: Intégration avec ngx-toastr pour les notifications
// ============================================================================

/**
 * Montrer une notification quand les chiffres sont sauvegardés
 */
import { ToastrService } from 'ngx-toastr'; // Si vous utilisez ngx-toastr

// Dans ProjectsViewComponent:
/*
constructor(
  private projetService: ProjetService,
  private toastr: ToastrService
) {}

onChiffresModalSaved(chiffres: any[]) {
  const count = chiffres.length;
  this.toastr.success(
    `${count} chiffre(s) sauvegardé(s) avec succès`,
    'Succès'
  );
  
  // Rafraîchir les données
  this.loadProjets();
}
*/

// ============================================================================
// IMPORTANT: Checklist d'intégration
// ============================================================================

/**
 * Avant d'utiliser la modale, assurez-vous que:
 * 
 * ☑ 1. Les colonnes id_projet et id_service existent dans votre base
 * ☑ 2. Les valeurs id_projet et id_service sont populées pour tous les projets/services
 * ☑ 3. La table chiffres est créée (via la migration add_table_chiffres_20251219.sql)
 * ☑ 4. Les permissions RLS sont configurées correctement
 * ☑ 5. Le composant ChiffresModalComponent est importé
 * ☑ 6. Le service ChiffresService est injecté
 * ☑ 7. ResourceService est disponible pour charger les services
 * ☑ 8. Les types TypeScript sont importés (Chiffre, ChiffresFormData)
 */
