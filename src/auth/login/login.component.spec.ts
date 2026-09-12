import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { SupabaseService } from '../../services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { getEmailPlaceholder } from '../../utils/email-validator';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let mockSupabaseService: {
    signInWithEmail: any;
    signInWithGoogle: any;
  };
  let mockRouter: {
    navigate: any;
    navigateByUrl: any;
  };

  beforeEach(async () => {
    mockSupabaseService = {
      signInWithEmail: () => Promise.resolve({ error: null }),
      signInWithGoogle: () => Promise.resolve({ error: null }),
    };

    mockRouter = {
      navigate: () => {},
      navigateByUrl: () => {},
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: { queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create LoginComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize showGoogleAuth matching environment configuration', () => {
    expect(component.showGoogleAuth()).toBe(environment.enableGoogleAuth);
  });

  it('should not render google button if showGoogleAuth is false', () => {
    component.showGoogleAuth.set(false);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.google-btn')).toBeNull();
    expect(compiled.querySelector('.divider')).toBeNull();
  });

  it('should render google button if showGoogleAuth is true', () => {
    component.showGoogleAuth.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.google-btn')).not.toBeNull();
    expect(compiled.querySelector('.divider')).not.toBeNull();
  });

  it('should compute emailPlaceholder matching configured allowed domains', () => {
    expect(component.emailPlaceholder()).toBe(getEmailPlaceholder(environment.allowedEmailDomains));
  });

  it('should prevent signInWithGoogle if showGoogleAuth is false', async () => {
    component.showGoogleAuth.set(false);
    let googleCalled = false;
    mockSupabaseService.signInWithGoogle = () => {
      googleCalled = true;
      return Promise.resolve({ error: null });
    };

    await component.signInWithGoogle();

    expect(googleCalled).toBe(false);
    expect(component.errorMessage()).toBe('La connexion avec Google est désactivée.');
  });
});
