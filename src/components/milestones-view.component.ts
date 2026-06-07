import { Component, OnInit, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, List, Calendar, GitCommit, Columns, Plus } from 'lucide-angular';
import { JalonService } from '../services/jalon.service';
import { ProjetService } from '../services/projet.service';
import { Jalon, Projet } from '../models/types';
import { MilestoneListComponent } from './milestones/milestone-list.component';
import { MilestoneCalendarComponent } from './milestones/milestone-calendar.component';
import { MilestoneCompactComponent } from './milestones/milestone-compact.component';
import { MilestoneTimelineComponent } from './milestones/milestone-timeline.component';
import { MilestoneModalComponent } from './milestones/milestone-modal.component';
import { ConfirmModalComponent } from "./confirm-modal.component";
import { storageSignal } from "../utils/storage-signal";

@NgModule({
  imports: [LucideAngularModule.pick({ List, Calendar, GitCommit, Columns, Plus })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: "app-milestones-view",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideIconsModule,
    MilestoneListComponent,
    MilestoneCalendarComponent,
    MilestoneCompactComponent,
    MilestoneTimelineComponent,
    MilestoneModalComponent,
    ConfirmModalComponent,
  ],
  template: `
    <div class="milestones-container">
      <div class="milestones-header">
        <div>
          <h1>Jalons</h1>
          <p class="subtitle">Gérez et visualisez la planification de vos projets</p>
        </div>

        <div class="header-actions">
          <div class="filter-group">
            <label class="filter-label">Projet :</label>
            <select
              class="project-select"
              [ngModel]="selectedProjetId()"
              (ngModelChange)="selectedProjetId.set($event)"
            >
              <option [ngValue]="null">Tous les projets</option>
              @for (p of projets; track p.id) {
                <option [value]="p.id">{{ p.nom_projet }}</option>
              }
            </select>
          </div>

          <div class="tabs-container">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'liste'"
              (click)="activeTab.set('liste')"
              title="Vue Liste"
            >
              <lucide-icon name="list" size="16"></lucide-icon>
              <span>Liste</span>
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'calendrier'"
              (click)="activeTab.set('calendrier')"
              title="Vue Calendrier"
            >
              <lucide-icon name="calendar" size="16"></lucide-icon>
              <span>Calendrier</span>
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'compact'"
              (click)="activeTab.set('compact')"
              title="Vue Compacte"
            >
              <lucide-icon name="columns" size="16"></lucide-icon>
              <span>Compacte</span>
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'timeline'"
              (click)="activeTab.set('timeline')"
              title="Vue Timeline"
            >
              <lucide-icon name="git-commit" size="16"></lucide-icon>
              <span>Timeline</span>
            </button>
          </div>

          <button class="btn btn-primary btn-add" (click)="openCreateModal()">
            <lucide-icon name="plus" size="16"></lucide-icon>
            Nouveau Jalon
          </button>
        </div>
      </div>

      <div class="view-content-wrapper">
        @if (activeTab() === "liste") {
          <app-milestone-list
            [jalons]="filteredJalons"
            [projets]="projets"
            (edit)="openEditModal($event)"
            (delete)="askDeleteJalon($event)"
          ></app-milestone-list>
        }

        @if (activeTab() === "calendrier") {
          <app-milestone-calendar
            [jalons]="filteredJalons"
            (edit)="openEditModal($event)"
            (add)="openCreateModalAtDate($event)"
          ></app-milestone-calendar>
        }

        @if (activeTab() === "timeline") {
          <app-milestone-timeline
            [jalons]="filteredJalons"
            [projets]="projets"
            (edit)="openEditModal($event)"
          ></app-milestone-timeline>
        }

        @if (activeTab() === "compact") {
          <app-milestone-compact
            [jalons]="filteredJalons"
            (edit)="openEditModal($event)"
            (add)="openCreateModalAtDate($event)"
          ></app-milestone-compact>
        }
      </div>
    </div>

    <app-milestone-modal [(visible)]="showModal" [jalon]="currentJalon" [projets]="projets" (saved)="onJalonSaved()">
    </app-milestone-modal>

    <app-confirm-modal
      [visible]="showConfirmModal"
      [title]="confirmTitle"
      [message]="confirmMessage"
      confirmLabel="Supprimer"
      (confirm)="onConfirmAction()"
      (cancel)="showConfirmModal = false"
    >
    </app-confirm-modal>
  `,
  styles: [
    `
      .milestones-container {
        padding: 32px;
        background: #f8fafc;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .milestones-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 20px;
      }

      .milestones-header h1 {
        margin: 0 0 4px 0;
        font-size: 30px;
        font-weight: 700;
        color: #0f172a;
      }

      .subtitle {
        margin: 0;
        color: #64748b;
        font-size: 15px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
      }

      .project-select {
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: white;
        font-size: 14px;
        color: #1e293b;
        font-weight: 500;
        outline: none;
        cursor: pointer;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }

      .project-select:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .tabs-container {
        display: flex;
        background: #e2e8f0;
        padding: 4px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }

      .tab-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        transition: all 0.2s;
      }

      .tab-btn:hover {
        color: #0f172a;
      }

      .tab-btn.active {
        background: white;
        color: #4f46e5;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .btn {
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .btn-primary {
        background: #4f46e5;
        color: white;
      }

      .btn-primary:hover {
        background: #4338ca;
      }

      .view-content-wrapper {
        flex-grow: 1;
        min-height: 400px;
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .milestones-container {
        background: #0f172a;
      }

      :host-context(body.dark-mode) .milestones-header {
        border-bottom-color: #1e293b;
      }

      :host-context(body.dark-mode) .milestones-header h1 {
        color: #f8fafc;
      }

      :host-context(body.dark-mode) .subtitle {
        color: #94a3b8;
      }

      :host-context(body.dark-mode) .project-select {
        background: #1f2937;
        border-color: #374151;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .project-select:focus {
        border-color: #6366f1;
      }

      :host-context(body.dark-mode) .tabs-container {
        background: #1f2937;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .tab-btn {
        color: #9ca3af;
      }

      :host-context(body.dark-mode) .tab-btn:hover {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .tab-btn.active {
        background: #374151;
        color: #818cf8;
      }
    `,
  ],
})
export class MilestonesViewComponent implements OnInit {
  jalons: Jalon[] = [];
  projets: Projet[] = [];

