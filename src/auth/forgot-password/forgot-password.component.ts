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
  loading = signal(false);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  async onSubmit() {
    this.loading.set(true);
    this.message.set(null);
    try {
      await this.supabaseService.resetPasswordForEmail(this.email());
      this.message.set('Un lien de réinitialisation a été envoyé à votre adresse email.');
    } catch (error: any) {
      this.message.set(`Erreur : ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
