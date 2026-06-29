import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Jalon, Projet } from '../../models/types';
import { JalonService } from '../../services/jalon.service';

@Component({
  selector: 'app-milestone-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (visible) {
      <div class="modal-overlay" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ isEditing ? 'Modifier le jalon' : 'Nouveau Jalon' }}</h2>
            <button class="modal-close" (click)="close()">×</button>
          </div>
          <form (ngSubmit)="save()" class="form">
            <div class="form-group-row">
              <div class="form-group flex-1">
                <label>Type *</label>
                <select [(ngModel)]="currentJalon.event_type" name="event_type" required (ngModelChange)="updateAutoTitle()">
                  <option value="autre">Autre</option>
                  <option value="livraison">Livraison (LV)</option>
                  <option value="maintenance">Livraison Maintenance (LVM)</option>
                  <option value="mep">Mise en production (MEP)</option>
                  <option value="sprint">Sprint (SP)</option>
                </select>
              </div>

              <div class="form-group flex-1">
                <label>Version</label>
                <input [(ngModel)]="currentJalon.version" name="version" placeholder="Ex: 1.4.0" (ngModelChange)="updateAutoTitle()">
              </div>
            </div>

            <div class="form-group-row">
              <div class="form-group flex-1">
                <label>Date *</label>
                <input type="date" [(ngModel)]="currentJalon.event_date" name="event_date" required>
              </div>

              <div class="form-group flex-1">
                <label>Titre du jalon *</label>
                <input [(ngModel)]="currentJalon.title" name="title" required placeholder="Ex: Livraison V1.4" (input)="onTitleInput()">
              </div>
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="currentJalon.description" name="description" placeholder="Description du jalon..." rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Projet</label>
              <select [(ngModel)]="currentJalon.projet_id" name="projet_id">
                <option [ngValue]="null">-- Aucun projet --</option>
                @for (p of projets; track p.id) {
                  <option [value]="p.id">{{ p.nom_projet }}</option>
                }
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="close()">Annuler</button>
              <button type="submit" class="btn btn-primary">{{ isEditing ? 'Mettre à jour' : 'Créer' }}</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
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
      max-width: 550px;
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

    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group-row {
      display: flex;
      gap: 16px;
    }

    .flex-1 {
      flex: 1;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      color: #111827;
      transition: all 0.2s;
      font-family: inherit;
      box-sizing: border-box;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
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

    /* Dark Mode */
    :host-context(body.dark-mode) .modal {
      background: #1f2937;
    }
    :host-context(body.dark-mode) .modal-header h2 {
      color: #f9fafb;
    }
    :host-context(body.dark-mode) .form-group label {
      color: #d1d5db;
    }
    :host-context(body.dark-mode) .form-group input,
    :host-context(body.dark-mode) .form-group select,
    :host-context(body.dark-mode) .form-group textarea {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }
    :host-context(body.dark-mode) .btn-secondary {
      background: #374151;
      color: #cbd5e1;
    }
    :host-context(body.dark-mode) .btn-secondary:hover {
      background: #4b5563;
    }
    :host-context(body.dark-mode) input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
    }
  `]
})
export class MilestoneModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() jalon: Partial<Jalon> | null = null;
  @Input() projets: Projet[] = [];
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  currentJalon: Partial<Jalon> = {
    title: '',
    description: '',
    version: '',
    event_date: '',
    event_type: 'autre'
  };

  isTitleManuallyEdited = false;

  constructor(private jalonService: JalonService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['jalon'] && this.jalon) {
      this.currentJalon = { ...this.jalon };
      this.isTitleManuallyEdited = false;
    } else if (changes['visible'] && this.visible && !this.jalon) {
      // Reset if opening new
      this.currentJalon = {
        title: '',
        description: '',
        version: '',
        event_date: new Date().toISOString().split('T')[0],
        event_type: 'autre'
      };
      this.isTitleManuallyEdited = false;
    }
  }

  onTitleInput() {
    this.isTitleManuallyEdited = true;
  }

  updateAutoTitle() {
    if (this.isTitleManuallyEdited || this.isEditing) {
      return;
    }
    const version = this.currentJalon.version ? this.currentJalon.version.trim() : '';
    if (!version) {
      this.currentJalon.title = '';
      return;
    }
    let prefix = '';
    switch (this.currentJalon.event_type) {
      case 'livraison':
        prefix = 'LV ';
        break;
      case 'maintenance':
        prefix = 'LVM ';
        break;
      case 'mep':
        prefix = 'MEP ';
        break;
      case 'sprint':
        prefix = 'Sprint ';
        break;
      default:
        prefix = 'Jalon ';
        break;
    }
    this.currentJalon.title = `${prefix}${version}`;
  }

  get isEditing(): boolean {
    return !!this.currentJalon.id;
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async save() {
    if (!this.currentJalon.title || !this.currentJalon.event_date) return;

    // Ensure version and description are strings (non-null) as events table has defaults/not-null constraint
    const payload: Partial<Jalon> = {
      title: this.currentJalon.title,
      event_date: this.currentJalon.event_date,
      event_type: this.currentJalon.event_type || 'autre',
      description: this.currentJalon.description || '',
      version: this.currentJalon.version || '',
      projet_id: this.currentJalon.projet_id || null
    };

    try {
      if (this.currentJalon.id) {
        await this.jalonService.updateJalon(this.currentJalon.id, payload);
      } else {
        await this.jalonService.createJalon(payload);
      }
      this.saved.emit();
      this.close();
    } catch (error) {
      console.error('Error saving jalon:', error);
    }
  }
}
