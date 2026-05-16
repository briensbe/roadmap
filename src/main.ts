import { Component, HostListener, OnInit, inject, effect } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideRouter, RouterOutlet, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { SidebarNavigationComponent } from "./components/sidebar-navigation.component";
import { SidebarService } from "./services/sidebar.service";
import { routes } from "../src/app.routes";
import { provideAngularQuery, QueryClient } from "@tanstack/angular-query-experimental";
import { provideHttpClient } from "@angular/common/http";
import { ReleaseNotesComponent } from "./components/release-notes.component";

import { MatrixEasterEggComponent } from "./components/matrix-easter-egg.component";

import { EasterEggService } from "./services/easter-egg.service";
import { SupabaseService } from "./services/supabase.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarNavigationComponent, ReleaseNotesComponent, MatrixEasterEggComponent],
  template: `
    <div class="app-layout">
      <app-sidebar-navigation></app-sidebar-navigation>
      <main class="main-content" [class.sidebar-collapsed]="sidebarCollapsed">
        <router-outlet></router-outlet>
      </main>
      <app-release-notes></app-release-notes>
      <app-matrix-easter-egg *ngIf="showEasterEgg" (close)="showEasterEgg = false"></app-matrix-easter-egg>
    </div>
  `,
  styles: [
    `
      .app-layout {
        display: flex;
        min-height: 100vh;
        overflow-x: hidden;
      }

      .main-content {
        flex: 1;
        margin-left: 256px;
        transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow-x: hidden;
      }

      .main-content.sidebar-collapsed {
        margin-left: 80px;
      }
    `,
  ],
})
export class App implements OnInit {
  sidebarCollapsed = false;
  showEasterEgg = false;

  private readonly sidebarService = inject(SidebarService);
  private readonly easterEggService = inject(EasterEggService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly queryClient = inject(QueryClient);

  constructor() {
    // Watch for authentication changes globally
    effect(() => {
      const user = this.supabaseService.user();
      if (!user) {
        // Clear all query data in memory to prevent stale information showing up
        this.queryClient.clear();
        
        const currentUrl = this.router.url;
        const publicRoutes = ["/login", "/signup", "/forgot-password"];
        const isPublic = publicRoutes.some(route => currentUrl.includes(route));

        // Redirect to login only if on a protected route
        if (!isPublic && currentUrl !== "/") {
          const queryParams = this.supabaseService.isLocalLogout ? {} : { reason: "session_expired" };
          this.router.navigate(["/login"], { queryParams });
        }
      }
    });
  }

  ngOnInit() {
    this.sidebarService.collapsed$.subscribe((collapsed) => {
      this.sidebarCollapsed = collapsed;
    });

    this.easterEggService.trigger$.subscribe(() => {
      this.showEasterEgg = true;
    });
  }
}

bootstrapApplication(App, {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideRouter(routes),
    provideAngularQuery(new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })),
  ],
});
