import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener, NgModule, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, OnDestroy, computed } from "@angular/core";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TeamService } from "../../services/team.service";
import { ProjetService } from "../../services/projet.service";
import { ChargeService } from "../../services/charge.service";
import { RolesService } from "../../services/roles.service";
import { JalonService } from "../../services/jalon.service";
import { Equipe, Projet, Charge, Role, Personne, Capacite, Jalon, Service, PROJECT_STATUS_LIST } from "../../models/types";
import { CalendarService } from "../../services/calendar.service";
import { PersonnesService } from "../../services/personnes.service";
import { ChiffresService } from "../../services/chiffres.service";
import { Chiffre } from "../../models/chiffres.type";
import { ResourceService } from "../../services/resource.service";

import { LucideAngularModule, Plus, ChevronDown, ChevronRight, User, Contact, X, SquarePlus, SquareMinus, ExternalLink, FunnelPlus, FunnelX, FileDown, LucideCalculator, Search, MoreVertical, ListTree, AlignJustify, Eye, EyeOff, Calendar, ChevronLeft, Network, Users, BookUser, Settings2, GripVertical, ArrowUp, ArrowDown, Play, AlertTriangle, Filter, Info, Trash2 } from "lucide-angular";
import * as XLSX from 'xlsx';
import { getISOWeekYear } from "date-fns";
import { calculateBestToolbarPosition, calculateBestPopoverPosition, ToolbarPosition, PopoverPosition } from "../../utils/selection-positioning";
import { SelectionToolbarComponent } from "../selection-toolbar.component";
import { ProjectModalComponent } from "../project-modal.component";
import { SettingsService } from "../../services/settings.service";
import { storageSignal } from "../../utils/storage-signal";
import { signal } from "@angular/core";
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { calculateNewRank, sortByRank } from '../../utils/lexorank.utils';
import { driver } from "driver.js";

