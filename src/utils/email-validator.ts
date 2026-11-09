/**
 * Utilitaires pour la validation du domaine et des exceptions des adresses e-mail
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
 * Vérifie si une adresse e-mail est autorisée en vérifiant :
 * 1. Si elle correspond à une exception e-mail explicite (ex: compte VIP ou Google OAuth)
 * 2. Si son domaine correspond à l'un des domaines autorisés
 * Si allowedDomains et allowedEmails sont vides ou non définis, toutes les adresses e-mail valides sont acceptées (mode permissif).
 */
export function isEmailAllowed(
  email: string,
  allowedDomains?: string[],
  allowedEmails?: string[]
): boolean {
  const hasDomains = Array.isArray(allowedDomains) && allowedDomains.length > 0;
  const hasEmails = Array.isArray(allowedEmails) && allowedEmails.length > 0;

  // Si aucune restriction n'est configurée (mode permissif)
  if (!hasDomains && !hasEmails) {
    return true;
  }

  if (!email || typeof email !== 'string') {
    return false;
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Exception e-mail exacte
  if (hasEmails) {
    const isExactMatch = allowedEmails!.some(
      (e) => typeof e === 'string' && e.trim().toLowerCase() === cleanEmail
    );
    if (isExactMatch) {
      return true;
    }
  }

  // 2. Domaine autorisé
  if (hasDomains) {
    return isEmailDomainAllowed(cleanEmail, allowedDomains);
  }

  return false;
}

/**
 * Valide une adresse e-mail pour l'inscription en vérifiant le format, les restrictions de domaine et les exceptions e-mails.
 */
export function validateSignupEmail(
  email: string,
  allowedDomains?: string[],
  allowedEmails?: string[]
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

  if (!isEmailAllowed(email, allowedDomains, allowedEmails)) {
    return {
      isValid: false,
      errorMessage: 'Veuillez utiliser votre adresse professionnelle autorisée.',
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

/**
 * Masque partiellement une adresse e-mail pour préserver la confidentialité (ex: jo***e@domaine.com).
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const cleanEmail = email.trim();
  const atIndex = cleanEmail.indexOf('@');
  if (atIndex <= 0) {
    return cleanEmail;
  }
  const localPart = cleanEmail.substring(0, atIndex);
  const domainPart = cleanEmail.substring(atIndex);

  if (localPart.length <= 2) {
    return `${localPart[0]}*${domainPart}`;
  }
  if (localPart.length <= 4) {
    return `${localPart[0]}**${localPart[localPart.length - 1]}${domainPart}`;
  }
  return `${localPart.substring(0, 2)}***${localPart.substring(localPart.length - 1)}${domainPart}`;
}
