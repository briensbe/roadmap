import {
  normalizeDomain,
  extractEmailDomain,
  isEmailDomainAllowed,
  validateSignupEmail,
  getEmailPlaceholder,
} from './email-validator';

describe('EmailValidator Utility', () => {
  describe('normalizeDomain', () => {
    it('should strip leading @ symbols and lowercase domain', () => {
      expect(normalizeDomain('@SOPRASTERIA.COM')).toBe('soprasteria.com');
      expect(normalizeDomain('@@orange.com  ')).toBe('orange.com');
      expect(normalizeDomain('  company.fr ')).toBe('company.fr');
    });
  });

  describe('extractEmailDomain', () => {
    it('should extract lowercase domain from valid email', () => {
      expect(extractEmailDomain('user@example.com')).toBe('example.com');
      expect(extractEmailDomain('USER@SOPRASTERIA.COM')).toBe('soprasteria.com');
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
      const allowed = ['soprasteria.com', 'orange.com'];
      expect(isEmailDomainAllowed('jean.dupont@soprasteria.com', allowed)).toBe(true);
      expect(isEmailDomainAllowed('JEAN.DUPONT@SOPRASTERIA.COM', allowed)).toBe(true);
      expect(isEmailDomainAllowed('marie@ORANGE.COM', allowed)).toBe(true);
    });

    it('should allow emails when allowedDomains contains @ prefix', () => {
      const allowed = ['@soprasteria.com'];
      expect(isEmailDomainAllowed('jean.dupont@soprasteria.com', allowed)).toBe(true);
    });

    it('should reject emails with non-matching domains', () => {
      const allowed = ['soprasteria.com'];
      expect(isEmailDomainAllowed('user@gmail.com', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@evil-soprasteria.com', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@soprasteria.com.attacker.com', allowed)).toBe(false);
      expect(isEmailDomainAllowed('user@sub.soprasteria.com', allowed)).toBe(false);
    });
  });

  describe('validateSignupEmail', () => {
    it('should return invalid for empty email', () => {
      const result = validateSignupEmail('', ['soprasteria.com']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Veuillez saisir une adresse e-mail.');
    });

    it('should return invalid for malformed email', () => {
      const result = validateSignupEmail('invalid-email', ['soprasteria.com']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Veuillez saisir une adresse e-mail valide.');
    });

    it('should return valid when domain matches single allowed domain', () => {
      const result = validateSignupEmail('collab@soprasteria.com', ['soprasteria.com']);
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should return explicit single domain error when domain is rejected', () => {
      const result = validateSignupEmail('user@gmail.com', ['soprasteria.com']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Seules les adresses e-mail du domaine @soprasteria.com sont autorisées.');
    });

    it('should return explicit multi-domain error when domain is rejected', () => {
      const result = validateSignupEmail('user@gmail.com', ['soprasteria.com', 'orange.com']);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe(
        'Seules les adresses e-mail des domaines suivants sont autorisées : @soprasteria.com, @orange.com.'
      );
    });
  });

  describe('getEmailPlaceholder', () => {
    it('should return default fallback when allowedDomains is empty or undefined', () => {
      expect(getEmailPlaceholder([])).toBe('jean.dupont@entreprise.com');
      expect(getEmailPlaceholder(undefined)).toBe('jean.dupont@entreprise.com');
    });

    it('should return placeholder using first allowed domain', () => {
      expect(getEmailPlaceholder(['soprasteria.com', 'orange.com'])).toBe('jean.dupont@soprasteria.com');
      expect(getEmailPlaceholder(['@societe.fr'])).toBe('jean.dupont@societe.fr');
    });

    it('should respect custom prefix or fallback', () => {
      expect(getEmailPlaceholder(['mon-domaine.com'], 'nom')).toBe('nom@mon-domaine.com');
      expect(getEmailPlaceholder([], 'nom', 'nom@entreprise.com')).toBe('nom@entreprise.com');
    });
  });
});
