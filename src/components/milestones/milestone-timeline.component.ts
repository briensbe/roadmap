import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LucideAngularModule, AlignJustify, Columns, PenLine, Package, Rocket, Layers, Flag } from "lucide-angular";
import { Jalon, Projet } from "../../models/types";

interface TimelineGroup {
  date: string;
  jalons: Jalon[];
}

@NgModule({
  imports: [LucideAngularModule.pick({ AlignJustify, Columns, PenLine, Package, Rocket, Layers, Flag })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: "app-milestone-timeline",
  standalone: true,
  imports: [CommonModule, LucideIconsModule],
  template: `
    <div class="timeline-container">
      <div class="header">
        <button class="toggle-btn" (click)="toggleMode()" [title]="isHorizontal ? 'Passer en vue verticale' : 'Passer en vue horizontale'">
          <lucide-icon [name]="isHorizontal ? 'align-justify' : 'columns'" size="20"></lucide-icon>
          <span>{{ isHorizontal ? 'Vue Verticale' : 'Vue Horizontale' }}</span>
        </button>
      </div>

      <div class="timeline-wrapper" [class.horizontal]="isHorizontal">
        <div class="timeline">
          <div class="timeline-line"></div>

          <div
            class="timeline-item"
            *ngFor="let group of groupedJalons; let i = index"
            [class.left]="!isHorizontal && i % 2 === 0"
            [class.right]="!isHorizontal && i % 2 !== 0"
          >
            <div class="content">
              <div class="date-badge">{{ formatDate(group.date) }}</div>
              
              <div class="events-group">
                <div 
                  class="card" 
                  *ngFor="let jalon of group.jalons" 
                  [class.is-livraison]="jalon.event_type === 'livraison'" 
                  [class.is-mep]="jalon.event_type === 'mep'"
                  [class.is-sprint]="jalon.event_type === 'sprint'"
                  [class.is-autre]="jalon.event_type === 'autre' || !jalon.event_type"
                  (click)="!readonly && edit.emit(jalon)"
                  [class.clickable]="!readonly"
                >
                  <div class="card-header">
                    <span class="type-icon">
                      <lucide-icon [name]="getIconName(jalon.event_type)" size="18"></lucide-icon>
                    </span>
                    <div class="header-details">
                      <span class="title">{{ jalon.title }}</span>
                      <span class="version" *ngIf="jalon.version">v{{ jalon.version }}</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <p *ngIf="jalon.description">{{ jalon.description }}</p>
                    <span 
                      class="project-badge"
                      [style.background-color]="getProjectColor(jalon.projet_id) + '15'" 
                      [style.color]="getProjectColor(jalon.projet_id)"
                    >
                      {{ getProjectName(jalon.projet_id) }}
                    </span>
                  </div>
                  <div class="card-actions" *ngIf="!readonly">
                    <lucide-icon name="pen-line" size="14" class="edit-icon"></lucide-icon>
                  </div>
                </div>
              </div>
            </div>
            <div class="dot"></div>
          </div>
          
          <div class="empty-state" *ngIf="jalons.length === 0">
            <p>Aucun jalon à afficher dans la timeline</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .timeline-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #f8fafc;
        padding: 1rem 1.5rem;
      }
      
      .timeline-container:has(.timeline-wrapper.horizontal) {
        overflow-y: auto;
      }

      .header {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 1rem;
        flex-shrink: 0;
      }

      .toggle-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        color: #4b5563;
        transition: all 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .toggle-btn:hover {
        background: #f1f5f9;
        color: #111827;
        border-color: #cbd5e1;
      }

      .timeline-wrapper {
        flex-grow: 1;
        overflow-y: auto;
        padding: 1rem 0;
        position: relative;
      }

      .timeline-wrapper.horizontal::-webkit-scrollbar {
        height: 10px;
      }

      .timeline-wrapper.horizontal::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 6px;
      }

      .timeline-wrapper.horizontal::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 6px;
        border: 2px solid #f1f5f9;
      }

      .timeline-wrapper.horizontal::-webkit-scrollbar-thumb:hover {
        background-color: #94a3b8;
      }

      .timeline-wrapper.horizontal {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 2rem 0;
        height: auto;
        min-height: 100%;
      }

      .timeline-wrapper.horizontal .timeline {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        height: auto;
        min-height: 480px;
        min-width: 100%;
        width: max-content;
        max-width: none;
        padding: 2rem;
        margin: 0;
      }

      .timeline-wrapper.horizontal .timeline-line {
        width: auto;
        left: 0;
        right: 0;
        height: 4px;
        top: 40px;
        transform: none;
        background: #cbd5e1;
      }

      .timeline-wrapper.horizontal .timeline-item {
        width: 320px;
        flex-shrink: 0;
        margin: 0 1.5rem;
        height: auto;
        position: relative;
        display: flex;
        left: auto;
        right: auto;
        padding: 0;
        text-align: left;
        overflow: visible;
        flex-direction: column;
        justify-content: flex-start;
        padding-top: 10px;
        align-self: stretch;
      }

      .timeline-wrapper.horizontal .content {
        width: 100%;
        max-height: none;
        overflow-y: visible;
        padding-right: 0;
      }

      .timeline-wrapper.horizontal .timeline-item::after {
        display: none;
      }

      .timeline-wrapper.horizontal .dot {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        margin: 0;
        flex-shrink: 0;
        z-index: 20;
        top: -32px;
        bottom: auto;
        right: auto;
      }

      .timeline-wrapper.horizontal .timeline-item:hover .dot {
        transform: translateX(-50%) scale(1.2);
      }

      .timeline-wrapper.horizontal .timeline-item::before {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        background: #cbd5e1;
        z-index: 1;
        top: -12px;
        height: 22px;
        bottom: auto;
      }

      .timeline {
        position: relative;
        max-width: 1000px;
        margin: 0 auto;
        padding: 2rem 0;
      }

      .timeline-line {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 100%;
        background: linear-gradient(to bottom, #e2e8f0 0%, #cbd5e1 50%, #e2e8f0 100%);
        border-radius: 2px;
      }

      .timeline-item {
        position: relative;
        margin-bottom: 3rem;
        width: 50%;
      }

      .timeline-item.left {
        left: 0;
        padding-right: 3rem;
        text-align: right;
      }

      .timeline-item.right {
        left: 50%;
        padding-left: 3rem;
        text-align: left;
      }

      .timeline-item::after {
        content: '';
        position: absolute;
        top: 30px;
        height: 2px;
        width: 3rem;
        background: #cbd5e1;
        z-index: 1;
      }

      .timeline-item.left::after {
        right: 0;
      }

      .timeline-item.right::after {
        left: 0;
      }

      .dot {
        position: absolute;
        top: 20px;
        width: 20px;
        height: 20px;
        background: white;
        border: 4px solid #4f46e5;
        border-radius: 50%;
        z-index: 10;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
        transition: all 0.3s ease;
      }

      .timeline-item.left .dot {
        right: -10px;
      }

      .timeline-item.right .dot {
        left: -10px;
      }

      .timeline-item:hover .dot {
        transform: scale(1.2);
        background: #4f46e5;
        box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.3);
      }

      .content {
        position: relative;
        transition: transform 0.3s ease;
      }

      .timeline-item:hover .content {
        transform: translateY(-3px);
      }

      .date-badge {
        display: inline-block;
        background: #475569;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-transform: capitalize;
      }

      .events-group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .card {
        background: white;
        border-radius: 12px;
        padding: 1rem 1.25rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        border-left: 5px solid transparent;
        position: relative;
        overflow: hidden;
        text-align: left;
      }

      .card.clickable {
        cursor: pointer;
        transition: box-shadow 0.2s, border-color 0.2s;
      }

      .card.clickable:hover {
        box-shadow: 0 6px 12px rgba(0,0,0,0.08);
      }

      .card.is-livraison {
        border-left-color: #10b981;
      }

      .card.is-mep {
        border-left-color: #3b82f6;
      }

      .card.is-sprint {
        border-left-color: #f59e0b;
      }

      .card.is-autre {
        border-left-color: #6b7280;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 0.5rem;
      }

      .type-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 6px;
      }

      .is-livraison .type-icon {
        background: #d1fae5;
        color: #065f46;
      }

      .is-mep .type-icon {
        background: #dbeafe;
        color: #1e40af;
      }

      .is-sprint .type-icon {
        background: #fef3c7;
        color: #92400e;
      }

      .is-autre .type-icon {
        background: #f3f4f6;
        color: #4b5563;
      }

      .header-details {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-grow: 1;
      }

      .title {
        font-weight: 700;
        font-size: 0.95rem;
        color: #1e293b;
      }

      .version {
        background: #f1f5f9;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-family: monospace;
        color: #475569;
      }

      .card-body p {
        margin: 0 0 0.75rem 0;
        color: #4b5563;
        line-height: 1.4;
        font-size: 0.85rem;
      }

      .project-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .card-actions {
        position: absolute;
        right: 0.75rem;
        bottom: 0.75rem;
        opacity: 0;
        transition: opacity 0.2s;
        color: #94a3b8;
      }

      .card:hover .card-actions {
        opacity: 1;
      }

      .empty-state {
        text-align: center;
        color: #64748b;
        padding: 3rem 1.5rem;
        background: white;
        border-radius: 10px;
        border: 2px dashed #cbd5e1;
      }

      @media (max-width: 768px) {
        .timeline-line {
          left: 30px;
        }

        .timeline-item {
          width: 100%;
          padding-left: 70px;
          padding-right: 0;
          text-align: left;
        }

        .timeline-item.left, .timeline-item.right {
          left: 0;
          text-align: left;
          padding-right: 0;
          padding-left: 70px;
        }

        .timeline-item.left .dot, .timeline-item.right .dot {
          left: 20px;
          right: auto;
        }
        
        .timeline-item::after {
          width: 40px;
          left: 30px;
          right: auto;
        }
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .timeline-container {
        background: #111827;
      }

      :host-context(body.dark-mode) .toggle-btn {
        background: #1f2937;
        border-color: #374151;
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .toggle-btn:hover {
        background: #374151;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .timeline-line {
        background: linear-gradient(to bottom, #374151 0%, #4b5563 50%, #374151 100%);
      }

      :host-context(body.dark-mode) .timeline-wrapper.horizontal .timeline-line {
        background: #4b5563;
      }

      :host-context(body.dark-mode) .date-badge {
        background: #374151;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .card {
        background: #1f2937;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      }

      :host-context(body.dark-mode) .title {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .version {
        background: #374151;
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .card-body p {
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .card-header {
        border-bottom-color: #374151;
      }

      :host-context(body.dark-mode) .timeline-item::after,
      :host-context(body.dark-mode) .timeline-wrapper.horizontal .timeline-item::before {
        background: #374151;
      }

      :host-context(body.dark-mode) .dot {
        background: #1f2937;
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
      }

      :host-context(body.dark-mode) .timeline-item:hover .dot {
        background: #6366f1;
        box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.3);
      }

      :host-context(body.dark-mode) .timeline-wrapper.horizontal::-webkit-scrollbar-track {
        background: #1f2937;
      }

      :host-context(body.dark-mode) .timeline-wrapper.horizontal::-webkit-scrollbar-thumb {
        background-color: #4b5563;
        border-color: #1f2937;
      }

      :host-context(body.dark-mode) .empty-state {
        background: #1f2937;
        border-color: #374151;
      }
    `,
  ],
})
export class MilestoneTimelineComponent implements OnInit, OnChanges {
  @Input() jalons: Jalon[] = [];
  @Input() projets: Projet[] = [];
  @Input() readonly = false;

  @Output() edit = new EventEmitter<Jalon>();

  groupedJalons: TimelineGroup[] = [];
  isHorizontal = false;

  toggleMode() {
    this.isHorizontal = !this.isHorizontal;
  }

  ngOnInit(): void {
    this.groupJalons();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['jalons']) {
      this.groupJalons();
    }
  }

  private groupJalons(): void {
    // Sort ascending
    const sorted = [...this.jalons].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    this.groupedJalons = [];

    for (const jalon of sorted) {
      const dateStr = jalon.event_date;
      const lastGroup = this.groupedJalons[this.groupedJalons.length - 1];

      if (lastGroup && lastGroup.date === dateStr) {
        lastGroup.jalons.push(jalon);
      } else {
        this.groupedJalons.push({ date: dateStr, jalons: [jalon] });
      }
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  getProjectName(projetId?: string): string {
    if (!projetId) return "Global";
    const project = this.projets.find((p) => p.id === projetId);
    return project ? project.nom_projet : "Global";
  }

  getProjectColor(projetId?: string): string {
    if (!projetId) return "#6b7280";
    const project = this.projets.find((p) => p.id === projetId);
    return project?.color || "#4f46e5";
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
