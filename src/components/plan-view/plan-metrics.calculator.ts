/**
 * @file plan-metrics.calculator.ts
 * @description Helpers purs de calcul des jours planifiés et de résolution des chiffres budgétaires.
 *
 * Responsabilités :
 * - Calculer les jours planifiés cumulés (RAF, annuel, total) pour ressources, équipes et projets.
 * - Résoudre et agréger les chiffres budgétaires par service, équipe et projet.
 * - Vérifier les correspondances de taille et la présence de charges dans une période donnée.
 */
import { getISOWeekYear } from 'date-fns';
import { Chiffre } from '../../models/chiffres.type';
import {
  CapacityYearSelection,
  PlannedDaysPeriod,
  SizeFilterOperator,
  ResourceRow,
  ChildRow,
  ParentRow,
  PlanRawDataset,
  ChiffreCategory,
} from './plan-view.models';

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getPlannedDaysForResource(resource: ResourceRow, period: PlannedDaysPeriod, todayWeekStart: Date): number {
  let total = 0;
  const todayWeekStartStr = formatLocalDate(todayWeekStart);
  const sourceMap = resource.dailyCharges ?? resource.charges;
  const useDirectDays = !!resource.dailyCharges;

  sourceMap.forEach((val, weekStr) => {
    let match: boolean;
    if (period === 'today') match = weekStr >= todayWeekStartStr;
    else if (period === 'all') match = true;
    else {
      const [y, m, d] = weekStr.split('-').map(Number);
      match = getISOWeekYear(new Date(y, m - 1, d)).toString() === period;
    }
    if (match) total += useDirectDays ? val || 0 : (val || 0) * (resource.jours_par_semaine || 5);
  });
  return total;
}

export function getPlannedDaysForChildInTeam(child: ChildRow, period: PlannedDaysPeriod, todayWeekStart: Date): number {
  let total = 0;
  for (const res of child.resources) total += getPlannedDaysForResource(res, period, todayWeekStart);
  return total;
}

export function getPlannedDaysForProjectParent(
  parent: ParentRow,
  period: PlannedDaysPeriod,
  filterEquipeIds: string[],
  todayWeekStart: Date,
): number {
  let total = 0;
  for (const teamChild of parent.children) {
    if (filterEquipeIds.length > 0 && !filterEquipeIds.includes(teamChild.id)) continue;
    for (const res of teamChild.resources) total += getPlannedDaysForResource(res, period, todayWeekStart);
  }
  return total;
}

export function getResourceTotalPlannedDays(
  resource: ResourceRow,
  yearSel: CapacityYearSelection,
  selectedStartDate: Date | null,
  todayWeekStart: Date,
): number {
  let total = 0;
  const sourceMap = resource.dailyCharges ?? resource.charges;
  const useDirectDays = !!resource.dailyCharges;
  const todayWeekStartStr = formatLocalDate(todayWeekStart);
  const selectedStartStr = selectedStartDate ? formatLocalDate(selectedStartDate) : '';

  sourceMap.forEach((val, weekStr) => {
    const dayContribution = useDirectDays ? val : val * resource.jours_par_semaine;
    if (yearSel === 'today') {
      if (weekStr >= todayWeekStartStr) total += dayContribution;
    } else if (yearSel === 'custom' && selectedStartDate) {
      if (weekStr >= selectedStartStr) total += dayContribution;
    } else {
      const [y, m, d] = weekStr.split('-').map(Number);
      const isoYear = getISOWeekYear(new Date(y, m - 1, d)).toString();
      if (yearSel === 'all' || isoYear === yearSel) total += dayContribution;
    }
  });
  return total;
}

export function getChildTotalPlannedDays(
  child: ChildRow,
  yearSel: CapacityYearSelection,
  selectedStartDate: Date | null,
  todayWeekStart: Date,
): number {
  if (child.resources && child.resources.length > 0) {
    return child.resources.reduce(
      (sum, res) => sum + getResourceTotalPlannedDays(res, yearSel, selectedStartDate, todayWeekStart),
      0,
    );
  }
  let total = 0;
  const sourceMap = child.dailyCharges ?? child.charges;
  const useDirectDays = !!child.dailyCharges;
  const todayWeekStartStr = formatLocalDate(todayWeekStart);
  const selectedStartStr = selectedStartDate ? formatLocalDate(selectedStartDate) : '';

  sourceMap.forEach((val, weekStr) => {
    const dayContribution = useDirectDays ? val : val * 5;
    if (yearSel === 'today') {
      if (weekStr >= todayWeekStartStr) total += dayContribution;
    } else if (yearSel === 'custom' && selectedStartDate) {
      if (weekStr >= selectedStartStr) total += dayContribution;
    } else {
      const [y, m, d] = weekStr.split('-').map(Number);
      const isoYear = getISOWeekYear(new Date(y, m - 1, d)).toString();
      if (yearSel === 'all' || isoYear === yearSel) total += dayContribution;
    }
  });
  return total;
}

