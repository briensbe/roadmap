import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnChanges,
  SimpleChanges,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarPosition } from '../utils/selection-positioning';

@Component({
  selector: 'app-selection-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-toolbar.component.html',
  styleUrl: './selection-toolbar.component.css',
})
export class SelectionToolbarComponent implements OnChanges, OnInit, OnDestroy {
  @Input() position: ToolbarPosition | null = null;
  @Input() visible: boolean = false;
  @Input() selectedCount: number = 0;
  @Input() totalDays: number = 0;
  @Input() placeholder: string = 'Charge...';
  @Input() step: string = '0.5';
  @Input() min: string = '0';
  @Input() isSaving: boolean = false;
  @Input() applyLabel: string = 'Appliquer';
  @Input() savingLabel: string = 'Application';

  @Input() value: number | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  @Input() isCrewdayzMode: boolean = false;
  @Input() showCommentField: boolean = false;
  @Input() comment: string = '';
  @Output() commentChange = new EventEmitter<string>();

  @Output() apply = new EventEmitter<number | null>();
  @Output() applyWithComment = new EventEmitter<{ value: number | null; comment?: string }>();
  @Output() applyOverride = new EventEmitter<{ value: number; comment?: string }>();
  @Output() applyDelta = new EventEmitter<{ delta: number; comment?: string }>();
  @Output() clearCustomizations = new EventEmitter<void>();
  @Output() project = new EventEmitter<{ resources: number; totalDays: number }>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('bulkInput') bulkInput?: ElementRef<HTMLInputElement>;
  @ViewChild('overrideInput') overrideInput?: ElementRef<HTMLInputElement>;
  @ViewChild('deltaInput') deltaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('projResInput') projResInput?: ElementRef<HTMLInputElement>;

  @Input() selectionStartDate: Date | null = null;
  @Input() daysPerWeek: number = 5;
  @Input() showProjectionTab: boolean = true;
  @Input() crewdayzBaseValue: number | null = null;
  @Input() initialAction: 'override' | 'delta' = 'override';
  @Input() overrideValue: number | null = null;
  @Input() deltaValue: number | null = null;

  mode: 'classic' | 'projection' = 'classic';
  crewdayzAction: 'override' | 'delta' = 'override';
  isConfirmingReset: boolean = false;
  localComment: string = '';
  projectionResources: number = 1;
  projectionDays: number | null = null;

  get projectedWeeks(): number {
    if (!this.projectionDays || !this.projectionResources || this.projectionResources <= 0) return 0;
    return Math.ceil(this.projectionDays / (this.projectionResources * this.daysPerWeek));
  }

  get actualProjectedDays(): number {
    return this.projectedWeeks * (this.projectionResources || 0) * this.daysPerWeek;
  }

  get effectiveCrewdayzDays(): number {
    if (this.crewdayzAction === 'override') {
      if (this.overrideValue !== null && this.overrideValue !== undefined) {
        return Math.round(this.selectedCount * this.overrideValue * this.daysPerWeek * 10) / 10;
      }
    } else if (this.crewdayzAction === 'delta') {
      if (this.deltaValue !== null && this.deltaValue !== undefined) {
        if (this.selectedCount === 1) {
          const base = this.crewdayzBaseValue ?? 0;
          const eff = Math.max(0, base + this.deltaValue);
          return Math.round(eff * this.daysPerWeek * 10) / 10;
        } else {
          const eff = Math.max(0, this.totalDays + this.deltaValue * this.daysPerWeek * this.selectedCount);
          return Math.round(eff * 10) / 10;
        }
      }
    }
    return Math.round(this.totalDays * 10) / 10;
  }

  get projectionRangeText(): string {
    if (!this.selectionStartDate || this.projectedWeeks <= 0) return '';

    const start = new Date(this.selectionStartDate);
    const end = new Date(this.selectionStartDate);
    end.setDate(end.getDate() + this.projectedWeeks * 7 - 1);

    const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
    return `du ${fmt.format(start)} au ${fmt.format(end)}`;
  }

