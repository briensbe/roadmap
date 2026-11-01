import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  KeyRound,
  RefreshCw,
  Edit2,
  CheckCircle,
  ArrowRight,
} from 'lucide-angular';
import { environment } from '../../environments/environment';
import { validateSignupEmail, getEmailPlaceholder, maskEmail } from '../../utils/email-validator';

export type SignupStep = 'form' | 'verify-otp';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent implements OnInit {
  step = signal<SignupStep>('form');
  name = signal('');
  email = signal('');
  isEditingEmail = signal(false);
  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  otpCode = signal('');
  loading = signal(false);
  resending = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));
  maskedEmail = computed(() => maskEmail(this.email()));

  // Expose icons for template usage
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly User = User;
  readonly Mail = Mail;
  readonly Lock = Lock;
  readonly KeyRound = KeyRound;
  readonly RefreshCw = RefreshCw;
  readonly Edit2 = Edit2;
  readonly CheckCircle = CheckCircle;
  readonly ArrowRight = ArrowRight;

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const stepParam = params['step'];
      const emailParam = params['email'];

      if (stepParam === 'verify-otp') {
        if (emailParam) {
          this.email.set(emailParam);
        }
        this.step.set('verify-otp');
        return;
      }

      // Check sessionStorage for pending confirmation email
      const pendingEmail = sessionStorage.getItem('pendingConfirmationEmail');
      if (pendingEmail && !this.email()) {
        this.email.set(pendingEmail);
        this.step.set('verify-otp');
        this.successMessage.set('Reprise de la confirmation pour votre compte.');
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
  }

  toggleEditEmail() {
    this.isEditingEmail.update((val) => !val);
  }

  goToVerifyOtp() {
    this.step.set('verify-otp');
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async signUp() {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Form validation
    if (!this.name() || !this.email() || !this.password() || !this.confirmPassword()) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return;
    }

    // Email domain validation
    const emailValidation = validateSignupEmail(this.email(), environment.allowedEmailDomains);
    if (!emailValidation.isValid) {
      this.errorMessage.set(emailValidation.errorMessage || 'Adresse e-mail non valide.');
      return;
    }

    if (this.password().length < 6) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.signUpWithEmail({
        name: this.name(),
        email: this.email(),
        password: this.password(),
      });

      if (error) {
        this.errorMessage.set(error.message);
      } else {
        // Ensure any session created during signup is cleared before OTP verification
        await this.supabaseService.signOut();
        sessionStorage.setItem('pendingConfirmationEmail', this.email().trim());
        this.step.set('verify-otp');
        this.successMessage.set('Compte créé ! Un code de confirmation à 6 chiffres vient de vous être envoyé par e-mail.');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      this.loading.set(false);
    }
  }

  async verifyOtp() {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const code = this.otpCode().trim();
    if (!code || code.length < 6) {
      this.errorMessage.set('Veuillez saisir le code à 6 chiffres reçu par e-mail.');
      return;
    }

    this.loading.set(true);
    try {
      await this.supabaseService.verifySignupOtp(this.email(), code);
      sessionStorage.removeItem('pendingConfirmationEmail');
      this.successMessage.set('Votre compte a été confirmé avec succès ! Redirection en cours...');
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Code de confirmation invalide ou expiré.');
    } finally {
      this.loading.set(false);
    }
  }

  async resendOtp() {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.resending.set(true);
    try {
      const { error } = await this.supabaseService.resendConfirmationEmail(this.email());
      if (error) {
        this.errorMessage.set(error.message || "Erreur lors de l'envoi du code.");
      } else {
        this.successMessage.set('Un nouveau code de confirmation vient de vous être envoyé.');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || "Erreur lors de l'envoi du code.");
    } finally {
      this.resending.set(false);
    }
  }

  backToForm() {
    sessionStorage.removeItem('pendingConfirmationEmail');
    this.step.set('form');
    this.otpCode.set('');
    this.isEditingEmail.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
