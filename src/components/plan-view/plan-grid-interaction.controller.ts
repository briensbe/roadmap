/**
 * @file plan-grid-interaction.controller.ts
 * @description Contrôleur des interactions physiques de la grille, des overlays DOM et du rendu visuel Timeline/Gantt (Deep Module).
 *
 * Responsabilités :
 * - Gérer la machine à états de sélection rectangulaire à la souris (drag-select), la détection des bordures à 5px
 *   et le déplacement fantôme de sélection (`moveGhostOffset`).
 * - Calculer le positionnement dynamique dans le viewport de la `SelectionToolbar`, des popovers et des tooltips,
 *   ainsi que le redimensionnement de la colonne de libellés et l'observation des hauteurs d'en-tête (`ResizeObserver`).
 * - Gérer l'ouverture/fermeture des menus déroulants, popovers d'année/chiffres et menus contextuels de ligne.
 * - Fournir les helpers visuels de la Timeline (semaines, mois, trimestres, années), des barres Gantt et des jalons.
 */
import { Directive, ElementRef, ViewChild, ChangeDetectorRef, NgZone, inject, signal } from '@angular/core';
import {
  calculateBestToolbarPosition,
  calculateBestPopoverPosition,
  ToolbarPosition,
  PopoverPosition,
} from '../../utils/selection-positioning';
import { storageSignal } from '../../utils/storage-signal';
import { Projet, Jalon } from '../../models/types';
import {
  PLAN_VIEW_ICONS,
  PlanViewMode,
  DisplayFormat,
  ZoomLevel,
  PlanningMode,
  ChiffreCategory,
  CapacityYearSelection,
  ResourceCellData,
  ResourceRow,
  ChildRow,
  ParentRow,
  FlatRow,
  DisplayedMonth,
  DisplayedQuarter,
  DisplayedYear,
  GanttBarRange,
  SelectedCell,
  ProjectionCommittingState,
  ChiffrePopoverData,
} from './plan-view.models';
import { formatWeekStart, formatLocalDate, cleanJiraRef } from './plan-projection.engine';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const JALON_PALETTE: Record<string, { badge: [string, string]; bg: [string, string]; text: [string, string]; border: [string, string] }> = {
  livraison: { badge: ['#10b981', '#059669'], bg: ['#064e3b', '#d1fae5'], text: ['#a7f3d0', '#065f46'], border: ['#10b981', '#34d399'] },
  lv: { badge: ['#10b981', '#059669'], bg: ['#064e3b', '#d1fae5'], text: ['#a7f3d0', '#065f46'], border: ['#10b981', '#34d399'] },
  maintenance: { badge: ['#c084fc', '#9333ea'], bg: ['#581c87', '#f3e8ff'], text: ['#f3e8ff', '#6b21a8'], border: ['#a855f7', '#c084fc'] },
  lvm: { badge: ['#c084fc', '#9333ea'], bg: ['#581c87', '#f3e8ff'], text: ['#f3e8ff', '#6b21a8'], border: ['#a855f7', '#c084fc'] },
  mep: { badge: ['#60a5fa', '#2563eb'], bg: ['#1e3a8a', '#dbeafe'], text: ['#bfdbfe', '#1e40af'], border: ['#3b82f6', '#60a5fa'] },
  sprint: { badge: ['#fbbf24', '#d97706'], bg: ['#78350f', '#fef3c7'], text: ['#fef3c7', '#92400e'], border: ['#f59e0b', '#fbbf24'] },
  sp: { badge: ['#fbbf24', '#d97706'], bg: ['#78350f', '#fef3c7'], text: ['#fef3c7', '#92400e'], border: ['#f59e0b', '#fbbf24'] },
  default: { badge: ['#94a3b8', '#6b7280'], bg: ['#334155', '#f3f4f6'], text: ['#f1f5f9', '#374151'], border: ['#64748b', '#cbd5e1'] },
};

export function generateWeeksTimeline(
  currentDate: Date,
  getWeekStartFn: (d: Date) => Date,
  getWeekNumberFn: (d: Date) => number,
  getWeekYearFn: (d: Date) => number,
): {
  displayedWeeks: Date[];
  displayedMonths: DisplayedMonth[];
  displayedYears: DisplayedYear[];
  isYearChangeMap: boolean[];
} {
  const displayedWeeks: Date[] = [];
  const startDate = new Date(currentDate);
  startDate.setDate(1);
  const firstWeek = getWeekStartFn(startDate);

  for (let i = 0; i < 53; i++) {
    const week = new Date(firstWeek);
    week.setDate(week.getDate() + i * 7);
    displayedWeeks.push(week);
  }

  const monthGroups: Record<string, { key: string; label: string; year: number; monthNum: number; weeks: Date[]; startWeekNum: number }> = {};
  const monthKeysOrder: string[] = [];

  for (const week of displayedWeeks) {
    const monthNum = week.getMonth();
    const year = week.getFullYear();
    const key = `${year}-${monthNum}`;
    if (!monthGroups[key]) {
      monthGroups[key] = { key, label: MONTH_NAMES[monthNum], year, monthNum, weeks: [], startWeekNum: getWeekNumberFn(week) };
      monthKeysOrder.push(key);
    }
    monthGroups[key].weeks.push(week);
  }

  const displayedMonths: DisplayedMonth[] = monthKeysOrder.map((key) => {
    const g = monthGroups[key];
    return {
      key: g.key,
      label: g.label,
      year: g.year,
      quarterLabel: `T${Math.floor(g.monthNum / 3) + 1} ${g.year}`,
      startWeekNum: g.startWeekNum,
      weeks: g.weeks,
    };
  });

  const displayedYears: DisplayedYear[] = [];
  const isYearChangeMap: boolean[] = [];

  displayedWeeks.forEach((week, index) => {
    const year = getWeekYearFn(week);
    const last = displayedYears[displayedYears.length - 1];
    if (last && last.year === year) last.weeksCount++;
    else displayedYears.push({ year, weeksCount: 1 });
    isYearChangeMap.push(index === 0 ? false : year !== getWeekYearFn(displayedWeeks[index - 1]));
  });

  return { displayedWeeks, displayedMonths, displayedYears, isYearChangeMap };
}

