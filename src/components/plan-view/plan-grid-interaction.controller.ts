/**
 * @file plan-grid-interaction.controller.ts
 * @description Contrôleur injectable des interactions de grille, popovers, menus et overlays DOM (Deep Module).
 *
 * Responsabilités :
 * - Gérer les menus contextuels, menus déroulants de filtre et popovers (Années, Chiffres Triskell).
 * - Coordonner la machine à états de drag-selection et le positionnement dynamique de la toolbar flottante.
 * - Piloter l'observation du redimensionnement de l'en-tête (ResizeObserver).
 */

import { Injectable, ElementRef, ChangeDetectorRef, NgZone, inject, signal } from '@angular/core';
import { calculateBestPopoverPosition, PopoverPosition } from '../../utils/selection-positioning';
import { storageSignal } from '../../utils/storage-signal';
import { YearKey, YearPeriod, getSelectableYears } from '../../utils/year-selection';
import { Projet, Jalon } from '../../models/types';
import {
  PLAN_VIEW_ICONS,
  PlanViewMode,
  ZoomLevel,
  PlanningMode,
  ChiffreCategory,
  CapacityYearSelection,
  ResourceCellData,
  ResourceRow,
  ChildRow,
  ParentRow,
  DisplayedMonth,
  DisplayedQuarter,
  DisplayedYear,
  GanttBarRange,
  SelectedCell,
  ProjectionCommittingState,
  ChiffrePopoverData,
} from './plan-view.models';
import { ServiceSelectionJalon } from './service-selection-modal.component';
import { GridSelectionController } from '../../shared/grid/grid-selection.controller';
import { HoverTooltipController, updateTooltipDomPosition } from '../../shared/grid/hover-tooltip.controller';
import { computeFloatingToolbarPosition } from '../../shared/grid/floating-toolbar-positioner';
import {
  formatLocalDate,
  formatWeekStart,
  formatWeekHeaderFrench,
  generateWeeksTimeline,
  buildDisplayedQuarters,
} from '../../shared/grid/week-calendar.utils';
import {
  calculateGanttBar,
  resolveAssociatedProject,
  calculateJalonLeftPercentage,
  pickJalonColor,
} from './plan-gantt.utils';

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

export { generateWeeksTimeline };

@Injectable()
export class PlanGridInteractionController {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  readonly selection = inject(GridSelectionController);
  readonly tooltip = inject(HoverTooltipController);

  tooltipElement?: ElementRef<HTMLElement>;
  dragProjectionTooltip?: ElementRef<HTMLElement>;
  headerRowElement?: ElementRef<HTMLElement>;
  milestonesRowElement?: ElementRef<HTMLElement>;

  resizeObserver?: ResizeObserver;

  // Signaux d'état de vue et filtres
  viewMode = storageSignal<PlanViewMode>('plan-view-mode', 'resource');
  zoomLevel = storageSignal<ZoomLevel>('plan-view-zoom-level', 'normal');
  showAvailability = storageSignal<boolean>('plan-view-show-availability', false);
  weekFilters = storageSignal<number[]>('plan-view-week-filters', []);
  chiffreMode = storageSignal<ChiffreCategory>('plan-view-chiffre-mode', 'previsionnel');
  planningMode = storageSignal<PlanningMode>('plan-view-planning-mode', 'saisie');
  selectedCapacityYear = storageSignal<CapacityYearSelection>('plan-view-capacity-year', 'today');
  readonly selectableYears: readonly YearKey[] = getSelectableYears();
  labelColumnWidth = storageSignal<number>('plan-view-label-column-width', 300);
  filterJalonTypes = storageSignal<string[]>('plan-view-filter-jalon-types', []);
  filterProjetSearch = storageSignal<string>('plan-view-filter-search', '');
  showGlobalFilters = signal<boolean>(false);
  copiedCodes = signal<Set<string>>(new Set());
  isSaving = false;

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

  showServiceSelectionModal = false;
  serviceSelectionSummary = {
    units: 0,
    days: 0,
    weeksCount: 0,
    rowLabel: '',
    remainingCapacityUnits: null as number | null,
    remainingCapacityDays: null as number | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
    jalons: [] as ServiceSelectionJalon[],
  };

