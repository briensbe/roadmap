import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService, EquipeResource } from '../services/team.service';
import { CalendarService } from '../services/calendar.service';
import { Equipe, Role, Personne, Capacite } from '../models/types';

interface ResourceRow {
  type: 'role' | 'personne';
  id: string;
  uniqueId: string;
  label: string;
  equipeId: string;
  weeks: Map<string, number>;
}

interface TeamRow {
  equipe: Equipe;
  resources: ResourceRow[];
  expanded: boolean;
}

@Component({
  selector: 'app-capacity-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="capacity-container">
      <div class="capacity-header">
        <h1>Gestion de Capacité par Équipe</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="goToToday()">Aujourd'hui</button>
        </div>
      </div>

      <div class="calendar-controls">
        <div class="date-navigation">
          <button class="btn btn-sm" (click)="goToPreviousMonth()">← Mois précédent</button>
          <button class="btn btn-sm btn-primary" (click)="goToToday()">Aujourd'hui</button>
          <button class="btn btn-sm" (click)="goToNextMonth()">Mois suivant →</button>
        </div>
      </div>

      <div class="calendar-wrapper">
        <!-- Fixed Left Column: Labels -->
        <div class="labels-column">
          <div class="labels-header">
            <span>Équipes / Ressources</span>
          </div>
          
          <ng-container *ngFor="let teamRow of teamRows">
            <div class="team-label-row">
              <div class="team-label" (click)="toggleTeam(teamRow)">
                <span class="expand-icon">{{ teamRow.expanded ? '▼' : '▶' }}</span>
                <strong>{{ teamRow.equipe.nom }}</strong>
                <button class="btn btn-xs btn-add" 
                        (click)="openAddResourceModal(teamRow.equipe); $event.stopPropagation()">
                  + Ressource
                </button>
              </div>
            </div>

            <ng-container *ngIf="teamRow.expanded">
              <div *ngFor="let resource of teamRow.resources" class="resource-label-row">
                <div class="resource-label">
                  <span class="resource-type-icon">{{ resource.type === 'role' ? '👤' : '👨' }}</span>
                  <span class="resource-name">{{ resource.label }}</span>
                  <button class="btn btn-xs btn-danger" 
                          (click)="removeResource(resource, teamRow.equipe)">
                    ×
                  </button>
                </div>
              </div>
            </ng-container>
          </ng-container>

          <div *ngIf="teamRows.length === 0" class="empty-state-label">
            <p>Aucune équipe</p>
          </div>
        </div>

        <!-- Scrollable Right Column: Weeks -->
        <div class="weeks-column">
          <div class="weeks-header">
            <div *ngFor="let week of displayedWeeks"
                 class="week-header"
                 [class.current-week]="isCurrentWeek(week)">
              <div class="week-date">{{ formatWeekHeader(week) }}</div>
              <div class="week-number">S{{ getWeekNumber(week) }}</div>
            </div>
          </div>

          <ng-container *ngFor="let teamRow of teamRows">
            <div class="team-weeks-row">
              <div *ngFor="let week of displayedWeeks" class="week-cell team-cell"></div>
            </div>

            <ng-container *ngIf="teamRow.expanded">
              <div *ngFor="let resource of teamRow.resources" 
                   class="resource-weeks-row"
                   (mousedown)="onMouseDown($event, resource)"
                   (mousemove)="onMouseMove($event, resource)"
                   (mouseup)="onMouseUp()"
                   (mouseleave)="onMouseUp()">
                <div *ngFor="let week of displayedWeeks; let i = index"
                     class="week-cell resource-cell"
                     [class.selected]="isCellSelected(resource, week)"
                     [class.has-capacity]="getCapacite(resource, week) > 0"
                     [attr.data-week-index]="i">
                  <div class="cell-content" *ngIf="getCapacite(resource, week) > 0">
                    {{ getCapacite(resource, week) }}
                  </div>
                </div>
              </div>
            </ng-container>
          </ng-container>

          <div *ngIf="teamRows.length === 0" class="empty-state-weeks">
            <p>Aucune donnée</p>
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
                 placeholder="Capacité (unités)"
                 step="0.5"
                 min="0"
                 class="bulk-input">
          <button class="btn btn-sm btn-primary" (click)="applyBulkCapacite()">
            Appliquer
          </button>
          <button class="btn btn-sm btn-secondary" (click)="clearSelection()">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <div *ngIf="showAddResourceModal" class="modal-overlay" (click)="showAddResourceModal = false">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Ajouter une Ressource à {{ selectedEquipe?.nom }}</h2>
          <button class="modal-close" (click)="showAddResourceModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Type de ressource</label>
            <select [(ngModel)]="resourceTypeToAdd" class="form-control">
              <option value="role">Rôle</option>
              <option value="personne">Personne</option>
            </select>
          </div>

          <div class="form-group" *ngIf="resourceTypeToAdd === 'role'">
            <label>Sélectionner un rôle</label>
            <select [(ngModel)]="selectedResourceId" class="form-control">
              <option value="">-- Choisir un rôle --</option>
              <option *ngFor="let role of availableRoles" [value]="role.id">
                {{ role.nom }} ({{ role.jours_par_semaine }}j/sem)
              </option>
            </select>
          </div>

          <div class="form-group" *ngIf="resourceTypeToAdd === 'personne'">
            <label>Sélectionner une personne</label>
            <select [(ngModel)]="selectedResourceId" class="form-control">
              <option value="">-- Choisir une personne --</option>
              <option *ngFor="let personne of availablePersonnes" [value]="personne.id">
                {{ personne.prenom }} {{ personne.nom }} ({{ personne.jours_par_semaine }}j/sem)
              </option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="btn btn-primary" 
                    (click)="addResourceToTeam()"
                    [disabled]="!selectedResourceId">
              Ajouter
            </button>
            <button class="btn btn-secondary" (click)="showAddResourceModal = false">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .capacity-container {
      padding: 20px;
      background: #f5f7fa;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden; /* Prevent horizontal scroll of entire container */
    }

    .capacity-header {
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

    /* Two-column layout wrapper */
    .calendar-wrapper {
      display: flex;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      max-height: calc(100vh - 200px);
      position: relative; /* Ensure it stays in place */
    }

    /* Fixed left column for labels */
    .labels-column {
      width: 300px;
      flex-shrink: 0;
      border-right: 2px solid #e2e8f0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .labels-header {
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 10;
      min-height: 60px;
      display: flex;
      align-items: center;
    }

    .team-label-row {
      border-bottom: 1px solid #e2e8f0;
      background: #f9fafb;
    }

    .team-label {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: 600;
      user-select: none;
      min-height: 48px;
    }

    .team-label:hover {
      background: #f3f4f6;
    }

    .expand-icon {
      font-size: 12px;
      color: #6b7280;
    }

    .resource-label-row {
      border-bottom: 1px solid #e2e8f0;
      background: white;
    }

    .resource-label-row:hover {
      background: #f9fafb;
    }

    .resource-label {
      padding: 12px 16px 12px 32px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
    }

    .resource-type-icon {
      font-size: 16px;
    }

    .resource-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-add {
      margin-left: auto;
      padding: 2px 8px;
      font-size: 11px;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .empty-state-label {
      padding: 40px 20px;
      text-align: center;
      color: #6b7280;
    }

    /* Scrollable right column for weeks */
    .weeks-column {
      flex: 1;
      overflow-x: auto;
      overflow-y: auto;
    }

    .weeks-header {
      display: flex;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
      min-height: 60px;
    }

    .week-header {
      min-width: 80px;
      width: 80px;
      padding: 8px;
      text-align: center;
      border-right: 1px solid #e2e8f0;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
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

    .team-weeks-row {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      background: #f9fafb;
      min-height: 48px;
    }

    .resource-weeks-row {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      background: white;
      min-height: 48px;
      user-select: none;
    }

    .resource-weeks-row:hover {
      background: #f9fafb;
    }

    .week-cell {
      min-width: 80px;
      width: 80px;
      padding: 8px;
      border-right: 1px solid #e2e8f0;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .team-cell {
      background: #f9fafb;
    }

    .resource-cell {
      cursor: pointer;
      transition: background 0.15s ease;
      position: relative;
    }

    .resource-cell:hover {
      background: #f3f4f6;
    }

    .resource-cell.selected {
      background: #dbeafe;
      border: 2px solid #3b82f6;
    }

    .resource-cell.has-capacity {
      background: #d1fae5;
      font-weight: 600;
      color: #059669;
    }

    .resource-cell.has-capacity.selected {
      background: #a7f3d0;
      border: 2px solid #3b82f6;
    }

    .cell-content {
      font-size: 13px;
    }

    .empty-state-weeks {
      padding: 40px;
      text-align: center;
      color: #6b7280;
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
      width: 150px;
      padding: 6px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
    }

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
    }

    .modal {
      background: white;
      border-radius: 12px;
      min-width: 500px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 18px;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .modal-close:hover {
      background: #f3f4f6;
    }

    .modal-body {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
    }

    .form-control {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
  `]
})
export class CapacityViewComponent implements OnInit {
  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  teamRows: TeamRow[] = [];

  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  showAddResourceModal = false;
  selectedEquipe: Equipe | null = null;
  resourceTypeToAdd: 'role' | 'personne' = 'role';
  selectedResourceId: string = '';

  // Drag selection
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  dragStartWeekIndex: number = -1;
  dragEndWeekIndex: number = -1;
  selectedCells: Array<{ resource: ResourceRow; week: Date }> = [];

  bulkCapaciteValue: number = 1;

  constructor(
    private teamService: TeamService,
    private calendarService: CalendarService
  ) { }

  async ngOnInit() {
    this.generateWeeks();
    await this.loadData();
  }

  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.calendarService.getWeekStart(startDate);

    for (let i = 0; i < 32; i++) {
      const week = new Date(firstWeek);
      week.setDate(week.getDate() + (i * 7));
      this.displayedWeeks.push(week);
    }
  }

  async loadData() {
    try {
      const equipes = await this.teamService.getAllEquipes();
      this.availableRoles = await this.teamService.getAllRoles();
      this.availablePersonnes = await this.teamService.getAllPersonnes();

      this.teamRows = [];

      for (const equipe of equipes) {
        const resources = await this.teamService.getEquipeResources(equipe.id!);
        const resourceRows: ResourceRow[] = [];

        for (const resource of resources) {
          const capacites = await this.teamService.getCapacites(resource.id, resource.type, equipe.id!);
          const weeks = new Map<string, number>();

          capacites.forEach(cap => {
            const weekStr = this.calendarService.formatWeekStart(new Date(cap.semaine_debut));
            weeks.set(weekStr, cap.capacite);
          });

          resourceRows.push({
            type: resource.type,
            id: resource.id,
            uniqueId: resource.uniqueId,
            label: resource.type === 'role'
              ? resource.nom
              : `${resource.prenom} ${resource.nom}`,
            equipeId: equipe.id!,
            weeks
          });
        }

        this.teamRows.push({
          equipe,
          resources: resourceRows,
          expanded: true
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
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

  getCapacite(resource: ResourceRow, week: Date): number {
    const weekStr = this.calendarService.formatWeekStart(week);
    return resource.weeks.get(weekStr) || 0;
  }

  toggleTeam(teamRow: TeamRow) {
    teamRow.expanded = !teamRow.expanded;
  }

  openAddResourceModal(equipe: Equipe) {
    this.selectedEquipe = equipe;
    this.resourceTypeToAdd = 'role';
    this.selectedResourceId = '';
    this.showAddResourceModal = true;
  }

  async addResourceToTeam() {
    if (!this.selectedEquipe || !this.selectedResourceId) return;

    try {
      if (this.resourceTypeToAdd === 'role') {
        await this.teamService.addRoleToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      } else {
        await this.teamService.addPersonneToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      }

      this.showAddResourceModal = false;
      await this.loadData();
    } catch (error) {
      console.error('Error adding resource:', error);
    }
  }

  async removeResource(resource: ResourceRow, equipe: Equipe) {
    if (!confirm(`Retirer ${resource.label} de l'équipe ${equipe.nom} ?`)) return;

    try {
      if (resource.type === 'role') {
        await this.teamService.removeRoleFromEquipe(resource.id, equipe.id!);
      } else {
        await this.teamService.removePersonneFromEquipe(resource.id);
      }

      await this.loadData();
    } catch (error) {
      console.error('Error removing resource:', error);
    }
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow) {
    this.isDragging = true;
    this.dragStartResource = resource;

    const target = event.target as HTMLElement;
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
      if (indexStr) {
        this.dragStartWeekIndex = parseInt(indexStr, 10);
        this.dragEndWeekIndex = this.dragStartWeekIndex;
        this.updateSelection();
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow) {
    if (!this.isDragging || !this.dragStartResource) return;

    if (resource.uniqueId !== this.dragStartResource.uniqueId) return;

    const target = event.target as HTMLElement;
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
      if (indexStr) {
        const newIndex = parseInt(indexStr, 10);
        if (newIndex !== this.dragEndWeekIndex) {
          this.dragEndWeekIndex = newIndex;
          this.updateSelection();
        }
      }
    }
  }

  onMouseUp() {
    this.isDragging = false;
  }

  updateSelection() {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: this.displayedWeeks[i]
      });
    }
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some(
      s => s.resource.uniqueId === resource.uniqueId &&
        s.week.getTime() === week.getTime()
    );
  }

  clearSelection() {
    this.selectedCells = [];
    this.dragStartResource = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
  }

  async applyBulkCapacite() {
    if (this.selectedCells.length === 0 || !this.bulkCapaciteValue) return;

    try {
      for (const cell of this.selectedCells) {
        const weekStr = this.calendarService.formatWeekStart(cell.week);
        await this.teamService.saveCapacite(
          cell.resource.id,
          cell.resource.type,
          cell.resource.equipeId,
          weekStr,
          this.bulkCapaciteValue
        );

        // Update local data
        cell.resource.weeks.set(weekStr, this.bulkCapaciteValue);
      }

      this.clearSelection();
    } catch (error) {
      console.error('Error saving capacities:', error);
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
}
