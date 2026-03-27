import { Component, inject, signal, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Eye, EyeOff, Info } from 'lucide-angular';

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  sessionExpired = signal(false);
  loading = false;

  // Expose icons for template usage via [img]
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Info = Info;

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['reason'] === 'session_expired') {
        this.sessionExpired.set(true);
      }
    });
  }

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
      }
    } finally {
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    this.loading = true;
    try {
      const { error } = await this.supabaseService.signInWithGoogle();
      if (error) {
        alert('Error signing in with Google: ' + error.message);
      }
      // Note: redirection is handled by Supabase for OAuth
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
