import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
export class UpdatePasswordComponent implements OnInit {
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  isRecovery = signal(false);
  message = signal<string | null>(null);
  error = signal<string | null>(null);
  loading = false;
  success = false;

  // expose icons for template [img] binding
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly CheckCircle = CheckCircle;
  readonly ArrowLeft = ArrowLeft;

  protected readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly requiresCurrentPassword = computed(() => !this.isRecovery() && !!this.supabaseService.user());

  async ngOnInit() {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        this.isRecovery.set(true);
      }
    }

    // Vérifier qu'il y a bien une session active (token de reset ou utilisateur connecté)
    const { data } = await this.supabaseService.getSession();
    if (!data.session && !this.supabaseService.user()) {
      this.error.set('Session invalide ou expirée. Veuillez demander un nouveau lien de réinitialisation.');
    }
  }

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
    this.message.set(null);

    if (this.requiresCurrentPassword()) {
      if (!this.currentPassword()) {
        this.error.set('Veuillez saisir votre mot de passe actuel.');
        return;
      }
      if (this.currentPassword() === this.newPassword()) {
        this.error.set('Le nouveau mot de passe doit être différent du mot de passe actuel.');
        return;
      }
    }

    // Validation
    if (this.newPassword().length < 6) {
      this.error.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading = true;

    try {
      // Si l'utilisateur est connecté et effectue un changement volontaire, vérifier l'ancien mot de passe
      if (this.requiresCurrentPassword()) {
        const userEmail = this.supabaseService.user()?.email;
        if (userEmail) {
          const { error: authError } = await this.supabaseService.signInWithEmail({
            email: userEmail,
            password: this.currentPassword(),
          });

          if (authError) {
            this.error.set('Le mot de passe actuel est incorrect.');
            this.loading = false;
            return;
          }
        }
      }

      const { error } = await this.supabaseService.updatePassword(this.newPassword());

      if (error) {
        this.error.set(this.formatErrorMessage(error));
      } else {
        this.message.set('Mot de passe mis à jour avec succès !');
        this.success = true;
      }
    } catch (err: any) {
      this.error.set(this.formatErrorMessage(err));
    } finally {
      this.loading = false;
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
  goToLogin() {
    this.router.navigate(['/login']);
  }
}