export function readChiffreCategory(chiffre: Chiffre, mode: ChiffreCategory): number | null {
  if (mode === 'restant') return (chiffre.previsionnel ?? 0) - (chiffre.consomme ?? 0);
  const value = chiffre[mode];
  return value !== undefined ? value : null;
}

export function getChiffreValueForServiceProject(
  allChiffres: Chiffre[],
  serviceId: string,
  projectId: string,
  mode: ChiffreCategory,
): number | null {
  if (!serviceId || !projectId) return null;
  const chiffre = allChiffres.find((c) => c.id_projet === projectId && c.id_service === serviceId);
  return chiffre ? readChiffreCategory(chiffre, mode) : null;
}

export function getChiffreValueForMode(
  dataset: Pick<PlanRawDataset, 'availablePersonnes' | 'allRoleAttachments' | 'allEquipes' | 'allChiffres'>,
  teamId: string,
  projectId: string,
  resourceId: string | undefined,
  resourceType: 'role' | 'personne' | undefined,
  mode: ChiffreCategory,
): number | null {
  let idService: string | null = null;
  if (resourceType === 'personne' && resourceId) {
    idService = dataset.availablePersonnes.find((p) => p.id === resourceId)?.service_id ?? null;
  } else if (resourceType === 'role' && resourceId) {
    idService = dataset.allRoleAttachments.find((a) => a.role_id === resourceId && a.equipe_id === teamId)?.service_id ?? null;
  }
  if (idService === null && !resourceId) {
    idService = dataset.allEquipes.find((e) => e.id === teamId)?.service_id ?? null;
  }
  if (idService === null || !projectId) return null;
  return getChiffreValueForServiceProject(dataset.allChiffres, idService, projectId, mode);
}

export function sumChiffresForTeamIds(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  teamIds: string[],
  projectId: string,
  category: ChiffreCategory,
): number | null {
  const serviceIds = new Set<string>();
  for (const teamId of teamIds) {
    const team = dataset.allEquipes.find((e) => e.id === teamId);
    if (team?.service_id) serviceIds.add(team.service_id);
    for (const att of dataset.allRoleAttachments) {
      if (att.equipe_id === teamId && att.service_id) serviceIds.add(att.service_id);
    }
    for (const pers of dataset.availablePersonnes) {
      if (pers.equipe_id === teamId && pers.service_id) serviceIds.add(pers.service_id);
    }
  }
  if (serviceIds.size === 0) return null;
  let total = 0;
  let found = false;
  for (const sId of serviceIds) {
    const val = getChiffreValueForServiceProject(dataset.allChiffres, sId, projectId, category);
    if (val !== null) {
      found = true;
      total += val;
    }
  }
  return found ? total : null;
}

export function getChiffreValueForTeamProject(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  teamId: string,
  projectId: string,
  category: ChiffreCategory,
): number | null {
  return sumChiffresForTeamIds(dataset, [teamId], projectId, category);
}

export function getChiffreValueForProjectParent(
  dataset: Pick<PlanRawDataset, 'allEquipes' | 'allRoleAttachments' | 'availablePersonnes' | 'allChiffres'>,
  parent: ParentRow,
  filterEquipeIds: string[],
  category: ChiffreCategory,
): number | null {
  const teamIds = parent.children
    .map((c) => c.id)
    .filter((id) => filterEquipeIds.length === 0 || filterEquipeIds.includes(id));
  return sumChiffresForTeamIds(dataset, teamIds, parent.id, category);
}

export function checkSizeMatch(val: number | null, operator: SizeFilterOperator, targetValue: number): boolean {
  if (val === null) return false;
  return operator === 'gte' ? val >= targetValue : val <= targetValue;
}

export function hasChargesInPeriod(chargesMap: Map<string, number> | undefined, startDate: string, endDate: string): boolean {
  if (!chargesMap || chargesMap.size === 0) return false;
  for (const [weekKey, val] of chargesMap.entries()) {
    if (val > 0 && weekKey >= startDate && weekKey <= endDate) return true;
  }
  return false;
}
