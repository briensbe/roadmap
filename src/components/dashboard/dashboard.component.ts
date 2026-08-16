import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Calendar,
  FolderKanban,
  Users,
  Building2,
  Flag,
  Rocket,
  Clock,
  Plus,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-angular';
import { ProjetService } from '../../services/projet.service';
import { RolesService } from '../../services/roles.service';
import { PersonnesService } from '../../services/personnes.service';
import { ServicesService } from '../../services/services.service';
import { TeamService } from '../../services/team.service';
import { JalonService } from '../../services/jalon.service';
import { ChargeService } from '../../services/charge.service';
import { Projet, Jalon, Charge, Equipe, Role, Personne } from '../../models/types';

interface StatusCount {
  statut: string;
  count: number;
}

interface ResourceBreakdown {
  name: string;
  jours: number;
}

interface ProjectSprintInfo {
  projet: Projet;
  raf: number;
  joursEngages: number;
  ressources: ResourceBreakdown[];
}

interface SprintTeamInfo {
  sprint: Jalon;
  dateFin: string;
  projets: ProjectSprintInfo[];
}

interface TeamSprintContent {
  equipe: Equipe;
  sprints: SprintTeamInfo[];
  expanded: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly projetService = inject(ProjetService);
  private readonly rolesService = inject(RolesService);
  private readonly personnesService = inject(PersonnesService);
  private readonly servicesService = inject(ServicesService);
  private readonly teamService = inject(TeamService);
  private readonly jalonService = inject(JalonService);
  private readonly chargeService = inject(ChargeService);
  private readonly router = inject(Router);

  // Lucide icons
  readonly Calendar = Calendar;
  readonly FolderKanban = FolderKanban;
  readonly Users = Users;
  readonly Building2 = Building2;
  readonly Flag = Flag;
  readonly Rocket = Rocket;
  readonly Clock = Clock;
  readonly Plus = Plus;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly ExternalLink = ExternalLink;

  projets: Projet[] = [];
  jalons: Jalon[] = [];
  equipes: Equipe[] = [];
  charges: Charge[] = [];
  roles: Role[] = [];
  personnes: Personne[] = [];
  projectStatusCounts: StatusCount[] = [];
  rolesCount = 0;
  personnesCount = 0;
  servicesCount = 0;
  equipesCount = 0;

  // Key metrics requested
  upcomingLivraisons: Jalon[] = []; // Next 3 deliveries (LV)
  upcomingMeps: Jalon[] = []; // Next 2 production deployments (MEP)
  upcomingSprints: Jalon[] = []; // Next 3 sprints (SP)

  // Sprint contents grouped by team
  sprintContentByTeam: TeamSprintContent[] = [];

  // Recent projects activity
  addedProjects: { projet: Projet; dateSaisie: string }[] = [];
  modifiedProjects: { projet: Projet; dateModification: string }[] = [];

  hoveredStatus: string | null = null;
  hoveredResource: string | null = null;

