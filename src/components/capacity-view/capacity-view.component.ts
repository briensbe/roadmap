import {
  Component,
  OnInit,
  NgModule,
  HostListener,
  ChangeDetectorRef,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectionToolbarComponent } from '../selection-toolbar.component';
import { ConfirmModalComponent } from '../confirm-modal.component';
import { CrewdayzMappingModalComponent } from '../crewdayz-mapping/crewdayz-mapping-modal.component';
import { Equipe, Role, Personne, LoadDataOptions } from '../../models/types';
import {
  CapacitySourceConfig,
  CrewdayzTeamAvailability,
  RoadmapMappingRoleProfile,
} from '../../models/crewdayz.types';
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
import { storageSignal } from '../../utils/storage-signal';
import { YearKey, YearPeriod, getSelectableYears } from '../../utils/year-selection';
import { ToastService } from '../../services/toast.service';
import { calculateBestPopoverPosition, PopoverPosition } from '../../utils/selection-positioning';
import { textContains } from '../../utils/text.utils';
import { HoverTooltipController } from '../../shared/grid/hover-tooltip.controller';
import {
  formatWeekHeader,
  formatWeekStart,
  formatLocalDate,
  getWeekNumber,
} from '../../shared/grid/week-calendar.utils';
import { CapacityDataRepository } from './capacity-data.repository';
import { CapacityBulkActionsService } from './capacity-bulk-actions.service';
import { CapacityGridSelectionController } from './capacity-grid-selection.controller';
import {
  ResourceWeekData,
  ResourceRow,
  TeamRow,
  SelectedCapacityCell,
} from './capacity-view.models';
import {
  calculateTeamTotalCapacity,
  calculateTeamTotalDays,
  calculateResourceTotalPlannedDays,
  formatCapacityCellTooltip,
  filterTeamRows,
} from './capacity-calculations.utils';