  /** Callback injecté par PlanViewComponent pour exécuter le déplacement effectif */
  onExecuteMove: (() => Promise<void>) | null = null;
  /** Prédicat pour savoir si le thème sombre est actif */
  checkDarkMode: (() => boolean) | null = null;
  /** Détermination de la date de début de la semaine en cours */
  getTodayWeekStartFn: (() => Date) | null = null;

  // Délégations vers GridSelectionController
  get selectedCells(): SelectedCell[] {
    return this.selection.selectedCells();
  }
  set selectedCells(cells: SelectedCell[]) {
    this.selection.selectedCells.set(cells);
  }
  get isDragging(): boolean {
    return this.selection.isDragging();
  }
  set isDragging(v: boolean) {
    this.selection.isDragging.set(v);
  }
  get isSelectionFinished(): boolean {
    return this.selection.isSelectionFinished();
  }
  set isSelectionFinished(v: boolean) {
    this.selection.isSelectionFinished.set(v);
  }
  get isMovingSelection(): boolean {
    return this.selection.isMovingSelection();
  }
  set isMovingSelection(v: boolean) {
    this.selection.isMovingSelection.set(v);
  }
  get isOverSelectionBorder(): boolean {
    return this.selection.isOverSelectionBorder();
  }
  set isOverSelectionBorder(v: boolean) {
    this.selection.isOverSelectionBorder.set(v);
  }
  get moveGhostOffset(): number {
    return this.selection.moveGhostOffset();
  }
  set moveGhostOffset(v: number) {
    this.selection.moveGhostOffset.set(v);
  }
  get isMoveCommitting(): boolean {
    return this.selection.isMoveCommitting();
  }
  set isMoveCommitting(v: boolean) {
    this.selection.isMoveCommitting.set(v);
  }
  get isCommittingSelection(): boolean {
    return this.selection.isCommittingSelection();
  }
  set isCommittingSelection(v: boolean) {
    this.selection.isCommittingSelection.set(v);
  }
  get projectionCommitting(): ProjectionCommittingState | null {
    return this.selection.projectionCommitting();
  }
  set projectionCommitting(v: ProjectionCommittingState | null) {
    this.selection.projectionCommitting.set(v);
  }
  get toolbarVisible(): boolean {
    return this.selection.toolbarVisible();
  }
  set toolbarVisible(v: boolean) {
    this.selection.toolbarVisible.set(v);
  }
  get toolbarPosition(): any {
    return this.selection.toolbarPosition();
  }
  set toolbarPosition(v: any) {
    this.selection.toolbarPosition.set(v);
  }
  get dragProjectionTooltipVisible(): boolean {
    return this.selection.dragProjectionTooltipVisible();
  }
  set dragProjectionTooltipVisible(v: boolean) {
    this.selection.dragProjectionTooltipVisible.set(v);
  }

  get dragStartResource(): ResourceRow | null {
    return this.selection.dragStartResource;
  }
  set dragStartResource(r: ResourceRow | null) {
    this.selection.dragStartResource = r;
  }
  get dragStartChild(): ChildRow | undefined {
    return this.selection.dragStartChild;
  }
  set dragStartChild(c: ChildRow | undefined) {
    this.selection.dragStartChild = c;
  }
  get dragStartParent(): ParentRow | undefined {
    return this.selection.dragStartParent;
  }
  set dragStartParent(p: ParentRow | undefined) {
    this.selection.dragStartParent = p;
  }
  get dragStartWeekIndex(): number {
    return this.selection.dragStartWeekIndex;
  }
  set dragStartWeekIndex(i: number) {
    this.selection.dragStartWeekIndex = i;
  }
  get dragEndWeekIndex(): number {
    return this.selection.dragEndWeekIndex;
  }
  set dragEndWeekIndex(i: number) {
    this.selection.dragEndWeekIndex = i;
  }
  get dragStartCellValue(): number | null {
    return this.selection.dragStartCellValue;
  }
  set dragStartCellValue(v: number | null) {
    this.selection.dragStartCellValue = v;
  }
  get bulkChargeValue(): number | null {
    return this.selection.bulkChargeValue;
  }
  set bulkChargeValue(v: number | null) {
    this.selection.bulkChargeValue = v;
  }
  get bulkComment(): string {
    return this.selection.bulkComment;
  }
  set bulkComment(v: string) {
    this.selection.bulkComment = v;
  }
  get moveStartWeekIndex(): number {
    return this.selection.moveStartWeekIndex;
  }
  set moveStartWeekIndex(v: number) {
    this.selection.moveStartWeekIndex = v;
  }
  get moveStartClientX(): number {
    return this.selection.moveStartClientX;
  }
  set moveStartClientX(v: number) {
    this.selection.moveStartClientX = v;
  }
  get cellWidthPx(): number {
    return this.selection.cellWidthPx;
  }
  set cellWidthPx(v: number) {
    this.selection.cellWidthPx = v;
  }
  get activeTooltip(): string | null {
    return this.tooltip.activeTooltip();
  }
  set activeTooltip(v: string | null) {
    this.tooltip.activeTooltip.set(v);
  }

