import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LucideAngularModule, Package, Rocket, Layers, Flag } from "lucide-angular";
import { Jalon } from "../../models/types";
import { DayEventsModalComponent } from "./day-events-modal.component";

@NgModule({
  imports: [LucideAngularModule.pick({ Package, Rocket, Layers, Flag })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

@Component({
  selector: "app-milestone-compact",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule, DayEventsModalComponent],
  template: `
    <div class="compact-container">
      <div class="compact-header">
        <div class="header-controls">
          <button class="nav-btn" (click)="previousPeriod()">‹</button>
          <h2>{{ getPeriodTitle() }}</h2>
          <button class="nav-btn" (click)="nextPeriod()">›</button>
        </div>
        
        <div class="view-options">
          <div class="option-group">
            <label>Début:</label>
            <input type="month" [ngModel]="startDateStr" (ngModelChange)="onStartDateChange($event)">
          </div>
          <div class="option-group">
            <label>Mois:</label>
            <div class="count-controls">
              <button class="count-btn" (click)="changeMonthsCount(-1)" [disabled]="monthsCount <= 1">-</button>
              <span class="count-display">{{ monthsCount }}</span>
              <button class="count-btn" (click)="changeMonthsCount(1)" [disabled]="monthsCount >= 12">+</button>
            </div>
          </div>
        </div>
      </div>

      <div class="months-grid">
        <div *ngFor="let monthData of monthsData" class="month-column">
          <div class="month-title-wrapper">
            <h3 class="month-title">{{ monthData.title }}</h3>
          </div>
          
          <div class="compact-table">
            <div class="table-header">
              <div class="col-date">D</div>
              <div class="col-day">J</div>
              <div class="col-events">Jalons</div>
            </div>

            <div
              *ngFor="let day of monthData.days"
              class="table-row"
              (click)="onRowClick(day)"
              [class.has-events]="day.events.length > 0"
              [class.today]="day.isToday"
              [class.weekend]="day.isWeekend"
              [class.holiday]="day.isHoliday"
            >
              <div class="col-date">{{ day.dayNumber }}</div>
              <div class="col-day">{{ day.dayName }}</div>
              <div class="col-events">
                <div class="events-list">
                  <div
                    *ngFor="let jalon of day.events"
                    class="compact-event"
                    [class.event-livraison]="jalon.event_type === 'livraison'"
                    [class.event-mep]="jalon.event_type === 'mep'"
                    [class.event-sprint]="jalon.event_type === 'sprint'"
                    [class.event-autre]="jalon.event_type === 'autre' || !jalon.event_type"
                    (click)="$event.stopPropagation(); edit.emit(jalon)"
                  >
                    <lucide-icon [name]="getIconName(jalon.event_type)" size="11"></lucide-icon>
                    <span class="compact-title">{{ jalon.title }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <app-day-events-modal
        *ngIf="showDayEventsModal"
        [jalons]="selectedDayEvents"
        [dateStr]="selectedDayDateStr"
        [readonly]="readonly"
        (close)="showDayEventsModal = false"
        (openEvent)="onDayModalEdit($event)"
        (add)="onDayModalAdd($event)"
      ></app-day-events-modal>

      <div class="modal" *ngIf="showEmptyDayModal" (click)="closeEmptyDayModal()">
        <div class="modal-content empty-day-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ emptyDayDate }}</h3>
            <button class="close-btn" (click)="closeEmptyDayModal()">×</button>
          </div>

          <div class="modal-body">
            <p class="empty-message">Aucun jalon prévu ce jour</p>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeEmptyDayModal()">Fermer</button>
            <button class="btn-primary" (click)="createEventFromEmptyDay()" *ngIf="!readonly">+ Ajouter</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .compact-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
        padding-top: 1rem;
      }

      .compact-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .compact-header h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
        text-transform: capitalize;
        min-width: 280px;
        text-align: center;
      }

      .nav-btn {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        width: 36px;
        height: 36px;
        font-size: 1.25rem;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #4b5563;
      }

      .nav-btn:hover {
        background: #f9fafb;
        border-color: #4f46e5;
        color: #4f46e5;
      }

      .view-options {
        display: flex;
        gap: 1.5rem;
        align-items: center;
        background: #f9fafb;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }

      .option-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .option-group label {
        margin: 0;
        font-size: 0.875rem;
        color: #4b5563;
        font-weight: 500;
      }

      .option-group input[type="month"] {
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 0.875rem;
        color: #111827;
      }

      .count-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #e5e7eb;
        padding: 0.125rem;
        border-radius: 4px;
        border: 1px solid #d1d5db;
      }

      .count-btn {
        width: 24px;
        height: 24px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border: 1px solid #cbd5e1;
        border-radius: 3px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 600;
        color: #475569;
      }

      .count-btn:hover:not(:disabled) {
        background: #f8fafc;
        color: #4f46e5;
        border-color: #4f46e5;
      }

      .count-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .count-display {
        min-width: 20px;
        text-align: center;
        font-weight: 600;
        font-size: 0.875rem;
        color: #111827;
      }

      .months-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        align-items: start;
        overflow-y: auto;
      }

      .month-column {
        background: white;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .month-title-wrapper {
        background: #4f46e5;
        padding: 0.75rem;
        text-align: center;
      }

      .month-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: white;
        text-transform: capitalize;
      }

      .compact-table {
        font-size: 0.8rem;
      }

      .table-header {
        display: grid;
        grid-template-columns: 32px 32px 1fr;
        background: #f9fafb;
        font-weight: 600;
        color: #4b5563;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .table-header > div {
        padding: 0.5rem 0.25rem;
        border-right: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .table-header > div:last-child {
        border-right: none;
        justify-content: flex-start;
        padding-left: 0.5rem;
      }

      .table-row {
        display: grid;
        grid-template-columns: 32px 32px 1fr;
        border-bottom: 1px solid #f1f5f9;
        transition: background-color 0.2s;
        min-height: 32px;
        cursor: pointer;
      }

      .table-row:hover {
        background: #f8fafc;
      }

      .table-row.today {
        background: #eef2ff;
      }

      .table-row.weekend,
      .table-row.holiday {
        background: #f3f4f6;
      }

      .table-row.weekend:hover,
      .table-row.holiday:hover {
        background: #e5e7eb;
      }

      .col-date,
      .col-day {
        padding: 0.25rem;
        border-right: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        font-size: 0.8rem;
      }

      .col-events {
        padding: 0.25rem 0.5rem;
        display: flex;
        align-items: center;
      }

      .events-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        width: 100%;
      }

      .compact-event {
        color: #1e40af;
        padding: 0.125rem 0.375rem;
        border-radius: 3px;
        font-size: 0.7rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .compact-event:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .compact-event.event-livraison {
        background: #d1fae5;
        color: #065f46;
      }

      .compact-event.event-mep {
        background: #dbeafe;
        color: #1e40af;
      }

      .compact-event.event-sprint {
        background: #fef3c7;
        color: #92400e;
      }

      .compact-event.event-autre {
        background: #f3f4f6;
        color: #4b5563;
      }

      .compact-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
      }

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
        max-width: 400px;
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
        color: #6b7280;
        cursor: pointer;
      }

      .modal-body {
        padding: 1.5rem;
      }

      .modal-footer {
        display: flex;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        border-top: 1px solid #e9ecef;
        gap: 0.5rem;
      }

      .btn-primary {
        background: #4f46e5;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
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

      .empty-day-modal .modal-body {
        padding: 2rem 1.5rem;
      }

      .empty-message {
        color: #64748b;
        font-size: 0.95rem;
        margin: 0;
        text-align: center;
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .compact-container {
        background: #111827;
      }

      :host-context(body.dark-mode) .compact-header h2 {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .nav-btn {
        background: #1f2937;
        border-color: #374151;
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .nav-btn:hover {
        background: #374151;
        border-color: #6366f1;
        color: #818cf8;
      }

      :host-context(body.dark-mode) .view-options {
        background: #1f2937;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .option-group label {
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .option-group input[type="month"] {
        background: #111827;
        border-color: #374151;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .option-group input[type="month"]::-webkit-calendar-picker-indicator {
        filter: invert(1);
      }

      :host-context(body.dark-mode) .count-controls {
        background: #111827;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .count-btn {
        background: #1f2937;
        border-color: #374151;
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .count-btn:hover:not(:disabled) {
        background: #374151;
        color: #818cf8;
        border-color: #6366f1;
      }

      :host-context(body.dark-mode) .count-display {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .month-column {
        background: #1f2937;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .month-title-wrapper {
        background: #312e81;
      }

      :host-context(body.dark-mode) .table-header {
        background: #111827;
        color: #cbd5e1;
        border-bottom-color: #374151;
      }

      :host-context(body.dark-mode) .table-header > div {
        border-right-color: #374151;
      }

      :host-context(body.dark-mode) .table-row {
        border-bottom-color: #111827;
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .table-row:hover {
        background: #273549;
      }

      :host-context(body.dark-mode) .table-row.today {
        background: #1e1b4b;
      }

      :host-context(body.dark-mode) .table-row.weekend,
      :host-context(body.dark-mode) .table-row.holiday {
        background: #111827;
      }

      :host-context(body.dark-mode) .table-row.weekend:hover,
      :host-context(body.dark-mode) .table-row.holiday:hover {
        background: #1f2937;
      }

      :host-context(body.dark-mode) .col-date,
      :host-context(body.dark-mode) .col-day {
        border-right-color: #374151;
      }

      :host-context(body.dark-mode) .compact-event.event-livraison {
        background: #064e3b;
        color: #a7f3d0;
      }

      :host-context(body.dark-mode) .compact-event.event-mep {
        background: #1e3a8a;
        color: #bfdbfe;
      }

      :host-context(body.dark-mode) .compact-event.event-sprint {
        background: #78350f;
        color: #fde68a;
      }

      :host-context(body.dark-mode) .compact-event.event-autre {
        background: #374151;
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .modal-content {
        background: #1f2937;
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .modal-header {
        border-bottom-color: #374151;
      }

      :host-context(body.dark-mode) .modal-header h3 {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .close-btn {
        color: #9ca3af;
      }

      :host-context(body.dark-mode) .modal-footer {
        border-top-color: #374151;
      }

      :host-context(body.dark-mode) .btn-secondary {
        background: #374151;
        color: #cbd5e1;
      }

      :host-context(body.dark-mode) .btn-secondary:hover {
        background: #4b5563;
      }
    `,
  ],
})
export class MilestoneCompactComponent implements OnInit, OnChanges {
  @Input() jalons: Jalon[] = [];
  @Input() readonly = false;

  @Output() edit = new EventEmitter<Jalon>();
  @Output() add = new EventEmitter<string>();

  startDate = new Date();
  monthsData: any[] = [];
  monthsCount = 4; // Default to 4 months
  dayNames = ["D", "L", "M", "M", "J", "V", "S"];

  // Day list modal state
  showDayEventsModal = false;
  selectedDayEvents: Jalon[] = [];
  selectedDayDateStr: string | null = null;

  // Empty day modal state
  showEmptyDayModal = false;
  emptyDayDate = '';
  emptyDayDateStr = '';

  constructor() {
    this.startDate.setDate(1); // Set to 1st of current month
  }

  ngOnInit(): void {
    this.generateCompactView();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['jalons']) {
      this.generateCompactView();
    }
  }

  changeMonthsCount(delta: number): void {
    const newCount = this.monthsCount + delta;
    if (newCount >= 1 && newCount <= 12) {
      this.monthsCount = newCount;
      this.generateCompactView();
    }
  }

  onStartDateChange(dateStr: string): void {
    if (dateStr) {
      const [year, month] = dateStr.split('-').map(Number);
      this.startDate = new Date(year, month - 1, 1);
      this.generateCompactView();
    }
  }

  get startDateStr(): string {
    const year = this.startDate.getFullYear();
    const month = String(this.startDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  generateCompactView(): void {
    this.monthsData = [];

    for (let i = 0; i < this.monthsCount; i++) {
      const monthDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + i, 1);
      const monthTitle = monthDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });

      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const days = [];

      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const dateStr = this.formatDateToString(date);
        const dayEvents = this.getJalonsByDate(dateStr);

        days.push({
          dayNumber: String(day).padStart(2, "0"),
          dayName: this.getDayName(date),
          dateStr: dateStr,
          isToday: this.isToday(date),
          isWeekend: this.isWeekend(date),
          isHoliday: this.isFrenchHoliday(date),
          events: dayEvents,
        });
      }

      this.monthsData.push({
        title: monthTitle,
        days: days,
      });
    }
  }

  getJalonsByDate(dateStr: string): Jalon[] {
    return this.jalons.filter((j) => j.event_date === dateStr);
  }

  formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  getDayName(date: Date): string {
    const dayIndex = date.getDay();
    return this.dayNames[dayIndex];
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  isFrenchHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Fixed holidays
    const fixedHolidays = [
      { m: 1, d: 1 },   // New Year
      { m: 5, d: 1 },   // Labour Day
      { m: 5, d: 8 },   // Victory Day
      { m: 7, d: 14 },  // Bastille Day
      { m: 8, d: 15 },  // Assumption
      { m: 11, d: 1 },  // All Saints
      { m: 11, d: 11 }, // Armistice
      { m: 12, d: 25 }, // Christmas
    ];

    if (fixedHolidays.some((h) => h.m === month && h.d === day)) {
      return true;
    }

    // Easter-based holidays (Meeus/Jones/Butcher algorithm)
    const easter = this.getEasterDate(year);
    const easterTime = easter.getTime();
    const dateTime = date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Easter Monday (+1 day)
    if (dateTime === easterTime + dayMs) return true;

    // Ascension (+39 days)
    if (dateTime === easterTime + 39 * dayMs) return true;

    // Whit Monday (+50 days)
    if (dateTime === easterTime + 50 * dayMs) return true;

    return false;
  }

  getEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  getPeriodTitle(): string {
    const endDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + this.monthsCount, 0);
    return `${this.startDate.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })} - ${endDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
  }

  previousPeriod(): void {
    this.startDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() - this.monthsCount, 1);
    this.generateCompactView();
  }

  nextPeriod(): void {
    this.startDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + this.monthsCount, 1);
    this.generateCompactView();
  }

  onRowClick(day: any): void {
    if (day && day.events && day.events.length > 0) {
      this.selectedDayEvents = day.events;
      this.selectedDayDateStr = day.dateStr;
      this.showDayEventsModal = true;
    } else if (day && day.dateStr) {
      this.emptyDayDateStr = day.dateStr;
      this.emptyDayDate = this.formatDateForDisplay(day.dateStr);
      this.showEmptyDayModal = true;
    }
  }

  formatDateForDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  closeEmptyDayModal(): void {
    this.showEmptyDayModal = false;
    this.emptyDayDate = '';
    this.emptyDayDateStr = '';
  }

  createEventFromEmptyDay(): void {
    this.showEmptyDayModal = false;
    this.add.emit(this.emptyDayDateStr);
  }

  onDayModalEdit(jalon: Jalon) {
    this.showDayEventsModal = false;
    this.edit.emit(jalon);
  }

  onDayModalAdd(date: string | null) {
    this.showDayEventsModal = false;
    if (date) {
      setTimeout(() => this.add.emit(date), 0);
    }
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
