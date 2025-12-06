import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../services/team.service";
import { ProjetService } from "../services/projet.service";
import { ChargeService } from "../services/charge.service";
import { Equipe, Projet, Charge, Role, Personne } from "../models/types";
import { CalendarService } from "../services/calendar.service";
import { LucideAngularModule, Plus } from "lucide-angular";

interface ResourceRow {
  id: string;
  uniqueId: string; // Unique identifier combining parent, child, and resource context
  label: string;
  type: 'role' | 'personne';
  jours_par_semaine: number;
  charges: Map<string, number>; // week string -> amount
}

interface ChildRow {
  id: string;
  label: string;
  expanded: boolean;
  resources: ResourceRow[];
  charges: Map<string, number>; // week string -> amount
}

interface ParentRow {
  id: string;
  label: string;
  expanded: boolean;
  children: ChildRow[];
  totalCharges: Map<string, number>; // week string -> amount
}

@Component({
  selector: "app-plan-view",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="capacity-container">
      <div class="capacity-header">
        <h1>Vue Planification</h1>
        <div class="header-actions">
           <div class="view-mode-toggle">
            <button 
                class="btn" 
                [class.btn-primary]="viewMode === 'project'" 
                [class.btn-secondary]="viewMode !== 'project'"
                (click)="switchViewMode('project')">
                Par Projet
            </button>
            <button 
                class="btn" 
                [class.btn-primary]="viewMode === 'team'" 
                [class.btn-secondary]="viewMode !== 'team'"
                (click)="switchViewMode('team')">
                Par Équipe
            </button>
           </div>
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
            <span>{{ viewMode === 'project' ? 'Projets / Équipes' : 'Équipes / Projets' }}</span>
          </div>

          <ng-container *ngFor="let row of rows">
            <div class="team-label-row">
              <div class="team-label" (click)="toggleRow(row)">
                <span class="expand-icon">{{ row.expanded ? "▼" : "▶" }}</span>
                <strong>{{ row.label }}</strong>
                <button 
                    class="btn btn-xs btn-add"
                    (click)="openLinkModal(row); $event.stopPropagation()"
                >
                    <lucide-icon [img]="Plus" [size]="16"></lucide-icon>
                </button>
              </div>
            </div>

            <ng-container *ngIf="row.expanded">
              <div *ngFor="let child of row.children" class="resource-label-row">
                <div class="resource-label" (click)="toggleChild(child)">
                   <span class="expand-icon" style="padding-left: 10px;">{{ child.expanded ? "▼" : "▶" }}</span>
                   <span class="resource-name" style="padding-left: 10px;">{{ child.label }}</span>
                   <button 
                       class="btn btn-xs btn-add"
                       (click)="openAddResourceModal(child, row); $event.stopPropagation()"
                   >
                       <lucide-icon [img]="Plus" [size]="14"></lucide-icon>
                   </button>
                </div>
                
                <!-- Third level: Resources -->
                <ng-container *ngIf="child.expanded">
                  <div *ngFor="let resource of child.resources" class="resource-detail-row">
                    <div class="resource-detail-label">
                      <span class="resource-detail-name" style="padding-left: 50px;">{{ resource.label }}</span>
                    </div>
                  </div>
                </ng-container>
              </div>
            </ng-container>
          </ng-container>

          <div *ngIf="rows.length === 0" class="empty-state-label">
            <p>Aucune donnée</p>
          </div>
        </div>

        <!-- Scrollable Right Column: Weeks -->
        <div class="weeks-column">
          <div class="weeks-header">
            <div *ngFor="let week of displayedWeeks" class="week-header" [class.current-week]="isCurrentWeek(week)">
              <div class="week-date">{{ formatWeekHeader(week) }}</div>
              <div class="week-number">S{{ getWeekNumber(week) }}</div>
            </div>
          </div>

          <ng-container *ngFor="let row of rows">
            <!-- Parent Row Totals -->
            <div class="team-weeks-row">
              <div *ngFor="let week of displayedWeeks" class="week-cell team-cell">
                 <div class="team-summary" *ngIf="getParentTotal(row, week) > 0">
                  <div class="capacity-value">
                    {{ getParentTotal(row, week) | number : "1.0-1" }}
                  </div>
                </div>
              </div>
            </div>


            <!-- Children Rows -->
            <ng-container *ngIf="row.expanded">
              <ng-container *ngFor="let child of row.children">
                <!-- Child Row (2nd level) -->
                <div class="resource-weeks-row">
                  <div
                    *ngFor="let week of displayedWeeks"
                    class="week-cell resource-cell"
                    [class.has-capacity]="getChildValue(child, week) > 0"
                  >
                    <div class="cell-content" *ngIf="getChildValue(child, week) > 0">
                      <div class="capacity-value">{{ getChildValue(child, week) | number : "1.0-1" }}</div>
                    </div>
                  </div>
                </div>
              
                <!-- Resource Rows (Third Level) for this child -->
                <ng-container *ngIf="child.expanded">
                  <div 
                    *ngFor="let resource of child.resources" 
                    class="resource-detail-weeks-row"
                    [attr.data-resource-id]="getResourceUniqueId(resource, child, row)"
                    (mousedown)="onMouseDown($event, resource, child, row)"
                    (mousemove)="onMouseMove($event, resource, child, row)"
                    (mouseup)="onMouseUp()"
                    (mouseleave)="onMouseUp()"
                  >
                    <div
                      *ngFor="let week of displayedWeeks; let i = index"
                      class="week-cell resource-detail-cell"
                      [class.selected]="isCellSelected(resource, week)"
                      [class.has-capacity]="getResourceValue(resource, week) > 0"
                      [attr.data-week-index]="i"
                    >
                      <div class="cell-content" *ngIf="getResourceValue(resource, week) > 0">
                        <div class="capacity-value">{{ getResourceValue(resource, week) | number : "1.0-1" }}</div>
                      </div>
                    </div>
                  </div>
                </ng-container>
              </ng-container>
            </ng-container>
          </ng-container>

          <div *ngIf="rows.length === 0" class="empty-state-weeks">
            <p>Aucune donnée</p>
          </div>
        </div>
      </div>

      <!-- Selection Toolbar -->
      <div 
        *ngIf="selectedCells.length > 0 && isSelectionFinished" 
        class="selection-toolbar"
        [style.top.px]="toolbarPosition?.top"
        [style.left.px]="toolbarPosition?.left"
        [style.transform]="'translate(-50%, 10px)'"
      >
        <div class="selection-info">
          {{ selectedCells.length }} semaine(s) sélectionnée(s)
        </div>
        <div class="selection-input-row">
          <input
            type="number"
            [(ngModel)]="bulkChargeValue"
            placeholder="Charge (unités)"
            step="0.5"
            min="0"
            class="bulk-input"
            (keydown.enter)="applyBulkCharge()"
          />
        </div>
        <div class="selection-actions">
          <button class="btn btn-sm btn-secondary" (click)="clearSelection()">Annuler</button>
          <button class="btn btn-sm btn-primary" (click)="applyBulkCharge()">Appliquer</button>
        </div>
      </div>
    </div>

    <!-- Modal for linking -->
    <div *ngIf="showLinkModal" class="modal-overlay" (click)="closeLinkModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ viewMode === 'project' ? 'Ajouter une équipe' : 'Ajouter un projet' }} à {{ selectedParentRow?.label }}</h2>
          <button class="modal-close" (click)="closeLinkModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>{{ viewMode === 'project' ? 'Sélectionner une équipe' : 'Sélectionner un projet' }}</label>
                <select [(ngModel)]="selectedIdToLink" class="form-control">
                    <option value="">-- Choisir --</option>
                    <option *ngFor="let item of linkableItems" [value]="item.id">
                        {{ item.label }}
                    </option>
                </select>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-primary" (click)="linkItem()" [disabled]="!selectedIdToLink">Ajouter</button>
                <button class="btn btn-secondary" (click)="closeLinkModal()">Annuler</button>
            </div>
        </div>
      </div>
    </div>

    <!-- Modal for adding resource -->
    <div *ngIf="showAddResourceModal" class="modal-overlay" (click)="closeAddResourceModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Ajouter une Ressource à {{ selectedChildRow?.label }}</h2>
          <button class="modal-close" (click)="closeAddResourceModal()">×</button>
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
                {{ role.nom }}
              </option>
            </select>
          </div>

          <div class="form-group" *ngIf="resourceTypeToAdd === 'personne'">
            <label>Sélectionner une personne</label>
            <select [(ngModel)]="selectedResourceId" class="form-control">
              <option value="">-- Choisir une personne --</option>
              <option *ngFor="let personne of availablePersonnes" [value]="personne.id">
                {{ personne.prenom }} {{ personne.nom }}
              </option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="btn btn-primary" (click)="addResourceToCharge()" [disabled]="!selectedResourceId">Ajouter</button>
            <button class="btn btn-secondary" (click)="closeAddResourceModal()">Annuler</button>
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
        overflow-x: hidden;
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
        align-items: center;
      }
      
      .view-mode-toggle {
        display: flex;
        background: #e2e8f0;
        padding: 4px;
        border-radius: 8px;
        gap: 4px;
        margin-right: 16px;
      }
      
      .view-mode-toggle .btn {
        padding: 6px 12px;
        font-size: 14px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }
      
      .view-mode-toggle .btn-primary {
        background: white;
        color: #1e293b;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        font-weight: 600;
      }

      .view-mode-toggle .btn-secondary {
        background: transparent;
        color: #64748b;
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

      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 13px;
      }

      .btn-xs {
        padding: 2px 4px;
        font-size: 11px;
      }
      
      .btn-add {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        background: white;
      }
      
      .btn-add:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .btn-primary {
        background: #3b82f6;
        color: white;
      }

      .btn-primary:hover {
        background: #2563eb;
      }

      .btn-secondary {
        background: white;
        border: 1px solid #d1d5db;
        color: #374151;
      }

      .btn-secondary:hover {
        background: #f3f4f6;
      }

      .calendar-wrapper {
        display: flex;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        max-height: calc(100vh - 200px);
        position: relative;
      }

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

      .resource-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .empty-state-label {
        padding: 40px 20px;
        text-align: center;
        color: #6b7280;
      }

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

      .resource-detail-row {
        border-bottom: 1px solid #e2e8f0;
        background: #fafbfc;
      }

      .resource-detail-row:hover {
        background: #f3f4f6;
      }

      .resource-detail-label {
        padding: 10px 16px 10px 50px;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        font-size: 13px;
        color: #6b7280;
      }

      .resource-detail-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .resource-detail-weeks-row {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        background: #fafbfc;
        min-height: 40px;
        user-select: none;
      }

      .resource-detail-weeks-row:hover {
        background: #f3f4f6;
      }

      .resource-detail-cell {
        background: #fafbfc;
      }

      .resource-detail-cell.has-capacity {
        background: #e0f2fe;
        font-weight: 600;
        color: #0369a1;
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
        transition: background 0.15s ease;
      }
      
      .resource-cell.has-capacity {
        background: #d1fae5;
        font-weight: 600;
        color: #059669;
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

      .team-summary {
        color: #6b7280;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.1;
      }

      .empty-state-weeks {
        padding: 40px;
        text-align: center;
        color: #6b7280;
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
      }

      .modal {
        background: white;
        border-radius: 12px;
        min-width: 400px;
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
        justify-content: flex-end;
      }

      /* Selection Styles */
      .resource-detail-cell {
        cursor: pointer;
        transition: background 0.15s ease;
        position: relative;
      }

      .resource-detail-cell:hover {
        background: #f3f4f6;
      }

      .resource-detail-cell.selected {
        background: #dbeafe;
        border: 2px solid #3b82f6;
      }

      .resource-detail-cell.has-capacity.selected {
        background: #bfdbfe;
        border: 2px solid #3b82f6;
      }

      .selection-toolbar {
        position: fixed;
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        align-items: center;
        gap: 16px;
        z-index: 1000;
        transition: top 0.2s ease, left 0.2s ease;
        min-width: 260px;
      }

      .selection-info {
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
      }

      .selection-input-row {
        margin-bottom: 12px;
      }

      .selection-input-row input {
        width: 100%;
      }

      .selection-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
      }

      .selection-actions button {
        flex: 1;
      }

      .bulk-input {
        width: 100%;
        padding: 6px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
      }
    `,
  ],
})
export class PlanViewComponent implements OnInit {
  viewMode: 'project' | 'team' = 'project';

  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  rows: ParentRow[] = [];

  allProjects: Projet[] = [];
  allEquipes: Equipe[] = [];
  allCharges: Charge[] = [];
  allLinks: { equipe_id: string; projet_id: string }[] = [];

  // Link Modal State
  showLinkModal = false;
  selectedParentRow: ParentRow | null = null;
  linkableItems: { id: string; label: string }[] = [];
  selectedIdToLink: string = '';

  // Resource Modal State
  showAddResourceModal = false;
  selectedChildRow: ChildRow | null = null;
  selectedParentForResource: ParentRow | null = null;
  resourceTypeToAdd: 'role' | 'personne' = 'role';
  selectedResourceId: string = '';
  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  // Drag selection
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  dragStartWeekIndex: number = -1;
  dragEndWeekIndex: number = -1;
  selectedCells: Array<{ resource: ResourceRow; week: Date; childId: string; parentId: string }> = [];
  isSelectionFinished: boolean = false;
  toolbarPosition: { top: number; left: number } | null = null;

  bulkChargeValue: number | null = null;

  // Icons
  Plus = Plus;

  constructor(
    private teamService: TeamService,
    private projetService: ProjetService,
    private chargeService: ChargeService,
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
      week.setDate(week.getDate() + i * 7);
      this.displayedWeeks.push(week);
    }
  }

  async loadData() {
    this.allProjects = await this.projetService.getAllProjets();
    this.allEquipes = await this.teamService.getAllEquipes();
    this.allCharges = await this.chargeService.getAllCharges();
    this.allLinks = await this.projetService.getAllEquipeProjetLinks();

    // Load roles and persons for resource display
    this.availableRoles = await this.teamService.getAllRoles();
    this.availablePersonnes = await this.teamService.getAllPersonnes();

    this.buildTree();
  }

  switchViewMode(mode: 'project' | 'team') {
    this.viewMode = mode;
    this.buildTree();
  }

  buildTree() {
    this.rows = [];
    // Restore expanded state if re-building (optional, good UX)
    // For now reset to closed or keep simple.

    if (this.viewMode === 'project') {
      // Parent = Project, Child = Team, GrandChild = Resource
      for (const project of this.allProjects) {
        const projectCharges = this.allCharges.filter(c => c.projet_id === project.id);

        // Find all teams involved in this project (via charges OR links)
        const chargeTeamIds = projectCharges.map(c => c.equipe_id).filter(id => !!id);
        const linkedTeamIds = this.allLinks.filter(l => l.projet_id === project.id).map(l => l.equipe_id);

        const involvedTeamIds = new Set([...chargeTeamIds, ...linkedTeamIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedTeamIds.forEach(teamId => {
          const team = this.allEquipes.find(e => e.id === teamId);
          const label = team ? team.nom : 'No Team';
          const teamCharges = new Map<string, number>();

          // Get charges for this team on this project
          const teamProjectCharges = projectCharges.filter(c => c.equipe_id === teamId);

          // Build resources for this team
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach(charge => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: 'role' | 'personne';
            let joursParSemaine = 0;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find(r => r.id === charge.role_id);
              resourceLabel = role ? role.nom : 'Unknown Role';
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = 'role';
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find(p => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : 'Unknown Person';
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = 'personne';
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${project.id}_${teamId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || '',
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>()
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split('T')[0];
              const val = resource.charges.get(weekKey) || 0;
              resource.charges.set(weekKey, val + charge.unite_ressource);

              // Add to team total
              const teamVal = teamCharges.get(weekKey) || 0;
              teamCharges.set(weekKey, teamVal + charge.unite_ressource);

              // Add to parent total
              const pVal = parentTotal.get(weekKey) || 0;
              parentTotal.set(weekKey, pVal + charge.unite_ressource);
            }
          });

          resources.push(...resourceMap.values());

          children.push({
            id: teamId!,
            label: label,
            expanded: true, // Expanded by default
            resources: resources,
            charges: teamCharges
          });
        });

        this.rows.push({
          id: project.id!,
          label: project.nom_projet,
          expanded: true, // Expanded by default
          children: children,
          totalCharges: parentTotal
        });
      }
    } else {
      // Parent = Team, Child = Project, GrandChild = Resource
      for (const team of this.allEquipes) {
        const teamCharges = this.allCharges.filter(c => c.equipe_id === team.id);

        // Find all projects this team is working on (via charges OR links)
        const chargeProjectIds = teamCharges.map(c => c.projet_id).filter(id => !!id);
        const linkedProjectIds = this.allLinks.filter(l => l.equipe_id === team.id).map(l => l.projet_id);

        const involvedProjectIds = new Set([...chargeProjectIds, ...linkedProjectIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedProjectIds.forEach(projectId => {
          const project = this.allProjects.find(p => p.id === projectId);
          const label = project ? project.nom_projet : 'Unknown Project';
          const projectCharges = new Map<string, number>();

          // Get charges for this project on this team
          const teamProjectCharges = teamCharges.filter(c => c.projet_id === projectId);

          // Build resources for this project
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach(charge => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: 'role' | 'personne';
            let joursParSemaine = 0;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find(r => r.id === charge.role_id);
              resourceLabel = role ? role.nom : 'Unknown Role';
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = 'role';
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find(p => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : 'Unknown Person';
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = 'personne';
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${team.id}_${projectId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || '',
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>()
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split('T')[0];
              const val = resource.charges.get(weekKey) || 0;
              resource.charges.set(weekKey, val + charge.unite_ressource);

              // Add to project total
              const projVal = projectCharges.get(weekKey) || 0;
              projectCharges.set(weekKey, projVal + charge.unite_ressource);

              // Add to parent total
              const pVal = parentTotal.get(weekKey) || 0;
              parentTotal.set(weekKey, pVal + charge.unite_ressource);
            }
          });

          resources.push(...resourceMap.values());

          children.push({
            id: projectId!,
            label: label,
            expanded: true, // Expanded by default
            resources: resources,
            charges: projectCharges
          });
        });

        this.rows.push({
          id: team.id!,
          label: team.nom,
          expanded: true, // Expanded by default
          children: children,
          totalCharges: parentTotal
        });
      }
    }
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateWeeks();
  }

  goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateWeeks();
  }

  goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateWeeks();
  }

  toggleRow(row: ParentRow) {
    row.expanded = !row.expanded;
  }

  toggleChild(child: ChildRow) {
    child.expanded = !child.expanded;
  }

  formatWeekHeader(date: Date): string {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    return this.calendarService.isCurrentWeek(date);
  }

  getParentTotal(row: ParentRow, week: Date): number {
    const weekKey = week.toISOString().split('T')[0];
    return row.totalCharges.get(weekKey) || 0;
  }

  getChildValue(child: ChildRow, week: Date): number {
    const weekKey = week.toISOString().split('T')[0];
    return child.charges.get(weekKey) || 0;
  }

  getResourceValue(resource: ResourceRow, week: Date): number {
    const weekKey = week.toISOString().split('T')[0];
    return resource.charges.get(weekKey) || 0;
  }

  // Modal & Linking Logic
  openLinkModal(row: ParentRow) {
    this.selectedParentRow = row;
    this.selectedIdToLink = '';

    const existingChildIds = new Set(row.children.map(c => c.id));

    if (this.viewMode === 'project') {
      // Parent is Project, we want to add Teams
      // Filter out teams that are already attached (via charges or existing link)
      this.linkableItems = this.allEquipes
        .filter(e => !existingChildIds.has(e.id!))
        .map(e => ({ id: e.id!, label: e.nom }));
    } else {
      // Parent is Team, we want to add Projects
      this.linkableItems = this.allProjects
        .filter(p => !existingChildIds.has(p.id!))
        .map(p => ({ id: p.id!, label: p.nom_projet }));
    }

    this.showLinkModal = true;
  }

  closeLinkModal() {
    this.showLinkModal = false;
    this.selectedParentRow = null;
    this.selectedIdToLink = '';
  }

  async linkItem() {
    if (!this.selectedParentRow || !this.selectedIdToLink) return;

    try {
      if (this.viewMode === 'project') {
        // Linking Team to Project
        await this.projetService.linkProjectToTeam(this.selectedParentRow.id, this.selectedIdToLink);
      } else {
        // Linking Project to Team
        await this.projetService.linkProjectToTeam(this.selectedIdToLink, this.selectedParentRow.id);
      }

      await this.loadData(); // Reload to refresh tree
      this.closeLinkModal();
    } catch (error) {
      console.error("Error linking item:", error);
      alert("Erreur lors de l'ajout du lien.");
    }
  }

  // Resource Addition Modal Methods
  async openAddResourceModal(child: ChildRow, parent: ParentRow) {
    this.selectedChildRow = child;
    this.selectedParentForResource = parent;
    this.resourceTypeToAdd = 'role';
    this.selectedResourceId = '';
    this.showAddResourceModal = true;

    // Load available roles and personnes
    this.availableRoles = await this.teamService.getAllRoles();
    this.availablePersonnes = await this.teamService.getAllPersonnes();
  }

  closeAddResourceModal() {
    this.showAddResourceModal = false;
    this.selectedChildRow = null;
    this.selectedParentForResource = null;
    this.selectedResourceId = '';
  }

  async addResourceToCharge() {
    if (!this.selectedChildRow || !this.selectedParentForResource || !this.selectedResourceId) return;

    try {
      let projetId: string;
      let equipeId: string;

      if (this.viewMode === 'project') {
        // Parent is Project, Child is Team
        projetId = this.selectedParentForResource.id;
        equipeId = this.selectedChildRow.id;
      } else {
        // Parent is Team, Child is Project
        equipeId = this.selectedParentForResource.id;
        projetId = this.selectedChildRow.id;
      }

      const roleId = this.resourceTypeToAdd === 'role' ? this.selectedResourceId : undefined;
      const personneId = this.resourceTypeToAdd === 'personne' ? this.selectedResourceId : undefined;

      await this.chargeService.createChargeWithoutDates(
        projetId,
        equipeId,
        roleId,
        personneId
      );

      await this.loadData(); // Reload to refresh tree
      this.closeAddResourceModal();
    } catch (error) {
      console.error("Error adding resource:", error);
      alert("Erreur lors de l'ajout de la ressource.");
    }
  }

  // Drag Selection Methods
  getResourceUniqueId(resource: ResourceRow, child: ChildRow, parent: ParentRow): string {
    return `${parent.id}_${child.id}_${resource.id}_${resource.type}`;
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
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
        this.updateSelection(child, parent);
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
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
          this.updateSelection(child, parent);
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

    setTimeout(() => {
      const firstCell = this.selectedCells[0];
      if (!firstCell) return;

      const uniqueId = this.getResourceUniqueId(firstCell.resource,
        { id: firstCell.childId } as ChildRow,
        { id: firstCell.parentId } as ParentRow);

      const rowSelector = `[data-resource-id="${uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector);

      if (rowElement) {
        const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
        const cellElement = rowElement.querySelector(cellSelector);

        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          this.toolbarPosition = {
            top: rect.bottom,
            left: rect.left + (rect.width / 2)
          };
        }
      }
    }, 0);
  }

  updateSelection(child: ChildRow, parent: ParentRow) {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: this.displayedWeeks[i],
        childId: child.id,
        parentId: parent.id
      });
    }
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some(
      (s) => s.resource.uniqueId === resource.uniqueId &&
        s.week.getTime() === week.getTime()
    );
  }

  clearSelection() {
    this.selectedCells = [];
    this.isSelectionFinished = false;
    this.toolbarPosition = null;
    this.dragStartResource = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
    this.bulkChargeValue = null;
  }

  async applyBulkCharge() {
    if (this.selectedCells.length === 0 || this.bulkChargeValue == null) return;

    try {
      for (const cell of this.selectedCells) {
        const weekKey = cell.week.toISOString().split('T')[0];

        let projetId: string;
        let equipeId: string;

        if (this.viewMode === 'project') {
          // Parent is Project, Child is Team
          projetId = cell.parentId;
          equipeId = cell.childId;
        } else {
          // Parent is Team, Child is Project
          equipeId = cell.parentId;
          projetId = cell.childId;
        }

        const roleId = cell.resource.type === 'role' ? cell.resource.id : undefined;
        const personneId = cell.resource.type === 'personne' ? cell.resource.id : undefined;

        // Create or update charge
        await this.chargeService.createOrUpdateCharge(
          projetId,
          equipeId,
          weekKey,
          this.bulkChargeValue,
          roleId,
          personneId
        );
      }

      // Reload data to refresh the view
      await this.loadData();
      this.clearSelection();
    } catch (error) {
      console.error("Error applying bulk charge:", error);
      alert("Erreur lors de l'application des charges.");
    }
  }
}
