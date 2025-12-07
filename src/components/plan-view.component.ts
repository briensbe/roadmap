import { Component, OnInit, ViewChild, ElementRef, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../services/team.service";
import { ProjetService } from "../services/projet.service";
import { ChargeService } from "../services/charge.service";
import { JalonService } from "../services/jalon.service";
import { Equipe, Projet, Charge, Role, Personne, Capacite, Jalon } from "../models/types";
import { CalendarService } from "../services/calendar.service";
import { LucideAngularModule, Plus } from "lucide-angular";
import { MilestoneModalComponent } from './milestone-modal.component';

interface ResourceRow {
  id: string;
  uniqueId: string; // Unique identifier combining parent, child, and resource context
  label: string;
  type: "role" | "personne";
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

interface FlatRow {
  uniqueId: string;
  fullLabel: string; // "Project > Team > Resource"
  resource: ResourceRow;
  child: ChildRow;
  parent: ParentRow;
}

@Component({
  selector: "app-plan-view",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, MilestoneModalComponent],
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
              (click)="switchViewMode('project')"
            >
              Par Projet
            </button>
            <button
              class="btn"
              [class.btn-primary]="viewMode === 'team'"
              [class.btn-secondary]="viewMode !== 'team'"
              (click)="switchViewMode('team')"
            >
              Par Équipe
            </button>
          </div>

          <div class="view-mode-toggle">
            <button
              class="btn"
              [class.btn-primary]="displayFormat === 'tree'"
              [class.btn-secondary]="displayFormat !== 'tree'"
              (click)="toggleDisplayFormat('tree')"
            >
              Arborescence
            </button>
            <button
              class="btn"
              [class.btn-primary]="displayFormat === 'flat'"
              [class.btn-secondary]="displayFormat !== 'flat'"
              (click)="toggleDisplayFormat('flat')"
            >
              À plat
            </button>
          </div>

          <div class="toggle-container">
            <span class="toggle-label">Dispo.</span>
            <label class="switch">
              <input type="checkbox" [(ngModel)]="showAvailability">
              <span class="slider round"></span>
            </label>
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

        <!-- Filters bar -->
        <div class="filters-bar" #filtersContainer>
          <div class="filter-pill" (click)="toggleDropdown('equipe', $event)">
            <span class="filter-title">Équipes</span>
            <span class="chip-list">
              <span *ngFor="let id of filterEquipeIds" class="chip">{{ getEquipeName(id) }}</span>
              <span *ngIf="filterEquipeIds.length === 0" class="chip placeholder">Tous</span>
            </span>
          </div>

          <div class="filter-pill" (click)="toggleDropdown('projet', $event)">
            <span class="filter-title">Projets</span>
            <span class="chip-list">
              <span *ngFor="let id of filterProjetIds" class="chip">{{ getProjetLabel(id) }}</span>
              <span *ngIf="filterProjetIds.length === 0" class="chip placeholder">Tous</span>
            </span>
          </div>

          <div class="filter-pill" (click)="toggleDropdown('resource', $event)">
            <span class="filter-title">Rôle / Personne</span>
            <span class="chip-list">
              <span *ngFor="let sel of filterResourceIds" class="chip">{{ getResourceLabel(sel) }}</span>
              <span *ngIf="filterResourceIds.length === 0" class="chip placeholder">Tous</span>
            </span>
          </div>

          <!-- Dropdowns -->
          <div class="filters-dropdown" *ngIf="openEquipeDropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-list">
              <label *ngFor="let e of allEquipes" class="dropdown-item">
                <input
                  type="checkbox"
                  [value]="e.id"
                  (change)="onEquipeToggle(e.id, $event)"
                  [checked]="filterEquipeIds.includes(e.id!)"
                />
                {{ e.nom }}
              </label>
            </div>
          </div>

          <div class="filters-dropdown" *ngIf="openProjetDropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-list">
              <label *ngFor="let p of allProjects" class="dropdown-item">
                <input
                  type="checkbox"
                  [value]="p.id"
                  (change)="onProjetToggle(p.id, $event)"
                  [checked]="filterProjetIds.includes(p.id!)"
                />
                {{ p.code_projet }} — {{ p.nom_projet }}
              </label>
            </div>
          </div>

          <div class="filters-dropdown" *ngIf="openResourceDropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-list">
              <div class="dropdown-group">Rôles</div>
              <label *ngFor="let r of availableRoles" class="dropdown-item">
                <input
                  type="checkbox"
                  [value]="'role:' + r.id"
                  (change)="onResourceToggle('role:' + r.id, $event)"
                  [checked]="filterResourceIds.includes('role:' + r.id)"
                />
                {{ r.nom }}
              </label>
              <div class="dropdown-group">Personnes</div>
              <label *ngFor="let p of availablePersonnes" class="dropdown-item">
                <input
                  type="checkbox"
                  [value]="'personne:' + p.id"
                  (change)="onResourceToggle('personne:' + p.id, $event)"
                  [checked]="filterResourceIds.includes('personne:' + p.id)"
                />
                {{ p.prenom }} {{ p.nom }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Main calendar container with sticky header -->
      <div class="calendar-container">
        <!-- Header row with sticky positioning -->
        <div class="calendar-header-wrapper">
          <div class="row-label fixed-column header-fixed">
            <span style="font-weight:600;">{{
              viewMode === "project" ? "Projets / Équipes" : "Équipes / Projets"
            }}</span>
          </div>
          <div class="header-scroll-container" #headerScroll>
            <div class="row-cells scrollable-column">
              <div *ngFor="let week of displayedWeeks" class="week-header" [class.current-week]="isCurrentWeek(week)">
                <div class="week-date">{{ formatWeekHeader(week) }}</div>
                <div class="week-number">S{{ getWeekNumber(week) }}</div>
              </div>
            </div>
          </div>
          <div class="metrics-header-fixed">
            <div style="font-weight:600; font-size: 12px;">Métriques</div>
          </div>
        </div>

        
        <!-- Milestones Header -->
        <div class="milestones-header-wrapper">
          <div class="row-label fixed-column header-fixed milestones-fixed-col">
            <span style="font-weight:600; font-size: 13px;">Jalons</span>
          </div>
          <div class="header-scroll-container" #milestonesScroll>
             <div class="row-cells scrollable-column">
               <div *ngFor="let week of displayedWeeks" class="week-cell milestone-week-cell" [class.current-week]="isCurrentWeek(week)">
                 <div class="milestones-container">
                    <div *ngFor="let jalon of getJalonsForWeek(week)"
                         class="jalon-item"
                         [style.background-color]="getJalonColor(jalon.type)"
                         [style.color]="getJalonTextColor(jalon.type)"
                         [title]="jalon.date_jalon"
                         (click)="openMilestoneModal(jalon, $event)">
                         {{ jalon.nom || '★' }}
                    </div>
                 </div>
               </div>
             </div>
          </div>
          <div class="metrics-header-fixed milestones-metrics-fixed"></div>
        </div>

        <!-- Data rows - single scroll container with metrics panel -->
        <div class="calendar-grid-wrapper">
          <div class="calendar-grid" #dataScroll (scroll)="onGridScroll($event)">
            <!-- Tree View -->
            <ng-container *ngIf="displayFormat === 'tree'">
            <ng-container *ngFor="let row of rows">
              <!-- Parent Row -->
              <div class="calendar-row-wrapper">
                <div class="row-label fixed-column">
                  <div class="team-label" (click)="toggleRow(row)">
                    <span class="expand-icon">{{ row.expanded ? "▼" : "▶" }}</span>
                    <strong>{{ row.label }}</strong>
                  </div>
                  <button
                    class="btn btn-xs btn-add"
                    (click)="openLinkModal(row); $event.stopPropagation()"
                    style="margin-left:auto;"
                  >
                    <lucide-icon [img]="Plus" [size]="16"></lucide-icon>
                  </button>
                </div>
                <div class="row-cells scrollable-column">
                  <div *ngFor="let week of displayedWeeks" class="week-cell team-cell">
                    <div class="team-summary" *ngIf="getParentTotal(row, week) > 0">
                      <div class="capacity-value">
                        {{ getParentTotal(row, week) | number : "1.0-1" }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="metrics-cell">
                  <div class="metrics-group">
                    <div class="metric-row">
                      <label>2025:</label>
                      <span>{{ getRowMetricsYear(row, 2025) | number : "1.0-0" }}j</span>
                    </div>
                    <div class="metric-row">
                      <label>2026:</label>
                      <span>{{ getRowMetricsYear(row, 2026) | number : "1.0-0" }}j</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Children Rows -->
              <ng-container *ngIf="row.expanded">
                <ng-container *ngFor="let child of row.children">
                  <!-- Child Row (2nd level) -->
                  <div class="calendar-row-wrapper">
                    <div class="row-label fixed-column">
                      <div class="resource-label" (click)="toggleChild(child)" style="padding-left:32px;">
                        <span class="expand-icon">{{ child.expanded ? "▼" : "▶" }}</span>
                        <span class="resource-name">{{ child.label }}</span>
                      </div>
                      <button
                        class="btn btn-xs btn-add"
                        (click)="openAddResourceModal(child, row); $event.stopPropagation()"
                        style="margin-left:auto;"
                      >
                        <lucide-icon [img]="Plus" [size]="14"></lucide-icon>
                      </button>
                    </div>
                    <div class="row-cells scrollable-column">
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
                    <div class="metrics-cell">
                      <div class="metrics-group">
                        <div class="metric-row">
                          <label>2025:</label>
                          <span>{{ getChildMetricsYear(child, 2025) | number : "1.0-0" }}j</span>
                        </div>
                        <div class="metric-row">
                          <label>2026:</label>
                          <span>{{ getChildMetricsYear(child, 2026) | number : "1.0-0" }}j</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Resource Rows (3rd level) -->
                  <ng-container *ngIf="child.expanded">
                    <div
                      *ngFor="let resource of child.resources"
                      class="calendar-row-wrapper"
                      [attr.data-resource-id]="getResourceUniqueId(resource, child, row)"
                      (mousedown)="onMouseDown($event, resource, child, row)"
                      (mousemove)="onMouseMove($event, resource, child, row)"
                      (mouseup)="onMouseUp()"
                      (mouseleave)="onMouseUp()"
                    >
                      <div class="row-label fixed-column">
                        <div class="resource-detail-label" style="padding-left:50px;">
                          <span class="resource-detail-name">{{ resource.label }}</span>
                        </div>
                        <button
                          class="btn btn-xs btn-danger"
                          (click)="removeResource(resource, child, row); $event.stopPropagation()"
                          title="Supprimer cette ressource"
                          style="margin-left:auto;"
                        >
                          ×
                        </button>
                      </div>
                      <div class="row-cells scrollable-column">
                      <div
                        *ngFor="let week of displayedWeeks; let i = index"
                        class="week-cell resource-detail-cell"
                        [class.selected]="isCellSelected(resource, week)"
                        [class.has-capacity]="getResourceValue(resource, week) > 0"
                        [class.cell-positive]="shouldShowAvailability(resource, week, viewMode === 'project' ? child.id : row.id) && getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) > 0"
                        [class.cell-zero]="shouldShowAvailability(resource, week, viewMode === 'project' ? child.id : row.id) && getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) === 0"
                        [class.cell-negative]="shouldShowAvailability(resource, week, viewMode === 'project' ? child.id : row.id) && getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) < 0"
                        [attr.data-week-index]="i"
                      >
                        <div class="cell-content">
                          <div *ngIf="getResourceValue(resource, week) > 0" class="capacity-value">
                            {{ getResourceValue(resource, week) | number : "1.0-1" }}
                          </div>
                          <div
                            class="availability-indicator"
                            *ngIf="shouldShowAvailability(resource, week, viewMode === 'project' ? child.id : row.id)"
                            [ngClass]="{
                              'availability-positive': getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) > 0,
                              'availability-zero': getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) === 0,
                              'availability-negative': getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) < 0
                            }"
                          >
                            {{ getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) > 0 ? '+' : '' }}{{ getAvailability(resource, week, viewMode === 'project' ? child.id : row.id) | number : "1.0-1" }}
                          </div>
                        </div>
                      </div>
                      </div>
                      <div class="metrics-cell">
                        <div class="metrics-group">
                          <div class="metric-row">
                            <label>2025:</label>
                            <span>{{ getResourceMetricsYear(resource, 2025) | number : "1.0-0" }}j</span>
                          </div>
                          <div class="metric-row">
                            <label>2026:</label>
                            <span>{{ getResourceMetricsYear(resource, 2026) | number : "1.0-0" }}j</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ng-container>
                </ng-container>
              </ng-container>
            </ng-container>
          </ng-container>

          <!-- Flat View -->
          <ng-container *ngIf="displayFormat === 'flat'">
             <div
               *ngFor="let row of flatRows"
               class="calendar-row-wrapper"
               [attr.data-resource-id]="getResourceUniqueId(row.resource, row.child, row.parent)"
               (mousedown)="onMouseDown($event, row.resource, row.child, row.parent)"
               (mousemove)="onMouseMove($event, row.resource, row.child, row.parent)"
               (mouseup)="onMouseUp()"
               (mouseleave)="onMouseUp()"
             >
               <div class="row-label fixed-column">
                 <!-- No expansion toggles, no add buttons, just the full label -->
                 <div style="padding: 0 16px; font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="{{ row.fullLabel }}">
                   {{ row.fullLabel }}
                 </div>
               </div>
               <div class="row-cells scrollable-column">
                 <div
                   *ngFor="let week of displayedWeeks; let i = index"
                   class="week-cell resource-detail-cell"
                  [class.selected]="isCellSelected(row.resource, week)"
                  [class.has-capacity]="getResourceValue(row.resource, week) > 0"
                  [class.cell-positive]="shouldShowAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) && getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) > 0"
                  [class.cell-zero]="shouldShowAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) && getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) === 0"
                  [class.cell-negative]="shouldShowAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) && getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) < 0"
                  [attr.data-week-index]="i"
                 >
                   <div class="cell-content">
                     <div *ngIf="getResourceValue(row.resource, week) > 0" class="capacity-value">
                       {{ getResourceValue(row.resource, week) | number : "1.0-1" }}
                     </div>
                    <div
                      class="availability-indicator"
                      *ngIf="shouldShowAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id)"
                      [ngClass]="{
                        'availability-positive': getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) > 0,
                        'availability-zero': getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) === 0,
                        'availability-negative': getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) < 0
                      }"
                    >
                      {{ getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) > 0 ? '+' : '' }}{{ getAvailability(row.resource, week, viewMode === 'project' ? row.child.id : row.parent.id) | number : "1.0-1" }}
                    </div>
                    </div>
                   </div>
                 </div>
                 <div class="metrics-cell">
                   <div class="metrics-group">
                     <div class="metric-row">
                       <label>2025:</label>
                       <span>{{ getFlatRowMetricsYear(row, 2025) | number : "1.0-0" }}j</span>
                     </div>
                     <div class="metric-row">
                       <label>2026:</label>
                       <span>{{ getFlatRowMetricsYear(row, 2026) | number : "1.0-0" }}j</span>
                     </div>
                   </div>
                 </div>
             </div>
          </ng-container>

          <div *ngIf="rows.length === 0" class="empty-state">
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
        [style.opacity]="toolbarVisible ? 1 : 0"
      >
        <div class="selection-info">
          {{ selectedCells.length }} semaine(s) sélectionnée(s)
          <div class="selection-total">
            Total jours sélectionnés: {{ totalSelectedDays | number : "1.1-1" }}j
          </div>
        </div>
        <div class="selection-input-row">
          <input
            #bulkChargeInput
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
          <h2>
            {{ viewMode === "project" ? "Ajouter une équipe" : "Ajouter un projet" }} à {{ selectedParentRow?.label }}
          </h2>
          <button class="modal-close" (click)="closeLinkModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ viewMode === "project" ? "Sélectionner une équipe" : "Sélectionner un projet" }}</label>
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
            <div *ngIf="availableRoles.length === 0" class="no-roles-message">
              <p>Aucun rôle disponible. Tous les rôles sont déjà utilisés pour cette combinaison.</p>
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
              <p>Aucune personne disponible. Tous les personnes sont déjà utilisées pour cette combinaison.</p>
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
              (click)="addResourceToCharge()"
              [disabled]="
                !selectedResourceId ||
                (resourceTypeToAdd === 'role' && availableRoles.length === 0) ||
                (resourceTypeToAdd === 'personne' && availablePersonnes.length === 0)
              "
            >
              Ajouter
            </button>
            <button class="btn btn-secondary" (click)="closeAddResourceModal()">Annuler</button>
          </div>
        </div>
      </div>
    </div>
    
    <app-milestone-modal
        [(visible)]="showMilestoneModal"
        [jalon]="selectedJalon"
        [projets]="allProjects"
        (saved)="onMilestoneSaved()">
    </app-milestone-modal>
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
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

      .filters-bar {
        display: flex;
        gap: 12px;
        align-items: center;
        position: relative;
      }

      .filter-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
        min-width: 140px;
      }

      .filter-title {
        font-weight: 600;
        color: #374151;
        font-size: 13px;
      }

      .chip-list {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .chip {
        background: #eef2ff;
        color: #3730a3;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 12px;
      }
      .chip.placeholder {
        background: transparent;
        color: #94a3b8;
      }

      .filters-dropdown {
        position: absolute;
        top: 48px;
        left: 0;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(2, 6, 23, 0.08);
        padding: 8px;
        z-index: 1200;
        max-height: 320px;
        overflow: auto;
        min-width: 260px;
      }

      .dropdown-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px;
      }
      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        padding: 6px;
        border-radius: 6px;
      }
      .dropdown-item:hover {
        background: #f8fafc;
      }
      .dropdown-group {
        font-size: 12px;
        color: #6b7280;
        padding: 8px 4px 2px;
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

      .btn-danger {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fecaca;
        color: #991b1b;
        border: 1px solid #fca5a5;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        transition: all 0.15s ease;
      }

      .btn-danger:hover {
        background: #fca5a5;
        color: #7f1d1d;
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
        max-height: calc(100vh - 250px);
        position: relative;
      }

      .calendar-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        max-height: calc(100vh - 250px);
      }

      .calendar-header-wrapper {
        display: flex;
        border-bottom: 2px solid #e2e8f0;
        min-height: 60px;
        background: #f9fafb;
        flex-shrink: 0;
      }

      .milestones-header-wrapper {
        display: flex;
        border-bottom: 2px solid #e2e8f0;
        min-height: 40px;
        background: #ffffff;
        flex-shrink: 0;
      }

      .milestones-fixed-col {
        background: #ffffff;
      }

      .milestones-metrics-fixed {
        background: #ffffff;
        border-left: 2px solid #e2e8f0;
        width: 200px;
        flex-shrink: 0;
      }

      .milestone-week-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        background: #ffffff;
        border-right: 1px solid #e2e8f0;
      }

      .milestones-container {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        justify-content: center;
        width: 100%;
      }

      .jalon-item {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 6px;
        border-radius: 12px;
        cursor: help;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        line-height: 1.2;
        text-align: center;
        white-space: nowrap;
      }

      .header-fixed {
        display: flex;
        align-items: center;
        padding: 0 16px;
        background: #f9fafb;
        border-right: 2px solid #e2e8f0;
        z-index: 10;
      }

      .header-scroll-container {
        flex: 1;
        overflow-x: hidden;
        overflow-y: hidden;
        display: flex;
      }

      .metrics-header-fixed {
        width: 200px;
        flex-shrink: 0;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
        border-left: 2px solid #e2e8f0;
        z-index: 10;
        text-align: center;
      }

      .calendar-row-wrapper {
        display: flex;
        min-height: 48px;
      }

      .calendar-grid-wrapper {
        display: flex;
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .row-label {
        display: flex;
        align-items: center;
        padding: 0 16px;
      }

      .fixed-column {
        width: 300px;
        flex-shrink: 0;
        border-right: 2px solid #e2e8f0;
        background: #f9fafb;
        position: sticky;
        left: 0;
        z-index: 5;
      }

      .row-cells {
        display: flex;
        flex: 1;
        border-bottom: 1px solid #e2e8f0;  /* bordure sur chaque cellule */
      }

      .scrollable-column {
        position: relative;
      }

      .metrics-cell {
        width: 200px;
        flex-shrink: 0;
        padding: 12px 16px;
        border-left: 2px solid #e2e8f0;
        background: white;
        position: sticky;
        right: 0;
        z-index: 8;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        font-size: 12px;
      }

      .metrics-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .metric-row label {
        font-weight: 600;
        color: #374151;
        min-width: 50px;
      }

      .metric-row span {
        font-weight: 500;
        color: #1e293b;
      }

      .calendar-grid {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-x: auto;
        overflow-y: auto;
      }

      .calendar-row-wrapper:nth-child(odd) .fixed-column {
        background: #f9fafb;
      }

      .calendar-row-wrapper:nth-child(even) .fixed-column {
        background: white;
      }

      .week-header {
        min-width: 80px;
        width: 80px;
        padding: 8px;
        border-right: 1px solid #e2e8f0;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-weight: 600;
        background: #f9fafb;
      }

      .week-date {
        font-size: 12px;
        color: #6b7280;
      }

      .week-number {
        font-size: 13px;
        font-weight: 700;
        color: #374151;
      }

      .week-header.current-week {
        background: #dbeafe;
        border-left: 3px solid #3b82f6;
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

      /* Availability Styles */
      .availability-indicator {
        font-size: 11px;
        margin-top: 2px;
        font-weight: 500;
      }

      .availability-positive {
        color: #059669; /* Green text */
      }
      /* To color the cell background based on availability, we need to target the parent cell. 
         However, Angular's style encapsulation or structure might make it easier to just color the cell contents 
         or use ::ng-deep if needed, but cleaner is better. 
         Let's try to pass the class to the cell itself in the template if possible, 
         or just style the indicator heavily. 
         The user request says "la couleur de la cellule dépendrait de la disponibilité". 
         So I should move the [ngClass] logic to the cell div in the template in a future step if this isn't enough.
         For now, I'll style the indicator text as requested and perhaps background of the cell?
         Actually, let's update the template in the next step to apply the class to the cell itself 
         so we can change the background color of the WHOLE cell.
      */
      
      /* New attempt: classes on the CELL itself */
      .cell-positive {
        background: #d1fae5 !important; /* Light Green */
      }
      .cell-zero {
        background: #fef3c7 !important; /* Light Yellow */
      }
      .cell-negative {
        background: #fee2e2 !important; /* Light Red */
      }
      
      /* Text colors specific to availability */
      .text-positive { color: #059669; }
      .text-zero { color: #d97706; }
      .text-negative { color: #dc2626; }

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

      .selection-total {
        font-weight: 500;
        font-size: 13px;
        margin-top: 6px;
        margin-bottom: 10px;
        color: #065f46;
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

      /* Toggle Switch Styles */
      .toggle-container {
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        padding: 4px 12px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        height: 38px;
      }
      
      .toggle-label {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
      }

      .switch {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 18px;
      }

      .switch input { 
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        -webkit-transition: .4s;
        transition: .4s;
        border-radius: 34px;
      }

      .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        -webkit-transition: .4s;
        transition: .4s;
        border-radius: 50%;
      }

      input:checked + .slider {
        background-color: #3b82f6;
      }

      input:focus + .slider {
        box-shadow: 0 0 1px #3b82f6;
      }

      input:checked + .slider:before {
        -webkit-transform: translateX(14px);
        -ms-transform: translateX(14px);
        transform: translateX(14px);
      }
    `,
  ],
})
export class PlanViewComponent implements OnInit {
  // Milestone Modal props
  showMilestoneModal = false;
  selectedJalon: Jalon | null = null;

  openMilestoneModal(jalon: Jalon, event: Event) {
    event.stopPropagation();
    this.selectedJalon = jalon;
    this.showMilestoneModal = true;
  }

  async onMilestoneSaved() {
    await this.loadData();
  }

  viewMode: "project" | "team" = "project";
  displayFormat: "tree" | "flat" = "tree";
  showAvailability: boolean = false;

  flatRows: FlatRow[] = [];

  // Usage Map
  usageMap: Map<string, number> = new Map();

  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  rows: ParentRow[] = [];

  allProjects: Projet[] = [];
  allEquipes: Equipe[] = [];
  // Duplicate removed

  allCharges: Charge[] = [];
  allCapacities: Capacite[] = [];
  allLinks: { equipe_id: string; projet_id: string }[] = [];

  // Filters
  rowsAll: ParentRow[] = [];
  filterEquipeIds: string[] = [];
  filterProjetIds: string[] = [];
  filterResourceIds: string[] = []; // values like 'role:<id>' or 'personne:<id>'

  // Dropdown states
  openEquipeDropdown = false;
  openProjetDropdown = false;
  openResourceDropdown = false;

  // Link Modal State
  showLinkModal = false;
  selectedParentRow: ParentRow | null = null;
  linkableItems: { id: string; label: string }[] = [];
  selectedIdToLink: string = "";

  // Resource Modal State
  showAddResourceModal = false;
  selectedChildRow: ChildRow | null = null;
  selectedParentForResource: ParentRow | null = null;
  resourceTypeToAdd: "role" | "personne" = "role";
  selectedResourceId: string = "";
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
  toolbarVisible: boolean = false; // Controls opacity to prevent flash

  bulkChargeValue: number | null = null;

  @ViewChild("bulkChargeInput") bulkChargeInput?: ElementRef<HTMLInputElement>;
  @ViewChild("headerScroll") headerScroll?: ElementRef<HTMLDivElement>;
  @ViewChild("dataScroll") dataScroll?: ElementRef<HTMLDivElement>;

  jalons: Jalon[] = [];
  @ViewChild("milestonesScroll") milestonesScroll!: ElementRef;

  // Icons
  Plus = Plus;

  constructor(
    private teamService: TeamService,
    private projetService: ProjetService,
    private chargeService: ChargeService,
    private calendarService: CalendarService,
    private jalonService: JalonService
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
    try {
      const [projects, equipes, charges, capacities, links, roles, personnes, jalons] = await Promise.all([
        this.projetService.getAllProjets(),
        this.teamService.getAllEquipes(),
        this.chargeService.getAllCharges(),
        this.teamService.getAllCapacities(),
        this.projetService.getAllEquipeProjetLinks(),
        this.teamService.getAllRoles(),
        this.teamService.getAllPersonnes(),
        this.jalonService.getAllJalons()
      ]);

      this.allProjects = projects;
      this.allEquipes = equipes;
      this.allCharges = charges;
      this.allCapacities = capacities;
      this.allLinks = links;
      this.availableRoles = roles;
      this.availablePersonnes = personnes;
      this.jalons = jalons;

      this.calculateUsage();
      this.buildTree();
    } catch (error) {
      console.error("Error loading data", error);
    }
  }


  getJalonsForWeek(week: Date): Jalon[] {
    const startOfWeek = new Date(week);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.jalons.filter(j => {
      const jDate = new Date(j.date_jalon);
      return jDate >= startOfWeek && jDate <= endOfWeek;
    });
  }

  getJalonColor(type: string): string {
    switch (type) {
      case 'LV': return '#d1fae5'; // Green
      case 'MEP': return '#dbeafe'; // Blue
      case 'SP': return '#fef3c7'; // Amber
      default: return '#f3f4f6'; // Gray
    }
  }

  getJalonTextColor(type: string): string {
    switch (type) {
      case 'LV': return '#065f46';
      case 'MEP': return '#1e40af';
      case 'SP': return '#92400e';
      default: return '#4b5563';
    }
  }

  calculateUsage() {
    this.usageMap.clear();

    for (const charge of this.allCharges) {
      if (!charge.semaine_debut || !charge.equipe_id) continue;

      const weekKey = charge.semaine_debut.split("T")[0];
      const teamId = charge.equipe_id;

      let resourceKey = "";
      if (charge.role_id) {
        resourceKey = `role_${charge.role_id}`;
      } else if (charge.personne_id) {
        resourceKey = `personne_${charge.personne_id}`;
      } else {
        continue;
      }

      const mapKey = `${teamId}_${resourceKey}_${weekKey}`;
      const currentVal = this.usageMap.get(mapKey) || 0;
      this.usageMap.set(mapKey, currentVal + charge.unite_ressource);
    }
  }

  getAvailability(resource: ResourceRow, week: Date, teamId: string): number {
    const weekKey = week.toISOString().split("T")[0];
    // resource.id contains the ID, resource.type contains "role" or "personne"
    const resourceKey = `${resource.type}_${resource.id}`;
    const mapKey = `${teamId}_${resourceKey}_${weekKey}`;

    const usage = this.usageMap.get(mapKey) || 0;

    // Find custom capacity if exists
    // We look for a capacity record for this resource, this team, this week
    const customCap = this.allCapacities.find(c =>
      c.equipe_id === teamId &&
      c.semaine_debut.startsWith(weekKey) &&
      (resource.type === 'role' ? c.role_id === resource.id : c.personne_id === resource.id)
    );

    const totalCapacity = customCap ? customCap.capacite : 0;

    return totalCapacity - usage;
  }

  shouldShowAvailability(resource: ResourceRow, week: Date, teamId: string): boolean {
    const charge = this.getResourceValue(resource, week);
    const availability = this.getAvailability(resource, week, teamId);
    return charge > 0 || (this.showAvailability && availability !== 0);
  }

  switchViewMode(mode: "project" | "team") {
    this.viewMode = mode;
    this.buildTree();
  }

  buildTree() {
    this.rows = [];
    // Restore expanded state if re-building (optional, good UX)
    // For now reset to closed or keep simple.

    if (this.viewMode === "project") {
      // Parent = Project, Child = Team, GrandChild = Resource
      // Sort projects alphabetically
      const sortedProjects = [...this.allProjects].sort((a, b) => a.nom_projet.localeCompare(b.nom_projet));

      for (const project of sortedProjects) {
        const projectCharges = this.allCharges.filter((c) => c.projet_id === project.id);

        // Find all teams involved in this project (via charges OR links)
        const chargeTeamIds = projectCharges.map((c) => c.equipe_id).filter((id) => !!id);
        const linkedTeamIds = this.allLinks.filter((l) => l.projet_id === project.id).map((l) => l.equipe_id);

        const involvedTeamIds = new Set([...chargeTeamIds, ...linkedTeamIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedTeamIds.forEach((teamId) => {
          const team = this.allEquipes.find((e) => e.id === teamId);
          const label = team ? team.nom : "No Team";
          const teamCharges = new Map<string, number>();

          // Get charges for this team on this project
          const teamProjectCharges = projectCharges.filter((c) => c.equipe_id === teamId);

          // Build resources for this team
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach((charge) => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: "role" | "personne";
            let joursParSemaine = 0;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find((r) => r.id === charge.role_id);
              resourceLabel = role ? role.nom : "Unknown Role";
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = "role";
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find((p) => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : "Unknown Person";
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = "personne";
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${project.id}_${teamId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || "",
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>(),
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split("T")[0];
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
            charges: teamCharges,
          });
        });

        // Sort children (teams) alphabetically
        children.sort((a, b) => a.label.localeCompare(b.label));

        // Sort resources within each child alphabetically
        children.forEach((child) => {
          child.resources.sort((a, b) => a.label.localeCompare(b.label));
        });

        this.rows.push({
          id: project.id!,
          label: project.nom_projet,
          expanded: true, // Expanded by default
          children: children,
          totalCharges: parentTotal,
        });
      }
    } else {
      // Parent = Team, Child = Project, GrandChild = Resource
      // Sort teams alphabetically
      const sortedTeams = [...this.allEquipes].sort((a, b) => a.nom.localeCompare(b.nom));

      for (const team of sortedTeams) {
        const teamCharges = this.allCharges.filter((c) => c.equipe_id === team.id);

        // Find all projects this team is working on (via charges OR links)
        const chargeProjectIds = teamCharges.map((c) => c.projet_id).filter((id) => !!id);
        const linkedProjectIds = this.allLinks.filter((l) => l.equipe_id === team.id).map((l) => l.projet_id);

        const involvedProjectIds = new Set([...chargeProjectIds, ...linkedProjectIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedProjectIds.forEach((projectId) => {
          const project = this.allProjects.find((p) => p.id === projectId);
          const label = project ? project.nom_projet : "Unknown Project";
          const projectCharges = new Map<string, number>();

          // Get charges for this project on this team
          const teamProjectCharges = teamCharges.filter((c) => c.projet_id === projectId);

          // Build resources for this project
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach((charge) => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: "role" | "personne";
            let joursParSemaine = 0;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find((r) => r.id === charge.role_id);
              resourceLabel = role ? role.nom : "Unknown Role";
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = "role";
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find((p) => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : "Unknown Person";
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = "personne";
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${team.id}_${projectId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || "",
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>(),
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split("T")[0];
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
            charges: projectCharges,
          });
        });

        // Sort children (projects) alphabetically
        children.sort((a, b) => a.label.localeCompare(b.label));

        // Sort resources within each child alphabetically
        children.forEach((child) => {
          child.resources.sort((a, b) => a.label.localeCompare(b.label));
        });

        this.rows.push({
          id: team.id!,
          label: team.nom,
          expanded: true, // Expanded by default
          children: children,
          totalCharges: parentTotal,
        });
      }
    }
    // Keep a copy of unfiltered rows and apply active filters
    this.rowsAll = [...this.rows];
    this.applyFilters();
  }

  toggleDisplayFormat(format: "tree" | "flat") {
    this.displayFormat = format;
  }

  buildFlatList() {
    this.flatRows = [];

    // Iterate over the currently filtered rows (this.rows)
    for (const parent of this.rows) {
      for (const child of parent.children) {
        for (const resource of child.resources) {
          let label = "";
          if (this.viewMode === "project") {
            // Project > Team > Resource
            label = `${parent.label} / ${child.label} / ${resource.label}`;
          } else {
            // Team > Project > Resource
            label = `${parent.label} / ${child.label} / ${resource.label}`;
          }

          this.flatRows.push({
            uniqueId: resource.uniqueId,
            fullLabel: label,
            resource: resource,
            child: child,
            parent: parent
          });
        }
      }
    }

    // Sort flattened rows alphabetically by full label
    this.flatRows.sort((a, b) => a.fullLabel.localeCompare(b.fullLabel));
    console.log(this.flatRows);
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
    const weekKey = week.toISOString().split("T")[0];
    return row.totalCharges.get(weekKey) || 0;
  }

  getChildValue(child: ChildRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return child.charges.get(weekKey) || 0;
  }

  getResourceValue(resource: ResourceRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return resource.charges.get(weekKey) || 0;
  }

  onGridScroll(event: Event): void {
    // Synchronize horizontal scroll between header and data
    const target = event.target as HTMLElement;
    const scrollLeft = target.scrollLeft;

    if (this.headerScroll) {
      this.headerScroll.nativeElement.scrollLeft = scrollLeft;
    }
    if (this.milestonesScroll) {
      this.milestonesScroll.nativeElement.scrollLeft = scrollLeft;
    }
  }

  // Modal & Linking Logic
  openLinkModal(row: ParentRow) {
    this.selectedParentRow = row;
    this.selectedIdToLink = "";

    const existingChildIds = new Set(row.children.map((c) => c.id));

    if (this.viewMode === "project") {
      // Parent is Project, we want to add Teams
      // Filter out teams that are already attached (via charges or existing link)
      this.linkableItems = this.allEquipes
        .filter((e) => !existingChildIds.has(e.id!))
        .map((e) => ({ id: e.id!, label: e.nom }));
    } else {
      // Parent is Team, we want to add Projects
      this.linkableItems = this.allProjects
        .filter((p) => !existingChildIds.has(p.id!))
        .map((p) => ({ id: p.id!, label: p.nom_projet }));
    }

    this.showLinkModal = true;
  }

  closeLinkModal() {
    this.showLinkModal = false;
    this.selectedParentRow = null;
    this.selectedIdToLink = "";
  }

  async linkItem() {
    if (!this.selectedParentRow || !this.selectedIdToLink) return;

    try {
      if (this.viewMode === "project") {
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
    this.resourceTypeToAdd = "role";
    this.selectedResourceId = "";
    this.showAddResourceModal = true;

    // Determine projetId and equipeId based on view mode
    let projetId: string;
    let equipeId: string;

    if (this.viewMode === "project") {
      // Parent is Project, Child is Team
      projetId = parent.id;
      equipeId = child.id;
    } else {
      // Parent is Team, Child is Project
      equipeId = parent.id;
      projetId = child.id;
    }

    try {
      // Load only available roles for this project+team combination
      this.availableRoles = await this.chargeService.getAvailableRolesForProjectTeam(projetId, equipeId);

      // Load only available persons for this project+team combination
      this.availablePersonnes = await this.chargeService.getAvailablePersonnesForProjectTeam(projetId, equipeId);
    } catch (error) {
      console.error("Error loading available resources:", error);
      this.availableRoles = [];
      this.availablePersonnes = [];
    }
  }

  closeAddResourceModal() {
    this.showAddResourceModal = false;
    this.selectedChildRow = null;
    this.selectedParentForResource = null;
    this.selectedResourceId = "";
  }

  async addResourceToCharge() {
    if (!this.selectedChildRow || !this.selectedParentForResource || !this.selectedResourceId) return;

    try {
      let projetId: string;
      let equipeId: string;

      if (this.viewMode === "project") {
        // Parent is Project, Child is Team
        projetId = this.selectedParentForResource.id;
        equipeId = this.selectedChildRow.id;
      } else {
        // Parent is Team, Child is Project
        equipeId = this.selectedParentForResource.id;
        projetId = this.selectedChildRow.id;
      }

      const roleId = this.resourceTypeToAdd === "role" ? this.selectedResourceId : undefined;
      const personneId = this.resourceTypeToAdd === "personne" ? this.selectedResourceId : undefined;

      await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);

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

      const uniqueId = this.getResourceUniqueId(
        firstCell.resource,
        { id: firstCell.childId } as ChildRow,
        { id: firstCell.parentId } as ParentRow
      );

      const rowSelector = `[data-resource-id="${uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector);

      if (rowElement) {
        const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
        const cellElement = rowElement.querySelector(cellSelector);

        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          this.toolbarPosition = {
            top: rect.bottom,
            left: rect.left + rect.width / 2,
          };

          // Make toolbar visible now that position is set
          this.toolbarVisible = true;

          // Focus the input after the toolbar is displayed
          setTimeout(() => {
            this.bulkChargeInput?.nativeElement.focus();
          }, 50);
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
        parentId: parent.id,
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
    this.bulkChargeValue = null;
  }

  async applyBulkCharge() {
    if (this.selectedCells.length === 0 || this.bulkChargeValue == null) return;

    try {
      for (const cell of this.selectedCells) {
        const weekKey = cell.week.toISOString().split("T")[0];

        let projetId: string;
        let equipeId: string;

        if (this.viewMode === "project") {
          // Parent is Project, Child is Team
          projetId = cell.parentId;
          equipeId = cell.childId;
        } else {
          // Parent is Team, Child is Project
          equipeId = cell.parentId;
          projetId = cell.childId;
        }

        const roleId = cell.resource.type === "role" ? cell.resource.id : undefined;
        const personneId = cell.resource.type === "personne" ? cell.resource.id : undefined;

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
      // calculateUsage is called within loadData
      this.clearSelection();
    } catch (error) {
      console.error("Error applying bulk charge:", error);
      alert("Erreur lors de l'application des charges.");
    }
  }

  // --- Filter helpers ---
  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event) {
    // Close any open dropdown if clicking outside
    const target = event.target as HTMLElement;
    // if click is outside filters-bar, close dropdowns
    if (!target.closest(".filters-bar")) {
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
    }
  }

  toggleDropdown(name: "equipe" | "projet" | "resource", event: MouseEvent) {
    event.stopPropagation();
    if (name === "equipe") {
      this.openEquipeDropdown = !this.openEquipeDropdown;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
    } else if (name === "projet") {
      this.openProjetDropdown = !this.openProjetDropdown;
      this.openEquipeDropdown = false;
      this.openResourceDropdown = false;
    } else {
      this.openResourceDropdown = !this.openResourceDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
    }
  }

  onEquipeToggle(id: string | undefined, event: Event) {
    if (!id) return;
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.filterEquipeIds.push(id);
    else this.filterEquipeIds = this.filterEquipeIds.filter((x) => x !== id);
    this.applyFilters();
  }

  onProjetToggle(id: string | undefined, event: Event) {
    if (!id) return;
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.filterProjetIds.push(id);
    else this.filterProjetIds = this.filterProjetIds.filter((x) => x !== id);
    this.applyFilters();
  }

  onResourceToggle(sel: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.filterResourceIds.push(sel);
    else this.filterResourceIds = this.filterResourceIds.filter((x) => x !== sel);
    this.applyFilters();
  }

  getEquipeName(id: string) {
    const e = this.allEquipes.find((x) => x.id === id);
    return e ? e.nom : "—";
  }

  getProjetLabel(id: string) {
    const p = this.allProjects.find((x) => x.id === id);
    return p ? `${p.code_projet} — ${p.nom_projet}` : "—";
  }

  getResourceLabel(sel: string) {
    const [type, id] = sel.split(":");
    if (type === "role") {
      const r = this.availableRoles.find((x) => x.id === id);
      return r ? `Role: ${r.nom}` : "Role: —";
    }
    const p = this.availablePersonnes.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : "Pers: —";
  }

  applyFilters() {
    // If no active filters, show original rows
    if (!this.filterEquipeIds.length && !this.filterProjetIds.length && !this.filterResourceIds.length) {
      this.rows = [...this.rowsAll];
      this.buildFlatList();
      return;
    }

    const filteredParents: ParentRow[] = [];

    for (const parent of this.rowsAll) {
      const newParent: ParentRow = {
        id: parent.id,
        label: parent.label,
        expanded: parent.expanded,
        children: [],
        totalCharges: parent.totalCharges,
      };

      // Process each child and apply child/resource-level filters
      for (const child of parent.children) {
        // Start with child's resources, then apply resource filter
        let resourcesMatch: ResourceRow[] = child.resources;
        if (this.filterResourceIds.length) {
          resourcesMatch = child.resources.filter((r) =>
            this.filterResourceIds.some((sel) => {
              const [t, id] = sel.split(":");
              return (
                (t === "role" && r.type === "role" && r.id === id) ||
                (t === "personne" && r.type === "personne" && r.id === id)
              );
            })
          );
        }

        // Child-level filters for equipe/projet depend on viewMode
        let childPassesEquipe = true;
        let childPassesProjet = true;

        if (this.filterEquipeIds.length) {
          if (this.viewMode === "project") {
            // child.id is equipe id
            childPassesEquipe = this.filterEquipeIds.includes(child.id);
          } else {
            // viewMode === 'team' -> parent is equipe; equipe filter applies to parent level
            childPassesEquipe = true;
          }
        }

        if (this.filterProjetIds.length) {
          if (this.viewMode === "team") {
            // child.id is projet id
            childPassesProjet = this.filterProjetIds.includes(child.id);
          } else {
            // viewMode === 'project' -> parent is projet; project filter applies at parent level
            childPassesProjet = true;
          }
        }

        // A child is included only if it passes child-level equipe/project filters AND has at least one matching resource (if resource filters set)
        const hasResourceMatch = this.filterResourceIds.length ? resourcesMatch.length > 0 : true;
        const includeChild = childPassesEquipe && childPassesProjet && hasResourceMatch;

        if (includeChild) {
          newParent.children.push({
            id: child.id,
            label: child.label,
            expanded: child.expanded,
            resources: resourcesMatch,
            charges: child.charges,
          });
        }
      }

      // Now decide whether to include parent
      // Parent must pass parent-level filter (if any) and have at least one child after filtering
      let parentPassesEquipe = true;
      let parentPassesProjet = true;

      if (this.filterEquipeIds.length) {
        if (this.viewMode === "team") {
          // parent.id is equipe id
          parentPassesEquipe = this.filterEquipeIds.includes(parent.id);
        } else {
          // viewMode === 'project' -> equipes filter applied on children only; parent passes if it has children matching the equipe
          parentPassesEquipe = true;
        }
      }

      if (this.filterProjetIds.length) {
        if (this.viewMode === "project") {
          // parent.id is projet id
          parentPassesProjet = this.filterProjetIds.includes(parent.id);
        } else {
          // viewMode === 'team' -> projet filter applied on children
          parentPassesProjet = true;
        }
      }

      const hasChildren = newParent.children.length > 0;

      if (parentPassesEquipe && parentPassesProjet && hasChildren) {
        filteredParents.push(newParent);
      }
    }

    this.rows = filteredParents;
    this.buildFlatList();
  }

  // Metrics calculation methods
  getRowMetricsYear(row: ParentRow, year: number): number {
    let total = 0;
    for (const child of row.children) {
      total += this.getChildMetricsYear(child, year);
    }
    return total;
  }

  getChildMetricsYear(child: ChildRow, year: number): number {
    let total = 0;
    for (const resource of child.resources) {
      total += this.getResourceMetricsYear(resource, year);
    }
    return total;
  }

  getResourceMetricsYear(resource: ResourceRow, year: number): number {
    let total = 0;
    for (const [weekKey, charge] of resource.charges) {
      const weekDate = new Date(weekKey);
      if (weekDate.getFullYear() === year) {
        // Calculate days: charge (units per week) * jours_par_semaine
        total += charge * resource.jours_par_semaine;
      }
    }
    return total;
  }

  getFlatRowMetricsYear(row: FlatRow, year: number): number {
    return this.getResourceMetricsYear(row.resource, year);
  }

  // Sum of days (charge * jours_par_semaine) for currently selected cells
  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const charge = this.getResourceValue(cell.resource, cell.week) || 0;
      const jours = cell.resource.jours_par_semaine || 0;
      total += charge * jours;
    }
    return total;
  }

  // Remove a resource from charges
  async removeResource(resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    const confirmMsg = `Êtes-vous sûr de vouloir supprimer "${resource.label}" ?
Cela supprimera toutes les charges associées à cette ressource.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      // Filter out all charges associated with this resource
      this.allCharges = this.allCharges.filter(
        (charge) =>
          !(
            (charge.role_id === resource.id && resource.type === 'role') ||
            (charge.personne_id === resource.id && resource.type === 'personne')
          )
      );

      // Rebuild tree to reflect changes
      this.calculateUsage();
      this.buildTree();
    } catch (error) {
      console.error('Error removing resource:', error);
      alert('Erreur lors de la suppression de la ressource.');
    }
  }
}

