import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Calendar, FolderKanban, Users, Building2 } from 'lucide-angular';
import { ProjetService } from '../services/projet.service';
import { RolesService } from '../services/roles.service';
import { PersonnesService } from '../services/personnes.service';
import { ServicesService } from '../services/services.service';
import { TeamService } from '../services/team.service';
import { JalonService } from '../services/jalon.service';
import { Projet, Jalon } from '../models/types';

interface StatusCount {
  statut: string;
  count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1 class="dashboard-title">Tableau de bord</h1>
          <p class="dashboard-subtitle">Vue d'ensemble de vos ressources et projets</p>
        </div>
        <div class="header-actions">
          <a [routerLink]="['/plan-globale']" class="btn-planning">
            <lucide-icon [img]="Calendar" [size]="18"></lucide-icon>
            Voir la planification
          </a>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <!-- Card Projets -->
        <div class="summary-card">
          <div class="card-header">
            <div class="card-title-group">
              <div class="card-icon" [style.background-color]="'#3b82f6'">
                <lucide-icon [img]="FolderKanban" [size]="24"></lucide-icon>
              </div>
              <h3 class="card-title">Projets</h3>
            </div>
            <a [routerLink]="['/projets']" class="card-link">Voir tout →</a>
          </div>
          <div class="card-content">
            @if (projectStatusCounts.length > 0) {
              @for (status of projectStatusCounts; track status.statut) {
                <div class="stat-item" (mouseenter)="hoveredStatus = status.statut" (mouseleave)="hoveredStatus = null">
                  <div class="stat-number" [style.color]="'#3b82f6'">{{ status.count }}</div>
                  <div class="stat-label-wrapper">
                    <span class="stat-label">{{ status.statut.toLowerCase() }}</span>
                  </div>
                </div>
              }
            } @else {
              <div class="empty-message">Aucun projet</div>
            }
          </div>
        </div>

        <!-- Card Ressources -->
        <div class="summary-card">
          <div class="card-header">
            <div class="card-title-group">
              <div class="card-icon" [style.background-color]="'#10b981'">
                <lucide-icon [img]="Users" [size]="24"></lucide-icon>
              </div>
              <h3 class="card-title">Ressources</h3>
            </div>
            <a [routerLink]="['/ressources']" class="card-link">Voir tout →</a>
          </div>
          <div class="card-content">
            @if (rolesCount > 0 || personnesCount > 0) {
              <div class="stat-item" (mouseenter)="hoveredResource = 'roles'" (mouseleave)="hoveredResource = null">
                <div class="stat-number" [style.color]="'#10b981'">{{ rolesCount }}</div>
                <div class="stat-label-wrapper">
                  <span class="stat-label">Rôles</span>
                </div>
              </div>
              <div class="stat-item" (mouseenter)="hoveredResource = 'personnes'" (mouseleave)="hoveredResource = null">
                <div class="stat-number" [style.color]="'#10b981'">{{ personnesCount }}</div>
                <div class="stat-label-wrapper">
                  <span class="stat-label">Personnes</span>
                </div>
              </div>
            } @else {
              <div class="empty-message">Aucune ressource</div>
            }
          </div>
        </div>

        <!-- Card Organisation -->
        <div class="summary-card">
          <div class="card-header">
            <div class="card-title-group">
              <div class="card-icon" [style.background-color]="'#8b5cf6'">
                <lucide-icon [img]="Building2" [size]="24"></lucide-icon>
              </div>
              <h3 class="card-title">Organisation</h3>
            </div>
            <a [routerLink]="['/organisation']" class="card-link">Voir tout →</a>
          </div>
          <div class="card-content">
            @if (servicesCount > 0 || equipesCount > 0) {
              <div class="stat-item">
                <div class="stat-number" [style.color]="'#8b5cf6'">{{ servicesCount }}</div>
                <div class="stat-label-wrapper">
                  <span class="stat-label">Services</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-number" [style.color]="'#8b5cf6'">{{ equipesCount }}</div>
                <div class="stat-label-wrapper">
                  <span class="stat-label">Équipes</span>
                </div>
              </div>
            } @else {
              <div class="empty-message">Aucune organisation</div>
            }
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <!-- Recent Projects -->
        <div class="content-card">
          <div class="content-card-header">
            <h3 class="content-card-title">Projets récents</h3>
            <a [routerLink]="['/projets']" class="content-card-link">Voir tout →</a>
          </div>
          <div class="content-card-body">
            @if (recentProjects.length > 0) {
              @for (projet of recentProjects; track projet.id) {
                <div class="project-item" [style.border-left-color]="projet.color || '#3b82f6'">
                  <div class="project-info">
                    <div class="project-header">
                      <span class="project-code" [style.color]="projet.color || '#3b82f6'">{{ projet.code_projet }}</span>
                      <span class="project-status" [attr.data-status]="projet.statut">{{ projet.statut }}</span>
                    </div>
                    <div class="project-name">{{ projet.nom_projet }}</div>
                    <div class="project-progress">
                      <div class="progress-bar">
                        <div class="progress-fill" [style.width.%]="getProgressPercent(projet)"></div>
                      </div>
                      <span class="progress-text">{{ getProgressText(projet) }}</span>
                    </div>
                  </div>
                </div>
              }
            } @else {
              <div class="empty-state">Aucun projet récent</div>
            }
          </div>
        </div>