@NgModule({
  imports: [LucideAngularModule.pick({ Plus, ChevronDown, ChevronRight, User, Contact, X, SquarePlus, SquareMinus, ExternalLink, FunnelPlus, FunnelX, FileDown, LucideCalculator, Search, MoreVertical, ListTree, AlignJustify, Eye, EyeOff, Calendar, ChevronLeft, Network, Users, BookUser, Settings2, GripVertical, ArrowUp, ArrowDown, Play, AlertTriangle, Filter, Info, Trash2 })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

import { MilestoneModalComponent } from '../milestones/milestone-modal.component';
import { ConfirmModalComponent } from '../confirm-modal.component';
import { ChiffresModalComponent } from '../chiffres/chiffres-modal.component';

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
  code?: string;
  reference_externe?: string;
  cellData?: ResourceCellData[];
  metrics?: Map<string, { total: number }>;
}

interface ChildRow {
  id: string;
  label: string;
  code?: string;
  reference_externe?: string;
  color?: string;
  expanded: boolean;
  resources: ResourceRow[];
  charges: Map<string, number>; // week string -> amount
  originalProject?: Projet;
  metrics?: Map<string, { total: number }>;
}

interface ParentRow {
  id: string;
  label: string;
  code?: string;
  reference_externe?: string;
  color?: string;
  expanded: boolean;
  children: ChildRow[];
  totalCharges: Map<string, number>; // week string -> amount
  originalProject?: Projet;
  metrics?: Map<string, { total: number; capacity: number; availability: number; status: 'positive' | 'zero' | 'negative' | 'none' }>;
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
  imports: [CommonModule, FormsModule, LucideIconsModule, MilestoneModalComponent, SelectionToolbarComponent, ConfirmModalComponent, ProjectModalComponent, DragDropModule, ChiffresModalComponent],
  templateUrl: "./plan-view.component.html",
  styleUrl: "./plan-view.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanViewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tooltipElement') tooltipElement?: ElementRef<HTMLElement>;
  @ViewChild('dragProjectionTooltip') dragProjectionTooltip?: ElementRef<HTMLElement>;
  @ViewChild('headerRow') headerRowElement?: ElementRef<HTMLElement>;
  @ViewChild('milestonesRow') milestonesRowElement?: ElementRef<HTMLElement>;

  private resizeObserver?: ResizeObserver;

  // Milestone Modal props
  showMilestoneModal = false;
  selectedJalon: Jalon | null = null;

  openMilestoneModal(jalon: Jalon, event: Event) {
    event.stopPropagation();
    this.selectedJalon = jalon;
    this.showMilestoneModal = true;
  }

  // Chiffres Modal props
  showChiffresModal = false;
  selectedProjetId: number | null = null;

  async onMilestoneSaved() {
    await this.loadData();
  }

  onOpenChiffresFromProject(idProjet: number) {
    this.selectedProjetId = idProjet;
    this.showChiffresModal = true;
  }

  closeChiffresModal() {
    this.showChiffresModal = false;
    this.selectedProjetId = null;
  }

  viewMode = storageSignal<"project" | "team" | "resource">("plan-view-mode", "resource");
  displayFormat = storageSignal<"tree" | "flat">("plan-view-display-format", "tree");
  zoomLevel = storageSignal<"compact" | "normal">("plan-view-zoom-level", "normal");
  showAvailability = storageSignal<boolean>("plan-view-show-availability", false);
  weekFilters = storageSignal<number[]>("plan-view-week-filters", []);
  chiffreMode = storageSignal<'initial' | 'revise' | 'previsionnel' | 'consomme' | 'restant'>("plan-view-chiffre-mode", "previsionnel");
  planningMode = storageSignal<'saisie' | 'visualisation'>('plan-view-planning-mode', 'saisie');
  displayedMonths: Array<{ key: string; label: string; year: number; quarterLabel: string; startWeekNum: number; weeks: Date[] }> = [];
  showGlobalFilters = signal<boolean>(false);
  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();
  private tutorialStarted = false;

  selectedCapacityYear = storageSignal<'today' | 'all' | '2025' | '2026' | 'custom'>("plan-view-capacity-year", "today");
  private globalMouseMoveListener?: () => void;
  private globalMouseUpListener?: () => void;
  private scrollCloseListener?: () => void;

  selectedStartDate: Date | null = null;
  showYearPopover = false;
  showChiffrePopover = false;
  chiffrePopoverPosition: PopoverPosition | null = null;
  chiffrePopoverArrowSide: 'top' | 'bottom' = 'top';
  activeChiffreAnchorId: string | null = null;
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

  @HostListener("document:keydown.escape")
  onEscape() {
    this.openEquipeDropdown = false;
    this.openProjetDropdown = false;
    this.openResourceDropdown = false;
    this.openStatusDropdown = false;
    this.showPeriodDropdown = false;
    this.openSizeDropdown = false;
    this.openJalonDropdown = false;
    this.showYearPopover = false;
    this.showChiffrePopover = false;
    this.clearSelection();
    this.cdr.markForCheck();
  }

  flatRows: FlatRow[] = [];

  // Capacity Index for O(1) lookups: teamId_type_resourceId_weekKey -> capacity
  private capacityIndex = new Map<string, number>();

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

  // Chiffres Triskell
  allChiffres: Chiffre[] = [];
  allServices: Service[] = [];

  // Filters
  rowsAll: ParentRow[] = [];
  filterEquipeIds = storageSignal<string[]>("plan-view-filter-equipes", []);
  filterProjetIds = storageSignal<string[]>("plan-view-filter-projets", []);
  filterProjetSearch = storageSignal<string>("plan-view-filter-search", "");
  filterResourceIds = storageSignal<string[]>("plan-view-filter-resources", []); // values like 'role:<id>' or 'personne:<id>'
  filterStatusIds = storageSignal<string[]>("plan-view-filter-statuses", []);
  filterJalonTypes = storageSignal<string[]>("plan-view-filter-jalon-types", []);

  // Period filter (default: current week → +6 months; empty string = use default)
  filterPeriodEnabled = signal<boolean>(false);
  filterPeriodStart   = storageSignal<string>("plan-view-filter-period-start", "");
  filterPeriodEnd     = storageSignal<string>("plan-view-filter-period-end", "");

  // Size filter
  filterSizeEnabled = signal<boolean>(false);
  filterSizeCriterion = storageSignal<'charges_today' | 'charges_all' | 'charges_2025' | 'charges_2026' | 'chiffre_initial' | 'chiffre_revise' | 'chiffre_previsionnel' | 'chiffre_consomme'>("plan-view-filter-size-criterion", "charges_all");
  filterSizeOperator = storageSignal<'gte' | 'lte'>("plan-view-filter-size-operator", "gte");
  filterSizeValue = storageSignal<number | null>("plan-view-filter-size-value", null);

  isAnyFilterActiveExceptTeam = computed(() => {
    const hasSearch = this.globalSearch().trim().length > 0;
    const hasProjectFilter = this.filterProjetIds().length > 0 || this.filterProjetSearch().trim().length > 0;
    const hasStatusFilter = this.filterStatusIds().length > 0;
    const hasResourceFilter = this.filterResourceIds().length > 0;
    const hasWeekFilter = this.weekFilters().length > 0;
    const hasPeriod = this.filterPeriodEnabled();
    const hasSize = this.filterSizeEnabled() && this.filterSizeValue() !== null;

    return hasSearch || hasProjectFilter || hasStatusFilter || hasResourceFilter || hasWeekFilter || hasPeriod || hasSize;
  });

  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.globalSearch().trim()) count++;
    if (this.filterEquipeIds().length) count += this.filterEquipeIds().length;
    if (this.filterProjetIds().length) count += this.filterProjetIds().length;
    if (this.filterStatusIds().length) count += this.filterStatusIds().length;
    if (this.filterResourceIds().length) count += this.filterResourceIds().length;
    if (this.filterPeriodEnabled()) count++;
    if (this.filterSizeEnabled() && this.filterSizeValue() !== null) count++;
    if (this.weekFilters().length) count += this.weekFilters().length;
    return count;
  });

  activeFiltersSummary = computed(() => {
    const parts: string[] = [];
    if (this.globalSearch().trim()) parts.push("Recherche");
    
    const eqCount = this.filterEquipeIds().length;
    if (eqCount > 0) parts.push(`${eqCount} équipe${eqCount > 1 ? 's' : ''}`);

    const prCount = this.filterProjetIds().length;
    if (prCount > 0) parts.push(`${prCount} projet${prCount > 1 ? 's' : ''}`);

    const stCount = this.filterStatusIds().length;
    if (stCount > 0) parts.push(`${stCount} statut${stCount > 1 ? 's' : ''}`);

    const resCount = this.filterResourceIds().length;
    if (resCount > 0) parts.push(`${resCount} ressource${resCount > 1 ? 's' : ''}`);

    if (this.filterPeriodEnabled()) parts.push("Période");
    if (this.filterSizeEnabled() && this.filterSizeValue() !== null) parts.push("Taille");

    const wkCount = this.weekFilters().length;
    if (wkCount > 0) parts.push(`${wkCount} semaine${wkCount > 1 ? 's' : ''}`);

    return parts.join(', ');
  });

  clearAllFilters() {
    this.globalSearch.set('');
    this.filterEquipeIds.set([]);
    this.filterProjetIds.set([]);
    this.filterProjetSearch.set('');
    this.filterResourceIds.set([]);
    this.filterStatusIds.set([]);
    this.filterPeriodEnabled.set(false);
    this.filterPeriodStart.set('');
    this.filterPeriodEnd.set('');
    this.filterSizeEnabled.set(false);
    this.filterSizeValue.set(null);
    this.weekFilters.set([]);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  reorderMessage = signal<string | null>(null);
  private reorderMessageTimeout?: any;

  showReorderMessage(msg: string) {
    if (this.reorderMessageTimeout) clearTimeout(this.reorderMessageTimeout);
    this.reorderMessage.set(msg);
    this.cdr.markForCheck();
    this.reorderMessageTimeout = setTimeout(() => {
      this.reorderMessage.set(null);
      this.cdr.markForCheck();
    }, 4000);
  }

  readonly PROJECT_STATUSES = PROJECT_STATUS_LIST;

  // Dropdown states
  openEquipeDropdown = false;
  openProjetDropdown = false;
  openResourceDropdown = false;
  openStatusDropdown = false;
  showPeriodDropdown = false;
  openSizeDropdown = false;
  openJalonDropdown = false;

  // Actions menu state
  showActionsMenu = false;
  activeActionsSubmenu: string | null = null;

  // Line context menu state
  activeLineMenuId: string | null = null;
  lineMenuPosition = { x: 0, y: 0 };

  // Global search
  globalSearch = storageSignal<string>('plan-view-global-search', '');
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Link Modal State
  showLinkModal = false;
  selectedParentRow: ParentRow | null = null;
  selectedChildRowToLink: ChildRow | null = null;
  linkableItems: { id: string; label: string; type?: 'role' | 'personne' }[] = [];
  selectedIdToLink: string = ""; // kept for project mode (select)

  // Bulk-select (Gmail-style)
  selectedIdsToLink: Set<string> = new Set();
  linkModalSearchQuery: string = '';
  linkModalStatusFilter: string = '';
  linkModalIsSaving: boolean = false;

  get filteredLinkableItems(): { id: string; label: string; type?: 'role' | 'personne' }[] {
    const q = this.linkModalSearchQuery.trim().toLowerCase();
    const s = this.linkModalStatusFilter;
    return this.linkableItems.filter(item => {
      const proj = this.allProjects.find(p => p.id === item.id);
      const matchSearch = !q ||
        item.label.toLowerCase().includes(q) ||
        (proj?.code_projet || '').toLowerCase().includes(q) ||
        (proj?.reference_externe || '').toLowerCase().includes(q);
      const matchStatus = !s || (proj?.statut || '') === s;
      return matchSearch && matchStatus;
    });
  }

  get isAllFilteredSelected(): boolean {
    const filtered = this.filteredLinkableItems;
    return filtered.length > 0 && filtered.every(i => this.selectedIdsToLink.has(i.id));
  }

  get isSelectionIndeterminate(): boolean {
    const filtered = this.filteredLinkableItems;
    const count = filtered.filter(i => this.selectedIdsToLink.has(i.id)).length;
    return count > 0 && count < filtered.length;
  }

  isLinkSelected(id: string): boolean {
    return this.selectedIdsToLink.has(id);
  }

  toggleLinkSelection(id: string): void {
    if (this.selectedIdsToLink.has(id)) {
      this.selectedIdsToLink.delete(id);
    } else {
      this.selectedIdsToLink.add(id);
    }
    this.selectedIdsToLink = new Set(this.selectedIdsToLink); // trigger CD
  }

  toggleAllLinkSelection(): void {
    if (this.isAllFilteredSelected) {
      this.filteredLinkableItems.forEach(i => this.selectedIdsToLink.delete(i.id));
    } else {
      this.filteredLinkableItems.forEach(i => this.selectedIdsToLink.add(i.id));
    }
    this.selectedIdsToLink = new Set(this.selectedIdsToLink); // trigger CD
  }

  clearLinkSelection(): void {
    this.selectedIdsToLink = new Set();
  }

  getLinkableProjectData(id: string): import('../../models/types').Projet | undefined {
    return this.allProjects.find(p => p.id === id);
  }

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

  // Value of the first dragged cell (used for pre-fill & live projection tooltip)
  dragStartCellValue: number | null = null;
  dragProjectionTooltipVisible: boolean = false;

  get selectionStartWeekDate(): Date | null {
    if (this.selectedCells.length === 0) return null;
    const sorted = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
    return sorted[0].week;
  }

  get selectionDaysPerWeek(): number {
    return this.selectedCells.length > 0 ? (this.selectedCells[0].resource.jours_par_semaine || 5) : 5;
  }

  /** Projected days shown in the live drag tooltip: nbWeeks × dragStartCellValue × daysPerWeek */
  get dragProjectionDays(): number {
    if (!this.dragStartCellValue || this.dragStartCellValue <= 0) return 0;
    const nbWeeks = this.selectedCells.length;
    const daysPerWeek = this.dragStartResource?.jours_par_semaine || 5;
    return nbWeeks * this.dragStartCellValue * daysPerWeek;
  }

  bulkChargeValue: number | null = null;
  isSaving = false;

  // Moving logic
  isMovingSelection = false;
  isMoveCommitting = false; // true while API calls in progress, ghost stays visible
  isOverSelectionBorder = false;
  moveStartWeekIndex = -1;
  moveGhostOffset = 0; // horizontal offset in weeks
  moveDragBadgeX = 0;
  moveDragBadgeY = 0;
  private moveStartClientX = 0;
  private cellWidthPx = 80; // will be measured at drag start


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
  FileDown = FileDown;
  MoreVertical = MoreVertical;
  ListTree = ListTree;
  AlignJustify = AlignJustify;
  Eye = Eye;
  EyeOff = EyeOff;
  Calendar = Calendar;
  ChevronLeft = ChevronLeft;
  ChevronDown = ChevronDown;
  ChevronRight = ChevronRight;
  Network = Network;
  Users = Users;
  BookUser = BookUser;
  Settings2 = Settings2;
  Search = Search;
  LucideCalculator = LucideCalculator;
  GripVertical = GripVertical;
  ArrowUp = ArrowUp;
  ArrowDown = ArrowDown;
  Play = Play;
  Filter = Filter;
  Trash2 = Trash2;

  AlertTriangle = AlertTriangle;
  Info = Info;
  SquarePlus = SquarePlus;
  SquareMinus = SquareMinus;

  constructor(
    private teamService: TeamService,
    private projetService: ProjetService,
    private chargeService: ChargeService,
    private rolesService: RolesService,
    private calendarService: CalendarService,
    private jalonService: JalonService,
    private settingsService: SettingsService,
    private personnesService: PersonnesService,
    private chiffresService: ChiffresService,
    private resourceService: ResourceService,
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

  toggleGlobalFilters() {
    this.showGlobalFilters.set(!this.showGlobalFilters());
    if (!this.showGlobalFilters()) {
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.showPeriodDropdown = false;
      this.openSizeDropdown = false;
      this.openJalonDropdown = false;
    }
  }

  collapseAll() {
    this.isDefaultExpanded = false;
    this.manualStates.clear();
    this.rows.forEach(r => {
      r.expanded = false;
      r.children.forEach(c => c.expanded = false);
    });
  }

  exportToExcel() {
    // Build header row: fixed columns + one column per displayed week
    const weekHeaders = this.displayedWeeks.map(w => {
      const d = w.getDate().toString().padStart(2, '0');
      const m = (w.getMonth() + 1).toString().padStart(2, '0');
      const y = w.getFullYear();
      return `${d}/${m}/${y}`;
    });

    const headers = ['Projet', 'Code Projet', 'Réf Externe', 'Équipe', 'Ressource', 'Type', ...weekHeaders];

    const dataRows: (string | number)[][] = [];

    // Always iterate in project > team > resource order (mode-agnostic)
    // We iterate over allProjects sorted as in the tree, using the built rows
    for (const parent of this.rowsAll) {
      for (const child of parent.children) {
        for (const resource of child.resources) {
          // Determine Projet / Équipe / Ressource columns depending on viewMode
          let projet: string;
          let codeProjet: string;
          let referenceExterne: string = '';
          let equipe: string;
          let ressource: string;

          if (this.viewMode() === 'project') {
            // parent = project, child = team
            projet = parent.label;
            codeProjet = parent.code || '';
            referenceExterne = parent.reference_externe || '';
            equipe = child.label;
            ressource = resource.label;
          } else if (this.viewMode() === 'team') {
            // parent = team, child = project
            projet = child.label;
            codeProjet = child.code || '';
            referenceExterne = child.reference_externe || '';
            equipe = parent.label;
            ressource = resource.label;
          } else {
            // resource mode: parent = team, child = resource (label), resource = project
            projet = resource.label;
            codeProjet = resource.code || '';
            referenceExterne = resource.reference_externe || '';
            equipe = parent.label;
            ressource = child.label;
          }

          const weekValues = this.displayedWeeks.map(w => {
            const weekKey = w.toISOString().split('T')[0];
            const val = resource.charges.get(weekKey);
            return (val === 0 || val === undefined) ? '' : val;
          });

          dataRows.push([projet, codeProjet, referenceExterne, equipe, ressource, resource.type, ...weekValues]);
        }
      }
    }

    // Sort by Projet > Équipe > Ressource
    dataRows.sort((a, b) => {
      const pa = (a[0] as string).localeCompare(b[0] as string);
      if (pa !== 0) return pa;
      const ea = (a[3] as string).localeCompare(b[3] as string); // Adjusted index for 'Équipe'
      if (ea !== 0) return ea;
      return (a[4] as string).localeCompare(b[4] as string); // Adjusted index for 'Ressource'
    });

    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-width for fixed columns
    ws['!cols'] = [
      { wch: 30 }, // Projet
      { wch: 12 }, // Code Projet
      { wch: 15 }, // Réf Externe
      { wch: 20 }, // Équipe
      { wch: 24 }, // Ressource
      { wch: 10 }, // Type
      ...weekHeaders.map(() => ({ wch: 12 }))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planification');

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    XLSX.writeFile(wb, `planification_${dateStr}.xlsx`);
  }

  private externalReferenceUrlQuery = this.settingsService.getSettingQuery("external_reference_url", "global");
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);

  ngOnInit() {
    this.loadData();
    this.generateWeeks();

    // Setup debounced search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.globalSearch.set(value);
      this.applyFilters();
      this.cdr.markForCheck();
    });

    this.ngZone.runOutsideAngular(() => {
      const mouseListener = (event: MouseEvent) => this.onGlobalMouseMove(event);
      window.addEventListener('mousemove', mouseListener);
      this.globalMouseMoveListener = () => window.removeEventListener('mousemove', mouseListener);

      const mouseUpListener = (event: MouseEvent) => this.onGlobalMouseUp(event);
      window.addEventListener('mouseup', mouseUpListener);
      this.globalMouseUpListener = () => window.removeEventListener('mouseup', mouseUpListener);

      // Close popovers on scroll so they don't detach from their anchor badge
      const scrollHandler = () => {
        if (this.showYearPopover || this.showChiffrePopover) {
          this.ngZone.run(() => {
            this.showYearPopover = false;
            this.activeAnchorId = null;
            this.showChiffrePopover = false;
            this.activeChiffreAnchorId = null;
            this.cdr.markForCheck();
          });
        }

        // Check selection toolbar visibility on scroll if it is visible
        if (this.selectedCells.length > 0 && this.isSelectionFinished && !this.isMovingSelection && !this.isSaving) {
          this.checkToolbarVisibilityOnScroll();
        }
      };
      // Attach to the calendar wrapper (the scrollable container)
      // Use capture phase to catch scroll on any child element
      document.addEventListener('scroll', scrollHandler, true);
      this.scrollCloseListener = () => document.removeEventListener('scroll', scrollHandler, true);
    });
  }

  ngAfterViewInit() {
    this.startTutorial();
    this.setupResizeObserver();
  }

  restartTutorial() {
    this.showActionsMenu = false;
    this.startTutorial(true);
  }

  private startTutorial(force = false) {
    const tutorialKey = "tutorial-actions-menu-v1";
    if (!force && (localStorage.getItem(tutorialKey) || this.tutorialStarted)) return;
    this.tutorialStarted = true;

    if (force) {
      this.runTutorialLogic(tutorialKey);
    } else {
      // We use a timeout to ensure data is loaded and DOM is fully rendered on first load
      setTimeout(() => this.runTutorialLogic(tutorialKey), 2000);
    }
  }

  private runTutorialLogic(tutorialKey: string) {
    // On ouvre les filtres globaux au début du tutoriel
    // pour s'assurer que la barre de recherche est bien présente et mesurable par driver.js
    if (!this.showGlobalFilters()) {
      this.showGlobalFilters.set(true);
      this.cdr.detectChanges();
    }

    const steps: any[] = [
      {
        element: '[data-tour="actions-menu"]',
        popover: {
          title: 'Nouveau menu "Actions"',
          description: 'On a regroupé les options d’affichage et d’export dans ce nouveau menu pour libérer de l’espace.',
          side: "bottom",
          align: 'end',
          showButtons: ['next', 'previous', 'close']
        }
      }
    ];

    // Check for line menu presence now that we've waited for render
    const hasLineMenu = document.querySelector('[data-tour="line-menu"]');
    if (hasLineMenu) {
      steps.push({
        element: '[data-tour="line-menu"]',
        popover: {
          title: 'Options de ligne',
          description: 'Retrouvez ici les actions spécifiques à cette ligne (ajout de ressource, suppression, etc.).',
          side: "right",
          align: 'start',
          showButtons: ['next', 'previous', 'close']
        }
      });
    }

    // Check for drag handle presence (Project Mode)
    const hasDragHandle = document.querySelector('[data-tour="drag-handle"]');
    if (hasDragHandle) {
      steps.push({
        element: '[data-tour="drag-handle"]',
        popover: {
          title: 'Réorganisation',
          description: 'Désormais, uniquement dans la Vue "Par Projets", les lignes déplaçables sont indiquées avec la poignée cdkdraghandle.',
          side: "right",
          align: 'start',
          showButtons: ['next', 'previous', 'close']
        }
      });
    }

    // La recherche globale en fin de tutorial
    steps.push({
      element: '.header-search-bar',
      popover: {
        title: 'Recherche globale',
        description: 'Vous pouvez filtrer les lignes projets visibles via une chaîne de caractères.',
        side: "bottom",
        align: 'start',
        showButtons: ['next', 'previous', 'close']
      }
    });

    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.75)',
      // @ts-ignore - popupClass is valid but may not be in older types
      popoverClass: 'premium-driver-popover',
      steps: steps,
      onDestroyed: () => {
        localStorage.setItem(tutorialKey, "true");
      }
    });

    driverObj.drive();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.globalMouseMoveListener) {
      this.globalMouseMoveListener();
    }
    if (this.globalMouseUpListener) {
      this.globalMouseUpListener();
    }
    if (this.scrollCloseListener) {
      this.scrollCloseListener();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchInput(value: string) {
    this.searchSubject.next(value);
  }

  setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateHeaderHeights();
      });

      const headerEl = this.headerRowElement?.nativeElement;
      const milestonesEl = this.milestonesRowElement?.nativeElement;

      if (headerEl) {
        this.resizeObserver.observe(headerEl);
      }
      if (milestonesEl) {
        this.resizeObserver.observe(milestonesEl);
      }

      // Initial measurement after rendering completes
      setTimeout(() => {
        this.updateHeaderHeights();
      }, 0);
    });
  }

  updateHeaderHeights() {
    const headerEl = this.headerRowElement?.nativeElement;
    const milestonesEl = this.milestonesRowElement?.nativeElement;

    if (!headerEl || !milestonesEl) return;

    const headerHeight = headerEl.offsetHeight;
    const milestonesHeight = milestonesEl.offsetHeight;

    const gridEl = headerEl.parentElement;
    if (gridEl) {
      gridEl.style.setProperty('--calendar-header-height', `${headerHeight}px`);
      gridEl.style.setProperty('--milestones-header-height', `${milestonesHeight}px`);
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
    
    this.generateMonths();
  }

  generateMonths() {
    this.displayedMonths = [];
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return;

    const monthGroups: { [key: string]: { key: string; label: string; year: number; monthNum: number; weeks: Date[]; startWeekNum: number } } = {};
    const monthKeysOrder: string[] = [];

    this.displayedWeeks.forEach((week) => {
      const monthNum = week.getMonth();
      const year = week.getFullYear();
      const key = `${year}-${monthNum}`;

      if (!monthGroups[key]) {
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const label = monthNames[monthNum];
        const startWeekNum = this.getWeekNumber(week);
        
        monthGroups[key] = {
          key,
          label,
          year,
          monthNum,
          weeks: [],
          startWeekNum
        };
        monthKeysOrder.push(key);
      }
      monthGroups[key].weeks.push(week);
    });

    this.displayedMonths = monthKeysOrder.map(key => {
      const group = monthGroups[key];
      const quarterNum = Math.floor(group.monthNum / 3) + 1;
      const quarterLabel = `T${quarterNum} ${group.year}`;

      return {
        key: group.key,
        label: group.label,
        year: group.year,
        quarterLabel,
        startWeekNum: group.startWeekNum,
        weeks: group.weeks
      };
    });
  }

  get displayedQuarters() {
    const quarters: { label: string; year: number; weeksCount: number; months: any[] }[] = [];
    this.displayedMonths.forEach(m => {
      let q = quarters.find(x => x.label === m.quarterLabel);
      if (!q) {
        q = {
          label: m.quarterLabel,
          year: m.year,
          weeksCount: 0,
          months: []
        };
        quarters.push(q);
      }
      q.months.push(m);
      q.weeksCount += m.weeks.length;
    });
    return quarters;
  }

  getGanttBar(charges: Map<string, number> | undefined) {
    if (!charges || charges.size === 0 || !this.displayedWeeks || this.displayedWeeks.length === 0) {
      return null;
    }

    let firstIndex = -1;
    let lastIndex = -1;

    for (let i = 0; i < this.displayedWeeks.length; i++) {
      const weekKey = this.displayedWeeks[i].toISOString().split("T")[0];
      const val = charges.get(weekKey) || 0;
      if (val > 0) {
        if (firstIndex === -1) {
          firstIndex = i;
        }
        lastIndex = i;
      }
    }

    if (firstIndex === -1) {
      return null;
    }

    const totalWeeks = this.displayedWeeks.length;
    const left = (firstIndex / totalWeeks) * 100;
    const width = ((lastIndex - firstIndex + 1) / totalWeeks) * 100;

    return { left, width };
  }

  getAssociatedProject(row: any, parentRow?: any, childRow?: any): Projet | undefined {
    if (this.viewMode() === 'project') {
      return parentRow?.originalProject || row?.originalProject;
    } else if (this.viewMode() === 'team') {
      return childRow?.originalProject || row?.originalProject;
    } else if (this.viewMode() === 'resource') {
      const projId = row?.projectId || row?.resource?.projectId;
      if (projId) {
        return this.allProjects.find(p => p.id === projId);
      }
    }
    return undefined;
  }

  getGanttBarColor(row: any, parentRow?: any, childRow?: any): string {
    const project = this.getAssociatedProject(row, parentRow, childRow);
    if (project && project.color) {
      return project.color;
    }
    if (row && row.color) {
      return row.color;
    }
    if (childRow && childRow.color) {
      return childRow.color;
    }
    return '#10b981';
  }

  getGanttJalons(row: any, parentRow?: any, childRow?: any): Jalon[] {
    const project = this.getAssociatedProject(row, parentRow, childRow);
    if (!project || !project.id || !this.displayedWeeks || this.displayedWeeks.length === 0) {
      return [];
    }

    const startOfTimeline = this.displayedWeeks[0];
    const endOfTimeline = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]);
    endOfTimeline.setDate(endOfTimeline.getDate() + 7);

    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter(j => {
      if (j.projet_id !== project.id) return false;
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) {
        return false;
      }
      const jDate = new Date(j.event_date);
      return jDate >= startOfTimeline && jDate <= endOfTimeline;
    });
  }

  getJalonLeftPercentage(jalon: Jalon): number {
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return 0;
    
    const jDate = new Date(jalon.event_date).getTime();
    const start = this.displayedWeeks[0].getTime();
    
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const end = this.displayedWeeks[this.displayedWeeks.length - 1].getTime() + oneWeekMs;
    
    const totalDuration = end - start;
    if (totalDuration <= 0) return 0;
    
    const fraction = (jDate - start) / totalDuration;
    return Math.max(0, Math.min(100, fraction * 100));
  }

  get visibleJalons(): Jalon[] {
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return [];
    const start = this.displayedWeeks[0];
    const end = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]);
    end.setDate(end.getDate() + 7);

    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter(j => {
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) {
        return false;
      }
      const d = new Date(j.event_date);
      return d >= start && d <= end;
    });
  }

  get uniqueJalonTypes(): string[] {
    const types = new Set<string>();
    for (const j of this.allJalons) {
      if (j.event_type) {
        types.add(j.event_type);
      }
    }
    return Array.from(types).sort();
  }

  // trackBy functions for performance
  trackByRow(index: number, row: ParentRow) { return row.id; }
  trackByChild(index: number, child: ChildRow) { return child.id; }
  trackByResource(index: number, res: ResourceRow) { return res.uniqueId; }
  trackByWeek(index: number, week: Date) { return week.getTime(); }
  trackByFlatRow(index: number, row: FlatRow) { return row.uniqueId; }

  async loadData() {
    try {
      const [equipes, charges, projects, roles, personnes, jalons, links, roleAttachments, capacities, chiffres, services] = await Promise.all([
        this.teamService.getAllEquipes(),
        this.chargeService.getAllCharges(),
        this.projetService.getAllProjets(),
        this.rolesService.getAllRoles(),
        this.personnesService.getAllPersonnes(),
        this.jalonService.getAllJalons(),
        this.projetService.getAllEquipeProjetLinks(),
        this.rolesService.getAllRoleAttachments(),
        this.teamService.getAllCapacities(),
        this.chiffresService.getAllChiffres(),
        this.resourceService.getAllServices()
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
      this.allChiffres = chiffres;
      this.allServices = services;

      // Index capacities once for O(1) loop-up
      this.capacityIndex.clear();
      this.allCapacities.forEach(c => {
        const weekKey = c.semaine_debut.split("T")[0];
        const rId = c.role_id || c.personne_id;
        const type = c.role_id ? 'role' : 'personne';
        const key = `${c.equipe_id}_${type}_${rId}_${weekKey}`;
        this.capacityIndex.set(key, c.capacite);
      });

      this.buildTree();
      this.precalculateResources();
      this.calculateMetrics(); // New step
      this.cdr.markForCheck();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  calculateMetrics() {
    this.rowsAll.forEach(parent => {
      parent.metrics = new Map();
      parent.children.forEach(child => {
        child.metrics = new Map();
        child.resources.forEach(res => {
          res.metrics = new Map();
          this.displayedWeeks.forEach(week => {
            const weekKey = week.toISOString().split("T")[0];
            const charge = res.charges.get(weekKey) || 0;
            res.metrics!.set(weekKey, { total: charge });
          });
        });

        // Sum Child metrics
        this.displayedWeeks.forEach(week => {
          const weekKey = week.toISOString().split("T")[0];
          let total = 0;
          child.resources.forEach(res => {
            total += res.metrics?.get(weekKey)?.total || 0;
          });
          child.metrics!.set(weekKey, { total });
        });
      });

      // Sum Parent metrics
      const teamIdFromParent = this.viewMode() === 'resource' ? parent.id.split('_')[0] : parent.id;
      this.displayedWeeks.forEach(week => {
        const weekKey = week.toISOString().split("T")[0];
        let total = 0;
        let totalCapacity = 0;

        parent.children.forEach(child => {
          total += child.metrics?.get(weekKey)?.total || 0;
        });

        if (this.viewMode() === 'resource') {
          // In Resource Mode, Parent IS a specific resource for a team
          const parts = parent.id.split('_');
          const rType = parts[1];
          const rId = parts.slice(2).join('_');
          const capKey = `${teamIdFromParent}_${rType}_${rId}_${weekKey}`;
          totalCapacity = this.capacityIndex.get(capKey) || 0;
        }

        const availability = totalCapacity - total;
        let status: 'positive' | 'zero' | 'negative' | 'none' = 'none';
        if (totalCapacity > 0 || total > 0) {
          if (availability > 0) status = 'positive';
          else if (availability === 0) status = 'zero';
          else status = 'negative';
        }

        parent.metrics!.set(weekKey, {
          total,
          capacity: totalCapacity,
          availability: availability,
          status: status
        });
      });
    });
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

    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter(j => {
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) {
        return false;
      }
      const jDate = new Date(j.event_date);
      return jDate >= startOfWeek && jDate <= endOfWeek;
    });
  }

  getJalonColor(type: string): string {
    switch (type?.toLowerCase()) {
      case 'livraison': case 'lv': return '#d1fae5'; // Green
      case 'maintenance': case 'lvm': return '#f3e8ff'; // Purple
      case 'mep': return '#dbeafe'; // Blue
      case 'sprint': case 'sp': return '#fef3c7'; // Amber
      default: return '#f3f4f6'; // Gray
    }
  }

  getJalonTextColor(type: string): string {
    switch (type?.toLowerCase()) {
      case 'livraison': case 'lv': return '#065f46';
      case 'maintenance': case 'lvm': return '#6b21a8';
      case 'mep': return '#1e40af';
      case 'sprint': case 'sp': return '#92400e';
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

    if (this.isAnyFilterActiveExceptTeam()) {
      this.showReorderMessage("Le réordonnancement est désactivé lorsqu'un filtre est actif (hors filtre équipe)");
      return;
    }

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
          reference_externe: project.reference_externe,
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

        const sortedInvolvedProjects = sortByRank(
          this.allProjects.filter(p => involvedProjectIds.has(p.id!)),
          (p) => p.rank,
          (a, b) => a.nom_projet.localeCompare(b.nom_projet)
        );

        sortedInvolvedProjects.forEach((project) => {
          const label = project ? project.nom_projet : "Unknown Project";
          const color = project ? project.color : undefined;
          const code = project ? project.code_projet : undefined;
          const reference_externe = project ? project.reference_externe : undefined;
          const projectId = project.id;
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
            reference_externe: reference_externe,
            color: color,
            expanded: this.manualStates.has(`${team.id}_${projectId}`) ? this.manualStates.get(`${team.id}_${projectId}`)! : this.isDefaultExpanded, // Respect persisted preference
            resources: filteredResources,
            charges: projectCharges,
            originalProject: project
          });
        });

        // Resources are already pushed in order of projects

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
              code: project?.code_projet,
              reference_externe: project?.reference_externe,
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
          const projectResources = sortByRank(
            Array.from(res.projectDetailedMap.values()),
            (r) => this.allProjects.find(p => p.id === r.projectId)?.rank,
            (a, b) => a.label.localeCompare(b.label)
          );

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
    if (format === 'flat') {
      this.buildFlatList();
    }
  }

  buildFlatList() {
    this.flatRows = [];
    const collator = new Intl.Collator("fr-FR", { numeric: true, sensitivity: 'base' });

    // Iterate over the currently filtered rows (this.rows)
    for (const parent of this.rows) {
      for (const child of parent.children) {
        for (const resource of child.resources) {
          const p = parent;
          const c = child;
          const r = resource;
          const fullLabel = `${p.label} > ${c.label} > ${r.label} ${p.code || ''} ${p.reference_externe || ''} ${c.code || ''} ${c.reference_externe || ''}`.toLowerCase();
          this.flatRows.push({
            uniqueId: resource.uniqueId,
            fullLabel: fullLabel,
            resource: resource,
            child: child,
            parent: parent
          });
        }
      }
    }

    // Sort flattened rows faster
    this.flatRows.sort((a, b) => collator.compare(a.fullLabel, b.fullLabel));
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

  getChildValue(child: ChildRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return child.charges.get(weekKey) || 0;
  }

  getResourceValue(resource: ResourceRow, week: Date): number {
    const weekKey = week.toISOString().split("T")[0];
    return resource.charges.get(weekKey) || 0;
  }

  async moveToTop(row: ParentRow) {
    if (this.viewMode() !== 'project') return;

    if (this.isAnyFilterActiveExceptTeam()) {
      this.showReorderMessage("Le réordonnancement est désactivé lorsqu'un filtre est actif (hors filtre équipe)");
      return;
    }
    const currentIndex = this.rows.indexOf(row);
    if (currentIndex <= 0) return;

    moveItemInArray(this.rows, currentIndex, 0);
    await this.updateRankAfterMove(0);
  }

  async moveToBottom(row: ParentRow) {
    if (this.viewMode() !== 'project') return;

    if (this.isAnyFilterActiveExceptTeam()) {
      this.showReorderMessage("Le réordonnancement est désactivé lorsqu'un filtre est actif (hors filtre équipe)");
      return;
    }
    const currentIndex = this.rows.indexOf(row);
    if (currentIndex === -1 || currentIndex === this.rows.length - 1) return;

    moveItemInArray(this.rows, currentIndex, this.rows.length - 1);
    await this.updateRankAfterMove(this.rows.length - 1);
  }

  private async updateRankAfterMove(index: number) {
    const movedItem = this.rows[index];
    if (!movedItem.originalProject) return;

    try {
      const rankStr = calculateNewRank(
        this.rows,
        index,
        (row) => row.originalProject?.rank
      );

      movedItem.originalProject.rank = rankStr;
      await this.projetService.updateProjet(movedItem.id, { rank: rankStr });
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error calculating rank:', error);
      await this.loadData();
    }
  }

  // Modal & Linking Logic
  openLinkModal(row: ParentRow, child?: ChildRow) {
    this.selectedParentRow = row;
    this.selectedChildRowToLink = child || null;
    this.selectedIdToLink = "";
    this.selectedIdsToLink = new Set();
    this.linkModalSearchQuery = '';
    this.linkModalStatusFilter = '';
    this.linkModalIsSaving = false;

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
        const existingProjectIds = new Set(row.children[0]?.resources.map(r => r.projectId) || []);
        this.linkableItems = this.allProjects
          .filter(p => !existingProjectIds.has(p.id!))
          .map(p => ({ id: p.id!, label: p.nom_projet }));
      } else {
        // Level 2 Child: Resource (already expanded)
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
    this.selectedIdsToLink = new Set();
    this.linkModalSearchQuery = '';
    this.linkModalStatusFilter = '';
    this.linkModalIsSaving = false;
  }

  async linkItem() {
    if (!this.selectedParentRow) return;

    // MODE PROJECT: single select via <select>
    if (this.viewMode() === 'project') {
      if (!this.selectedIdToLink) return;
      try {
        const projetId = this.selectedParentRow.id;
        const equipeId = this.selectedIdToLink;
        await this.projetService.linkProjectToTeam(projetId, equipeId);
        await this.addAllTeamResourcesToProject(equipeId, projetId);
        await this.loadData();
        this.closeLinkModal();
      } catch (error: any) {
        console.error('Error linking item:', error);
        alert(error.message || "Erreur lors de l'ajout du lien.");
      }
      return;
    }

    // MODES TEAM / RESOURCE: bulk via checkboxes
    if (this.selectedIdsToLink.size === 0) return;

    this.linkModalIsSaving = true;
    this.cdr.markForCheck();
    const errors: string[] = [];

    for (const selectedId of Array.from(this.selectedIdsToLink)) {
      try {
        if (this.viewMode() === 'team') {
          const equipeId = this.selectedParentRow.id;
          const projetId = selectedId;
          await this.projetService.linkProjectToTeam(projetId, equipeId);
          await this.addAllTeamResourcesToProject(equipeId, projetId);
        } else if (this.viewMode() === 'resource') {
          if (!this.selectedChildRowToLink) {
            // Level 1: Add Project to Resource
            const [equipeId, type, rawResId] = this.selectedParentRow.id.split('_');
            const projetId = selectedId;
            const roleId = type === 'role' ? rawResId : undefined;
            const personneId = type === 'personne' ? rawResId : undefined;
            await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, personneId);
          } else {
            // Level 2: Add Project to Resource
            const equipeId = this.selectedParentRow.id.split('_')[0];
            const [type, resId] = this.selectedChildRowToLink.id.split('_');
            const projetId = selectedId;
            const roleId = type === 'role' ? resId : undefined;
            await this.chargeService.createChargeWithoutDates(projetId, equipeId, roleId, type === 'personne' ? resId : undefined);
          }
        }
      } catch (error: any) {
        console.error('Error linking item:', error);
        const proj = this.allProjects.find(p => p.id === selectedId);
        errors.push(proj?.nom_projet || selectedId);
      }
    }

    await this.loadData();
    this.linkModalIsSaving = false;

    if (errors.length > 0) {
      alert(`Erreur lors de l'ajout de : ${errors.join(', ')}`);
    }

    this.closeLinkModal();
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
          // Update live projection tooltip visibility and position during drag
          if (this.dragStartCellValue && this.dragStartCellValue > 0) {
            this.updateDragProjectionTooltipPosition(event);

            const shouldShow = this.shouldShowProjectionTooltip();
            if (shouldShow && !this.dragProjectionTooltipVisible) {
              this.ngZone.run(() => {
                this.dragProjectionTooltipVisible = true;
                this.cdr.markForCheck();
              });
            } else if (!shouldShow && this.dragProjectionTooltipVisible) {
              this.ngZone.run(() => {
                this.dragProjectionTooltipVisible = false;
                this.cdr.markForCheck();
              });
            }
          }
        }
      }
    }

    // 3. Move Selection update — tracked from cursor X delta, works outside the row
    //    Frozen during commit so the ghost doesn't follow the mouse after mouseup
    if (this.isMovingSelection && !this.isMoveCommitting && this.selectedCells.length > 0) {
      // Compute offset from pixel delta, independent of hovered row
      const deltaX = event.clientX - this.moveStartClientX;
      const newOffset = Math.round(deltaX / this.cellWidthPx);
      if (newOffset !== this.moveGhostOffset) {
        this.ngZone.run(() => {
          this.moveGhostOffset = newOffset;
          this.cdr.markForCheck();
        });
      }
    }

    // 4. Border Hover Detection
    if (!this.isDragging && !this.isMovingSelection && this.selectedCells.length > 0 && this.isSelectionFinished) {
      const target = event.target as HTMLElement;
      const cell = target.closest(".week-cell");
      if (cell) {
        const isSelected = cell.classList.contains('selected');
        if (isSelected) {
          const rect = cell.getBoundingClientRect();
          const margin = 5; // 5px threshold for border detection

          const isAtLeft = (event.clientX - rect.left) < margin;
          const isAtRight = (rect.right - event.clientX) < margin;
          const isAtTop = (event.clientY - rect.top) < margin;
          const isAtBottom = (rect.bottom - event.clientY) < margin;

          const resRow = target.closest(".calendar-row");
          const resId = resRow?.getAttribute('data-resource-id');
          const weekIndex = parseInt(cell.getAttribute('data-week-index') || '-1', 10);

          const isBorder = this.isCellAtSelectionEdge(resId, weekIndex, isAtLeft, isAtRight, isAtTop, isAtBottom);

          if (this.isOverSelectionBorder !== isBorder) {
            this.ngZone.run(() => {
              this.isOverSelectionBorder = isBorder;
              this.cdr.markForCheck();
            });
          }
        } else {
          if (this.isOverSelectionBorder) {
            this.ngZone.run(() => {
              this.isOverSelectionBorder = false;
              this.cdr.markForCheck();
            });
          }
        }
      } else {
        if (this.isOverSelectionBorder) {
          this.ngZone.run(() => {
            this.isOverSelectionBorder = false;
            this.cdr.markForCheck();
          });
        }
      }
    }
  }

  isCellAtSelectionEdge(resId: string | null | undefined, weekIndex: number, isAtLeft: boolean, isAtRight: boolean, isAtTop: boolean, isAtBottom: boolean): boolean {
    if (!resId || this.selectedCells.length === 0) return false;

    // Find min/max week and resource context
    const selectedWeeks = this.selectedCells.map(c => this.displayedWeeks.findIndex(w => w.getTime() === c.week.getTime()));
    const minW = Math.min(...selectedWeeks);
    const maxW = Math.max(...selectedWeeks);

    // Currently one row only
    const firstCell = this.selectedCells[0];
    const selResId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId } as ChildRow, { id: firstCell.parentId } as ParentRow);

    if (resId !== selResId) return false;

    // Check if cell is an outer edge of the selection block
    const isMinW = weekIndex === minW;
    const isMaxW = weekIndex === maxW;

    return (isMinW && isAtLeft) || (isMaxW && isAtRight) || isAtTop || isAtBottom;
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

  updateDragProjectionTooltipPosition(event: MouseEvent) {
    if (!this.dragProjectionTooltip) return;

    const x = event.clientX;
    let y = 0;

    // Position below if space permits, otherwise above
    const spaceBelow = window.innerHeight - event.clientY;
    if (spaceBelow > 80) {
      y = event.clientY + 20;
    } else {
      y = event.clientY - 65;
    }

    // Direct DOM manipulation for fast updates outside Angular zone
    this.dragProjectionTooltip.nativeElement.style.left = `${x}px`;
    this.dragProjectionTooltip.nativeElement.style.top = `${y}px`;
  }

  private shouldShowProjectionTooltip(): boolean {
    // Condition 1: Au moins 2 cellules sélectionnées
    if (this.selectedCells.length <= 1) return false;

    // Condition 2: La cellule de départ doit avoir une valeur à projeter
    if (!this.dragStartCellValue || this.dragStartCellValue <= 0) return false;

    // Condition 3: Toutes les cellules à partir de la deuxième doivent être vides
    for (let i = 1; i < this.selectedCells.length; i++) {
      const cell = this.selectedCells[i];
      const weekKey = cell.week.toISOString().split('T')[0];
      const value = cell.resource.charges.get(weekKey) || 0;
      if (value > 0) return false;
    }

    return true;
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    if (this.isOverSelectionBorder) {
      this.isMovingSelection = true;
      this.moveGhostOffset = 0;
      this.moveStartClientX = event.clientX;
      // Measure actual cell width from DOM
      const target = event.target as HTMLElement;
      const cell = target.closest(".week-cell") as HTMLElement;
      if (cell) {
        this.cellWidthPx = cell.getBoundingClientRect().width || 80;
        const indexStr = cell.getAttribute("data-week-index");
        if (indexStr) {
          this.moveStartWeekIndex = parseInt(indexStr, 10);
        }
      }
      // Initialize badge at cursor
      this.moveDragBadgeX = event.clientX + 16;
      this.moveDragBadgeY = event.clientY - 20;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.isDragging = true;
    this.isSelectionFinished = false;
    this.isOverSelectionBorder = false;
    this.dragStartResource = resource;
    this.dragStartChild = child;
    this.dragStartParent = parent;
    this.bulkChargeValue = null;

    const target = event.target as HTMLElement;
    const cell = target.closest(".week-cell");
    if (cell) {
      const indexStr = cell.getAttribute("data-week-index");
      if (indexStr) {
        this.dragStartWeekIndex = parseInt(indexStr, 10);
        this.dragEndWeekIndex = this.dragStartWeekIndex;

        // Detect value on the starting cell for pre-fill & live projection
        const startWeek = this.displayedWeeks[this.dragStartWeekIndex];
        if (startWeek) {
          const weekKey = startWeek.toISOString().split('T')[0];
          const existingValue = resource.charges.get(weekKey) || 0;
          this.dragStartCellValue = existingValue > 0 ? existingValue : null;
        } else {
          this.dragStartCellValue = null;
        }

        this.updateSelection(child, parent);
        this.cdr.markForCheck();
      }
    }
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    // This method is now obsolete as we use onGlobalMouseMove
  }

  // Called by the global window mouseup listener — fires even outside the grid
  async onGlobalMouseUp(_event?: MouseEvent) {
    if (this.isMovingSelection) {
      if (this.moveGhostOffset !== 0) {
        // Keep isMovingSelection = true so the ghost remains visible during save
        this.isMoveCommitting = true;
        this.ngZone.run(() => this.executeMove());
      } else {
        // No movement: cancel and restore
        this.ngZone.run(() => {
          this.isMovingSelection = false;
          this.isMoveCommitting = false;
          this.isOverSelectionBorder = false;
          this.moveGhostOffset = 0;
          this.cdr.markForCheck();
        });
      }
      return;
    }

    if (!this.isDragging) return;

    this.ngZone.run(() => {
      this.isDragging = false;
      this.dragProjectionTooltipVisible = false;
      if (this.selectedCells.length > 0) {
        this.isSelectionFinished = true;

        // On ne pré-remplit la valeur que si on est dans le cas d'une projection vers du vide
        // ou pour une sélection à cellule unique (remplie ou vide) afin de ré-actualiser l'input.
        if (this.shouldShowProjectionTooltip()) {
          this.bulkChargeValue = this.dragStartCellValue;
        } else if (this.selectedCells.length === 1) {
          this.bulkChargeValue = this.dragStartCellValue;
        } else {
          this.bulkChargeValue = null;
        }

        this.updateToolbarPosition();
        this.cdr.detectChanges(); // Force l'apparition immédiate de la toolbar
      }
    });
  }

  async executeMove() {
    if (this.selectedCells.length === 0 || this.moveGhostOffset === 0) return;

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      // Group cells by resource identity (projet + equipe + role/personne)
      // Since move is restricted to 1 resource line, all cells share the same identity
      const firstCell = this.selectedCells[0];
      let projetId: string, equipeId: string;

      if (this.viewMode() === 'project') {
        projetId = firstCell.parentId;
        equipeId = firstCell.childId;
      } else if (this.viewMode() === 'team') {
        equipeId = firstCell.parentId;
        projetId = firstCell.childId;
      } else {
        const parts = firstCell.parentId.split('_');
        equipeId = parts[0];
        projetId = firstCell.resource.projectId!;
      }

      const rId = firstCell.resource.resourceId || firstCell.resource.id;
      const roleId = firstCell.resource.type === 'role' ? rId : undefined;
      const personneId = firstCell.resource.type === 'personne' ? rId : undefined;

      // Build the move list in one pass
      const moves = this.selectedCells.map(cell => {
        const fromWeek = cell.week.toISOString().split('T')[0];
        const value = cell.resource.charges.get(fromWeek) || 0;
        const srcIdx = this.displayedWeeks.findIndex(w => w.getTime() === cell.week.getTime());
        const tgtWeek = this.displayedWeeks[srcIdx + this.moveGhostOffset];
        return { fromWeek, toWeek: tgtWeek?.toISOString().split('T')[0] ?? '', value };
      }).filter(m => m.toWeek); // discard out-of-range

      // 3 queries total instead of 2×N
      await this.chargeService.bulkMoveCharges(projetId, equipeId, moves, roleId, personneId);

      await this.loadData();
      this.clearSelection();
    } catch (error) {
      console.error('Error executing move:', error);
      alert('Erreur lors du déplacement des charges.');
    } finally {
      this.isMovingSelection = false;
      this.isMoveCommitting = false;
      this.isSaving = false;
      this.isOverSelectionBorder = false;
      this.moveGhostOffset = 0;
      this.cdr.markForCheck();
    }
  }

  private async updateChargeValue(cell: any, value: number, overrideWeek?: Date) {
    const week = overrideWeek || cell.week;
    const weekKey = week.toISOString().split("T")[0];

    let projetId, equipeId;
    if (this.viewMode() === "project") {
      projetId = cell.parentId;
      equipeId = cell.childId;
    } else if (this.viewMode() === "team") {
      equipeId = cell.parentId;
      projetId = cell.childId;
    } else {
      const parentIdParts = cell.parentId.split('_');
      equipeId = parentIdParts[0];
      projetId = cell.resource.projectId!;
    }

    const rId = cell.resource.resourceId || cell.resource.id;
    const roleId = cell.resource.type === "role" ? rId : undefined;
    const personneId = cell.resource.type === "personne" ? rId : undefined;

    await this.chargeService.createOrUpdateCharge(
      projetId,
      equipeId,
      weekKey,
      value,
      roleId,
      personneId
    );
  }

  // Visual helpers for HTML
  getCellSelectionClasses(resource: ResourceRow, week: Date, weekIndex: number, child: ChildRow, parent: ParentRow) {
    if (this.selectedCells.length === 0) return {};

    const isSelected = this.isCellSelected(resource, week);

    if (this.isMovingSelection) {
      if (this.isCellGhostSelected(resource, weekIndex, child, parent)) {
        return { 'selected': true, 'ghost-selection': true, 'committing': this.isMoveCommitting };
      }
      if (isSelected) {
        // Only hide source if we have actually moved to a new position
        return this.moveGhostOffset === 0 ? { 'selected': true } : { 'moving-source': true };
      }
      return {};
    }

    if (!isSelected) return {};

    // Standard selection mode (not moving)
    return {
      'selected': true,
      'is-over-border': this.isOverSelectionBorder
    };
  }

  isCellGhostSelected(resource: ResourceRow, weekIndex: number, child: ChildRow, parent: ParentRow): boolean {
    if (!this.isMovingSelection || this.moveGhostOffset === 0) return false;

    const currResId = this.getResourceUniqueId(resource, child, parent);
    const firstCell = this.selectedCells[0];
    const selResId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId } as ChildRow, { id: firstCell.parentId } as ParentRow);

    if (currResId !== selResId) return false;

    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return false;

    const sourceWeek = this.displayedWeeks[sourceWeekIndex];
    return this.isCellSelected(resource, sourceWeek);
  }

  getAbsOffset(): number {
    return Math.abs(this.moveGhostOffset);
  }

  getGhostValue(resource: ResourceRow, weekIndex: number): number | null {
    if (!this.isMovingSelection || this.moveGhostOffset === 0) return null;

    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return null;

    const sourceWeek = this.displayedWeeks[sourceWeekIndex];
    if (this.isCellSelected(resource, sourceWeek)) {
      const sourceWeekKey = sourceWeek.toISOString().split("T")[0];
      return resource.charges.get(sourceWeekKey) || 0;
    }
    return null;
  }


  updateToolbarPosition() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

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

        // Check if the cell has scrolled out of the visible area of the calendar
        const wrapperEl = document.querySelector('.calendar-wrapper');
        const headerEl = this.headerRowElement?.nativeElement;
        const milestonesEl = this.milestonesRowElement?.nativeElement;
        const labelEl = rowElement.querySelector('.label-cell');

        if (wrapperEl && headerEl && milestonesEl && labelEl) {
          const wrapperRect = wrapperEl.getBoundingClientRect();
          const milestonesRect = milestonesEl.getBoundingClientRect();
          const labelRect = labelEl.getBoundingClientRect();

          const visibleTop = milestonesRect.bottom;
          const visibleBottom = wrapperRect.bottom;
          const visibleLeft = labelRect.right;
          const visibleRight = wrapperRect.right;

          // Check if cell is completely outside the visible scroll bounds
          const cellIsHidden = 
            rect.bottom <= visibleTop || // Scrolled above (under headers)
            rect.top >= visibleBottom || // Scrolled below viewport
            rect.right <= visibleLeft || // Scrolled left (under label column)
            rect.left >= visibleRight;   // Scrolled right off screen

          if (cellIsHidden) {
            this.toolbarVisible = false;
            this.cdr.detectChanges();
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
          rightSafetyMargin: 320
        });

        // Convert viewport coordinates to calendar-wrapper relative absolute coordinates
        if (wrapperEl) {
          const wrapperRect = wrapperEl.getBoundingClientRect();
          this.toolbarPosition = {
            top: pos.top - wrapperRect.top + wrapperEl.scrollTop,
            left: pos.left - wrapperRect.left + wrapperEl.scrollLeft,
            transform: pos.transform
          };
        } else {
          this.toolbarPosition = pos;
        }

        // Make toolbar visible now that position is set
        this.toolbarVisible = true;
        this.cdr.detectChanges();
      }
    }
  }

  checkToolbarVisibilityOnScroll() {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0) return;

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
        const wrapperEl = document.querySelector('.calendar-wrapper');
        const headerEl = this.headerRowElement?.nativeElement;
        const milestonesEl = this.milestonesRowElement?.nativeElement;
        const labelEl = rowElement.querySelector('.label-cell');

        if (wrapperEl && headerEl && milestonesEl && labelEl) {
          const wrapperRect = wrapperEl.getBoundingClientRect();
          const milestonesRect = milestonesEl.getBoundingClientRect();
          const labelRect = labelEl.getBoundingClientRect();

          const visibleTop = milestonesRect.bottom;
          const visibleBottom = wrapperRect.bottom;
          const visibleLeft = labelRect.right;
          const visibleRight = wrapperRect.right;

          // Check if cell is completely outside the visible scroll bounds
          const cellIsHidden = 
            rect.bottom <= visibleTop || // Scrolled under headers
            rect.top >= visibleBottom || // Scrolled below viewport
            rect.right <= visibleLeft || // Scrolled left under label column
            rect.left >= visibleRight;   // Scrolled right off screen

          const shouldBeVisible = !cellIsHidden;
          if (this.toolbarVisible !== shouldBeVisible) {
            this.toolbarVisible = shouldBeVisible;
            this.cdr.detectChanges();
          }
        }
      }
    }
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
    this.dragStartCellValue = null;
    this.dragProjectionTooltipVisible = false;
    // Reset move state
    this.isMovingSelection = false;
    this.isMoveCommitting = false;
    this.isOverSelectionBorder = false;
    this.moveGhostOffset = 0;
  }

  async applyBulkCharge(value: number | null) {
    if (this.selectedCells.length === 0 || value == null) return;

    this.bulkChargeValue = value;
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

  async applyProjection(data: { resources: number; totalDays: number }) {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
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
        const weekKey = targetWeek.toISOString().split("T")[0];

        let projetId: string;
        let equipeId: string;

        if (this.viewMode() === "project") {
          projetId = firstCell.parentId;
          equipeId = firstCell.childId;
        } else if (this.viewMode() === "team") {
          equipeId = firstCell.parentId;
          projetId = firstCell.childId;
        } else {
          const parentIdParts = firstCell.parentId.split('_');
          equipeId = parentIdParts[0];
          projetId = firstCell.resource.projectId!;
        }

        const rId = resourceRow.resourceId || resourceRow.id;
        const roleId = resourceRow.type === "role" ? rId : undefined;
        const personneId = resourceRow.type === "personne" ? rId : undefined;

        // Save the charge with a value equal to the number of resources
        await this.chargeService.createOrUpdateCharge(
          projetId,
          equipeId,
          weekKey,
          data.resources, // unite_ressource = resources count
          roleId,
          personneId
        );
      }

      await this.loadData();
      this.clearSelection();
    } catch (error) {
      console.error("Error applying projection:", error);
      alert("Erreur lors de l'application de la projection.");
    } finally {
      this.isSaving = false;
    }
  }

  // --- Filter helpers ---
  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    // Close filter dropdowns if clicking outside filters-bar and milestone-filter-group
    if (!target.closest(".filters-bar") && !target.closest(".milestone-filter-group")) {
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
      this.filterProjetSearch.set('');
    }
    // Close actions menu if clicking outside
    if (!target.closest(".actions-menu-wrapper")) {
      this.showActionsMenu = false;
    }
    // Close line menu if clicking outside
    if (!target.closest(".line-menu-wrapper") && !target.closest(".line-menu-trigger")) {
      this.activeLineMenuId = null;
    }
    this.cdr.markForCheck();
  }

  toggleDropdown(name: "equipe" | "projet" | "resource" | "statut" | "size" | "jalon", event: MouseEvent) {
    event.stopPropagation();
    if (name === "equipe") {
      this.openEquipeDropdown = !this.openEquipeDropdown;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
    } else if (name === "projet") {
      this.openProjetDropdown = !this.openProjetDropdown;
      this.openEquipeDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
    } else if (name === "resource") {
      this.openResourceDropdown = !this.openResourceDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
    } else if (name === "statut") {
      this.openStatusDropdown = !this.openStatusDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
    } else if (name === "size") {
      this.openSizeDropdown = !this.openSizeDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.showPeriodDropdown = false;
      this.openJalonDropdown = false;
    } else if (name === "jalon") {
      this.openJalonDropdown = !this.openJalonDropdown;
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.showPeriodDropdown = false;
    }
    if (!this.openProjetDropdown) {
      this.filterProjetSearch.set('');
    }
  }

  toggleActionsSubmenu(menu: string, event: MouseEvent) {
    event.stopPropagation();
    this.activeActionsSubmenu = this.activeActionsSubmenu === menu ? null : menu;
    this.cdr.markForCheck();
  }

  toggleActionsMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showActionsMenu = !this.showActionsMenu;
    if (!this.showActionsMenu) {
      this.activeActionsSubmenu = null;
    }
    this.cdr.markForCheck();
  }

  toggleLineMenu(rowId: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeLineMenuId === rowId) {
      this.activeLineMenuId = null;
    } else {
      this.activeLineMenuId = rowId;
      // Position near the trigger button
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.lineMenuPosition = { x: rect.right, y: rect.bottom };
    }
    this.cdr.markForCheck();
  }

  closeLineMenu() {
    this.activeLineMenuId = null;
    this.cdr.markForCheck();
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

  onJalonTypeToggle(type: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.filterJalonTypes.update(types => {
      if (checked) return [...types, type];
      return types.filter((x) => x !== type);
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

  onStatutToggle(statut: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.filterStatusIds.update(ids => {
      if (checked) return [...ids, statut];
      return ids.filter((x) => x !== statut);
    });
    this.applyFilters();
  }

  get filteredProjectsForDropdown(): Projet[] {
    if (!this.filterProjetSearch()) return this.allProjects;
    const search = this.filterProjetSearch().toLowerCase();
    return this.allProjects.filter(p =>
      p.nom_projet.toLowerCase().includes(search) ||
      (p.code_projet && p.code_projet.toLowerCase().includes(search)) ||
      (p.reference_externe && p.reference_externe.toLowerCase().includes(search))
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

  // ─── Period filter helpers ───────────────────────────────────────────────

  /** Lundi de la semaine courante (YYYY-MM-DD) */
  get defaultPeriodStart(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().split('T')[0];
  }

  /** Aujourd'hui + 6 mois (YYYY-MM-DD) */
  get defaultPeriodEnd(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  }

  get effectivePeriodStart(): string {
    return this.filterPeriodStart() || this.defaultPeriodStart;
  }

  get effectivePeriodEnd(): string {
    return this.filterPeriodEnd() || this.defaultPeriodEnd;
  }

  /** Vrai si le filtre période est actif */
  get isPeriodFilterActive(): boolean {
    return this.filterPeriodEnabled();
  }

  /** Retourne le preset actif (3/6/12) ou null si période personnalisée */
  get activePeriodPreset(): number | null {
    const start = this.effectivePeriodStart;
    const end   = this.effectivePeriodEnd;
    for (const months of [3, 6, 12]) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + months);
      if (d.toISOString().split('T')[0] === end) return months;
    }
    return null;
  }

  /** Label affiché dans le pill */
  get periodLabel(): string {
    if (!this.filterPeriodEnabled()) {
      return "Désactivé"; // Tout afficher
    }
    const fmt = (s: string) => {
      const [y, m, day] = s.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    };
    return `${fmt(this.effectivePeriodStart)} → ${fmt(this.effectivePeriodEnd)}`;
  }

  /** O(n) : retourne les IDs de projets ayant ≥1 charge dans [startDate, endDate] */
  private getProjectsWithChargesInPeriod(startDate: string, endDate: string): Set<string> {
    const result = new Set<string>();
    for (const charge of this.allCharges) {
      if (!charge.semaine_debut || !charge.projet_id) continue;
      if ((charge.unite_ressource ?? 0) <= 0) continue;
      const weekKey = charge.semaine_debut.split('T')[0];
      if (weekKey >= startDate && weekKey <= endDate) {
        result.add(charge.projet_id);
      }
    }
    return result;
  }

  /** O(w) : retourne vrai si la map de charges contient ≥1 charge non nulle dans la période */
  private hasChargesInPeriod(chargesMap: Map<string, number> | undefined, startDate: string, endDate: string): boolean {
    if (!chargesMap || chargesMap.size === 0) return false;
    for (const [weekKey, val] of chargesMap.entries()) {
      if (val > 0 && weekKey >= startDate && weekKey <= endDate) {
        return true;
      }
    }
    return false;
  }

  togglePeriodDropdown(event: Event) {
    event.stopPropagation();
    this.showPeriodDropdown = !this.showPeriodDropdown;
    if (this.showPeriodDropdown) {
      this.openEquipeDropdown = false;
      this.openProjetDropdown = false;
      this.openResourceDropdown = false;
      this.openStatusDropdown = false;
      this.openSizeDropdown = false;
      this.openJalonDropdown = false;
    }
    this.cdr.markForCheck();
  }

  setPeriodPreset(months: number) {
    const start = this.defaultPeriodStart;
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    this.filterPeriodStart.set(start);
    this.filterPeriodEnd.set(d.toISOString().split('T')[0]);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  resetPeriodFilter() {
    this.filterPeriodStart.set('');
    this.filterPeriodEnd.set('');
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onPeriodStartChange(val: string) {
    this.filterPeriodStart.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onPeriodEndChange(val: string) {
    this.filterPeriodEnd.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onPeriodToggle(enabled: boolean) {
    this.filterPeriodEnabled.set(enabled);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  // ─── Size filter helpers ─────────────────────────────────────────────────

  get sizeFilterLabel(): string {
    if (!this.filterSizeEnabled() || this.filterSizeValue() === null) {
      return "Désactivé";
    }
    
    let critLabel = '';
    switch (this.filterSizeCriterion()) {
      case 'charges_today': critLabel = 'Charges RAF'; break;
      case 'charges_all': critLabel = 'Charges Tout'; break;
      case 'charges_2025': critLabel = 'Charges 2025'; break;
      case 'charges_2026': critLabel = 'Charges 2026'; break;
      case 'chiffre_initial': critLabel = 'Chiffre Init.'; break;
      case 'chiffre_revise': critLabel = 'Chiffre Rév.'; break;
      case 'chiffre_previsionnel': critLabel = 'Chiffre Prév.'; break;
      case 'chiffre_consomme': critLabel = 'Chiffre Conso.'; break;
    }

    const opLabel = this.filterSizeOperator() === 'gte' ? '≥' : '≤';
    return `${critLabel} ${opLabel} ${this.filterSizeValue()} j`;
  }

  onSizeFilterToggle(enabled: boolean) {
    this.filterSizeEnabled.set(enabled);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeCriterionChange(val: any) {
    this.filterSizeCriterion.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeOperatorChange(val: 'gte' | 'lte') {
    this.filterSizeOperator.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeValueChange(val: number | null) {
    this.filterSizeValue.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getProjectResourceTotal(project: Projet, period: 'today' | 'all' | '2025' | '2026'): number {
    const resourceTotals = new Map<string, number>();
    const todayWeekStart = this.calendarService.getWeekStart(new Date());
    const todayWeekStartStr = this.formatLocalDate(todayWeekStart);

    for (const charge of this.allCharges) {
      if (charge.projet_id !== project.id || !charge.semaine_debut) continue;
      
      const chargeWeekStr = charge.semaine_debut.split('T')[0];
      let match = false;
      if (period === 'today') {
        match = (chargeWeekStr >= todayWeekStartStr);
      } else if (period === 'all') {
        match = true;
      } else {
        const [y, m, d] = chargeWeekStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const isoYear = getISOWeekYear(date).toString();
        match = (isoYear === period);
      }
      
      if (match) {
        let resourceKey = '';
        let jours = 5;
        if (charge.role_id) {
          resourceKey = `role_${charge.role_id}`;
          const role = this.availableRoles.find(r => r.id === charge.role_id);
          jours = role?.jours_par_semaine || 5;
        } else if (charge.personne_id) {
          resourceKey = `personne_${charge.personne_id}`;
          const pers = this.availablePersonnes.find(p => p.id === charge.personne_id);
          jours = pers?.jours_par_semaine || 5;
        } else {
          continue;
        }
        
        const currentSum = resourceTotals.get(resourceKey) || 0;
        const val = (charge.unite_ressource || 0) * jours;
        resourceTotals.set(resourceKey, currentSum + val);
      }
    }

    // Find the maximum of all resource totals
    let maxTotal = 0;
    resourceTotals.forEach((total) => {
      if (total > maxTotal) {
        maxTotal = total;
      }
    });

    return maxTotal;
  }

  getProjectChiffresTotal(project: Projet, category: 'initial' | 'revise' | 'previsionnel' | 'consomme'): number {
    const idProjet = project.id_projet;
    if (idProjet === null || idProjet === undefined) return 0;
    
    let sum = 0;
    for (const c of this.allChiffres) {
      if (c.id_projet === idProjet) {
        sum += c[category] || 0;
      }
    }
    return sum;
  }

  // ─────────────────────────────────────────────────────────────────────────

  applyFilters() {
    this.calculateUsage();

    const search = this.globalSearch().toLowerCase().trim();

    // Period filter – computed once, O(n) pass on allCharges
    const periodStart = this.effectivePeriodStart;
    const periodEnd   = this.effectivePeriodEnd;
    const periodEnabled = this.filterPeriodEnabled();
    const activeProjectIds = periodEnabled ? this.getProjectsWithChargesInPeriod(periodStart, periodEnd) : new Set<string>();

    // Size filter – computed once
    const sizeEnabled = this.filterSizeEnabled() && this.filterSizeValue() !== null;
    const sizeCriterion = this.filterSizeCriterion();
    const sizeOperator = this.filterSizeOperator();
    const sizeValue = this.filterSizeValue() ?? 0;

    let matchingLargeProjectIds: Set<string> | null = null;
    if (sizeEnabled) {
      matchingLargeProjectIds = new Set<string>();
      for (const p of this.allProjects) {
        let val = 0;
        if (sizeCriterion.startsWith('charges_')) {
          const period = sizeCriterion.substring(8) as 'today' | 'all' | '2025' | '2026';
          val = this.getProjectResourceTotal(p, period);
        } else if (sizeCriterion.startsWith('chiffre_')) {
          const category = sizeCriterion.substring(8) as 'initial' | 'revise' | 'previsionnel' | 'consomme';
          val = this.getProjectChiffresTotal(p, category);
        }
        
        const matches = sizeOperator === 'gte' ? (val >= sizeValue) : (val <= sizeValue);
        if (matches) {
          matchingLargeProjectIds.add(p.id!);
        }
      }
    }

    const hasSpecificFilter = this.filterEquipeIds().length > 0 ||
      this.filterProjetIds().length > 0 ||
      this.filterResourceIds().length > 0 ||
      this.filterStatusIds().length > 0 ||
      periodEnabled ||
      sizeEnabled;
    const needsSearchFilter = search.length > 0;

    // 1. Index search matches once for O(1) lookups
    const matchingProjetIds = new Set<string>();
    const matchingEquipeIds = new Set<string>();
    const matchingRoleIds = new Set<string>();
    const matchingPersonneIds = new Set<string>();

    if (search) {
      for (const p of this.allProjects) {
        if (p.nom_projet.toLowerCase().includes(search) ||
          (p.code_projet && p.code_projet.toLowerCase().includes(search)) ||
          (p.reference_externe && p.reference_externe.toLowerCase().includes(search))) {
          matchingProjetIds.add(p.id!);
        }
      }
      for (const e of this.allEquipes) {
        if (e.nom.toLowerCase().includes(search) || (e.code && e.code.toLowerCase().includes(search))) {
          matchingEquipeIds.add(e.id!);
        }
      }
      for (const r of this.availableRoles) {
        if (r.nom.toLowerCase().includes(search)) matchingRoleIds.add(r.id!);
      }
      for (const p of this.availablePersonnes) {
        if (`${p.prenom} ${p.nom}`.toLowerCase().includes(search)) matchingPersonneIds.add(p.id!);
      }
    }

    const resourceMatchesSearchSelf = (res: ResourceRow): boolean => {
      if (!search) return true;
      if (res.label.toLowerCase().includes(search)) return true;
      if (res.reference_externe && res.reference_externe.toLowerCase().includes(search)) return true;
      if (res.type === 'role') return matchingRoleIds.has(res.resourceId || res.id);
      return matchingPersonneIds.has(res.resourceId || res.id);
    };

    const parentMatchesSearch = (parent: ParentRow): boolean => {
      if (!search) return true;
      if (parent.label.toLowerCase().includes(search)) return true;
      if (parent.code && parent.code.toLowerCase().includes(search)) return true;
      if (parent.reference_externe && parent.reference_externe.toLowerCase().includes(search)) return true;
      return false;
    };

    const childMatchesSearchSelf = (child: ChildRow): boolean => {
      if (!search) return true;
      if (child.label.toLowerCase().includes(search)) return true;
      if (child.code && child.code.toLowerCase().includes(search)) return true;
      if (child.reference_externe && child.reference_externe.toLowerCase().includes(search)) return true;
      return false;
    };

    if (!this.filterEquipeIds().length && !this.filterProjetIds().length && !this.filterResourceIds().length && !this.filterStatusIds().length && !search && !periodEnabled && !sizeEnabled) {
      this.rows = [...this.rowsAll];
      this.calculateFilteredMetrics();
      if (this.displayFormat() === 'flat') this.buildFlatList();
      return;
    }

    const filteredParents: ParentRow[] = [];
    const isResourceMode = this.viewMode() === 'resource';

    for (const parent of this.rowsAll) {
      const pMatches = parentMatchesSearch(parent);

      let parentPassesEquipe = true;
      if (this.filterEquipeIds().length) {
        if (this.viewMode() === "team") {
          parentPassesEquipe = this.filterEquipeIds().includes(parent.id);
        } else if (this.viewMode() === "resource") {
          const teamId = parent.id.split('_')[0];
          parentPassesEquipe = this.filterEquipeIds().includes(teamId);
        }
      }

      let parentPassesResource = true;
      if (this.filterResourceIds().length && this.viewMode() === "resource") {
        parentPassesResource = this.filterResourceIds().some((sel) => {
          const [t, id] = sel.split(":");
          return parent.id.endsWith(`${t}_${id}`);
        });
      }

      let parentPassesProjet = true;
      if (this.filterProjetIds().length && this.viewMode() === "project") {
        parentPassesProjet = this.filterProjetIds().includes(parent.id);
      }

      let parentPassesStatut = true;
      if (this.filterStatusIds().length) {
        if (this.viewMode() === 'project' && parent.originalProject) {
          parentPassesStatut = this.filterStatusIds().includes(parent.originalProject.statut);
        } else if (this.viewMode() === 'team' || this.viewMode() === 'resource') {
          parentPassesStatut = true;
        }
      }

      // Period & Size filters – parent level
      const parentPassesPeriod = !periodEnabled || this.hasChargesInPeriod(parent.totalCharges, periodStart, periodEnd);
      const parentPassesLargeProject = !sizeEnabled || this.viewMode() !== "project" || matchingLargeProjectIds!.has(parent.id);

      if (!parentPassesPeriod || !parentPassesLargeProject) continue;

      if (!pMatches && !parentPassesEquipe && !parentPassesResource && !parentPassesProjet && !parentPassesStatut) {
        if (this.viewMode() === 'project' && (!parentPassesProjet || !parentPassesStatut)) continue;
      }

      const newParent: ParentRow = {
        id: parent.id,
        label: parent.label,
        code: parent.code,
        color: parent.color,
        expanded: parent.expanded,
        children: [],
        totalCharges: parent.totalCharges,
        originalProject: parent.originalProject,
        metrics: new Map(),
      };

      let cMatchesAny = false;

      for (const child of parent.children) {
        const cMatchesSelf = childMatchesSearchSelf(child);
        let gMatchesAny = false;

        let childPassesStatut = true;
        if (this.filterStatusIds().length && this.viewMode() === 'team' && child.originalProject) {
          childPassesStatut = this.filterStatusIds().includes(child.originalProject.statut);
        }

        let childPassesLargeProject = true;
        if (sizeEnabled && this.viewMode() === 'team') {
          childPassesLargeProject = matchingLargeProjectIds!.has(child.id);
        }

        if (this.viewMode() === 'team' && (!childPassesStatut || !childPassesLargeProject)) continue;

        // Period filter – Child level: check if this child row has charges in the period
        if (periodEnabled) {
          if (this.viewMode() === 'team' && !this.hasChargesInPeriod(child.charges, periodStart, periodEnd)) continue;
          if (this.viewMode() === 'project' && !this.hasChargesInPeriod(child.charges, periodStart, periodEnd)) continue;
        }

        // Filter grandchildren
        let grandchildrenMatch = child.resources;
        if (hasSpecificFilter || needsSearchFilter) {
          grandchildrenMatch = child.resources.filter((gr) => {
            let passesIdFilter = true;
            if (this.filterResourceIds().length || this.filterProjetIds().length || this.filterStatusIds().length || sizeEnabled) {
              if (isResourceMode) {
                const project = this.allProjects.find(p => p.id === gr.projectId);
                const passesStatut = this.filterStatusIds().length === 0 || (!!project && this.filterStatusIds().includes(project.statut));
                const passesLargeProject = !sizeEnabled || (!!project && matchingLargeProjectIds!.has(gr.projectId!));
                passesIdFilter = (this.filterProjetIds().length === 0 || this.filterProjetIds().includes(gr.projectId!)) && passesStatut && passesLargeProject;
              } else {
                passesIdFilter = this.filterResourceIds().length === 0 || this.filterResourceIds().some((sel) => {
                  const [t, id] = sel.split(":");
                  return (t === "role" && gr.type === "role" && gr.id === id) || (t === "personne" && gr.type === "personne" && gr.id === id);
                });
              }
            }

            let passesSearch = true;
            if (search) {
              if (isResourceMode) {
                passesSearch = matchingProjetIds.has(gr.id);
              } else if (!pMatches && !cMatchesSelf) {
                passesSearch = resourceMatchesSearchSelf(gr);
              }
            }

            // Period filter – Grandchild level: check if this grandchild row has charges in the period
            const passesPeriod = !periodEnabled || this.hasChargesInPeriod(gr.charges, periodStart, periodEnd);

            const isMatch = passesIdFilter && passesSearch && passesPeriod;
            if (isMatch) gMatchesAny = true;
            return isMatch;
          });
        } else if (search) {
          for (const gr of child.resources) {
            if (resourceMatchesSearchSelf(gr)) { gMatchesAny = true; break; }
          }
        }

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
          childPassesResource = parentPassesResource;
        }

        const hasGrandchildFilter = isResourceMode
          ? (this.filterProjetIds().length > 0 || this.filterStatusIds().length > 0 || periodEnabled)
          : this.filterResourceIds().length > 0;
        const hasGrandchildrenMatch = hasGrandchildFilter ? grandchildrenMatch.length > 0 : true;

        const childMatches = cMatchesSelf || gMatchesAny;
        const childPassesSearch = !search || (pMatches && !isResourceMode) || childMatches;

        if (childPassesEquipe && childPassesProjet && childPassesResource && hasGrandchildrenMatch && childPassesSearch) {
          if (childMatches) cMatchesAny = true;
          newParent.children.push({
            id: child.id,
            label: child.label,
            code: child.code,
            color: child.color,
            expanded: child.expanded,
            resources: grandchildrenMatch,
            charges: child.charges,
            metrics: new Map(),
          });
        }
      }

      const hasChildren = newParent.children.length > 0;
      if (search && cMatchesAny) newParent.expanded = true;

      let showEmptyParent = false;
      if (this.viewMode() === 'project' && this.filterProjetIds().includes(parent.id)) {
        if (this.filterEquipeIds().length === 0 && this.filterResourceIds().length === 0) showEmptyParent = true;
      } else if ((this.viewMode() === 'team' || this.viewMode() === 'resource') && this.filterEquipeIds().includes(parent.id)) {
        if (this.filterProjetIds().length === 0 && this.filterResourceIds().length === 0) showEmptyParent = true;
      }

      if (parentPassesEquipe && parentPassesResource && parentPassesProjet && parentPassesStatut && (hasChildren || showEmptyParent || (search && pMatches))) {
        filteredParents.push(newParent);
      }
    }

    this.rows = filteredParents;
    this.calculateFilteredMetrics(); // Pre-calculate metrics for filtered view
    if (this.displayFormat() === 'flat') this.buildFlatList();
  }

  // Calculate metrics for current visible rows (after filtering)
  private calculateFilteredMetrics() {
    this.rows.forEach(parent => {
      // Re-calculate Parent metrics based on its current children (which are already filtered)
      const teamIdFromParent = this.viewMode() === 'resource' ? parent.id.split('_')[0] : parent.id;
      this.displayedWeeks.forEach(week => {
        const weekKey = week.toISOString().split("T")[0];
        let total = 0;
        let totalCapacity = 0;

        parent.children.forEach(child => {
          // Re-sum child totals
          let childTotal = 0;
          child.resources.forEach(res => {
            childTotal += res.metrics?.get(weekKey)?.total || 0;
          });
          child.metrics?.set(weekKey, { total: childTotal });
          if (this.viewMode() === 'resource') {
            total = parent.totalCharges?.get(weekKey) || 0;
          } else {
            total += childTotal;
          }
        });

        if (this.viewMode() === 'resource') {
          const parts = parent.id.split('_');
          const rType = parts[1];
          const rId = parts.slice(2).join('_');
          const capKey = `${teamIdFromParent}_${rType}_${rId}_${weekKey}`;
          totalCapacity = this.capacityIndex.get(capKey) || 0;
        }

        const availability = totalCapacity - total;
        let status: 'positive' | 'zero' | 'negative' | 'none' = 'none';
        if (totalCapacity > 0 || total > 0) {
          if (availability > 0) status = 'positive';
          else if (availability === 0) status = 'zero';
          else status = 'negative';
        }

        parent.metrics?.set(weekKey, {
          total,
          capacity: totalCapacity,
          availability: availability,
          status: status
        });
      });
    });
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
      // Prioritize the bulk input value if it has been set by the user
      const charge = (this.bulkChargeValue !== null) ? this.bulkChargeValue : (this.getResourceValue(cell.resource, cell.week) || 0);
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
      const yearSel = this.selectedCapacityYear();
      if (yearSel === 'today') {
        const todayWeekStart = this.calendarService.getWeekStart(new Date());
        const todayWeekStartStr = this.formatLocalDate(todayWeekStart);
        if (weekStr >= todayWeekStartStr) {
          total += val * resource.jours_par_semaine;
        }
      } else if (yearSel === 'custom' && this.selectedStartDate) {
        const selectedStartStr = this.formatLocalDate(this.selectedStartDate);
        if (weekStr >= selectedStartStr) {
          total += val * resource.jours_par_semaine;
        }
      } else {
        const [y, m, d] = weekStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const isoYear = getISOWeekYear(date).toString();
        if (yearSel === 'all' || isoYear === yearSel) {
          total += val * resource.jours_par_semaine;
        }
      }
    });
    return total;
  }

  getBadgePrefix(): string {
    const yearSel = this.selectedCapacityYear();
    if (yearSel === 'today') {
      const d = this.calendarService.getWeekStart(new Date());
      const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return `Dès le ${formatted} :`;
    }
    if (yearSel === 'all') return 'Tout :';
    if (yearSel === 'custom' && this.selectedStartDate) {
      const d = this.selectedStartDate;
      const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return `Dès le ${formatted} :`;
    }
    return `${yearSel} :`;
  }

  // --- Chiffres Triskell badge helpers ---

  /** Résout le id_service numérique Triskell depuis l'UUID d'une équipe. */
  private getIdServiceForTeam(teamId: string): number | null {
    const team = this.allEquipes.find(e => e.id === teamId);
    if (!team?.service_id) return null;
    const service = this.allServices.find(s => s.id === team.service_id);
    return service?.id_service ?? null;
  }

  /** Résout le id_projet numérique Triskell depuis l'UUID d'un projet. */
  private getIdProjetNumeric(projectId: string): number | null {
    const project = this.allProjects.find(p => p.id === projectId);
    return project?.id_projet ?? null;
  }

  /**
   * Retourne la valeur chiffre (selon chiffreMode) pour une équipe et un projet donnés (UUIDs).
   * Peut aussi prendre en compte une ressource spécifique pour une résolution plus granulaire du service.
   * Retourne null si aucun chiffre trouvé.
   */
  getChiffreValue(teamId: string, projectId: string, resourceId?: string, resourceType?: 'role' | 'personne'): number | null {
    let idService: number | null = null;

    if (resourceType === 'personne' && resourceId) {
      const personne = this.availablePersonnes.find(p => p.id === resourceId);
      idService = personne?.id_service ?? null;
    } else if (resourceType === 'role' && resourceId) {
      // Pour un rôle, on cherche l'attachement qui lie ce rôle à cette équipe
      const attachment = this.allRoleAttachments.find(a => a.role_id === resourceId && a.equipe_id === teamId);
      idService = attachment?.id_service ?? null;
    }

    // Fallback sur le service de l'équipe si non résolu par la ressource
    if (idService === null) {
      idService = this.getIdServiceForTeam(teamId);
    }

    const idProjet = this.getIdProjetNumeric(projectId);
    if (idService === null || idProjet === null) return null;

    const chiffre = this.allChiffres.find(c => c.id_projet === idProjet && c.id_service === idService);
    if (!chiffre) return null;

    const mode = this.chiffreMode();
    if (mode === 'restant') {
      const previsionnel = chiffre.previsionnel ?? 0;
      const consomme = chiffre.consomme ?? 0;
      return previsionnel - consomme;
    }
    const value = (chiffre as any)[mode];
    return value !== undefined ? value : null;
  }

  /** Libellé court du mode actif pour le badge chiffre. */
  getChiffreBadgeLabel(): string {
    switch (this.chiffreMode()) {
      case 'initial': return 'Init.';
      case 'revise': return 'Rév.';
      case 'previsionnel': return 'Prév.';
      case 'consomme': return 'Conso.';
      case 'restant': return 'Rest.';
    }
  }

  switchChiffreMode(mode: 'initial' | 'revise' | 'previsionnel' | 'consomme' | 'restant') {
    this.chiffreMode.set(mode);
    this.showChiffrePopover = false;
  }

  openChiffrePopover(event: MouseEvent, anchorId: string) {
    event.stopPropagation();
    const targetElement = event.currentTarget as HTMLElement;

    if (this.showChiffrePopover && this.activeChiffreAnchorId === anchorId) {
      this.showChiffrePopover = false;
      this.activeChiffreAnchorId = null;
      return;
    }

    this.activeChiffreAnchorId = anchorId;
    this.showChiffrePopover = true;

    // Calculate best position
    const rect = targetElement.getBoundingClientRect();
    const pos = calculateBestPopoverPosition({
      rect,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      popoverHeight: 180, // Estimated height of the chiffre popover
      popoverWidth: 160
    });
    this.chiffrePopoverPosition = pos;
    this.chiffrePopoverArrowSide = pos.arrowSide;

    this.cdr.markForCheck();

    const closeHandler = (e: MouseEvent | Event) => {
      if (e instanceof MouseEvent && targetElement.contains(e.target as Node)) {
        return;
      }
      this.showChiffrePopover = false;
      this.activeChiffreAnchorId = null;
      this.cdr.markForCheck();
      document.removeEventListener('click', closeHandler);
    };
    document.addEventListener('click', closeHandler);
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

    // Calculate best position
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
    this.selectedCapacityYear.set(year);
    this.selectedStartDate = null;
    this.showYearPopover = false;
  }

  onDateSelected(event: any) {
    const selectedDateStr = event.target.value;
    if (!selectedDateStr) return;

    const selectedDate = new Date(selectedDateStr);
    const mondayOfSelectedWeek = this.calendarService.getWeekStart(selectedDate);

    this.selectedStartDate = mondayOfSelectedWeek;
    this.selectedCapacityYear.set('custom');
    this.showYearPopover = false;
  }
  openProjectEdit(project: Projet) {
    if (project) {
      this.projectToEdit = { ...project };
      this.showProjectModal = true;
    }
  }
  openProjectEditByResource(resource: ResourceRow) {
    if (resource.projectId) {
      const project = this.allProjects.find(p => p.id === resource.projectId);
      if (project) {
        this.projectToEdit = { ...project };
        this.showProjectModal = true;
      }
    }
  }
}

