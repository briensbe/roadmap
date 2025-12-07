import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JalonService } from '../services/jalon.service';
import { ProjetService } from '../services/projet.service';
import { Jalon, Projet } from '../models/types';

@Component({
    selector: 'app-milestones-view',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="milestones-container">
      <div class="milestones-header">
        <div>
          <h1>Jalons</h1>
          <p class="subtitle">Gérez les jalons de vos projets</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">
          + Nouveau Jalon
        </button>
      </div>

      <div class="milestones-list">
        <table class="milestones-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Nom</th>
              <th>Projet</th>
              <th>Type</th>
              <th style="width: 100px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let jalon of jalons">
              <td class="date-cell">{{ jalon.date_jalon | date:'dd/MM/yyyy' }}</td>
              <td class="name-cell">{{ jalon.nom }}</td>
              <td>
                <span class="project-badge" *ngIf="getProject(jalon.projet_id)">
                  {{ getProject(jalon.projet_id)?.nom_projet }}
                </span>
                <span *ngIf="!jalon.projet_id" class="no-project">-</span>
              </td>
              <td>
                <span class="type-badge" [attr.data-type]="jalon.type">
                  {{ jalon.type || 'Autre' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="action-btn edit" (click)="openEditModal(jalon)" title="Modifier">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="action-btn delete" (click)="deleteJalon(jalon)" title="Supprimer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </td>
            </tr>
            <tr *ngIf="jalons.length === 0">
              <td colspan="5" class="empty-state">Aucun jalon trouvé</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingJalonId ? 'Modifier le jalon' : 'Nouveau Jalon' }}</h2>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <form (ngSubmit)="saveJalon()" class="form">
          <div class="form-group">
            <label>Nom du jalon *</label>
            <input [(ngModel)]="currentJalon.nom" name="nom" required placeholder="Ex: Livraison V1">
          </div>
          
          <div class="form-group">
            <label>Date *</label>
            <input type="date" [(ngModel)]="currentJalon.date_jalon" name="date_jalon" required>
          </div>

          <div class="form-group">
            <label>Projet</label>
            <select [(ngModel)]="currentJalon.projet_id" name="projet_id">
              <option [ngValue]="undefined">-- Aucun projet --</option>
              <option *ngFor="let p of projets" [value]="p.id">{{ p.nom_projet }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Type</label>
            <select [(ngModel)]="currentJalon.type" name="type">
              <option value="">Autre</option>
              <option value="LV">Livraison (LV)</option>
              <option value="MEP">Mise en production (MEP)</option>
              <option value="SP">Sprint (SP)</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">{{ editingJalonId ? 'Mettre à jour' : 'Créer' }}</button>
          </div>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .milestones-container {
      padding: 32px;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .milestones-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .milestones-header h1 {
      margin: 0 0 4px 0;
      font-size: 32px;
      font-weight: 700;
      color: #111827;
    }

    .subtitle {
      margin: 0;
      color: #6b7280;
      font-size: 16px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #4f46e5;
      color: white;
    }

    .btn-primary:hover {
      background: #4338ca;
    }

    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #d1d5db;
    }

    .milestones-list {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .milestones-table {
      width: 100%;
      border-collapse: collapse;
    }

    .milestones-table th {
      padding: 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
      background: #f9fafb;
    }

    .milestones-table td {
      padding: 16px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
      font-size: 14px;
    }

    .milestones-table tr:last-child td {
      border-bottom: none;
    }

    .milestones-table tr:hover {
      background: #f9fafb;
    }

    .date-cell {
      font-family: 'Consolas', 'Monaco', monospace;
      color: #6b7280;
    }

    .name-cell {
      font-weight: 500;
      color: #111827;
    }

    .project-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #4338ca;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .no-project {
      color: #9ca3af;
      font-style: italic;
    }

    /* Type Badges */
    .type-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: #f3f4f6;
      color: #4b5563;
    }

    .type-badge[data-type="LV"] {
      background: #d1fae5;
      color: #065f46; /* Green */
    }

    .type-badge[data-type="MEP"] {
      background: #dbeafe;
      color: #1e40af; /* Blue */
    }

    .type-badge[data-type="SP"] {
      background: #fef3c7;
      color: #92400e; /* Amber */
    }

    .actions-cell {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #9ca3af;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn:hover {
      background: #f3f4f6;
    }

    .action-btn.edit:hover {
      color: #4f46e5;
    }

    .action-btn.delete:hover {
      color: #ef4444;
    }

    .empty-state {
      text-align: center;
      color: #9ca3af;
      padding: 40px !important;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      padding: 24px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .modal-close {
      background: transparent;
      border: none;
      font-size: 24px;
      color: #9ca3af;
      cursor: pointer;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      color: #111827;
      transition: all 0.2s;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 32px;
    }
  `]
})
export class MilestonesViewComponent implements OnInit {
    jalons: Jalon[] = [];
    projets: Projet[] = [];

    showModal = false;
    editingJalonId: string | undefined = undefined;

    currentJalon: Partial<Jalon> = {
        nom: '',
        date_jalon: '',
        type: ''
    };

    constructor(
        private jalonService: JalonService,
        private projetService: ProjetService
    ) { }

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        try {
            const [jalonsData, projetsData] = await Promise.all([
                this.jalonService.getAllJalons(),
                this.projetService.getAllProjets()
            ]);
            this.jalons = jalonsData;
            this.projets = projetsData;
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    getProject(id?: string): Projet | undefined {
        if (!id) return undefined;
        return this.projets.find(p => p.id === id);
    }

    openCreateModal() {
        this.editingJalonId = undefined;
        this.currentJalon = {
            nom: '',
            date_jalon: new Date().toISOString().split('T')[0],
            type: ''
        };
        this.showModal = true;
    }

    openEditModal(jalon: Jalon) {
        this.editingJalonId = jalon.id;
        this.currentJalon = { ...jalon };
        this.showModal = true;
    }

    closeModal() {
        this.showModal = false;
        this.editingJalonId = undefined;
    }

    async saveJalon() {
        if (!this.currentJalon.nom || !this.currentJalon.date_jalon) return;

        try {
            if (this.editingJalonId) {
                await this.jalonService.updateJalon(this.editingJalonId, this.currentJalon);
            } else {
                await this.jalonService.createJalon(this.currentJalon);
            }
            this.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving jalon:', error);
        }
    }

    async deleteJalon(jalon: Jalon) {
        if (!jalon.id || !confirm('Êtes-vous sûr de vouloir supprimer ce jalon ?')) return;

        try {
            await this.jalonService.deleteJalon(jalon.id);
            await this.loadData();
        } catch (error) {
            console.error('Error deleting jalon:', error);
        }
    }
}
