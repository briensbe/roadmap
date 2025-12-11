import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css',
})
export class UpdatePasswordComponent implements OnInit {
  newPassword = signal('');
  confirmPassword = signal('');
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  message = signal<string | null>(null);
  error = signal<string | null>(null);
  loading = false;
  success = false;

  // expose icons for template [img] binding
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  async ngOnInit() {
    // Vérifier qu'il y a bien une session active (token de reset)
    const { data } = await this.supabaseService.getSession();
    if (!data.session) {
      this.error.set('Session invalide. Veuillez demander un nouveau lien de réinitialisation.');
    }
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
  }

  async onSubmit() {
    this.error.set(null);
    this.message.set(null);

    // Validation
    if (this.newPassword().length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading = true;

    try {
      const { error } = await this.supabaseService.updatePassword(this.newPassword());

      if (error) {
        this.error.set('Erreur : ' + error.message);
      } else {
        this.message.set('Mot de passe mis à jour avec succès !');
        this.success = true;
      }
    } catch (err: any) {
      this.error.set('Une erreur est survenue : ' + err.message);
    } finally {
      this.loading = false;
    }
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
}