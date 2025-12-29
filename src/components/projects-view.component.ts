import { Component, OnInit, HostListener, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ProjetService } from "../services/projet.service";
import { SettingsService } from "../services/settings.service";
import { Projet } from "../models/types";
import { ChiffresModalComponent } from "./chiffres/chiffres-modal.component";
import { Chiffre } from "../models/chiffres.type";
import { LucideAngularModule, Plus, LucideCalculator, MoreVertical, Edit, Trash2, Copy, ExternalLink } from "lucide-angular";

@Component({
  selector: "app-projects-view",
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent, LucideAngularModule],
  template: `
    <div class="projects-container">
      <div class="projects-header">
        <div>
          <h1>Projets</h1>
          <p class="subtitle">Gérez vos projets et leur chiffrage</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Nouveau projet</button>
      </div>

      <div class="projects-controls">
        <div class="search-box">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="filterProjects()"
            placeholder="Rechercher un projet..."
            class="search-input"
          />
        </div>

        <div class="controls-right">
          <select [(ngModel)]="statusFilter" (ngModelChange)="filterProjects()" class="filter-select">
            <option value="">Tous les statuts</option>
            <option value="Actif">Actif</option>
            <option value="En cours">En cours</option>
            <option value="Planifié">Planifié</option>
            <option value="Terminé">Terminé</option>
            <option value="En pause">En pause</option>
          </select>

          <div class="view-toggle">
            <button
              class="toggle-btn"
              [class.active]="viewMode === 'card'"
              (click)="viewMode = 'card'"
              title="Vue en cartes"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="2" width="7" height="7" rx="1" />
                <rect x="11" y="2" width="7" height="7" rx="1" />
                <rect x="2" y="11" width="7" height="7" rx="1" />
                <rect x="11" y="11" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              class="toggle-btn"
              [class.active]="viewMode === 'list'"
              (click)="viewMode = 'list'"
              title="Vue en liste"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="3" width="16" height="2" rx="1" />
                <rect x="2" y="8" width="16" height="2" rx="1" />
                <rect x="2" y="13" width="16" height="2" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Card View -->
      <div *ngIf="viewMode === 'card'" class="projects-grid">
        <div *ngFor="let projet of filteredProjects" class="project-card" [attr.data-status]="projet.statut">
          <div class="card-header">
            <div class="card-header-top">
              <div class="project-identifiers">
                <span class="project-code">{{ projet.code_projet }}</span>
                <span class="external-ref-tag" *ngIf="projet.reference_externe">
                  <ng-container *ngIf="externalReferenceUrl; else noLink">
                    <a [href]="externalReferenceUrl + projet.reference_externe" target="_blank" class="ref-link" (click)="$event.stopPropagation()">
                      #{{ projet.reference_externe }}
                      <lucide-icon [img]="ExternalLink" [size]="12"></lucide-icon>
                    </a>
                  </ng-container>
                  <ng-template #noLink>
                    #{{ projet.reference_externe }}
                  </ng-template>
                </span>
              </div>
              <div class="header-actions">
                <span class="status-badge" [attr.data-status]="projet.statut">{{ projet.statut }}</span>
                <div class="menu-container" (click)="$event.stopPropagation()">
              <button class="menu-btn" (click)="toggleMenu($event, projet.id!)">
                <lucide-icon [img]="MoreVertical" [size]="20"></lucide-icon>
              </button>
                  <div class="dropdown-menu" *ngIf="activeMenuId === projet.id">
                <button class="dropdown-item" (click)="openEditModal(projet)">
                  <lucide-icon [img]="Edit" [size]="14"></lucide-icon>
                  Modifier
                </button>
                    <button class="dropdown-item" (click)="openChiffresModal(projet.id_projet)">
                      <lucide-icon [img]="LucideCalculator" [size]="14"></lucide-icon>
                      Gérer les chiffres
                    </button>
                    <button class="dropdown-item" (click)="duplicateProjet(projet)">
                      <lucide-icon [img]="Copy" [size]="14"></lucide-icon>
                      Dupliquer
                    </button>
                    <button class="dropdown-item delete" (click)="deleteProjet(projet)">
                      <lucide-icon [img]="Trash2" [size]="14"></lucide-icon>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card-body">
            <h3 class="project-name">{{ projet.nom_projet }}</h3>
            <p class="project-manager" *ngIf="projet.chef_projet">
              <span class="label">Chef de projet:</span> {{ projet.chef_projet }}
            </p>
            <p class="project-description" *ngIf="projet.description">{{ projet.description }}</p>

            <div class="metrics">
              <div class="metric-row">
                <span class="metric-label">Initial</span>
                <span class="metric-value">{{ projet.chiffrage_initial }}j</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Révisé</span>
                <span class="metric-value">{{ projet.chiffrage_revise }}j</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Prév.</span>
                <span class="metric-value">{{ projet.chiffrage_previsionnel }}j</span>
              </div>
            </div>

            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-label">Consommé</span>
                <span class="progress-value">{{ projet.temps_consomme }}j / {{ projet.chiffrage_previsionnel }}j</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  [style.width.%]="getProgressPercent(projet)"
                  [class.warning]="getProgressPercent(projet) > 80 && getProgressPercent(projet) <= 100"
                  [class.danger]="getProgressPercent(projet) > 100"
                ></div>
              </div>
              <div class="raf-info">
                <span class="raf-label">RAF:</span>
                <span class="raf-value" [class.negative]="calculateRAF(projet) < 0"> {{ calculateRAF(projet) }}j </span>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="filteredProjects.length === 0" class="empty-state">
          <p>Aucun projet trouvé</p>
        </div>
      </div>

      <!-- List View -->
      <div *ngIf="viewMode === 'list'" class="projects-list-view">
        <div *ngFor="let projet of filteredProjects" class="project-list-card" (click)="openEditModal(projet)">
          <div class="card-left">
            <div class="avatar project" [attr.data-status]="projet.statut">
              {{ projet.code_projet.charAt(0).toUpperCase() }}
            </div>
            <div class="project-info">
              <div class="project-name-row">
                <span class="project-name">{{ projet.nom_projet }}</span>
                <span class="status-badge small" [attr.data-status]="projet.statut">{{ projet.statut }}</span>
              </div>
              <div class="project-meta">
                <span class="project-code">{{ projet.code_projet }}</span>
                <span *ngIf="projet.reference_externe"> • 
                  <span class="external-ref-tag">
                    <ng-container *ngIf="externalReferenceUrl; else noLinkList">
                      <a [href]="externalReferenceUrl + projet.reference_externe" target="_blank" class="ref-link" (click)="$event.stopPropagation()">
                        #{{ projet.reference_externe }}
                        <lucide-icon [img]="ExternalLink" [size]="12"></lucide-icon>
                      </a>
                    </ng-container>
                    <ng-template #noLinkList>
                      #{{ projet.reference_externe }}
                    </ng-template>
                  </span>
                </span>
                <span *ngIf="projet.chef_projet"> • <span class="manager-name">{{ projet.chef_projet }}</span></span>
              </div>
            </div>
          </div>
          
          <div class="card-right">
            <div class="menu-container" (click)="$event.stopPropagation()">
              <button class="menu-btn" (click)="toggleMenu($event, projet.id!)">
                <lucide-icon [img]="MoreVertical" [size]="20"></lucide-icon>
              </button>
              <div class="dropdown-menu right" *ngIf="activeMenuId === projet.id">
                <button class="dropdown-item" (click)="openEditModal(projet)">
                  <lucide-icon [img]="Edit" [size]="14"></lucide-icon>
                  Modifier
                </button>
                <button class="dropdown-item" (click)="openChiffresModal(projet.id_projet)">
                  <lucide-icon [img]="LucideCalculator" [size]="14"></lucide-icon>
                  Gérer les chiffres
                </button>
                <button class="dropdown-item" (click)="duplicateProjet(projet)">
                  <lucide-icon [img]="Copy" [size]="14"></lucide-icon>
                  Dupliquer
                </button>
                <button class="dropdown-item delete" (click)="deleteProjet(projet)">
                  <lucide-icon [img]="Trash2" [size]="14"></lucide-icon>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="filteredProjects.length === 0" class="empty-state">
          <p>Aucun projet trouvé</p>
        </div>
      </div>
    </div>

    <!-- Project Modal -->
    <div
      *ngIf="showProjectModal"
      class="modal-overlay"
      (mousedown)="onOverlayMouseDown($event)"
      (mouseup)="onOverlayMouseUp($event)"
    >
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingProjetId ? "Modifier le projet" : "Nouveau Projet" }}</h2>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <form (ngSubmit)="saveProjet()" class="form">
          <div class="form-group">
            <label>Code Projet *</label>
            <input [(ngModel)]="newProjet.code_projet" name="code" required />
          </div>
          <div class="form-group">
            <label>Référence Externe</label>
            <input [(ngModel)]="newProjet.reference_externe" name="ref_ext" placeholder="ex: JIRA-123" />
          </div>
          <div class="form-group">
            <label>Nom Projet *</label>
            <input [(ngModel)]="newProjet.nom_projet" name="nom" required />
          </div>
          <div class="form-group">
            <label>Chef de Projet</label>
            <input [(ngModel)]="newProjet.chef_projet" name="chef" />
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select [(ngModel)]="newProjet.statut" name="statut">
              <option value="En cours">En cours</option>
              <option value="Planifié">Planifié</option>
              <option value="Terminé">Terminé</option>
              <option value="En pause">En pause</option>
              <option value="Actif">Actif</option>
            </select>
          </div>
          <div class="grid grid-3">
            <div class="form-group">
              <label>Chiffrage Initial</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_initial" name="initial" />
            </div>
            <div class="form-group">
              <label>Chiffrage Révisé</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_revise" name="revise" />
            </div>
            <div class="form-group">
              <label>Chiffrage Prévisionnel</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_previsionnel" name="prev" />
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="newProjet.description" name="desc" rows="3"></textarea>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="submit" class="btn btn-primary">{{ editingProjetId ? "Mettre à jour" : "Créer" }}</button>
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
          </div>
        </form>
      </div>
    </div>
    <!-- chiffres modal -->
    <div>
      <app-chiffres-modal
        [visible]="showChiffresModal"
        [idProjet]="selectedProjetId"
        (close)="closeChiffresModal()"
        (saved)="onChiffresModalSaved($event)"
      ></app-chiffres-modal>
    </div>
  `,
  styles: [
    `
      .projects-container {
        padding: 32px;
        background: #f5f7fa;
        min-height: 100vh;
      }

      .projects-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;
      }

      .projects-header h1 {
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

      .projects-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }

      .search-box {
        flex: 1;
        min-width: 300px;
        max-width: 500px;
      }

      .search-input {
        width: 100%;
        padding: 10px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.2s;
      }

      .search-input:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .controls-right {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .filter-select {
        padding: 10px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-select:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .view-toggle {
        display: flex;
        gap: 4px;
        background: white;
        padding: 4px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }

      .toggle-btn {
        padding: 8px 12px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: #6b7280;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toggle-btn:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .toggle-btn.active {
        background: #4f46e5;
        color: white;
      }

      /* Card View Styles */
      .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 24px;
      }

      .project-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 4px solid #4f46e5;
      }

      .project-card[data-status="Actif"] {
        border-left-color: #10b981;
      }

      .project-card[data-status="En cours"] {
        border-left-color: #3b82f6;
      }

      .project-card[data-status="Planifié"] {
        border-left-color: #f59e0b;
      }

      .project-card[data-status="Terminé"] {
        border-left-color: #6b7280;
      }

      .project-card[data-status="En pause"] {
        border-left-color: #ef4444;
      }

      .project-card:hover {
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        transform: translateY(-4px);
      }

      .card-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #f3f4f6;
      }

      .card-header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .project-identifiers {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .project-code {
        font-family: "Consolas", "Monaco", monospace;
        color: #9ca3af;
        font-weight: 500;
        background: #f3f4f6;
        padding: 1px 6px;
        border-radius: 4px;
      }

      .project-identifiers {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .ref-link {
        color: inherit;
        text-decoration: none;
        transition: color 0.2s;
      }

      .ref-link:hover {
        color: #4f46e5;
        text-decoration: underline;
      }

      .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .status-badge[data-status="Actif"] {
        background: #d1fae5;
        color: #065f46;
      }

      .status-badge[data-status="En cours"] {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-badge[data-status="Planifié"] {
        background: #fef3c7;
        color: #92400e;
      }

      .status-badge[data-status="Terminé"] {
        background: #f3f4f6;
        color: #374151;
      }

      .status-badge[data-status="En pause"] {
        background: #fee2e2;
        color: #991b1b;
      }

      .status-badge.small {
        padding: 2px 8px;
        font-size: 11px;
      }

      .card-body {
        padding: 20px;
      }

      .project-name {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
        line-height: 1.4;
      }

      .project-manager {
        margin: 0 0 12px 0;
        color: #6b7280;
        font-size: 14px;
      }

      .project-manager .label {
        font-weight: 500;
        color: #9ca3af;
      }

      .project-description {
        margin: 0 0 16px 0;
        color: #6b7280;
        font-size: 14px;
        line-height: 1.6;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
      }

      .metric-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .metric-label {
        font-size: 11px;
        font-weight: 500;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .metric-value {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
      }

      .progress-section {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #f3f4f6;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .progress-label {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
      }

      .progress-value {
        font-size: 12px;
        font-weight: 600;
        color: #111827;
      }

      .progress-bar {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-bar.small {
        height: 6px;
        margin: 0;
      }

      .progress-fill {
        height: 100%;
        background: #10b981;
        transition: width 0.3s ease;
        border-radius: 4px;
      }

      .progress-fill.warning {
        background: #f59e0b;
      }

      .progress-fill.danger {
        background: #ef4444;
      }

      .raf-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .raf-label {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
      }

      .raf-value {
        font-size: 14px;
        font-weight: 700;
        color: #10b981;
      }

      .raf-value.negative {
        color: #ef4444;
      }


      /* List View Refactoring */
      .projects-list-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .project-list-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
        cursor: pointer;
      }

      .project-list-card:hover {
        border-color: #4f46e5;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transform: translateY(-1px);
      }

      .card-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .avatar.project {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 18px;
        flex-shrink: 0;
        background: #4f46e5;
      }

      .avatar.project[data-status="Actif"] { background: #10b981; }
      .avatar.project[data-status="En cours"] { background: #3b82f6; }
      .avatar.project[data-status="Planifié"] { background: #f59e0b; }
      .avatar.project[data-status="Terminé"] { background: #6b7280; }
      .avatar.project[data-status="En pause"] { background: #ef4444; }

      .project-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .project-name-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .project-name {
        font-weight: 700;
        color: #111827;
        font-size: 16px;
      }

      .project-meta {
        font-size: 13px;
        color: #6b7280;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .manager-name {
        color: #4f46e5;
        font-weight: 600;
      }

      .external-ref-tag {
        display: inline-flex;
        align-items: center;
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        transition: all 0.2s;
      }

      .external-ref-tag:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
      }

      .ref-link {
        color: #4f46e5;
        text-decoration: none;
        font-weight: 600;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .ref-link:hover {
        color: #4338ca;
      }

      .ref-link lucide-icon {
        display: flex;
        align-items: center;
      }

      .empty-state {
        padding: 48px;
        text-align: center;
        color: #9ca3af;
        font-size: 15px;
        background: white;
        border-radius: 16px;
        border: 2px dashed #e5e7eb;
      }

      /* Menu & Dropdown Styles */
      .menu-container {
        position: relative;
        display: inline-block;
      }

      .menu-btn {
        background: transparent;
        border: none;
        color: #9ca3af;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .menu-btn:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        width: 160px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
        padding: 4px;
        z-index: 50;
        margin-top: 4px;
      }

      .dropdown-menu.right {
        right: 0;
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        text-align: left;
        border: none;
        background: transparent;
        font-size: 13px;
        color: #374151;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s;
      }

      .dropdown-item:hover {
        background: #f3f4f6;
      }

      .dropdown-item svg {
        color: #6b7280;
      }

      .dropdown-item.delete {
        color: #ef4444;
      }

      .dropdown-item.delete:hover {
        background: #fee2e2;
      }

      .dropdown-item.delete svg {
        color: #ef4444;
      }

      /* Button Styles */
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn-primary {
        background: #4f46e5;
        color: white;
      }

      .btn-primary:hover {
        background: #4338ca;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      }

      .btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .btn-secondary:hover {
        background: #e5e7eb;
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
        z-index: 2000;
        backdrop-filter: blur(4px);
      }

      .modal {
        background: white;
        border-radius: 16px;
        padding: 0;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid #e5e7eb;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #111827;
      }

      .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: #f3f4f6;
        border-radius: 8px;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-close:hover {
        background: #e5e7eb;
        color: #374151;
      }

      .form {
        padding: 24px;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #374151;
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.2s;
        font-family: inherit;
      }

      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .grid {
        display: grid;
        gap: 16px;
      }

      .grid-3 {
        grid-template-columns: repeat(3, 1fr);
      }

      .flex {
        display: flex;
      }

      .gap-2 {
        gap: 8px;
      }

      .mt-4 {
        margin-top: 16px;
      }
    `,
  ],
})
export class ProjectsViewComponent implements OnInit {
  viewMode: "list" | "card" = "list";
  searchQuery = "";
  statusFilter = "";

