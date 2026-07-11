import { Component, Input, Output, EventEmitter, OnInit, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../services/projet.service';
import { SettingsService } from '../services/settings.service';
import { Projet, PROJECT_STATUS_LIST } from '../models/types';
import { LucideAngularModule, Plus, ExternalLink, LucideCalculator } from 'lucide-angular';
import { ProjectJsonImportComponent } from './project-json-import.component';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ProjectJsonImportComponent],
  template: `
    <div class="modal-overlay" (mousedown)="onOverlayMouseDown($event)" (mouseup)="onOverlayMouseUp($event)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="header-title-group">
            <h2>{{ projet?.id ? 'Modifier le projet' : 'Nouveau Projet' }}</h2>
            <app-project-json-import *ngIf="!projet?.id" (imported)="onJsonImported($event)"></app-project-json-import>
          </div>
          <button class="modal-close" (click)="close()">×</button>
        </div>
        <form (ngSubmit)="save()" class="form">
          <div class="grid grid-2">
            <div class="form-group">
              <div class="label-with-link">
                <label>Code Projet</label>
                <button
                  *ngIf="editableProjet.id_projet"
                  type="button"
                  (click)="onOpenChiffres($event)"
                  class="ref-link modal-ref-link"
                  title="Modifier les chiffres du projet">
                  Modifier chiffres
                  <lucide-icon [img]="LucideCalculator" [size]="12"></lucide-icon>
                </button>
              </div>
              <input [(ngModel)]="editableProjet.code_projet" name="code" />
            </div>
            <div class="form-group">
              <div class="label-with-link">
                <label>Référence Externe</label>
                <a
                  *ngIf="editableProjet.reference_externe && externalReferenceUrl()"
                  [href]="externalReferenceUrl() + editableProjet.reference_externe"
                  target="_blank"
                  class="ref-link modal-ref-link">
                  Ouvrir
                  <lucide-icon [img]="ExternalLink" [size]="12"></lucide-icon>
                </a>
              </div>
              <input [(ngModel)]="editableProjet.reference_externe" name="ref_ext" placeholder="ex: JIRA-123" />
            </div>
          </div>
          <div class="form-group full-width" [class.has-error]="formErrors.nom_projet">
            <label>Nom Projet *</label>
            <input
              [(ngModel)]="editableProjet.nom_projet"
              name="nom"
              required
              (ngModelChange)="formErrors.nom_projet = false" />
            <span class="error-message" *ngIf="formErrors.nom_projet">Le nom du projet est obligatoire</span>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label>Statut</label>
              <select [(ngModel)]="editableProjet.statut" name="statut">
                <option *ngFor="let s of PROJECT_STATUTS" [value]="s">{{ s }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Chef de Projet</label>
              <input [(ngModel)]="editableProjet.chef_projet" name="chef" />
            </div>
          </div>

          <div class="form-group full-width">
            <label>Description</label>
            <textarea [(ngModel)]="editableProjet.description" name="desc" rows="3"></textarea>
          </div>

          <div class="form-group full-width">
            <label>Couleur</label>
            <div class="color-palette">
              <div
                *ngFor="let color of predefinedColors"
                class="color-swatch"
                [style.background-color]="color"
                [class.active]="editableProjet.color === color"
                (click)="selectColor(color)"></div>
              <div class="color-swatch custom-trigger" [class.active]="isCustomColor" (click)="isCustomColor = true">
                <div
                  *ngIf="isCustomColor; else plusIcon"
                  class="custom-preview"
                  [style.background-color]="editableProjet.color"></div>
                <ng-template #plusIcon>
                  <lucide-icon [img]="Plus" [size]="16"></lucide-icon>
                </ng-template>
              </div>
            </div>

            <div *ngIf="isCustomColor" class="custom-color-input-wrapper">
              <input type="color" [(ngModel)]="editableProjet.color" name="customColor" class="color-input" />
              <input
                type="text"
                [(ngModel)]="ngModelColor"
                (ngModelChange)="onColorHexChange($event)"
                name="customColorText"
                class="color-hex-input"
                placeholder="#HEXCODE" />
            </div>
          </div>

          <div class="flex items-center gap-4 mt-4">
            <div class="flex gap-2">
              <button type="submit" class="btn btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Sauvegarde...' : projet?.id ? 'Mettre à jour' : 'Créer' }}
              </button>
              <button type="button" class="btn btn-secondary" (click)="close()">Annuler</button>
            </div>
            <span class="shortcut-hint">Ctrl + Entrée pour valider</span>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
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
        z-index: 3000;
      }
      .modal {
        background: white;
        padding: 32px;
        border-radius: 12px;
        width: 100%;
        max-width: 600px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .modal-header h2 {
        margin: 0;
        font-size: 24px;
        color: #111827;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .form-group label {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
      }
      .form-group.has-error input {
        border-color: #ef4444;
      }
      .error-message {
        color: #ef4444;
        font-size: 12px;
        margin-top: 4px;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      .grid-2 {
        grid-template-columns: repeat(2, 1fr);
      }
      .full-width {
        grid-column: span 2;
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
      .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-primary {
        background: #4f46e5;
        color: white;
        border: none;
      }
      .btn-primary:hover:not(:disabled) {
        background: #4338ca;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-secondary {
        background: white;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      .btn-secondary:hover {
        background: #f9fafb;
      }

      .label-with-link {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .label-with-link label {
        margin-bottom: 0 !important;
      }
      .modal-ref-link {
        font-size: 11px;
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
        color: #4f46e5;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .color-palette {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 4px;
      }
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        border: 2px solid transparent;
      }
      .color-swatch.active {
        border-color: #111827;
        box-shadow:
          0 0 0 2px white,
          0 0 0 4px #111827;
      }
      .custom-trigger {
        background: #f3f4f6;
        border: 2px dashed #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
      }
      .custom-trigger.active {
        border: 2px solid #111827;
        background: white;
        color: #111827;
      }
      .custom-preview {
        width: 100%;
        height: 100%;
        border-radius: 6px;
      }
      .custom-color-input-wrapper {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
      }
      .color-input {
        width: 60px;
        height: 40px;
        padding: 2px;
        cursor: pointer;
      }
      .color-hex-input {
        flex: 1;
        text-transform: uppercase;
      }
      .items-center {
        align-items: center;
      }
      .shortcut-hint {
        font-size: 12px;
        color: #9ca3af;
        font-style: italic;
      }
    `,
  ],
})
export class ProjectModalComponent implements OnInit {
  @Input() projet: Partial<Projet> | null = null;
  @Output() saved = new EventEmitter<Projet>();
  @Output() closed = new EventEmitter<void>();
  @Output() openChiffres = new EventEmitter<string>();

