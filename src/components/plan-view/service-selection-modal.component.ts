/**
 * @file service-selection-modal.component.ts
 * @description Modale d'information affichant le total des unités, des jours, des semaines sélectionnées ainsi que la capacité restante et les dates de début/fin dans la vue Par services.
 */
import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Calendar, Clock, Layers, TrendingUp, ArrowRight } from 'lucide-angular';

@Component({
  selector: 'app-service-selection-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './service-selection-modal.component.html',
  styleUrl: './service-selection-modal.component.css',
})
export class ServiceSelectionModalComponent {
  @Input() visible = false;
  @Input() rowLabel = '';
  @Input() units = 0;
  @Input() days = 0;
  @Input() weeksCount = 0;
  @Input() remainingCapacityUnits: number | null = null;
  @Input() remainingCapacityDays: number | null = null;
  @Input() startDate: Date | null = null;
  @Input() endDate: Date | null = null;

  @Output() close = new EventEmitter<void>();

  readonly X = X;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly Layers = Layers;
  readonly TrendingUp = TrendingUp;
  readonly ArrowRight = ArrowRight;

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.visible) {
      this.onClose();
    }
  }

  onClose() {
    this.close.emit();
  }
}
