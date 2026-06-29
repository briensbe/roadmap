import { Component, EventEmitter, Input, Output, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LucideAngularModule, PenLine, Plus, Package, Rocket, Layers, Flag, Wrench } from "lucide-angular";
import { Jalon } from "../../models/types";

@NgModule({
  imports: [LucideAngularModule.pick({ PenLine, Plus, Package, Rocket, Layers, Flag, Wrench })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: "app-day-events-modal",
  standalone: true,
  imports: [CommonModule, LucideIconsModule],
  template: `
    <div class="modal" (click)="onClose()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ formattedDate }}</h3>
          <button class="close-btn" (click)="onClose()">×</button>
        </div>

        <div class="modal-body">
          @if (jalons && jalons.length) {
            @for (jalon of jalons; track jalon.id) {
              <div class="day-event-row" (click)="emitOpenEvent(jalon)">
                <div class="left">
                  <div
                    class="type-badge"
                    [class.badge-livraison]="jalon.event_type === 'livraison'"
                    [class.badge-maintenance]="jalon.event_type === 'maintenance'"
                    [class.badge-mep]="jalon.event_type === 'mep'"
                    [class.badge-sprint]="jalon.event_type === 'sprint'"
                    [class.badge-autre]="jalon.event_type === 'autre' || !jalon.event_type"
                  >
                    <lucide-icon [name]="getIconName(jalon.event_type)" size="18"></lucide-icon>
                  </div>
                  <div class="info">
                    <div class="title">{{ jalon.title }}</div>
                    @if (jalon.description) {
                      <div class="desc">{{ jalon.description }}</div>
                    }
                    @if (jalon.version) {
                      <div class="meta">Version: {{ jalon.version }}</div>
                    }
                  </div>
                </div>
                @if (!readonly) {
                  <div class="actions">
                    <button class="icon-btn" (click)="$event.stopPropagation(); emitOpenEvent(jalon)" title="Modifier">
                      <lucide-icon name="pen-line" size="16"></lucide-icon>
                    </button>
                  </div>
                }
              </div>
            }
          } @else {
            <div class="empty-state">Aucun jalon pour ce jour.</div>
          }
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="onClose()">Fermer</button>
          @if (!readonly) {
            <button class="btn-primary" (click)="onAdd()">
              <lucide-icon name="plus" size="14"></lucide-icon> Ajouter
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 520px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem;
        border-bottom: 1px solid #e9ecef;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 1.125rem;
        color: #1a1a1a;
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
      }
      .modal-body {
        padding: 1rem;
        max-height: 60vh;
        overflow: auto;
      }
      .day-event-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 0.75rem;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        align-items: flex-start;
        transition: background-color 0.2s;
        border-radius: 6px;
      }
      .day-event-row:hover {
        background: #f8fafc;
      }
      .left {
        display: flex;
        gap: 12px;
      }
      .type-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
      }
      .badge-livraison {
        background: #d1fae5;
        color: #065f46;
      }

      .badge-maintenance {
        background: #f3e8ff;
        color: #6b21a8;
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
      .info .title {
        font-weight: 600;
        color: #1a1a1a;
      }
      .info .meta {
        font-size: 0.85rem;
        color: #6b7280;
        margin-top: 2px;
      }
      .info .desc {
        margin-top: 4px;
        color: #495057;
        font-size: 0.9rem;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .icon-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        color: #64748b;
      }
      .icon-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }
      .empty-state {
        padding: 2rem;
        color: #6b7280;
        text-align: center;
      }
      .modal-footer {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        border-top: 1px solid #e9ecef;
      }
      .btn-primary {
        background: #4f46e5;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .btn-primary:hover {
        background: #4338ca;
      }
      .btn-secondary {
        background: #e5e7eb;
        color: #374151;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
      }
      .btn-secondary:hover {
        background: #d1d5db;
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .modal-content {
        background: #1e293b;
        color: #f8fafc;
      }
      :host-context(body.dark-mode) .modal-header {
        border-bottom-color: #334155;
      }
      :host-context(body.dark-mode) .modal-header h3 {
        color: #f8fafc;
      }
      :host-context(body.dark-mode) .close-btn {
        color: #cbd5e1;
      }
      :host-context(body.dark-mode) .close-btn:hover {
        color: #f8fafc;
      }
      :host-context(body.dark-mode) .day-event-row {
        border-bottom-color: #334155;
      }
      :host-context(body.dark-mode) .day-event-row:hover {
        background: #334155;
      }
      :host-context(body.dark-mode) .info .title {
        color: #f8fafc;
      }
      :host-context(body.dark-mode) .info .meta {
        color: #94a3b8;
      }
      :host-context(body.dark-mode) .info .desc {
        color: #cbd5e1;
      }
      :host-context(body.dark-mode) .modal-footer {
        border-top-color: #334155;
      }
      :host-context(body.dark-mode) .btn-secondary {
        background: #334155;
        color: #cbd5e1;
      }
      :host-context(body.dark-mode) .btn-secondary:hover {
        background: #475569;
      }
      :host-context(body.dark-mode) .icon-btn {
        color: #cbd5e1;
      }
      :host-context(body.dark-mode) .icon-btn:hover {
        background: #334155;
      }
    `,
  ],
})
export class DayEventsModalComponent {
  @Input() jalons: Jalon[] = [];
  @Input() dateStr: string | null = null;
  @Input() readonly = false;

  @Output() close = new EventEmitter<void>();
  @Output() openEvent = new EventEmitter<Jalon>();
  @Output() add = new EventEmitter<string | null>();

  get formattedDate(): string {
    if (!this.dateStr) return '';
    const date = new Date(this.dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  onClose() {
    this.close.emit();
  }

  emitOpenEvent(jalon: Jalon) {
    this.openEvent.emit(jalon);
  }

  onAdd() {
    setTimeout(() => this.add.emit(this.dateStr), 0);
  }

  getIconName(type: string): string {
    switch (type) {
      case 'livraison':
        return 'package';
      case 'maintenance':
        return 'wrench';
      case 'mep':
        return 'rocket';
      case 'sprint':
        return 'layers';
      default:
        return 'flag';
    }
  }
}
