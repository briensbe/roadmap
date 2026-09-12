import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ReleaseNotesService } from '../services/release-notes.service';
import { EasterEggService } from '../services/easter-egg.service';
import { SupabaseService } from '../services/supabase.service';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';

interface ReleaseNews {
  title: string;
  imageUrl?: string;
  imageMaxHeight?: number;
  items: string[];
}

interface ReleaseNote {
  version: string;
  date: string;
  // Old fields (fallback)
  title?: string;
  imageUrl?: string;
  imageMaxHeight?: number;
  items?: string[];
  // New grouped news
  news?: ReleaseNews[];
}

@Component({
  selector: 'app-release-notes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './release-notes.component.html',
  styleUrl: './release-notes.component.css',
})
export class ReleaseNotesComponent implements OnInit, OnDestroy {
  notes: ReleaseNote[] = [];
  private _show = false;
  get show() {
    return this._show;
  }
  set show(value: boolean) {
    this._show = value;
    if (value) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      this.activeImageUrl = null;
    }
  }
  showHistory = false;
  activeImageUrl: string | null = null;
  private readonly STORAGE_KEY = 'roadmap_last_seen_release_version';
  private subscription: Subscription | null = null;
  private hasBeenClosedInSession = false;

  constructor(
    private http: HttpClient,
    private releaseNotesService: ReleaseNotesService,
    private easterEggService: EasterEggService,
    private supabaseService: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.subscription = new Subscription();

    this.http.get<ReleaseNote[]>('assets/release-notes.json').subscribe({
      next: async (data) => {
        if (data && data.length > 0) {
          this.notes = data;
          // On ne vérifie la visibilité que si l'utilisateur est déjà connecté au démarrage
          if (await this.isUserAuthenticated()) {
            this.checkVisibility();
          }
        }
      },
      error: (err) => console.error('Error loading release notes:', err),
    });

    // Écouter les changements d'état d'authentification
    const authSub = this.supabaseService.authState$.subscribe(async () => {
      if (this.notes.length > 0) {
        if (await this.isUserAuthenticated()) {
          this.checkVisibility();
        } else {
          this.show = false;
        }
      }
    });
    this.subscription.add(authSub);

    // Écouter les changements de route (navigation après login)
    const routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(async () => {
        if (this.notes.length > 0) {
          if (await this.isUserAuthenticated()) {
            this.checkVisibility();
          } else {
            this.show = false;
          }
        }
      });
    this.subscription.add(routerSub);

    const manualSub = this.releaseNotesService.showNotes$.subscribe(async (show) => {
      if (show && this.notes.length > 0) {
        // On ne permet l'ouverture manuelle que si connecté
        if (await this.isUserAuthenticated()) {
          this.showHistory = true;
          this.show = true;
        }
      }
    });
    this.subscription.add(manualSub);
  }

  @HostListener('document:keydown.escape')
  onEscapeKeydown() {
    if (this.activeImageUrl) {
      this.closeImage();
    } else if (this.show) {
      this.close();
    }
  }

  triggerEasterEgg() {
    this.easterEggService.trigger();
    this.close();
  }

  private isPublicRoute(url?: string): boolean {
    const currentUrl = url || this.router.url;
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/update-password'];
    return publicRoutes.some((route) => currentUrl.includes(route));
  }

  private async isUserAuthenticated(): Promise<boolean> {
    if (this.isPublicRoute()) {
      return false;
    }
    if (!environment.enableAuth) {
      return true;
    }
    const user = this.supabaseService.user();
    if (user) {
      return true;
    }
    const { data } = await this.supabaseService.getUser();
    return !!data?.user;
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    document.body.style.overflow = '';
  }

  private checkVisibility() {
    if (this.notes.length === 0 || this.hasBeenClosedInSession) return;
    const latestVersion = this.notes[0].version;
    const lastSeenVersion = localStorage.getItem(this.STORAGE_KEY);

    if (lastSeenVersion !== latestVersion) {
      this.showHistory = false;
      this.show = true;
    }
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  openImage(url: string | undefined) {
    if (url) {
      this.activeImageUrl = url;
    }
  }

  closeImage() {
    this.activeImageUrl = null;
  }

  close() {
    this.show = false;
    this.hasBeenClosedInSession = true;
    // Reset history view for the next time it opens
    setTimeout(() => (this.showHistory = false), 300);
  }

  dontShowAgain() {
    if (this.notes.length > 0) {
      localStorage.setItem(this.STORAGE_KEY, this.notes[0].version);
    }
    this.close();
  }
}
