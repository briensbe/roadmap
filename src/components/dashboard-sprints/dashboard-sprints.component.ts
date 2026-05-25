import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  LucideAngularModule,
  Calendar,
  Flag,
  Rocket,
  Users,
  Building2,
  ArrowRight,
  Layers,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-angular";
import { ProjetService } from "../../services/projet.service";
import { RolesService } from "../../services/roles.service";
import { PersonnesService } from "../../services/personnes.service";
import { TeamService } from "../../services/team.service";
import { JalonService } from "../../services/jalon.service";
import { ChargeService } from "../../services/charge.service";
import { Projet, Jalon, Charge, Equipe, Role, Personne } from "../../models/types";

export type GroupMode = "equipe" | "sprint" | "livraison" | "mep";

interface SprintPeriod {
  sprint: Jalon;
  start: Date;
  end: Date;
  label: string;
}

interface CellData {
  jours: number;
  colorClass: string;
  milestones: Jalon[];
}

interface GroupRow {
  id: string;
  name: string;
  code?: string;
  color?: string;
  extraInfo?: string;
  expanded: boolean;
  totalCharge: number;
  subRows: Array<{
    projet: Projet;
    totalCharge: number;
    cells: CellData[]; // Map each column to a cell
    isMainMilestoneTarget?: boolean;
  }>;
}

@Component({
  selector: "app-dashboard-sprints",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: "./dashboard-sprints.component.html",
  styleUrls: ["./dashboard-sprints.component.css"],
})
export class DashboardSprintsComponent implements OnInit {
  // Lucide Icons
  Calendar = Calendar;
  Flag = Flag;
  Rocket = Rocket;
  Users = Users;
  Building2 = Building2;
  ArrowRight = ArrowRight;
  Layers = Layers;
  ChevronRight = ChevronRight;
  ChevronDown = ChevronDown;
  SlidersHorizontal = SlidersHorizontal;

  projets: Projet[] = [];
  jalons: Jalon[] = [];
  equipes: Equipe[] = [];
  charges: Charge[] = [];
  roles: Role[] = [];
  personnes: Personne[] = [];

  // Sprint selectors
  allSprints: Jalon[] = [];
  startSprintId: string = "";
  endSprintId: string = "";
  selectedSprints: SprintPeriod[] = [];

  // Group Mode
  groupMode: GroupMode = "equipe";

  // Grouped rows to render in the table
  groupedRows: GroupRow[] = [];

  // Header columns (can be sprints or teams depending on groupMode)
  columns: Array<{ id: string; label: string; sublabel?: string }> = [];

  // Footer milestones (LV/MEPs in the selected range)
  footerMilestones: Jalon[] = [];

