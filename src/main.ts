import { Component, OnInit } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CalendarViewComponent } from './components/calendar-view.component';
import { OrganizationViewComponent } from './components/organization-view.component';
import { ResourceManagerComponent } from './components/resource-manager.component';
import { SidebarNavigationComponent } from './components/sidebar-navigation.component';
import { SidebarService } from './services/sidebar.service';

import { CapacityViewComponent } from './components/capacity-view.component';

const routes: Routes = [
  { path: '', redirectTo: '/planification', pathMatch: 'full' },
  { path: 'planification', component: CalendarViewComponent },
  { path: 'organisation', component: OrganizationViewComponent },
  { path: 'ressources', component: ResourceManagerComponent },
  { path: 'capacite', component: CapacityViewComponent }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarNavigationComponent],
  template: `
    <div class="app-layout">
      <app-sidebar-navigation></app-sidebar-navigation>
      <main class="main-content" [class.sidebar-collapsed]="sidebarCollapsed">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    .main-content {
      flex: 1;
      margin-left: 256px;
      transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .main-content.sidebar-collapsed {
      margin-left: 80px;
    }
  `]
})
export class App implements OnInit {
  sidebarCollapsed = false;

  constructor(private sidebarService: SidebarService) { }

  ngOnInit() {
    this.sidebarService.collapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }
}

bootstrapApplication(App, {
  providers: [
    provideRouter(routes)
  ]
});
