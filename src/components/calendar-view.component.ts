import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarService } from '../services/calendar.service';
import { ProjetService } from '../services/projet.service';
import { ResourceService } from '../services/resource.service';
import { Projet, Charge, Capacite, Jalon, WeekData } from '../models/types';
import { ResourceManagerComponent } from './resource-manager.component';

interface CalendarRow {
  type: 'projet' | 'resource';
  id: string;
  label: string;
  projet?: Projet;
  weeks: Map<string, {
    capacite?: number;
    charge?: number;
    disponible?: number;
  }>;
  totalJours?: number;
}

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceManagerComponent],
  template: `
    <div class="calendar-container">
      <div class="calendar-header">
        <h1>Planification des Ressources</h1>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="showProjectModal = true">+ Nouveau Projet</button>
          <button class="btn btn-secondary" (click)="showResourceModal = true">+ Nouvelle Ressource</button>
        </div>
      </div>

      <div class="calendar-controls">
        <div class="date-navigation">
          <button class="btn btn-sm" (click)="goToPreviousMonth()">← Mois précédent</button>
          <button class="btn btn-sm btn-primary" (click)="goToToday()">Aujourd'hui</button>
          <button class="btn btn-sm" (click)="goToNextMonth()">Mois suivant →</button>
        </div>

        <div class="view-controls">
          <select [(ngModel)]="viewMode" (change)="onViewModeChange()">
            <option value="project">Vue par Projet</option>
            <option value="resource">Vue par Ressource</option>
          </select>
        </div>
      </div>

      <div class="calendar-grid-wrapper">
        <div class="calendar-grid">
          <div class="grid-header sticky-header">
            <div class="row-label-header">
              <span>{{ viewMode === 'project' ? 'Projets' : 'Ressources' }}</span>
            </div>
            <div class="weeks-header">
              <div *ngFor="let week of displayedWeeks"
                   class="week-header"
                   [class.current-week]="isCurrentWeek(week)">
                <div class="week-date">{{ formatWeekHeader(week) }}</div>
                <div class="week-number">S{{ getWeekNumber(week) }}</div>
              </div>
            </div>
            <div class="metrics-header">Métriques</div>
          </div>

          <div class="jalons-row sticky-jalons" *ngIf="jalons.length > 0">
            <div class="row-label">Jalons</div>
            <div class="weeks-content">
              <div *ngFor="let week of displayedWeeks" class="week-cell jalon-cell">
                <div *ngFor="let jalon of getJalonsForWeek(week)"
                     class="jalon-marker"
                     [title]="jalon.nom">
                  📍 {{ jalon.nom }}
                </div>
              </div>
            </div>
            <div class="metrics-cell"></div>
          </div>

          <div *ngFor="let row of calendarRows" class="calendar-row">
            <div class="row-label">
              <div class="row-label-content">
                <strong>{{ row.label }}</strong>
                <div class="row-label-meta text-sm text-gray" *ngIf="row.projet">
                  <span>{{ row.projet.code_projet }}</span>
                  <span *ngIf="row.projet.chef_projet"> • {{ row.projet.chef_projet }}</span>
                </div>
              </div>
            </div>

            <div class="weeks-content">
              <div *ngFor="let week of displayedWeeks"
                   class="week-cell"
                   [class.negative]="isNegative(row, week)"
                   [class.zero]="isZero(row, week)"
                   (click)="onCellClick(row, week)"
                   [class.selected]="isCellSelected(row, week)">
                <div class="cell-content">
                  <div class="capacite" *ngIf="getCapacite(row, week) !== undefined">
                    Cap: {{ getCapacite(row, week) }}
                  </div>
                  <div class="charge" *ngIf="getCharge(row, week) !== undefined">
                    Chg: {{ getCharge(row, week) }}
                  </div>
                  <div class="disponible" *ngIf="getDisponible(row, week) !== undefined">
                    Disp: {{ getDisponible(row, week) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="metrics-cell">
              <div *ngIf="row.projet" class="projet-metrics">
                <div class="metric"><label>Initial:</label> {{ row.projet.chiffrage_initial }}j</div>
                <div class="metric"><label>Révisé:</label> {{ row.projet.chiffrage_revise }}j</div>
                <div class="metric"><label>Prév:</label> {{ row.projet.chiffrage_previsionnel }}j</div>
                <div class="metric"><label>Cons:</label> {{ row.projet.temps_consomme }}j</div>
                <div class="metric"><label>RAF:</label> {{ calculateRAF(row.projet) }}j</div>
                <div class="metric metric-highlight"><label>Planifié:</label> {{ row.totalJours || 0 }}j</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="selectedCells.length > 0" class="selection-toolbar">
        <div class="selection-info">
          {{ selectedCells.length }} semaine(s) sélectionnée(s)
        </div>
        <div class="selection-actions">
          <input type="number"
                 [(ngModel)]="bulkCapaciteValue"
                 placeholder="Capacité"
                 step="0.5"
                 class="bulk-input">
          <button class="btn btn-sm btn-primary" (click)="applyBulkCapacite()">
            Appliquer Capacité
          </button>

          <input type="number"
                 [(ngModel)]="bulkChargeValue"
                 placeholder="Charge"
                 step="0.5"
                 class="bulk-input">
          <button class="btn btn-sm btn-success" (click)="applyBulkCharge()">
            Appliquer Charge
          </button>

          <button class="btn btn-sm btn-secondary" (click)="clearSelection()">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <div *ngIf="showResourceModal" class="modal-overlay" (click)="showResourceModal = false">
      <div class="modal modal-large" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Gérer les Ressources</h2>
          <button class="modal-close" (click)="showResourceModal = false">×</button>
        </div>
        <app-resource-manager (resourceCreated)="onResourceCreated()"></app-resource-manager>
      </div>
    </div>

    <div *ngIf="showProjectModal" class="modal-overlay" (click)="showProjectModal = false">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Nouveau Projet</h2>
          <button class="modal-close" (click)="showProjectModal = false">×</button>
        </div>
        <form (ngSubmit)="createProjet()" class="form">
          <div class="form-group">
            <label>Code Projet *</label>
            <input [(ngModel)]="newProjet.code_projet" name="code" required>
          </div>
          <div class="form-group">
            <label>Nom Projet *</label>
            <input [(ngModel)]="newProjet.nom_projet" name="nom" required>
          </div>
          <div class="form-group">
            <label>Chef de Projet</label>
            <input [(ngModel)]="newProjet.chef_projet" name="chef">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select [(ngModel)]="newProjet.statut" name="statut">
              <option value="En cours">En cours</option>
              <option value="Planifié">Planifié</option>
              <option value="Terminé">Terminé</option>
              <option value="En pause">En pause</option>
            </select>
          </div>
          <div class="grid grid-3">
            <div class="form-group">
              <label>Chiffrage Initial</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_initial" name="initial">
            </div>
            <div class="form-group">
              <label>Chiffrage Révisé</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_revise" name="revise">
            </div>
            <div class="form-group">
              <label>Chiffrage Prévisionnel</label>
              <input type="number" [(ngModel)]="newProjet.chiffrage_previsionnel" name="prev">
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="newProjet.description" name="desc" rows="3"></textarea>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="submit" class="btn btn-primary">Créer</button>
            <button type="button" class="btn btn-secondary" (click)="showProjectModal = false">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      padding: 20px;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .calendar-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .date-navigation {
      display: flex;
      gap: 8px;
    }

    .calendar-grid-wrapper {
      overflow-x: auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .calendar-grid {
      min-width: 1200px;
      display: flex;
      flex-direction: column;
    }

    .grid-header {
      display: grid;
      grid-template-columns: 250px 1fr 200px;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .row-label-header {
      padding: 12px 16px;
      border-right: 1px solid #e2e8f0;
    }

    .weeks-header {
      display: flex;
      overflow-x: auto;
    }

    .week-header {
      min-width: 100px;
      padding: 8px;
      text-align: center;
      border-right: 1px solid #e2e8f0;
      font-size: 12px;
    }

    .week-header.current-week {
      background: #dbeafe;
      border-left: 2px solid #3b82f6;
      border-right: 2px solid #3b82f6;
    }

    .week-date {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .week-number {
      font-size: 11px;
      color: #6b7280;
    }

    .metrics-header {
      padding: 12px 16px;
      border-left: 1px solid #e2e8f0;
    }

    .jalons-row {
      display: grid;
      grid-template-columns: 250px 1fr 200px;
      border-bottom: 1px solid #e2e8f0;
      background: #fef3c7;
      position: sticky;
      top: 60px;
      z-index: 99;
    }

    .calendar-row {
      display: grid;
      grid-template-columns: 250px 1fr 200px;
      border-bottom: 1px solid #e2e8f0;
      transition: background 0.15s ease;
    }

    .calendar-row:hover {
      background: #f9fafb;
    }

    .row-label {
      padding: 16px;
      border-right: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
    }

    .row-label-content {
      width: 100%;
    }

    .row-label-meta {
      margin-top: 4px;
    }

    .weeks-content {
      display: flex;
      overflow-x: auto;
    }

    .week-cell {
      min-width: 100px;
      padding: 8px;
      border-right: 1px solid #e2e8f0;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .week-cell:hover {
      background: #f3f4f6;
    }

    .week-cell.selected {
      background: #dbeafe;
      border: 2px solid #3b82f6;
    }

    .week-cell.negative {
      background: #fee2e2;
    }

    .week-cell.zero {
      background: #fef3c7;
    }

    .cell-content {
      font-size: 12px;
      line-height: 1.4;
    }

    .capacite {
      color: #059669;
      font-weight: 500;
    }

    .charge {
      color: #dc2626;
      font-weight: 500;
    }

    .disponible {
      color: #2563eb;
      font-weight: 600;
      margin-top: 4px;
    }

    .jalon-cell {
      padding: 4px;
    }

    .jalon-marker {
      font-size: 11px;
      background: #fbbf24;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metrics-cell {
      padding: 12px 16px;
      border-left: 1px solid #e2e8f0;
      font-size: 12px;
    }

    .projet-metrics {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .metric label {
      color: #6b7280;
      font-weight: 500;
    }

    .metric-highlight {
      font-weight: 600;
      color: #2563eb;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      margin-top: 4px;
    }

    .selection-toolbar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1000;
    }

    .selection-info {
      font-weight: 600;
      color: #374151;
    }

    .selection-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .bulk-input {
      width: 100px;
    }

    .form {
      width: 100%;
    }

    .modal-large {
      min-width: 800px;
    }
  `]
})
export class CalendarViewComponent implements OnInit {
  viewMode: 'project' | 'resource' = 'project';
  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  projets: Projet[] = [];
  charges: Charge[] = [];
  capacites: Capacite[] = [];
  jalons: Jalon[] = [];