  private valueSubject = new Subject<number | null>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.valueSubject.pipe(debounceTime(200), takeUntil(this.destroy$)).subscribe((val) => {
      this.valueChange.emit(val);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.isConfirmingReset = false;
      if (this.isCrewdayzMode) {
        this.crewdayzAction = this.initialAction ?? (this.deltaValue !== null && this.deltaValue !== undefined ? 'delta' : 'override');
      }
      this.localComment = this.comment || '';
      this.focusActiveInput();
    }
    if (changes['comment']) {
      this.localComment = this.comment || '';
    }
    if (changes['initialAction'] && changes['initialAction'].currentValue) {
      this.crewdayzAction = changes['initialAction'].currentValue;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  errorMessage: string | null = null;

  setMode(newMode: 'classic' | 'projection') {
    this.errorMessage = null;
    this.mode = newMode;
    this.focusActiveInput();
  }

  setCrewdayzAction(action: 'override' | 'delta') {
    this.errorMessage = null;
    this.isConfirmingReset = false;
    this.crewdayzAction = action;
    this.focusActiveInput();
  }

  promptReset() {
    this.errorMessage = null;
    this.isConfirmingReset = true;
  }

  cancelReset() {
    this.errorMessage = null;
    this.isConfirmingReset = false;
    this.focusActiveInput();
  }

  onConfirmReset() {
    this.errorMessage = null;
    this.isConfirmingReset = false;
    this.clearCustomizations.emit();
  }

  clearError() {
    this.errorMessage = null;
  }

  focusActiveInput() {
    setTimeout(() => {
      if (this.isCrewdayzMode) {
        if (this.crewdayzAction === 'override') {
          const el = this.overrideInput?.nativeElement;
          if (el) {
            el.focus();
            el.select();
          }
        } else if (this.crewdayzAction === 'delta') {
          const el = this.deltaInput?.nativeElement;
          if (el) {
            el.focus();
            el.select();
          }
        }
      } else {
        if (this.mode === 'classic') {
          const el = this.bulkInput?.nativeElement;
          if (el) {
            el.focus();
            el.select();
          }
        } else {
          const el = this.projResInput?.nativeElement;
          if (el) {
            el.focus();
            el.select();
          }
        }
      }
    }, 50);
  }

  onValueChange(val: number | null) {
    this.errorMessage = null;
    this.value = val; // Synchronous update
    this.valueSubject.next(val);
  }

  onCommentChange(comm: string) {
    this.localComment = comm;
    this.commentChange.emit(comm);
  }

  onApply() {
    if (this.value === null || this.value === undefined || isNaN(this.value)) {
      this.errorMessage = 'Veuillez saisir une valeur de capacité.';
      this.focusActiveInput();
      return;
    }
    if (this.value < 0) {
      this.errorMessage = 'La capacité ne peut pas être négative.';
      this.focusActiveInput();
      return;
    }
    this.errorMessage = null;
    this.apply.emit(this.value);
  }

  onApplyOverride() {
    if (this.overrideValue === null || this.overrideValue === undefined || isNaN(this.overrideValue)) {
      this.errorMessage = 'Veuillez saisir une valeur.';
      this.focusActiveInput();
      return;
    }
    if (this.overrideValue < 0) {
      this.errorMessage = 'La valeur forcée ne peut pas être négative.';
      this.focusActiveInput();
      return;
    }
    this.errorMessage = null;
    this.applyOverride.emit({
      value: this.overrideValue,
      comment: this.localComment.trim() || undefined,
    });
  }

  onApplyDelta() {
    if (this.deltaValue === null || this.deltaValue === undefined || isNaN(this.deltaValue)) {
      this.errorMessage = 'Veuillez saisir un delta (ex : +0.5 ou -0.2).';
      this.focusActiveInput();
      return;
    }
    if (this.deltaValue < 0 && this.crewdayzBaseValue !== null) {
      if (Math.round((this.crewdayzBaseValue + this.deltaValue) * 100) / 100 < 0) {
        this.errorMessage =
          this.selectedCount === 1
            ? `Le delta négatif (${this.deltaValue}) ne peut pas dépasser la base disponible (${this.crewdayzBaseValue} ETP).`
            : `Le delta négatif (${this.deltaValue}) ne peut pas dépasser la base minimale sélectionnée (${this.crewdayzBaseValue} ETP).`;
        this.focusActiveInput();
        return;
      }
    }
    this.errorMessage = null;
    this.applyDelta.emit({
      delta: this.deltaValue,
      comment: this.localComment.trim() || undefined,
    });
  }

  onClearCustomizations() {
    this.errorMessage = null;
    this.clearCustomizations.emit();
  }

  onProject() {
    if (!this.projectionResources || this.projectionResources <= 0) {
      this.errorMessage = 'Veuillez saisir un nombre de ressources supérieur à 0.';
      return;
    }
    if (!this.projectionDays || this.projectionDays <= 0) {
      this.errorMessage = 'Veuillez renseigner un nombre total de jours supérieur à 0.';
      return;
    }
    this.errorMessage = null;
    this.project.emit({
      resources: this.projectionResources,
      totalDays: this.projectionDays,
    });
  }

  onCancel() {
    this.errorMessage = null;
    this.cancel.emit();
  }
}
