import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarPosition } from '../utils/selection-positioning';

@Component({
  selector: 'app-selection-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div 
      class="selection-toolbar"
      [style.top.px]="position?.top"
      [style.left.px]="position?.left"
      [style.transform]="position?.transform"
      [style.opacity]="visible ? 1 : 0">
      
      <!-- Toolbar Tabs -->
      <div class="toolbar-tabs">
        <button 
          class="tab-btn" 
          [class.active]="mode === 'classic'" 
          (click)="setMode('classic')">
          Saisie
        </button>
        <button 
          class="tab-btn" 
          [class.active]="mode === 'projection'" 
          (click)="setMode('projection')">
          Projection
        </button>
      </div>

      <div class="selection-info">
        <ng-container *ngIf="mode === 'classic'">
          <span class="highlight">{{ totalDays | number : "1.1-1" }}j</span>
          <span class="details">sur <span class="count">{{ selectedCount }}</span> semaine(s)</span>
        </ng-container>
        <ng-container *ngIf="mode === 'projection'">
          <span class="highlight">{{ actualProjectedDays | number : "1.1-1" }}j</span>
          <span class="details">
            sur <span class="count">{{ projectedWeeks }}</span> semaine(s)
            <span *ngIf="projectionRangeText" class="projection-dates">({{ projectionRangeText }})</span>
          </span>
        </ng-container>
      </div>

      <!-- Fixed height content area to prevent jumping -->
      <div class="toolbar-main-content">
        <!-- Classic Mode Inputs -->
        <div class="selection-input-row" *ngIf="mode === 'classic'">
          <div class="projection-field">
            <label>Ressources</label>
          <input 
            #bulkInput
            type="number" 
            [ngModel]="value" 
            (ngModelChange)="onValueChange($event)"
            [placeholder]="placeholder"
            [step]="step"
            [min]="min"
            class="bulk-input"
            (keydown.enter)="onApply()" />
          </div>
        </div>

        <!-- Projection Mode Inputs -->
        <div class="projection-input-row" *ngIf="mode === 'projection'">
          <div class="projection-field">
            <label>Ressources</label>
            <input 
              #projResInput
              type="number" 
              [(ngModel)]="projectionResources" 
              placeholder="Nb res."
              step="1"
              min="1"
              class="bulk-input" />
          </div>
          <div class="projection-separator">et</div>
          <div class="projection-field">
            <label>Jours</label>
            <input 
              #projDaysInput
              type="number" 
              [(ngModel)]="projectionDays" 
              placeholder="Total jours"
              step="1"
              min="1"
              class="bulk-input"
              (keydown.enter)="onProject()" />
          </div>
        </div>
      </div>

      <div class="selection-actions">
        <button class="btn btn-secondary btn-sm" (click)="onCancel()" [disabled]="isSaving">
          Annuler
        </button>
        <!-- Classic Button -->
        <button class="btn btn-primary btn-sm" (click)="onApply()" [disabled]="isSaving || value === null" *ngIf="mode === 'classic'">
          <span *ngIf="isSaving" class="spinner-small"></span>
          {{ isSaving ? savingLabel : applyLabel }}
        </button>
        <!-- Projection Button -->
        <button class="btn btn-primary btn-sm btn-project" (click)="onProject()" [disabled]="isSaving || !projectionDays || projectionDays <= 0 || projectionResources <= 0" *ngIf="mode === 'projection'">
          <span *ngIf="isSaving" class="spinner-small"></span>
          {{ isSaving ? 'Calcul...' : 'Projeter' }}
        </button>
      </div>

      <!-- Localized Loading Overlay -->
      <div class="loading-overlay-local" *ngIf="isSaving">
        <div class="spinner-small"></div>
        <span>{{ savingLabel }}...</span>
      </div>
    </div>
  `,
  styles: [`
    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 6px;
      vertical-align: middle;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-overlay-local {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10;
      font-weight: 600;
      color: #6366f1;
    }

    .toolbar-tabs {
      display: flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 8px;
      margin-bottom: 12px;
      gap: 4px;
    }

    .tab-btn {
      flex: 1;
      border: none;
      background: transparent;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      color: #334155;
      background: rgba(255, 255, 255, 0.5);
    }

    .tab-btn.active {
      background: #fff;
      color: #0f172a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      font-weight: 600;
    }

    .projection-input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }

    .projection-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .projection-field label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .projection-field .bulk-input {
      width: 100%;
      text-align: left;
      padding: 8px 10px;
    }

    .projection-separator {
      font-size: 16px;
      color: #94a3b8;
      font-weight: 600;
      padding-bottom: 8px;
    }

    .btn-project {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
    }

    .btn-project:hover:not(:disabled) {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
    }

    .projection-dates {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 400;
      margin-left: 4px;
    }

    .toolbar-main-content {
      min-height: 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .selection-input-row, .projection-input-row {
      margin-bottom: 0 !important;
    }
  `]
})
export class SelectionToolbarComponent implements OnChanges, OnInit, OnDestroy {
  @Input() position: ToolbarPosition | null = null;
  @Input() visible: boolean = false;
  @Input() selectedCount: number = 0;
  @Input() totalDays: number = 0;
  @Input() placeholder: string = "Charge...";
  @Input() step: string = "0.5";
  @Input() min: string = "0";
  @Input() isSaving: boolean = false;
  @Input() applyLabel: string = "Appliquer";
  @Input() savingLabel: string = "Application";

  @Input() value: number | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  @Output() apply = new EventEmitter<number | null>();
  @Output() project = new EventEmitter<{ resources: number, totalDays: number }>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('bulkInput') bulkInput?: ElementRef<HTMLInputElement>;
  @ViewChild('projResInput') projResInput?: ElementRef<HTMLInputElement>;

  @Input() selectionStartDate: Date | null = null;
  @Input() daysPerWeek: number = 5;

  mode: 'classic' | 'projection' = 'classic';
  projectionResources: number = 1;
  projectionDays: number | null = null;

  get projectedWeeks(): number {
    if (!this.projectionDays || !this.projectionResources || this.projectionResources <= 0) return 0;
    return Math.ceil(this.projectionDays / (this.projectionResources * this.daysPerWeek));
  }

  get actualProjectedDays(): number {
    return this.projectedWeeks * (this.projectionResources || 0) * this.daysPerWeek;
  }

  get projectionRangeText(): string {
    if (!this.selectionStartDate || this.projectedWeeks <= 0) return '';
    
    const start = new Date(this.selectionStartDate);
    const end = new Date(this.selectionStartDate);
    end.setDate(end.getDate() + (this.projectedWeeks * 7) - 1);
    
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
    return `du ${fmt.format(start)} au ${fmt.format(end)}`;
  }

  private valueSubject = new Subject<number | null>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.valueSubject.pipe(
      debounceTime(200),
      takeUntil(this.destroy$)
    ).subscribe(val => {
      this.valueChange.emit(val);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.focusActiveInput();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setMode(newMode: 'classic' | 'projection') {
    this.mode = newMode;
    this.focusActiveInput();
  }

  focusActiveInput() {
    setTimeout(() => {
      if (this.mode === 'classic') {
        this.bulkInput?.nativeElement.focus();
      } else {
        this.projResInput?.nativeElement.focus();
      }
    }, 50);
  }

  onValueChange(val: number | null) {
    this.value = val; // Synchronous update
    this.valueSubject.next(val);
  }

  onApply() {
    this.apply.emit(this.value);
  }

  onProject() {
    if (this.projectionDays && this.projectionDays > 0 && this.projectionResources > 0) {
      this.project.emit({
        resources: this.projectionResources,
        totalDays: this.projectionDays
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
