import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import { environment } from '../../environments/environment';
import { validateSignupEmail, getEmailPlaceholder } from '../../utils/email-validator';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent {
  name = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));

  // Expose icons for template usage
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
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
        this.successMessage.set('Inscription réussie ! Veuillez vérifier vos e-mails pour confirmer votre compte.');
        // Navigate to login after 5 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 5000);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      this.loading.set(false);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
