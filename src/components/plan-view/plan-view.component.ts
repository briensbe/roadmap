import { Component, OnInit, ViewChild, ElementRef, HostListener, NgModule, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, OnDestroy, computed } from "@angular/core";
import { CommonModule, NgIf, NgFor } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../../services/team.service";
import { ProjetService } from "../../services/projet.service";
import { ChargeService } from "../../services/charge.service";
import { RolesService } from "../../services/roles.service";
import { JalonService } from "../../services/jalon.service";
import { Equipe, Projet, Charge, Role, Personne, Capacite, Jalon } from "../../models/types";
import { CalendarService } from "../../services/calendar.service";
import { PersonnesService } from "../../services/personnes.service";

import { LucideAngularModule, Plus, ChevronDown, ChevronRight, User, Contact, X, SquarePlus, SquareMinus, ExternalLink, FunnelPlus, FunnelX } from "lucide-angular";
import { getISOWeekYear } from "date-fns";
import { calculateBestToolbarPosition, calculateBestPopoverPosition, ToolbarPosition, PopoverPosition } from "../../utils/selection-positioning";
import { SelectionToolbarComponent } from "../selection-toolbar.component";
import { ProjectModalComponent } from "../project-modal.component";
import { SettingsService } from "../../services/settings.service";
import { storageSignal } from "../../utils/storage-signal";
import { signal } from "@angular/core";
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { calculateNewRank, sortByRank } from '../../utils/lexorank.utils';