  editableProjet: Partial<Projet> = {};
  isSaving = false;
  private externalReferenceUrlQuery = this.settingsService.getSettingQuery('external_reference_url', 'global');
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);
  isCustomColor = false;
  formErrors = { nom_projet: false };

  predefinedColors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
  ];

  readonly PROJECT_STATUTS = PROJECT_STATUS_LIST;
  private isMouseDownOnOverlay = false;

  constructor(
    private projetService: ProjetService,
    private settingsService: SettingsService,
  ) {}

  async ngOnInit() {
    this.editableProjet = this.projet
      ? { ...this.projet }
      : {
          code_projet: '',
          nom_projet: '',
          statut: 'En cours',
          description: '',
          reference_externe: '',
          color: '#3b82f6',
        };

    this.isCustomColor = this.editableProjet.color ? !this.predefinedColors.includes(this.editableProjet.color) : false;
  }

  get ngModelColor(): string {
    return this.editableProjet.color || '';
  }

  set ngModelColor(val: string) {
    this.editableProjet.color = val;
  }

  onColorHexChange(val: string) {
    if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
      this.editableProjet.color = val;
    }
  }

  selectColor(color: string) {
    this.editableProjet.color = color;
    this.isCustomColor = false;
  }

  onOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.isMouseDownOnOverlay = true;
    }
  }

  @HostListener('window:keydown.control.enter')
  handleCtrlEnter() {
    if (!this.isSaving) {
      this.save();
    }
  }

  @HostListener('window:keydown.escape')
  handleEscape() {
    this.close();
  }

  onOverlayMouseUp(event: MouseEvent) {
    if (this.isMouseDownOnOverlay && event.target === event.currentTarget) {
      this.close();
    }
    this.isMouseDownOnOverlay = false;
  }

  close() {
    this.closed.emit();
  }

  onOpenChiffres(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.editableProjet.id) {
      this.openChiffres.emit(this.editableProjet.id);
    }
  }

  async save() {
    if (!this.editableProjet.nom_projet || this.editableProjet.nom_projet.trim() === '') {
      this.formErrors.nom_projet = true;
      return;
    }

    this.isSaving = true;
    try {
      let savedProject: Projet;
      if (this.editableProjet.id) {
        savedProject = await this.projetService.updateProjet(this.editableProjet.id, this.editableProjet);
      } else {
        savedProject = await this.projetService.createProjet(this.editableProjet);
      }
      this.saved.emit(savedProject);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      this.isSaving = false;
    }
  }

  onJsonImported(data: any) {
    this.editableProjet = {
      ...this.editableProjet,
      reference_externe: data.reference_externe || this.editableProjet.reference_externe,
      nom_projet: data.nom_projet || this.editableProjet.nom_projet,
      chef_projet: data.chef_projet || this.editableProjet.chef_projet,
      description: data.description || this.editableProjet.description,
      code_projet: data.code_projet || this.editableProjet.code_projet,
    };
    this.formErrors.nom_projet = false;
  }

  Plus = Plus;
  ExternalLink = ExternalLink;
  LucideCalculator = LucideCalculator;
}
