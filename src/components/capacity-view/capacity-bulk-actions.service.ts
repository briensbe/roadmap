/**
 * @file capacity-bulk-actions.service.ts
 * @description Service encapsulant les opérations de mutation de masse sur les capacités et surcharges Crewdayz (Deep Module).
 *
 * Responsabilités :
 * - Appliquer en masse une valeur de capacité brute (ETP) et commentaire sur une sélection de cellules.
 * - Appliquer des surcharges manuelles Crewdayz (valeur forcée ou delta) ou réinitialiser les personnalisations.
 * - Projeter une charge en jours sur une suite continue de semaines pour une ressource.
 */

import { Injectable, inject } from '@angular/core';
import { TeamService } from '../../services/team.service';
import { CalendarService } from '../../services/calendar.service';
import { ToastService } from '../../services/toast.service';
import { SelectedCapacityCell } from './capacity-view.models';

@Injectable({
  providedIn: 'root',
})
export class CapacityBulkActionsService {
  private readonly teamService = inject(TeamService);
  private readonly calendarService = inject(CalendarService);
  private readonly toast = inject(ToastService);

  /**
   * Applique une valeur de capacité globale sur toutes les cellules sélectionnées.
   */
  async applyBulkCapacite(
    selectedCells: SelectedCapacityCell[],
    value: number | null,
    comment?: string,
  ): Promise<void> {
    if (selectedCells.length === 0 || value == null) return;

    for (const cell of selectedCells) {
      const weekStr = this.calendarService.formatWeekStart(cell.week);
      await this.teamService.saveCapacite(
        cell.resource.id,
        cell.resource.type,
        cell.resource.equipeId,
        weekStr,
        value,
        {
          comment: comment !== undefined ? comment : cell.resource.weekData?.get(weekStr)?.comment,
        },
      );

      // Mise à jour de l'état local pour réactivité immédiate
      cell.resource.weeks.set(weekStr, value);
      if (!cell.resource.weekData) cell.resource.weekData = new Map();
      const existing = cell.resource.weekData.get(weekStr) || { capacite: 0 };
      cell.resource.weekData.set(weekStr, {
        ...existing,
        capacite: value,
        comment: comment !== undefined ? comment : existing.comment,
      });
    }
  }

  /**
   * Applique un forçage manuel (override) en mode Crewdayz sur les cellules sélectionnées.
   */
  async applyBulkOverride(
    selectedCells: SelectedCapacityCell[],
    event: { value: number; comment?: string },
  ): Promise<void> {
    if (selectedCells.length === 0) return;

    for (const cell of selectedCells) {
      const weekStr = this.calendarService.formatWeekStart(cell.week);
      await this.teamService.saveCapacite(
        cell.resource.id,
        cell.resource.type,
        cell.resource.equipeId,
        weekStr,
        cell.resource.weeks.get(weekStr) || 0,
        {
          override_capacite: event.value,
          override_delta: null,
          comment: event.comment ?? null,
        },
      );

      if (!cell.resource.weekData) cell.resource.weekData = new Map();
      const existing = cell.resource.weekData.get(weekStr) || { capacite: cell.resource.weeks.get(weekStr) || 0 };
      cell.resource.weekData.set(weekStr, {
        ...existing,
        override_capacite: event.value,
        override_delta: null,
        comment: event.comment ?? null,
      });
    }
  }

  /**
   * Applique un ajustement relatif (delta) en mode Crewdayz sur les cellules sélectionnées.
   */
  async applyBulkDelta(
    selectedCells: SelectedCapacityCell[],
    event: { delta: number; comment?: string },
  ): Promise<void> {
    if (selectedCells.length === 0) return;

    for (const cell of selectedCells) {
      const weekStr = this.calendarService.formatWeekStart(cell.week);
      await this.teamService.saveCapacite(
        cell.resource.id,
        cell.resource.type,
        cell.resource.equipeId,
        weekStr,
        cell.resource.weeks.get(weekStr) || 0,
        {
          override_capacite: null,
          override_delta: event.delta,
          comment: event.comment ?? null,
        },
      );

      if (!cell.resource.weekData) cell.resource.weekData = new Map();
      const existing = cell.resource.weekData.get(weekStr) || { capacite: cell.resource.weeks.get(weekStr) || 0 };
      cell.resource.weekData.set(weekStr, {
        ...existing,
        override_capacite: null,
        override_delta: event.delta,
        comment: event.comment ?? null,
      });
    }
  }

  /**
   * Efface les surcharges manuelles et commentaires pour restaurer la valeur native.
   */
  async applyClearCustomizations(selectedCells: SelectedCapacityCell[]): Promise<void> {
    if (selectedCells.length === 0) return;

    for (const cell of selectedCells) {
      const weekStr = this.calendarService.formatWeekStart(cell.week);
      await this.teamService.saveCapacite(
        cell.resource.id,
        cell.resource.type,
        cell.resource.equipeId,
        weekStr,
        cell.resource.weeks.get(weekStr) || 0,
        {
          override_capacite: null,
          override_delta: null,
          comment: null,
        },
      );

      if (cell.resource.weekData) {
        const existing = cell.resource.weekData.get(weekStr);
        if (existing) {
          cell.resource.weekData.set(weekStr, {
            ...existing,
            override_capacite: null,
            override_delta: null,
            comment: null,
          });
        }
      }
    }
  }

  /**
   * Projette un volume global de jours sur plusieurs semaines consécutives.
   */
  async applyCapacityProjection(
    selectedCells: SelectedCapacityCell[],
    displayedWeeks: Date[],
    data: { resources: number; totalDays: number },
  ): Promise<void> {
    if (selectedCells.length === 0) return;

    const sortedCells = [...selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
    const firstCell = sortedCells[0]!;
    const startWeekIdx = displayedWeeks.findIndex((w) => w.getTime() === firstCell.week.getTime());

    if (startWeekIdx === -1) return;

    const resourceRow = firstCell.resource;
    const daysPerWeek = resourceRow.jours_par_semaine || 5;
    const nbWeeks = Math.ceil(data.totalDays / (data.resources * daysPerWeek));

    for (let i = 0; i < nbWeeks; i++) {
      const currentTargetIdx = startWeekIdx + i;
      if (currentTargetIdx >= displayedWeeks.length) break;

      const targetWeek = displayedWeeks[currentTargetIdx]!;
      const weekStr = this.calendarService.formatWeekStart(targetWeek);

      await this.teamService.saveCapacite(
        resourceRow.id,
        resourceRow.type,
        resourceRow.equipeId,
        weekStr,
        data.resources,
      );

      resourceRow.weeks.set(weekStr, data.resources);
    }
  }
}
