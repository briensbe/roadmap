import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconData,
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
  Sun,
  Moon,
} from 'lucide-angular';
import { SidebarService } from '../services/sidebar.service';
import { ReleaseNotesService } from '../services/release-notes.service';
import { ThemeService } from '../services/theme.service';
import { environment } from '../environments/environment';

interface NavigationItem {
  label: string;
  icon: LucideIconData;
  route?: string;
  queryParams?: Record<string, unknown>;
  routerLinkActiveOptions?: { exact: boolean };
  href?: string;
}

@Component({
  selector: 'app-sidebar-navigation',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-navigation.component.html',
  styleUrl: './sidebar-navigation.component.css',
})
export class SidebarNavigationComponent {
  isCollapsed = false;
  readonly version = environment.version;

  private readonly sidebarService = inject(SidebarService);
  private readonly releaseNotesService = inject(ReleaseNotesService);
  readonly themeService = inject(ThemeService);

  // Lucide Icons
  readonly LayoutDashboard = LayoutDashboard;
  readonly Calendar = Calendar;
  readonly FolderKanban = FolderKanban;
  readonly Users = Users;
  readonly Building2 = Building2;
  readonly Settings = Settings;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Gauge = Gauge;
  readonly Layers = Layers;
  readonly Flag = Flag;
  readonly User = User;
  readonly BookOpen = BookOpen;
  readonly FileSpreadsheet = FileSpreadsheet;
  readonly Shield = Shield;
  readonly MessageSquare = MessageSquare;
  readonly Sun = Sun;
  readonly Moon = Moon;

  readonly navigationItems: NavigationItem[] = [
    { label: 'Tableau de bord', icon: this.LayoutDashboard, route: '/dashboard' },
    { label: 'Charges par Sprint', icon: this.Layers, route: '/charges-sprints' },
    { label: 'Capacité', icon: this.Gauge, route: '/capacite' },
    { label: 'Planification', icon: this.Calendar, route: '/planification' },
    { label: 'Projets', icon: this.FolderKanban, route: '/projets' },
    { label: 'Imports Triskell', icon: this.FileSpreadsheet, route: '/imports', routerLinkActiveOptions: { exact: true } },
    { label: 'Jalons', icon: this.Flag, route: '/jalons' },
    { label: 'Ressources', icon: this.Users, route: '/ressources' },
    { label: 'Organisation', icon: this.Building2, route: '/organisation' },
    { label: 'Guide', icon: this.BookOpen, route: '/guide' },
    { label: 'Suggestions', icon: this.MessageSquare, route: '/suggestions' },
    { label: 'Paramètres', icon: this.Settings, route: '/settings' },
    { label: 'Profil', icon: this.User, route: '/profile' },
  ];

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarService.setCollapsed(this.isCollapsed);
  }

  openReleaseNotes(): void {
    this.releaseNotesService.openNotes();
  }
}
