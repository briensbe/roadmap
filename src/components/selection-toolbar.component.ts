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

  @Output() apply = new EventEmitter<number | null>();
  @Output() project = new EventEmitter<{ resources: number; totalDays: number }>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('bulkInput') bulkInput?: ElementRef<HTMLInputElement>;
  @ViewChild('projResInput') projResInput?: ElementRef<HTMLInputElement>;

  @Input() selectionStartDate: Date | null = null;
  @Input() daysPerWeek: number = 5;
  @Input() showProjectionTab: boolean = true;

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
        totalDays: this.projectionDays,
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
