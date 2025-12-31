import { Component, OnInit, ViewChild, ElementRef, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../services/team.service";
import { CalendarService } from "../services/calendar.service";
import { Equipe, Role, Personne, Capacite, EquipeResource } from "../models/types";
import { LucideAngularModule, ChevronDown, ChevronRight, Plus, User, Users, Contact } from "lucide-angular";

@NgModule({
  imports: [LucideAngularModule.pick({ ChevronDown, ChevronRight, Plus, User, Users, Contact })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

interface ResourceRow {
  type: "role" | "personne";
  id: string;
  uniqueId: string;
  label: string;
  equipeId: string;
  weeks: Map<string, number>;
  jours_par_semaine: number;
  color?: string;
}

interface TeamRow {
  equipe: Equipe;
  resources: ResourceRow[];
  expanded: boolean;
}

@Component({
  selector: "app-capacity-view",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule],
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

        <div class="controls-right" style="display:flex;align-items:center;gap:12px;">
          <label class="ios-switch" title="Afficher les jours (j)">
            <input type="checkbox" [(ngModel)]="showDaysInCells" />
            <span class="ios-slider"></span>
          </label>
          <span style="user-select:none;">Afficher les jours (j) dans les cellules</span>
        </div>
      </div>

      <div class="calendar-wrapper">
        <div class="calendar-grid">
          <!-- Header Row -->
          <div class="calendar-header-row sticky-top">
            <div class="label-header-cell sticky-col">
              <span>Équipes / Ressources</span>
            </div>
            <div class="weeks-header-container">
              <div *ngFor="let week of displayedWeeks" class="week-header-cell" [class.current-week]="isCurrentWeek(week)">
                <div class="week-date">{{ formatWeekHeader(week) }}</div>
                <div class="week-number">S{{ getWeekNumber(week) }}</div>
              </div>
            </div>
          </div>

          <!-- Body Rows -->
          <div class="calendar-body">
            <ng-container *ngFor="let teamRow of teamRows">
              <!-- Team Row -->
              <div class="calendar-row team-row-container">
                <div class="label-cell team-label-cell sticky-col" (click)="toggleTeam(teamRow)" [style.cursor]="teamRow.resources.length > 0 ? 'pointer' : 'default'">
                  <lucide-icon
                    [name]="teamRow.expanded ? 'chevron-down' : 'chevron-right'"
                    [size]="18"
                    class="expand-icon-l"
                    [style.visibility]="teamRow.resources.length > 0 ? 'visible' : 'hidden'"
                  ></lucide-icon>
                  <div class="row-info-stack-wrapper">
                    <div class="color-bar-container">
                      <div class="color-bar-v" [style.background-color]="teamRow.equipe.color || '#94a3b8'"></div>
                    </div>
                    <div class="info-stack">
                      <span class="info-label">{{ teamRow.equipe.nom }}</span>
                    </div>
                  </div>
                  <button
                    class="btn-hover-add"
                    (click)="openAddResourceModal(teamRow.equipe); $event.stopPropagation()"
                  >
                    <lucide-icon [name]="'plus'" [size]="14"></lucide-icon>
                    Ressource
                  </button>
                </div>
                <div class="weeks-cells-container">
                  <div *ngFor="let week of displayedWeeks" class="week-cell team-cell">
                    <div class="team-summary" *ngIf="getTeamTotalCapacity(teamRow, week) > 0">
                      <div class="capacity-value">
                        {{ getTeamTotalCapacity(teamRow, week) | number : "1.0-1" }}
                      </div>
                      <div class="days-value" *ngIf="showDaysInCells">
                        {{ getTeamTotalDays(teamRow, week) | number : "1.1-1" }}j
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Resource Rows -->
              <ng-container *ngIf="teamRow.expanded">
                <div *ngFor="let resource of teamRow.resources" 
                     class="calendar-row resource-row-container"
                     [attr.data-resource-id]="resource.uniqueId"
                     (mousedown)="onMouseDown($event, resource)"
                     (mousemove)="onMouseMove($event, resource)"
                     (mouseup)="onMouseUp()"
                     (mouseleave)="onMouseUp()">
                  <div class="label-cell resource-label-cell sticky-col">
                    <div class="resource-icon-wrapper" [style.background-color]="resource.color || '#e2e8f0'">
                      <lucide-icon [name]="resource.type === 'role' ? 'contact' : 'user'" [size]="14" class="resource-icon"></lucide-icon>
                    </div>
                    <span class="resource-name">{{ resource.label }}</span>
                    <div class="resource-total-badge" 
                         (click)="openYearPopover($event)" 
                         [title]="'Cliquer pour filtrer par année'">
                      <span class="badge-prefix">{{ getBadgePrefix() }}</span>
                      <span class="badge-val">{{ getResourceTotalPlannedDays(resource) | number : '1.0-1' }}</span>
                      <span class="badge-unit">j</span>
                    </div>
                    <button class="btn-hover-delete" (click)="removeResource(resource, teamRow.equipe)">×</button>
                  </div>
                  <div class="weeks-cells-container">
                    <div
                      *ngFor="let week of displayedWeeks; let i = index"
                      class="week-cell resource-cell"
                      [class.selected]="isCellSelected(resource, week)"
                      [class.has-capacity]="getCapacite(resource, week) > 0"
                      [attr.data-week-index]="i"
                    >
                      <div class="cell-content" *ngIf="getCapacite(resource, week) > 0">
                        <div class="capacity-value">{{ getCapacite(resource, week) }}</div>
                        <div class="days-value" *ngIf="showDaysInCells">
                          {{ getCapacite(resource, week) * resource.jours_par_semaine | number : "1.1-1" }}j
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-container>
            </ng-container>

            <!-- Empty State -->
            <div *ngIf="teamRows.length === 0" class="calendar-row empty-state-row">
              <div class="label-cell empty-state-label sticky-col">Aucune équipe</div>
              <div class="weeks-cells-container empty-state-weeks">Aucune donnée</div>
            </div>
          </div>
        </div>
      </div>

      <div 
        *ngIf="selectedCells.length > 0 && isSelectionFinished" 
        class="selection-toolbar"
        [style.top.px]="toolbarPosition?.top"
        [style.left.px]="toolbarPosition?.left"
        [style.transform]="'translate(-50%, 10px)'"
        [style.opacity]="toolbarVisible ? 1 : 0">
        <div class="selection-info">
          {{ selectedCells.length }} semaine(s) sélectionnée(s)
          <div class="selection-total">
            Total jours sélectionnés: {{ totalSelectedDays | number : "1.1-1" }}j
          </div>
        </div>
        <div class="selection-input-row">
          <input
            #bulkCapaciteInput
            type="number"
            [(ngModel)]="bulkCapaciteValue"
            placeholder="Capacité (unités)"
            step="0.5"
            min="0"
            class="bulk-input"
            (keydown.enter)="applyBulkCapacite()"
          />
        </div>
        <div class="selection-actions">
          <button class="btn btn-sm btn-secondary" (click)="clearSelection()">Annuler</button>
          <button class="btn btn-sm btn-primary" (click)="applyBulkCapacite()">Appliquer</button>
        </div>
      </div>

      <!-- Year Selection Popover -->
      <div *ngIf="showYearPopover" 
           class="year-popover" 
           [style.top.px]="popoverPosition?.top" 
           [style.left.px]="popoverPosition?.left"
           (click)="$event.stopPropagation()">
        <div class="popover-arrow"></div>
        <div class="popover-content">
          <button class="popover-item" [class.active]="selectedCapacityYear === 'all'" (click)="selectYear('all')">
            Tout cumulé
          </button>
          <button class="popover-item" [class.active]="selectedCapacityYear === '2025'" (click)="selectYear('2025')">
            Année 2025
          </button>
          <button class="popover-item" [class.active]="selectedCapacityYear === '2026'" (click)="selectYear('2026')">
            Année 2026
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
            <div *ngIf="availableRoles.length === 0" class="no-roles-message">
              <p>Aucun rôle disponible. Tous les rôles sont déjà utilisés.</p>
            </div>
            <select *ngIf="availableRoles.length > 0" [(ngModel)]="selectedResourceId" class="form-control">
              <option value="">-- Choisir un rôle --</option>
              <option *ngFor="let role of availableRoles" [value]="role.id">
                {{ role.nom }} ({{ role.jours_par_semaine }}j/sem)
              </option>
            </select>
          </div>

          <div class="form-group" *ngIf="resourceTypeToAdd === 'personne'">
            <label>Sélectionner une personne</label>
            <div *ngIf="availablePersonnes.length === 0" class="no-roles-message">
              <p>Aucune personne disponible.</p>
            </div>
            <select *ngIf="availablePersonnes.length > 0" [(ngModel)]="selectedResourceId" class="form-control">
              <option value="">-- Choisir une personne --</option>
              <option *ngFor="let personne of availablePersonnes" [value]="personne.id">
                {{ personne.prenom }} {{ personne.nom }} ({{ personne.jours_par_semaine }}j/sem)
              </option>
            </select>
          </div>

          <div class="modal-actions">
            <button
              class="btn btn-primary"
              (click)="addResourceToTeam()"
              [disabled]="
                !selectedResourceId ||
                (resourceTypeToAdd === 'role' && availableRoles.length === 0) ||
                (resourceTypeToAdd === 'personne' && availablePersonnes.length === 0)
              "
            >
              Ajouter
            </button>
            <button class="btn btn-secondary" (click)="showAddResourceModal = false">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
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
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: auto;
        max-height: calc(100vh - 200px);
        position: relative;
      }

      .calendar-grid {
        display: flex;
        flex-direction: column;
        min-width: max-content;
      }

      .calendar-header-row {
        display: flex;
        background: #f8fafc;
        border-bottom: 2px solid #e2e8f0;
        z-index: 100;
        min-height: 60px;
        position: sticky;
        top: 0;
      }

      .label-header-cell {
        width: 350px;
        padding: 12px 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        border-right: 2px solid #e2e8f0;
        flex-shrink: 0;
        background: #f8fafc; /* Opaque background to hide weeks during horizontal scroll */
      }

      .weeks-header-container {
        display: flex;
        flex: 1;
      }

      .week-header-cell {
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

      .week-header-cell.current-week {
        background: #dbeafe;
        border-left: 1px solid #3b82f6;
        border-right: 1px solid #3b82f6;
      }

      .week-date {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .week-number {
        font-size: 11px;
        color: #6b7280;
      }

      .calendar-body {
        display: flex;
        flex-direction: column;
      }

      .calendar-row {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        min-height: 48px;
      }

      .label-cell {
        width: 350px;
        flex-shrink: 0;
        padding: 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-right: 2px solid #e2e8f0;
        background: inherit;
        position: relative;
      }

      .team-label-cell {
        background: #f9fafb;
        font-weight: 700;
      }

      .resource-label-cell {
        padding-left: 40px;
        background: white;
      }

      .sticky-col {
        position: sticky;
        left: 0;
        z-index: 50;
      }

      .label-header-cell.sticky-col {
        z-index: 110;
      }

      .sticky-top {
        position: sticky;
        top: 0;
        z-index: 60;
      }

      .weeks-cells-container {
        display: flex;
        flex: 1;
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
        background: white;
      }

      .resource-cell:hover {
        background: #f3f4f6;
      }

      .resource-cell.selected {
        background: #dbeafe;
        border: 2px solid #3b82f6;
        z-index: 10;
      }

      .resource-cell.has-capacity {
        background: #d1fae5;
        font-weight: 600;
        color: #059669;
      }

      .resource-cell.has-capacity.selected {
        background: #a7f3d0;
        border: 2px solid #3b82f6;
        z-index: 10;
      }

      .row-info-stack-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        overflow: hidden;
      }

      .color-bar-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 12px;
      }

      .color-bar-v {
        width: 6px;
        height: 32px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .info-stack {
        display: flex;
        flex-direction: column;
        gap: 1px;
        overflow: hidden;
      }

      .info-label {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .calendar-row:hover .team-label-cell,
      .calendar-row:hover .resource-label-cell {
        background: #f3f4f6;
      }

      .btn-hover-add {
        margin-left: auto;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        background: white;
        color: #6366f1;
        border: 1px solid #e0e7ff;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        opacity: 0;
        position: absolute;
        right: 12px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .calendar-row:hover .btn-hover-add {
        opacity: 1;
      }

      .btn-hover-delete {
        background: transparent;
        border: none;
        color: #ef4444;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
        opacity: 0;
        position: absolute;
        right: 12px;
      }

      .calendar-row:hover .btn-hover-delete {
        opacity: 1;
      }

      .cell-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.1;
      }

      .capacity-value {
        font-size: 13px;
        font-weight: 600;
      }

      .days-value {
        font-size: 10px;
        opacity: 0.9;
      }

      .team-summary {
        color: #6b7280;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.1;
      }

      .empty-state-row {
        color: #6b7280;
        text-align: center;
      }

      .empty-state-label, .empty-state-weeks {
        padding: 40px;
      }

      .selection-toolbar {
        position: fixed;
        /* bottom and left/transform are now handled dynamically via style binding, 
           but we keep initial values or rely on overriding. 
           Current update will use inline styles to position absolutely relative to viewport. */
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        /*display: flex;*/
        align-items: center;
        gap: 16px;
        z-index: 1000;
        transition: top 0.2s ease, left 0.2s ease;
        min-width: 260px;

      }

      .selection-info {
        font-weight: 600;
        color: #374151;
      }
      .selection-total {
        font-weight: 500;
        font-size: 13px;
        margin-top: 6px;
        margin-bottom: 10px;
        color: #065f46;
      }
      .selection-input-row input {
        flex: 1;
        width: 100%;
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
        width: 100%;
    }

      .selection-actions {
        display: flex;
        flex: 1;
        gap: 8px;
        align-items: center;
        justify-content: center;
      }

      .selection-actions button  {
        flex: 1;
        
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

      .resource-type-icon {
        font-size: 16px;
      }

      .resource-icon-wrapper {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: white;
      }

      .resource-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .resource-name {
        flex: 0 1 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
        color: #334155;
      }

      .resource-total-badge {
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        padding: 2px 8px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        color: #475569;
        font-family: 'Inter', system-ui, sans-serif;
        margin-left: 4px;
        flex-shrink: 0;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .resource-total-badge:hover {
        border-color: #cbd5e1;
        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .badge-prefix {
        font-size: 9px;
        font-weight: 600;
        color: #64748b;
        margin-right: 2px;
      }

      .badge-val {
        font-size: 11px;
        font-weight: 700;
        color: #1e293b;
      }

      .badge-unit {
        font-size: 9px;
        font-weight: 600;
        color: #64748b;
        text-transform: lowercase;
      }

      .year-popover {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        width: 160px;
        animation: popOverIn 0.2s cubic-bezier(0, 0, 0.2, 1);
      }

      @keyframes popOverIn {
        from { opacity: 0; transform: scale(0.95) translateY(-10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      .popover-content {
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .popover-item {
        padding: 8px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        text-align: left;
        font-size: 13px;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .popover-item:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .popover-item.active {
        background: #eff6ff;
        color: #2563eb;
        font-weight: 600;
      }

      .popover-arrow {
        position: absolute;
        top: -6px;
        left: 20px;
        width: 12px;
        height: 12px;
        background: white;
        border-left: 1px solid #e2e8f0;
        border-top: 1px solid #e2e8f0;
        transform: rotate(45deg);
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

      .no-roles-message {
        padding: 9px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 6px;
        color: #92400e;
        text-align: center;
      }

      .no-roles-message p {
        margin: 0;
        font-size: 14px;
      }

      .modal-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }

      /* iOS-style toggle switch */
      .ios-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 20px; /* 🔧 MODIFIER ICI - était 28px */
        vertical-align: middle;
      }

      .ios-switch input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
        left: 0;
        top: 0;
      }

      .ios-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #e5e7eb; /* neutral gray */
        border-radius: 999px;
        transition: background-color 0.18s ease;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.03);
      }

      .ios-slider:before {
        content: "";
        position: absolute;
        height: 14px; /* 🔧 MODIFIER ICI - était 22px */
        width: 14px; /* 🔧 MODIFIER ICI aussi pour garder un cercle */
        left: 3px;
        top: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.12s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
      }

      .ios-switch input:checked + .ios-slider {
        background-color: #34d399; /* green */
      }

      .ios-switch input:checked + .ios-slider:before {
        transform: translateX(20px); /* 🔧 AJUSTER si nécessaire */
      }

      .ios-switch input:focus + .ios-slider {
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
      }
    `,
  ],
})
export class CapacityViewComponent implements OnInit {
  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  teamRows: TeamRow[] = [];

  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  showAddResourceModal = false;
  selectedEquipe: Equipe | null = null;
  resourceTypeToAdd: "role" | "personne" = "role";
  selectedResourceId: string = "";

  // Drag selection
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  dragStartWeekIndex: number = -1;
  dragEndWeekIndex: number = -1;
  selectedCells: Array<{ resource: ResourceRow; week: Date }> = [];
  isSelectionFinished: boolean = false;
  toolbarPosition: { top: number; left: number } | null = null;
  toolbarVisible: boolean = false; // Controls opacity to prevent flash

  bulkCapaciteValue: number | null = null;

  Contact = Contact;
  User = User;

  @ViewChild('bulkCapaciteInput') bulkCapaciteInput?: ElementRef<HTMLInputElement>;

  // Toggle to show/hide the computed days inside cells. Default: hidden (user activates toggle to show)
  showDaysInCells: boolean = false;

  selectedCapacityYear: 'all' | '2025' | '2026' = 'all';
  showYearPopover = false;
  popoverPosition: { top: number; left: number } | null = null;

  constructor(private teamService: TeamService, private calendarService: CalendarService) { }

  async ngOnInit() {
    this.generateWeeks();
    await this.loadData();
  }

  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.calendarService.getWeekStart(startDate);

    const NB_WEEK_TO_DISPLAY = 52; // un an par défaut
    for (let i = 0; i < NB_WEEK_TO_DISPLAY; i++) {
      const week = new Date(firstWeek);
      week.setDate(week.getDate() + i * 7);
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

          capacites.forEach((cap) => {
            const weekStr = this.calendarService.formatWeekStart(new Date(cap.semaine_debut));
            weeks.set(weekStr, cap.capacite);
          });

          resourceRows.push({
            type: resource.type,
            id: resource.id,
            uniqueId: resource.uniqueId,
            label: resource.type === "role" ? resource.nom : `${resource.prenom} ${resource.nom}`,
            equipeId: equipe.id!,
            weeks,
            jours_par_semaine: resource.jours_par_semaine,
            color: resource.color,
          });
        }

        this.teamRows.push({
          equipe,
          resources: resourceRows,
          expanded: true,
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  formatWeekHeader(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}`;
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentWeekStart = this.calendarService.getWeekStart(now);
    return this.calendarService.formatWeekStart(date) === this.calendarService.formatWeekStart(currentWeekStart);
  }

  getCapacite(resource: ResourceRow, week: Date): number {
    const weekStr = this.calendarService.formatWeekStart(week);
    return resource.weeks.get(weekStr) || 0;
  }

  toggleTeam(teamRow: TeamRow) {
    if (teamRow.resources.length > 0) {
      teamRow.expanded = !teamRow.expanded;
    }
  }

  async openAddResourceModal(equipe: Equipe) {
    this.selectedEquipe = equipe;
    this.resourceTypeToAdd = "role";
    this.selectedResourceId = "";
    this.showAddResourceModal = true;

    // Load only available roles (not already attached to this team)
    this.availableRoles = await this.teamService.getAvailableRolesForEquipe(equipe.id!);

    // Load only available persons (not already attached to this team)
    this.availablePersonnes = await this.teamService.getAvailablePersonnesForEquipe(equipe.id!);
  }

  async addResourceToTeam() {
    if (!this.selectedEquipe || !this.selectedResourceId) return;

    try {
      if (this.resourceTypeToAdd === "role") {
        await this.teamService.addRoleToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      } else {
        await this.teamService.addPersonneToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      }

      this.showAddResourceModal = false;
      await this.loadData();
    } catch (error: any) {
      console.error("Error adding resource:", error);
      // Display user-friendly error message
      if (error.message && error.message.includes("déjà attaché")) {
        alert(error.message);
      } else {
        alert("Erreur lors de l'ajout de la ressource. Veuillez réessayer.");
      }
    }
  }

  async removeResource(resource: ResourceRow, equipe: Equipe) {
    if (!confirm(`Retirer ${resource.label} de l'équipe ${equipe.nom} ?`)) return;

    try {
      if (resource.type === "role") {
        await this.teamService.removeRoleFromEquipe(resource.id, equipe.id!);
      } else {
        await this.teamService.removePersonneFromEquipe(resource.id);
      }

      await this.loadData();
    } catch (error) {
      console.error("Error removing resource:", error);
    }
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow) {
    this.isDragging = true;
    this.isSelectionFinished = false;
    this.dragStartResource = resource;

    const target = event.target as HTMLElement;
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
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
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
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
    if (this.selectedCells.length > 0) {
      this.isSelectionFinished = true;
      this.updateToolbarPosition();
    }
  }

  updateToolbarPosition() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    // Use setTimeout to allow DOM to update if necessary, or just run immediately if purely purely based on existing elements
    setTimeout(() => {
      // Find the row
      const rowSelector = `[data-resource-id="${this.dragStartResource!.uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector);

      if (rowElement) {
        // Find the specific cell
        const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
        const cellElement = rowElement.querySelector(cellSelector);

        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          // Position below the cell, centered horizontally
          this.toolbarPosition = {
            top: rect.bottom,
            left: rect.left + (rect.width / 2)
          };

          // Make toolbar visible now that position is set
          this.toolbarVisible = true;

          // Focus the input after the toolbar is displayed
          setTimeout(() => {
            this.bulkCapaciteInput?.nativeElement.focus();
          }, 50);
        }
      }
    }, 0);
  }

  updateSelection() {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: this.displayedWeeks[i],
      });
    }
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some(
      (s) => s.resource.uniqueId === resource.uniqueId && s.week.getTime() === week.getTime()
    );
  }

  clearSelection() {
    this.selectedCells = [];
    this.isSelectionFinished = false;
    this.toolbarPosition = null;
    this.toolbarVisible = false;
    this.dragStartResource = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
  }

  async applyBulkCapacite() {
    // Autorise 0, bloque seulement null et undefined
    if (this.selectedCells.length === 0 || this.bulkCapaciteValue == null) return;

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
      console.error("Error saving capacities:", error);
    }
  }

  // Sum of days (capacite * jours_par_semaine) for currently selected cells
  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const cap = this.getCapacite(cell.resource, cell.week) || 0;
      const jours = cell.resource.jours_par_semaine || 0;
      total += cap * jours;
    }
    return total;
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

  getTeamTotalCapacity(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce((sum, resource) => sum + this.getCapacite(resource, week), 0);
  }

  getTeamTotalDays(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce(
      (sum, resource) => sum + this.getCapacite(resource, week) * resource.jours_par_semaine,
      0
    );
  }

  getResourceTotalPlannedDays(resource: ResourceRow): number {
    let total = 0;
    resource.weeks.forEach((val, weekStr) => {
      const year = weekStr.split('/')[2]; // Format is dd/mm/yyyy or similar? 
      // Actually calendarService.formatWeekStart might return yyyy-mm-dd
      // Let's check team service or calendar service format

      const parts = weekStr.split('-');
      const weekYear = parts[0]; // assuming yyyy-mm-dd

      if (this.selectedCapacityYear === 'all' || weekYear === this.selectedCapacityYear) {
        total += val * resource.jours_par_semaine;
      }
    });
    return total;
  }

  getBadgePrefix(): string {
    if (this.selectedCapacityYear === 'all') return 'Tout :';
    return `${this.selectedCapacityYear} :`;
  }

  openYearPopover(event: MouseEvent) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.popoverPosition = {
      top: rect.bottom + 10,
      left: rect.left
    };
    this.showYearPopover = true;

    // Close when clicking outside
    const closeHandler = () => {
      this.showYearPopover = false;
      document.removeEventListener('click', closeHandler);
    };
    document.addEventListener('click', closeHandler);
  }

  selectYear(year: 'all' | '2025' | '2026') {
    this.selectedCapacityYear = year;
    this.showYearPopover = false;
  }
}