@NgModule({
  imports: [
    LucideAngularModule.pick({
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
    }),
  ],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

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
  providers: [HoverTooltipController, CapacityGridSelectionController],
  templateUrl: './capacity-view.component.html',
  styleUrl: './capacity-view.component.css',
})
export class CapacityViewComponent implements OnInit, OnDestroy {
  readonly repo = inject(CapacityDataRepository);
  readonly bulkActions = inject(CapacityBulkActionsService);
  readonly tooltipCtrl = inject(HoverTooltipController);
  readonly selectionCtrl = inject(CapacityGridSelectionController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly toast = inject(ToastService);

  displayedWeeks: Date[] = [];
  displayedYears: { year: number; weeksCount: number }[] = [];
  isYearChangeMap: boolean[] = [];
  currentDate: Date = new Date();
  showSkeleton = false;
  isSaving = false;

  teamRows: TeamRow[] = [];
  allEquipes: Equipe[] = [];

  selectedTeamIds = storageSignal<string[]>('capacity-view-selected-teams', []);
  showTeamDropdown = false;
  resourceSearch = '';
  selectedResourceNames: Set<string> = new Set();
  showResourceDropdown = false;

  // Tooltip
  tooltipX = 0;
  tooltipY = 0;
  get activeTooltip(): string | null {
    return this.tooltipCtrl.activeTooltip();
  }

  availableRoles: Role[] = [];
  availablePersonnes: Personne[] = [];

  showAddResourceModal = false;
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingConfirmAction: (() => void) | null = null;

  selectedEquipe: Equipe | null = null;
  resourceTypeToAdd: 'role' | 'personne' = 'role';
  selectedResourceId = '';

  // Facade vers CapacityGridSelectionController
  get selectedCells(): SelectedCapacityCell[] {
    return this.selectionCtrl.selectedCells;
  }
  get isDragging(): boolean {
    return this.selectionCtrl.isDragging;
  }
  get isSelectionFinished(): boolean {
    return this.selectionCtrl.isSelectionFinished;
  }
  get toolbarPosition() {
    return this.selectionCtrl.toolbarPosition;
  }
  get toolbarVisible(): boolean {
    return this.selectionCtrl.toolbarVisible;
  }
  get bulkCapaciteValue() {
    return this.selectionCtrl.bulkCapaciteValue;
  }
  set bulkCapaciteValue(v) {
    this.selectionCtrl.bulkCapaciteValue = v;
  }
  get bulkOverrideValue() {
    return this.selectionCtrl.bulkOverrideValue;
  }
  set bulkOverrideValue(v) {
    this.selectionCtrl.bulkOverrideValue = v;
  }
  get bulkDeltaValue() {
    return this.selectionCtrl.bulkDeltaValue;
  }
  set bulkDeltaValue(v) {
    this.selectionCtrl.bulkDeltaValue = v;
  }
  get bulkCrewdayzBase() {
    return this.selectionCtrl.bulkCrewdayzBase;
  }
  get bulkInitialAction() {
    return this.selectionCtrl.bulkInitialAction;
  }
  set bulkInitialAction(v) {
    this.selectionCtrl.bulkInitialAction = v;
  }
  get bulkComment() {
    return this.selectionCtrl.bulkComment;
  }
  set bulkComment(v) {
    this.selectionCtrl.bulkComment = v;
  }

  showDaysInCells = false;
  zoomLevel = storageSignal<'compact' | 'normal'>('capacity-view-zoom-level', 'normal');
  private isDefaultExpanded = true;
  private manualStates = new Map<string, boolean>();

  selectedCapacityYear: YearPeriod | 'custom' = 'today';
  readonly selectableYears: readonly YearKey[] = getSelectableYears();
  selectedStartDate: Date | null = null;
  showYearPopover = false;
  popoverPosition: PopoverPosition | null = null;
  popoverArrowSide: 'top' | 'bottom' = 'top';
  activeAnchorId: string | null = null;
  private scrollCloseListener?: () => void;

  showCrewdayzMappingModal = false;
  crewdayzAvailabilities: CrewdayzTeamAvailability[] = [];
  crewdayzMappings: RoadmapMappingRoleProfile[] = [];
  capacitySourceConfigs: CapacitySourceConfig[] = [];
  roleAttachmentsList: any[] = [];

  Contact = Contact;
  User = User;
  Sliders = Sliders;
  Zap = Zap;
  Database = Database;
  LoaderCircle = LoaderCircle;

  get isSelectionCrewdayzMode(): boolean {
    if (this.selectedCells.length === 0) return false;
    return this.getSourceForTeam(this.selectedCells[0]!.resource.equipeId) === 'crewdayz';
  }

  get selectionStartWeekDate(): Date | null {
    if (this.selectedCells.length === 0) return null;
    const sorted = [...this.selectedCells].sort((a, b) => a.week.getTime() - b.week.getTime());
    return sorted[0]!.week;
  }

  get selectionDaysPerWeek(): number {
    return this.selectedCells.length > 0 ? this.selectedCells[0]!.resource.jours_par_semaine || 5 : 5;
  }

  get totalSelectedDays(): number {
    let total = 0;
    for (const cell of this.selectedCells) {
      const cap =
        this.bulkCapaciteValue !== null ? this.bulkCapaciteValue : this.getCapacite(cell.resource, cell.week) || 0;
      total += cap * (cell.resource.jours_par_semaine || 5);
    }
    return Math.round(total * 10) / 10;
  }

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
      const scrollHandler = () => {
        if (this.showYearPopover) {
          this.ngZone.run(() => {
            this.showYearPopover = false;
            this.activeAnchorId = null;
            this.cdr.markForCheck();
          });
        }
        if (this.selectedCells.length > 0 && this.isSelectionFinished) {
          this.selectionCtrl.checkToolbarVisibilityOnScroll(this.cdr);
        }
      };
      document.addEventListener('scroll', scrollHandler, true);
      this.scrollCloseListener = () => document.removeEventListener('scroll', scrollHandler, true);
    });
  }

  ngOnDestroy() {
    this.scrollCloseListener?.();
    this.tooltipCtrl.hideTooltip();
  }

  generateWeeks() {
    this.displayedWeeks = [];
    const startDate = new Date(this.currentDate);
    startDate.setDate(1);

    const firstWeek = this.repo.calendarService.getWeekStart(startDate);
    const NB_WEEK_TO_DISPLAY = 53;
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
      const dataset = await this.repo.loadCapacityDataset(
        this.displayedWeeks,
        this.manualStates,
        this.isDefaultExpanded,
      );
      this.availableRoles = dataset.availableRoles;
      this.availablePersonnes = dataset.availablePersonnes;
      this.allEquipes = dataset.allEquipes;
      this.roleAttachmentsList = dataset.roleAttachmentsList;
      this.crewdayzMappings = dataset.crewdayzMappings;
      this.crewdayzAvailabilities = dataset.crewdayzAvailabilities;
      this.capacitySourceConfigs = dataset.capacitySourceConfigs;
      this.teamRows = dataset.teamRows;
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (timer) clearTimeout(timer);
      if (this.showSkeleton) this.showSkeleton = false;
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  get filteredTeamRows(): TeamRow[] {
    return filterTeamRows(
      this.teamRows,
      this.selectedTeamIds(),
      this.selectedResourceNames,
      this.resourceSearch,
    );
  }

  get allResources(): ResourceRow[] {
    const all: ResourceRow[] = [];
    const seenLabels = new Set<string>();
    for (const tr of this.teamRows) {
      for (const r of tr.resources) {
        if (!seenLabels.has(r.label)) {
          seenLabels.add(r.label);
          all.push(r);
        }
      }
    }
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
    if (current.length === 0) return 'Toutes les équipes';
    if (current.length === 1) {
      const id = current[0]!;
      const eq = this.allEquipes.find((e) => e.id === id);
      return eq ? eq.nom : 'Toutes les équipes';
    }
    return `${current.length} équipes`;
  }

  clearSelectedTeams() {
    this.selectedTeamIds.set([]);
  }

  formatWeekHeader(date: Date): string {
    return formatWeekHeader(date);
  }

  getWeekNumber(date: Date): number {
    return getWeekNumber(date);
  }

  updateDisplayedYears() {
    this.displayedYears = [];
    this.isYearChangeMap = [];
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return;

    const yearsMap: { year: number; weeksCount: number }[] = [];
    this.displayedWeeks.forEach((week, index) => {
      const year = this.repo.calendarService.getWeekYear(week);
      const last = yearsMap[yearsMap.length - 1];
      if (last && last.year === year) {
        last.weeksCount++;
      } else {
        yearsMap.push({ year, weeksCount: 1 });
      }

      if (index === 0) {
        this.isYearChangeMap.push(false);
      } else {
        const prevYear = this.repo.calendarService.getWeekYear(this.displayedWeeks[index - 1]!);
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
    const currentWeekStart = this.repo.calendarService.getWeekStart(now);
    return formatWeekStart(date) === formatWeekStart(currentWeekStart);
  }

  getCapacite(resource: ResourceRow, week: Date): number {
    return this.getEffectiveCapacity(resource, week);
  }

  getEffectiveCapacity(resource: ResourceRow, week: Date): number {
    const source = this.getSourceForTeam(resource.equipeId);
    const weekStr = formatWeekStart(week);
    const roadmapCap = resource.weeks.get(weekStr) || 0;
    const crewdayzBase = this.getCrewdayzDispo(resource, week);
    const custom = resource.weekData?.get(weekStr);

    return this.repo.crewdayzService.getEffectiveCapacity(
      source,
      roadmapCap,
      crewdayzBase,
      custom?.override_capacite,
      custom?.override_delta,
    );
  }

  getCustomization(resource: ResourceRow, week: Date): ResourceWeekData | undefined {
    return resource.weekData?.get(formatWeekStart(week));
  }

  hasOverride(resource: ResourceRow, week: Date): boolean {
    if (this.getSourceForTeam(resource.equipeId) !== 'crewdayz') return false;
    const custom = this.getCustomization(resource, week);
    return custom?.override_capacite !== null && custom?.override_capacite !== undefined;
  }

  hasDelta(resource: ResourceRow, week: Date): boolean {
    if (this.getSourceForTeam(resource.equipeId) !== 'crewdayz') return false;
    const custom = this.getCustomization(resource, week);
    return custom?.override_delta !== null && custom?.override_delta !== undefined;
  }

  getDelta(resource: ResourceRow, week: Date): number | null {
    return this.getCustomization(resource, week)?.override_delta ?? null;
  }

  getComment(resource: ResourceRow, week: Date): string | null {
    return this.getCustomization(resource, week)?.comment ?? null;
  }

  getCellTooltip(resource: ResourceRow, week: Date): string {
    const source = this.getSourceForTeam(resource.equipeId);
    const custom = this.getCustomization(resource, week);
    const eff = this.getEffectiveCapacity(resource, week);
    const base = source === 'crewdayz' ? this.getCrewdayzDispo(resource, week) : null;
    return formatCapacityCellTooltip(source, eff, base, custom);
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

    const available = await this.repo.loadAvailableResourcesForEquipe(equipe.id!);
    this.availableRoles = available.availableRoles;
    this.availablePersonnes = available.availablePersonnes;
  }

  async addResourceToTeam() {
    if (!this.selectedEquipe || !this.selectedResourceId) return;

    try {
      await this.repo.addResourceToEquipe(
        this.selectedEquipe.id!,
        this.selectedResourceId,
        this.resourceTypeToAdd,
      );
      this.showAddResourceModal = false;
      await this.loadData({ showSkeleton: false });
    } catch (error: any) {
      console.error('Error adding resource:', error);
      if (error.message && error.message.includes('déjà attaché')) {
        this.toast.warning(error.message);
      } else {
        this.toast.error("Erreur lors de l'ajout de la ressource. Veuillez réessayer.");
      }
    }
  }

  async removeResource(resource: ResourceRow, equipe: Equipe) {
    this.confirmTitle = 'Supprimer la ressource';
    this.confirmMessage = `Retirer ${resource.label} de l'équipe ${equipe.nom} ?`;

    this.pendingConfirmAction = async () => {
      try {
        await this.repo.removeResourceFromEquipe({
          id: resource.id,
          type: resource.type,
          equipeId: equipe.id!,
        });
        await this.loadData({ showSkeleton: false });
      } catch (error) {
        console.error('Error removing resource:', error);
      }
    };
    this.showConfirmModal = true;
  }

  onConfirmAction() {
    this.pendingConfirmAction?.();
    this.showConfirmModal = false;
  }

  showTooltip(event: MouseEvent, text: string) {
    this.tooltipX = event.clientX + 15;
    this.tooltipY = event.clientY + 15;
    this.tooltipCtrl.showTooltip(event, text);
  }

  hideTooltip() {
    this.tooltipCtrl.hideTooltip();
  }

  @HostListener('mousemove', ['$event'])
  updateTooltipPosition(event: MouseEvent) {
    if (!this.activeTooltip) return;
    const offsetX = 15;
    const offsetY = 15;
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    const tooltipWidth = 200;
    const tooltipHeight = 40;

    if (x + tooltipWidth > window.innerWidth) x = event.clientX - tooltipWidth - offsetX;
    if (y + tooltipHeight > window.innerHeight) y = event.clientY - tooltipHeight - offsetY;

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
    this.selectionCtrl.onMouseDown(event, resource, this.displayedWeeks, this.cdr);
  }

  onMouseMove(event: MouseEvent, resource: ResourceRow) {
    this.selectionCtrl.onMouseMove(event, resource, this.displayedWeeks);
  }

  onMouseUp() {
    this.selectionCtrl.onMouseUp(
      this.displayedWeeks,
      this.isSelectionCrewdayzMode,
      (res, week) => this.getCrewdayzDispo(res, week),
      this.cdr,
    );
  }

  isCellSelected(resource: ResourceRow, week: Date): boolean {
    return this.selectionCtrl.isCellSelected(resource, week);
  }

  clearSelection() {
    this.selectionCtrl.clearSelection();
  }

  async applyBulkCapacite(value: number | null, comment?: string) {
    if (this.selectedCells.length === 0 || value == null) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.bulkActions.applyBulkCapacite(this.selectedCells, value, comment);
      this.clearSelection();
    } catch (error) {
      console.error('Error saving capacities:', error);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async applyBulkOverride(event: { value: number; comment?: string }) {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.bulkActions.applyBulkOverride(this.selectedCells, event);
      this.clearSelection();
    } catch (error) {
      console.error('Error saving override capacity:', error);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async applyBulkDelta(event: { delta: number; comment?: string }) {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.bulkActions.applyBulkDelta(this.selectedCells, event);
      this.clearSelection();
    } catch (error) {
      console.error('Error saving delta capacity:', error);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async applyClearCustomizations() {
    if (this.selectedCells.length === 0) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.bulkActions.applyClearCustomizations(this.selectedCells);
      this.clearSelection();
    } catch (error) {
      console.error('Error clearing customizations:', error);
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
      await this.bulkActions.applyCapacityProjection(this.selectedCells, this.displayedWeeks, data);
      this.clearSelection();
    } catch (error) {
      console.error('Error applying generic capacity projection:', error);
      this.toast.error("Erreur lors de l'application de la projection.");
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  async loadCrewdayzAvailabilities() {
    if (!this.displayedWeeks || this.displayedWeeks.length === 0) return;
    const startDateStr = formatWeekStart(this.displayedWeeks[0]!);
    const endDateStr = formatWeekStart(this.displayedWeeks[this.displayedWeeks.length - 1]!);

    try {
      this.crewdayzAvailabilities = await this.repo.fetchCrewdayzAvailabilities(startDateStr, endDateStr);
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
    return calculateTeamTotalCapacity(teamRow, week, (r, w) => this.getCapacite(r, w));
  }

  getTeamTotalDays(teamRow: TeamRow, week: Date): number {
    return calculateTeamTotalDays(teamRow, week, (r, w) => this.getCapacite(r, w));
  }

  formatLocalDate(d: Date): string {
    return formatLocalDate(d);
  }

  getResourceTotalPlannedDays(resource: ResourceRow): number {
    const todayWeekStart = this.repo.calendarService.getWeekStart(new Date());
    return calculateResourceTotalPlannedDays(
      resource,
      this.displayedWeeks,
      this.selectedCapacityYear,
      this.selectedStartDate,
      (r, w) => this.getEffectiveCapacity(r, w),
      todayWeekStart,
    );
  }

  getBadgePrefix(): string {
    if (this.selectedCapacityYear === 'all') return 'Tout :';
    if (this.selectedCapacityYear === 'today') {
      const d = this.repo.calendarService.getWeekStart(new Date());
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

    const rect = targetElement.getBoundingClientRect();
    const pos = calculateBestPopoverPosition({
      rect,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      popoverHeight: 230,
      popoverWidth: 160,
    });
    this.popoverPosition = pos;
    this.popoverArrowSide = pos.arrowSide;

    const closeHandler = (e: MouseEvent | Event) => {
      if (e instanceof MouseEvent && targetElement.contains(e.target as Node)) {
        return;
      }
      this.showYearPopover = false;
      this.activeAnchorId = null;
      document.removeEventListener('click', closeHandler);
    };
    document.addEventListener('click', closeHandler);
  }

  selectYear(year: YearPeriod) {
    this.selectedCapacityYear = year;
    this.selectedStartDate = null;
    this.showYearPopover = false;
  }

  onDateSelected(event: any) {
    const selectedDateStr = event.target.value;
    if (!selectedDateStr) return;

    const selectedDate = new Date(selectedDateStr);
    const mondayOfSelectedWeek = this.repo.calendarService.getWeekStart(selectedDate);

    this.selectedStartDate = mondayOfSelectedWeek;
    this.selectedCapacityYear = 'custom';
    this.showYearPopover = false;
  }

  getSelectedStartDateISO(): string {
    if (!this.selectedStartDate) return '';
    return formatLocalDate(this.selectedStartDate);
  }

  getCrewdayzDispo(resource: ResourceRow, week: Date): number | null {
    if (!this.crewdayzMappings || this.crewdayzMappings.length === 0) return null;
    const weekStr = formatWeekStart(week);
    const attachmentOrTeamId = resource.type === 'role' ? resource.uniqueId : resource.equipeId;
    const personneId = resource.type === 'personne' ? resource.id : null;

    return this.repo.crewdayzService.calculateAvailableCount(
      weekStr,
      attachmentOrTeamId,
      personneId,
      resource.equipeId,
      this.crewdayzAvailabilities,
      this.crewdayzMappings,
    );
  }

  getSourceForTeam(equipeId: string): 'roadmap' | 'crewdayz' {
    return this.repo.crewdayzService.getSourceForTeam(equipeId, this.capacitySourceConfigs);
  }

  openCrewdayzMappingModal() {
    this.showCrewdayzMappingModal = true;
  }

  async onCrewdayzMappingSaved() {
    await this.loadData({ showSkeleton: false });
  }
}
