import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PopoverPosition } from '../../../../utils/selection-positioning';
import { ChiffreCategory } from '../../plan-view.models';

export interface ChiffreCategoryOption {
  key: ChiffreCategory;
  label: string;
}

@Component({
  selector: 'app-plan-chiffre-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-chiffre-popover.component.html',
  styleUrl: './plan-chiffre-popover.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanChiffrePopoverComponent {
  readonly position = input.required<PopoverPosition>();
  readonly arrowSide = input<'top' | 'bottom'>('top');
  readonly chiffreMode = input.required<ChiffreCategory>();
  readonly previewValues = input.required<Record<ChiffreCategory, number | null>>();

  readonly modeSelect = output<ChiffreCategory>();

  readonly categories: readonly ChiffreCategoryOption[] = [
    { key: 'initial', label: 'Initial' },
    { key: 'revise', label: 'Révisé' },
    { key: 'previsionnel', label: 'Prévisionnel' },
    { key: 'consomme', label: 'Consommé' },
    { key: 'restant', label: 'Restant' },
  ];
}
