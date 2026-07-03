import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Package, Rocket, Layers, Flag, Wrench } from 'lucide-angular';
import { Jalon } from '../../models/types';
import { DayEventsModalComponent } from './day-events-modal.component';

@NgModule({
  imports: [LucideAngularModule.pick({ Package, Rocket, Layers, Flag, Wrench })],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

@Component({
  selector: 'app-milestone-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule, DayEventsModalComponent],
  template: `
    <div class="calendar-container">
      <div class="calendar-header">
        <div class="header-navigation">
          <button class="nav-btn" (click)="previousMonth()">‹</button>
          <h2>{{ getMonthYear() }}</h2>
          <button class="nav-btn" (click)="nextMonth()">›</button>
        </div>
        <button class="btn-today" (click)="goToToday()">Aujourd'hui</button>
      </div>

      <div class="calendar-grid">
        @for (day of weekDays; track day) {
          <div class="day-header">{{ day }}</div>
        }

        @for (day of calendarDays; track day.date) {
          <div
            class="calendar-day"
            (click)="onDayClick(day)"
            [class.other-month]="!day.isCurrentMonth"
            [class.today]="day.isToday">
            <div class="day-number">{{ day.dayNumber }}</div>

            <div class="day-events">
              @for (jalon of getSlicedEvents(day.events); track jalon.id) {
                <div
                  class="event-item"
                  [class.event-livraison]="jalon.event_type === 'livraison'"
                  [class.event-maintenance]="jalon.event_type === 'maintenance'"
                  [class.event-mep]="jalon.event_type === 'mep'"
                  [class.event-sprint]="jalon.event_type === 'sprint'"
                  [class.event-autre]="jalon.event_type === 'autre' || !jalon.event_type"
                  (click)="$event.stopPropagation(); edit.emit(jalon)">
                  <lucide-icon [name]="getIconName(jalon.event_type)" size="11"></lucide-icon>
                  <span class="event-title">{{ jalon.title }}</span>
                </div>
              }
              @if (day.events.length > 3) {
                <div class="more-events">+ {{ day.events.length - 3 }} de plus...</div>
              }

              @if (!readonly) {
                <button class="add-event-btn" (click)="$event.stopPropagation(); add.emit(day.date)">+</button>
              }
            </div>
          </div>
        }
      </div>

      @if (showDayEventsModal) {
        <app-day-events-modal
          [jalons]="selectedDayEvents"
          [dateStr]="selectedDayDateStr"
          [readonly]="readonly"
          (close)="showDayEventsModal = false"
          (openEvent)="onDayModalEdit($event)"
          (add)="onDayModalAdd($event)"></app-day-events-modal>
      }
    </div>
  `,
  styles: [
    `
      .calendar-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
        padding: 1rem 1.5rem;
      }

      .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }

      .header-navigation {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .calendar-header h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
        text-transform: capitalize;
        min-width: 180px;
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

      .btn-today {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        color: #4b5563;
      }

      .btn-today:hover {
        background: #f9fafb;
        border-color: #4f46e5;
        color: #4f46e5;
      }

      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        background: #e5e7eb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .day-header {
        background: #4f46e5;
        padding: 0.75rem;
        text-align: center;
        font-weight: 600;
        font-size: 0.875rem;
        color: white;
      }

      .calendar-day {
        background: white;
        min-height: 120px;
        padding: 0.5rem;
        position: relative;
        transition: background-color 0.2s;
        display: flex;
        flex-direction: column;
        cursor: pointer;
      }

      .calendar-day:hover {
        background: #f9fafb;
      }

      .calendar-day.other-month {
        background: #f3f4f6;
        opacity: 0.5;
      }

      .calendar-day.today {
        background: #e0e7ff;
        box-shadow: inset 0 0 0 2px #4f46e5;
      }

      .day-number {
        font-weight: 600;
        font-size: 0.875rem;
        color: #111827;
        margin-bottom: 0.5rem;
      }

      .day-events {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex-grow: 1;
      }

      .event-item {
        color: #1e40af;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .event-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .event-item.event-livraison {
        background: #d1fae5;
        color: #065f46;
      }

      .event-item.event-maintenance {
        background: #f3e8ff;
        color: #6b21a8;
      }

      .event-item.event-mep {
        background: #dbeafe;
        color: #1e40af;
      }

      .event-item.event-sprint {
        background: #fef3c7;
        color: #92400e;
      }

      .event-item.event-autre {
        background: #f3f4f6;
        color: #4b5563;
      }

      .event-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .more-events {
        font-size: 0.7rem;
        font-weight: 600;
        color: #4f46e5;
        padding-left: 0.25rem;
      }

      .add-event-btn {
        background: transparent;
        border: 1px dashed #dee2e6;
        border-radius: 4px;
        padding: 0.1rem;
        font-size: 0.875rem;
        color: #9ca3af;
        cursor: pointer;
        margin-top: auto;
        opacity: 0;
        transition:
          opacity 0.2s,
          border-color 0.2s,
          background-color 0.2s;
      }

      .calendar-day:hover .add-event-btn {
        opacity: 1;
      }

      .add-event-btn:hover {
        border-color: #4f46e5;
        color: #4f46e5;
        background: #eef2ff;
      }

      /* Dark Mode Overrides */
      :host-context(body.dark-mode) .calendar-container {
        background: #111827;
      }

      :host-context(body.dark-mode) .calendar-header h2 {
        color: #f9fafb;
      }

      :host-context(body.dark-mode) .nav-btn,
      :host-context(body.dark-mode) .btn-today {
        background: #1f2937;
        border-color: #374151;
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .nav-btn:hover,
      :host-context(body.dark-mode) .btn-today:hover {
        background: #374151;
        border-color: #6366f1;
        color: #818cf8;
      }

      :host-context(body.dark-mode) .calendar-grid {
        background: #374151;
        border-color: #374151;
      }

      :host-context(body.dark-mode) .day-header {
        background: #312e81;
        color: #e0e7ff;
      }

      :host-context(body.dark-mode) .calendar-day {
        background: #1f2937;
      }

      :host-context(body.dark-mode) .calendar-day:hover {
        background: #273549;
      }

      :host-context(body.dark-mode) .calendar-day.other-month {
        background: #111827;
        opacity: 0.6;
      }

      :host-context(body.dark-mode) .calendar-day.today {
        background: #1e1b4b;
        box-shadow: inset 0 0 0 2px #6366f1;
      }

      :host-context(body.dark-mode) .day-number {
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .event-item.event-livraison {
        background: #064e3b;
        color: #a7f3d0;
      }

      :host-context(body.dark-mode) .event-item.event-maintenance {
        background: #581c87;
        color: #e9d5ff;
      }

      :host-context(body.dark-mode) .event-item.event-mep {
        background: #1e3a8a;
        color: #bfdbfe;
      }

      :host-context(body.dark-mode) .event-item.event-sprint {
        background: #78350f;
        color: #fde68a;
      }

      :host-context(body.dark-mode) .event-item.event-autre {
        background: #374151;
        color: #d1d5db;
      }

      :host-context(body.dark-mode) .more-events {
        color: #818cf8;
      }

      :host-context(body.dark-mode) .add-event-btn {
        border-color: #4b5563;
        color: #4b5563;
      }

      :host-context(body.dark-mode) .add-event-btn:hover {
        border-color: #6366f1;
        color: #818cf8;
        background: #1e1b4b;
      }
    `,
  ],
})
export class MilestoneCalendarComponent implements OnInit, OnChanges {
  @Input() jalons: Jalon[] = [];
  @Input() readonly = false;

  @Output() edit = new EventEmitter<Jalon>();
  @Output() add = new EventEmitter<string | null>();

  currentDate = new Date();
  calendarDays: any[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Day list modal state
  showDayEventsModal = false;
  selectedDayEvents: Jalon[] = [];
  selectedDayDateStr: string | null = null;

  ngOnInit(): void {
    this.generateCalendar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['jalons']) {
      this.generateCalendar();
    }
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get the first day's weekday index (0 for Monday, 6 for Sunday)
    let dayOfWeek = firstDay.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    this.calendarDays = [];

    // Add previous month days
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      this.calendarDays.push({
        dayNumber: prevMonthLastDay - i,
        date: this.formatDateToString(date),
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }

    // Add current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = this.formatDateToString(date);
      const dayEvents = this.getJalonsByDate(dateStr);

      this.calendarDays.push({
        dayNumber: day,
        date: dateStr,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        events: dayEvents,
      });
    }

    // Add next month days to fill grid (42 days)
    const remainingDays = 42 - this.calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      this.calendarDays.push({
        dayNumber: day,
        date: this.formatDateToString(date),
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }
  }

  getJalonsByDate(dateStr: string): Jalon[] {
    return this.jalons.filter((j) => j.event_date === dateStr);
  }

  formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  getMonthYear(): string {
    return this.currentDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  previousMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1);
    this.generateCalendar();
  }

  onDayClick(day: any): void {
    if (day && day.events && day.events.length > 0) {
      this.selectedDayEvents = day.events;
      this.selectedDayDateStr = day.date;
      this.showDayEventsModal = true;
    } else if (day && day.date && !this.readonly) {
      this.add.emit(day.date);
    }
  }

  onDayModalEdit(jalon: Jalon) {
    this.showDayEventsModal = false;
    this.edit.emit(jalon);
  }

  onDayModalAdd(date: string | null) {
    this.showDayEventsModal = false;
    setTimeout(() => this.add.emit(date), 0);
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

  getSlicedEvents(events: Jalon[]): Jalon[] {
    return events ? events.slice(0, 3) : [];
  }
}
