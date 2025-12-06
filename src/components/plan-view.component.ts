import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../services/team.service";
import { ProjetService } from "../services/projet.service";
import { ChargeService } from "../services/charge.service";
import { Equipe, Projet, Charge } from "../models/types";
import { CalendarService } from "../services/calendar.service";

interface ChildRow {
    id: string;
    label: string;
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
    imports: [CommonModule, FormsModule],
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
              </div>
            </div>

            <ng-container *ngIf="row.expanded">
              <div *ngFor="let child of row.children" class="resource-label-row">
                <div class="resource-label">
                   <span class="resource-name" style="padding-left: 20px;">{{ child.label }}</span>
                </div>
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
                <div *ngFor="let child of row.children" class="resource-weeks-row">
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
            </ng-container>
          </ng-container>

          <div *ngIf="rows.length === 0" class="empty-state-weeks">
            <p>Aucune donnée</p>
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

        this.buildTree();
    }

    switchViewMode(mode: 'project' | 'team') {
        this.viewMode = mode;
        this.buildTree();
    }

    buildTree() {
        this.rows = [];

        if (this.viewMode === 'project') {
            // Parent = Project, Child = Team
            for (const project of this.allProjects) {
                const projectCharges = this.allCharges.filter(c => c.projet_id === project.id);
                // if (projectCharges.length === 0) continue; // Show all projects

                // Find all teams involved in this project
                const involvedTeamIds = new Set(projectCharges.map(c => c.equipe_id).filter(id => !!id));

                const children: ChildRow[] = [];
                const parentTotal = new Map<string, number>();

                involvedTeamIds.forEach(teamId => {
                    const team = this.allEquipes.find(e => e.id === teamId);
                    const label = team ? team.nom : 'No Team';
                    const charges = new Map<string, number>();

                    // Sum charges for this team on this project per week
                    projectCharges.filter(c => c.equipe_id === teamId).forEach(c => {
                        const weekKey = c.semaine_debut.split('T')[0]; // simple date part check
                        const val = charges.get(weekKey) || 0;
                        charges.set(weekKey, val + c.unite_ressource);

                        const pVal = parentTotal.get(weekKey) || 0;
                        parentTotal.set(weekKey, pVal + c.unite_ressource);
                    });

                    children.push({
                        id: teamId!,
                        label: label,
                        charges: charges
                    });
                });

                // Always add the project row
                this.rows.push({
                    id: project.id!,
                    label: project.nom_projet,
                    expanded: false,
                    children: children,
                    totalCharges: parentTotal
                });
            }
        } else {
            // Parent = Team, Child = Project
            for (const team of this.allEquipes) {
                const teamCharges = this.allCharges.filter(c => c.equipe_id === team.id);
                // Show all teams

                // Find all projects this team is working on
                const involvedProjectIds = new Set(teamCharges.map(c => c.projet_id).filter(id => !!id));

                const children: ChildRow[] = [];
                const parentTotal = new Map<string, number>();

                involvedProjectIds.forEach(projectId => {
                    const project = this.allProjects.find(p => p.id === projectId);
                    const label = project ? project.nom_projet : 'Unknown Project';
                    const charges = new Map<string, number>();

                    teamCharges.filter(c => c.projet_id === projectId).forEach(c => {
                        const weekKey = c.semaine_debut.split('T')[0];
                        const val = charges.get(weekKey) || 0;
                        charges.set(weekKey, val + c.unite_ressource);

                        const pVal = parentTotal.get(weekKey) || 0;
                        parentTotal.set(weekKey, pVal + c.unite_ressource);
                    });

                    children.push({
                        id: projectId!,
                        label: label,
                        charges: charges
                    });
                });

                // Always add the team row
                this.rows.push({
                    id: team.id!,
                    label: team.nom,
                    expanded: false,
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
        // We might need fuzzy matching if the dates aren't perfectly aligned strings
        // But assuming service returns standard start-of-week dates
        return row.totalCharges.get(weekKey) || 0;
    }

    getChildValue(child: ChildRow, week: Date): number {
        const weekKey = week.toISOString().split('T')[0];
        return child.charges.get(weekKey) || 0;
    }
}
