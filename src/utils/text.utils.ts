/**
 * Normalizes text for search comparisons by converting to lowercase and removing diacritics.
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Checks if target string includes the query string, ignoring case and diacritics.
 */
export function textContains(target: string | null | undefined, query: string | null | undefined): boolean {
  if (!query) return true;
  if (!target) return false;
  return normalizeText(target).includes(normalizeText(query));
}
