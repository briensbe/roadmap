import { Component, OnInit, NgModule, HostListener, ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectionToolbarComponent } from '../selection-toolbar.component';
import { ConfirmModalComponent } from '../confirm-modal.component';
import { CrewdayzMappingModalComponent } from '../crewdayz-mapping/crewdayz-mapping-modal.component';
import { TeamService } from '../../services/team.service';
import { CalendarService } from '../../services/calendar.service';
import { RolesService } from '../../services/roles.service';
import { CrewdayzIntegrationService } from '../../services/crewdayz-integration.service';
import { Equipe, Role, Personne, Capacite, EquipeResource, RoleAttachment, LoadDataOptions } from '../../models/types';
import { CapacitySourceConfig, CrewdayzTeamAvailability, RoadmapMappingRoleProfile } from '../../models/crewdayz.types';
import {
  LucideAngularModule,
  ChevronDown,
  ChevronRight,
  Plus,
  User,
  Users,
  Contact,
  SquarePlus,
  SquareMinus,
  Sliders,
  Zap,
  Database,
  LoaderCircle,
} from 'lucide-angular';
import { getISOWeekYear } from 'date-fns';
import { storageSignal } from '../../utils/storage-signal';
import {
  calculateBestToolbarPosition,
  calculateBestPopoverPosition,
  ToolbarPosition,
  PopoverPosition,
} from '../../utils/selection-positioning';
import { textContains } from '../../utils/text.utils';

@NgModule({
  imports: [
    LucideAngularModule.pick({ ChevronDown, ChevronRight, Plus, User, Users, Contact, SquarePlus, SquareMinus, Sliders, Zap, Database, LoaderCircle }),
  ],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

interface ResourceRow {
  type: 'role' | 'personne';
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
  selector: 'app-capacity-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideIconsModule,
    SelectionToolbarComponent,
    ConfirmModalComponent,
    CrewdayzMappingModalComponent,
  ],
  templateUrl: './capacity-view.component.html',
  styleUrl: './capacity-view.component.css',
})
export class CapacityViewComponent implements OnInit, OnDestroy {
  displayedWeeks: Date[] = [];
  displayedYears: { year: number; weeksCount: number }[] = [];
  currentDate: Date = new Date();
  showSkeleton: boolean = false;

  teamRows: TeamRow[] = [];
  allEquipes: Equipe[] = [];

  selectedTeamIds = storageSignal<string[]>('capacity-view-selected-teams', []);
  showTeamDropdown: boolean = false;
  resourceSearch: string = '';
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
  resourceTypeToAdd: 'role' | 'personne' = 'role';
  selectedResourceId: string = '';

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

  get selectionStartWeekDate(): Date | null {
    if (this.selectedCells.length === 0) return null;
    const sorted = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
    return sorted[0].week;
  }

  get selectionDaysPerWeek(): number {
    return this.selectedCells.length > 0 ? this.selectedCells[0].resource.jours_par_semaine || 5 : 5;
  }

  Contact = Contact;
  User = User;

  // Toggle to show/hide the computed days inside cells. Default: hidden (user activates toggle to show)
  showDaysInCells: boolean = false;
  zoomLevel = storageSignal<'compact' | 'normal'>('capacity-view-zoom-level', 'normal');
  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();

  selectedCapacityYear: 'today' | 'all' | '2025' | '2026' | 'custom' = 'today';
  selectedStartDate: Date | null = null;
  showYearPopover = false;
  popoverPosition: PopoverPosition | null = null;
  popoverArrowSide: 'top' | 'bottom' = 'top';
  private scrollCloseListener?: () => void;

  // Crewdayz Integration State
  showCrewdayzMappingModal = false;
  crewdayzAvailabilities: CrewdayzTeamAvailability[] = [];
  crewdayzMappings: RoadmapMappingRoleProfile[] = [];
  capacitySourceConfigs: CapacitySourceConfig[] = [];
  roleAttachmentsList: RoleAttachment[] = [];
  Sliders = Sliders;
  Zap = Zap;
  Database = Database;
  LoaderCircle = LoaderCircle;
  isSaving: boolean = false;

