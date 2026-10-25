/**
 * @file year-selection.ts
 * @description Types et helpers pour les sélecteurs de période annuelle (« Semaine en cours », « Tout cumulé », « Année N »).
 *
 * Les années proposées sont calculées dynamiquement à partir de la date du jour
 * afin d'éviter toute année codée en dur dans les types ou les templates.
 */

/** Année ISO sérialisée en chaîne (ex: '2026'). */
export type YearKey = `${number}`;

/** Période de cumul : à partir de la semaine en cours, tout l'historique ou une année ISO donnée. */
export type YearPeriod = 'today' | 'all' | YearKey;

/** Nombre d'années proposées avant l'année courante. */
const YEARS_BEFORE = 1;
/** Nombre d'années proposées après l'année courante. */
const YEARS_AFTER = 1;

/**
 * Retourne la liste des années sélectionnables, de (N - YEARS_BEFORE) à (N + YEARS_AFTER).
 * @param reference Date de référence (par défaut : aujourd'hui).
 */
export function getSelectableYears(reference: Date = new Date()): YearKey[] {
  const current = reference.getFullYear();
  const years: YearKey[] = [];
  for (let year = current - YEARS_BEFORE; year <= current + YEARS_AFTER; year++) {
    years.push(`${year}`);
  }
  return years;
}
