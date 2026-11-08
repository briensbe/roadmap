import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeService } from '../../services/theme.service';
import { Router } from '@angular/router';
import { signal, computed } from '@angular/core';
import { RoadmapUserProfile, RoadmapRole } from '../types/user.type';
import { User } from '@supabase/supabase-js';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;

  let userSignal: ReturnType<typeof signal<User | null>>;
  let userProfileSignal: ReturnType<typeof signal<RoadmapUserProfile | null>>;
  let isProfileLoadingSignal: ReturnType<typeof signal<boolean>>;
  let loadUserProfileSpy: jasmine.Spy;

  let mockSupabaseService: {
    user: ReturnType<typeof userSignal.asReadonly>;
    userProfile: ReturnType<typeof userProfileSignal.asReadonly>;
    isProfileLoading: ReturnType<typeof isProfileLoadingSignal.asReadonly>;
    userRole: ReturnType<typeof computed<RoadmapRole | null>>;
    loadUserProfile: jasmine.Spy;
    getUser: jasmine.Spy;
    signOut: jasmine.Spy;
  };

  let mockThemeService: {
    preference: ReturnType<typeof signal<string>>;
    setPreference: jasmine.Spy;
  };

  let mockRouter: {
    navigate: jasmine.Spy;
  };

  beforeEach(async () => {
    userSignal = signal<User | null>({
      id: 'test-user-id',
      email: 'viewer.user@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { displayName: 'John Viewer' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User);

    userProfileSignal = signal<RoadmapUserProfile | null>({
      id: 'test-user-id',
      email: 'viewer.user@example.com',
      role: 'viewer' as RoadmapRole,
    });

    isProfileLoadingSignal = signal<boolean>(false);
    loadUserProfileSpy = jasmine.createSpy('loadUserProfile').and.resolveTo(userProfileSignal());

    mockSupabaseService = {
      user: userSignal.asReadonly(),
      userProfile: userProfileSignal.asReadonly(),
      isProfileLoading: isProfileLoadingSignal.asReadonly(),
      userRole: computed(() => userProfileSignal()?.role ?? null),
      loadUserProfile: loadUserProfileSpy,
      getUser: jasmine.createSpy('getUser').and.resolveTo({ data: { user: userSignal() }, error: null }),
      signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
    };

    mockThemeService = {
      preference: signal('system'),
      setPreference: jasmine.createSpy('setPreference'),
    };

    mockRouter = {
      navigate: jasmine.createSpy('navigate'),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create ProfileComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should display the user displayName and email', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('John Viewer');
    expect(compiled.textContent).toContain('viewer.user@example.com');
  });

  it('should display assigned role badge with "Lecteur (viewer)" and description for viewer role', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const roleBadge = compiled.querySelector('.role-badge');
    expect(roleBadge).not.toBeNull();
    expect(roleBadge?.textContent?.trim()).toBe('Lecteur (viewer)');
    expect(roleBadge?.classList.contains('role-viewer')).toBe(true);

    const roleHint = compiled.querySelector('.role-hint');
    expect(roleHint).not.toBeNull();
    expect(roleHint?.textContent?.trim()).toBe('Accès en lecture seule à la roadmap.');
  });

  it('should display assigned role badge for editor role', () => {
    userProfileSignal.set({
      id: 'test-user-id',
      email: 'viewer.user@example.com',
      role: 'editor',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const roleBadge = compiled.querySelector('.role-badge');
    expect(roleBadge?.textContent?.trim()).toBe('Éditeur (editor)');
    expect(roleBadge?.classList.contains('role-editor')).toBe(true);

    const roleHint = compiled.querySelector('.role-hint');
    expect(roleHint?.textContent?.trim()).toContain('Accès en consultation et modification');
  });

  it('should display assigned role badge for admin role', () => {
    userProfileSignal.set({
      id: 'test-user-id',
      email: 'viewer.user@example.com',
      role: 'admin',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const roleBadge = compiled.querySelector('.role-badge');
    expect(roleBadge?.textContent?.trim()).toBe('Administrateur (admin)');
    expect(roleBadge?.classList.contains('role-admin')).toBe(true);

    const roleHint = compiled.querySelector('.role-hint');
    expect(roleHint?.textContent?.trim()).toContain("Accès complet avec privilèges d'administration");
  });

  it('should display fallback when no role is assigned', () => {
    userProfileSignal.set(null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const roleBadge = compiled.querySelector('.role-badge');
    expect(roleBadge?.textContent?.trim()).toBe('Aucun rôle attribué');
    expect(roleBadge?.classList.contains('role-none')).toBe(true);
  });

  it('should display loading text when profile is loading', () => {
    userProfileSignal.set(null);
    isProfileLoadingSignal.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const roleBadge = compiled.querySelector('.role-badge');
    expect(roleBadge?.textContent?.trim()).toBe('Chargement...');
  });
});
