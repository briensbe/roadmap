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
      
      <div class="selection-info">
        <span class="highlight">{{ totalDays | number : "1.1-1" }}j</span>
        <span class="details">sur <span class="count">{{ selectedCount }}</span> semaine(s)</span>
      </div>

      <div class="selection-input-row">
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

      <div class="selection-actions">
        <button class="btn btn-secondary btn-sm" (click)="onCancel()" [disabled]="isSaving">
          Annuler
        </button>
        <button class="btn btn-primary btn-sm" (click)="onApply()" [disabled]="isSaving || value === null">
          <span *ngIf="isSaving" class="spinner-small"></span>
          {{ isSaving ? savingLabel : applyLabel }}
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

    @Output() apply = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    @ViewChild('bulkInput') bulkInput?: ElementRef<HTMLInputElement>;

    private valueSubject = new Subject<number | null>();
    private destroy$ = new Subject<void>();

    ngOnInit() {
        this.valueSubject.pipe(
            debounceTime(200),
            takeUntil(this.destroy$)
        ).subscribe(val => {
            this.value = val;
            this.valueChange.emit(val);
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['visible']?.currentValue === true) {
            setTimeout(() => {
                this.bulkInput?.nativeElement.focus();
            }, 50);
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onValueChange(val: number | null) {
        this.valueSubject.next(val);
    }

    onApply() {
        this.valueChange.emit(this.value);
        this.apply.emit();
    }

    onCancel() {
        this.cancel.emit();
    }
}