  moveDragBadgeX = 0;
  moveDragBadgeY = 0;

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

  get displayedQuarters(): DisplayedQuarter[] {
    return buildDisplayedQuarters(this.displayedMonths);
  }

  formatWeekStart(date: Date): string {
    return formatWeekStart(date);
  }

  formatLocalDate(d: Date): string {
    return formatLocalDate(d);
  }

  formatWeekHeader(date: Date): string {
    return formatWeekHeaderFrench(date);
  }

  isFirstWeekOfYear(index: number): boolean {
    return this.isYearChangeMap[index] ?? false;
  }

  cleanJiraRef(ref: string | null | undefined): string {
    if (!ref) return '';
    return ref.replace(/^(PROJ-|JIRA-)/i, '').trim();
  }

  getGanttBar(charges: Map<string, number> | undefined): GanttBarRange | null {
    return calculateGanttBar(charges, this.displayedWeeks);
  }

  getAssociatedProject(
    row?: { originalProject?: Projet; projectId?: string; resource?: ResourceRow },
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): Projet | undefined {
    return resolveAssociatedProject(this.viewMode(), this.allProjects, row, parentRow, childRow);
  }

  getGanttBarColor(
    row?: { originalProject?: Projet; projectId?: string; resource?: ResourceRow; color?: string },
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): string {
    return this.getAssociatedProject(row, parentRow, childRow)?.color || row?.color || childRow?.color || '#10b981';
  }

