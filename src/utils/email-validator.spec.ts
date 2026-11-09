import {
  normalizeDomain,
  extractEmailDomain,
  isEmailDomainAllowed,
  isEmailAllowed,
  validateSignupEmail,
  getEmailPlaceholder,
  maskEmail,
} from './email-validator';

describe('EmailValidator Utility', () => {
  describe('normalizeDomain', () => {
    it('should strip leading @ symbols and lowercase domain', () => {
      expect(normalizeDomain('@CA-TITRES.FR')).toBe('ca-titres.fr');
      expect(normalizeDomain('@@yahoo.com  ')).toBe('yahoo.com');
      expect(normalizeDomain('  company.fr ')).toBe('company.fr');
    });
  });

  describe('extractEmailDomain', () => {
    it('should extract lowercase domain from valid email', () => {
      expect(extractEmailDomain('user@example.com')).toBe('example.com');
      expect(extractEmailDomain('USER@CA-TITRES.FR')).toBe('ca-titres.fr');
      expect(extractEmailDomain('user.name+tag@sub.domain.org')).toBe('sub.domain.org');
    });

    it('should return null for invalid emails', () => {
      expect(extractEmailDomain('')).toBeNull();
      expect(extractEmailDomain('notanemail')).toBeNull();
      expect(extractEmailDomain('invalid@')).toBeNull();
      expect(extractEmailDomain('@domain.com')).toBeNull();
    });
  });

  describe('isEmailDomainAllowed', () => {
    it('should allow any valid email when allowedDomains is empty or undefined', () => {
      expect(isEmailDomainAllowed('user@gmail.com', [])).toBe(true);
      expect(isEmailDomainAllowed('user@yahoo.fr', undefined)).toBe(true);
    });

    it('should allow emails with matching allowed domain (case insensitive)', () => {
      const allowed = ['ca-titres.fr', 'yahoo.com'];
      expect(isEmailDomainAllowed('jean.dupont@ca-titres.fr', allowed)).toBe(true);
      expect(isEmailDomainAllowed('JEAN.DUPONT@CA-TITRES.FR', allowed)).toBe(true);
      expect(isEmailDomainAllowed('marie@YAHOO.COM', allowed)).toBe(true);
    });

    it('should allow emails when allowedDomains contains @ prefix', () => {
      const allowed = ['@ca-titres.fr'];
      expect(isEmailDomainAllowed('jean.dupont@ca-titres.fr', allowed)).toBe(true);
    });

    it('should reject emails with non-matching domains', () => {
      const allowed = ['ca-titres.fr'];
      expect(isEmailDomainAllowed('user@gmail.com', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@evil-ca-titres.fr', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@ca-titres.fr.attacker.com', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@sub.ca-titres.fr', allowed)).toBe(false);
    });
  });

  describe('isEmailAllowed', () => {
    it('should allow any email in permissive mode (empty domains and emails)', () => {
      expect(isEmailAllowed('user@gmail.com', [], [])).toBe(true);
      expect(isEmailAllowed('user@anything.org', undefined, undefined)).toBe(true);
    });

    it('should allow exact match on VIP email even if domain is not allowed', () => {
      const allowedDomains = ['ca-titres.fr'];
      const allowedEmails = ['admin.perso@gmail.com', 'vip.partner@external.org'];

      expect(isEmailAllowed('admin.perso@gmail.com', allowedDomains, allowedEmails)).toBe(true);
      expect(isEmailAllowed('ADMIN.PERSO@GMAIL.COM', allowedDomains, allowedEmails)).toBe(true);
      expect(isEmailAllowed('other@gmail.com', allowedDomains, allowedEmails)).toBe(false);
    });

    it('should allow emails matching allowed domains', () => {
      const allowedDomains = ['ca-titres.fr'];
      const allowedEmails = ['vip@gmail.com'];

      expect(isEmailAllowed('employe@ca-titres.fr', allowedDomains, allowedEmails)).toBe(true);
      expect(isEmailAllowed('vip@gmail.com', allowedDomains, allowedEmails)).toBe(true);
      expect(isEmailAllowed('hacker@evil.com', allowedDomains, allowedEmails)).toBe(false);
    });
  });

  describe('validateSignupEmail', () => {
    it('should return invalid for empty email', () => {
      const result = validateSignupEmail('', ['ca-titres.fr']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Veuillez saisir une adresse e-mail.');
    });

    it('should return invalid for malformed email', () => {
      const result = validateSignupEmail('invalid-email', ['ca-titres.fr']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Veuillez saisir une adresse e-mail valide.');
    });

    it('should return valid when domain matches allowed domain', () => {
      const result = validateSignupEmail('collab@ca-titres.fr', ['ca-titres.fr']);
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should return standardized error message when domain is rejected', () => {
      const result = validateSignupEmail('user@gmail.com', ['ca-titres.fr']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Veuillez utiliser votre adresse professionnelle autorisée.');
    });

    it('should return valid for VIP email exception', () => {
      const result = validateSignupEmail('vip@gmail.com', ['ca-titres.fr'], ['vip@gmail.com']);
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('getEmailPlaceholder', () => {
    it('should return default fallback when allowedDomains is empty or undefined', () => {
      expect(getEmailPlaceholder([])).toBe('jean.dupont@entreprise.com');
      expect(getEmailPlaceholder(undefined)).toBe('jean.dupont@entreprise.com');
    });

    it('should return placeholder using first allowed domain', () => {
      expect(getEmailPlaceholder(['ca-titres.fr', 'yahoo.com'])).toBe('jean.dupont@ca-titres.fr');
      expect(getEmailPlaceholder(['@societe.fr'])).toBe('jean.dupont@societe.fr');
    });

    it('should respect custom prefix or fallback', () => {
      expect(getEmailPlaceholder(['mon-domaine.com'], 'nom')).toBe('nom@mon-domaine.com');
      expect(getEmailPlaceholder([], 'nom', 'nom@entreprise.com')).toBe('nom@entreprise.com');
    });
  });

  describe('maskEmail', () => {
    it('should return empty string for null or empty input', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail(null as any)).toBe('');
    });

    it('should return input as is if no @ is found', () => {
      expect(maskEmail('invalid-email')).toBe('invalid-email');
    });

    it('should mask short local parts properly', () => {
      expect(maskEmail('a@test.com')).toBe('a*@test.com');
      expect(maskEmail('ab@test.com')).toBe('a*@test.com');
      expect(maskEmail('abc@test.com')).toBe('a**c@test.com');
      expect(maskEmail('abcd@test.com')).toBe('a**d@test.com');
    });

    it('should mask longer local parts properly', () => {
      expect(maskEmail('john.doe@example.com')).toBe('jo***e@example.com');
      expect(maskEmail('jean.dupont@ca-titres.fr')).toBe('je***t@ca-titres.fr');
    });
  });
});
