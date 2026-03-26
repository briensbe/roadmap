import { Component, HostListener, OnInit } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { SidebarNavigationComponent } from "./components/sidebar-navigation.component";
import { SidebarService } from "./services/sidebar.service";
import { routes } from "../src/app.routes";
import { provideAngularQuery, QueryClient } from "@tanstack/angular-query-experimental";
import { provideHttpClient } from "@angular/common/http";
import { ReleaseNotesComponent } from "./components/release-notes.component";

import { MatrixEasterEggComponent } from "./components/matrix-easter-egg.component";

import { EasterEggService } from "./services/easter-egg.service";

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

  constructor(
    private sidebarService: SidebarService,
    private easterEggService: EasterEggService
  ) { }

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
