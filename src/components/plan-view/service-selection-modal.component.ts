/**
 * @file service-selection-modal.component.ts
 * @description Modale d'information affichant le total des unités, des jours, des semaines sélectionnées ainsi que la capacité restante, les dates et les jalons de fin de période dans la vue Par services.
 */
import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Calendar, Clock, Layers, TrendingUp, ArrowRight, Flag } from 'lucide-angular';
import { Jalon } from '../../models/types';

export interface ServiceSelectionJalon extends Jalon {
  projectName?: string;
}

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
  @Input() jalons: ServiceSelectionJalon[] = [];

  @Output() close = new EventEmitter<void>();

  readonly X = X;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly Layers = Layers;
  readonly TrendingUp = TrendingUp;
  readonly ArrowRight = ArrowRight;
  readonly Flag = Flag;

  getJalonBadgeStyle(type: string): Record<string, string> {
    const t = type?.toLowerCase();
    if (t === 'lv' || t === 'livraison') {
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
    }
    if (t === 'mep') {
      return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    }
    if (t === 'lvm' || t === 'maintenance') {
      return { background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
    }
    if (t === 'sp' || t === 'sprint') {
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
    }
    return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' };
  }

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
