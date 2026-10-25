/**
 * @file capacity-calculations.utils.ts
 * @description Fonctions pures pour le calcul des totaux, infobulles et filtrages de la vue de capacité.
 */

import { getISOWeekYear } from 'date-fns';
import { textContains } from '../../utils/text.utils';
import { formatLocalDate, formatWeekStart } from '../../shared/grid/week-calendar.utils';
import { ResourceRow, TeamRow, ResourceWeekData } from './capacity-view.models';
import { YearPeriod } from '../../utils/year-selection';

export function calculateTeamTotalCapacity(
  teamRow: TeamRow,
  week: Date,
  getCapaciteFn: (res: ResourceRow, w: Date) => number,
): number {
  return teamRow.resources.reduce((sum, resource) => sum + getCapaciteFn(resource, week), 0);
}

export function calculateTeamTotalDays(
  teamRow: TeamRow,
  week: Date,
  getCapaciteFn: (res: ResourceRow, w: Date) => number,
): number {
  return teamRow.resources.reduce(
    (sum, resource) => sum + getCapaciteFn(resource, week) * resource.jours_par_semaine,
    0,
  );
}

export function calculateResourceTotalPlannedDays(
  resource: ResourceRow,
  displayedWeeks: Date[],
  selectedCapacityYear: YearPeriod | 'custom',
  selectedStartDate: Date | null,
  getEffectiveCapacityFn: (res: ResourceRow, w: Date) => number,
  todayWeekStart: Date,
): number {
  let total = 0;
  for (const week of displayedWeeks) {
    const weekStr = formatWeekStart(week);
    const val = getEffectiveCapacityFn(resource, week);
    if (selectedCapacityYear === 'today') {
      const todayWeekStartStr = formatLocalDate(todayWeekStart);
      if (weekStr >= todayWeekStartStr) {
        total += val * resource.jours_par_semaine;
      }
    } else if (selectedCapacityYear === 'custom' && selectedStartDate) {
      const selectedStartStr = formatLocalDate(selectedStartDate);
      if (weekStr >= selectedStartStr) {
        total += val * resource.jours_par_semaine;
      }
    } else {
      const [y, m, d] = weekStr.split('-').map(Number);
      const date = new Date(y!, m! - 1, d!);
      const isoYear = getISOWeekYear(date).toString();
      if (selectedCapacityYear === 'all' || isoYear === selectedCapacityYear) {
        total += val * resource.jours_par_semaine;
      }
    }
  }
  return total;
}

export function formatCapacityCellTooltip(
  source: 'roadmap' | 'crewdayz',
  eff: number,
  base: number | null,
  custom?: ResourceWeekData,
): string {
  let text = '';
  if (source === 'crewdayz') {
    if (custom?.override_capacite !== null && custom?.override_capacite !== undefined) {
      text = `Capacité forcée : ${custom.override_capacite} ETP (Base Crewdayz : ${base ?? 0} ETP)`;
    } else if (custom?.override_delta !== null && custom?.override_delta !== undefined) {
      const sign = custom.override_delta > 0 ? '+' : '';
      text = `Base Crewdayz : ${base ?? 0} ETP | Delta : ${sign}${custom.override_delta} ETP → Total : ${eff} ETP`;
    } else {
      text = `Disponibilité Crewdayz : ${base ?? 0} ETP`;
    }
  } else {
    text = `Capacité Roadmap : ${eff} ETP`;
  }

  if (custom?.comment) {
    text += `\n💬 Note : ${custom.comment}`;
  }
  return text;
}

export function filterTeamRows(
  teamRows: TeamRow[],
  selectedTeamIds: string[],
  selectedResourceNames: Set<string>,
  resourceSearch: string,
): TeamRow[] {
  let rows = teamRows;
  if (selectedTeamIds.length > 0) {
    rows = rows.filter((tr) => selectedTeamIds.includes(tr.equipe.id!));
  }
  if (selectedResourceNames.size > 0) {
    rows = rows
      .map((tr) => ({
        ...tr,
        resources: tr.resources.filter((r) => selectedResourceNames.has(r.label)),
      }))
      .filter((tr) => tr.resources.length > 0);
  } else if (resourceSearch.trim()) {
    const search = resourceSearch.trim();
    rows = rows
      .map((tr) => ({
        ...tr,
        resources: tr.resources.filter((r) => textContains(r.label, search)),
      }))
      .filter((tr) => tr.resources.length > 0);
  }
  return rows;
}
