import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LucideAngularModule, Search, History, PenLine, Trash2, Package, Rocket, Layers, Flag } from "lucide-angular";
import { Jalon, Projet } from "../../models/types";

@NgModule({
  imports: [LucideAngularModule.pick({ Search, History, PenLine, Trash2, Package, Rocket, Layers, Flag })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: "app-milestone-list",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule],
  template: `
    <div class="milestone-list-container">
      <div class="filters-section">
        <div class="search-box">
          <lucide-icon name="search" size="18" class="search-icon"></lucide-icon>
          <input
            type="text"
            [(ngModel)]="searchText"
            (ngModelChange)="filterJalons()"
            placeholder="Rechercher par titre, description, version..."
          />
        </div>

        <label class="toggle-row">
          <span class="toggle-label">
            <lucide-icon name="history" size="18" class="icon-history"></lucide-icon> Jalons passés
          </span>
          <div class="toggle-material">
            <input type="checkbox" [(ngModel)]="showPastEvents" (change)="filterJalons()" />
            <span class="slider"></span>
          </div>
        </label>
      </div>

      <div class="milestones-info">
        <span class="badge coming">{{ filteredJalons.length }} jalon{{ filteredJalons.length > 1 ? 's' : '' }}</span>
      </div>

      <div class="cards-list">
        <div class="milestone-card" *ngFor="let jalon of filteredJalons" [class.past-event]="isPastEvent(jalon.event_date)">
          <div class="left">
            <div
              class="type-badge"
              [class.badge-livraison]="jalon.event_type === 'livraison'"
              [class.badge-mep]="jalon.event_type === 'mep'"
              [class.badge-sprint]="jalon.event_type === 'sprint'"
              [class.badge-autre]="jalon.event_type === 'autre' || !jalon.event_type"
            >
              <lucide-icon [name]="getIconName(jalon.event_type)" size="22"></lucide-icon>
            </div>

            <div class="info">
              <div class="row-1">
                <span class="title">{{ jalon.title }}</span>
                <span class="badge past" *ngIf="isPastEvent(jalon.event_date)">Passé</span>
                <span 
                  class="badge project" 
                  [style.background-color]="getProjectColor(jalon.projet_id) + '15'" 
                  [style.color]="getProjectColor(jalon.projet_id)"
                  [style.border]="'1px solid ' + getProjectColor(jalon.projet_id) + '30'"
                >
                  {{ getProjectName(jalon.projet_id) }}
                </span>
                <span class="badge version" *ngIf="jalon.version">v{{ jalon.version }}</span>
              </div>

              <div class="row-2 date">
                {{ formatDate(jalon.event_date) }}
              </div>

              <div class="row-3 desc" *ngIf="jalon.description">
                {{ jalon.description }}
              </div>
            </div>
          </div>
          <div class="actions-cell" *ngIf="!readonly">
            <button class="icon-btn edit-btn" (click)="edit.emit(jalon)" title="Modifier">
              <lucide-icon name="pen-line" size="20"></lucide-icon>
            </button>
            <button class="icon-btn delete-btn" (click)="delete.emit(jalon)" title="Supprimer">
              <lucide-icon name="trash-2" size="20"></lucide-icon>
            </button>
          </div>
        </div>

        <div class="empty-state" *ngIf="filteredJalons.length === 0">
          <p>Aucun jalon trouvé</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .milestone-list-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
        padding: 1rem 1.5rem;
      }

      .filters-section {
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 250px;
      }

      .search-icon {
        position: absolute;
        left: 0.75rem;
        color: #6b7280;
        pointer-events: none;
      }

      .search-box input {
        width: 100%;
        padding: 0.5rem 0.5rem 0.5rem 2.25rem;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        font-size: 0.875rem;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .search-box input:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .toggle-row .toggle-label {
        font-size: 0.875rem;
        color: #4b5563;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .icon-history {
        color: #6b7280;
      }

      .toggle-material {
        position: relative;
        width: 46px;
        height: 24px;
        display: inline-block;
      }

      .toggle-material input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-material .slider {
        position: absolute;
        inset: 0;
        background: #cbd5e1;
        border-radius: 24px;
        transition: 0.25s;
      }

      .toggle-material .slider:before {
        content: "";
        position: absolute;
        width: 18px;
        height: 18px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.25s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .toggle-material input:checked + .slider {
        background: #4f46e5;
      }

      .toggle-material input:checked + .slider:before {
        transform: translateX(22px);
      }

      .milestones-info {
        margin-bottom: 1rem;
      }

      .badge.coming {
        background: #eef2ff;
        color: #4f46e5;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-block;
      }

      .cards-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
      }

      .milestone-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: white;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .milestone-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border-color: #cbd5e1;
      }

      .milestone-card.past-event {
        opacity: 0.7;
      }

      .left {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
      }

      .type-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        flex-shrink: 0;
      }

      .badge-livraison {
        background: #d1fae5;
        color: #065f46;
      }

      .badge-mep {
        background: #dbeafe;
        color: #1e40af;
      }

      .badge-sprint {
        background: #fef3c7;
        color: #92400e;
      }

      .badge-autre {
        background: #f3f4f6;
        color: #4b5563;
      }

      .info {
        display: flex;
        flex-direction: column;
      }

      .info .row-1 {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .title {
        font-weight: 600;
        font-size: 1rem;
        color: #111827;
      }

      .badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 500;
      }

      .badge.past {
        background: #f3f4f6;
        color: #4b5563;
      }

      .badge.project {
        font-size: 0.75rem;
        font-weight: 600;
      }

      .badge.version {
        background: #f1f5f9;
        color: #475569;
        font-family: monospace;
      }

      .date {
        font-size: 0.85rem;
        color: #6b7280;
        margin-top: 4px;
        text-transform: capitalize;
      }

      .desc {
        margin-top: 6px;
        font-size: 0.875rem;
        color: #4b5563;
        line-height: 1.4;
      }

      .actions-cell {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .icon-btn {
        background: transparent;
        border: none;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
      }

      .icon-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .edit-btn:hover {
        color: #d97706;
        background: #fef3c7;
      }

      .delete-btn:hover {
        color: #dc2626;
        background: #fee2e2;
      }

      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 150px;
        color: #6b7280;
        font-size: 0.9rem;
        border: 2px dashed #e5e7eb;
        border-radius: 10px;
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .milestone-list-container {
        background: #111827;
      }

      :host-context(body.dark-mode) .search-box input {
        background: #1f2937;
        border-color: #374151;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .toggle-row .toggle-label {
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .milestone-card {
        background: #1f2937;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .milestone-card:hover {
        background-color: #273549;
        border-color: #4b5563;
      }

      :host-context(body.dark-mode) .title {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .date {
        color: #9ca3af;
      }

      :host-context(body.dark-mode) .desc {
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .badge.past {
        background: #374151;
        color: #9ca3af;
      }

      :host-context(body.dark-mode) .badge.version {
        background: #374151;
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .icon-btn {
        color: #9ca3af;
      }

      :host-context(body.dark-mode) .icon-btn:hover {
        background: #374151;
      }

      :host-context(body.dark-mode) .edit-btn:hover {
        color: #fbbf24;
        background: #451a03;
      }

      :host-context(body.dark-mode) .delete-btn:hover {
        color: #f87171;
        background: #450a0a;
      }

      :host-context(body.dark-mode) .empty-state {
        border-color: #374151;
      }
    `,
  ],
})
export class MilestoneListComponent implements OnInit, OnChanges {
  @Input() jalons: Jalon[] = [];
  @Input() projets: Projet[] = [];
  @Input() readonly = false;

