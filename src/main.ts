import { Component, OnInit, inject, effect, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, RouterOutlet, Router, withHashLocation } from '@angular/router';
import { CommonModule } from '@angular/common';
import { routes } from './app.routes';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { provideHttpClient } from '@angular/common/http';
import { MatrixEasterEggComponent } from './components/matrix-easter-egg.component';
import { EasterEggService } from './services/easter-egg.service';
import { SupabaseService } from './services/supabase.service';
import { JiraCollectorService } from './services/jira-collector.service';
import { ThemeService } from './services/theme.service';
import { ToastContainerComponent } from './components/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatrixEasterEggComponent,
    ToastContainerComponent,
  ],
  template: `
    <router-outlet></router-outlet>
    @if (showEasterEgg) {
      <app-matrix-easter-egg (close)="showEasterEgg = false"></app-matrix-easter-egg>
    }
    <app-toast-container></app-toast-container>
  `,
  styles: [],
})
export class App implements OnInit {
  showEasterEgg = false;

  private readonly easterEggService = inject(EasterEggService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly queryClient = inject(QueryClient);
  private readonly jiraCollectorService = inject(JiraCollectorService);

  constructor() {
    // Watch for authentication changes globally
    effect(() => {
      const user = this.supabaseService.user();
      if (!user) {
        // Clear all query data in memory to prevent stale information showing up
        this.queryClient.clear();

        const currentUrl = this.router.url;
        const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
        const isPublic = publicRoutes.some((route) => currentUrl.includes(route));

        // Redirect to login only if on a protected route
        if (!isPublic && currentUrl !== '/') {
          const queryParams = this.supabaseService.isLocalLogout ? {} : { reason: 'session_expired' };
          this.router.navigate(['/login'], { queryParams });
        }
      } else {
        // Load Jira issue collector for authenticated users
        this.jiraCollectorService.loadAndShow().catch((err) => {
          console.warn('Jira Issue Collector load failed:', err);
        });
      }
    });
  }

  ngOnInit(): void {
    this.easterEggService.trigger$.subscribe(() => {
      this.showEasterEgg = true;
    });
  }
}

bootstrapApplication(App, {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    provideAngularQuery(
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    ),
  ],
});