  LucideCalculator = LucideCalculator;
  MoreVertical = MoreVertical;
  Edit = Edit;
  Trash2 = Trash2;
  Copy = Copy;
  ExternalLink = ExternalLink;

  projets: Projet[] = [];
  filteredProjects: Projet[] = [];
  externalReferenceUrl: string | null = null;

  showProjectModal = false;
  editingProjetId: string | null = null;
  activeMenuId: string | null = null;
  isMouseDownOnOverlay = false;

  //ajout pour la modale des  chiffres
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  newProjet: Partial<Projet> = {
    code_projet: "",
    nom_projet: "",
    statut: "En cours",
    chiffrage_initial: 0,
    chiffrage_revise: 0,
    chiffrage_previsionnel: 0,
    temps_consomme: 0,
  };

  constructor(
    private projetService: ProjetService,
    private settingsService: SettingsService
  ) { }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    // Close menu when clicking outside
    if (this.activeMenuId) {
      this.activeMenuId = null;
    }
  }

  toggleMenu(event: MouseEvent, projetId: string) {
    event.stopPropagation();
    if (this.activeMenuId === projetId) {
      this.activeMenuId = null;
    } else {
      this.activeMenuId = projetId;
    }
  }

  async ngOnInit() {
    await this.loadProjects();
    this.externalReferenceUrl = await this.settingsService.getSettingValue("external_reference_url", "global");
  }

  async loadProjects() {
    try {
      this.projets = await this.projetService.getAllProjets();
      this.filterProjects();
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }

  filterProjects() {
    this.filteredProjects = this.projets.filter((projet) => {
      const matchesSearch =
        !this.searchQuery ||
        projet.nom_projet.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        projet.code_projet.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesStatus = !this.statusFilter || projet.statut === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  getProgressPercent(projet: Projet): number {
    if (projet.chiffrage_previsionnel === 0) return 0;
    const percent = (projet.temps_consomme / projet.chiffrage_previsionnel) * 100;
    return Math.min(Math.round(percent), 100);
  }

  calculateRAF(projet: Projet): number {
    return this.projetService.calculateRAF(projet);
  }

  openCreateModal() {
    this.editingProjetId = null;
    this.newProjet = {
      code_projet: "",
      nom_projet: "",
      statut: "En cours",
      chiffrage_initial: 0,
      chiffrage_revise: 0,
      chiffrage_previsionnel: 0,
      temps_consomme: 0,
      description: "",
      reference_externe: "",
    };
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  openEditModal(projet: Projet) {
    this.editingProjetId = projet.id!;
    this.newProjet = { ...projet };
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  duplicateProjet(projet: Projet) {
    this.editingProjetId = null; // Treat as new project
    console.log("PROJET Origine : ", projet);

    // Destructure pour exclure les propriétés à ne pas copier
    const { id, created_at, updated_at, ...restProjet } = projet;

    this.newProjet = {
      ...restProjet,
      code_projet: `${projet.code_projet}-COPY`,
      nom_projet: `${projet.nom_projet} (Copie)`,
    };

    console.log("PROJET Copie : ", this.newProjet);
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  onOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.isMouseDownOnOverlay = true;
    }
  }

  onOverlayMouseUp(event: MouseEvent) {
    if (this.isMouseDownOnOverlay && event.target === event.currentTarget) {
      this.closeModal();
    }
    this.isMouseDownOnOverlay = false;
  }

  closeModal() {
    this.showProjectModal = false;
    this.editingProjetId = null;
  }

  async deleteProjet(projet: Projet) {
    this.activeMenuId = null;
    if (confirm(`Êtes-vous sûr de vouloir supprimer le projet "${projet.nom_projet}" ?`)) {
      try {
        await this.projetService.deleteProjet(projet.id!);
        await this.loadProjects();
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  }

  async saveProjet() {
    try {
      if (this.editingProjetId) {
        await this.projetService.updateProjet(this.editingProjetId, this.newProjet);
      } else {
        await this.projetService.createProjet(this.newProjet);
      }
      this.closeModal();
      await this.loadProjects();
    } catch (error) {
      console.error("Error saving project:", error);
    }
  }

  // méthodes pour la gestion des chiffres d'un projet

  openChiffresModal(idProjet: number) {
    this.selectedProjetId = idProjet;
    this.showChiffresModal = true;
    this.activeMenuId = null;
  }

  closeChiffresModal() {
    this.showChiffresModal = false;
  }

  onChiffresModalSaved(chiffres: Chiffre[]) {
    console.log("Chiffres sauvegardés:", chiffres);
  }
}
