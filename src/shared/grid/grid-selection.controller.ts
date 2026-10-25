/**
 * @file grid-selection.controller.ts
 * @description Contrôleur injectable pilotant la sélection rectangulaire par glissé-déposé et le déplacement fantôme sur les grilles hebdomadaires.
 */

import { Injectable, signal, computed } from '@angular/core';
import { ToolbarPosition } from '../../utils/selection-positioning';
import { formatWeekStart } from './week-calendar.utils';

export interface GridSelectedCell<TResource = any> {
  resource: TResource;
  week: Date;
  childId: string;
  parentId: string;
}

export interface DragProjectionDetails {
  resourceUniqueId: string;
  startWeekIdx: number;
  nbWeeks: number;
}

@Injectable()
export class GridSelectionController<TResource = any> {
  // États réactifs principaux
  readonly selectedCells = signal<GridSelectedCell<TResource>[]>([]);
  readonly isDragging = signal<boolean>(false);
  readonly isSelectionFinished = signal<boolean>(false);
  readonly isMovingSelection = signal<boolean>(false);
  readonly isOverSelectionBorder = signal<boolean>(false);
  readonly moveGhostOffset = signal<number>(0);
  readonly isMoveCommitting = signal<boolean>(false);
  readonly isCommittingSelection = signal<boolean>(false);
  readonly projectionCommitting = signal<DragProjectionDetails | null>(null);

  // Toolbar flottante
  readonly toolbarVisible = signal<boolean>(false);
  readonly toolbarPosition = signal<ToolbarPosition | null>(null);

  // Infobulle de projection au drag
  readonly dragProjectionTooltipVisible = signal<boolean>(false);

  // Curseurs et repères de sélection
  dragStartResource: TResource | null = null;
  dragStartChild: any | null = null;
  dragStartParent: any | null = null;
  dragStartWeekIndex = -1;
  dragEndWeekIndex = -1;
  dragStartCellValue: number | null = null;

  // Repères pour le déplacement physique
  moveStartClientX = 0;
  moveStartWeekIndex = -1;
  cellWidthPx = 80;

  // Valeurs associées pour application en masse
  bulkChargeValue: number | null = null;
  bulkComment = '';

  /** Set des clés uniques de cellules sélectionnées ('resourceUniqueId:YYYY-MM-DD') pour accès O(1) */
  private readonly selectedKeys = computed(() => {
    const set = new Set<string>();
    for (const cell of this.selectedCells()) {
      const resId = (cell.resource as any)?.uniqueId || (cell.resource as any)?.id;
      if (resId) {
        set.add(`${resId}:${formatWeekStart(cell.week)}`);
      }
    }
    return set;
  });

  /**
   * Vérifie instantanément en O(1) si une cellule donnée est sélectionnée.
   */
  isCellSelected(resourceUniqueId: string, week: Date): boolean {
    return this.selectedKeys().has(`${resourceUniqueId}:${formatWeekStart(week)}`);
  }

  /**
   * Réinitialise totalement la sélection et la barre d'outils associée.
   */
  clearSelection(): void {
    this.selectedCells.set([]);
    this.isSelectionFinished.set(false);
    this.isDragging.set(false);
    this.isMovingSelection.set(false);
    this.isOverSelectionBorder.set(false);
    this.moveGhostOffset.set(0);
    this.isMoveCommitting.set(false);
    this.isCommittingSelection.set(false);
    this.projectionCommitting.set(null);
    this.toolbarVisible.set(false);
    this.toolbarPosition.set(null);
    this.dragProjectionTooltipVisible.set(false);

    this.dragStartResource = null;
    this.dragStartChild = null;
    this.dragStartParent = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
    this.dragStartCellValue = null;
    this.bulkChargeValue = null;
    this.bulkComment = '';
  }

  /**
   * Calcule la liste des cellules sélectionnées sur la ligne en cours entre `dragStartWeekIndex` et `dragEndWeekIndex`.
   */
  updateSelectedCells(displayedWeeks: Date[], childId: string, parentId: string): void {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) {
      this.selectedCells.set([]);
      return;
    }
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const cells: GridSelectedCell<TResource>[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (displayedWeeks[i]) {
        cells.push({
          resource: this.dragStartResource,
          week: displayedWeeks[i]!,
          childId,
          parentId,
        });
      }
    }
    this.selectedCells.set(cells);
  }

  /**
   * Vérifie si une cellule est dans la zone "fantôme" lors du déplacement de sélection.
   */
  isCellGhostSelected(weekIndex: number, displayedWeeksCount: number): boolean {
    if (!this.isMovingSelection() || this.moveGhostOffset() === 0 || this.selectedCells().length === 0) {
      return false;
    }
    const offset = this.moveGhostOffset();
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex) + offset;
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex) + offset;
    return weekIndex >= Math.max(0, startIndex) && weekIndex <= Math.min(displayedWeeksCount - 1, endIndex);
  }

  /**
   * Calcule la valeur affichée dans la cellule fantôme lors d'un déplacement.
   */
  getGhostValue(weekIndex: number, chargesMap?: Map<string, number>, displayedWeeks?: Date[]): number | null {
    if (!this.isMovingSelection() || this.moveGhostOffset() === 0 || !displayedWeeks) return null;
    const originalIndex = weekIndex - this.moveGhostOffset();
    const origWeek = displayedWeeks[originalIndex];
    if (!origWeek || !chargesMap) return null;
    const val = chargesMap.get(formatWeekStart(origWeek));
    return val !== undefined && val > 0 ? val : null;
  }
}
