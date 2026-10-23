/**
 * @file plan-view.component.ts
 * @description Composant orchestrateur Angular de la vue Planification (Deep Module de présentation).
 *
 * Responsabilités :
 * - Coordonner le cycle de vie du composant (`ngOnInit`, `ngAfterViewInit`, `ngOnDestroy`) et les écouteurs globaux.
 * - Piloter l'état réactif des filtres (`storageSignal` / `signal`) et déclencher les recalculs du moteur
 *   de projection (`plan-projection.engine.ts`).
 * - Orchestrer l'ouverture et la validation des modales métier (liaison projet/équipe, ajout de ressource,
 *   édition de projet, jalons, chiffres, confirmation de suppression) en déléguant la persistance à `PlanDataRepository`.
 */
import { Component, OnInit, AfterViewInit, HostListener, ChangeDetectionStrategy, OnDestroy, computed, signal, inject, WritableSignal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { textContains } from '../../utils/text.utils';
import { storageSignal } from '../../utils/storage-signal';
import { SelectionToolbarComponent } from '../selection-toolbar.component';
import { ProjectModalComponent } from '../project-modal.component';
import { MilestoneModalComponent } from '../milestones/milestone-modal.component';
import { ConfirmModalComponent } from '../confirm-modal.component';
import { ChiffresModalComponent } from '../chiffres/chiffres-modal.component';
import * as M from './plan-view.models';
import * as Projection from './plan-projection.engine';
import { PlanGridInteractionController, generateWeeksTimeline } from './plan-grid-interaction.controller';
import { PlanDataRepository } from './plan-data.repository';

export { LucideIconsModule } from './plan-view.models';

@Component({
  selector: 'app-plan-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    M.LucideIconsModule,
    MilestoneModalComponent,
    SelectionToolbarComponent,
    ConfirmModalComponent,
    ProjectModalComponent,
    DragDropModule,
    ChiffresModalComponent,
  ],
  templateUrl: './plan-view.component.html',
  styleUrl: './plan-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanViewComponent extends PlanGridInteractionController implements OnInit, AfterViewInit, OnDestroy {
  private readonly repo = inject(PlanDataRepository);

  showSkeleton = false;
  showMilestoneModal = false;
  selectedJalon: M.Jalon | null = null;
  showChiffresModal = false;
  selectedProjetId: string | null = null;

  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();
  private globalMouseMoveListener?: () => void;
  private globalMouseUpListener?: () => void;
  private scrollCloseListener?: () => void;

  flatRows: M.FlatRow[] = [];
  rows: M.ParentRow[] = [];
  rowsAll: M.ParentRow[] = [];

  capacityIndex = new Map<string, number>();
  usageMap = new Map<string, number>();

  allCharges: M.Charge[] = [];
  allEquipes: M.Equipe[] = [];
  allCapacities: M.Capacite[] = [];
  allLinks: { equipe_id: string; projet_id: string }[] = [];
  allRoleAttachments: M.RoleAttachmentRecord[] = [];
  allChiffres: M.Chiffre[] = [];
  allServices: M.Service[] = [];
  availableRoles: M.Role[] = [];
  availablePersonnes: M.Personne[] = [];

  filterEquipeIds = storageSignal<string[]>('plan-view-filter-equipes', []);
  filterProjetIds = storageSignal<string[]>('plan-view-filter-projets', []);
  filterResourceIds = storageSignal<string[]>('plan-view-filter-resources', []);
  filterStatusIds = storageSignal<string[]>('plan-view-filter-statuses', []);
  filterPeriodEnabled = signal<boolean>(false);
  filterPeriodStart = storageSignal<string>('plan-view-filter-period-start', '');
  filterPeriodEnd = storageSignal<string>('plan-view-filter-period-end', '');
  filterSizeEnabled = signal<boolean>(false);
  filterSizeCriterion = storageSignal<M.SizeFilterCriterion>('plan-view-filter-size-criterion', 'charges_all');
  filterSizeOperator = storageSignal<M.SizeFilterOperator>('plan-view-filter-size-operator', 'gte');
  filterSizeValue = storageSignal<number | null>('plan-view-filter-size-value', null);
  globalSearch = storageSignal<string>('plan-view-global-search', '');

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private sizeValueSubject = new Subject<number | null>();
  private sizeValueSubscription?: Subscription;

  readonly PROJECT_STATUSES = M.PROJECT_STATUS_LIST;

  showLinkModal = false;
  selectedParentRow: M.ParentRow | null = null;
  selectedChildRowToLink: M.ChildRow | null = null;
  linkableItems: M.LinkableItem[] = [];
  selectedIdToLink = '';
  selectedIdsToLink = new Set<string>();
  linkModalSearchQuery = '';
  linkModalStatusFilter = '';
  linkModalIsSaving = false;

  showAddResourceModal = false;
  selectedChildRow: M.ChildRow | null = null;
  selectedParentForResource: M.ParentRow | null = null;
  resourceTypeToAdd: 'role' | 'personne' = 'role';
  selectedResourceId = '';

  showProjectModal = false;
  projectToEdit: Partial<M.Projet> | null = null;
  isCreatingProjectFromLink = false;
  isMouseDownOnOverlay = false;

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingConfirmAction: (() => void) | null = null;
  private lastMouseDownTarget: HTMLElement | null = null;

  private externalReferenceUrlQuery = this.repo.settingsService.getSettingQuery('external_reference_url', 'global');
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);

  protected override isDarkMode(): boolean {
    return this.repo.themeService.isDarkMode();
  }

  protected override getTodayWeekStart(): Date {
    return this.repo.calendarService.getWeekStart(new Date());
  }

  private get dataset(): M.PlanRawDataset {
    return {
      allEquipes: this.allEquipes,
      allCharges: this.allCharges,
      allProjects: this.allProjects,
      availableRoles: this.availableRoles,
      availablePersonnes: this.availablePersonnes,
      allJalons: this.allJalons,
      allLinks: this.allLinks,
      allRoleAttachments: this.allRoleAttachments,
      allCapacities: this.allCapacities,
      allChiffres: this.allChiffres,
      allServices: this.allServices,
      capacityIndex: this.capacityIndex,
      usageMap: this.usageMap,
    };
  }

  private get filterSummaryState() {
    return {
      search: this.globalSearch(),
      eqLen: this.filterEquipeIds().length,
      prLen: this.filterProjetIds().length,
      stLen: this.filterStatusIds().length,
      resLen: this.filterResourceIds().length,
      periodEnabled: this.filterPeriodEnabled(),
      sizeActive: this.filterSizeEnabled() && this.filterSizeValue() !== null,
      wkLen: this.weekFilters().length,
    };
  }

  activeFiltersCount = computed(() => M.computeActiveFiltersCount(this.filterSummaryState));
  activeFiltersSummary = computed(() => M.computeActiveFiltersSummary(this.filterSummaryState));

  ngOnInit() {
    this.loadData({ showSkeleton: true });
    this.generateWeeks();

    this.searchSubscription = this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
      this.globalSearch.set(value);
      this.applyFilters();
      this.cdr.markForCheck();
    });

    this.sizeValueSubscription = this.sizeValueSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((val) => {
        this.filterSizeValue.set(val);
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

      const scrollHandler = () => {
        if (this.showYearPopover || this.showChiffrePopover) {
          this.ngZone.run(() => {
            this.showYearPopover = false;
            this.activeAnchorId = null;
            this.showChiffrePopover = false;
            this.activeChiffreAnchorId = null;
            this.activeChiffrePopoverData = null;
            this.cdr.markForCheck();
          });
        }
        if (this.selectedCells.length > 0 && this.isSelectionFinished && !this.isMovingSelection && !this.isSaving) {
          this.checkToolbarVisibilityOnScroll();
        }
      };
      document.addEventListener('scroll', scrollHandler, true);
      this.scrollCloseListener = () => document.removeEventListener('scroll', scrollHandler, true);
    });
  }

  ngAfterViewInit() {
    this.startTutorial();
    this.setupResizeObserver();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.globalMouseMoveListener?.();
    this.globalMouseUpListener?.();
    this.scrollCloseListener?.();
    this.searchSubscription?.unsubscribe();
    this.sizeValueSubscription?.unsubscribe();
  }

  async loadData(options: M.LoadDataOptions = {}) {
    const showSkeleton = options.showSkeleton ?? true;
    let timer: ReturnType<typeof setTimeout> | null = null;
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
      const loaded = await this.repo.loadDataset(this.displayedWeeks, this.capacityIndex);
      Object.assign(this, loaded);
      this.buildTree();
      this.precalculateResources();
      this.calculateMetrics();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (timer) clearTimeout(timer);
      if (this.showSkeleton) this.showSkeleton = false;
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  generateWeeks() {
    const res = generateWeeksTimeline(
      this.currentDate,
      (d) => this.repo.calendarService.getWeekStart(d),
      (d) => this.repo.calendarService.getWeekNumber(d),
      (d) => this.repo.calendarService.getWeekYear(d),
    );
    this.displayedWeeks = res.displayedWeeks;
    this.displayedMonths = res.displayedMonths;
    this.displayedYears = res.displayedYears;
    this.isYearChangeMap = res.isYearChangeMap;
  }

  getWeekNumber(date: Date): number {
    return this.repo.calendarService.getWeekNumber(date);
  }

  isCurrentWeek(date: Date): boolean {
    return this.repo.calendarService.isCurrentWeek(date);
  }

  private shiftTimeline(deltaMonths?: number) {
    if (deltaMonths === undefined) this.currentDate = new Date();
    else this.currentDate.setMonth(this.currentDate.getMonth() + deltaMonths);
    this.generateWeeks();
    this.precalculateResources();
    this.cdr.markForCheck();
  }

  goToToday() {
    this.shiftTimeline();
  }
  goToPreviousMonth() {
    this.shiftTimeline(-1);
  }
  goToNextMonth() {
    this.shiftTimeline(1);
  }

  onDateSelected(event: Event) {
    const selectedDateStr = (event.target as HTMLInputElement).value;
    if (!selectedDateStr) return;
    this.selectedStartDate = this.repo.calendarService.getWeekStart(new Date(selectedDateStr));
    this.selectedCapacityYear.set('custom');
    this.showYearPopover = false;
  }

  // --- Projection, Tree, Metrics & Chiffres ---
  getResourceServiceId(type: 'role' | 'personne', resourceId: string, teamId?: string): string | null {
    return Projection.getResourceServiceId(this.dataset, type, resourceId, teamId);
  }

  calculateUsage() {
    Projection.calculateUsageMap(this.dataset);
  }

  getAvailability(resource: M.ResourceRow, week: Date, teamId: string): number {
    return Projection.getAvailability(this.dataset, resource, week, teamId);
  }

  shouldShowAvailability(resource: M.ResourceRow, week: Date, teamId: string): boolean {
    return Projection.shouldShowAvailability(this.dataset, this.showAvailability(), resource, week, teamId);
  }

  precalculateResources() {
    Projection.precalculateAllResources(this.dataset, this.rowsAll, this.viewMode(), this.displayedWeeks);
  }

  precalculateResource(resource: M.ResourceRow, teamId: string) {
    Projection.precalculateResource(this.dataset, this.viewMode(), this.displayedWeeks, resource, teamId);
  }

  calculateMetrics() {
    Projection.calculateTreeMetrics(this.dataset, this.rowsAll, this.viewMode(), this.displayedWeeks, this.filterEquipeIds(), this.filterResourceIds());
  }

  shouldShowResource(resource: M.ResourceRow): boolean {
    return Projection.shouldShowResourceByWeekFilters(resource, this.weekFilters(), this.displayedWeeks);
  }

  buildTree() {
    this.rows = Projection.buildPlanTree(
      this.dataset,
      this.viewMode(),
      this.manualStates,
      this.isDefaultExpanded,
      this.weekFilters(),
      this.displayedWeeks,
      this.filterEquipeIds(),
      this.filterResourceIds(),
    );
    this.calculateUsage();
    this.rowsAll = [...this.rows];
    this.precalculateResources();
    this.calculateMetrics();
    this.applyFilters();
  }

  buildFlatList() {
    this.flatRows = Projection.buildFlatList(this.rows, this.viewMode());
  }

  applyFilters() {
    this.calculateUsage();
    const criteria: M.PlanFilterCriteria = {
      viewMode: this.viewMode(),
      displayFormat: this.displayFormat(),
      globalSearch: this.globalSearch(),
      filterEquipeIds: this.filterEquipeIds(),
      filterProjetIds: this.filterProjetIds(),
      filterResourceIds: this.filterResourceIds(),
      filterStatusIds: this.filterStatusIds(),
      filterPeriodEnabled: this.filterPeriodEnabled(),
      effectivePeriodStart: this.effectivePeriodStart,
      effectivePeriodEnd: this.effectivePeriodEnd,
      filterSizeEnabled: this.filterSizeEnabled(),
      filterSizeCriterion: this.filterSizeCriterion(),
      filterSizeOperator: this.filterSizeOperator(),
      filterSizeValue: this.filterSizeValue(),
      weekFilters: this.weekFilters(),
      chiffreMode: this.chiffreMode(),
    };
    this.rows = Projection.applyPlanFilters(this.dataset, this.rowsAll, criteria, this.getTodayWeekStart());
    Projection.calculateFilteredTreeMetrics(this.dataset, this.rows, this.viewMode(), this.displayedWeeks, this.filterEquipeIds(), this.filterResourceIds());
    if (this.displayFormat() === 'flat') this.buildFlatList();
  }

  getPlannedDaysForResource(resource: M.ResourceRow, period: M.PlannedDaysPeriod): number {
    return Projection.getPlannedDaysForResource(resource, period, this.getTodayWeekStart());
  }

  getPlannedDaysForChildInTeam(child: M.ChildRow, period: M.PlannedDaysPeriod): number {
    return Projection.getPlannedDaysForChildInTeam(child, period, this.getTodayWeekStart());
  }

  getPlannedDaysForProjectParent(parent: M.ParentRow, period: M.PlannedDaysPeriod): number {
    return Projection.getPlannedDaysForProjectParent(parent, period, this.filterEquipeIds(), this.getTodayWeekStart());
  }

  getResourceTotalPlannedDays(resource: M.ResourceRow): number {
    return Projection.getResourceTotalPlannedDays(resource, this.selectedCapacityYear(), this.selectedStartDate, this.getTodayWeekStart());
  }

  getChiffreValueForServiceProject(serviceId: string, projectId: string, mode: M.ChiffreCategory = this.chiffreMode()): number | null {
    return Projection.getChiffreValueForServiceProject(this.allChiffres, serviceId, projectId, mode);
  }

  getChiffreValueForMode(
    teamId: string,
    projectId: string,
    resourceId: string | undefined,
    resourceType: 'role' | 'personne' | undefined,
    mode: M.ChiffreCategory,
  ): number | null {
    return Projection.getChiffreValueForMode(this.dataset, teamId, projectId, resourceId, resourceType, mode);
  }

  getChiffreValue(teamId: string, projectId: string, resourceId?: string, resourceType?: 'role' | 'personne'): number | null {
    return this.getChiffreValueForMode(teamId, projectId, resourceId, resourceType, this.chiffreMode());
  }

  getChiffreValueForTeamProject(teamId: string, projectId: string, category: M.ChiffreCategory): number | null {
    return Projection.getChiffreValueForTeamProject(this.dataset, teamId, projectId, category);
  }

  getChiffreValueForProjectParent(parent: M.ParentRow, category: M.ChiffreCategory): number | null {
    return Projection.getChiffreValueForProjectParent(this.dataset, parent, this.filterEquipeIds(), category);
  }

  getChiffrePreviewValue(mode: M.ChiffreCategory): number | null {
    const d = this.activeChiffrePopoverData;
    if (!d) return null;
    return this.viewMode() === 'service'
      ? this.getChiffreValueForServiceProject(d.teamId, d.projectId, mode)
      : this.getChiffreValueForMode(d.teamId, d.projectId, d.resourceId, d.resourceType, mode);
  }

  checkSizeMatch(val: number | null): boolean {
    return Projection.checkSizeMatch(val, this.filterSizeOperator(), this.filterSizeValue() ?? 0);
  }

  exportToExcel(): void {
    this.repo.exportToExcel(this.rowsAll, this.displayedWeeks, this.viewMode());
  }

  // --- Tree Expansion & View Mode ---
  private setAllExpanded(expand: boolean) {
    this.isDefaultExpanded = expand;
    this.manualStates.clear();
    for (const row of this.rowsAll) {
      row.expanded = expand;
      for (const child of row.children) child.expanded = expand;
    }
    this.applyFilters();
    this.cdr.markForCheck();
  }

  expandAll() {
    this.setAllExpanded(true);
  }
  collapseAll() {
    this.setAllExpanded(false);
  }

  toggleRow(row: M.ParentRow) {
    row.expanded = !row.expanded;
    this.manualStates.set(row.id, row.expanded);
    const orig = this.rowsAll.find((r) => r.id === row.id);
    if (orig) orig.expanded = row.expanded;
  }

  toggleChild(child: M.ChildRow, parent: M.ParentRow) {
    child.expanded = !child.expanded;
    this.manualStates.set(`${parent.id}_${child.id}`, child.expanded);
    const origChild = this.rowsAll.find((r) => r.id === parent.id)?.children.find((c) => c.id === child.id);
    if (origChild) origChild.expanded = child.expanded;
  }

  switchViewMode(mode: M.PlanViewMode) {
    this.clearSelection();
    this.viewMode.set(mode);
    this.buildTree();
  }

  toggleDisplayFormat(format: M.DisplayFormat) {
    this.displayFormat.set(format);
    if (format === 'flat') this.buildFlatList();
  }

  // --- Filter Controls ---
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
    if (this.viewMode() === 'service') this.buildTree();
    else this.applyFilters();
    this.cdr.markForCheck();
  }

  onSearchInput(value: string) {
    this.searchSubject.next(value);
  }

  toggleWeekFilter(weekIndex: number) {
    const current = this.weekFilters();
    const index = current.indexOf(weekIndex);
    this.weekFilters.set(index > -1 ? current.filter((i) => i !== weekIndex) : [...current, weekIndex]);
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

  private toggleMultiFilter(sig: WritableSignal<string[]>, item: string | undefined, event: Event, rebuildInService = false) {
    if (!item) return;
    const checked = (event.target as HTMLInputElement).checked;
    sig.update((ids) => (checked ? [...ids, item] : ids.filter((x) => x !== item)));
    if (rebuildInService && this.viewMode() === 'service') this.buildTree();
    else this.applyFilters();
  }

  onEquipeToggle(id: string | undefined, event: Event) {
    this.toggleMultiFilter(this.filterEquipeIds, id, event, true);
  }
  onJalonTypeToggle(type: string, event: Event) {
    this.toggleMultiFilter(this.filterJalonTypes, type, event);
  }
  onProjetToggle(id: string | undefined, event: Event) {
    this.toggleMultiFilter(this.filterProjetIds, id, event);
  }
  onStatutToggle(statut: string, event: Event) {
    this.toggleMultiFilter(this.filterStatusIds, statut, event);
  }
  onResourceToggle(sel: string, event: Event) {
    this.toggleMultiFilter(this.filterResourceIds, sel, event, true);
  }

  get filteredProjectsForDropdown(): M.Projet[] {
    const search = this.filterProjetSearch();
    if (!search) return this.allProjects;
    return this.allProjects.filter(
      (p) => textContains(p.nom_projet, search) || textContains(p.code_projet, search) || textContains(p.reference_externe, search),
    );
  }

  selectFilteredProjects() {
    const ids = this.filteredProjectsForDropdown.map((p) => p.id).filter((id): id is string => !!id);
    this.filterProjetIds.update((current) => Array.from(new Set([...current, ...ids])));
    this.applyFilters();
  }

  deselectFilteredProjects() {
    const ids = this.filteredProjectsForDropdown.map((p) => p.id).filter((id): id is string => !!id);
    this.filterProjetIds.update((current) => current.filter((id) => !ids.includes(id)));
    this.applyFilters();
  }

  getEquipeName(id: string) {
    return this.allEquipes.find((x) => x.id === id)?.nom || '—';
  }

  getProjetLabel(id: string) {
    const p = this.allProjects.find((x) => x.id === id);
    return p ? `${p.code_projet} — ${p.nom_projet} ` : '—';
  }

  getResourceLabel(sel: string) {
    const [type, id] = sel.split(':');
    if (type === 'role') {
      const r = this.availableRoles.find((x) => x.id === id);
      return r ? `Role: ${r.nom} ` : 'Role: —';
    }
    const p = this.availablePersonnes.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom} ` : 'Pers: —';
  }

  get defaultPeriodStart(): string {
    return M.getDefaultPeriodStart();
  }
  get defaultPeriodEnd(): string {
    return M.getDefaultPeriodEnd();
  }
  get effectivePeriodStart(): string {
    return this.filterPeriodStart() || this.defaultPeriodStart;
  }
  get effectivePeriodEnd(): string {
    return this.filterPeriodEnd() || this.defaultPeriodEnd;
  }
  get isPeriodFilterActive(): boolean {
    return this.filterPeriodEnabled();
  }
  get activePeriodPreset(): number | null {
    return M.computeActivePeriodPreset(this.effectivePeriodStart, this.effectivePeriodEnd);
  }
  get periodLabel(): string {
    return M.formatPeriodFilterLabel(this.filterPeriodEnabled(), this.effectivePeriodStart, this.effectivePeriodEnd);
  }
  get sizeFilterLabel(): string {
    return M.formatSizeFilterLabel(this.filterSizeEnabled(), this.filterSizeCriterion(), this.filterSizeOperator(), this.filterSizeValue());
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

  onSizeFilterToggle(enabled: boolean) {
    this.filterSizeEnabled.set(enabled);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeCriterionChange(val: M.SizeFilterCriterion) {
    this.filterSizeCriterion.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeOperatorChange(val: M.SizeFilterOperator) {
    this.filterSizeOperator.set(val);
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onSizeValueChange(val: number | null) {
    this.sizeValueSubject.next(val);
  }

  // --- Modals & Mutations ---
  openMilestoneModal(jalon: M.Jalon, event: Event) {
    event.stopPropagation();
    this.selectedJalon = jalon;
    this.showMilestoneModal = true;
  }

  async onMilestoneSaved() {
    await this.loadData({ showSkeleton: false });
  }

  onOpenChiffresFromProject(idProjet: string | undefined) {
    if (!idProjet) return;
    this.selectedProjetId = idProjet;
    this.showChiffresModal = true;
  }

  closeChiffresModal() {
    this.showChiffresModal = false;
    this.selectedProjetId = null;
  }

  async drop(event: CdkDragDrop<M.ParentRow[]>) {
    if (this.viewMode() !== 'project' || this.displayFormat() !== 'tree' || event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.rows, event.previousIndex, event.currentIndex);
    await this.updateRankAfterMove(event.currentIndex);
  }

  async moveToTop(row: M.ParentRow) {
    if (this.viewMode() !== 'project') return;
    const currentIndex = this.rows.indexOf(row);
    if (currentIndex <= 0) return;
    moveItemInArray(this.rows, currentIndex, 0);
    await this.updateRankAfterMove(0);
  }

  async moveToBottom(row: M.ParentRow) {
    if (this.viewMode() !== 'project') return;
    const currentIndex = this.rows.indexOf(row);
    if (currentIndex === -1 || currentIndex === this.rows.length - 1) return;
    moveItemInArray(this.rows, currentIndex, this.rows.length - 1);
    await this.updateRankAfterMove(this.rows.length - 1);
  }

  private async updateRankAfterMove(index: number) {
    try {
      this.rowsAll = await this.repo.updateProjectRank(this.rows, this.rowsAll, index);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error calculating rank:', error);
      await this.loadData({ showSkeleton: false });
    }
  }

  get filteredLinkableItems(): M.LinkableItem[] {
    const q = this.linkModalSearchQuery.trim();
    const s = this.linkModalStatusFilter;
    return this.linkableItems.filter((item) => {
      const proj = this.allProjects.find((p) => p.id === item.id);
      const matchSearch = !q || textContains(item.label, q) || textContains(proj?.code_projet, q) || textContains(proj?.reference_externe, q);
      const matchStatus = !s || (proj?.statut || '') === s;
      return matchSearch && matchStatus;
    });
  }

  get isAllFilteredSelected(): boolean {
    const filtered = this.filteredLinkableItems;
    return filtered.length > 0 && filtered.every((i) => this.selectedIdsToLink.has(i.id));
  }

  get isSelectionIndeterminate(): boolean {
    const filtered = this.filteredLinkableItems;
    const count = filtered.filter((i) => this.selectedIdsToLink.has(i.id)).length;
    return count > 0 && count < filtered.length;
  }

  isLinkSelected(id: string): boolean {
    return this.selectedIdsToLink.has(id);
  }

  toggleLinkSelection(id: string): void {
    if (this.selectedIdsToLink.has(id)) this.selectedIdsToLink.delete(id);
    else this.selectedIdsToLink.add(id);
    this.selectedIdsToLink = new Set(this.selectedIdsToLink);
  }

  toggleAllLinkSelection(): void {
    if (this.isAllFilteredSelected) this.filteredLinkableItems.forEach((i) => this.selectedIdsToLink.delete(i.id));
    else this.filteredLinkableItems.forEach((i) => this.selectedIdsToLink.add(i.id));
    this.selectedIdsToLink = new Set(this.selectedIdsToLink);
  }

  clearLinkSelection(): void {
    this.selectedIdsToLink = new Set();
  }

  getLinkableProjectData(id: string): M.Projet | undefined {
    return this.allProjects.find((p) => p.id === id);
  }

  openLinkModal(row: M.ParentRow, child?: M.ChildRow) {
    this.selectedParentRow = row;
    this.selectedChildRowToLink = child || null;
    this.selectedIdToLink = '';
    this.selectedIdsToLink = new Set();
    this.linkModalSearchQuery = '';
    this.linkModalStatusFilter = '';
    this.linkModalIsSaving = false;

    const mode = this.viewMode();
    if (mode === 'project') {
      const existing = new Set(row.children.map((c) => c.id));
      this.linkableItems = this.allEquipes.filter((e) => !existing.has(e.id!)).map((e) => ({ id: e.id!, label: e.nom }));
    } else if (mode === 'team') {
      const existing = new Set(row.children.map((c) => c.id));
      this.linkableItems = this.allProjects.filter((p) => !existing.has(p.id!)).map((p) => ({ id: p.id!, label: p.nom_projet }));
    } else if (mode === 'resource') {
      const existing = new Set((child ? child.resources : row.children[0]?.resources || []).map((r) => r.projectId));
      this.linkableItems = this.allProjects.filter((p) => !existing.has(p.id!)).map((p) => ({ id: p.id!, label: p.nom_projet }));
    }
    this.showLinkModal = true;
  }

  closeLinkModal() {
    this.showLinkModal = false;
    this.selectedParentRow = null;
    this.selectedChildRowToLink = null;
    this.selectedIdToLink = '';
    this.selectedIdsToLink = new Set();
    this.linkModalSearchQuery = '';
    this.linkModalStatusFilter = '';
    this.linkModalIsSaving = false;
  }

  async linkItem() {
    if (!this.selectedParentRow) return;
    if (this.viewMode() === 'project') {
      if (!this.selectedIdToLink) return;
      try {
        await this.repo.linkProjectAndAddTeamResources(this.selectedParentRow.id, this.selectedIdToLink);
        await this.loadData({ showSkeleton: false });
        this.closeLinkModal();
      } catch (error: unknown) {
        console.error('Error linking item:', error);
        alert((error as Error)?.message || "Erreur lors de l'ajout du lien.");
      }
      return;
    }

    if (this.selectedIdsToLink.size === 0) return;
    this.linkModalIsSaving = true;
    this.cdr.markForCheck();

    const errors = await this.repo.linkBulkItems(
      this.viewMode(),
      this.selectedParentRow,
      this.selectedChildRowToLink,
      this.selectedIdsToLink,
      this.allProjects,
    );
    await this.loadData({ showSkeleton: false });
    this.linkModalIsSaving = false;
    if (errors.length > 0) alert(`Erreur lors de l'ajout de : ${errors.join(', ')}`);
    this.closeLinkModal();
  }

  getProjectForLinks(): M.Projet | undefined {
    if (this.showLinkModal) {
      if (!this.selectedParentRow && !this.selectedIdToLink) return undefined;
      const projetId = this.viewMode() === 'project' ? this.selectedParentRow?.id : this.selectedIdToLink;
      return this.allProjects.find((p) => p.id === projetId);
    }
    if (this.showAddResourceModal && this.viewMode() === 'team' && this.selectedChildRow) {
      return this.allProjects.find((p) => p.id === this.selectedChildRow?.id);
    }
    return undefined;
  }

  openProjectEditFromLink() {
    const project = this.getProjectForLinks();
    if (project) this.openProjectEdit(project);
  }

  openNewProjectFromLink() {
    this.projectToEdit = {};
    this.isCreatingProjectFromLink = true;
    this.showProjectModal = true;
  }

  openProjectEdit(project: M.Projet) {
    if (project) {
      this.projectToEdit = { ...project };
      this.showProjectModal = true;
    }
  }

  openProjectEditByResource(resource: M.ResourceRow) {
    const project = resource.projectId ? this.allProjects.find((p) => p.id === resource.projectId) : undefined;
    if (project) this.openProjectEdit(project);
  }

  async onProjectSaved(newProject?: M.Projet) {
    this.showProjectModal = false;
    if (this.isCreatingProjectFromLink && newProject?.id && this.selectedParentRow) {
      this.isCreatingProjectFromLink = false;
      try {
        await this.repo.linkNewlyCreatedProject(this.viewMode(), newProject.id, this.selectedParentRow, this.selectedChildRowToLink);
        await this.loadData({ showSkeleton: false });
        this.closeLinkModal();
      } catch (error: unknown) {
        console.error('Error linking newly created project:', error);
        alert(`Le projet "${newProject.nom_projet}" a été créé, mais une erreur est survenue lors de son association : ${(error as Error)?.message || error}`);
      }
    } else {
      await this.loadData({ showSkeleton: false });
    }
  }

  closeProjectModal() {
    this.showProjectModal = false;
    this.isCreatingProjectFromLink = false;
  }

  async openAddResourceModal(child: M.ChildRow, parent: M.ParentRow) {
    this.selectedChildRow = child;
    this.selectedParentForResource = parent;
    this.resourceTypeToAdd = 'role';
    this.selectedResourceId = '';
    this.showAddResourceModal = true;

    try {
      const { roles, personnes } = await this.repo.loadAvailableResourcesForProjectTeam(this.viewMode(), parent, child);
      this.availableRoles = roles;
      this.availablePersonnes = personnes;
    } catch (error) {
      console.error('Error loading available resources:', error);
      this.availableRoles = [];
      this.availablePersonnes = [];
    }
  }

  closeAddResourceModal() {
    this.showAddResourceModal = false;
    this.selectedChildRow = null;
    this.selectedParentForResource = null;
    this.selectedResourceId = '';
  }

  async addResourceToCharge() {
    if (!this.selectedChildRow || !this.selectedParentForResource || !this.selectedResourceId) return;
    try {
      await this.repo.addResourceToCharge(
        this.viewMode(),
        this.selectedParentForResource,
        this.selectedChildRow,
        this.resourceTypeToAdd,
        this.selectedResourceId,
      );
      await this.loadData({ showSkeleton: false });
      this.closeAddResourceModal();
    } catch (error) {
      console.error('Error adding resource:', error);
      alert("Erreur lors de l'ajout de la ressource.");
    }
  }

  onOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) this.isMouseDownOnOverlay = true;
  }

  onOverlayMouseUp(event: MouseEvent, modalType: 'link' | 'resource') {
    if (this.isMouseDownOnOverlay && event.target === event.currentTarget) {
      if (modalType === 'link') this.closeLinkModal();
      else if (modalType === 'resource') this.closeAddResourceModal();
    }
    this.isMouseDownOnOverlay = false;
  }

  onConfirmAction() {
    if (this.pendingConfirmAction) this.pendingConfirmAction();
    this.showConfirmModal = false;
  }

  private promptConfirmAndReload(title: string, message: string, fn: () => Promise<void>, errorAlert: string) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.pendingConfirmAction = async () => {
      try {
        await fn();
        await this.loadData({ showSkeleton: false });
      } catch (error) {
        console.error(errorAlert, error);
        alert(errorAlert);
      }
    };
    this.showConfirmModal = true;
  }

  async removeResource(resource: M.ResourceRow, child: M.ChildRow, parent: M.ParentRow) {
    this.promptConfirmAndReload(
      'Supprimer la ressource',
      `Êtes - vous sûr de vouloir supprimer "${resource.label}" ?\nCela supprimera toutes les charges associées à cette ressource.`,
      () => this.repo.removeResourceCharges(this.viewMode(), resource, child, parent),
      'Erreur lors de la suppression de la ressource.',
    );
  }

  async removeChild(child: M.ChildRow, parent: M.ParentRow) {
    const label = this.viewMode() === 'resource' ? 'la ressource' : this.viewMode() === 'project' ? "l'équipe" : 'le projet';
    this.promptConfirmAndReload(
      `Retirer ${label}`,
      `Êtes - vous sûr de vouloir retirer "${child.label}" ?\nCela supprimera toutes les charges associées.`,
      () => this.repo.removeChildAssociation(this.viewMode(), child, parent),
      "Erreur lors de la suppression de l'association.",
    );
  }

  async executeMove() {
    if (this.selectedCells.length === 0 || this.moveGhostOffset === 0) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.repo.moveSelectedCharges(this.viewMode(), this.selectedCells, this.displayedWeeks, this.moveGhostOffset);
      await this.loadData({ showSkeleton: false });
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

  async applyBulkCharge(value: number | null, comment?: string) {
    if (this.selectedCells.length === 0 || value == null) return;
    this.bulkChargeValue = value;
    const targetComment = comment !== undefined ? comment : this.bulkComment;
    this.isCommittingSelection = true;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.repo.applyBulkCharges(this.viewMode(), this.selectedCells, value, targetComment);
      await this.loadData({ showSkeleton: false });
      this.clearSelection();
    } catch (error) {
      console.error('Error applying bulk charge:', error);
      alert("Erreur lors de l'application des charges.");
    } finally {
      this.isCommittingSelection = false;
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async applyProjection(data: { resources: number; totalDays: number }) {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
    try {
      const sortedCells = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
      const firstCell = sortedCells[0];
      const startWeekIdx = this.displayedWeeks.findIndex((w) => w.getTime() === firstCell.week.getTime());
      if (startWeekIdx === -1) return;

      const daysPerWeek = firstCell.resource.jours_par_semaine || 5;
      const nbWeeks = Math.ceil(data.totalDays / (data.resources * daysPerWeek));
      const resourceUniqueId = this.getResourceUniqueId(firstCell.resource, { id: firstCell.childId }, { id: firstCell.parentId });

      this.projectionCommitting = { resourceUniqueId, startWeekIdx, nbWeeks };
      this.isCommittingSelection = true;
      this.cdr.markForCheck();

      await this.repo.applyProjectedCharges(this.viewMode(), firstCell, startWeekIdx, nbWeeks, this.displayedWeeks, data.resources);
      await this.loadData({ showSkeleton: false });
      this.clearSelection();
    } catch (error) {
      console.error('Error applying projection:', error);
      alert("Erreur lors de l'application de la projection.");
    } finally {
      this.projectionCommitting = null;
      this.isCommittingSelection = false;
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // --- HostListeners & Tutorial ---
  @HostListener('document:mousemove', ['$event'])
  onResizing(event: MouseEvent) {
    if (!this.isResizing) return;
    const newWidth = Math.max(150, Math.min(600, this.startWidth + (event.clientX - this.startX)));
    this.labelColumnWidth.set(newWidth);
  }

  @HostListener('document:mouseup')
  onResizeEnd() {
    this.isResizing = false;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeAllFilterDropdowns();
    this.showYearPopover = false;
    this.showChiffrePopover = false;
    this.activeChiffreAnchorId = null;
    this.activeChiffrePopoverData = null;
    this.clearSelection();
    this.cdr.markForCheck();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent) {
    this.lastMouseDownTarget = event.target as HTMLElement;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const mouseDownTarget = this.lastMouseDownTarget;

    const isInsideFilters =
      !!(target?.closest('.filters-bar') || mouseDownTarget?.closest('.filters-bar')) ||
      !!(target?.closest('.milestone-filter-group') || mouseDownTarget?.closest('.milestone-filter-group'));
    if (!isInsideFilters) {
      this.closeAllFilterDropdowns();
      this.filterProjetSearch.set('');
    }
    if (!(target?.closest('.actions-menu-wrapper') || mouseDownTarget?.closest('.actions-menu-wrapper'))) {
      this.showActionsMenu = false;
    }
    if (!(target?.closest('.view-mode-popover-wrapper') || mouseDownTarget?.closest('.view-mode-popover-wrapper'))) {
      this.openViewDropdown = false;
    }
    const isInsideLineMenu =
      !!(target?.closest('.line-menu-wrapper') || mouseDownTarget?.closest('.line-menu-wrapper')) ||
      !!(target?.closest('.line-menu-trigger') || mouseDownTarget?.closest('.line-menu-trigger'));
    if (!isInsideLineMenu) {
      this.activeLineMenuId = null;
    }

    this.lastMouseDownTarget = null;
    this.cdr.markForCheck();
  }

  restartTutorial() {
    this.showActionsMenu = false;
    this.startTutorial(true);
  }

  private startTutorial(force = false) {
    const hasSeenActions = !!localStorage.getItem('tutorial-actions-menu-v1');
    const hasSeenVue = !!localStorage.getItem('tutorial-view-mode-selector-v1');
    if (!force && hasSeenActions && hasSeenVue) return;

    const mode: 'full' | 'vue-only' = !force && hasSeenActions && !hasSeenVue ? 'vue-only' : 'full';
    const launch = () => {
      if (!this.showGlobalFilters()) {
        this.showGlobalFilters.set(true);
        this.cdr.detectChanges();
      }
      this.repo.runDriverTutorial(mode);
    };

    if (force) launch();
    else setTimeout(launch, 2000);
  }
}
