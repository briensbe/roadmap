import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Jalon, Projet } from '../models/types';
import { JalonService } from '../services/jalon.service';

@Component({
    selector: 'app-milestone-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div *ngIf="visible" class="modal-overlay" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Modifier le jalon' : 'Nouveau Jalon' }}</h2>
          <button class="modal-close" (click)="close()">×</button>
        </div>
        <form (ngSubmit)="save()" class="form">
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
            <button type="button" class="btn btn-secondary" (click)="close()">Annuler</button>
            <button type="submit" class="btn btn-primary">{{ isEditing ? 'Mettre à jour' : 'Créer' }}</button>
          </div>
        </form>
      </div>
    </div>
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
  `]
})
export class MilestoneModalComponent implements OnChanges {
    @Input() visible = false;
    @Input() jalon: Partial<Jalon> | null = null;
    @Input() projets: Projet[] = [];
    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() saved = new EventEmitter<void>();

    currentJalon: Partial<Jalon> = { nom: '', date_jalon: '', type: '' };

    constructor(private jalonService: JalonService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['jalon'] && this.jalon) {
            this.currentJalon = { ...this.jalon };
        } else if (changes['visible'] && this.visible && !this.jalon) {
            // Reset if opening new
            this.currentJalon = {
                nom: '',
                date_jalon: new Date().toISOString().split('T')[0],
                type: ''
            };
        }
    }

    get isEditing(): boolean {
        return !!this.currentJalon.id;
    }

    close() {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    async save() {
        if (!this.currentJalon.nom || !this.currentJalon.date_jalon) return;

        try {
            if (this.currentJalon.id) {
                await this.jalonService.updateJalon(this.currentJalon.id, this.currentJalon);
            } else {
                await this.jalonService.createJalon(this.currentJalon);
            }
            this.saved.emit();
            this.close();
        } catch (error) {
            console.error('Error saving jalon:', error);
        }
    }
}
