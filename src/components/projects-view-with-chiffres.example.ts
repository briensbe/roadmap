import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Projet } from '../models/types';
import { ProjetService } from '../services/projet.service';
import { ChiffresModalComponent } from './chiffres-modal.component';
import { Chiffre } from '../models/chiffres.type';

/**
 * Exemple de composant parent utilisant ChiffresModalComponent
 * 
 * Ce composant démontre comment:
 * - Ouvrir/fermer la modale des chiffres
 * - Passer le idProjet à la modale
 * - Gérer les événements (close, saved)
 */
@Component({
  selector: 'app-projects-view-with-chiffres',
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent],
  template: `
    <div class="projects-container">
      <h1>Gestion des Projets</h1>
      
      <div class="projects-list">
        <div *ngFor="let projet of projets" class="project-card">
          <h3>{{ projet.nom_projet }}</h3>
          <p><strong>Code:</strong> {{ projet.code_projet }}</p>
          <p><strong>Statut:</strong> {{ projet.statut }}</p>
          
          <button 
            (click)="openChiffresModal(projet.id)"
            class="btn-chiffres"
          >
            📊 Gérer les chiffres
          </button>
        </div>
      </div>
    </div>

    <!-- Modal des chiffres -->
    <app-chiffres-modal 
      [visible]="showChiffresModal"
      [idProjet]="selectedProjetId"
      (close)="onChiffresModalClose()"
      (saved)="onChiffresModalSaved($event)">
    </app-chiffres-modal>
  `,
  styles: [`
    .projects-container {
      padding: 20px;
    }

    .projects-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .project-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      background-color: #f9f9f9;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .project-card h3 {
      margin-top: 0;
      color: #333;
    }

    .project-card p {
      margin: 8px 0;
      color: #666;
    }

    .btn-chiffres {
      margin-top: 12px;
      padding: 10px 20px;
      background-color: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .btn-chiffres:hover {
      background-color: #4f46e5;
    }
  `]
})
export class ProjectsViewWithChiffresComponent implements OnInit {
  projets: Projet[] = [];
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;
  isLoading: boolean = false;

  constructor(private projetService: ProjetService) {}

  ngOnInit() {
    this.loadProjets();
  }

  async loadProjets() {
    try {
      this.isLoading = true;
      // Remarque: getAllProjets retourne les projets avec id (UUID)
      // Pour convertir en nombre, vous devez adapter selon votre structure réelle
      const projets = await this.projetService.getAllProjets();
      this.projets = projets;
      this.isLoading = false;
    } catch (err) {
      console.error('Erreur lors du chargement des projets:', err);
      this.isLoading = false;
    }
  }

  openChiffresModal(projetId: string | undefined) {
    if (!projetId) return;
    
    // Convertissez l'ID du projet au format approprié si nécessaire
    // Par exemple, si vous avez une colonne id_projet numérique dans la table projets
    this.selectedProjetId = parseInt(projetId);
    this.showChiffresModal = true;
  }

  onChiffresModalClose() {
    this.showChiffresModal = false;
    this.selectedProjetId = null;
  }

  onChiffresModalSaved(chiffres: Chiffre[]) {
    console.log('Chiffres sauvegardés:', chiffres);
    // Vous pouvez ici:
    // - Rafraîchir les données du projet
    // - Afficher une notification de succès
    // - Mettre à jour les valeurs affichées
  }
}
