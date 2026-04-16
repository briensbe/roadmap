import { Component, OnInit, NgModule, HostListener, ChangeDetectorRef, NgZone, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SelectionToolbarComponent } from "../selection-toolbar.component";
import { ConfirmModalComponent } from "../confirm-modal.component";
import { TeamService } from "../../services/team.service";
import { CalendarService } from "../../services/calendar.service";
import { Equipe, Role, Personne, Capacite, EquipeResource } from "../../models/types";
import { LucideAngularModule, ChevronDown, ChevronRight, Plus, User, Users, Contact, SquarePlus, SquareMinus } from "lucide-angular";
import { getISOWeekYear } from "date-fns";
import { storageSignal } from "../../utils/storage-signal";
import { calculateBestToolbarPosition, calculateBestPopoverPosition, ToolbarPosition, PopoverPosition } from "../../utils/selection-positioning";

@NgModule({
  imports: [LucideAngularModule.pick({ ChevronDown, ChevronRight, Plus, User, Users, Contact, SquarePlus, SquareMinus })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

interface ResourceRow {
  type: "role" | "personne";
  id: string;
  uniqueId: string;
  label: string;
  equipeId: string;
  weeks: Map<string, number>;
  jours_par_semaine: number;
  color?: string;
}

interface TeamRow {
  equipe: Equipe;
  resources: ResourceRow[];
  expanded: boolean;
}

@Component({
  selector: "app-capacity-view",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule, SelectionToolbarComponent, ConfirmModalComponent],
  templateUrl: "./capacity-view.component.html",
  styleUrl: "./capacity-view.component.css"
})
export class CapacityViewComponent implements OnInit, OnDestroy {
  displayedWeeks: Date[] = [];
  currentDate: Date = new Date();

  teamRows: TeamRow[] = [];
  allEquipes: Equipe[] = [];

  teamFilter: string = "all";
  resourceSearch: string = "";
  selectedResourceNames: Set<string> = new Set();
  showResourceDropdown: boolean = false;

  // Sexy Tooltip State
  activeTooltip: string | null = null;
  tooltipX = 0;
  tooltipY = 0;
  private tooltipShowTimer: any;
  private tooltipHideTimer: any;
  private readonly SHOW_DELAY = 400;
  private readonly HIDE_DELAY = 100;

  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  showAddResourceModal = false;

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
  selectedEquipe: Equipe | null = null;
  resourceTypeToAdd: "role" | "personne" = "role";
  selectedResourceId: string = "";

  // Drag selection
  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  dragStartWeekIndex: number = -1;
  dragEndWeekIndex: number = -1;
  selectedCells: Array<{ resource: ResourceRow; week: Date }> = [];
  isSelectionFinished: boolean = false;
  toolbarPosition: ToolbarPosition | null = null;
  toolbarVisible: boolean = false; // Controls opacity to prevent flash

  bulkCapaciteValue: number | null = null;

  Contact = Contact;
  User = User;

  // Toggle to show/hide the computed days inside cells. Default: hidden (user activates toggle to show)
  showDaysInCells: boolean = false;
  zoomLevel = storageSignal<"compact" | "normal">("capacity-view-zoom-level", "normal");
  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();

  selectedCapacityYear: 'today' | 'all' | '2025' | '2026' | 'custom' = 'today';
  selectedStartDate: Date | null = null;
  showYearPopover = false;
  popoverPosition: PopoverPosition | null = null;
  popoverArrowSide: 'top' | 'bottom' = 'top';
  private scrollCloseListener?: () => void;

  constructor(
    private teamService: TeamService,
    private calendarService: CalendarService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  expandAll() {
    this.isDefaultExpanded = true;
    this.manualStates.clear();
    this.filteredTeamRows.forEach(r => r.expanded = true);
  }

  collapseAll() {
    this.isDefaultExpanded = false;
    this.manualStates.clear();
    this.filteredTeamRows.forEach(r => r.expanded = false);
  }

  async ngOnInit() {
    this.generateWeeks();
    await this.loadData();

    this.ngZone.runOutsideAngular(() => {
      // Close popovers on scroll so they don't detach from their anchor badge
      const scrollHandler = () => {
        if (this.showYearPopover) {
          this.ngZone.run(() => {
            this.showYearPopover = false;
            this.activeAnchorId = null;
            this.cdr.markForCheck();
          });
        }
      };
      // Attach to the document with capture phase to catch scroll on any child element
      document.addEventListener('scroll', scrollHandler, true);
      this.scrollCloseListener = () => document.removeEventListener('scroll', scrollHandler, true);
    });
  }

  ngOnDestroy() {
    if (this.scrollCloseListener) {
      this.scrollCloseListener();
    }
  }

  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.calendarService.getWeekStart(startDate);

    const NB_WEEK_TO_DISPLAY = 53; // un an par défaut (besoin de 53 semaines pour couvrir 2026)
    for (let i = 0; i < NB_WEEK_TO_DISPLAY; i++) {
      const week = new Date(firstWeek);
      week.setDate(week.getDate() + i * 7);
      this.displayedWeeks.push(week);
    }
  }

  async loadData() {
    try {

      // 1️⃣ Load ALL data in parallel (no nested loops with await!)
      const [equipes, allCapacities, roles, personnes] = await Promise.all([
        this.teamService.getAllEquipes(),
        this.teamService.getAllCapacities(),
        this.teamService.getAllRoles(),
        this.teamService.getAllPersonnes(),
      ]);

      this.availableRoles = roles;
      this.availablePersonnes = personnes;
      this.allEquipes = equipes;

      // Load all resources for all teams in parallel
      const allResourcesArrays = await Promise.all(
        equipes.map(equipe => this.teamService.getEquipeResources(equipe.id!))
      );


      // 2️⃣ Index capacities by resource for O(1) lookup
      const capacitiesByResource = new Map<string, Capacite[]>();
      allCapacities.forEach(cap => {
        // Build key based on whether it's a role or personne capacity
        const resourceId = cap.role_id || cap.personne_id;
        const type = cap.role_id ? 'role' : 'personne';
        const key = `${resourceId}_${type}_${cap.equipe_id}`;
        if (!capacitiesByResource.has(key)) {
          capacitiesByResource.set(key, []);
        }
        capacitiesByResource.get(key)!.push(cap);
      });

      // 3️⃣ Build team rows in memory (no more DB calls)
      this.teamRows = equipes.map((equipe, index) => {
        const resources = allResourcesArrays[index];

        const resourceRows: ResourceRow[] = resources.map(resource => {
          const key = `${resource.id}_${resource.type}_${equipe.id}`;
          const capacites = capacitiesByResource.get(key) || [];
          const weeks = new Map<string, number>();

          capacites.forEach(cap => {
            const weekStr = this.calendarService.formatWeekStart(new Date(cap.semaine_debut));
            weeks.set(weekStr, cap.capacite);
          });

          return {
            type: resource.type,
            id: resource.id,
            uniqueId: resource.uniqueId,
            label: resource.type === "role" ? resource.nom : `${resource.prenom} ${resource.nom}`,
            equipeId: equipe.id!,
            weeks,
            jours_par_semaine: resource.jours_par_semaine,
            color: resource.color,
          };
        });

        return {
          equipe,
          resources: resourceRows,
          expanded: this.manualStates.has(equipe.id!) ? this.manualStates.get(equipe.id!)! : this.isDefaultExpanded,
        };
      });

    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  get filteredTeamRows(): TeamRow[] {
    let rows = this.teamRows;

    // Filter by team
    if (this.teamFilter !== "all") {
      rows = rows.filter(tr => tr.equipe.id === this.teamFilter);
    }

    // Filter by resource search OR multi-select (by name)
    if (this.selectedResourceNames.size > 0) {
      rows = rows.map(tr => ({
        ...tr,
        resources: tr.resources.filter(r => this.selectedResourceNames.has(r.label))
      })).filter(tr => tr.resources.length > 0);
    } else if (this.resourceSearch.trim()) {
      const search = this.resourceSearch.toLowerCase().trim();
      rows = rows.map(tr => ({
        ...tr,
        resources: tr.resources.filter(r => r.label.toLowerCase().includes(search))
      })).filter(tr => tr.resources.length > 0);
    }

    return rows;
  }

  get allResources(): ResourceRow[] {
    const all: ResourceRow[] = [];
    const seenLabels = new Set<string>();
    this.teamRows.forEach(tr => {
      tr.resources.forEach(r => {
        if (!seenLabels.has(r.label)) {
          seenLabels.add(r.label);
          all.push(r);
        }
      });
    });
    return all.sort((a, b) => a.label.localeCompare(b.label));
  }

  get filteredResourceList(): ResourceRow[] {
    const search = this.resourceSearch.toLowerCase().trim();
    if (!search) return this.allResources;
    return this.allResources.filter(r => r.label.toLowerCase().includes(search));
  }

  toggleResourceSelection(label: string) {
    if (this.selectedResourceNames.has(label)) {
      this.selectedResourceNames.delete(label);
    } else {
      this.selectedResourceNames.add(label);
    }
  }

  isResourceSelected(label: string): boolean {
    return this.selectedResourceNames.has(label);
  }

  toggleResourceDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showResourceDropdown = !this.showResourceDropdown;

    if (this.showResourceDropdown) {
      const closeHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.filter-dropdown-container')) {
          this.showResourceDropdown = false;
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }
  }

  formatWeekHeader(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}`;
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentWeekStart = this.calendarService.getWeekStart(now);
    return this.calendarService.formatWeekStart(date) === this.calendarService.formatWeekStart(currentWeekStart);
  }

  getCapacite(resource: ResourceRow, week: Date): number {
    const weekStr = this.calendarService.formatWeekStart(week);
    return resource.weeks.get(weekStr) || 0;
  }

  toggleTeam(teamRow: TeamRow) {
    if (teamRow.resources.length > 0) {
      teamRow.expanded = !teamRow.expanded;
      this.manualStates.set(teamRow.equipe.id!, teamRow.expanded);
    }
  }

  async openAddResourceModal(equipe: Equipe) {
    this.selectedEquipe = equipe;
    this.resourceTypeToAdd = "role";
    this.selectedResourceId = "";
    this.showAddResourceModal = true;

    // Load only available roles (not already attached to this team)
    this.availableRoles = await this.teamService.getAvailableRolesForEquipe(equipe.id!);

    // Load only available persons (not already attached to this team)
    this.availablePersonnes = await this.teamService.getAvailablePersonnesForEquipe(equipe.id!);
  }

  async addResourceToTeam() {
    if (!this.selectedEquipe || !this.selectedResourceId) return;

    try {
      if (this.resourceTypeToAdd === "role") {
        await this.teamService.addRoleToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      } else {
        await this.teamService.addPersonneToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      }

      this.showAddResourceModal = false;
      await this.loadData();
    } catch (error: any) {
      console.error("Error adding resource:", error);
      // Display user-friendly error message
      if (error.message && error.message.includes("déjà attaché")) {
        alert(error.message);
      } else {
        alert("Erreur lors de l'ajout de la ressource. Veuillez réessayer.");
      }
    }
  }

  async removeResource(resource: ResourceRow, equipe: Equipe) {
    this.confirmTitle = "Supprimer la ressource";
    this.confirmMessage = `Retirer ${resource.label} de l'équipe ${equipe.nom} ?`;

    this.pendingConfirmAction = async () => {
      try {
        if (resource.type === "role") {
          await this.teamService.removeRoleFromEquipe(resource.id, equipe.id!);
        } else {
          await this.teamService.removePersonneFromEquipe(resource.id);
        }
        await this.loadData();
      } catch (error) {
        console.error("Error removing resource:", error);
      }
    };
    this.showConfirmModal = true;
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

  @HostListener('mousemove', ['$event'])
  updateTooltipPosition(event: MouseEvent) {
    if (!this.activeTooltip) return;

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

    this.tooltipX = x;
    this.tooltipY = y;
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow) {
    this.isDragging = true;
    this.isSelectionFinished = false;
    this.dragStartResource = resource;

    const target = event.target as HTMLElement;
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
      if (indexStr) {
        this.dragStartWeekIndex = parseInt(indexStr, 10);
        this.dragEndWeekIndex = this.dragStartWeekIndex;
        this.updateSelection();
        this.cdr.markForCheck();
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow) {
    if (!this.isDragging || !this.dragStartResource) return;

    if (resource.uniqueId !== this.dragStartResource.uniqueId) return;

    const target = event.target as HTMLElement;
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
      if (indexStr) {
        const newIndex = parseInt(indexStr, 10);
        if (newIndex !== this.dragEndWeekIndex) {
          this.dragEndWeekIndex = newIndex;
          this.updateSelection();
        }
      }
    }
  }

  onMouseUp() {
    this.isDragging = false;
    if (this.selectedCells.length > 0) {
      this.isSelectionFinished = true;
      this.updateToolbarPosition();
    }
  }

  updateToolbarPosition() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    // Use setTimeout to allow DOM to update if necessary
    setTimeout(() => {
      // Find the row
      const rowSelector = `[data-resource-id="${this.dragStartResource!.uniqueId}"]`;
      const rowElement = document.querySelector(rowSelector);

      if (rowElement) {
        // Find the specific cell
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

  updateSelection() {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) return;

    this.selectedCells = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      this.selectedCells.push({
        resource: this.dragStartResource,
        week: this.displayedWeeks[i],
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
  }

  async applyBulkCapacite() {
    // Autorise 0, bloque seulement null et undefined
    if (this.selectedCells.length === 0 || this.bulkCapaciteValue == null) return;

    try {
      for (const cell of this.selectedCells) {
        const weekStr = this.calendarService.formatWeekStart(cell.week);
        await this.teamService.saveCapacite(
          cell.resource.id,
          cell.resource.type,
          cell.resource.equipeId,
          weekStr,
          this.bulkCapaciteValue
        );

        // Update local data
        cell.resource.weeks.set(weekStr, this.bulkCapaciteValue);
      }

      this.clearSelection();
    } catch (error) {
      console.error("Error saving capacities:", error);
    }
  }

  // Sum of days (capacite * jours_par_semaine) for currently selected cells
  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const cap = this.getCapacite(cell.resource, cell.week) || 0;
      const jours = cell.resource.jours_par_semaine || 0;
      total += cap * jours;
    }
    return total;
  }

  goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateWeeks();
  }

  goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateWeeks();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateWeeks();
  }

  getTeamTotalCapacity(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce((sum, resource) => sum + this.getCapacite(resource, week), 0);
  }

  getTeamTotalDays(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce(
      (sum, resource) => sum + this.getCapacite(resource, week) * resource.jours_par_semaine,
      0
    );
  }

  getResourceTotalPlannedDays(resource: ResourceRow): number {
    let total = 0;
    resource.weeks.forEach((val, weekStr) => {
      const date = new Date(weekStr);

      if (this.selectedCapacityYear === 'today') {
        const todayWeekStart = this.calendarService.getWeekStart(new Date());
        if (date >= todayWeekStart) {
          total += val * resource.jours_par_semaine;
        }
      } else if (this.selectedCapacityYear === 'custom' && this.selectedStartDate) {
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
    if (this.selectedCapacityYear === 'today') {
      const d = this.calendarService.getWeekStart(new Date());
      const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return `Dès le ${formatted} :`;
    }
    if (this.selectedCapacityYear === 'custom' && this.selectedStartDate) {
      const d = this.selectedStartDate;
      const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return `Dès le ${formatted} :`;
    }
    return `${this.selectedCapacityYear} :`;
  }

  activeAnchorId: string | null = null;

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
    this.popoverPosition = pos;
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

  selectYear(year: 'today' | 'all' | '2025' | '2026') {
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

  getSelectedStartDateISO(): string {
    if (!this.selectedStartDate) return '';
    const d = this.selectedStartDate;
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
}
