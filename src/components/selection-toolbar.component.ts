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

  mode: 'classic' | 'projection' = 'classic';
  crewdayzAction: 'override' | 'delta' = 'override';
  isConfirmingReset: boolean = false;
  overrideValue: number | null = null;
  deltaValue: number | null = null;
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
      if (changes['value'] || this.overrideValue === null) {
        this.overrideValue = this.value;
      }
      this.localComment = this.comment || '';
      this.focusActiveInput();
    }
    if (changes['comment']) {
      this.localComment = this.comment || '';
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

  setCrewdayzAction(action: 'override' | 'delta') {
    this.isConfirmingReset = false;
    this.crewdayzAction = action;
    this.focusActiveInput();
  }

  promptReset() {
    this.isConfirmingReset = true;
  }

  cancelReset() {
    this.isConfirmingReset = false;
    this.focusActiveInput();
  }

  onConfirmReset() {
    this.isConfirmingReset = false;
    this.clearCustomizations.emit();
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
    this.value = val; // Synchronous update
    this.valueSubject.next(val);
  }

  onCommentChange(comm: string) {
    this.localComment = comm;
    this.commentChange.emit(comm);
  }

  onApply() {
    this.apply.emit(this.value);
  }

  onApplyOverride() {
    if (this.overrideValue !== null) {
      this.applyOverride.emit({
        value: this.overrideValue,
        comment: this.localComment.trim() || undefined,
      });
    }
  }

  onApplyDelta() {
    if (this.deltaValue !== null) {
      this.applyDelta.emit({
        delta: this.deltaValue,
        comment: this.localComment.trim() || undefined,
      });
    }
  }

  onClearCustomizations() {
    this.clearCustomizations.emit();
  }

  onProject() {
    if (this.projectionDays && this.projectionDays > 0 && this.projectionResources > 0) {
      this.project.emit({
        resources: this.projectionResources,
        totalDays: this.projectionDays,
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