  calendarRows: CalendarRow[] = [];

  selectedCells: Array<{ row: CalendarRow; week: Date }> = [];
  bulkCapaciteValue: number = 1;
  bulkChargeValue: number = 1;

  showProjectModal = false;
  showResourceModal = false;

  newProjet: Partial<Projet> = {
    code_projet: '',
    nom_projet: '',
    statut: 'En cours',
    chiffrage_initial: 0,
    chiffrage_revise: 0,
    chiffrage_previsionnel: 0,
    temps_consomme: 0
  };

  constructor(
    private calendarService: CalendarService,
    private projetService: ProjetService,
    private resourceService: ResourceService
  ) {}

  async ngOnInit() {
    this.generateWeeks();
    await this.loadData();
  }

  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.calendarService.getWeekStart(startDate);

    for (let i = 0; i < 16; i++) {
      const week = new Date(firstWeek);
      week.setDate(week.getDate() + (i * 7));
      this.displayedWeeks.push(week);
    }
  }

  async loadData() {
    try {
      this.projets = await this.projetService.getAllProjets();
      this.charges = await this.calendarService.getCharges();
      this.jalons = await this.calendarService.getJalons();
      this.buildCalendarRows();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  buildCalendarRows() {
    this.calendarRows = [];

    if (this.viewMode === 'project') {
      this.projets.forEach(projet => {
        const row: CalendarRow = {
          type: 'projet',
          id: projet.id!,
          label: projet.nom_projet,
          projet: projet,
          weeks: new Map(),
          totalJours: 0
        };

        const projetCharges = this.charges.filter(c => c.projet_id === projet.id);

        this.displayedWeeks.forEach(week => {
          const weekStr = this.calendarService.formatWeekStart(week);
          const chargesForWeek = projetCharges.filter(c => {
            const start = new Date(c.semaine_debut);
            const end = new Date(c.semaine_fin);
            return week >= start && week <= end;
          });

          const totalCharge = chargesForWeek.reduce((sum, c) => sum + c.unite_ressource, 0);

          if (totalCharge > 0) {
            row.weeks.set(weekStr, { charge: totalCharge });
            row.totalJours = (row.totalJours || 0) + (totalCharge * 5);
          }
        });

        this.calendarRows.push(row);
      });
    }
  }

  formatWeekHeader(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentWeekStart = this.calendarService.getWeekStart(now);
    return this.calendarService.formatWeekStart(date) ===
           this.calendarService.formatWeekStart(currentWeekStart);
  }

  getCapacite(row: CalendarRow, week: Date): number | undefined {
    const weekStr = this.calendarService.formatWeekStart(week);
    return row.weeks.get(weekStr)?.capacite;
  }

  getCharge(row: CalendarRow, week: Date): number | undefined {
    const weekStr = this.calendarService.formatWeekStart(week);
    return row.weeks.get(weekStr)?.charge;
  }

  getDisponible(row: CalendarRow, week: Date): number | undefined {
    const weekStr = this.calendarService.formatWeekStart(week);
    const data = row.weeks.get(weekStr);
    if (data?.capacite !== undefined && data?.charge !== undefined) {
      return data.capacite - data.charge;
    }
    return undefined;
  }

  isNegative(row: CalendarRow, week: Date): boolean {
    const disp = this.getDisponible(row, week);
    return disp !== undefined && disp < 0;
  }

  isZero(row: CalendarRow, week: Date): boolean {
    const disp = this.getDisponible(row, week);
    return disp === 0;
  }

  getJalonsForWeek(week: Date): Jalon[] {
    const weekStr = this.calendarService.formatWeekStart(week);
    return this.jalons.filter(j => {
      const jalonWeek = this.calendarService.getWeekStart(new Date(j.date_jalon));
      return this.calendarService.formatWeekStart(jalonWeek) === weekStr;
    });
  }

  onCellClick(row: CalendarRow, week: Date) {
    const existing = this.selectedCells.findIndex(
      s => s.row.id === row.id && s.week.getTime() === week.getTime()
    );

    if (existing >= 0) {
      this.selectedCells.splice(existing, 1);
    } else {
      this.selectedCells.push({ row, week });
    }
  }

  isCellSelected(row: CalendarRow, week: Date): boolean {
    return this.selectedCells.some(
      s => s.row.id === row.id && s.week.getTime() === week.getTime()
    );
  }

  clearSelection() {
    this.selectedCells = [];
  }

  async applyBulkCapacite() {
    console.log('Apply bulk capacite:', this.bulkCapaciteValue);
    this.clearSelection();
  }

  async applyBulkCharge() {
    console.log('Apply bulk charge:', this.bulkChargeValue);
    this.clearSelection();
  }

  calculateRAF(projet: Projet): number {
    return this.projetService.calculateRAF(projet);
  }

  async createProjet() {
    try {
      await this.projetService.createProjet(this.newProjet);
      this.showProjectModal = false;
      this.newProjet = {
        code_projet: '',
        nom_projet: '',
        statut: 'En cours',
        chiffrage_initial: 0,
        chiffrage_revise: 0,
        chiffrage_previsionnel: 0,
        temps_consomme: 0
      };
      await this.loadData();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateWeeks();
  }

  goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateWeeks();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateWeeks();
  }

  onViewModeChange() {
    this.buildCalendarRows();
  }

  onResourceCreated() {
    this.loadData();
  }
}