@NgModule({
  imports: [LucideAngularModule.pick({ Plus, ChevronDown, ChevronRight, User, Contact, X, SquarePlus, SquareMinus, ExternalLink, FunnelPlus, FunnelX })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

import { MilestoneModalComponent } from '../milestone-modal.component';
import { ConfirmModalComponent } from '../confirm-modal.component';

interface ResourceCellData {
  value: number;
  availability: number;
  showAvailability: boolean;
  isPositive: boolean;
  isZero: boolean;
  isNegative: boolean;
  hasCapRecord: boolean;
}

interface ResourceRow {
  id: string;
  uniqueId: string; // Unique identifier combining parent, child, and resource context
  label: string;
  type: "role" | "personne";
  jours_par_semaine: number;
  charges: Map<string, number>; // week string -> amount
  color?: string;
  resourceId?: string; // Always the role or personne id
  projectId?: string; // Always the project id
  cellData?: ResourceCellData[];
}

interface ChildRow {
  id: string;
  label: string;
  code?: string;
  color?: string;
  expanded: boolean;
  resources: ResourceRow[];
  charges: Map<string, number>; // week string -> amount
}

interface ParentRow {
  id: string;
  label: string;
  code?: string;
  color?: string;
  expanded: boolean;
  children: ChildRow[];
  totalCharges: Map<string, number>; // week string -> amount
  originalProject?: Projet;
}

interface FlatRow {
  uniqueId: string;
  fullLabel: string; // "Project > Team > Resource"
  resource: ResourceRow;
  child: ChildRow;
  parent: ParentRow;
}

@Component({
  selector: "app-plan-view",
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule, LucideIconsModule, MilestoneModalComponent, SelectionToolbarComponent, ConfirmModalComponent, ProjectModalComponent, DragDropModule],
  templateUrl: "./plan-view.component.html",
  styleUrl: "./plan-view.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanViewComponent implements OnInit, OnDestroy {
  @ViewChild('tooltipElement') tooltipElement?: ElementRef<HTMLElement>;

  // Milestone Modal props
  showMilestoneModal = false;
  selectedJalon: Jalon | null = null;

  openMilestoneModal(jalon: Jalon, event: Event) {
    event.stopPropagation();
    this.selectedJalon = jalon;
    this.showMilestoneModal = true;
  }

  async onMilestoneSaved() {
    await this.loadData();
  }

  viewMode = storageSignal<"project" | "team" | "resource">("plan-view-mode", "resource");
  displayFormat = storageSignal<"tree" | "flat">("plan-view-display-format", "tree");
  showAvailability = storageSignal<boolean>("plan-view-show-availability", false);
  weekFilters = storageSignal<number[]>("plan-view-week-filters", []);
  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();

  selectedCapacityYear: 'all' | '2025' | '2026' | 'custom' = 'all';
  private globalMouseMoveListener?: () => void;

  selectedStartDate: Date | null = null;
  showYearPopover = false;
  popoverPosition: PopoverPosition | null = null;
  popoverArrowSide: 'top' | 'bottom' = 'top';
  activeAnchorId: string | null = null;

  labelColumnWidth = storageSignal<number>("plan-view-label-column-width", 300);
  isResizing = false;
  private startX = 0;
  private startWidth = 0;

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.labelColumnWidth();
  }

  @HostListener("document:mousemove", ["$event"])
  onResizing(event: MouseEvent) {
    if (!this.isResizing) return;
    const deltaX = event.clientX - this.startX;
    const newWidth = Math.max(150, Math.min(600, this.startWidth + deltaX));
    this.labelColumnWidth.set(newWidth);
  }

  @HostListener("document:mouseup")
  onResizeEnd() {
    this.isResizing = false;
  }

  flatRows: FlatRow[] = [];

  // Usage Map
  usageMap: Map<string, number> = new Map();

  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  rows: ParentRow[] = [];

  allProjects: Projet[] = [];
  allCharges: Charge[] = [];
  allJalons: Jalon[] = [];

  // Sexy Tooltip State
  activeTooltip: string | null = null;
  tooltipX = 0;
  tooltipY = 0;
  private tooltipShowTimer: any;
  private tooltipHideTimer: any;
  private readonly SHOW_DELAY = 400;
  private readonly HIDE_DELAY = 100;

  allEquipes: Equipe[] = [];
  // Duplicate removed

  allCapacities: Capacite[] = [];
  allLinks: { equipe_id: string; projet_id: string }[] = [];
  allRoleAttachments: any[] = [];

  // Filters
  rowsAll: ParentRow[] = [];
  filterEquipeIds = storageSignal<string[]>("plan-view-filter-equipes", []);
  filterProjetIds = storageSignal<string[]>("plan-view-filter-projets", []);
  filterProjetSearch = storageSignal<string>("plan-view-filter-search", "");
  filterResourceIds = storageSignal<string[]>("plan-view-filter-resources", []); // values like 'role:<id>' or 'personne:<id>'

  // Dropdown states
  openEquipeDropdown = false;
  openProjetDropdown = false;
  openResourceDropdown = false;

  // Link Modal State
  showLinkModal = false;
  selectedParentRow: ParentRow | null = null;
  selectedChildRowToLink: ChildRow | null = null;
  linkableItems: { id: string; label: string; type?: 'role' | 'personne' }[] = [];
  selectedIdToLink: string = "";

  // Resource Modal State
  showAddResourceModal = false;
  selectedChildRow: ChildRow | null = null;
  selectedParentForResource: ParentRow | null = null;
  resourceTypeToAdd: "role" | "personne" = "role";
  selectedResourceId: string = "";
  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  // Drag selection
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  private dragStartChild?: ChildRow;
  private dragStartParent?: ParentRow;

  dragStartWeekIndex: number = -1;
  dragEndWeekIndex: number = -1;
  selectedCells: Array<{ resource: ResourceRow; week: Date; childId: string; parentId: string }> = [];
  isSelectionFinished: boolean = false;
  toolbarPosition: ToolbarPosition | null = null;
  toolbarVisible: boolean = false; // Controls opacity to prevent flash

  bulkChargeValue: number | null = null;
  isSaving = false;


  // Confirm Modal state
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingConfirmAction: (() => void) | null = null;

  onConfirmAction() {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
  }

  // Icons
  Plus = Plus;
  X = X;
  Contact = Contact;
  User = User;

  constructor(
    private teamService: TeamService,
    private projetService: ProjetService,
    private chargeService: ChargeService,
    private rolesService: RolesService,
    private calendarService: CalendarService,
    private jalonService: JalonService,
    private settingsService: SettingsService,
    private personnesService: PersonnesService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }


  expandAll() {
    this.isDefaultExpanded = true;
    this.manualStates.clear();
    this.rows.forEach(r => {
      r.expanded = true;
      r.children.forEach(c => c.expanded = true);
    });
  }

  collapseAll() {
    this.isDefaultExpanded = false;
    this.manualStates.clear();
    this.rows.forEach(r => {
      r.expanded = false;
      r.children.forEach(c => c.expanded = false);
    });
  }

  private externalReferenceUrlQuery = this.settingsService.getSettingQuery("external_reference_url", "global");
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);

  ngOnInit() {
    this.loadData();
    this.generateWeeks();

    this.ngZone.runOutsideAngular(() => {
      const listener = (event: MouseEvent) => this.onGlobalMouseMove(event);
      window.addEventListener('mousemove', listener);
      this.globalMouseMoveListener = () => window.removeEventListener('mousemove', listener);
    });
  }

  ngOnDestroy() {
    if (this.globalMouseMoveListener) {
      this.globalMouseMoveListener();
    }
  }


  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.calendarService.getWeekStart(startDate);

    const NB_WEEKS_TO_DISPLAY = 53; // un an par défaut (besoin de 53 semaines pour couvrir 2026)
    for (let i = 0; i < NB_WEEKS_TO_DISPLAY; i++) {
      const week = new Date(firstWeek);
      week.setDate(week.getDate() + i * 7);
      this.displayedWeeks.push(week);
    }
  }

  async loadData() {
    try {
      const [equipes, charges, projects, roles, personnes, jalons, links, roleAttachments, capacities] = await Promise.all([
        this.teamService.getAllEquipes(),
        this.chargeService.getAllCharges(),
        this.projetService.getAllProjets(),
        this.rolesService.getAllRoles(),
        this.personnesService.getAllPersonnes(),
        this.jalonService.getAllJalons(),
        this.projetService.getAllEquipeProjetLinks(),
        this.rolesService.getAllRoleAttachments(),
        this.teamService.getAllCapacities()
      ]);

      this.allEquipes = equipes;
      this.allCharges = charges;
      this.allProjects = projects;
      this.availableRoles = roles;
      this.availablePersonnes = personnes;
      this.allJalons = jalons;
      this.allLinks = links;
      this.allRoleAttachments = roleAttachments;
      this.allCapacities = capacities;

      this.buildTree();
      this.cdr.markForCheck();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  precalculateResources() {
    this.rowsAll.forEach(parent => {
      // In resource mode, parent.id is `${team.id}_${rKey}`.
      // In team mode, parent.id is just `${team.id}`.
      const teamIdFromParent = this.viewMode() === 'resource' ? parent.id.split('_')[0] : parent.id;

      parent.children.forEach(child => {
        // In project mode, children are teams, so teamId is child.id
        // In team/resource mode, teamId comes from parent
        const teamId = this.viewMode() === 'project' ? child.id : teamIdFromParent;

        child.resources.forEach(resource => {
          this.precalculateResource(resource, teamId);
        });
      });
    });
  }

  precalculateResource(resource: ResourceRow, teamId: string) {
    resource.cellData = [];
    for (const week of this.displayedWeeks) {
      const value = this.getResourceValue(resource, week);
      const availability = this.getAvailability(resource, week, teamId);

      const weekKey = week.toISOString().split("T")[0];
      const hasCapRecord = this.allCapacities.some(c =>
        c.equipe_id === teamId &&
        c.semaine_debut.startsWith(weekKey) &&
        (resource.type === 'role' ? c.role_id === (resource.resourceId || resource.id) : c.personne_id === (resource.resourceId || resource.id))
      );

      // Relevance check for persons
      let isRelevant = true;
      if (resource.type === "personne") {
        const personne = this.availablePersonnes.find((p) => p.id === (resource.resourceId || resource.id));
        isRelevant = personne ? personne.equipe_id === teamId : false;
      }

      resource.cellData.push({
        value,
        availability,
        showAvailability: isRelevant,
        isPositive: availability > 0,
        isZero: availability === 0,
        isNegative: availability < 0,
        hasCapRecord: hasCapRecord
      });
    }
  }


  private shouldShowAvailabilityInternal(resource: ResourceRow, week: Date, teamId: string): boolean {
    // Exact same logic as shouldShowAvailability but without the this.showAvailability() check
    if (resource.type === "role") return true;
    const personne = this.availablePersonnes.find((p) => p.id === resource.id);
    if (!personne) return false;
    return personne.equipe_id === teamId;
  }


  getJalonsForWeek(week: Date): Jalon[] {
    const startOfWeek = new Date(week);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.allJalons.filter(j => {
      const jDate = new Date(j.date_jalon);
      return jDate >= startOfWeek && jDate <= endOfWeek;
    });
  }

  getJalonColor(type: string): string {
    switch (type) {
      case 'LV': return '#d1fae5'; // Green
      case 'MEP': return '#dbeafe'; // Blue
      case 'SP': return '#fef3c7'; // Amber
      default: return '#f3f4f6'; // Gray
    }
  }

  getJalonTextColor(type: string): string {
    switch (type) {
      case 'LV': return '#065f46';
      case 'MEP': return '#1e40af';
      case 'SP': return '#92400e';
      default: return '#4b5563';
    }
  }

  calculateUsage() {
    this.usageMap.clear();

    for (const charge of this.allCharges) {
      if (!charge.semaine_debut || !charge.equipe_id) continue;

      const weekKey = charge.semaine_debut.split("T")[0];
      const teamId = charge.equipe_id;

      let resourceKey = "";
      if (charge.role_id) {
        resourceKey = `role_${charge.role_id}`;
      } else if (charge.personne_id) {
        resourceKey = `personne_${charge.personne_id}`;
      } else {
        continue;
      }

      const mapKey = `${teamId}_${resourceKey}_${weekKey}`;
      const currentVal = this.usageMap.get(mapKey) || 0;
      this.usageMap.set(mapKey, currentVal + charge.unite_ressource);
    }
  }

  getAvailability(resource: ResourceRow, week: Date, teamId: string): number {
    const weekKey = week.toISOString().split("T")[0];
    const rId = resource.resourceId || resource.id;
    const resourceKey = `${resource.type}_${rId}`;
    const mapKey = `${teamId}_${resourceKey}_${weekKey}`;

    const usage = this.usageMap.get(mapKey) || 0;

    // Find custom capacity if exists
    // We look for a capacity record for this resource, this team, this week
    const customCap = this.allCapacities.find(c =>
      c.equipe_id === teamId &&
      c.semaine_debut.startsWith(weekKey) &&
      (resource.type === 'role' ? c.role_id === rId : c.personne_id === rId)
    );

    const totalCapacity = customCap ? customCap.capacite : 0;

    return totalCapacity - usage;
  }

  shouldShowAvailability(resource: ResourceRow, week: Date, teamId: string): boolean {
    const charge = this.getResourceValue(resource, week);
    if (charge > 0) return true;
    if (!this.showAvailability()) return false;

    const availability = this.getAvailability(resource, week, teamId);
    if (availability !== 0) return true;

    // Check if a capacity record actually exists for this resource/team/week
    const weekKey = week.toISOString().split("T")[0];
    return this.allCapacities.some(c =>
      c.equipe_id === teamId &&
      c.semaine_debut.startsWith(weekKey) &&
      (resource.type === 'role' ? c.role_id === resource.id : c.personne_id === resource.id)
    );
  }

  switchViewMode(mode: "project" | "team" | "resource") {
    this.viewMode.set(mode);
    this.buildTree();
  }


  async drop(event: CdkDragDrop<any[]>) {
    if (this.viewMode() !== 'project' || this.displayFormat() !== 'tree') return;

    // Move in UI first for responsiveness
    moveItemInArray(this.rows, event.previousIndex, event.currentIndex);

    const movedItem = this.rows[event.currentIndex];
    if (!movedItem.originalProject) return;

    try {
      // Calculate new rank using utility function
      const rankStr = calculateNewRank(
        this.rows,
        event.currentIndex,
        (row) => row.originalProject?.rank
      );

      movedItem.originalProject.rank = rankStr;

      // Update in database
      await this.projetService.updateProjet(movedItem.id, { rank: rankStr });

    } catch (error) {
      console.error('Error calculating rank:', error);
      // Fallback: reload to reset order if calculation failed
      this.loadData();
    }
  }

  buildTree() {
    this.rows = [];
    // Restore expanded state if re-building (optional, good UX)
    // For now reset to closed or keep simple.

    if (this.viewMode() === "project") {
      // Parent = Project, Child = Team, GrandChild = Resource
      // Sort projects by rank using utility function
      const sortedProjects = sortByRank(
        this.allProjects,
        (p) => p.rank,
        (a, b) => a.nom_projet.localeCompare(b.nom_projet)
      );

      for (const project of sortedProjects) {
        const projectCharges = this.allCharges.filter((c) => c.projet_id === project.id);

        // Find all teams involved in this project (via charges OR links)
        const chargeTeamIds = projectCharges.map((c) => c.equipe_id).filter((id) => !!id);
        const linkedTeamIds = this.allLinks.filter((l) => l.projet_id === project.id).map((l) => l.equipe_id);

        const involvedTeamIds = new Set([...chargeTeamIds, ...linkedTeamIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedTeamIds.forEach((teamId) => {
          const team = this.allEquipes.find((e) => e.id === teamId);
          const label = team ? team.nom : "No Team";
          const color = team ? team.color : undefined;
          const code = team ? team.code : undefined;
          const teamCharges = new Map<string, number>();

          // Get charges for this team on this project
          const teamProjectCharges = projectCharges.filter((c) => c.equipe_id === teamId);

          // Build resources for this team
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach((charge) => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: "role" | "personne";
            let joursParSemaine = 0;
            let resourceColor: string | undefined;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find((r) => r.id === charge.role_id);
              resourceLabel = role ? role.nom : "Unknown Role";
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = "role";
              resourceColor = role?.color;
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find((p) => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : "Unknown Person";
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = "personne";
              resourceColor = personne?.color;
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${project.id}_${teamId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || "",
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>(),
                color: resourceColor,
                resourceId: charge.role_id || charge.personne_id || "",
                projectId: project.id
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split("T")[0];
              const val = resource.charges.get(weekKey) || 0;
              resource.charges.set(weekKey, val + charge.unite_ressource);

              // Add to team total
              const teamVal = teamCharges.get(weekKey) || 0;
              teamCharges.set(weekKey, teamVal + charge.unite_ressource);

              // Add to parent total
              const pVal = parentTotal.get(weekKey) || 0;
              parentTotal.set(weekKey, pVal + charge.unite_ressource);
            }
          });

          resources.push(...resourceMap.values());

          // Apply week filters to resources
          const filteredResources = resources.filter(r => this.shouldShowResource(r));

          children.push({
            id: teamId!,
            label: label,
            code: code,
            color: color,
            expanded: this.manualStates.has(`${project.id}_${teamId}`) ? this.manualStates.get(`${project.id}_${teamId}`)! : this.isDefaultExpanded, // Respect persisted preference
            resources: filteredResources,
            charges: teamCharges,
          });
        });

        // Sort children (teams) alphabetically
        children.sort((a, b) => a.label.localeCompare(b.label));

        // Sort resources within each child alphabetically
        children.forEach((child) => {
          child.resources.sort((a, b) => a.label.localeCompare(b.label));
        });

        this.rows.push({
          id: project.id!,
          label: project.nom_projet,
          code: project.code_projet,
          color: project.color,
          expanded: this.manualStates.has(project.id!) ? this.manualStates.get(project.id!)! : this.isDefaultExpanded, // Respect persisted preference
          children: children,
          totalCharges: parentTotal,
          originalProject: project,
        });
      }
    } else if (this.viewMode() === "team") {
      // Parent = Team, Child = Project, GrandChild = Resource
      // Sort teams alphabetically
      const sortedTeams = [...this.allEquipes].sort((a, b) => a.nom.localeCompare(b.nom));

      for (const team of sortedTeams) {
        const teamCharges = this.allCharges.filter((c) => c.equipe_id === team.id);

        // Find all projects this team is working on (via charges OR links)
        const chargeProjectIds = teamCharges.map((c) => c.projet_id).filter((id) => !!id);
        const linkedProjectIds = this.allLinks.filter((l) => l.equipe_id === team.id).map((l) => l.projet_id);

        const involvedProjectIds = new Set([...chargeProjectIds, ...linkedProjectIds]);

        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        involvedProjectIds.forEach((projectId) => {
          const project = this.allProjects.find((p) => p.id === projectId);
          const label = project ? project.nom_projet : "Unknown Project";
          const color = project ? project.color : undefined;
          const code = project ? project.code_projet : undefined;
          const projectCharges = new Map<string, number>();

          // Get charges for this project on this team
          const teamProjectCharges = teamCharges.filter((c) => c.projet_id === projectId);

          // Build resources for this project
          const resources: ResourceRow[] = [];
          const resourceMap = new Map<string, ResourceRow>();

          teamProjectCharges.forEach((charge) => {
            let resourceKey: string;
            let resourceLabel: string;
            let resourceType: "role" | "personne";
            let joursParSemaine = 0;
            let resourceColor: string | undefined;

            if (charge.role_id) {
              resourceKey = `role_${charge.role_id}`;
              const role = this.availableRoles.find((r) => r.id === charge.role_id);
              resourceLabel = role ? role.nom : "Unknown Role";
              joursParSemaine = role?.jours_par_semaine || 0;
              resourceType = "role";
              resourceColor = role?.color;
            } else if (charge.personne_id) {
              resourceKey = `personne_${charge.personne_id}`;
              const personne = this.availablePersonnes.find((p) => p.id === charge.personne_id);
              resourceLabel = personne ? `${personne.prenom} ${personne.nom}` : "Unknown Person";
              joursParSemaine = personne?.jours_par_semaine || 0;
              resourceType = "personne";
              resourceColor = personne?.color;
            } else {
              return; // Skip charges without resource
            }

            if (!resourceMap.has(resourceKey)) {
              const uniqueId = `${team.id}_${projectId}_${charge.role_id || charge.personne_id}_${resourceType}`;
              resourceMap.set(resourceKey, {
                id: charge.role_id || charge.personne_id || "",
                uniqueId: uniqueId,
                label: resourceLabel,
                type: resourceType,
                jours_par_semaine: joursParSemaine,
                charges: new Map<string, number>(),
                color: resourceColor,
                resourceId: charge.role_id || charge.personne_id || "",
                projectId: projectId
              });
            }

            const resource = resourceMap.get(resourceKey)!;

            // Add charge to resource if it has dates
            if (charge.semaine_debut) {
              const weekKey = charge.semaine_debut.split("T")[0];
              const val = resource.charges.get(weekKey) || 0;
              resource.charges.set(weekKey, val + charge.unite_ressource);

              // Add to project total
              const projVal = projectCharges.get(weekKey) || 0;
              projectCharges.set(weekKey, projVal + charge.unite_ressource);

              // Add to parent total
              const pVal = parentTotal.get(weekKey) || 0;
              parentTotal.set(weekKey, pVal + charge.unite_ressource);
            }
          });

          resources.push(...resourceMap.values());

          // Apply week filters to resources
          const filteredResources = resources.filter(r => this.shouldShowResource(r));

          children.push({
            id: projectId!,
            label: label,
            code: code,
            color: color,
            expanded: this.manualStates.has(`${team.id}_${projectId}`) ? this.manualStates.get(`${team.id}_${projectId}`)! : this.isDefaultExpanded, // Respect persisted preference
            resources: filteredResources,
            charges: projectCharges,
          });
        });

        // Sort children (projects) alphabetically
        children.sort((a, b) => a.label.localeCompare(b.label));

        // Sort resources within each child alphabetically
        children.forEach((child) => {
          child.resources.sort((a, b) => a.label.localeCompare(b.label));
        });

        this.rows.push({
          id: team.id!,
          label: team.nom,
          code: team.code,
          color: team.color,
          expanded: this.manualStates.has(team.id!) ? this.manualStates.get(team.id!)! : this.isDefaultExpanded, // Respect persisted preference
          children: children,
          totalCharges: parentTotal,
        });
      }
    } else if (this.viewMode() === "resource") {
      // Parent = Team, Child = Resource, GrandChild = Project
      const sortedTeams = [...this.allEquipes].sort((a, b) => a.nom.localeCompare(b.nom));

      for (const team of sortedTeams) {
        const teamCharges = this.allCharges.filter(c => c.equipe_id === team.id);
        const children: ChildRow[] = [];
        const parentTotal = new Map<string, number>();

        // We need to identify ALL resources for this team
        // Logic: resources present in charges OR potentially all team members if linked
        // For now, let's use charges to identify active resources
        const resourceMap = new Map<string, { label: string, type: 'role' | 'personne', jours_par_semaine: number, color?: string, charges: Map<string, number>, projectDetailedMap: Map<string, ResourceRow> }>();

        // Pre-populate with all resources linked to this team
        // Roles
        this.allRoleAttachments
          .filter(a => a.equipe_id === team.id)
          .forEach(att => {
            const role = this.availableRoles.find(r => r.id === att.role_id);
            if (role) {
              const rKey = `role_${role.id}`;
              resourceMap.set(rKey, {
                label: role.nom,
                type: 'role',
                jours_par_semaine: role.jours_par_semaine,
                color: role.color,
                charges: new Map(),
                projectDetailedMap: new Map()
              });
            }
          });
        // Persons
        this.availablePersonnes
          .filter(p => p.equipe_id === team.id)
          .forEach(p => {
            const rKey = `personne_${p.id}`;
            resourceMap.set(rKey, {
              label: `${p.prenom} ${p.nom}`,
              type: 'personne',
              jours_par_semaine: p.jours_par_semaine,
              color: p.color,
              charges: new Map(),
              projectDetailedMap: new Map()
            });
          });

        teamCharges.forEach(charge => {
          let rKey: string;
          if (charge.role_id) {
            rKey = `role_${charge.role_id}`;
          } else if (charge.personne_id) {
            rKey = `personne_${charge.personne_id}`;
          } else return;

          if (!resourceMap.has(rKey)) {
            // This should not happen now as we pre-populated, but for safety:
            let rLabel: string;
            let rType: 'role' | 'personne';
            let rJours: number = 0;
            let rColor: string | undefined;

            if (charge.role_id) {
              const role = this.availableRoles.find(r => r.id === charge.role_id);
              rLabel = role ? role.nom : "Unknown Role";
              rJours = role?.jours_par_semaine || 0;
              rType = 'role';
              rColor = role?.color;
            } else {
              const p = this.availablePersonnes.find(pers => pers.id === charge.personne_id);
              rLabel = p ? `${p.prenom} ${p.nom}` : "Unknown Person";
              rJours = p?.jours_par_semaine || 0;
              rType = 'personne';
              rColor = p?.color;
            }

            resourceMap.set(rKey, {
              label: rLabel,
              type: rType,
              jours_par_semaine: rJours,
              color: rColor,
              charges: new Map(),
              projectDetailedMap: new Map()
            });
          }

          const res = resourceMap.get(rKey)!;
          const weekKey = charge.semaine_debut?.split("T")[0];

          // Detailed project row - ensure it exists if there is a projet_id
          const pId = charge.projet_id || "no_project";
          if (!res.projectDetailedMap.has(pId)) {
            const project = this.allProjects.find(p => p.id === pId);
            res.projectDetailedMap.set(pId, {
              id: pId,
              uniqueId: `${team.id}_${rKey}_${pId}`,
              label: project ? project.nom_projet : "Sans projet",
              type: res.type,
              jours_par_semaine: res.jours_par_semaine,
              charges: new Map(),
              color: project?.color,
              resourceId: rKey.split('_')[1],
              projectId: pId
            });
          }

          if (weekKey) {
            // Aggregate in resource overview
            const cur = res.charges.get(weekKey) || 0;
            res.charges.set(weekKey, cur + charge.unite_ressource);

            // Parent total
            const pCur = parentTotal.get(weekKey) || 0;
            parentTotal.set(weekKey, pCur + charge.unite_ressource);

            const detRow = res.projectDetailedMap.get(pId)!;
            const detCur = detRow.charges.get(weekKey) || 0;
            detRow.charges.set(weekKey, detCur + charge.unite_ressource);
          }
        });

        // In resource mode, we flatten Team and Resource into single level ParentRows
        resourceMap.forEach((res, rKey) => {
          const projectResources = Array.from(res.projectDetailedMap.values()).sort((a, b) => a.label.localeCompare(b.label));

          // Apply week filters to project resources
          const filteredProjectResources = projectResources.filter(r => this.shouldShowResource(r));

          this.rows.push({
            id: `${team.id}_${rKey}`,
            label: `${team.nom} - ${res.label}`,
            code: team.code,
            color: team.color,
            expanded: this.manualStates.has(`${team.id}_${rKey}`) ? this.manualStates.get(`${team.id}_${rKey}`)! : this.isDefaultExpanded,
            children: [
              {
                id: rKey,
                label: res.label,
                color: res.color,
                expanded: true, // Auto-expand this dummy level to show projects
                charges: res.charges,
                resources: filteredProjectResources
              }
            ],
            totalCharges: res.charges,
          });
        });
      }
    }

    // Keep a copy of unfiltered rows and apply active filters
    this.calculateUsage(); // Ensure usage is fresh
    this.rowsAll = [...this.rows];
    this.precalculateResources();
    this.applyFilters();
  }

  toggleDisplayFormat(format: "tree" | "flat") {
    this.displayFormat.set(format);
  }

  buildFlatList() {
    this.flatRows = [];

    // Iterate over the currently filtered rows (this.rows)
    for (const parent of this.rows) {
      for (const child of parent.children) {
        for (const resource of child.resources) {
          let label = "";
          if (this.viewMode() === "project") {
            // Project > Team > Resource
            label = `${parent.label} / ${child.label} / ${resource.label}`;
          } else if (this.viewMode() === "team") {
            // Team > Project > Resource
            label = `${parent.label} / ${child.label} / ${resource.label}`;
          } else {
            // Team > Resource > Project
            label = `${parent.label} / ${child.label} / ${resource.label}`;
          }

          this.flatRows.push({
            uniqueId: resource.uniqueId,
            fullLabel: label,
            resource: resource,
            child: child,
            parent: parent
          });
        }
      }
    }

    // Sort flattened rows alphabetically by full label
    this.flatRows.sort((a, b) => a.fullLabel.localeCompare(b.fullLabel));
  }

  // Week Filter Methods
  toggleWeekFilter(weekIndex: number) {
    const current = this.weekFilters();
    const index = current.indexOf(weekIndex);

    if (index > -1) {
      // Remove filter
      this.weekFilters.set(current.filter(i => i !== weekIndex));
    } else {
      // Add filter
      this.weekFilters.set([...current, weekIndex]);
    }

    // Rebuild tree/flat list with new filters
    this.buildTree();
    this.buildFlatList();
    this.cdr.markForCheck();
  }

  clearAllWeekFilters() {
    this.weekFilters.set([]);
    this.buildTree();
    this.buildFlatList();
    this.cdr.markForCheck();
  }

  isWeekFiltered(weekIndex: number): boolean {
    return this.weekFilters().includes(weekIndex);
  }

  getFilteredWeekCount(): number {
    return this.weekFilters().length;
  }

  shouldShowResource(resource: ResourceRow): boolean {
    const filters = this.weekFilters();

    // No filters active - show all resources
    if (filters.length === 0) {
      return true;
    }

    // Check if resource has charges for ALL filtered weeks
    for (const weekIndex of filters) {
      const week = this.displayedWeeks[weekIndex];
      if (!week) continue;

      const weekKey = week.toISOString().split("T")[0];
      const charge = resource.charges.get(weekKey) || 0;

      // If resource has no charge for this filtered week, hide it
      if (charge === 0) {
        return false;
      }
    }

    return true;
  }


  goToToday() {
    this.currentDate = new Date();
    this.generateWeeks();
    this.precalculateResources();
    this.cdr.markForCheck();
  }

  goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateWeeks();
    this.precalculateResources();
    this.cdr.markForCheck();
  }

  goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateWeeks();
    this.precalculateResources();
    this.cdr.markForCheck();
  }

  toggleRow(row: ParentRow) {
    row.expanded = !row.expanded;
    this.manualStates.set(row.id, row.expanded);

    // In resource view, the child level is a hidden dummy intermediary.
    // Sync children expanded state so resources behind *ngIf="child.expanded" are shown.
    if (this.viewMode() === 'resource') {
      row.children.forEach(c => c.expanded = row.expanded);
    }
  }

  toggleChild(child: ChildRow, parent: ParentRow) {
    child.expanded = !child.expanded;
    this.manualStates.set(`${parent.id}_${child.id}`, child.expanded);
  }

  formatWeekHeader(date: Date): string {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    return this.calendarService.isCurrentWeek(date);
  }

  getParentTotal(row: ParentRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return row.totalCharges.get(weekKey) || 0;
  }

  /**
   * Calculate cumulative capacity for a parent row in Resource view.
   * In Resource mode, parent.id is `${team.id}_${rKey}` where rKey is role_xxx or personne_xxx.
   */
  getParentCapacity(row: ParentRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    const parts = row.id.split('_');
    if (parts.length < 2) return 0;

    const teamId = parts[0];
    const resourceType = parts[1]; // 'role' or 'personne'
    const resourceId = parts.slice(2).join('_'); // Handle IDs with underscores

    // Find matching capacity record
    const cap = this.allCapacities.find(c =>
      c.equipe_id === teamId &&
      c.semaine_debut.startsWith(weekKey) &&
      (resourceType === 'role' ? c.role_id === resourceId : c.personne_id === resourceId)
    );

    return cap ? cap.capacite : 0;
  }

  /**
   * Calculate cumulative availability for a parent row in Resource view.
   */
  getParentAvailability(row: ParentRow, week: Date): number {
    const capacity = this.getParentCapacity(row, week);
    const charges = this.getParentTotal(row, week);
    return capacity - charges;
  }

  /**
   * Get availability status for color indication.
   * Returns 'positive', 'zero', 'negative', or 'none' (no data).
   */
  getParentAvailabilityStatus(row: ParentRow, week: Date): 'positive' | 'zero' | 'negative' | 'none' {
    const capacity = this.getParentCapacity(row, week);
    const charges = this.getParentTotal(row, week);

    // If neither capacity nor charges exist for this week, return 'none'
    if (capacity === 0 && charges === 0) {
      return 'none';
    }

    const availability = capacity - charges;
    if (availability > 0) return 'positive';
    if (availability === 0) return 'zero';
    return 'negative';
  }

  getChildValue(child: ChildRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return child.charges.get(weekKey) || 0;
  }

  getResourceValue(resource: ResourceRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return resource.charges.get(weekKey) || 0;
  }

  // Modal & Linking Logic
  openLinkModal(row: ParentRow, child?: ChildRow) {
    this.selectedParentRow = row;
    this.selectedChildRowToLink = child || null;
    this.selectedIdToLink = "";

    if (this.viewMode() === "project") {
      // Parent is Project, we want to add Teams
      const existingChildIds = new Set(row.children.map((c) => c.id));
      this.linkableItems = this.allEquipes
        .filter((e) => !existingChildIds.has(e.id!))
        .map((e) => ({ id: e.id!, label: e.nom }));
    } else if (this.viewMode() === "team") {
      // Parent is Team, we want to add Projects
      const existingChildIds = new Set(row.children.map((c) => c.id));
      this.linkableItems = this.allProjects
        .filter((p) => !existingChildIds.has(p.id!))
        .map((p) => ({ id: p.id!, label: p.nom_projet }));
    } else if (this.viewMode() === "resource") {
      if (!child) {
        // Level 1 Parent: [Team - Resource]
        // We want to add a PROJECT to this resource
        const existingProjectIds = new Set(row.children[0]?.resources.map(r => r.projectId) || []);
        this.linkableItems = this.allProjects
          .filter(p => !existingProjectIds.has(p.id!))
          .map(p => ({ id: p.id!, label: p.nom_projet }));
      } else {
        // Level 2 Child: Resource (already expanded)
        // We want to add a PROJECT to this resource
        const existingProjectIds = new Set(child.resources.map(r => r.projectId));
        this.linkableItems = this.allProjects
          .filter(p => !existingProjectIds.has(p.id!))
          .map(p => ({ id: p.id!, label: p.nom_projet }));
      }
    }

    this.showLinkModal = true;
  }

  closeLinkModal() {
    this.showLinkModal = false;
    this.selectedParentRow = null;
    this.selectedChildRowToLink = null;
    this.selectedIdToLink = "";
  }

  async linkItem() {
    if (!this.selectedParentRow || !this.selectedIdToLink) return;

    try {
      if (this.viewMode() === "project") {
        const projetId = this.selectedParentRow.id;
        const equipeId = this.selectedIdToLink;
        await this.projetService.linkProjectToTeam(projetId, equipeId);
        await this.addAllTeamResourcesToProject(equipeId, projetId);
      } else if (this.viewMode() === "team") {
        const equipeId = this.selectedParentRow.id;
        const projetId = this.selectedIdToLink;
        await this.projetService.linkProjectToTeam(projetId, equipeId);
        await this.addAllTeamResourcesToProject(equipeId, projetId);
      } else if (this.viewMode() === "resource") {
        if (!this.selectedChildRowToLink) {
          // Level 1: Add Project to Resource
          // selectedParentRow.id is `${teamId}_${rKey}`
          const [equipeId, type, rawResId] = this.selectedParentRow.id.split('_');
          const projetId = this.selectedIdToLink;

          const roleId = type === 'role' ? rawResId : undefined;
          const personneId = type === 'personne' ? rawResId : undefined;

          await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);
        } else {
          // Level 2: Add Project to Resource (already filtered)
          const equipeId = this.selectedParentRow.id.split('_')[0];
          const [type, resId] = this.selectedChildRowToLink.id.split('_');
          const projetId = this.selectedIdToLink;

          const roleId = type === 'role' ? resId : undefined;

          await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, type === 'personne' ? resId : undefined);
        }
      }

      await this.loadData();
      this.closeLinkModal();
    } catch (error: any) {
      console.error("Error linking item:", error);
      alert(error.message || "Erreur lors de l'ajout du lien.");
    }
  }

  private async addAllTeamResourcesToProject(equipeId: string, projetId: string) {
    const teamResources = await this.teamService.getEquipeResources(equipeId);
    const existingCharges = await this.chargeService.getChargesByProject(projetId);
    const teamCharges = existingCharges.filter(c => c.equipe_id === equipeId);

    for (const resource of teamResources) {
      const isAlreadyAdded = teamCharges.some(c =>
        (resource.type === 'role' && c.role_id === resource.id) ||
        (resource.type === 'personne' && c.personne_id === resource.id)
      );

      if (!isAlreadyAdded) {
        const roleId = resource.type === 'role' ? resource.id : undefined;
        const personneId = resource.type === 'personne' ? resource.id : undefined;
        await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);
      }
    }
  }

  // --- Project Modal Integration ---
  showProjectModal = false;
  projectToEdit: Partial<Projet> | null = null;
  ExternalLink = ExternalLink;

  getProjectForLinks(): Projet | undefined {
    if (this.showLinkModal) {
      if (!this.selectedParentRow && !this.selectedIdToLink) return undefined;
      let projetId: string | undefined;
      if (this.viewMode() === 'project') {
        projetId = this.selectedParentRow?.id;
      } else {
        projetId = this.selectedIdToLink;
      }
      return this.allProjects.find(p => p.id === projetId);
    }

    if (this.showAddResourceModal && this.viewMode() === 'team' && this.selectedChildRow) {
      return this.allProjects.find(p => p.id === this.selectedChildRow?.id);
    }

    return undefined;
  }

  openProjectEditFromLink() {
    const project = this.getProjectForLinks();
    if (project) {
      this.projectToEdit = { ...project };
      this.showProjectModal = true;
    }
  }

  async onProjectSaved() {
    this.showProjectModal = false;
    await this.loadData();
  }

  closeProjectModal() {
    this.showProjectModal = false;
  }

  // Resource Addition Modal Methods
  async openAddResourceModal(child: ChildRow, parent: ParentRow) {
    this.selectedChildRow = child;
    this.selectedParentForResource = parent;
    this.resourceTypeToAdd = "role";
    this.selectedResourceId = "";
    this.showAddResourceModal = true;

    // Determine projetId and equipeId based on view mode
    let projetId: string;
    let equipeId: string;

    if (this.viewMode() === "project") {
      // Parent is Project, Child is Team
      projetId = parent.id;
      equipeId = child.id;
    } else {
      // Parent is Team, Child is Project
      equipeId = parent.id;
      projetId = child.id;
    }

    try {
      // Load only available roles for this project+team combination
      this.availableRoles = await this.chargeService.getAvailableRolesForProjectTeam(projetId, equipeId);

      // Load only available persons for this project+team combination
      this.availablePersonnes = await this.chargeService.getAvailablePersonnesForProjectTeam(projetId, equipeId);
    } catch (error) {
      console.error("Error loading available resources:", error);
      this.availableRoles = [];
      this.availablePersonnes = [];
    }
  }

  closeAddResourceModal() {
    this.showAddResourceModal = false;
    this.selectedChildRow = null;
    this.selectedParentForResource = null;
    this.selectedResourceId = "";
  }

  async addResourceToCharge() {
    if (!this.selectedChildRow || !this.selectedParentForResource || !this.selectedResourceId) return;

    try {
      let projetId: string;
      let equipeId: string;

      if (this.viewMode() === "project") {
        // Parent is Project, Child is Team
        projetId = this.selectedParentForResource.id;
        equipeId = this.selectedChildRow.id;
      } else {
        // Parent is Team, Child is Project
        equipeId = this.selectedParentForResource.id;
        projetId = this.selectedChildRow.id;
      }

      const roleId = this.resourceTypeToAdd === "role" ? this.selectedResourceId : undefined;
      const personneId = this.resourceTypeToAdd === "personne" ? this.selectedResourceId : undefined;

      await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);

      await this.loadData(); // Reload to refresh tree
      this.closeAddResourceModal();
    } catch (error) {
      console.error("Error adding resource:", error);
      alert("Erreur lors de l'ajout de la ressource.");
    }
  }

  // Drag Selection Methods
  getResourceUniqueId(resource: ResourceRow, child: ChildRow, parent: ParentRow): string {
    return `${parent.id}_${child.id}_${resource.id}_${resource.type} `;
  }

  // Sexy Tooltip Methods
  showTooltip(event: MouseEvent, text: string) {
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }

    if (this.activeTooltip === text) return;

    this.tooltipShowTimer = setTimeout(() => {
      this.activeTooltip = text;
      this.updateTooltipPosition(event);
    }, this.SHOW_DELAY);
  }

  hideTooltip() {
    if (this.tooltipShowTimer) {
      clearTimeout(this.tooltipShowTimer);
      this.tooltipShowTimer = null;
    }

    this.tooltipHideTimer = setTimeout(() => {
      this.activeTooltip = null;
    }, this.HIDE_DELAY);
  }

  onGlobalMouseMove(event: MouseEvent) {
    // 1. Tooltip update
    if (this.activeTooltip) {
      this.updateTooltipPosition(event);
    }

    // 2. Drag Selection update
    if (this.isDragging && this.dragStartResource) {
      const target = event.target as HTMLElement;
      const cell = target.closest(".week-cell");
      if (cell) {
        // We need to verify if we are over the same row to keep selection consistent
        const row = target.closest(".calendar-row");
        if (row) {
          const resId = row.getAttribute("data-resource-id");
          const expectedId = this.getResourceUniqueId(this.dragStartResource, this.dragStartChild!, this.dragStartParent!);

          if (resId === expectedId) {
            const indexStr = cell.getAttribute("data-week-index");
            if (indexStr) {
              const newIndex = parseInt(indexStr, 10);
              if (newIndex !== this.dragEndWeekIndex) {
                this.ngZone.run(() => {
                  this.dragEndWeekIndex = newIndex;
                  this.updateSelection(this.dragStartChild!, this.dragStartParent!);
                  this.cdr.markForCheck();
                });
              }
            }
          }
        }
      }
    }
  }

  updateTooltipPosition(event: MouseEvent) {
    if (!this.activeTooltip || !this.tooltipElement) return;

    // Offset from cursor to avoid overlap
    const offsetX = 15;
    const offsetY = 15;

    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;

    // Simple boundary check to keep tooltip on screen
    const tooltipWidth = 200; // Estimated
    const tooltipHeight = 40;  // Estimated

    if (x + tooltipWidth > window.innerWidth) {
      x = event.clientX - tooltipWidth - offsetX;
    }

    if (y + tooltipHeight > window.innerHeight) {
      y = event.clientY - tooltipHeight - offsetY;
    }

    // Direct DOM manipulation for fast updates outside Angular zone
    this.tooltipElement.nativeElement.style.left = `${x}px`;
    this.tooltipElement.nativeElement.style.top = `${y}px`;
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    this.isDragging = true;
    this.isSelectionFinished = false;
    this.dragStartResource = resource;
    this.dragStartChild = child;
    this.dragStartParent = parent;

    const target = event.target as HTMLElement;
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
      if (indexStr) {
        this.dragStartWeekIndex = parseInt(indexStr, 10);
        this.dragEndWeekIndex = this.dragStartWeekIndex;
        this.updateSelection(child, parent);
        this.cdr.markForCheck();
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    // This method is now obsolete as we use onGlobalMouseMove
  }

  onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.selectedCells.length > 0) {
      this.isSelectionFinished = true;
      this.updateToolbarPosition();
      this.cdr.markForCheck();
    }
  }


  updateToolbarPosition() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    setTimeout(() => {
      const firstCell = this.selectedCells[0];
      if (!firstCell) return;

      const uniqueId = this.getResourceUniqueId(
        firstCell.resource,
        { id: firstCell.childId } as ChildRow,
        { id: firstCell.parentId } as ParentRow
      );

      const rowSelector = `[data-resource-id="${uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector);

      if (rowElement) {
        const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
        const cellElement = rowElement.querySelector(cellSelector);

        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          // Estimated toolbar dimensions (safe buffer)
          const bottomSafetyMargin = 150; // Height of toolbar + some padding
          const rightSafetyMargin = 320; // Width of toolbar + padding

          const spaceBelow = viewportHeight - rect.bottom;

          let top = rect.bottom;
          let left = rect.left + rect.width / 2;
          let transform = 'translate(-50%, 10px)'; // Default: centered below

          // Check if we are too close to the bottom
          const pos = calculateBestToolbarPosition({
            rect,
            viewportWidth,
            viewportHeight,
            dragStartWeekIndex: this.dragStartWeekIndex,
            dragEndWeekIndex: this.dragEndWeekIndex,
            bottomSafetyMargin: 150,
            rightSafetyMargin: 320
          });

          this.toolbarPosition = pos;

          // Make toolbar visible now that position is set
          this.toolbarVisible = true;
          this.cdr.markForCheck();
        }
      }
    }, 0);
  }

  updateSelection(child: ChildRow, parent: ParentRow) {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: this.displayedWeeks[i],
        childId: child.id,
        parentId: parent.id,
      });
    }
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some(
      (s) => s.resource.uniqueId === resource.uniqueId && s.week.getTime() === week.getTime()
    );
  }

  clearSelection() {
    this.selectedCells = [];
    this.isSelectionFinished = false;
    this.toolbarPosition = null;
    this.toolbarVisible = false;
    this.dragStartResource = null;
    this.dragStartWeekIndex = -1;
    this.dragEndWeekIndex = -1;
    this.bulkChargeValue = null;
  }

  async applyBulkCharge() {
    if (this.selectedCells.length === 0 || this.bulkChargeValue == null) return;

    this.isSaving = true;
    try {
      for (const cell of this.selectedCells) {
        const weekKey = cell.week.toISOString().split("T")[0];

        let projetId: string;
        let equipeId: string;

        if (this.viewMode() === "project") {
          // Parent is Project, Child is Team
          projetId = cell.parentId;
          equipeId = cell.childId;
        } else if (this.viewMode() === "team") {
          // Parent is Team, Child is Project
          equipeId = cell.parentId;
          projetId = cell.childId;
        } else {
          // Resource mode: Parent.id is `${team.id}_${resourceType}_${resourceId}`
          // We need to extract just the team.id (first part before the first underscore that separates it from 'role_' or 'personne_')
          const parentIdParts = cell.parentId.split('_');
          // The team ID is a UUID, which doesn't contain underscores in its format (8-4-4-4-12 hex)
          // So team.id is parentIdParts[0], and the rest is the resource key
          equipeId = parentIdParts[0];
          projetId = cell.resource.projectId!;
        }

        const rId = cell.resource.resourceId || cell.resource.id;
        const roleId = cell.resource.type === "role" ? rId : undefined;
        const personneId = cell.resource.type === "personne" ? rId : undefined;

        // Create or update charge
        await this.chargeService.createOrUpdateCharge(
          projetId,
          equipeId,
          weekKey,
          this.bulkChargeValue,
          roleId,
          personneId
        );
      }

      // Reload data to refresh the view
      await this.loadData();
      // calculateUsage is called within loadData
      this.clearSelection();
    } catch (error) {
      console.error("Error applying bulk charge:", error);
      alert("Erreur lors de l'application des charges.");
    } finally {
      this.isSaving = false;
    }
  }

  // --- Filter helpers ---
  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event) {
    // Close any open dropdown if clicking outside
    const target = event.target as HTMLElement;
    // if click is outside filters-bar, close dropdowns
    if (!target.closest(".filters-bar")) {
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.filterProjetSearch.set('');
    }
  }

  toggleDropdown(name: "equipe" | "projet" | "resource", event: MouseEvent) {
    event.stopPropagation();
    if (name === "equipe") {
      this.openEquipeDropdown = !this.openEquipeDropdown;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
    } else if (name === "projet") {
      this.openProjetDropdown = !this.openProjetDropdown;
      this.openEquipeDropdown = false;
      this.openResourceDropdown = false;
    } else {
      this.openResourceDropdown = !this.openResourceDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
    }
    if (!this.openProjetDropdown) {
      this.filterProjetSearch.set('');
    }
  }

  onEquipeToggle(id: string | undefined, event: Event) {
    if (!id) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.filterEquipeIds.update(ids => {
      if (checked) return [...ids, id];
      return ids.filter((x) => x !== id);
    });
    this.applyFilters();
  }

  onProjetToggle(id: string | undefined, event: Event) {
    if (!id) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.filterProjetIds.update(ids => {
      if (checked) return [...ids, id];
      return ids.filter((x) => x !== id);
    });
    this.applyFilters();
  }

  get filteredProjectsForDropdown(): Projet[] {
    if (!this.filterProjetSearch()) return this.allProjects;
    const search = this.filterProjetSearch().toLowerCase();
    return this.allProjects.filter(p =>
      p.nom_projet.toLowerCase().includes(search) ||
      (p.code_projet && p.code_projet.toLowerCase().includes(search))
    );
  }

  selectFilteredProjects() {
    const ids = this.filteredProjectsForDropdown.map(p => p.id).filter(id => !!id) as string[];
    this.filterProjetIds.update(current => {
      const set = new Set([...current, ...ids]);
      return Array.from(set);
    });
    this.applyFilters();
  }

  deselectFilteredProjects() {
    const ids = this.filteredProjectsForDropdown.map(p => p.id).filter(id => !!id) as string[];
    this.filterProjetIds.update(current => current.filter(id => !ids.includes(id)));
    this.applyFilters();
  }

  onResourceToggle(sel: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.filterResourceIds.update(ids => {
      if (checked) return [...ids, sel];
      return ids.filter((x) => x !== sel);
    });
    this.applyFilters();
  }

  getEquipeName(id: string) {
    const e = this.allEquipes.find((x) => x.id === id);
    return e ? e.nom : "—";
  }

  getProjetLabel(id: string) {
    const p = this.allProjects.find((x) => x.id === id);
    return p ? `${p.code_projet} — ${p.nom_projet} ` : "—";
  }

  getResourceLabel(sel: string) {
    const [type, id] = sel.split(":");
    if (type === "role") {
      const r = this.availableRoles.find((x) => x.id === id);
      return r ? `Role: ${r.nom} ` : "Role: —";
    }
    const p = this.availablePersonnes.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom} ` : "Pers: —";
  }

  applyFilters() {
    // If no active filters, show original rows
    if (!this.filterEquipeIds().length && !this.filterProjetIds().length && !this.filterResourceIds().length) {
      this.rows = [...this.rowsAll];
      this.buildFlatList();
      return;
    }

    const filteredParents: ParentRow[] = [];

    for (const parent of this.rowsAll) {
      const newParent: ParentRow = {
        id: parent.id,
        label: parent.label,
        code: parent.code,
        color: parent.color,
        expanded: parent.expanded,
        children: [],
        totalCharges: parent.totalCharges,
        originalProject: parent.originalProject,
      };

      // Decide if parent passes equipe filter (if in team or resource mode)
      let parentPassesEquipe = true;
      if (this.filterEquipeIds().length) {
        if (this.viewMode() === "team") {
          parentPassesEquipe = this.filterEquipeIds().includes(parent.id);
        } else if (this.viewMode() === "resource") {
          // parent.id is "teamId_resourceKey"
          const teamId = parent.id.split('_')[0];
          parentPassesEquipe = this.filterEquipeIds().includes(teamId);
        }
      }

      // Decide if parent passes resource filter (ONLY in resource mode where parent IS the resource)
      let parentPassesResource = true;
      if (this.filterResourceIds().length && this.viewMode() === "resource") {
        parentPassesResource = this.filterResourceIds().some((sel) => {
          const rKeyForSel = sel.replace(':', '_');
          // parent.id is "teamId_resourceKey", we check if it ends with resourceKey
          return parent.id.endsWith(rKeyForSel);
        });
      }

      // Decide if parent passes project filter (if in project mode)
      let parentPassesProjet = true;
      if (this.filterProjetIds().length) {
        if (this.viewMode() === "project") {
          parentPassesProjet = this.filterProjetIds().includes(parent.id);
        }
      }

      // Process each child and apply child/resource-level filters
      for (const child of parent.children) {
        // Grandchild-level resources/projects
        let grandchildrenMatch: ResourceRow[] = child.resources;

        // Apply filters to grandchildren
        if (this.filterResourceIds().length || this.filterProjetIds().length) {
          grandchildrenMatch = child.resources.filter((gr) => {
            let resMatch = true;
            let projMatch = true;

            // In resource mode, grandchild IS a project
            if (this.viewMode() === 'resource') {
              if (this.filterProjetIds().length) {
                projMatch = this.filterProjetIds().includes(gr.id);
              }
              // Resource filter applies to CHILD level in resource mode (handled later)
            } else {
              // In other modes, grandchild IS a resource
              if (this.filterResourceIds().length) {
                resMatch = this.filterResourceIds().some((sel) => {
                  const [t, id] = sel.split(":");
                  return (
                    (t === "role" && gr.type === "role" && gr.id === id) ||
                    (t === "personne" && gr.type === "personne" && gr.id === id)
                  );
                });
              }
            }
            return resMatch && projMatch;
          });
        }

        // Child-level filters
        let childPassesEquipe = true;
        let childPassesProjet = true;
        let childPassesResource = true;

        if (this.filterEquipeIds().length && this.viewMode() === "project") {
          childPassesEquipe = this.filterEquipeIds().includes(child.id);
        }

        if (this.filterProjetIds().length && this.viewMode() === "team") {
          childPassesProjet = this.filterProjetIds().includes(child.id);
        }

        if (this.filterResourceIds().length && this.viewMode() === "resource") {
          // In resource mode, the resource filter already applied to the parent
          childPassesResource = parentPassesResource;
        }

        // A child is included if it passes child-level filters. 
        // We only prune empty children if a filter targeting the grandchildren (Resources in project/team mode, Projects in resource mode) is active.
        const hasGrandchildFilter = (this.viewMode() === 'resource')
          ? this.filterProjetIds().length > 0
          : this.filterResourceIds().length > 0;

        const hasGrandchildrenMatch = hasGrandchildFilter ? grandchildrenMatch.length > 0 : true;
        const includeChild = childPassesEquipe && childPassesProjet && childPassesResource && hasGrandchildrenMatch;

        if (includeChild) {
          newParent.children.push({
            id: child.id,
            label: child.label,
            code: child.code,
            color: child.color,
            expanded: child.expanded,
            resources: grandchildrenMatch,
            charges: child.charges,
          });
        }
      }

      // Final decision to include parent
      const hasChildren = newParent.children.length > 0;

      // Allow showing empty parent if it was explicitly selected via the primary filter 
      let showEmptyParent = false;
      if (this.viewMode() === 'project' && this.filterProjetIds().includes(parent.id)) {
        if (this.filterEquipeIds().length === 0 && this.filterResourceIds().length === 0) {
          showEmptyParent = true;
        }
      } else if ((this.viewMode() === 'team' || this.viewMode() === 'resource') && this.filterEquipeIds().includes(parent.id)) {
        if (this.filterProjetIds().length === 0 && this.filterResourceIds().length === 0) {
          showEmptyParent = true;
        }
      }

      if (parentPassesEquipe && parentPassesResource && parentPassesProjet && (hasChildren || showEmptyParent)) {
        filteredParents.push(newParent);
      }
    }

    this.rows = filteredParents;
    this.buildFlatList();
  }

  // Metrics calculation methods
  getRowMetricsYear(row: ParentRow, year: number): number {
    let total = 0;
    for (const child of row.children) {
      total += this.getChildMetricsYear(child, year);
    }
    return total;
  }

  getChildMetricsYear(child: ChildRow, year: number): number {
    let total = 0;
    for (const resource of child.resources) {
      total += this.getResourceMetricsYear(resource, year);
    }
    return total;
  }

  getResourceMetricsYear(resource: ResourceRow, year: number): number {
    let total = 0;
    for (const [weekKey, charge] of resource.charges) {
      const weekDate = new Date(weekKey);
      if (weekDate.getFullYear() === year) {
        // Calculate days: charge (units per week) * jours_par_semaine
        total += charge * resource.jours_par_semaine;
      }
    }
    return total;
  }

  getFlatRowMetricsYear(row: FlatRow, year: number): number {
    return this.getResourceMetricsYear(row.resource, year);
  }

  // Sum of days (charge * jours_par_semaine) for currently selected cells
  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const charge = this.getResourceValue(cell.resource, cell.week) || 0;
      const jours = cell.resource.jours_par_semaine || 0;
      total += charge * jours;
    }
    return total;
  }

  async removeResource(resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    this.confirmTitle = "Supprimer la ressource";
    this.confirmMessage = `Êtes - vous sûr de vouloir supprimer "${resource.label}" ?\nCela supprimera toutes les charges associées à cette ressource.`;

    this.pendingConfirmAction = async () => {
      try {
        let projetId: string;
        let equipeId: string;
        let roleId: string | undefined;
        let personneId: string | undefined;

        if (this.viewMode() === "project") {
          projetId = parent.id;
          equipeId = child.id;
          roleId = resource.type === 'role' ? resource.id : undefined;
          personneId = resource.type === 'personne' ? resource.id : undefined;
        } else if (this.viewMode() === "team") {
          equipeId = parent.id;
          projetId = child.id;
          roleId = resource.type === 'role' ? resource.id : undefined;
          personneId = resource.type === 'personne' ? resource.id : undefined;
        } else {
          // resource view mode: parent=team, child=resource, resource=project
          equipeId = parent.id.split('_')[0];
          projetId = resource.id;
          roleId = resource.type === 'role' ? resource.resourceId : undefined;
          personneId = resource.type === 'personne' ? resource.resourceId : undefined;
        }

        await this.chargeService.deleteChargesForResource(projetId, equipeId, roleId, personneId);
        await this.loadData();
      } catch (error) {
        console.error('Error removing resource:', error);
        alert('Erreur lors de la suppression de la ressource.');
      }
    };
    this.showConfirmModal = true;
  }

  async removeChild(child: ChildRow, parent: ParentRow) {
    this.confirmTitle = "Retirer " + (this.viewMode() === "resource" ? "la ressource" : (this.viewMode() === "project" ? "l'équipe" : "le projet"));
    this.confirmMessage = `Êtes - vous sûr de vouloir retirer "${child.label}" ?\nCela supprimera toutes les charges associées.`;

    this.pendingConfirmAction = async () => {
      try {
        if (this.viewMode() === "resource") {
          // Remove all charges for this resource in this team
          const [type, resId] = child.id.split('_');
          const roleId = type === 'role' ? resId : undefined;
          const personneId = type === 'personne' ? resId : undefined;
          const equipeId = parent.id.split('_')[0];

          await this.chargeService.deleteChargesForResource(undefined, equipeId, roleId, personneId);

          // Also remove the attachment from the team
          if (type === 'role') {
            await this.teamService.removeRoleFromEquipe(resId, equipeId);
          } else {
            await this.teamService.removePersonneFromEquipe(resId);
          }
        } else {
          let projetId: string;
          let equipeId: string;

          if (this.viewMode() === "project") {
            projetId = parent.id;
            equipeId = child.id;
          } else {
            equipeId = parent.id;
            projetId = child.id;
          }

          await this.chargeService.deleteChargesForProjectTeam(projetId, equipeId);
          await this.projetService.unlinkProjectFromTeam(projetId, equipeId);
        }
        await this.loadData();
      } catch (error) {
        console.error('Error removing child:', error);
        alert(`Erreur lors de la suppression de l'association.`);
      }
    };
    this.showConfirmModal = true;
  }


  getSelectedStartDateISO(): string {
    if (!this.selectedStartDate) return '';
    const d = this.selectedStartDate;
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  getResourceTotalPlannedDays(resource: ResourceRow): number {
    let total = 0;
    resource.charges.forEach((val, weekStr) => {
      const date = new Date(weekStr);

      if (this.selectedCapacityYear === 'custom' && this.selectedStartDate) {
        if (date >= this.selectedStartDate) {
          total += val * resource.jours_par_semaine;
        }
      } else {
        const isoYear = getISOWeekYear(date).toString();
        if (this.selectedCapacityYear === 'all' || isoYear === this.selectedCapacityYear) {
          total += val * resource.jours_par_semaine;
        }
      }
    });
    return total;
  }

  getBadgePrefix(): string {
    if (this.selectedCapacityYear === 'all') return 'Tout :';
    if (this.selectedCapacityYear === 'custom' && this.selectedStartDate) {
      const d = this.selectedStartDate;
      const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return `Dès le ${formatted} :`;
    }
    return `${this.selectedCapacityYear} :`;
  }

  openYearPopover(event: MouseEvent, anchorId: string) {
    event.stopPropagation();
    const targetElement = event.currentTarget as HTMLElement;

    if (this.showYearPopover && this.activeAnchorId === anchorId) {
      this.showYearPopover = false;
      this.activeAnchorId = null;
      return;
    }

    this.activeAnchorId = anchorId;
    this.showYearPopover = true;

    // Calculate best position to determine arrow side
    const rect = targetElement.getBoundingClientRect();
    const pos = calculateBestPopoverPosition({
      rect,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      popoverHeight: 200, // Estimated height of the popover
      popoverWidth: 160
    });
    this.popoverArrowSide = pos.arrowSide;

    // Close when clicking outside
    const closeHandler = (e: MouseEvent | Event) => {
      // Don't close if we clicked the toggle itself
      if (e instanceof MouseEvent && targetElement.contains(e.target as Node)) {
        return;
      }
      this.showYearPopover = false;
      this.activeAnchorId = null;
      document.removeEventListener('click', closeHandler);
    };
    document.addEventListener('click', closeHandler);
  }

  selectYear(year: 'all' | '2025' | '2026') {
    this.selectedCapacityYear = year;
    this.selectedStartDate = null;
    this.showYearPopover = false;
  }

  onDateSelected(event: any) {
    const selectedDateStr = event.target.value;
    if (!selectedDateStr) return;

    const selectedDate = new Date(selectedDateStr);
    const mondayOfSelectedWeek = this.calendarService.getWeekStart(selectedDate);

    this.selectedStartDate = mondayOfSelectedWeek;
    this.selectedCapacityYear = 'custom';
    this.showYearPopover = false;
  }
}

