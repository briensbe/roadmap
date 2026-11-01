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
    resendConfirmationEmail: any;
    signOut: any;
  };
  let mockRouter: {
    navigate: any;
    navigateByUrl: any;
  };

  beforeEach(async () => {
    mockSupabaseService = {
      signInWithEmail: () => Promise.resolve({ error: null }),
      signInWithGoogle: () => Promise.resolve({ error: null }),
      resendConfirmationEmail: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve(),
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

  it('should detect unconfirmed email error and display friendly message', async () => {
    mockSupabaseService.signInWithEmail = () => {
      return Promise.resolve({ error: { message: 'Email not confirmed' } });
    };

    component.email.set('user@example.com');
    component.password.set('password123');

    await component.signInWithEmail();

    expect(component.unconfirmedEmail()).toBe(true);
    expect(component.errorMessage()).toContain("n'a pas encore été confirmée");
  });

  it('should call resendConfirmationEmail when resendConfirmation is triggered', async () => {
    let resendEmailCalledWith = '';
    mockSupabaseService.resendConfirmationEmail = (email: string) => {
      resendEmailCalledWith = email;
      return Promise.resolve({ error: null });
    };

    component.email.set('test@example.com');
    await component.resendConfirmation();

    expect(resendEmailCalledWith).toBe('test@example.com');
    expect(component.resendSuccessMessage()).toContain('Un nouvel e-mail de confirmation');
  });

  it('should navigate to signup with verify-otp step and email query param', () => {
    let navigatedTo: any = null;
    let navigatedParams: any = null;
    mockRouter.navigate = (commands: any[], extras: any) => {
      navigatedTo = commands;
      navigatedParams = extras?.queryParams;
    };

    component.email.set('user@example.com');
    component.goToOtpVerification();

    expect(navigatedTo).toEqual(['/signup']);
    expect(navigatedParams).toEqual({ step: 'verify-otp', email: 'user@example.com' });
  });
});
