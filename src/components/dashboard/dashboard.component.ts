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
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
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

