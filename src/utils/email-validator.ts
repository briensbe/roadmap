/**
 * Utilitaires pour la validation du domaine des adresses e-mail
 */

/**
 * Normalise un nom de domaine en retirant les espaces et le préfixe '@' éventuel, en minuscules.
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, '');
}

/**
 * Extrait le domaine d'une adresse e-mail après le dernier symbole '@'.
 * Retourne null si le format d'e-mail est invalide.
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  const cleanEmail = email.trim();
  const atIndex = cleanEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === cleanEmail.length - 1) {
    return null;
  }
  const domain = cleanEmail.substring(atIndex + 1).trim();
  return domain ? domain.toLowerCase() : null;
}

/**
 * Vérifie si le domaine d'une adresse e-mail correspond à l'un des domaines autorisés.
 * Si allowedDomains est vide ou non défini, toutes les adresses e-mail valides sont acceptées.
 */
export function isEmailDomainAllowed(email: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) {
    return false;
  }

  const normalizedAllowed = allowedDomains
    .map((d) => normalizeDomain(d))
    .filter((d) => d.length > 0);

  if (normalizedAllowed.length === 0) {
    return true;
  }

  return normalizedAllowed.includes(emailDomain);
}

/**
 * Valide une adresse e-mail pour l'inscription en vérifiant le format et les restrictions de domaine.
 */
export function validateSignupEmail(
  email: string,
  allowedDomains?: string[]
): { isValid: boolean; errorMessage?: string } {
  if (!email || !email.trim()) {
    return {
      isValid: false,
      errorMessage: 'Veuillez saisir une adresse e-mail.',
    };
  }

  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) {
    return {
      isValid: false,
      errorMessage: 'Veuillez saisir une adresse e-mail valide.',
    };
  }

  if (!isEmailDomainAllowed(email, allowedDomains)) {
    const cleanAllowed = (allowedDomains || [])
      .map((d) => normalizeDomain(d))
      .filter((d) => d.length > 0);

    if (cleanAllowed.length === 1) {
      return {
        isValid: false,
        errorMessage: `Seules les adresses e-mail du domaine @${cleanAllowed[0]} sont autorisées.`,
      };
    }

    const formattedDomains = cleanAllowed.map((d) => `@${d}`).join(', ');
    return {
      isValid: false,
      errorMessage: `Seules les adresses e-mail des domaines suivants sont autorisées : ${formattedDomains}.`,
    };
  }

  return { isValid: true };
}

/**
 * Génère un exemple / placeholder d'adresse e-mail adapté aux domaines autorisés configurés.
 */
export function getEmailPlaceholder(
  allowedDomains?: string[],
  defaultPrefix = 'jean.dupont',
  defaultFallback = 'jean.dupont@entreprise.com'
): string {
  if (allowedDomains && allowedDomains.length > 0) {
    const cleanDomain = normalizeDomain(allowedDomains[0]);
    if (cleanDomain) {
      return `${defaultPrefix}@${cleanDomain}`;
    }
  }
  return defaultFallback;
}
