import { TestBed } from '@angular/core/testing';
import { AuthConfigService } from './auth-config.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../environments/environment';

describe('AuthConfigService', () => {
  let service: AuthConfigService;
  let mockSupabaseService: any;
  let mockSelectQuery: any;
  const initialAllowedDomains = environment.allowedEmailDomains;

  beforeEach(() => {
    mockSelectQuery = {
      select: jasmine.createSpy('select').and.callFake(() => mockSelectQuery),
      eq: jasmine.createSpy('eq').and.callFake(() => mockSelectQuery),
      order: jasmine.createSpy('order').and.returnValue(
        Promise.resolve({
          data: [
            { id: '1', rule_type: 'domain', value: 'ca-titres.fr', is_active: true },
            { id: '2', rule_type: 'domain', value: '@credit-agricole.fr', is_active: true },
            { id: '3', rule_type: 'email', value: 'admin.perso@gmail.com', is_active: true },
          ],
          error: null,
        })
      ),
    };

    const mockFrom = jasmine.createSpy('from').and.returnValue(mockSelectQuery);
    mockSupabaseService = {
      client: {
        from: mockFrom,
        schema: jasmine.createSpy('schema').and.returnValue({
          from: mockFrom,
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        AuthConfigService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    });

    service = TestBed.inject(AuthConfigService);
  });

  afterEach(() => {
    environment.allowedEmailDomains = initialAllowedDomains;
  });

  it('should be created and initiate loading of allowed rules', () => {
    expect(service).toBeTruthy();
    expect(mockSupabaseService.client.schema).toHaveBeenCalledWith('public');
  });

  it('should extract domains and email exceptions from loaded rules', async () => {
    await service.loadAllowedRules();

    expect(service.allowedDomains()).toEqual(['ca-titres.fr', 'credit-agricole.fr']);
    expect(service.allowedEmails()).toEqual(['admin.perso@gmail.com']);
    expect(service.hasRestrictions()).toBe(true);
    expect(service.emailPlaceholder()).toBe('jean.dupont@ca-titres.fr');
  });

  it('should validate emails matching domain or individual email exception', async () => {
    await service.loadAllowedRules();

    expect(service.isEmailAllowed('collab@ca-titres.fr')).toBe(true);
    expect(service.isEmailAllowed('COLLAB@CA-TITRES.FR')).toBe(true);
    expect(service.isEmailAllowed('admin.perso@gmail.com')).toBe(true);
    expect(service.isEmailAllowed('ADMIN.PERSO@GMAIL.COM')).toBe(true);
    expect(service.isEmailAllowed('other@gmail.com')).toBe(false);
    expect(service.isEmailAllowed('stranger@yahoo.com')).toBe(false);
  });

  it('should fall back to environment.allowedEmailDomains if Supabase query fails', async () => {
    environment.allowedEmailDomains = ['fallback-domain.com'];
    mockSelectQuery.order.and.returnValue(
      Promise.resolve({
        data: null,
        error: { message: 'Table does not exist' },
      })
    );

    service.setRulesForTesting([]);
    await service.loadAllowedRules();

    expect(service.allowedDomains()).toEqual(['fallback-domain.com']);
    expect(service.allowedEmails()).toEqual([]);
  });

  it('should support permissive mode if no rules exist in BDD and environment list is empty', async () => {
    environment.allowedEmailDomains = [];
    service.setRulesForTesting([]);

    expect(service.allowedDomains()).toEqual([]);
    expect(service.allowedEmails()).toEqual([]);
    expect(service.hasRestrictions()).toBe(false);
    expect(service.isEmailAllowed('anybody@anydomain.com')).toBe(true);
    expect(service.validateEmail('anybody@anydomain.com').isValid).toBe(true);
  });
});
