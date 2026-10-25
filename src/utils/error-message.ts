/**
 * @file error-message.ts
 * @description Extraction d'un message lisible depuis une erreur de type inconnu (Error, PostgrestError, string…).
 */

/**
 * Retourne le message d'une erreur quelconque, ou `fallback` si aucun message exploitable n'est trouvé.
 * @param err Erreur capturée (`catch (err: unknown)`).
 * @param fallback Message par défaut.
 */
export function toErrorMessage(err: unknown, fallback = 'Erreur inconnue'): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