  constructor(
    private teamService: TeamService,
    private calendarService: CalendarService,
    private rolesService: RolesService,
    private crewdayzService: CrewdayzIntegrationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  expandAll() {
    this.isDefaultExpanded = true;
    this.manualStates.clear();
    this.filteredTeamRows.forEach((r) => (r.expanded = true));
  }

  collapseAll() {
    this.isDefaultExpanded = false;
    this.manualStates.clear();
    this.filteredTeamRows.forEach((r) => (r.expanded = false));
  }

  async ngOnInit() {
    this.generateWeeks();
    await this.loadData({ showSkeleton: true });

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

        // Check selection toolbar visibility on scroll if it is visible
        if (this.selectedCells.length > 0 && this.isSelectionFinished) {
          this.checkToolbarVisibilityOnScroll();
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
    this.updateDisplayedYears();
  }

  async loadData(options: LoadDataOptions = {}) {
    const showSkeleton = options.showSkeleton ?? true;
    let timer: any = null;
    if (showSkeleton) {
      timer = setTimeout(() => {
        this.showSkeleton = true;
        this.cdr.markForCheck();
      }, 250);
    } else {
      this.isSaving = true;
      this.cdr.markForCheck();
    }

    try {
      const startDateStr = this.calendarService.formatWeekStart(this.displayedWeeks[0]);
      const endDateStr = this.calendarService.formatWeekStart(this.displayedWeeks[this.displayedWeeks.length - 1]);

      // 1️⃣ Load ALL data in parallel (including Crewdayz RPCs & mappings)
      const [equipes, allCapacities, roles, personnes, roleAtts, mappings, availabilities, sourceConfigs] = await Promise.all([
        this.teamService.getAllEquipes(),
        this.teamService.getAllCapacities(),
        this.teamService.getAllRoles(),
        this.teamService.getAllPersonnes(),
        this.rolesService.getAllRoleAttachments(),
        this.crewdayzService.getMappings(),
        this.crewdayzService.getAvailabilities(startDateStr, endDateStr),
        this.crewdayzService.getCapacitySourceConfigs(),
      ]);

      this.availableRoles = roles;
      this.availablePersonnes = personnes;
      this.allEquipes = equipes;
      this.roleAttachmentsList = roleAtts;
      this.crewdayzMappings = mappings;
      this.crewdayzAvailabilities = availabilities;
      this.capacitySourceConfigs = sourceConfigs;

      // Load all resources for all teams in parallel
      const allResourcesArrays = await Promise.all(
        equipes.map((equipe) => this.teamService.getEquipeResources(equipe.id!)),
      );

      // 2️⃣ Index capacities by resource for O(1) lookup
      const capacitiesByResource = new Map<string, Capacite[]>();
      allCapacities.forEach((cap) => {
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

        const resourceRows: ResourceRow[] = resources.map((resource) => {
          const key = `${resource.id}_${resource.type}_${equipe.id}`;
          const capacites = capacitiesByResource.get(key) || [];
          const weeks = new Map<string, number>();

          capacites.forEach((cap) => {
            const weekStr = this.calendarService.formatWeekStart(new Date(cap.semaine_debut));
            weeks.set(weekStr, cap.capacite);
          });

          return {
            type: resource.type,
            id: resource.id,
            uniqueId: resource.uniqueId,
            label: resource.type === 'role' ? resource.nom : `${resource.prenom} ${resource.nom}`,
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
      console.error('Error loading data:', error);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      if (this.showSkeleton) {
        this.showSkeleton = false;
      }
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  get filteredTeamRows(): TeamRow[] {
    let rows = this.teamRows;

    // Filter by team
    if (this.selectedTeamIds().length > 0) {
      rows = rows.filter((tr) => this.selectedTeamIds().includes(tr.equipe.id!));
    }

    // Filter by resource search OR multi-select (by name)
    if (this.selectedResourceNames.size > 0) {
      rows = rows
        .map((tr) => ({
          ...tr,
          resources: tr.resources.filter((r) => this.selectedResourceNames.has(r.label)),
        }))
        .filter((tr) => tr.resources.length > 0);
    } else if (this.resourceSearch.trim()) {
      const search = this.resourceSearch.trim();
      rows = rows
        .map((tr) => ({
          ...tr,
          resources: tr.resources.filter((r) => textContains(r.label, search)),
        }))
        .filter((tr) => tr.resources.length > 0);
    }

    return rows;
  }

  get allResources(): ResourceRow[] {
    const all: ResourceRow[] = [];
    const seenLabels = new Set<string>();
    this.teamRows.forEach((tr) => {
      tr.resources.forEach((r) => {
        if (!seenLabels.has(r.label)) {
          seenLabels.add(r.label);
          all.push(r);
        }
      });
    });
    return all.sort((a, b) => a.label.localeCompare(b.label));
  }

  get filteredResourceList(): ResourceRow[] {
    const search = this.resourceSearch.trim();
    if (!search) return this.allResources;
    return this.allResources.filter((r) => textContains(r.label, search));
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
    this.showTeamDropdown = false;
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

  toggleTeamDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showResourceDropdown = false;
    this.showTeamDropdown = !this.showTeamDropdown;

    if (this.showTeamDropdown) {
      const closeHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.team-dropdown-container')) {
          this.showTeamDropdown = false;
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }
  }

  toggleTeamSelection(id: string) {
    const current = this.selectedTeamIds();
    if (current.includes(id)) {
      this.selectedTeamIds.set(current.filter((x) => x !== id));
    } else {
      this.selectedTeamIds.set([...current, id]);
    }
  }

  isTeamSelected(id: string): boolean {
    return this.selectedTeamIds().includes(id);
  }

  getTeamFilterLabel(): string {
    const current = this.selectedTeamIds();
    if (current.length === 0) {
      return 'Toutes les équipes';
    }
    if (current.length === 1) {
      const id = current[0];
      const eq = this.allEquipes.find((e) => e.id === id);
      return eq ? eq.nom : 'Toutes les équipes';
    }
    return `${current.length} équipes`;
  }

  clearSelectedTeams() {
    this.selectedTeamIds.set([]);
  }

  formatWeekHeader(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  getWeekNumber(date: Date): number {
    return this.calendarService.getWeekNumber(date);
  }

  isYearChangeMap: boolean[] = [];

  updateDisplayedYears() {
    this.displayedYears = [];
    this.isYearChangeMap = [];
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return;

    const yearsMap: { year: number; weeksCount: number }[] = [];
    this.displayedWeeks.forEach((week, index) => {
      const year = this.calendarService.getWeekYear(week);
      const last = yearsMap[yearsMap.length - 1];
      if (last && last.year === year) {
        last.weeksCount++;
      } else {
        yearsMap.push({ year, weeksCount: 1 });
      }

      if (index === 0) {
        this.isYearChangeMap.push(false);
      } else {
        const prevYear = this.calendarService.getWeekYear(this.displayedWeeks[index - 1]);
        this.isYearChangeMap.push(year !== prevYear);
      }
    });
    this.displayedYears = yearsMap;
  }

  isFirstWeekOfYear(index: number): boolean {
    return this.isYearChangeMap[index] ?? false;
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
    this.resourceTypeToAdd = 'role';
    this.selectedResourceId = '';
    this.showAddResourceModal = true;

    // Load only available roles (not already attached to this team)
    this.availableRoles = await this.teamService.getAvailableRolesForEquipe(equipe.id!);

    // Load only available persons (not already attached to this team)
    this.availablePersonnes = await this.teamService.getAvailablePersonnesForEquipe(equipe.id!);
  }

  async addResourceToTeam() {
    if (!this.selectedEquipe || !this.selectedResourceId) return;

    try {
      if (this.resourceTypeToAdd === 'role') {
        await this.teamService.addRoleToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      } else {
        await this.teamService.addPersonneToEquipe(this.selectedEquipe.id!, this.selectedResourceId);
      }

      this.showAddResourceModal = false;
      await this.loadData({ showSkeleton: false });
    } catch (error: any) {
      console.error('Error adding resource:', error);
      // Display user-friendly error message
      if (error.message && error.message.includes('déjà attaché')) {
        alert(error.message);
      } else {
        alert("Erreur lors de l'ajout de la ressource. Veuillez réessayer.");
      }
    }
  }

  async removeResource(resource: ResourceRow, equipe: Equipe) {
    this.confirmTitle = 'Supprimer la ressource';
    this.confirmMessage = `Retirer ${resource.label} de l'équipe ${equipe.nom} ?`;

    this.pendingConfirmAction = async () => {
      try {
        if (resource.type === 'role') {
          await this.teamService.removeRoleFromEquipe(resource.id, equipe.id!);
        } else {
          await this.teamService.removePersonneFromEquipe(resource.id);
        }
        await this.loadData({ showSkeleton: false });
      } catch (error) {
        console.error('Error removing resource:', error);
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
    const tooltipHeight = 40; // Estimated

    if (x + tooltipWidth > window.innerWidth) {
      x = event.clientX - tooltipWidth - offsetX;
    }

    if (y + tooltipHeight > window.innerHeight) {
      y = event.clientY - tooltipHeight - offsetY;
    }

    this.tooltipX = x;
    this.tooltipY = y;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showResourceDropdown = false;
    this.showTeamDropdown = false;
    this.showAddResourceModal = false;
    this.showConfirmModal = false;
    this.showYearPopover = false;
    this.clearSelection();
    this.cdr.markForCheck();
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow) {
    this.isDragging = true;
    this.isSelectionFinished = false;
    this.dragStartResource = resource;
    this.bulkCapaciteValue = null;

    const target = event.target as HTMLElement;
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
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
    const cell = target.closest('.week-cell');
    if (cell) {
      const indexStr = cell.getAttribute('data-week-index');
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
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.selectedCells.length > 0) {
      this.isSelectionFinished = true;

      // If a single cell is selected, show its existing value
      if (this.selectedCells.length === 1) {
        const cell = this.selectedCells[0];
        const val = this.getCapacite(cell.resource, cell.week);
        this.bulkCapaciteValue = val > 0 ? val : null;
      } else {
        this.bulkCapaciteValue = null;
      }

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

          // Check if cell is scrolled out of the visible area
          const wrapperEl = document.querySelector('.calendar-wrapper');
          const headerEl = document.querySelector('.calendar-header-row');
          const labelEl = rowElement.querySelector('.label-cell');

          if (wrapperEl && headerEl && labelEl) {
            const wrapperRect = wrapperEl.getBoundingClientRect();
            const headerRect = headerEl.getBoundingClientRect();
            const labelRect = labelEl.getBoundingClientRect();

            const visibleTop = headerRect.bottom;
            const visibleBottom = wrapperRect.bottom;
            const visibleLeft = labelRect.right;
            const visibleRight = wrapperRect.right;

            const cellIsHidden =
              rect.bottom <= visibleTop || // Scrolled under header
              rect.top >= visibleBottom || // Scrolled below viewport
              rect.right <= visibleLeft || // Scrolled left under label column
              rect.left >= visibleRight; // Scrolled right off screen

            if (cellIsHidden) {
              this.toolbarVisible = false;
              this.cdr.markForCheck();
              return;
            }
          }

          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          const pos = calculateBestToolbarPosition({
            rect,
            viewportWidth,
            viewportHeight,
            dragStartWeekIndex: this.dragStartWeekIndex,
            dragEndWeekIndex: this.dragEndWeekIndex,
            bottomSafetyMargin: 150,
            rightSafetyMargin: 320,
          });

          // Convert viewport coordinates to calendar-wrapper relative absolute coordinates
          if (wrapperEl) {
            const wrapperRect = wrapperEl.getBoundingClientRect();
            this.toolbarPosition = {
              top: pos.top - wrapperRect.top + wrapperEl.scrollTop,
              left: pos.left - wrapperRect.left + wrapperEl.scrollLeft,
              transform: pos.transform,
            };
          } else {
            this.toolbarPosition = pos;
          }

          // Make toolbar visible now that position is set
          this.toolbarVisible = true;
          this.cdr.markForCheck();
        }
      }
    }, 0);
  }

  checkToolbarVisibilityOnScroll() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

    const rowSelector = `[data-resource-id="${this.dragStartResource.uniqueId}"]`;
    const rowElement = document.querySelector(rowSelector);

    if (rowElement) {
      const cellSelector = `[data-week-index="${this.dragEndWeekIndex}"]`;
      const cellElement = rowElement.querySelector(cellSelector);

      if (cellElement) {
        const rect = cellElement.getBoundingClientRect();
        const wrapperEl = document.querySelector('.calendar-wrapper');
        const headerEl = document.querySelector('.calendar-header-row');
        const labelEl = rowElement.querySelector('.label-cell');

        if (wrapperEl && headerEl && labelEl) {
          const wrapperRect = wrapperEl.getBoundingClientRect();
          const headerRect = headerEl.getBoundingClientRect();
          const labelRect = labelEl.getBoundingClientRect();

          const visibleTop = headerRect.bottom;
          const visibleBottom = wrapperRect.bottom;
          const visibleLeft = labelRect.right;
          const visibleRight = wrapperRect.right;

          // Check if cell is completely outside the visible scroll bounds
          const cellIsHidden =
            rect.bottom <= visibleTop || // Scrolled under header
            rect.top >= visibleBottom || // Scrolled below viewport
            rect.right <= visibleLeft || // Scrolled left under label column
            rect.left >= visibleRight; // Scrolled right off screen

          const shouldBeVisible = !cellIsHidden;
          if (this.toolbarVisible !== shouldBeVisible) {
            this.toolbarVisible = shouldBeVisible;
            this.cdr.detectChanges();
          }
        }
      }
    }
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
      (s) => s.resource.uniqueId === resource.uniqueId && s.week.getTime() === week.getTime(),
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
    this.bulkCapaciteValue = null;
  }

  async applyBulkCapacite(value: number | null) {
    // Autorise 0, bloque seulement null et undefined
    if (this.selectedCells.length === 0 || value == null) return;

    this.bulkCapaciteValue = value;
    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      for (const cell of this.selectedCells) {
        const weekStr = this.calendarService.formatWeekStart(cell.week);
        await this.teamService.saveCapacite(
          cell.resource.id,
          cell.resource.type,
          cell.resource.equipeId,
          weekStr,
          this.bulkCapaciteValue,
        );

        // Update local data
        cell.resource.weeks.set(weekStr, this.bulkCapaciteValue);
      }

      this.clearSelection();
    } catch (error) {
      console.error('Error saving capacities:', error);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async applyCapacityProjection(data: { resources: number; totalDays: number }) {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      // Find the earliest selected week to start from
      const sortedCells = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
      const firstCell = sortedCells[0];
      const startWeekIdx = this.displayedWeeks.findIndex((w) => w.getTime() === firstCell.week.getTime());

      if (startWeekIdx === -1) return;

      const resourceRow = firstCell.resource;
      const daysPerWeek = resourceRow.jours_par_semaine || 5;

      // Calculate how many weeks are needed (rounded up)
      const nbWeeks = Math.ceil(data.totalDays / (data.resources * daysPerWeek));

      for (let i = 0; i < nbWeeks; i++) {
        const currentTargetIdx = startWeekIdx + i;
        if (currentTargetIdx >= this.displayedWeeks.length) break;

        const targetWeek = this.displayedWeeks[currentTargetIdx];
        const weekStr = this.calendarService.formatWeekStart(targetWeek);

        await this.teamService.saveCapacite(
          resourceRow.id,
          resourceRow.type,
          resourceRow.equipeId,
          weekStr,
          data.resources,
        );

        // Update local data for immediate UI feedback
        resourceRow.weeks.set(weekStr, data.resources);
      }

      this.clearSelection();
    } catch (error) {
      console.error('Error applying generic capacity projection:', error);
      alert("Erreur lors de l'application de la projection.");
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // Sum of days (capacite * jours_par_semaine) for currently selected cells
  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      // Prioritize the bulk input value if it has been set by the user
      const cap =
        this.bulkCapaciteValue !== null ? this.bulkCapaciteValue : this.getCapacite(cell.resource, cell.week) || 0;
      const jours = cell.resource.jours_par_semaine || 0;
      total += cap * jours;
    }
    return total;
  }

  async loadCrewdayzAvailabilities() {
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return;
    const startDateStr = this.calendarService.formatWeekStart(this.displayedWeeks[0]);
    const endDateStr = this.calendarService.formatWeekStart(this.displayedWeeks[this.displayedWeeks.length - 1]);

    try {
      this.crewdayzAvailabilities = await this.crewdayzService.getAvailabilities(startDateStr, endDateStr);
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Erreur lors du chargement des disponibilités Crewdayz :', err);
    }
  }

  async goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateWeeks();
    await this.loadCrewdayzAvailabilities();
  }

  async goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateWeeks();
    await this.loadCrewdayzAvailabilities();
  }

  async goToToday() {
    this.currentDate = new Date();
    this.generateWeeks();
    await this.loadCrewdayzAvailabilities();
  }

  getTeamTotalCapacity(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce((sum, resource) => sum + this.getCapacite(resource, week), 0);
  }

  getTeamTotalDays(teamRow: TeamRow, week: Date): number {
    return teamRow.resources.reduce(
      (sum, resource) => sum + this.getCapacite(resource, week) * resource.jours_par_semaine,
      0,
    );
  }

  formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getResourceTotalPlannedDays(resource: ResourceRow): number {
    let total = 0;
    resource.weeks.forEach((val, weekStr) => {
      if (this.selectedCapacityYear === 'today') {
        const todayWeekStart = this.calendarService.getWeekStart(new Date());
        const todayWeekStartStr = this.formatLocalDate(todayWeekStart);
        if (weekStr >= todayWeekStartStr) {
          total += val * resource.jours_par_semaine;
        }
      } else if (this.selectedCapacityYear === 'custom' && this.selectedStartDate) {
        const selectedStartStr = this.formatLocalDate(this.selectedStartDate);
        if (weekStr >= selectedStartStr) {
          total += val * resource.jours_par_semaine;
        }
      } else {
        const [y, m, d] = weekStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
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
      popoverWidth: 160,
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

  getCrewdayzDispo(resource: ResourceRow, week: Date): number | null {
    if (!this.crewdayzMappings || this.crewdayzMappings.length === 0) return null;
    const weekStr = this.calendarService.formatWeekStart(week);

    const attachmentOrTeamId = resource.type === 'role' ? resource.uniqueId : resource.equipeId;
    const personneId = resource.type === 'personne' ? resource.id : null;

    return this.crewdayzService.calculateAvailableCount(
      weekStr,
      attachmentOrTeamId,
      personneId,
      resource.equipeId,
      this.crewdayzAvailabilities,
      this.crewdayzMappings
    );
  }

  /**
   * Retourne la source de capacité effective pour une équipe donnée.
   * Utilisé pour l'affichage du badge dans le template.
   */
  getSourceForTeam(equipeId: string): 'roadmap' | 'crewdayz' {
    return this.crewdayzService.getSourceForTeam(equipeId, this.capacitySourceConfigs);
  }

  openCrewdayzMappingModal() {
    this.showCrewdayzMappingModal = true;
  }

  async onCrewdayzMappingSaved() {
    await this.loadData({ showSkeleton: false });
  }
}
