/**
 * @file plan-gantt.utils.ts
 * @description Fonctions pures pour le calcul des barres de Gantt, le positionnement des jalons et les palettes de couleurs.
 */

import { Projet, Jalon } from '../../models/types';
import { GanttBarRange, ResourceRow, ParentRow, ChildRow, PlanViewMode } from './plan-view.models';
import { formatWeekStart } from '../../shared/grid/week-calendar.utils';

export const JALON_PALETTE: Record<
  string,
  { badge: [string, string]; bg: [string, string]; text: [string, string]; border: [string, string] }
> = {
  livraison: { badge: ['#10b981', '#059669'], bg: ['#064e3b', '#d1fae5'], text: ['#a7f3d0', '#065f46'], border: ['#10b981', '#34d399'] },
  lv: { badge: ['#10b981', '#059669'], bg: ['#064e3b', '#d1fae5'], text: ['#a7f3d0', '#065f46'], border: ['#10b981', '#34d399'] },
  maintenance: { badge: ['#c084fc', '#9333ea'], bg: ['#581c87', '#f3e8ff'], text: ['#f3e8ff', '#6b21a8'], border: ['#a855f7', '#c084fc'] },
  lvm: { badge: ['#c084fc', '#9333ea'], bg: ['#581c87', '#f3e8ff'], text: ['#f3e8ff', '#6b21a8'], border: ['#a855f7', '#c084fc'] },
  mep: { badge: ['#60a5fa', '#2563eb'], bg: ['#1e3a8a', '#dbeafe'], text: ['#bfdbfe', '#1e40af'], border: ['#3b82f6', '#60a5fa'] },
  sprint: { badge: ['#fbbf24', '#d97706'], bg: ['#78350f', '#fef3c7'], text: ['#fef3c7', '#92400e'], border: ['#f59e0b', '#fbbf24'] },
  sp: { badge: ['#fbbf24', '#d97706'], bg: ['#78350f', '#fef3c7'], text: ['#fef3c7', '#92400e'], border: ['#f59e0b', '#fbbf24'] },
  default: { badge: ['#94a3b8', '#6b7280'], bg: ['#334155', '#f3f4f6'], text: ['#f1f5f9', '#374151'], border: ['#64748b', '#cbd5e1'] },
};

export function calculateGanttBar(
  charges: Map<string, number> | undefined,
  displayedWeeks: Date[],
): GanttBarRange | null {
  if (!charges || charges.size === 0 || !displayedWeeks.length) return null;
  let firstIndex = -1;
  let lastIndex = -1;

  for (let i = 0; i < displayedWeeks.length; i++) {
    if ((charges.get(formatWeekStart(displayedWeeks[i]!)) || 0) > 0) {
      if (firstIndex === -1) firstIndex = i;
      lastIndex = i;
    }
  }

  if (firstIndex === -1) return null;
  const totalWeeks = displayedWeeks.length;
  return {
    left: (firstIndex / totalWeeks) * 100,
    width: ((lastIndex - firstIndex + 1) / totalWeeks) * 100,
  };
}

export function resolveAssociatedProject(
  mode: PlanViewMode,
  allProjects: Projet[],
  row?: { originalProject?: Projet; projectId?: string; resource?: ResourceRow },
  parentRow?: ParentRow,
  childRow?: ChildRow,
): Projet | undefined {
  if (mode === 'project') return parentRow?.originalProject || row?.originalProject;
  if (mode === 'team') return childRow?.originalProject || row?.originalProject;
  const projId = row?.projectId || row?.resource?.projectId;
  return projId ? allProjects.find((p) => p.id === projId) : undefined;
}

export function calculateJalonLeftPercentage(jalon: Jalon, displayedWeeks: Date[]): number {
  if (!displayedWeeks.length) return 0;
  const jDate = new Date(jalon.event_date).getTime();
  const start = displayedWeeks[0]!.getTime();
  const end = displayedWeeks[displayedWeeks.length - 1]!.getTime() + 7 * 24 * 60 * 60 * 1000;
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((jDate - start) / (end - start)) * 100));
}

export function pickJalonColor(
  type: string,
  channel: 'badge' | 'bg' | 'text' | 'border',
  isDarkMode: boolean,
): string {
  const entry = JALON_PALETTE[type?.toLowerCase()] || JALON_PALETTE['default']!;
  return entry[channel][isDarkMode ? 0 : 1]!;
}
