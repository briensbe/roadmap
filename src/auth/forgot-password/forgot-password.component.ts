import { Component, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { getEmailPlaceholder } from '../../utils/email-validator';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  email = signal('');
  message = signal<string | null>(null);
  isError = signal(false);
  loading = signal(false);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  async onSubmit() {
    if (!this.email().trim()) {
      this.message.set('Veuillez saisir votre adresse email.');
      this.isError.set(true);
      return;
    }

    this.loading.set(true);
    this.message.set(null);
    this.isError.set(false);

    try {
      await this.supabaseService.resetPasswordForEmail(this.email().trim());
      // Naviguer vers /reset-password en transmettant l'email dans le state
      await this.router.navigate(['/reset-password'], {
        state: { email: this.email().trim() },
      });
    } catch (error: any) {
      this.message.set(`Erreur : ${error.message || "Impossible d'envoyer le code de réinitialisation."}`);
      this.isError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
