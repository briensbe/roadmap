import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule,
  LayoutDashboard,
  Calendar,
  FolderKanban,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Layers,
  Flag,
  User,
  BookOpen,
  FileSpreadsheet,
  Shield,
  MessageSquare,
} from 'lucide-angular';
import { SidebarService } from '../services/sidebar.service';
import { ReleaseNotesService } from '../services/release-notes.service';
import { environment } from '../environments/environment';

interface NavigationItem {
  label: string;
  icon: any;
  route?: string;
  queryParams?: any;
  routerLinkActiveOptions?: any;
  href?: string;
}

@Component({
  selector: 'app-sidebar-navigation',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar" [class.collapsed]="isCollapsed">
      <div class="sidebar-header">
        <div class="logo-container">
          <div class="logo-icon" *ngIf="!isCollapsed">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3b82f6" />
              <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="#3b82f6" opacity="0.6" />
            </svg>
          </div>
          <span class="logo-text" *ngIf="!isCollapsed">ResourceFlow</span>
        </div>
        <button
          class="toggle-btn"
          (click)="toggleSidebar()"
          [title]="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
          <lucide-icon [img]="isCollapsed ? ChevronRight : ChevronLeft" [size]="20"></lucide-icon>
        </button>
      </div>

      <div class="nav-items">
        <ng-container *ngFor="let item of navigationItems">
          <a
            *ngIf="item.route"
            class="nav-item"
            [routerLink]="item.route"
            [queryParams]="item.queryParams || null"
            routerLinkActive="active"
            [routerLinkActiveOptions]="item.routerLinkActiveOptions || { exact: false }"
            [title]="isCollapsed ? item.label : ''">
            <div class="nav-item-icon">
              <lucide-icon [img]="item.icon" [size]="20"></lucide-icon>
            </div>
            <span class="nav-item-label" *ngIf="!isCollapsed">{{ item.label }}</span>
          </a>
          <a
            *ngIf="item.href"
            class="nav-item"
            [href]="item.href"
            target="_blank"
            [title]="isCollapsed ? item.label : ''">
            <div class="nav-item-icon">
              <lucide-icon [img]="item.icon" [size]="20"></lucide-icon>
            </div>
            <span class="nav-item-label" *ngIf="!isCollapsed">{{ item.label }}</span>
          </a>
        </ng-container>
      </div>

      <div class="sidebar-footer">
        <span class="version-text clickable" (click)="openReleaseNotes()" title="Voir l'historique des versions">{{
          version
        }}</span>
      </div>
    </nav>
  `,
  styles: [
    `
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        background: #ffffff;
        border-right: 1px solid #e5e7eb;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        width: 256px;
        display: flex;
        flex-direction: column;
        z-index: 1000;
      }

      .sidebar.collapsed {
        width: 80px;
      }

      .sidebar-header {
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      .logo-container {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo-text {
        font-size: 18px;
        font-weight: 700;
        color: #111827;
        letter-spacing: -0.025em;
      }

      .toggle-btn {
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, color 0.2s;
      }

      .toggle-btn:hover {
        background-color: #f3f4f6;
        color: #111827;
      }

      .nav-items {
        flex: 1;
        padding: 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        color: #4b5563;
        text-decoration: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s, color 0.2s;
        cursor: pointer;
      }

      .nav-item:hover {
        background-color: #f3f4f6;
        color: #111827;
      }

      .nav-item.active {
        background-color: #eff6ff;
        color: #2563eb;
      }

      .nav-item.active .nav-item-icon {
        color: #2563eb;
      }

      .nav-item-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        transition: color 0.2s;
      }

      .nav-item-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sidebar-footer {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: center;
      }

      .version-text {
        font-size: 12px;
        color: #9ca3af;
      }

      .version-text.clickable {
        cursor: pointer;
        transition: color 0.2s;
      }

      .version-text.clickable:hover {
        color: #4b5563;
        text-decoration: underline;
      }
    `,
  ],
})
export class SidebarNavigationComponent {
  isCollapsed = false;
  version = environment.version;

  // Lucide Icons
  LayoutDashboard = LayoutDashboard;
  Calendar = Calendar;
  FolderKanban = FolderKanban;
  Users = Users;
  Building2 = Building2;
  Settings = Settings;
  ChevronLeft = ChevronLeft;
  ChevronRight = ChevronRight;
  Gauge = Gauge;
  Layers = Layers;
  Flag = Flag;
  User = User;
  BookOpen = BookOpen;
  FileSpreadsheet = FileSpreadsheet;
  Shield = Shield;
  MessageSquare = MessageSquare;

  navigationItems: NavigationItem[] = [
    { label: 'Tableau de bord', icon: this.LayoutDashboard, route: '/dashboard' },
    { label: 'Charges par Sprint', icon: this.Layers, route: '/charges-sprints' },
    { label: 'Capacité', icon: this.Gauge, route: '/capacite' },
    { label: 'Planification', icon: this.Calendar, route: '/planification' },
    { label: 'Projets', icon: this.FolderKanban, route: '/projets' },
    { label: 'Imports Triskell', icon: this.FileSpreadsheet, route: '/imports', routerLinkActiveOptions: { exact: true } },
    { label: 'Jalons', icon: this.Flag, route: '/jalons' },
    { label: 'Ressources', icon: this.Users, route: '/ressources' },
    { label: 'Organisation', icon: this.Building2, route: '/organisation' },
    { label: 'Imports & Administration', icon: this.Shield, route: '/imports', queryParams: { tab: 'administration' }, routerLinkActiveOptions: { exact: false } },
    { label: 'Guide', icon: this.BookOpen, route: '/guide' },
    { label: 'Suggestions', icon: this.MessageSquare, route: '/suggestions' },
    { label: 'Paramètres', icon: this.Settings, route: '/settings' },
    { label: 'Profil', icon: this.User, route: '/profile' },
  ];

  constructor(
    private sidebarService: SidebarService,
    private releaseNotesService: ReleaseNotesService,
  ) {}

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarService.setCollapsed(this.isCollapsed);
  }

  openReleaseNotes() {
    this.releaseNotesService.openNotes();
  }
}
