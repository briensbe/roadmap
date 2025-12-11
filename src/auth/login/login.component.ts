import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = false;

  // Expose icons for template usage via [img]
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  async signInWithEmail() {
    this.loading = true;
    try {
      const { error } = await this.supabaseService.signInWithEmail({
        email: this.email(),
        password: this.password(),
      });
      if (error) {
        alert('Error signing in: ' + error.message);
      } else {
        this.router.navigate(['/']); // Redirige vers la route par défaut
        // TODO -> rediriger vers la page d'origine
      }
    } finally {
      this.loading = false;
    }
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }

  navigateToForgot() {
    this.router.navigate(['/forgot-password']);
  }
}