        <!-- Upcoming Milestones -->
        <div class="content-card">
          <div class="content-card-header">
            <h3 class="content-card-title">Jalons à venir</h3>
            <a [routerLink]="['/jalons']" class="content-card-link">Voir tout →</a>
          </div>
          <div class="content-card-body">
            @if (upcomingJalons.length > 0) {
              @for (jalon of upcomingJalons; track jalon.id) {
                <div class="milestone-item">
                  <div class="milestone-bar" [style.background-color]="getMilestoneColor(jalon)"></div>
                  <div class="milestone-content">
                    <div class="milestone-header">
                      <div class="milestone-title">{{ jalon.nom }}</div>
                      <div class="milestone-date">{{ formatDate(jalon.date_jalon) }}</div>
                    </div>
                    <div class="milestone-meta">
                      <div class="milestone-project">
                        {{ getProjectName(jalon.projet_id) }}
                      </div>
                      <div class="milestone-days" [class.urgent]="getDaysRemaining(jalon.date_jalon) <= 7">
                        {{ getDaysRemainingText(jalon.date_jalon) }}
                      </div>
                    </div>
                  </div>
                </div>
              }
            } @else {
              <div class="empty-state">Aucun jalon à venir</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 32px;
      background: #f5f7fa;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 32px;
      gap: 24px;
    }

    .header-left {
      flex: 1;
    }

    .dashboard-title {
      font-size: 32px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 4px 0;
    }

    .dashboard-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn-planning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-planning:hover {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    .summary-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
    }

