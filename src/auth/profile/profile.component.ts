import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeService, type ThemePreference } from '../../services/theme.service';
import {
  LucideAngularModule,
  LucideIconData,
  Sun,
  Moon,
  Monitor,
  Globe,
  Lock,
  KeyRound,
  LogOut,
  User,
  Mail,
  ShieldCheck,
} from 'lucide-angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [LucideAngularModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  public readonly themeService = inject(ThemeService);
  public readonly user = this.supabaseService.user;
  public readonly userProfile = this.supabaseService.userProfile;
  public readonly isProfileLoading = this.supabaseService.isProfileLoading;
  public readonly userRole = this.supabaseService.userRole;

  loading = false;
  showInfo = false;
  private readonly router = inject(Router);

  // Expose icons
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly Monitor = Monitor;
  readonly Globe = Globe;
  readonly Lock = Lock;
  readonly KeyRound = KeyRound;
  readonly LogOut = LogOut;
  readonly User = User;
  readonly Mail = Mail;
  readonly ShieldCheck = ShieldCheck;

  readonly isGoogleUser = computed(() => {
    const user = this.user();
    if (!user) return false;
    const provider = user.app_metadata?.['provider'];
    const providers = user.app_metadata?.['providers'];
    return provider === 'google' || (Array.isArray(providers) && providers.includes('google'));
  });

  readonly authProviderLabel = computed(() => {
    return this.isGoogleUser() ? 'Compte Google (OAuth)' : 'Email / Mot de passe';
  });

  readonly roleLabel = computed(() => {
    if (this.isProfileLoading() && !this.userProfile()) {
      return 'Chargement...';
    }
    const role = this.userRole();
    if (!role) {
      return 'Aucun rôle attribué';
    }
    switch (role) {
      case 'viewer':
        return 'Lecteur (viewer)';
      case 'editor':
        return 'Éditeur (editor)';
      case 'admin':
        return 'Administrateur (admin)';
      default:
        return role;
    }
  });

  readonly roleDescription = computed(() => {
    const role = this.userRole();
    switch (role) {
      case 'viewer':
        return 'Accès en lecture seule à la roadmap.';
      case 'editor':
        return 'Accès en consultation et modification sur les projets et ressources.';
      case 'admin':
        return "Accès complet avec privilèges d'administration et de gestion des accès.";
      default:
        return null;
    }
  });

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (currentUser && !this.userProfile()) {
        this.supabaseService.loadUserProfile(currentUser.id);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const currentUser = this.user();
    if (currentUser && !this.userProfile()) {
      await this.supabaseService.loadUserProfile(currentUser.id);
    }
  }

  // Theme options for the selector
  readonly themeOptions: { value: ThemePreference; label: string; icon: LucideIconData }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  async toggleUserInfo(): Promise<void> {
    if (this.user()) {
      this.showInfo = !this.showInfo;
    } else {
      await this.fetchUser();
      this.showInfo = true;
    }
  }

  async fetchUser(): Promise<void> {
    this.loading = true;
    try {
      const { data } = await this.supabaseService.getUser();
      if (!data?.user) {
        this.router.navigate(['/login']);
      }
    } finally {
      this.loading = false;
    }
  }

  async signOut(): Promise<void> {
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }

  async updatePassword(): Promise<void> {
    this.router.navigate(['/update-password']);
  }

  setTheme(theme: ThemePreference): void {
    this.themeService.setPreference(theme);
  }
}
