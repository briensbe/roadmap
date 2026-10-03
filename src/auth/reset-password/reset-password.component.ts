import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import {
  LucideAngularModule,
  Eye,
  EyeOff,
  Lock,
  CheckCircle,
  Mail,
  KeyRound,
  RefreshCw,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  Edit2,
} from 'lucide-angular';
import { environment } from '../../environments/environment';
import { getEmailPlaceholder, maskEmail } from '../../utils/email-validator';

export type ResetStep = 'verify-otp' | 'new-password' | 'success';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  step = signal<ResetStep>('verify-otp');
  email = signal('');
  isEditingEmail = signal(false);
  otpCode = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  error = signal<string | null>(null);
  resendSuccess = signal<string | null>(null);
  loading = signal(false);
  resending = signal(false);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));
  maskedEmail = computed(() => maskEmail(this.email()));

  // Exposer les icônes pour le template
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly CheckCircle = CheckCircle;
  readonly Mail = Mail;
  readonly KeyRound = KeyRound;
  readonly RefreshCw = RefreshCw;
  readonly ChevronLeft = ChevronLeft;
  readonly ArrowRight = ArrowRight;
  readonly Sparkles = Sparkles;
  readonly Edit2 = Edit2;

  protected readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  ngOnInit() {
    // Récupération de l'email transmis via l'état de navigation
    const navState = history.state;
    if (navState?.email && typeof navState.email === 'string') {
      this.email.set(navState.email);
    }

    // Si une session de récupération de mot de passe est déjà active, passer directement à l'étape 2
    if (this.supabaseService.isPasswordRecovery() && this.supabaseService.user()) {
      this.step.set('new-password');
      if (this.supabaseService.user()?.email) {
        this.email.set(this.supabaseService.user()!.email!);
      }
    }
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
  }

  toggleEditEmail() {
    this.isEditingEmail.update((v) => !v);
  }

  onEmailChange(value: string) {
    this.email.set(value);
    this.clearAlerts();
  }

  onOtpCodeChange(value: string) {
    // Ne conserver que les chiffres et limiter à 6 caractères
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    this.otpCode.set(cleanValue);
    this.clearAlerts();
  }

  onNewPasswordChange(value: string) {
    this.newPassword.set(value);
    this.clearAlerts();
  }

  onConfirmPasswordChange(value: string) {
    this.confirmPassword.set(value);
    this.clearAlerts();
  }

  private clearAlerts() {
    if (this.error()) this.error.set(null);
    if (this.resendSuccess()) this.resendSuccess.set(null);
  }

  async onResendCode() {
    if (!this.email().trim()) {
      this.error.set('Veuillez renseigner votre adresse e-mail pour renvoyer un code.');
      return;
    }

    this.resending.set(true);
    this.clearAlerts();

    try {
      await this.supabaseService.resetPasswordForEmail(this.email().trim());
      const destination = this.maskedEmail() || this.email().trim();
      this.resendSuccess.set(`Un nouveau code à 6 chiffres a été envoyé à ${destination}.`);
    } catch (err: any) {
      this.error.set(err?.message || "Erreur lors de l'envoi du nouveau code.");
    } finally {
      this.resending.set(false);
    }
  }

  async onVerifyOtp() {
    this.clearAlerts();

    if (!this.email().trim()) {
      this.error.set('Veuillez renseigner votre adresse e-mail.');
      return;
    }

    if (this.otpCode().trim().length !== 6) {
      this.error.set('Veuillez saisir le code de confirmation complet à 6 chiffres.');
      return;
    }

    this.loading.set(true);

    try {
      await this.supabaseService.verifyRecoveryOtp(this.email().trim(), this.otpCode().trim());
      this.step.set('new-password');
    } catch (err: any) {
      this.error.set(this.formatErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onUpdatePassword() {
    this.clearAlerts();

    if (this.newPassword().length < 6) {
      this.error.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);

    try {
      const response = await this.supabaseService.updatePassword(this.newPassword());
      if (response.error) {
        this.error.set(this.formatErrorMessage(response.error));
        return;
      }
      this.step.set('success');
    } catch (err: any) {
      this.error.set(this.formatErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private formatErrorMessage(err: any): string {
    const msg = err?.message || String(err || '');
    if (msg.includes('should be at least 6 characters')) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (msg.includes('Token has expired') || msg.includes('invalide ou expiré')) {
      return 'Le code de confirmation est incorrect ou a expiré (validité 10 min). Veuillez utiliser le dernier code reçu ou en demander un nouveau.';
    }
    return 'Erreur : ' + msg;
  }

  goToApp() {
    this.router.navigate(['/']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