    .summary-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .card-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .card-link {
      font-size: 14px;
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .card-link:hover {
      color: #2563eb;
    }

    .card-content {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      column-gap: 16px;
      row-gap: 24px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }

    .stat-number {
      font-size: 48px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .stat-label-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .stat-label {
      font-size: 14px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: capitalize;
    }

    .stat-link {
      font-size: 12px;
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s, opacity 0.2s, transform 0.2s;
      opacity: 0;
      transform: translateY(-4px);
    }

    .stat-item:hover .stat-link {
      opacity: 1;
      transform: translateY(0);
    }

    .stat-link:hover {
      color: #2563eb;
    }

    .empty-message {
      font-size: 14px;
      color: #94a3b8;
      font-style: italic;
    }

    .main-content {
      display: grid;
      grid-template-columns: 5fr 4fr;
      gap: 24px;
    }

    .content-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .content-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .content-card-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .content-card-link {
      font-size: 14px;
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: color 0.2s;
    }

    .content-card-link:hover {
      color: #2563eb;
    }

    .content-card-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .project-item {
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      border-left: 3px solid #3b82f6;
      transition: all 0.2s;
    }

    .project-item:hover {
      background: #f3f4f6;
      transform: translateX(2px);
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .project-code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    .project-status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .project-status[data-status="Actif"] {
      background: #d1fae5;
      color: #065f46;
    }

    .project-status[data-status="En cours"] {
      background: #dbeafe;
      color: #1e40af;
    }

    .project-status[data-status="Planifié"] {
      background: #fef3c7;
      color: #92400e;
    }

    .project-status[data-status="Terminé"] {
      background: #f3f4f6;
      color: #374151;
    }

    .project-status[data-status="En pause"] {
      background: #fee2e2;
      color: #991b1b;
    }

    .project-name {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }

    .project-progress {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .progress-bar {
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .milestone-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 12px;
      transition: all 0.2s;
    }

    .milestone-item:hover {
      background: #f3f4f6;
    }

    .milestone-bar {
      width: 4px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .milestone-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .milestone-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .milestone-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      flex: 1;
    }

    .milestone-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2px;
    }

    .milestone-date {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .milestone-project {
      font-size: 13px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      margin-right: 12px;
    }

    .milestone-days {
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
    }

    .milestone-days.urgent {
      color: #f59e0b;
    }

    .empty-state {
      padding: 32px;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
    }

    @media (max-width: 1200px) {
      .main-content {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  // Lucide icons
  Calendar = Calendar;
  FolderKanban = FolderKanban;
  Users = Users;
  Building2 = Building2;

  projets: Projet[] = [];
  jalons: Jalon[] = [];
  projectStatusCounts: StatusCount[] = [];
  rolesCount = 0;
  personnesCount = 0;
  servicesCount = 0;
  equipesCount = 0;
  recentProjects: Projet[] = [];
  upcomingJalons: Jalon[] = [];

  hoveredStatus: string | null = null;
  hoveredResource: string | null = null;

  constructor(
    private projetService: ProjetService,
    private rolesService: RolesService,
    private personnesService: PersonnesService,
    private servicesService: ServicesService,
    private teamService: TeamService,
    private jalonService: JalonService,
    private router: Router
  ) { }

  async ngOnInit() {
    await Promise.all([
      this.loadProjects(),
      this.loadJalons(),
      this.loadResources(),
      this.loadOrganization()
    ]);
    this.processData();
  }

  async loadProjects() {
    try {
      this.projets = await this.projetService.getAllProjets();
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  async loadJalons() {
    try {
      this.jalons = await this.jalonService.getAllJalons();
    } catch (error) {
      console.error('Error loading jalons:', error);
    }
  }

  async loadResources() {
    try {
      const roles = await this.rolesService.getAllRoles();
      const personnes = await this.personnesService.getAllPersonnes();
      this.rolesCount = roles.length;
      this.personnesCount = personnes.length;
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  }

  async loadOrganization() {
    try {
      const services = await this.servicesService.getAllServices();
      const equipes = await this.teamService.getAllEquipes();
      this.servicesCount = services.length;
      this.equipesCount = equipes.length;
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  }

  processData() {
    // Process project status counts
    const statusMap = new Map<string, number>();
    this.projets.forEach(projet => {
      const count = statusMap.get(projet.statut) || 0;
      statusMap.set(projet.statut, count + 1);
    });
    this.projectStatusCounts = Array.from(statusMap.entries())
      .map(([statut, count]) => ({ statut, count }))
      .sort((a, b) => b.count - a.count);

    // Get recent projects (last 5 updated)
    this.recentProjects = [...this.projets]
      .sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    // Get upcoming jalons (not past, max 7, ascending order)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.upcomingJalons = this.jalons
      .filter(jalon => {
        const jalonDate = new Date(jalon.date_jalon);
        jalonDate.setHours(0, 0, 0, 0);
        return jalonDate >= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date_jalon).getTime();
        const dateB = new Date(b.date_jalon).getTime();
        return dateA - dateB;
      })
      .slice(0, 7);
  }

  getProgressPercent(projet: Projet): number {
    if (projet.chiffrage_previsionnel === 0) return 0;
    const percent = (projet.temps_consomme / projet.chiffrage_previsionnel) * 100;
    return Math.min(Math.round(percent), 100);
  }

  getProgressText(projet: Projet): string {
    return `${projet.temps_consomme}j / ${projet.chiffrage_previsionnel}j`;
  }

  getProjectName(projetId?: string): string | null {
    if (!projetId) return null;
    const projet = this.projets.find(p => p.id === projetId);
    return projet?.nom_projet || null;
  }

  getMilestoneColor(jalon: Jalon): string {
    const days = this.getDaysRemaining(jalon.date_jalon);
    if (days <= 7) return '#ef4444';
    if (days <= 30) return '#f59e0b';
    return '#3b82f6';
  }

  getDaysRemaining(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jalonDate = new Date(dateStr);
    jalonDate.setHours(0, 0, 0, 0);
    const diffTime = jalonDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  getDaysRemainingText(dateStr: string): string {
    const days = this.getDaysRemaining(dateStr);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Demain';
    if (days < 0) return 'En retard';
    return `Dans ${days}j`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    return `${day} ${month}`;
  }
}

