import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { LucideAngularModule, Eye, EyeOff, Lock, CheckCircle, ArrowLeft } from 'lucide-angular';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css',
})
export class UpdatePasswordComponent {
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  error = signal<string | null>(null);
  loading = signal(false);
  success = signal(false);

  // Exposer les icônes pour le template
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly CheckCircle = CheckCircle;
  readonly ArrowLeft = ArrowLeft;

  protected readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  toggleCurrentPasswordVisibility() {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
  }

  onCurrentPasswordChange(value: string) {
    this.currentPassword.set(value);
    if (this.error()) this.error.set(null);
  }

  onNewPasswordChange(value: string) {
    this.newPassword.set(value);
    if (this.error()) this.error.set(null);
  }

  onConfirmPasswordChange(value: string) {
    this.confirmPassword.set(value);
    if (this.error()) this.error.set(null);
  }

  async onSubmit() {
    this.error.set(null);

    if (!this.currentPassword()) {
      this.error.set('Veuillez saisir votre mot de passe actuel.');
      return;
    }

    if (this.currentPassword() === this.newPassword()) {
      this.error.set('Le nouveau mot de passe doit être différent du mot de passe actuel.');
      return;
    }

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
      // Vérifier la validité du mot de passe actuel
      const userEmail = this.supabaseService.user()?.email;
      if (userEmail) {
        const { error: authError } = await this.supabaseService.signInWithEmail({
          email: userEmail,
          password: this.currentPassword(),
        });

        if (authError) {
          this.error.set('Le mot de passe actuel est incorrect.');
          this.loading.set(false);
          return;
        }
      }

      const { error } = await this.supabaseService.updatePassword(this.newPassword());

      if (error) {
        this.error.set(this.formatErrorMessage(error));
      } else {
        this.success.set(true);
      }
    } catch (err: any) {
      this.error.set(this.formatErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private formatErrorMessage(err: any): string {
    const msg = err?.message || String(err || '');
    if (msg.includes('different from the old password')) {
      return 'Le nouveau mot de passe doit être différent de l’ancien mot de passe.';
    }
    if (msg.includes('should be at least 6 characters')) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (msg.includes('Invalid login credentials')) {
      return 'Le mot de passe actuel est incorrect.';
    }
    return 'Erreur : ' + msg;
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
