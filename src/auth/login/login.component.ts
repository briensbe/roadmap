import { Component, computed, inject, signal, OnInit, HostListener } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Eye, EyeOff, Info } from 'lucide-angular';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
import { getEmailPlaceholder } from '../../utils/email-validator';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  showGoogleAuth = signal(environment.enableGoogleAuth);

  email = signal('');
  password = signal('');
  showPassword = signal(false);
  sessionExpired = signal(false);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  emailPlaceholder = computed(() => getEmailPlaceholder(environment.allowedEmailDomains));

  private keyBuffer: string[] = [];
  private readonly SECRET_HASH = '105e3bbbe4a711daa0f47fca6e83588f6be3f3937f4a2b2a780305ccce5530b0';

  // Expose icons for template usage via [img]
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Info = Info;

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @HostListener('window:keydown', ['$event'])
  async handleKeydown(event: KeyboardEvent) {
    if (event.key.length !== 1) {
      return;
    }
    this.keyBuffer.push(event.key.toLowerCase());
    if (this.keyBuffer.length > 4) {
      this.keyBuffer.shift();
    }
    if (this.keyBuffer.length === 4) {
      const bufferStr = this.keyBuffer.join('');
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bufferStr));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (hashHex === this.SECRET_HASH) {
        this.keyBuffer = [];
        const nextState = !this.showGoogleAuth();
        this.showGoogleAuth.set(nextState);
        if (nextState) {
          this.launchConfetti();
        }
      }
    }
  }

  private launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const colors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#9333EA', '#06B6D4'];
    const particleCount = 100;
    const particles: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rot: number;
      vrot: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width / 2,
        y: height * 0.55,
        w: Math.random() * 8 + 6,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.75) * 18 - 4,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    const startTime = performance.now();
    const duration = 2500;

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        canvas.remove();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.vx *= 0.98;
        p.rot += p.vrot;
        p.opacity = Math.max(0, 1 - progress);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['reason'] === 'session_expired') {
        this.sessionExpired.set(true);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  async signInWithEmail() {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const { error } = await this.supabaseService.signInWithEmail({
        email: this.email(),
        password: this.password(),
      });
      if (error) {
        this.errorMessage.set(error.message);
      } else {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Une erreur est survenue lors de la connexion.');
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle() {
    if (!this.showGoogleAuth()) {
      this.errorMessage.set('La connexion avec Google est désactivée.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const { error } = await this.supabaseService.signInWithGoogle();
      if (error) {
        this.errorMessage.set(error.message);
      }
      // Note: redirection is handled by Supabase for OAuth
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Une erreur est survenue avec Google OAuth.');
    } finally {
      this.loading.set(false);
    }
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }

  navigateToForgot() {
    this.router.navigate(['/forgot-password']);
  }
}