export function updateTooltipDomPosition(event: MouseEvent, tooltipEl?: HTMLElement): void {
  if (!tooltipEl) return;
  const offsetX = 15;
  const offsetY = 15;
  const tooltipWidth = 200;
  const tooltipHeight = 40;
  const x = event.clientX + offsetX + tooltipWidth > window.innerWidth ? event.clientX - tooltipWidth - offsetX : event.clientX + offsetX;
  const y = event.clientY + offsetY + tooltipHeight > window.innerHeight ? event.clientY - tooltipHeight - offsetY : event.clientY + offsetY;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

export function updateDragProjectionTooltipDomPosition(event: MouseEvent, tooltipEl?: HTMLElement): void {
  if (!tooltipEl) return;
  const spaceBelow = window.innerHeight - event.clientY;
  tooltipEl.style.left = `${event.clientX}px`;
  tooltipEl.style.top = `${spaceBelow > 80 ? event.clientY + 20 : event.clientY - 65}px`;
}

export function updateGridHeaderHeights(headerEl?: HTMLElement, milestonesEl?: HTMLElement): void {
  if (!headerEl || !milestonesEl) return;
  const gridEl = headerEl.parentElement;
  if (gridEl) {
    const headerHeight = headerEl.getBoundingClientRect().height || headerEl.offsetHeight;
    const milestonesHeight = milestonesEl.getBoundingClientRect().height || milestonesEl.offsetHeight;
    gridEl.style.setProperty('--calendar-header-height', `${headerHeight}px`);
    gridEl.style.setProperty('--milestones-header-height', `${milestonesHeight}px`);
  }
}

@Directive()
export abstract class PlanGridInteractionController {
  protected readonly cdr = inject(ChangeDetectorRef);
  protected readonly ngZone = inject(NgZone);

  @ViewChild('tooltipElement') tooltipElement?: ElementRef<HTMLElement>;
  @ViewChild('dragProjectionTooltip') dragProjectionTooltip?: ElementRef<HTMLElement>;
  @ViewChild('headerRow') headerRowElement?: ElementRef<HTMLElement>;
  @ViewChild('milestonesRow') milestonesRowElement?: ElementRef<HTMLElement>;

  protected resizeObserver?: ResizeObserver;

  viewMode = storageSignal<PlanViewMode>('plan-view-mode', 'resource');
  displayFormat = storageSignal<DisplayFormat>('plan-view-display-format', 'tree');
  zoomLevel = storageSignal<ZoomLevel>('plan-view-zoom-level', 'normal');
  showAvailability = storageSignal<boolean>('plan-view-show-availability', false);
  weekFilters = storageSignal<number[]>('plan-view-week-filters', []);
  chiffreMode = storageSignal<ChiffreCategory>('plan-view-chiffre-mode', 'previsionnel');
  planningMode = storageSignal<PlanningMode>('plan-view-planning-mode', 'saisie');
  selectedCapacityYear = storageSignal<CapacityYearSelection>('plan-view-capacity-year', 'today');
  labelColumnWidth = storageSignal<number>('plan-view-label-column-width', 300);
  showGlobalFilters = signal<boolean>(false);
  filterJalonTypes = storageSignal<string[]>('plan-view-filter-jalon-types', []);
  filterProjetSearch = storageSignal<string>('plan-view-filter-search', '');
  copiedCodes = signal<Set<string>>(new Set());

  displayedMonths: DisplayedMonth[] = [];
  displayedWeeks: Date[] = [];
  displayedYears: DisplayedYear[] = [];
  isYearChangeMap: boolean[] = [];
  currentDate: Date = new Date();

  allProjects: Projet[] = [];
  allJalons: Jalon[] = [];

  selectedStartDate: Date | null = null;
  showYearPopover = false;
  showChiffrePopover = false;
  chiffrePopoverPosition: PopoverPosition | null = null;
  chiffrePopoverArrowSide: 'top' | 'bottom' = 'top';
  activeChiffreAnchorId: string | null = null;
  activeChiffrePopoverData: ChiffrePopoverData | null = null;
  popoverPosition: PopoverPosition | null = null;
  popoverArrowSide: 'top' | 'bottom' = 'top';
  activeAnchorId: string | null = null;

  isResizing = false;
  protected startX = 0;
  protected startWidth = 0;

  activeTooltip: string | null = null;
  private tooltipShowTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;

  openEquipeDropdown = false;
  openProjetDropdown = false;
  openResourceDropdown = false;
  openStatusDropdown = false;
  showPeriodDropdown = false;
  openSizeDropdown = false;
  openJalonDropdown = false;
  openViewDropdown = false;
  showActionsMenu = false;
  activeActionsSubmenu: string | null = null;
  activeLineMenuId: string | null = null;
  lineMenuPosition = { x: 0, y: 0 };

  isDragging = false;
  dragStartResource: ResourceRow | null = null;
  protected dragStartChild?: ChildRow;
  protected dragStartParent?: ParentRow;
  dragStartWeekIndex = -1;
  dragEndWeekIndex = -1;
  selectedCells: SelectedCell[] = [];
  isSelectionFinished = false;
  showServiceSelectionModal = false;
  serviceSelectionSummary = {
    units: 0,
    days: 0,
    weeksCount: 0,
    rowLabel: '',
  };
  toolbarPosition: ToolbarPosition | null = null;
  toolbarVisible = false;
  dragStartCellValue: number | null = null;
  dragProjectionTooltipVisible = false;

  bulkChargeValue: number | null = null;
  bulkComment = '';
  isSaving = false;
  isCommittingSelection = false;
  projectionCommitting: ProjectionCommittingState | null = null;

  isMovingSelection = false;
  isMoveCommitting = false;
  isOverSelectionBorder = false;
  moveStartWeekIndex = -1;
  moveGhostOffset = 0;
  moveDragBadgeX = 0;
  moveDragBadgeY = 0;
  private moveStartClientX = 0;
  private cellWidthPx = 80;

  readonly Plus = PLAN_VIEW_ICONS.Plus;
  readonly X = PLAN_VIEW_ICONS.X;
  readonly Contact = PLAN_VIEW_ICONS.Contact;
  readonly User = PLAN_VIEW_ICONS.User;
  readonly FileDown = PLAN_VIEW_ICONS.FileDown;
  readonly MoreVertical = PLAN_VIEW_ICONS.MoreVertical;
  readonly ListTree = PLAN_VIEW_ICONS.ListTree;
  readonly AlignJustify = PLAN_VIEW_ICONS.AlignJustify;
  readonly Eye = PLAN_VIEW_ICONS.Eye;
  readonly EyeOff = PLAN_VIEW_ICONS.EyeOff;
  readonly Calendar = PLAN_VIEW_ICONS.Calendar;
  readonly ChevronLeft = PLAN_VIEW_ICONS.ChevronLeft;
  readonly ChevronDown = PLAN_VIEW_ICONS.ChevronDown;
  readonly ChevronRight = PLAN_VIEW_ICONS.ChevronRight;
  readonly Network = PLAN_VIEW_ICONS.Network;
  readonly Users = PLAN_VIEW_ICONS.Users;
  readonly BookUser = PLAN_VIEW_ICONS.BookUser;
  readonly Settings2 = PLAN_VIEW_ICONS.Settings2;
  readonly Search = PLAN_VIEW_ICONS.Search;
  readonly LucideCalculator = PLAN_VIEW_ICONS.LucideCalculator;
  readonly GripVertical = PLAN_VIEW_ICONS.GripVertical;
  readonly ArrowUp = PLAN_VIEW_ICONS.ArrowUp;
  readonly ArrowDown = PLAN_VIEW_ICONS.ArrowDown;
  readonly Play = PLAN_VIEW_ICONS.Play;
  readonly Filter = PLAN_VIEW_ICONS.Filter;
  readonly Trash2 = PLAN_VIEW_ICONS.Trash2;
  readonly Copy = PLAN_VIEW_ICONS.Copy;
  readonly Check = PLAN_VIEW_ICONS.Check;
  readonly Layers = PLAN_VIEW_ICONS.Layers;
  readonly Building2 = PLAN_VIEW_ICONS.Building2;
  readonly LoaderCircle = PLAN_VIEW_ICONS.LoaderCircle;
  readonly AlertTriangle = PLAN_VIEW_ICONS.AlertTriangle;
  readonly Info = PLAN_VIEW_ICONS.Info;
  readonly SquarePlus = PLAN_VIEW_ICONS.SquarePlus;
  readonly SquareMinus = PLAN_VIEW_ICONS.SquareMinus;
  readonly ExternalLink = PLAN_VIEW_ICONS.ExternalLink;

  protected abstract isDarkMode(): boolean;
  protected abstract getTodayWeekStart(): Date;
  abstract executeMove(): Promise<void>;

  // --- Timeline, Gantt & Jalons Visual Helpers ---
  get displayedQuarters(): DisplayedQuarter[] {
    const quarters: DisplayedQuarter[] = [];
    for (const m of this.displayedMonths) {
      let q = quarters.find((x) => x.label === m.quarterLabel);
      if (!q) {
        q = { label: m.quarterLabel, year: m.year, weeksCount: 0, months: [] };
        quarters.push(q);
      }
      q.months.push(m);
      q.weeksCount += m.weeks.length;
    }
    return quarters;
  }

  formatWeekStart(date: Date): string {
    return formatWeekStart(date);
  }

  formatLocalDate(d: Date): string {
    return formatLocalDate(d);
  }

  formatWeekHeader(date: Date): string {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  isFirstWeekOfYear(index: number): boolean {
    return this.isYearChangeMap[index] ?? false;
  }

  cleanJiraRef(ref: string | null | undefined): string {
    return cleanJiraRef(ref);
  }

  getGanttBar(charges: Map<string, number> | undefined): GanttBarRange | null {
    if (!charges || charges.size === 0 || !this.displayedWeeks.length) return null;
    let firstIndex = -1;
    let lastIndex = -1;
    for (let i = 0; i < this.displayedWeeks.length; i++) {
      if ((charges.get(formatWeekStart(this.displayedWeeks[i])) || 0) > 0) {
        if (firstIndex === -1) firstIndex = i;
        lastIndex = i;
      }
    }
    if (firstIndex === -1) return null;
    const totalWeeks = this.displayedWeeks.length;
    return { left: (firstIndex / totalWeeks) * 100, width: ((lastIndex - firstIndex + 1) / totalWeeks) * 100 };
  }

  getAssociatedProject(
    row: { originalProject?: Projet; projectId?: string; resource?: ResourceRow } | undefined,
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): Projet | undefined {
    const mode = this.viewMode();
    if (mode === 'project') return parentRow?.originalProject || row?.originalProject;
    if (mode === 'team') return childRow?.originalProject || row?.originalProject;
    const projId = row?.projectId || row?.resource?.projectId;
    return projId ? this.allProjects.find((p) => p.id === projId) : undefined;
  }

  getGanttBarColor(
    row: { originalProject?: Projet; projectId?: string; resource?: ResourceRow; color?: string } | undefined,
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): string {
    return this.getAssociatedProject(row, parentRow, childRow)?.color || row?.color || childRow?.color || '#10b981';
  }

  getGanttJalons(
    row: { originalProject?: Projet; projectId?: string; resource?: ResourceRow } | undefined,
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): Jalon[] {
    const project = this.getAssociatedProject(row, parentRow, childRow);
    if (!project?.id || !this.displayedWeeks.length) return [];
    const start = this.displayedWeeks[0];
    const end = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]);
    end.setDate(end.getDate() + 7);
    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter((j) => {
      if (j.projet_id !== project.id) return false;
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) return false;
      const d = new Date(j.event_date);
      return d >= start && d <= end;
    });
  }

  getJalonLeftPercentage(jalon: Jalon): number {
    if (!this.displayedWeeks.length) return 0;
    const jDate = new Date(jalon.event_date).getTime();
    const start = this.displayedWeeks[0].getTime();
    const end = this.displayedWeeks[this.displayedWeeks.length - 1].getTime() + 7 * 24 * 60 * 60 * 1000;
    if (end <= start) return 0;
    return Math.max(0, Math.min(100, ((jDate - start) / (end - start)) * 100));
  }

  get visibleJalons(): Jalon[] {
    if (!this.displayedWeeks.length) return [];
    const start = this.displayedWeeks[0];
    const end = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]);
    end.setDate(end.getDate() + 7);
    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter((j) => {
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) return false;
      const d = new Date(j.event_date);
      return d >= start && d <= end;
    });
  }

  get uniqueJalonTypes(): string[] {
    const types = new Set<string>();
    for (const j of this.allJalons) if (j.event_type) types.add(j.event_type);
    return Array.from(types).sort();
  }

  getJalonsForWeek(week: Date): Jalon[] {
    const startOfWeek = new Date(week);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const activeTypes = this.filterJalonTypes();
    return this.allJalons.filter((j) => {
      if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) return false;
      const jDate = new Date(j.event_date);
      return jDate >= startOfWeek && jDate <= endOfWeek;
    });
  }

  private pickJalonColor(type: string, channel: 'badge' | 'bg' | 'text' | 'border'): string {
    const entry = JALON_PALETTE[type?.toLowerCase()] || JALON_PALETTE['default'];
    return entry[channel][this.isDarkMode() ? 0 : 1];
  }

  getJalonBadgeColor(type: string): string {
    return this.pickJalonColor(type, 'badge');
  }
  getJalonColor(type: string): string {
    return this.pickJalonColor(type, 'bg');
  }
  getJalonTextColor(type: string): string {
    return this.pickJalonColor(type, 'text');
  }
  getJalonBorderColor(type: string): string {
    return this.pickJalonColor(type, 'border');
  }

  // --- Row/Cell Formatting & Metrics Helpers ---
  getCellTooltip(resource: ResourceRow, week: Date, cell?: ResourceCellData): string {
    const weekKey = formatWeekStart(week);
    const val = resource.charges?.get(weekKey) || 0;
    const comment = cell?.comment ?? resource.comments?.get(weekKey);
    const hasVisibleAvailability = !!(cell && cell.showAvailability && cell.hasCapRecord && (val > 0 || this.showAvailability()));
    if (val <= 0 && !comment && !hasVisibleAvailability) return '';
    const days = resource.dailyCharges
      ? Math.round((resource.dailyCharges.get(weekKey) || 0) * 10) / 10
      : Math.round(val * (resource.jours_par_semaine || 5) * 10) / 10;
    let text = `${resource.label} : ${val} ETP (${days}j)`;
    if (hasVisibleAvailability) {
      text += ` | Dispo : ${cell!.availability > 0 ? '+' : ''}${cell!.availability} ETP`;
    }
    if (comment) text += `\n💬 Note : ${comment}`;
    return text;
  }

  getResourceMetricsYear(resource: ResourceRow, year: number): number {
    let total = 0;
    if (resource.dailyCharges) {
      for (const [weekKey, days] of resource.dailyCharges) {
        if (new Date(weekKey).getFullYear() === year) total += days;
      }
      return total;
    }
    for (const [weekKey, charge] of resource.charges) {
      if (new Date(weekKey).getFullYear() === year) total += charge * resource.jours_par_semaine;
    }
    return total;
  }

  getChildMetricsYear(child: ChildRow, year: number): number {
    let total = 0;
    for (const resource of child.resources) total += this.getResourceMetricsYear(resource, year);
    return total;
  }

  getRowMetricsYear(row: ParentRow, year: number): number {
    let total = 0;
    for (const child of row.children) total += this.getChildMetricsYear(child, year);
    return total;
  }

  getFlatRowMetricsYear(row: FlatRow, year: number): number {
    return this.getResourceMetricsYear(row.resource, year);
  }

  getBadgePrefix(): string {
    const yearSel = this.selectedCapacityYear();
    if (yearSel === 'today') {
      const d = this.getTodayWeekStart();
      return `Dès le ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} :`;
    }
    if (yearSel === 'all') return 'Tout :';
    if (yearSel === 'custom' && this.selectedStartDate) {
      const d = this.selectedStartDate;
      return `Dès le ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} :`;
    }
    return `${yearSel} :`;
  }

  getChiffreBadgeLabel(): string {
    const labels: Record<ChiffreCategory, string> = {
      initial: 'Init.',
      revise: 'Rév.',
      previsionnel: 'Prév.',
      consomme: 'Conso.',
      restant: 'Rest.',
    };
    return labels[this.chiffreMode()];
  }

  getChildValue(child: ChildRow, week: Date): number {
    return child.charges.get(formatWeekStart(week)) || 0;
  }

  getResourceValue(resource: ResourceRow, week: Date): number {
    return resource.charges.get(formatWeekStart(week)) || 0;
  }

  trackByRow(_index: number, row: ParentRow) {
    return row.id;
  }
  trackByChild(_index: number, child: ChildRow) {
    return child.id;
  }
  trackByResource(_index: number, res: ResourceRow) {
    return res.uniqueId;
  }
  trackByWeek(_index: number, week: Date) {
    return week.getTime();
  }
  trackByFlatRow(_index: number, row: FlatRow) {
    return row.uniqueId;
  }

  copyToClipboard(event: MouseEvent, text: string, key?: string) {
    event.stopPropagation();
    const idToStore = key || text;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const current = new Set(this.copiedCodes());
        current.add(idToStore);
        this.copiedCodes.set(current);
        setTimeout(() => {
          const updated = new Set(this.copiedCodes());
          updated.delete(idToStore);
          this.copiedCodes.set(updated);
        }, 2000);
      })
      .catch((err) => console.error('Failed to copy code: ', err));
  }

  // --- Dropdowns, Popovers, Tooltips & Column Resize ---
  protected closeAllFilterDropdowns() {
    this.openEquipeDropdown = false;
    this.openProjetDropdown = false;
    this.openResourceDropdown = false;
    this.openStatusDropdown = false;
    this.showPeriodDropdown = false;
    this.openSizeDropdown = false;
    this.openJalonDropdown = false;
  }

  toggleGlobalFilters() {
    this.showGlobalFilters.set(!this.showGlobalFilters());
    if (!this.showGlobalFilters()) this.closeAllFilterDropdowns();
  }

  toggleViewDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.openViewDropdown = !this.openViewDropdown;
    if (this.openViewDropdown) {
      this.closeAllFilterDropdowns();
      this.showActionsMenu = false;
    }
    this.cdr.markForCheck();
  }

  toggleDropdown(name: 'equipe' | 'projet' | 'resource' | 'statut' | 'size' | 'jalon', event: MouseEvent) {
    event.stopPropagation();
    this.openViewDropdown = false;
    this.openEquipeDropdown = name === 'equipe' ? !this.openEquipeDropdown : false;
    this.openProjetDropdown = name === 'projet' ? !this.openProjetDropdown : false;
    this.openResourceDropdown = name === 'resource' ? !this.openResourceDropdown : false;
    this.openStatusDropdown = name === 'statut' ? !this.openStatusDropdown : false;
    this.openSizeDropdown = name === 'size' ? !this.openSizeDropdown : false;
    this.openJalonDropdown = name === 'jalon' ? !this.openJalonDropdown : false;
    this.showPeriodDropdown = false;
    if (!this.openProjetDropdown) this.filterProjetSearch.set('');
  }

  togglePeriodDropdown(event: Event) {
    event.stopPropagation();
    const next = !this.showPeriodDropdown;
    this.closeAllFilterDropdowns();
    this.showPeriodDropdown = next;
    this.cdr.markForCheck();
  }

  toggleActionsSubmenu(menu: string, event: MouseEvent) {
    event.stopPropagation();
    this.activeActionsSubmenu = this.activeActionsSubmenu === menu ? null : menu;
    this.cdr.markForCheck();
  }

  toggleActionsMenu(event: MouseEvent) {
    event.stopPropagation();
    this.openViewDropdown = false;
    this.showActionsMenu = !this.showActionsMenu;
    if (!this.showActionsMenu) this.activeActionsSubmenu = null;
    this.cdr.markForCheck();
  }

  toggleLineMenu(rowId: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeLineMenuId === rowId) {
      this.activeLineMenuId = null;
    } else {
      this.activeLineMenuId = rowId;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.lineMenuPosition = { x: rect.right, y: rect.bottom };
    }
    this.cdr.markForCheck();
  }

  closeLineMenu() {
    this.activeLineMenuId = null;
    this.cdr.markForCheck();
  }

  switchChiffreMode(mode: ChiffreCategory) {
    this.chiffreMode.set(mode);
    this.showChiffrePopover = false;
    this.activeChiffrePopoverData = null;
  }

  openChiffrePopover(
    event: MouseEvent,
    anchorId: string,
    teamId: string,
    projectId: string,
    resourceId?: string,
    resourceType?: 'role' | 'personne',
  ) {
    event.stopPropagation();
    const targetElement = event.currentTarget as HTMLElement;
    if (this.showChiffrePopover && this.activeChiffreAnchorId === anchorId) {
      this.showChiffrePopover = false;
      this.activeChiffreAnchorId = null;
      this.activeChiffrePopoverData = null;
      return;
    }

    this.activeChiffreAnchorId = anchorId;
    this.activeChiffrePopoverData = { teamId, projectId, resourceId, resourceType };
    this.showChiffrePopover = true;

    const pos = calculateBestPopoverPosition({
      rect: targetElement.getBoundingClientRect(),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      popoverHeight: 180,
      popoverWidth: 210,
    });
    this.chiffrePopoverPosition = pos;
    this.chiffrePopoverArrowSide = pos.arrowSide;
    this.cdr.markForCheck();

    const closeHandler = (e: MouseEvent | Event) => {
      if (e instanceof MouseEvent && targetElement.contains(e.target as Node)) return;
      this.showChiffrePopover = false;
      this.activeChiffreAnchorId = null;
      this.activeChiffrePopoverData = null;
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

    const pos = calculateBestPopoverPosition({
      rect: targetElement.getBoundingClientRect(),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      popoverHeight: 200,
      popoverWidth: 160,
    });
    this.popoverPosition = pos;
    this.popoverArrowSide = pos.arrowSide;

    const closeHandler = (e: MouseEvent | Event) => {
      if (e instanceof MouseEvent && targetElement.contains(e.target as Node)) return;
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

  getSelectedStartDateISO(): string {
    return this.selectedStartDate ? formatLocalDate(this.selectedStartDate) : '';
  }

  private clearTooltipTimers() {
    if (this.tooltipShowTimer) clearTimeout(this.tooltipShowTimer);
    if (this.tooltipHideTimer) clearTimeout(this.tooltipHideTimer);
    this.tooltipShowTimer = null;
    this.tooltipHideTimer = null;
  }

  private isTooltipBlocked(): boolean {
    return this.isDragging || this.isMovingSelection || this.isResizing || this.selectedCells.length > 0 || this.isSaving;
  }

  showTooltip(event: MouseEvent, text: string) {
    this.clearTooltipTimers();
    if (!text || this.isTooltipBlocked()) {
      if (this.activeTooltip !== null) {
        this.activeTooltip = null;
        this.cdr.markForCheck();
      }
      return;
    }
    if (this.activeTooltip === text) return;
    if (this.activeTooltip !== null) {
      this.activeTooltip = null;
      this.cdr.markForCheck();
    }
    this.tooltipShowTimer = setTimeout(() => {
      if (this.isTooltipBlocked()) return;
      this.activeTooltip = text;
      updateTooltipDomPosition(event, this.tooltipElement?.nativeElement);
      this.cdr.markForCheck();
    }, 400);
  }

  hideTooltip() {
    this.clearTooltipTimers();
    this.tooltipHideTimer = setTimeout(() => {
      if (this.activeTooltip !== null) {
        this.activeTooltip = null;
        this.cdr.markForCheck();
      }
    }, 80);
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.hideTooltip();
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.labelColumnWidth();
  }

  setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') return;
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        updateGridHeaderHeights(this.headerRowElement?.nativeElement, this.milestonesRowElement?.nativeElement);
      });
      if (this.headerRowElement?.nativeElement) this.resizeObserver.observe(this.headerRowElement.nativeElement);
      if (this.milestonesRowElement?.nativeElement) this.resizeObserver.observe(this.milestonesRowElement.nativeElement);
      setTimeout(() => {
        updateGridHeaderHeights(this.headerRowElement?.nativeElement, this.milestonesRowElement?.nativeElement);
      }, 0);
    });
  }

  // --- Grid Selection & Drag-Move ---
  get selectionStartWeekDate(): Date | null {
    if (this.selectedCells.length === 0) return null;
    return [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime())[0].week;
  }

  get selectionDaysPerWeek(): number {
    return this.selectedCells.length > 0 ? this.selectedCells[0].resource.jours_par_semaine || 5 : 5;
  }

  get dragProjectionDays(): number {
    if (!this.dragStartCellValue || this.dragStartCellValue <= 0) return 0;
    return this.selectedCells.length * this.dragStartCellValue * (this.dragStartResource?.jours_par_semaine || 5);
  }

  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const charge = this.bulkChargeValue !== null ? this.bulkChargeValue : this.getResourceValue(cell.resource, cell.week) || 0;
      total += charge * (cell.resource.jours_par_semaine || 0);
    }
    return total;
  }

  getResourceUniqueId(resource: Pick<ResourceRow, 'id' | 'type'>, child: Pick<ChildRow, 'id'>, parent: Pick<ParentRow, 'id'>): string {
    return `${parent.id}_${child.id}_${resource.id}_${resource.type} `;
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectedCells.some((s) => s.resource.uniqueId === resource.uniqueId && s.week.getTime() === week.getTime());
  }

  isProjectionCommitting(resource: ResourceRow, weekIndex: number, child: ChildRow, parent: ParentRow): boolean {
    if (!this.projectionCommitting) return false;
    if (this.getResourceUniqueId(resource, child, parent) !== this.projectionCommitting.resourceUniqueId) return false;
    return weekIndex >= this.projectionCommitting.startWeekIdx && weekIndex < this.projectionCommitting.startWeekIdx + this.projectionCommitting.nbWeeks;
  }

  isCellGhostSelected(resource: ResourceRow, weekIndex: number, child: ChildRow, parent: ParentRow): boolean {
    if (!this.isMovingSelection || this.moveGhostOffset === 0 || this.selectedCells.length === 0) return false;
    const firstCell = this.selectedCells[0];
    if (this.getResourceUniqueId(resource, child, parent) !== this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId })) {
      return false;
    }
    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return false;
    return this.isCellSelected(resource, this.displayedWeeks[sourceWeekIndex]);
  }

  getAbsOffset(): number {
    return Math.abs(this.moveGhostOffset);
  }

  getGhostValue(resource: ResourceRow, weekIndex: number): number | null {
    if (!this.isMovingSelection || this.moveGhostOffset === 0) return null;
    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return null;
    const sourceWeek = this.displayedWeeks[sourceWeekIndex];
    return this.isCellSelected(resource, sourceWeek) ? resource.charges.get(formatWeekStart(sourceWeek)) || 0 : null;
  }

  getCellSelectionClasses(resource: ResourceRow, week: Date, weekIndex: number, child: ChildRow, parent: ParentRow): Record<string, boolean> {
    if (this.selectedCells.length === 0 && !this.projectionCommitting) return {};
    const selected = this.isCellSelected(resource, week);
    if (this.isMovingSelection) {
      if (this.isCellGhostSelected(resource, weekIndex, child, parent)) {
        return { selected: true, 'ghost-selection': true, committing: this.isMoveCommitting };
      }
      if (selected) return this.moveGhostOffset === 0 ? { selected: true } : { 'moving-source': true };
      return {};
    }
    if (this.isProjectionCommitting(resource, weekIndex, child, parent)) {
      return { selected: true, committing: true };
    }
    if (!selected) return {};
    return { selected: true, committing: this.isCommittingSelection, 'is-over-border': this.isOverSelectionBorder };
  }

  protected shouldShowProjectionTooltip(): boolean {
    if (this.selectedCells.length <= 1 || !this.dragStartCellValue || this.dragStartCellValue <= 0) return false;
    for (let i = 1; i < this.selectedCells.length; i++) {
      const cell = this.selectedCells[i];
      if ((cell.resource.charges.get(formatWeekStart(cell.week)) || 0) > 0) return false;
    }
    return true;
  }

  updateSelection(child: ChildRow, parent: ParentRow) {
    if (!this.dragStartResource || this.dragStartWeekIndex < 0 || this.dragEndWeekIndex < 0) {
      this.selectedCells = [];
      return;
    }
    const cells: SelectedCell[] = [];
    const startIndex = Math.min(this.dragStartWeekIndex, this.dragEndWeekIndex);
    const endIndex = Math.max(this.dragStartWeekIndex, this.dragEndWeekIndex);
    for (let i = startIndex; i <= endIndex; i++) {
      cells.push({ resource: this.dragStartResource, week: this.displayedWeeks[i], childId: child.id, parentId: parent.id });
    }
    this.selectedCells = cells;
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
    this.bulkComment = '';
    this.dragStartCellValue = null;
    this.dragProjectionTooltipVisible = false;
    this.isMovingSelection = false;
    this.isMoveCommitting = false;
    this.isCommittingSelection = false;
    this.projectionCommitting = null;
    this.isOverSelectionBorder = false;
    this.moveGhostOffset = 0;
  }

  closeServiceSelectionModal(): void {
    this.showServiceSelectionModal = false;
    this.clearSelection();
    this.cdr.markForCheck();
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    this.activeTooltip = null;
    this.hideTooltip();
    if (this.isOverSelectionBorder) {
      if (this.viewMode() === 'service') return;
      this.isMovingSelection = true;
      this.moveGhostOffset = 0;
      this.moveStartClientX = event.clientX;
      const cell = (event.target as HTMLElement).closest('.week-cell') as HTMLElement | null;
      if (cell) {
        this.cellWidthPx = cell.getBoundingClientRect().width || 80;
        const indexStr = cell.getAttribute('data-week-index');
        if (indexStr) this.moveStartWeekIndex = parseInt(indexStr, 10);
      }
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

    const cell = (event.target as HTMLElement).closest('.week-cell');
    const indexStr = cell?.getAttribute('data-week-index');
    if (indexStr) {
      if (this.viewMode() === 'service') {
        event.preventDefault();
      }
      this.dragStartWeekIndex = parseInt(indexStr, 10);
      this.dragEndWeekIndex = this.dragStartWeekIndex;
      const startWeek = this.displayedWeeks[this.dragStartWeekIndex];
      const existingValue = startWeek ? resource.charges.get(formatWeekStart(startWeek)) || 0 : 0;
      this.dragStartCellValue = existingValue > 0 ? existingValue : null;
      this.updateSelection(child, parent);
      this.cdr.markForCheck();
    }
  }

  onGlobalMouseMove(event: MouseEvent) {
    if (this.activeTooltip) updateTooltipDomPosition(event, this.tooltipElement?.nativeElement);

    if (this.isDragging && this.dragStartResource) {
      const target = event.target as HTMLElement;
      const cell = target.closest('.week-cell');
      const row = cell ? target.closest('.calendar-row') : null;
      if (cell && row) {
        const resId = row.getAttribute('data-resource-id');
        const expectedId = this.getResourceUniqueId(this.dragStartResource, this.dragStartChild!, this.dragStartParent!);
        if (resId === expectedId) {
          const indexStr = cell.getAttribute('data-week-index');
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
        if (this.viewMode() !== 'service' && this.dragStartCellValue && this.dragStartCellValue > 0) {
          updateDragProjectionTooltipDomPosition(event, this.dragProjectionTooltip?.nativeElement);
          const shouldShow = this.shouldShowProjectionTooltip();
          if (shouldShow !== this.dragProjectionTooltipVisible) {
            this.ngZone.run(() => {
              this.dragProjectionTooltipVisible = shouldShow;
              this.cdr.markForCheck();
            });
          }
        }
      }
    }

    if (this.isMovingSelection && !this.isMoveCommitting && this.selectedCells.length > 0) {
      const newOffset = Math.round((event.clientX - this.moveStartClientX) / this.cellWidthPx);
      if (newOffset !== this.moveGhostOffset) {
        this.ngZone.run(() => {
          this.moveGhostOffset = newOffset;
          this.cdr.markForCheck();
        });
      }
    }

    if (this.viewMode() !== 'service' && !this.isDragging && !this.isMovingSelection && this.selectedCells.length > 0 && this.isSelectionFinished) {
      const target = event.target as HTMLElement;
      const cell = target.closest('.week-cell');
      let isBorder = false;
      if (cell?.classList.contains('selected')) {
        const rect = cell.getBoundingClientRect();
        const margin = 5;
        const resId = target.closest('.calendar-row')?.getAttribute('data-resource-id');
        const weekIndex = parseInt(cell.getAttribute('data-week-index') || '-1', 10);
        const firstCell = this.selectedCells[0];
        const selResId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId });
        if (resId && resId === selResId) {
          const selectedWeeks = this.selectedCells.map((c) => this.displayedWeeks.findIndex((w) => w.getTime() === c.week.getTime()));
          const isMinW = weekIndex === Math.min(...selectedWeeks);
          const isMaxW = weekIndex === Math.max(...selectedWeeks);
          isBorder =
            (isMinW && event.clientX - rect.left < margin) ||
            (isMaxW && rect.right - event.clientX < margin) ||
            event.clientY - rect.top < margin ||
            rect.bottom - event.clientY < margin;
        }
      }
      if (this.isOverSelectionBorder !== isBorder) {
        this.ngZone.run(() => {
          this.isOverSelectionBorder = isBorder;
          this.cdr.markForCheck();
        });
      }
    }
  }

  async onGlobalMouseUp(_event?: MouseEvent) {
    if (this.isMovingSelection) {
      if (this.moveGhostOffset !== 0) {
        this.isMoveCommitting = true;
        this.ngZone.run(() => this.executeMove());
      } else {
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
        if (this.viewMode() === 'service') {
          let units = 0;
          let days = 0;
          for (const cell of this.selectedCells) {
            const weekKey = formatWeekStart(cell.week);
            const u = cell.resource.charges?.get(weekKey) || 0;
            const d =
              cell.resource.dailyCharges?.get(weekKey) ??
              u * (cell.resource.jours_par_semaine || 5);
            units += u;
            days += d;
          }
          const firstCell = this.selectedCells[0];
          this.serviceSelectionSummary = {
            units: Math.round(units * 100) / 100,
            days: Math.round(days * 10) / 10,
            weeksCount: this.selectedCells.length,
            rowLabel: firstCell?.resource?.label || '',
          };
          this.showServiceSelectionModal = true;
        } else {
          if (this.shouldShowProjectionTooltip()) {
            this.bulkChargeValue = this.dragStartCellValue;
            this.bulkComment = '';
          } else if (this.selectedCells.length === 1) {
            this.bulkChargeValue = this.dragStartCellValue;
            const firstCell = this.selectedCells[0];
            this.bulkComment = firstCell.resource.comments?.get(formatWeekStart(firstCell.week)) || '';
          } else {
            this.bulkChargeValue = null;
            this.bulkComment = '';
          }
          this.updateToolbarPosition();
        }
        this.cdr.detectChanges();
      }
    });
  }

  private getSelectedEndCellDom(): { cellElement: Element; rowElement: Element; isHidden: boolean; wrapperEl: Element | null; rect: DOMRect } | null {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0 || this.selectedCells.length === 0) return null;
    const firstCell = this.selectedCells[0];
    const uniqueId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId });
    const rowElement = document.querySelector(`[data-resource-id="${uniqueId}"]`);
    const cellElement = rowElement?.querySelector(`[data-week-index="${this.dragEndWeekIndex}"]`);
    if (!rowElement || !cellElement) return null;

    const rect = cellElement.getBoundingClientRect();
    const wrapperEl = document.querySelector('.calendar-wrapper');
    const labelEl = rowElement.querySelector('.label-cell');
    const headerEl = this.headerRowElement?.nativeElement;
    const milestonesEl = this.milestonesRowElement?.nativeElement;

    let isHidden = false;
    if (wrapperEl && headerEl && milestonesEl && labelEl) {
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const milestonesRect = milestonesEl.getBoundingClientRect();
      const labelRect = labelEl.getBoundingClientRect();
      isHidden = rect.bottom <= milestonesRect.bottom || rect.top >= wrapperRect.bottom || rect.right <= labelRect.right || rect.left >= wrapperRect.right;
    }
    return { cellElement, rowElement, isHidden, wrapperEl, rect };
  }

  updateToolbarPosition() {
    const dom = this.getSelectedEndCellDom();
    if (!dom) return;
    if (dom.isHidden) {
      this.toolbarVisible = false;
      this.cdr.detectChanges();
      return;
    }
    const pos = calculateBestToolbarPosition({
      rect: dom.rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dragStartWeekIndex: this.dragStartWeekIndex,
      dragEndWeekIndex: this.dragEndWeekIndex,
      bottomSafetyMargin: 150,
      rightSafetyMargin: 320,
    });
    if (dom.wrapperEl) {
      const wrapperRect = dom.wrapperEl.getBoundingClientRect();
      this.toolbarPosition = {
        top: pos.top - wrapperRect.top + dom.wrapperEl.scrollTop,
        left: pos.left - wrapperRect.left + dom.wrapperEl.scrollLeft,
        transform: pos.transform,
      };
    } else {
      this.toolbarPosition = pos;
    }
    this.toolbarVisible = true;
    this.cdr.detectChanges();
  }

  checkToolbarVisibilityOnScroll() {
    const dom = this.getSelectedEndCellDom();
    if (!dom) return;
    const shouldBeVisible = !dom.isHidden;
    if (this.toolbarVisible !== shouldBeVisible) {
      this.toolbarVisible = shouldBeVisible;
      this.cdr.detectChanges();
    }
  }
}