  @Output() edit = new EventEmitter<Jalon>();
  @Output() delete = new EventEmitter<Jalon>();

  filteredJalons: Jalon[] = [];
  searchText = "";
  showPastEvents = false;

  ngOnInit(): void {
    this.filterJalons();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['jalons'] || changes['projets']) {
      this.filterJalons();
    }
  }

  filterJalons(): void {
    let filtered = [...this.jalons];

    if (!this.showPastEvents) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((j) => {
        const jDate = new Date(j.event_date);
        return jDate >= today;
      });
    }

    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title?.toLowerCase().includes(searchLower) ||
          j.version?.toLowerCase().includes(searchLower) ||
          j.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date ascending
    this.filteredJalons = filtered.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }

  isPastEvent(dateStr: string): boolean {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  }

  getProjectName(projetId?: string | null): string {
    if (!projetId) return "Global";
    const project = this.projets.find((p) => p.id === projetId);
    return project ? project.nom_projet : "Global";
  }

  getProjectColor(projetId?: string | null): string {
    if (!projetId) return "#6b7280"; // Gray default
    const project = this.projets.find((p) => p.id === projetId);
    return project?.color || "#4f46e5";
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  getIconName(type: string): string {
    switch (type) {
      case 'livraison':
        return 'package';
      case 'mep':
        return 'rocket';
      case 'sprint':
        return 'layers';
      default:
        return 'flag';
    }
  }
}
