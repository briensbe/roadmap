/**
 * @file capacity-grid-selection.controller.ts
 * @description Contrôleur injectable pilotant la sélection rectangulaire et le positionnement de la toolbar de capacité.
 */

import { Injectable, ChangeDetectorRef } from '@angular/core';
import { ToolbarPosition } from '../../utils/selection-positioning';
import { computeFloatingToolbarPosition } from '../../shared/grid/floating-toolbar-positioner';
import { formatWeekStart } from '../../shared/grid/week-calendar.utils';
import { ResourceRow, SelectedCapacityCell } from './capacity-view.models';

@Injectable()
export class CapacityGridSelectionController {
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  dragStartWeekIndex = -1;
  dragEndWeekIndex = -1;
  selectedCells: SelectedCapacityCell[] = [];
  isSelectionFinished = false;
  toolbarPosition: ToolbarPosition | null = null;
  toolbarVisible = false;

  bulkCapaciteValue: number | null = null;
  bulkOverrideValue: number | null = null;
  bulkDeltaValue: number | null = null;
  bulkCrewdayzBase: number | null = null;
  bulkInitialAction: 'override' | 'delta' = 'override';
  bulkComment = '';

  clearBulkInputs() {
    this.bulkCapaciteValue = null;
    this.bulkOverrideValue = null;
    this.bulkDeltaValue = null;
    this.bulkCrewdayzBase = null;
    this.bulkInitialAction = 'override';
    this.bulkComment = '';
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, displayedWeeks: Date[], cdr: ChangeDetectorRef) {
    this.isDragging = true;
    this.isSelectionFinished = false;
    this.dragStartResource = resource;
    this.clearBulkInputs();

    const target = event.target as HTMLElement;
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
      if (indexStr) {
        this.dragStartWeekIndex = parseInt(indexStr, 10);
        this.dragEndWeekIndex = this.dragStartWeekIndex;
        this.updateSelection(displayedWeeks);
        cdr.markForCheck();
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow, displayedWeeks: Date[]) {
    if (!this.isDragging || !this.dragStartResource) return;
    if (resource.uniqueId !== this.dragStartResource.uniqueId) return;

    const target = event.target as HTMLElement;
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
      if (indexStr) {
        const newIndex = parseInt(indexStr, 10);
        if (newIndex !== this.dragEndWeekIndex) {
          this.dragEndWeekIndex = newIndex;
          this.updateSelection(displayedWeeks);
        }
      }
    }
  }

  onMouseUp(
    displayedWeeks: Date[],
    isSelectionCrewdayz: boolean,
    getCrewdayzDispoFn: (res: ResourceRow, week: Date) => number | null,
    cdr: ChangeDetectorRef,
  ) {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.selectedCells.length > 0) {
      this.isSelectionFinished = true;

      if (this.selectedCells.length === 1) {
        const cell = this.selectedCells[0]!;
        const weekStr = formatWeekStart(cell.week);
        const custom = cell.resource.weekData?.get(weekStr);

        if (isSelectionCrewdayz) {
          this.bulkCrewdayzBase = getCrewdayzDispoFn(cell.resource, cell.week);
          this.bulkOverrideValue =
            custom?.override_capacite !== undefined && custom?.override_capacite !== null
              ? custom.override_capacite
              : null;
          this.bulkDeltaValue =
            custom?.override_delta !== undefined && custom?.override_delta !== null ? custom.override_delta : null;
          this.bulkInitialAction =
            custom?.override_delta !== null && custom?.override_delta !== undefined ? 'delta' : 'override';
          this.bulkCapaciteValue = null;
        } else {
          const val = cell.resource.weeks.get(weekStr) || 0;
          this.bulkCapaciteValue = val > 0 ? val : null;
          this.bulkCrewdayzBase = null;
          this.bulkOverrideValue = null;
          this.bulkDeltaValue = null;
          this.bulkInitialAction = 'override';
        }

        this.bulkComment = custom?.comment || '';
      } else {
        if (isSelectionCrewdayz) {
          const bases = this.selectedCells.map((c) => getCrewdayzDispoFn(c.resource, c.week) ?? 0);
          this.bulkCrewdayzBase = bases.length > 0 ? Math.min(...bases) : 0;
        } else {
          this.bulkCrewdayzBase = null;
        }
        this.clearBulkInputs();
      }

      this.updateToolbarPosition(cdr);
    }
  }

  updateSelection(displayedWeeks: Date[]) {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: displayedWeeks[i]!,
      });
    }
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some(
      (s) => s.resource.uniqueId === resource.uniqueId && s.week.getTime() === week.getTime(),
    );
  }

  clearSelection() {
    this.selectedCells = [];
    this.isSelectionFinished = false;
    this.toolbarPosition = null;
    this.toolbarVisible = false;
    this.dragStartResource = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
    this.clearBulkInputs();
  }

  updateToolbarPosition(cdr: ChangeDetectorRef) {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    setTimeout(() => {
      const rowSelector = `[data-resource-id="${this.dragStartResource!.uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector) as HTMLElement | null;

      if (rowElement) {
        const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
        const cellElement = rowElement.querySelector(cellSelector) as HTMLElement | null;

        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          const wrapperEl = document.querySelector('.calendar-wrapper') as HTMLElement | null;
          const headerEl = document.querySelector('.calendar-header-row') as HTMLElement | null;
          const labelEl = rowElement.querySelector('.label-cell') as HTMLElement | null;

          const computed = computeFloatingToolbarPosition({
            targetRect: rect,
            wrapperEl,
            headerEl,
            labelEl,
            dragStartWeekIndex: this.dragStartWeekIndex,
            dragEndWeekIndex: this.dragEndWeekIndex,
          });

          this.toolbarVisible = computed.visible;
          this.toolbarPosition = computed.position;
          cdr.markForCheck();
        }
      }
    }, 0);
  }

  checkToolbarVisibilityOnScroll(cdr: ChangeDetectorRef) {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    const rowSelector = `[data-resource-id="${this.dragStartResource.uniqueId}"]`;
    const rowElement = document.querySelector(rowSelector) as HTMLElement | null;

    if (rowElement) {
      const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
      const cellElement = rowElement.querySelector(cellSelector) as HTMLElement | null;

      if (cellElement) {
        const rect = cellElement.getBoundingClientRect();
        const wrapperEl = document.querySelector('.calendar-wrapper') as HTMLElement | null;
        const headerEl = document.querySelector('.calendar-header-row') as HTMLElement | null;
        const labelEl = rowElement.querySelector('.label-cell') as HTMLElement | null;

        const computed = computeFloatingToolbarPosition({
          targetRect: rect,
          wrapperEl,
          headerEl,
          labelEl,
          dragStartWeekIndex: this.dragStartWeekIndex,
          dragEndWeekIndex: this.dragEndWeekIndex,
        });

        if (this.toolbarVisible !== computed.visible) {
          this.toolbarVisible = computed.visible;
          cdr.detectChanges();
        }
      }
    }
  }
}