  constructor(
    private projetService: ProjetService,
    private rolesService: RolesService,
    private personnesService: PersonnesService,
    private teamService: TeamService,
    private jalonService: JalonService,
    private chargeService: ChargeService,
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.loadProjects(),
      this.loadJalons(),
      this.loadResources(),
      this.loadOrganization(),
      this.loadCharges(),
    ]);
    this.initSprints();
    this.generateData();
  }

  async loadProjects() {
    try {
      this.projets = await this.projetService.getAllProjets();
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }

  async loadJalons() {
    try {
      this.jalons = await this.jalonService.getAllJalons();
    } catch (error) {
      console.error("Error loading jalons:", error);
    }
  }

  async loadResources() {
    try {
      this.roles = await this.rolesService.getAllRoles();
      this.personnes = await this.personnesService.getAllPersonnes();
    } catch (error) {
      console.error("Error loading resources:", error);
    }
  }

  async loadOrganization() {
    try {
      this.equipes = await this.teamService.getAllEquipes();
    } catch (error) {
      console.error("Error loading organization:", error);
    }
  }

  async loadCharges() {
    try {
      this.charges = await this.chargeService.getAllCharges();
    } catch (error) {
      console.error("Error loading charges:", error);
    }
  }

  initSprints() {
    // Sprints are jalons of type 'SP' sorted chronologically
    this.allSprints = this.jalons
      .filter((j) => j.type === "SP")
      .sort((a, b) => new Date(a.date_jalon).getTime() - new Date(b.date_jalon).getTime());

    if (this.allSprints.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the first upcoming sprint
    const upcomingIdx = this.allSprints.findIndex((s) => new Date(s.date_jalon) >= today);
    const startIdx = upcomingIdx !== -1 ? upcomingIdx : Math.max(0, this.allSprints.length - 5);
    const endIdx = Math.min(startIdx + 4, this.allSprints.length - 1);

    this.startSprintId = this.allSprints[startIdx]?.id || "";
    this.endSprintId = this.allSprints[endIdx]?.id || "";
  }

  // Called when sprint filters or group mode changes
  generateData() {
    if (this.allSprints.length === 0 || !this.startSprintId || !this.endSprintId) return;

    // 1. Get the list of sprints in the range
    const startIdx = this.allSprints.findIndex((s) => s.id === this.startSprintId);
    const endIdx = this.allSprints.findIndex((s) => s.id === this.endSprintId);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      return;
    }

    const rangeSprints = this.allSprints.slice(startIdx, endIdx + 1);

    // Build selectedSprints periods
    this.selectedSprints = rangeSprints.map((s) => {
      const idx = this.allSprints.findIndex((all) => all.id === s.id);
      let start: Date;
      if (idx > 0) {
        const prev = new Date(this.allSprints[idx - 1].date_jalon);
        start = new Date(prev);
        start.setDate(start.getDate() + 1);
      } else {
        const endD = new Date(s.date_jalon);
        start = new Date(endD);
        start.setDate(start.getDate() - 13);
      }
      start.setHours(0, 0, 0, 0);
      const end = new Date(s.date_jalon);
      end.setHours(23, 59, 59, 999);

      return {
        sprint: s,
        start,
        end,
        label: s.nom,
      };
    });

    // 2. Generate columns
    if (this.groupMode === "sprint") {
      // Columns are Teams (Équipes)
      this.columns = this.equipes.map((eq) => ({
        id: eq.id!,
        label: eq.nom,
        sublabel: eq.code || "",
      }));
    } else {
      // Columns are Sprints
      this.columns = this.selectedSprints.map((sp) => ({
        id: sp.sprint.id!,
        label: sp.sprint.nom,
        sublabel: this.formatDateLabel(sp.start, sp.end),
      }));
    }

    // 3. Generate grouped rows
    this.groupedRows = [];

    if (this.groupMode === "equipe") {
      this.generateGroupedByTeam();
    } else if (this.groupMode === "sprint") {
      this.generateGroupedBySprint();
    } else if (this.groupMode === "livraison") {
      this.generateGroupedByMilestone("LV");
    } else if (this.groupMode === "mep") {
      this.generateGroupedByMilestone("MEP");
    }

    // 4. Generate footer milestones
    if (this.selectedSprints.length > 0) {
      const rangeStart = this.selectedSprints[0].start;
      const rangeEnd = this.selectedSprints[this.selectedSprints.length - 1].end;

      this.footerMilestones = this.jalons
        .filter(
          (j) =>
            (j.type === "LV" || j.type === "MEP") &&
            new Date(j.date_jalon) >= rangeStart &&
            new Date(j.date_jalon) <= rangeEnd,
        )
        .sort((a, b) => new Date(a.date_jalon).getTime() - new Date(b.date_jalon).getTime());
    }
  }

  // --- Grouping implementations ---

  generateGroupedByTeam() {
    for (const team of this.equipes) {
      const subRows: GroupRow["subRows"] = [];
      let teamTotalCharge = 0;

      for (const project of this.projets) {
        const cells: CellData[] = [];
        let projectTotalCharge = 0;

        for (const sp of this.selectedSprints) {
          const jours = this.getChargeForSprintAndTeam(project.id!, team.id!, sp.start, sp.end);
          const colorClass = this.getColorClass(jours);
          const milestones = this.getMilestonesForProjectInPeriod(project.id!, sp.start, sp.end);

          cells.push({ jours, colorClass, milestones });
          projectTotalCharge += jours;
        }

        if (projectTotalCharge > 0) {
          subRows.push({
            projet: project,
            totalCharge: Math.round(projectTotalCharge * 10) / 10,
            cells,
          });
          teamTotalCharge += projectTotalCharge;
        }
      }

      if (subRows.length > 0) {
        this.groupedRows.push({
          id: team.id!,
          name: team.nom,
          code: team.code,
          color: team.color || "#3b82f6",
          extraInfo: `${subRows.length} projets • ${Math.round(teamTotalCharge * 10) / 10}j de charge`,
          expanded: true,
          totalCharge: Math.round(teamTotalCharge * 10) / 10,
          subRows,
        });
      }
    }
  }

  generateGroupedBySprint() {
    for (const sp of this.selectedSprints) {
      const subRows: GroupRow["subRows"] = [];
      let sprintTotalCharge = 0;

      for (const project of this.projets) {
        const cells: CellData[] = [];
        let projectTotalCharge = 0;

        for (const team of this.equipes) {
          const jours = this.getChargeForSprintAndTeam(project.id!, team.id!, sp.start, sp.end);
          const colorClass = this.getColorClass(jours);
          const milestones = this.getMilestonesForProjectInPeriod(project.id!, sp.start, sp.end);

          cells.push({ jours, colorClass, milestones });
          projectTotalCharge += jours;
        }

        if (projectTotalCharge > 0) {
          subRows.push({
            projet: project,
            totalCharge: Math.round(projectTotalCharge * 10) / 10,
            cells,
          });
          sprintTotalCharge += projectTotalCharge;
        }
      }

      if (subRows.length > 0) {
        this.groupedRows.push({
          id: sp.sprint.id!,
          name: sp.sprint.nom,
          extraInfo: `${subRows.length} projets • ${Math.round(sprintTotalCharge * 10) / 10}j de charge`,
          expanded: true,
          totalCharge: Math.round(sprintTotalCharge * 10) / 10,
          subRows,
        });
      }
    }
  }

  generateGroupedByMilestone(type: "LV" | "MEP") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetMilestones = this.jalons
      .filter((j) => j.type === type && new Date(j.date_jalon) >= today)
      .sort((a, b) => new Date(a.date_jalon).getTime() - new Date(b.date_jalon).getTime());

    for (let i = 0; i < targetMilestones.length; i++) {
      const ms = targetMilestones[i];
      const subRows: GroupRow["subRows"] = [];
      let milestoneTotalCharge = 0;

      // Define delivery period
      let periodStart = today;
      if (i > 0) {
        const prevDate = new Date(targetMilestones[i - 1].date_jalon);
        periodStart = new Date(prevDate);
        periodStart.setDate(periodStart.getDate() + 1);
        periodStart.setHours(0, 0, 0, 0);
      }
      const periodEnd = new Date(ms.date_jalon);
      periodEnd.setHours(23, 59, 59, 999);

      // Define selected sprints range
      const sprintsStart = this.selectedSprints[0].start;
      const sprintsEnd = this.selectedSprints[this.selectedSprints.length - 1].end;

      // Intersection of delivery period and selected sprints
      const checkStart = periodStart > sprintsStart ? periodStart : sprintsStart;
      const checkEnd = periodEnd < sprintsEnd ? periodEnd : sprintsEnd;

      for (const project of this.projets) {
        const isMainMilestoneTarget = ms.projet_id === project.id;
        
        let joursInPeriod = 0;
        if (checkStart <= checkEnd) {
          joursInPeriod = this.getChargeForSprint(project.id!, checkStart, checkEnd);
        }

        // Include project only if it has charges in the intersection period
        if (joursInPeriod <= 0) continue;

        const cells: CellData[] = [];
        let projectTotalCharge = 0;

        for (const sp of this.selectedSprints) {
          // Intersection of this sprint and the delivery period
          const cellStart = sp.start > periodStart ? sp.start : periodStart;
          const cellEnd = sp.end < periodEnd ? sp.end : periodEnd;

          let jours = 0;
          if (cellStart <= cellEnd) {
            jours = this.getChargeForSprint(project.id!, cellStart, cellEnd);
          }

          const colorClass = this.getColorClass(jours);
          const milestones = this.getMilestonesForProjectInPeriod(project.id!, sp.start, sp.end);

          cells.push({ jours, colorClass, milestones });
          projectTotalCharge += jours;
        }

        subRows.push({
          projet: project,
          totalCharge: Math.round(projectTotalCharge * 10) / 10,
          cells,
          isMainMilestoneTarget,
        });
        milestoneTotalCharge += projectTotalCharge;
      }

      if (subRows.length > 0) {
        // Sort subRows: primary target project first, then by totalCharge descending
        subRows.sort((a, b) => {
          if (a.isMainMilestoneTarget && !b.isMainMilestoneTarget) return -1;
          if (!a.isMainMilestoneTarget && b.isMainMilestoneTarget) return 1;
          return b.totalCharge - a.totalCharge;
        });

        const mainProj = this.projets.find((p) => p.id === ms.projet_id);
        const color = type === "LV" ? "#3b82f6" : "#10b981"; // Blue for Livraison, Green for MEP
        const groupName = `${type === "LV" ? "Livraison" : "MEP"} du ${this.formatSingleDate(ms.date_jalon)}`;
        const extraInfo = `${ms.nom}${mainProj ? " [" + mainProj.nom_projet + "]" : ""} • ${subRows.length} projets • ${Math.round(milestoneTotalCharge * 10) / 10}j total`;

        this.groupedRows.push({
          id: ms.id!,
          name: groupName,
          code: "",
          color: color,
          extraInfo: extraInfo,
          expanded: true,
          totalCharge: Math.round(milestoneTotalCharge * 10) / 10,
          subRows,
        });
      }
    }
  }

  // --- Calculation Helpers ---

  getChargeForSprintAndTeam(projetId: string, equipeId: string, sStart: Date, sEnd: Date): number {
    const teamProjCharges = this.charges.filter(
      (c) => c.projet_id === projetId && c.equipe_id === equipeId && c.semaine_debut,
    );
    let totalDays = 0;
    for (const c of teamProjCharges) {
      const joursParSem = this.getJoursParSemaine(c);
      const overlapDays = this.getOverlapWorkingDays(c.semaine_debut!, sStart, sEnd);
      const fraction = overlapDays / 5;
      totalDays += (c.unite_ressource || 0) * joursParSem * fraction;
    }
    return totalDays;
  }

  getChargeForSprint(projetId: string, sStart: Date, sEnd: Date): number {
    const projCharges = this.charges.filter((c) => c.projet_id === projetId && c.semaine_debut);
    let totalDays = 0;
    for (const c of projCharges) {
      const joursParSem = this.getJoursParSemaine(c);
      const overlapDays = this.getOverlapWorkingDays(c.semaine_debut!, sStart, sEnd);
      const fraction = overlapDays / 5;
      totalDays += (c.unite_ressource || 0) * joursParSem * fraction;
    }
    return totalDays;
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

  getMilestonesForProjectInPeriod(projetId: string, sStart: Date, sEnd: Date): Jalon[] {
    return this.jalons
      .filter(
        (j) =>
          j.projet_id === projetId &&
          (j.type === "LV" || j.type === "MEP") &&
          new Date(j.date_jalon) >= sStart &&
          new Date(j.date_jalon) <= sEnd,
      )
      .sort((a, b) => new Date(a.date_jalon).getTime() - new Date(b.date_jalon).getTime());
  }

  // --- UI Helpers ---

  getColorClass(jours: number): string {
    if (jours <= 0) return "none";
    if (jours < 10) return "green";
    if (jours <= 15) return "yellow";
    return "red";
  }

  getGaugeWidth(jours: number): number {
    // Scale where 20j represents 100% width
    return Math.min((jours / 20) * 100, 100);
  }

  toggleGroup(group: GroupRow) {
    group.expanded = !group.expanded;
  }

  changeGroupMode(mode: GroupMode) {
    this.groupMode = mode;
    this.generateData();
  }

  onSprintFilterChange() {
    this.generateData();
  }

  getProjectName(projetId?: string): string | null {
    if (!projetId) return null;
    const projet = this.projets.find((p) => p.id === projetId);
    return projet?.nom_projet || null;
  }

  // --- Date Formatting Helpers ---

  formatDateLabel(start: Date, end: Date): string {
    const startDay = start.getDate();
    const startMonth = start.toLocaleDateString("fr-FR", { month: "short" });
    const endDay = end.getDate();
    const endMonth = end.toLocaleDateString("fr-FR", { month: "short" });
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }

  formatSingleDate(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString("fr-FR", { month: "short" });
    return `${day} ${month}`;
  }

  formatDateYear(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString("fr-FR", { month: "short" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  formatDateDDMM(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  }

  getSprintOptionLabel(s: Jalon): string {
    const name = s.nom || "";
    const date = this.formatDateDDMM(s.date_jalon);
    const targetLength = 12;
    const paddingNeeded = Math.max(0, targetLength - name.length);
    const paddedName = name + "\u00A0".repeat(paddingNeeded);
    return `${paddedName} (${date})`;
  }

  getActiveProjectsCount(): number {
    const projectIds = new Set<string>();
    for (const group of this.groupedRows) {
      for (const row of group.subRows) {
        if (row.projet.id) {
          projectIds.add(row.projet.id);
        }
      }
    }
    return projectIds.size;
  }
}