  getGanttJalons(
    row?: { originalProject?: Projet; projectId?: string; resource?: ResourceRow },
    parentRow?: ParentRow,
    childRow?: ChildRow,
  ): Jalon[] {
    const project = this.getAssociatedProject(row, parentRow, childRow);
    if (!project?.id || !this.displayedWeeks.length) return [];
    const start = this.displayedWeeks[0]!;
    const end = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]!);
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
    return calculateJalonLeftPercentage(jalon, this.displayedWeeks);
  }

  get visibleJalons(): Jalon[] {
    if (!this.displayedWeeks.length) return [];
    const start = this.displayedWeeks[0]!;
    const end = new Date(this.displayedWeeks[this.displayedWeeks.length - 1]!);
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

  getJalonBadgeColor(type: string): string {
    return pickJalonColor(type, 'badge', this.checkDarkMode ? this.checkDarkMode() : false);
  }
  getJalonColor(type: string): string {
    return pickJalonColor(type, 'bg', this.checkDarkMode ? this.checkDarkMode() : false);
  }
  getJalonTextColor(type: string): string {
    return pickJalonColor(type, 'text', this.checkDarkMode ? this.checkDarkMode() : false);
  }
  getJalonBorderColor(type: string): string {
    return pickJalonColor(type, 'border', this.checkDarkMode ? this.checkDarkMode() : false);
  }

  getCellTooltip(resource: ResourceRow, week: Date, cell?: ResourceCellData): string {
    const weekKey = formatWeekStart(week);
    const rawVal = resource.charges?.get(weekKey) || 0;
    const val = Math.round(rawVal * 10) / 10;
    const comment = cell?.comment ?? resource.comments?.get(weekKey);
    const hasVisibleAvailability = !!(cell && cell.showAvailability && cell.hasCapRecord && (rawVal > 0 || this.showAvailability()));
    if (rawVal <= 0 && !comment && !hasVisibleAvailability) return '';
    const days = resource.dailyCharges
      ? Math.round((resource.dailyCharges.get(weekKey) || 0) * 10) / 10
      : Math.round(rawVal * (resource.jours_par_semaine || 5) * 10) / 10;
    let text = `${resource.label} : ${val} ETP (${days}j)`;
    if (hasVisibleAvailability) {
      const avail = Math.round(cell!.availability * 10) / 10;
      text += ` | Dispo : ${avail > 0 ? '+' : ''}${avail} ETP`;
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
      return Math.round(total * 10) / 10;
    }
    for (const [weekKey, charge] of resource.charges) {
      if (new Date(weekKey).getFullYear() === year) total += charge * resource.jours_par_semaine;
    }
    return Math.round(total * 10) / 10;
  }

  getChildMetricsYear(child: ChildRow, year: number): number {
    let total = 0;
    for (const resource of child.resources) total += this.getResourceMetricsYear(resource, year);
    return Math.round(total * 10) / 10;
  }

  getRowMetricsYear(row: ParentRow, year: number): number {
    let total = 0;
    for (const child of row.children) total += this.getChildMetricsYear(child, year);
    return Math.round(total * 10) / 10;
  }

  getBadgePrefix(): string {
    const yearSel = this.selectedCapacityYear();
    if (yearSel === 'today') {
      const d = this.getTodayWeekStartFn ? this.getTodayWeekStartFn() : new Date();
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
          this.cdr.markForCheck();
        }, 2000);
      })
      .catch((err) => console.error('Failed to copy code: ', err));
  }

  // --- Dropdowns & Menus ---
  toggleGlobalFilters() {
    this.showGlobalFilters.set(!this.showGlobalFilters());
    if (!this.showGlobalFilters()) this.closeAllFilterDropdowns();
  }

  closeAllFilterDropdowns() {
    this.openEquipeDropdown = false;
    this.openProjetDropdown = false;
    this.openResourceDropdown = false;
    this.openStatusDropdown = false;
    this.showPeriodDropdown = false;
    this.openSizeDropdown = false;
    this.openJalonDropdown = false;
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
      popoverHeight: 230,
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

  selectYear(year: YearPeriod) {
    this.selectedCapacityYear.set(year);
    this.selectedStartDate = null;
    this.showYearPopover = false;
  }

  getSelectedStartDateISO(): string {
    return this.selectedStartDate ? formatLocalDate(this.selectedStartDate) : '';
  }

  showTooltip(event: MouseEvent, text: string) {
    const isBlocked = () =>
      this.isDragging ||
      this.isMovingSelection ||
      this.isResizing ||
      this.selectedCells.length > 0;

    this.tooltip.showTooltip(event, text, isBlocked, this.tooltipElement?.nativeElement);
  }

  hideTooltip() {
    this.tooltip.hideTooltip();
  }

  onResizeStart(event: MouseEvent) {
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.labelColumnWidth();
    event.preventDefault();
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

  destroy() {
    this.resizeObserver?.disconnect();
    this.tooltip.hideTooltip();
    this.selection.clearSelection();
  }

  get selectionStartWeekDate(): Date | null {
    if (this.selectedCells.length === 0) return null;
    return [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime())[0]!.week;
  }

  get selectionDaysPerWeek(): number {
    return this.selectedCells.length > 0 ? this.selectedCells[0]!.resource.jours_par_semaine || 5 : 5;
  }

  get dragProjectionDays(): number {
    if (!this.dragStartCellValue || this.dragStartCellValue <= 0) return 0;
    return Math.round(this.selectedCells.length * this.dragStartCellValue * (this.dragStartResource?.jours_par_semaine || 5) * 10) / 10;
  }

  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const charge = this.bulkChargeValue !== null ? this.bulkChargeValue : this.getResourceValue(cell.resource, cell.week) || 0;
      total += charge * (cell.resource.jours_par_semaine || 0);
    }
    return Math.round(total * 10) / 10;
  }

  getResourceUniqueId(
    resource: Pick<ResourceRow, 'id' | 'type'> & { uniqueId?: string },
    child: Pick<ChildRow, 'id'>,
    parent: Pick<ParentRow, 'id'>,
  ): string {
    if (resource.uniqueId) return resource.uniqueId;
    return `${parent.id}_${child.id}_${resource.id}_${resource.type}`;
  }

  isServiceSummarySelected(): boolean {
    if (this.viewMode() !== 'service' || this.selectedCells.length === 0) return false;
    const firstCell = this.selectedCells[0]!;
    const uid = firstCell.resource.uniqueId;
    return (
      !!uid?.startsWith('service_summary_') ||
      !!uid?.startsWith('service_project_') ||
      firstCell.resource.id === firstCell.parentId
    );
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
    const firstCell = this.selectedCells[0]!;
    if (this.getResourceUniqueId(resource, child, parent) !== this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId })) {
      return false;
    }
    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return false;
    return this.isCellSelected(resource, this.displayedWeeks[sourceWeekIndex]!);
  }

  getAbsOffset(): number {
    return Math.abs(this.moveGhostOffset);
  }

  getGhostValue(resource: ResourceRow, weekIndex: number): number | null {
    if (!this.isMovingSelection || this.moveGhostOffset === 0) return null;
    const sourceWeekIndex = weekIndex - this.moveGhostOffset;
    if (sourceWeekIndex < 0 || sourceWeekIndex >= this.displayedWeeks.length) return null;
    const sourceWeek = this.displayedWeeks[sourceWeekIndex]!;
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
      const cell = this.selectedCells[i]!;
      if ((cell.resource.charges.get(formatWeekStart(cell.week)) || 0) > 0) return false;
    }
    return true;
  }

  updateSelection(child: ChildRow, parent: ParentRow) {
    this.selection.updateSelectedCells(this.displayedWeeks, child.id, parent.id);
  }

  clearSelection() {
    this.selection.clearSelection();
  }

  closeServiceSelectionModal(): void {
    this.showServiceSelectionModal = false;
    this.clearSelection();
    this.cdr.markForCheck();
  }

  onMouseDown(event: MouseEvent, resource: ResourceRow, child: ChildRow, parent: ParentRow) {
    this.tooltip.clear();
    if (this.isOverSelectionBorder) {
      if (this.viewMode() === 'service' && this.isServiceSummarySelected()) return;
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
      if (
        this.viewMode() === 'service' &&
        (resource === parent.summaryResource || (child && resource === child.summaryResource))
      ) {
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
    if (this.activeTooltip) {
      updateTooltipDomPosition(event, this.tooltipElement?.nativeElement);
    }

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
        if ((this.viewMode() !== 'service' || !this.isServiceSummarySelected()) && this.dragStartCellValue && this.dragStartCellValue > 0) {
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

    if ((this.viewMode() !== 'service' || !this.isServiceSummarySelected()) && !this.isDragging && !this.isMovingSelection && this.selectedCells.length > 0 && this.isSelectionFinished) {
      const target = event.target as HTMLElement;
      const cell = target.closest('.week-cell');
      let isBorder = false;
      if (cell?.classList.contains('selected')) {
        const rect = cell.getBoundingClientRect();
        const margin = 5;
        const resId = target.closest('.calendar-row')?.getAttribute('data-resource-id');
        const weekIndex = parseInt(cell.getAttribute('data-week-index') || '-1', 10);
        const firstCell = this.selectedCells[0]!;
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
        this.ngZone.run(() => {
          if (this.onExecuteMove) this.onExecuteMove();
        });
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
        if (this.viewMode() === 'service' && this.isServiceSummarySelected()) {
          let units = 0;
          let days = 0;
          let remainingCapacityUnits = 0;
          let remainingCapacityDays = 0;
          let hasCapacityData = false;

          const firstCell = this.selectedCells[0]!;
          const parentRow = this.dragStartParent;

          const sortedCells = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
          const startDate = sortedCells.length > 0 ? sortedCells[0]!.week : null;
          const endDate = sortedCells.length > 0 ? sortedCells[sortedCells.length - 1]!.week : null;

          for (const cell of this.selectedCells) {
            const weekKey = formatWeekStart(cell.week);
            const u = cell.resource.charges?.get(weekKey) || 0;
            const d =
              cell.resource.dailyCharges?.get(weekKey) ??
              u * (cell.resource.jours_par_semaine || 5);
            units += u;
            days += d;

            if (parentRow?.metrics?.has(weekKey)) {
              hasCapacityData = true;
              const metric = parentRow.metrics.get(weekKey)!;
              const avail = metric.availability ?? (metric.capacity - metric.total);
              remainingCapacityUnits += avail;
              remainingCapacityDays += avail * 5;
            }
          }

          let jalons: ServiceSelectionJalon[] = [];
          if (endDate) {
            const startOfWeek = new Date(endDate);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            const projId = firstCell.resource.projectId;
            const relevantProjectIds = projId
              ? new Set([projId])
              : new Set(
                  (parentRow?.children?.map((c) => c.id).filter(Boolean) as string[]) || []
                );

            const activeTypes = this.filterJalonTypes();
            const matching = this.allJalons.filter((j) => {
              if (activeTypes.length > 0 && !activeTypes.includes(j.event_type)) return false;
              const jDate = new Date(j.event_date);
              if (jDate < startOfWeek || jDate > endOfWeek) return false;
              if (j.projet_id) {
                return relevantProjectIds.has(j.projet_id);
              }
              return true;
            });

            jalons = matching
              .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
              .map((j) => ({
                ...j,
                projectName: j.projet_id ? this.allProjects.find((p) => p.id === j.projet_id)?.nom_projet : undefined,
              }));
          }

          this.serviceSelectionSummary = {
            units: Math.round(units * 100) / 100,
            days: Math.round(days * 10) / 10,
            weeksCount: this.selectedCells.length,
            rowLabel: firstCell?.resource?.label || '',
            remainingCapacityUnits: hasCapacityData ? Math.round(remainingCapacityUnits * 100) / 100 : null,
            remainingCapacityDays: hasCapacityData ? Math.round(remainingCapacityDays * 10) / 10 : null,
            startDate,
            endDate,
            jalons,
          };
          this.showServiceSelectionModal = true;
        } else {
          if (this.shouldShowProjectionTooltip()) {
            this.bulkChargeValue = this.dragStartCellValue;
            this.bulkComment = '';
          } else if (this.selectedCells.length === 1) {
            this.bulkChargeValue = this.dragStartCellValue;
            const firstCell = this.selectedCells[0]!;
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

  private getSelectedEndCellDom(): { cellElement: Element; rowElement: Element; isHidden: boolean; wrapperEl: HTMLElement | null; rect: DOMRect } | null {
    if (!this.dragStartResource || this.dragEndWeekIndex < 0 || this.selectedCells.length === 0) return null;
    const firstCell = this.selectedCells[0]!;
    const uniqueId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId });
    const rowElement = document.querySelector(`[data-resource-id="${uniqueId}"]`);
    const cellElement = rowElement?.querySelector(`[data-week-index="${this.dragEndWeekIndex}"]`);
    if (!rowElement || !cellElement) return null;

    const rect = cellElement.getBoundingClientRect();
    const wrapperEl = document.querySelector('.calendar-wrapper') as HTMLElement | null;
    const labelEl = rowElement.querySelector('.label-cell') as HTMLElement | null;
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
    const pos = computeFloatingToolbarPosition({
      targetRect: dom.rect,
      wrapperEl: dom.wrapperEl,
      headerEl: this.headerRowElement?.nativeElement,
      labelEl: dom.rowElement.querySelector('.label-cell') as HTMLElement | null,
      dragStartWeekIndex: this.dragStartWeekIndex,
      dragEndWeekIndex: this.dragEndWeekIndex,
    });
    this.toolbarVisible = pos.visible;
    this.toolbarPosition = pos.position;
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
