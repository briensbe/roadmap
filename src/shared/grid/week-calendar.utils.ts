/**
 * @file week-calendar.utils.ts
 * @description Fonctions pures pour le calcul et le formatage des timelines hebdomadaires ISO.
 *
 * Indépendant de tout composant Angular ou état DOM, directement testable unitairement.
 */

import { getISOWeek, getISOWeekYear, startOfISOWeek, isSameISOWeek } from 'date-fns';

export const MONTH_NAMES: readonly string[] = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export interface DisplayedMonth {
  key: string;
  label: string;
  year: number;
  quarterLabel: string;
  startWeekNum: number;
  weeks: Date[];
}

export interface DisplayedQuarter {
  label: string;
  year: number;
  months: DisplayedMonth[];
  weeksCount: number;
}

export interface DisplayedYear {
  year: number;
  weeksCount: number;
}

export interface TimelineData {
  displayedWeeks: Date[];
  displayedMonths: DisplayedMonth[];
  displayedYears: DisplayedYear[];
  isYearChangeMap: boolean[];
}

/** Formate une date locale en ISO 'YYYY-MM-DD' (sans décalage UTC). */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Retourne le lundi de la semaine ISO d'une date. */
export function getMondayOfWeek(date: Date): Date {
  return startOfISOWeek(date);
}

/** Retourne la clé de début de semaine ISO 'YYYY-MM-DD'. */
export function formatWeekStart(date: Date): string {
  return formatLocalDate(getMondayOfWeek(date));
}

/**
 * Formatage d'en-tête de semaine lisible en français ('12 janv.').
 */
export function formatWeekHeaderFrench(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/**
 * Formatage d'en-tête de semaine court 'JJ/MM'.
 */
export function formatWeekHeaderNumeric(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Retourne le numéro de semaine ISO (1..53).
 */
export function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}

/**
 * Retourne l'année de semaine ISO.
 */
export function getWeekYear(date: Date): number {
  return getISOWeekYear(date);
}

/**
 * Vérifie si une date correspond à la semaine ISO en cours.
 */
export function isCurrentWeek(date: Date, reference: Date = new Date()): boolean {
  return isSameISOWeek(date, reference);
}

/**
 * Calcule la timeline des 53 semaines consécutives à partir du premier jour du mois de la date donnée.
 */
export function generateWeeksTimeline(
  currentDate: Date,
  getWeekStartFn: (d: Date) => Date = getMondayOfWeek,
  getWeekNumberFn: (d: Date) => number = getWeekNumber,
  getWeekYearFn: (d: Date) => number = getWeekYear,
): TimelineData {
  const displayedWeeks: Date[] = [];
  const startDate = new Date(currentDate);
  startDate.setDate(1);
  const firstWeek = getWeekStartFn(startDate);

  for (let i = 0; i < 53; i++) {
    const week = new Date(firstWeek);
    week.setDate(week.getDate() + i * 7);
    displayedWeeks.push(week);
  }

  const monthGroups: Record<
    string,
    { key: string; label: string; year: number; monthNum: number; weeks: Date[]; startWeekNum: number }
  > = {};
  const monthKeysOrder: string[] = [];

  for (const week of displayedWeeks) {
    const monthNum = week.getMonth();
    const year = week.getFullYear();
    const key = `${year}-${monthNum}`;
    if (!monthGroups[key]) {
      monthGroups[key] = {
        key,
        label: MONTH_NAMES[monthNum] || '',
        year,
        monthNum,
        weeks: [],
        startWeekNum: getWeekNumberFn(week),
      };
      monthKeysOrder.push(key);
    }
    monthGroups[key].weeks.push(week);
  }

  const displayedMonths: DisplayedMonth[] = monthKeysOrder.map((key) => {
    const g = monthGroups[key]!;
    return {
      key: g.key,
      label: g.label,
      year: g.year,
      quarterLabel: `T${Math.floor(g.monthNum / 3) + 1} ${g.year}`,
      startWeekNum: g.startWeekNum,
      weeks: g.weeks,
    };
  });

  const displayedYears: DisplayedYear[] = [];
  const isYearChangeMap: boolean[] = [];

  displayedWeeks.forEach((week, index) => {
    const year = getWeekYearFn(week);
    const last = displayedYears[displayedYears.length - 1];
    if (last && last.year === year) {
      last.weeksCount++;
    } else {
      displayedYears.push({ year, weeksCount: 1 });
    }
    isYearChangeMap.push(index === 0 ? false : year !== getWeekYearFn(displayedWeeks[index - 1]!));
  });

  return { displayedWeeks, displayedMonths, displayedYears, isYearChangeMap };
}

/**
 * Construit la hiérarchie trimestrielle à partir de la liste des mois affichés.
 */
export function buildDisplayedQuarters(displayedMonths: DisplayedMonth[]): DisplayedQuarter[] {
  const quarters: DisplayedQuarter[] = [];
  for (const m of displayedMonths) {
    let q = quarters[quarters.length - 1];
    if (!q || q.label !== m.quarterLabel) {
      q = { label: m.quarterLabel, year: m.year, months: [], weeksCount: 0 };
      quarters.push(q);
    }
    q.months.push(m);
    q.weeksCount += m.weeks.length;
  }
  return quarters;
}