  activeTab = storageSignal<"liste" | "calendrier" | "timeline" | "compact">("milestones-active-tab", "liste");
  selectedProjetId = storageSignal<string | null>("milestones-selected-project-id", null);

  showModal = false;
  currentJalon: Partial<Jalon> | null = null;

  // Confirm Modal state
  showConfirmModal = false;
  confirmTitle = "";
  confirmMessage = "";
  private pendingConfirmAction: (() => void) | null = null;

  onConfirmAction() {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
  }

  constructor(
    private jalonService: JalonService,
    private projetService: ProjetService,
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      const [jalonsData, projetsData] = await Promise.all([
        this.jalonService.getAllJalons(),
        this.projetService.getAllProjets(),
      ]);
      this.jalons = jalonsData;
      this.projets = projetsData;
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  get filteredJalons(): Jalon[] {
    if (!this.selectedProjetId()) return this.jalons;
    return this.jalons.filter((j) => j.projet_id === this.selectedProjetId());
  }

  openCreateModal() {
    this.currentJalon = null;
    this.showModal = true;
  }

  openCreateModalAtDate(dateStr: string | null) {
    this.currentJalon = {
      event_date: dateStr || new Date().toISOString().split("T")[0],
      projet_id: this.selectedProjetId() || undefined, // Pre-populate with selected project if any
    };
    this.showModal = true;
  }

  openEditModal(jalon: Jalon) {
    this.currentJalon = jalon;
    this.showModal = true;
  }

  async onJalonSaved() {
    await this.loadData();
  }

  async askDeleteJalon(jalon: Jalon) {
    if (!jalon.id) return;

    this.confirmTitle = "Supprimer le jalon";
    this.confirmMessage = `Êtes-vous sûr de vouloir supprimer le jalon "${jalon.title}" ?`;

    this.pendingConfirmAction = async () => {
      try {
        await this.jalonService.deleteJalon(jalon.id!);
        await this.loadData();
      } catch (error) {
        console.error("Error deleting jalon:", error);
      }
    };
    this.showConfirmModal = true;
  }
}