  async ngOnInit() {
    await Promise.all([
      this.loadProjects(),
      this.loadJalons(),
      this.loadResources(),
      this.loadOrganization(),
      this.loadCharges(),
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
      this.roles = await this.rolesService.getAllRoles();
      this.personnes = await this.personnesService.getAllPersonnes();
      this.rolesCount = this.roles.length;
      this.personnesCount = this.personnes.length;
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  }

  async loadOrganization() {
    try {
      const services = await this.servicesService.getAllServices();
      this.equipes = await this.teamService.getAllEquipes();
      this.servicesCount = services.length;
      this.equipesCount = this.equipes.length;
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  }

  async loadCharges() {
    try {
      this.charges = await this.chargeService.getAllCharges();
    } catch (error) {
      console.error('Error loading charges:', error);
    }
  }

  processData() {
    // Process project status counts (kept for legacy/summary cards if needed)
    const statusMap = new Map<string, number>();
    this.projets.forEach((projet) => {
      const count = statusMap.get(projet.statut) || 0;
      statusMap.set(projet.statut, count + 1);
    });
    this.projectStatusCounts = Array.from(statusMap.entries())
      .map(([statut, count]) => ({ statut, count }))
      .sort((a, b) => b.count - a.count);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Sort jalons chronologically
    const sortedJalons = [...this.jalons].sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
    );

    // 2. Extract next milestones
    this.upcomingLivraisons = sortedJalons
      .filter((j) => (j.event_type === 'livraison' || j.event_type === 'LV') && new Date(j.event_date) >= today)
      .slice(0, 3);

    this.upcomingMeps = sortedJalons
      .filter((j) => (j.event_type === 'mep' || j.event_type === 'MEP') && new Date(j.event_date) >= today)
      .slice(0, 2);

    this.upcomingSprints = sortedJalons
      .filter((j) => (j.event_type === 'sprint' || j.event_type === 'SP') && new Date(j.event_date) >= today)
      .slice(0, 3);

    // 3. Sprint Content Grouped by Team
    const allSprints = sortedJalons.filter((j) => j.event_type === 'sprint' || j.event_type === 'SP');
    this.sprintContentByTeam = [];

    for (const equipe of this.equipes) {
      const sprintInfos: SprintTeamInfo[] = [];

      for (const sprint of this.upcomingSprints) {
        // Find sprint boundaries to know starting and ending dates
        const idx = allSprints.findIndex((s) => s.id === sprint.id);
        let sStart: Date;
        if (idx > 0) {
          const prevDate = new Date(allSprints[idx - 1].event_date);
          sStart = new Date(prevDate);
          sStart.setDate(sStart.getDate() + 1);
        } else {
          // If first sprint in list, assume 2 weeks duration
          const endDate = new Date(sprint.event_date);
          sStart = new Date(endDate);
          sStart.setDate(sStart.getDate() - 13);
        }
        sStart.setHours(0, 0, 0, 0);
        const sEnd = new Date(sprint.event_date);
        sEnd.setHours(23, 59, 59, 999);

        // Find charges for this team overlapping the sprint
        const teamSprintCharges = this.charges.filter(
          (c) =>
            c.equipe_id === equipe.id &&
            c.semaine_debut &&
            this.getOverlapWorkingDays(c.semaine_debut, sStart, sEnd) > 0,
        );

        // Group charges by project
        const projectMap = new Map<
          string,
          { projet: Projet; joursEngages: number; ressourcesMap: Map<string, number> }
        >();

        for (const charge of teamSprintCharges) {
          const proj = this.projets.find((p) => p.id === charge.projet_id);
          if (!proj) continue;

          const joursParSem = this.getJoursParSemaine(charge);
          const overlapDays = this.getOverlapWorkingDays(charge.semaine_debut, sStart, sEnd);
          const fraction = overlapDays / 5;
          const daysEngaged = (charge.unite_ressource || 0) * joursParSem * fraction;

          if (daysEngaged <= 0) continue;

          let resName = 'Ressource';
          if (charge.personne_id) {
            const p = this.personnes.find((pers) => pers.id === charge.personne_id);
            resName = p ? `${p.prenom} ${p.nom}` : 'Personne';
          } else if (charge.role_id) {
            const r = this.roles.find((role) => role.id === charge.role_id);
            resName = r ? r.nom : 'Rôle';
          }

          const projId = proj.id!;
          if (!projectMap.has(projId)) {
            projectMap.set(projId, {
              projet: proj,
              joursEngages: 0,
              ressourcesMap: new Map<string, number>(),
            });
          }

          const entry = projectMap.get(projId)!;
          entry.joursEngages += daysEngaged;

          const currentResDays = entry.ressourcesMap.get(resName) || 0;
          entry.ressourcesMap.set(resName, currentResDays + daysEngaged);
        }

        // Build project details list
        const projetsInfo: ProjectSprintInfo[] = [];
        for (const entry of projectMap.values()) {
          // Format resources breakdown list
          const resourcesList: ResourceBreakdown[] = Array.from(entry.ressourcesMap.entries())
            .map(([name, jours]) => ({ name, jours: Math.round(jours * 10) / 10 }))
            .sort((a, b) => b.jours - a.jours);

          // Calculate project total RAF since current week Monday
          const currentWeekMonday = this.getWeekStart(new Date());
          const year = currentWeekMonday.getFullYear();
          const month = (currentWeekMonday.getMonth() + 1).toString().padStart(2, '0');
          const day = currentWeekMonday.getDate().toString().padStart(2, '0');
          const currentWeekMondayStr = `${year}-${month}-${day}`;

          const projCharges = this.charges.filter(
            (c) => c.projet_id === entry.projet.id && c.semaine_debut && c.semaine_debut >= currentWeekMondayStr,
          );
          const raf = projCharges.reduce((sum, c) => sum + (c.unite_ressource || 0) * this.getJoursParSemaine(c), 0);

          projetsInfo.push({
            projet: entry.projet,
            raf: Math.round(raf * 10) / 10,
            joursEngages: Math.round(entry.joursEngages * 10) / 10,
            ressources: resourcesList,
          });
        }

        if (projetsInfo.length > 0) {
          sprintInfos.push({
            sprint: sprint,
            dateFin: sprint.event_date,
            projets: projetsInfo,
          });
        }
      }

      if (sprintInfos.length > 0) {
        this.sprintContentByTeam.push({
          equipe,
          sprints: sprintInfos,
          expanded: true,
        });
      }
    }

    // 4. Sliding month projects
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    this.addedProjects = [];
    this.modifiedProjects = [];

    for (const p of this.projets) {
      let isAdded = false;
      if (p.created_at) {
        const createdDate = new Date(p.created_at);
        if (createdDate >= thirtyDaysAgo) {
          this.addedProjects.push({
            projet: p,
            dateSaisie: p.created_at,
          });
          isAdded = true;
        }
      }
      if (!isAdded && p.updated_at) {
        const updatedDate = new Date(p.updated_at);
        if (updatedDate >= thirtyDaysAgo) {
          this.modifiedProjects.push({
            projet: p,
            dateModification: p.updated_at,
          });
        }
      }
    }

    // Sort by date descending
    this.addedProjects.sort((a, b) => new Date(b.dateSaisie).getTime() - new Date(a.dateSaisie).getTime());
    this.modifiedProjects.sort(
      (a, b) => new Date(b.dateModification).getTime() - new Date(a.dateModification).getTime(),
    );
  }

  getOverlapWorkingDays(weekStartStr: string, sStart: Date, sEnd: Date): number {
    const wStart = new Date(weekStartStr);
    let overlapCount = 0;
    for (let i = 0; i < 5; i++) {
      // Mon to Fri
      const day = new Date(wStart);
      day.setDate(day.getDate() + i);
      day.setHours(0, 0, 0, 0);
      if (day >= sStart && day <= sEnd) {
        overlapCount++;
      }
    }
    return overlapCount;
  }

  getJoursParSemaine(charge: Charge): number {
    if (charge.role_id) {
      const role = this.roles.find((r) => r.id === charge.role_id);
      return role?.jours_par_semaine ?? 5;
    }
    if (charge.personne_id) {
      const pers = this.personnes.find((p) => p.id === charge.personne_id);
      return pers?.jours_par_semaine ?? 5;
    }
    return 5;
  }

  getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  getProjectName(projetId?: string | null): string | null {
    if (!projetId) return null;
    const projet = this.projets.find((p) => p.id === projetId);
    return projet?.nom_projet || null;
  }

  getProjectById(projetId?: string | null): Projet | null {
    if (!projetId) return null;
    return this.projets.find((p) => p.id === projetId) || null;
  }

  getDaysRemaining(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jalonDate = new Date(dateStr);
    jalonDate.setHours(0, 0, 0, 0);
    const diffTime = jalonDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysRemainingText(dateStr: string): string {
    const days = this.getDaysRemaining(dateStr);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Demain';
    if (days < 0) return 'Passé';
    return `Dans ${days}j`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  toggleTeam(teamContent: TeamSprintContent) {
    teamContent.expanded = !teamContent.expanded;
  }
}
