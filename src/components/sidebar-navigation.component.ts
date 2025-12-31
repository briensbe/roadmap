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
  User
} from 'lucide-angular';
import { SidebarService } from '../services/sidebar.service';

interface NavigationItem {
  label: string;
  icon: any;
  route?: string;
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
            <lucide-icon [img]="Building2" [size]="24"></lucide-icon>
          </div>
          <span class="logo-text" *ngIf="!isCollapsed">ResourceFlow</span>
        </div>
        <button class="toggle-btn" (click)="toggleSidebar()" [title]="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
          <lucide-icon [img]="isCollapsed ? ChevronRight : ChevronLeft" [size]="20"></lucide-icon>
        </button>
      </div>

      <div class="nav-items">
        <a *ngFor="let item of navigationItems" 
           class="nav-item"
           [routerLink]="item.route"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{exact: false}"
           [title]="isCollapsed ? item.label : ''">
          <div class="nav-item-icon">
            <lucide-icon [img]="item.icon" [size]="20"></lucide-icon>
          </div>
          <span class="nav-item-label" *ngIf="!isCollapsed">{{ item.label }}</span>
        </a>
      </div>
    </nav>
  `,
  styles: [`
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
      padding: 20px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 72px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toggle-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: #f3f4f6;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
      color: #6b7280;
    }

    .toggle-btn:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .sidebar.collapsed .toggle-btn {
      margin-left: auto;
    }

    .nav-items {
      padding: 16px 12px;
      flex: 1;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      margin-bottom: 4px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      color: #4b5563;
      position: relative;
    }

    .sidebar.collapsed .nav-item {
      justify-content: center;
      padding: 12px;
    }

    .nav-item:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .nav-item.active {
      background: #4f46e5;
      color: white;
    }

    .nav-item.active:hover {
      background: #4338ca;
    }

    .nav-item-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .nav-item-label {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar.collapsed .nav-item-label {
      display: none;
    }

    /* Scrollbar styling */
    .nav-items::-webkit-scrollbar {
      width: 6px;
    }

    .nav-items::-webkit-scrollbar-track {
      background: transparent;
    }

    .nav-items::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .nav-items::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `]
})
export class SidebarNavigationComponent {
  isCollapsed = false;

  // Lucide icons
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

  navigationItems: NavigationItem[] = [
    { label: 'Tableau de bord', icon: this.LayoutDashboard, route: '/dashboard' },
    { label: 'Capacité', icon: this.Gauge, route: '/capacite' },
    { label: 'Planification', icon: this.Calendar, route: '/planification' },
    { label: 'Projets', icon: this.FolderKanban, route: '/projets' },
    { label: 'Jalons', icon: this.Flag, route: '/jalons' },
    { label: 'Ressources', icon: this.Users, route: '/ressources' },
    { label: 'Organisation', icon: this.Building2, route: '/organisation' },
    { label: 'Paramètres', icon: this.Settings, route: '/settings' },
    { label: 'Profil', icon: this.User, route: '/profile' }
  ];

  constructor(private sidebarService: SidebarService) { }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarService.setCollapsed(this.isCollapsed);
  }
}
