import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ImportService, ImportBatch, ImportBudgetRow } from '../../services/import/import.service';
import { ProjetService } from '../../services/projet.service';
import {
  LucideAngularModule,
  Database,
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Link,
  Unlink,
  Check,
  Eye,
  EyeOff,
  SquarePlus,
  SquareMinus,
  Copy,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Shield,
} from 'lucide-angular';
import { textContains } from '../../utils/text.utils';
import { SettingsService } from '../../services/settings.service';
import { AdministrationComponent } from '../administration/administration.component';

@Component({
  selector: 'app-import-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, AdministrationComponent],
  templateUrl: './import-view.component.html',
  styleUrl: './import-view.component.css',
})
export class ImportViewComponent implements OnInit {
  private importService = inject(ImportService);
  private projetService = inject(ProjetService);
  private settingsService = inject(SettingsService);
  private route = inject(ActivatedRoute);

  private externalReferenceUrlQuery = this.settingsService.getSettingQuery('external_reference_url', 'global');
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);

  // Lucide Icons
  Database = Database;
  Calendar = Calendar;
  FileSpreadsheet = FileSpreadsheet;
  RefreshCw = RefreshCw;
  Search = Search;
  Filter = Filter;
  CheckCircle2 = CheckCircle2;
  AlertTriangle = AlertTriangle;
  HelpCircle = HelpCircle;
  XCircle = XCircle;
  ExternalLink = ExternalLink;
  ChevronDown = ChevronDown;
  ChevronsDown = ChevronsDown;
  ChevronsUp = ChevronsUp;
  Link = Link;
  Unlink = Unlink;
  Check = Check;
  Eye = Eye;
  EyeOff = EyeOff;
  SquarePlus = SquarePlus;
  SquareMinus = SquareMinus;
  Copy = Copy;
  AlertOctagon = AlertOctagon;
  TrendingUp = TrendingUp;
  TrendingDown = TrendingDown;
  Shield = Shield;

  // Selected Batch ID state
  selectedBatchId = signal<number | null>(null);
  showStats = signal<boolean>(false);
  // Active Tab & Anomaly Filters
  activeTab = signal<'data' | 'anomalies' | 'administration'>('data');
  anomalyFilters = signal<string[]>(['dépassement', 'écart_hausse', 'écart_baisse']);
  showAnomalyDropdown = signal<boolean>(false);

  toggleAnomalyFilter(filter: string) {
    const current = this.anomalyFilters();
    if (current.includes(filter)) {
      this.anomalyFilters.set(current.filter(x => x !== filter));
    } else {
      this.anomalyFilters.set([...current, filter]);
    }
  }

  // Queries
  batchesQuery = this.importService.getBatchesQuery();
  budgetRowsQuery = this.importService.getBudgetRowsQuery(() => this.selectedBatchId());
  projetsQuery = this.projetService.getAllProjetsQuery();

  // Mutations
  reconcileMutation = this.importService.reconcileRowMutation();
  reconcileBatchMutation = this.importService.reconcileBatchMutation();



  // Selected Batch Detail
  selectedBatch = computed(() => {
    const batches = this.batchesQuery.data() || [];
    const id = this.selectedBatchId();
    if (!id && batches.length > 0) {
      // Auto-select latest batch
      setTimeout(() => this.selectedBatchId.set(batches[0].id), 0);
      return batches[0];
    }
    return batches.find((b) => b.id === id) || null;
  });

  // Filters State
  searchQuery = signal('');
  statusFilter = signal<string>('all'); // 'all', 'matched', 'multi_matched', 'ambiguous', 'unmapped'
  serviceFilter = signal<string>('all');

  // Available unique services in the current rows
  filterOptions = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const services = new Set<string>();

    rows.forEach((r: ImportBudgetRow) => {
      if (r.service_name) services.add(r.service_name);
    });

    return {
      services: Array.from(services).sort(),
    };
  });

  // Unique service colors helper
  getServiceColorStyle(serviceName: string): { [key: string]: string } {
    // Generate HSL color based on hash of service name to distribute colors evenly and dynamically
    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
      hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    // Use nice pastels for labels: 75% saturation, 95% lightness for background, 30% lightness for text
    return {
      'background-color': `hsl(${h}, 70%, 93%)`,
      color: `hsl(${h}, 75%, 25%)`,
      border: `1px solid hsl(${h}, 60%, 80%)`,
    };
  }

  // Reconciliation stats for the current batch
  stats = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const total = rows.length;
    let matched = 0;
    let multiMatched = 0;
    let ambiguous = 0;
    let unmapped = 0;

    rows.forEach((r: ImportBudgetRow) => {
      switch (r.reconciliation_status) {
        case 'matched':
          matched++;
          break;
        case 'multi_matched':
          multiMatched++;
          break;
        case 'ambiguous':
          ambiguous++;
          break;
        case 'unmapped':
          unmapped++;
          break;
      }
    });

    const percent = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { total, matched, multiMatched, ambiguous, unmapped, percent };
  });

  // Expanded project keys state (collapsed by default)
  expandedProjects = signal<Set<string>>(new Set());

  toggleProjectExpansion(projectKey: string) {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    const expanded = new Set(this.expandedProjects());
    if (expanded.has(projectKey)) {
      expanded.delete(projectKey);
    } else {
      expanded.add(projectKey);
    }
    this.expandedProjects.set(expanded);
  }

  expandAll() {
    const keys = this.groupedProjects().map(p => p.key);
    this.expandedProjects.set(new Set(keys));
  }

  collapseAll() {
    this.expandedProjects.set(new Set());
  }

  isProjectExpanded(projectKey: string): boolean {
    return this.expandedProjects().has(projectKey);
  }

  filteredCount = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const search = this.searchQuery().trim();
    const status = this.statusFilter();
    const service = this.serviceFilter();

    return rows.filter((r: ImportBudgetRow) => {
      const matchesSearch =
        !search ||
        textContains(r.project_code, search) ||
        textContains(r.project_name, search) ||
        textContains(r.project_manager, search) ||
        (r.jira_references && r.jira_references.some((j: string) => textContains(j, search)));

      const matchesStatus = status === 'all' || r.reconciliation_status === status;
      const matchesService = service === 'all' || r.service_name === service;

      return matchesSearch && matchesStatus && matchesService;
    }).length;
  });

  // Regrouped projects computed for template display
  groupedProjects = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const search = this.searchQuery().trim();
    const status = this.statusFilter();
    const service = this.serviceFilter();

    // 1. Filter rows
    const filtered = rows.filter((r: ImportBudgetRow) => {
      const matchesSearch =
        !search ||
        textContains(r.project_code, search) ||
        textContains(r.project_name, search) ||
        textContains(r.project_manager, search) ||
        (r.jira_references && r.jira_references.some((j: string) => textContains(j, search)));

      const matchesStatus = status === 'all' || r.reconciliation_status === status;
      const matchesService = service === 'all' || r.service_name === service;

      return matchesSearch && matchesStatus && matchesService;
    });

    // 2. Group by project_code + project_name under the same breadcrumb key
    const groups: { [key: string]: {
      key: string;
      project_code: string;
      project_name: string | null;
      project_manager: string | null;
      jira_references: string[] | null;
      reconciliation_status: 'matched' | 'multi_matched' | 'ambiguous' | 'unmapped';
      project_id: string | null;
      project_ids: string[] | null;
      initial_jh: number;
      revised_jh: number;
      previsionnel_jh: number;
      consomme_jh: number;
      budget_nomenclature: string | null;
      budget_object: string | null;
      activity_type: string | null;
      hasConsumedAnomaly: boolean;
      hasRevisionAnomaly: boolean;
      hasAnyAnomaly: boolean;
      services: {
        id: number;
        service_name: string;
        initial_jh: number | null;
        revised_jh: number | null;
        previsionnel_jh: number | null;
        consomme_jh: number | null;
        hasConsumedAnomaly: boolean;
        hasRevisionAnomaly: boolean;
        consumedGap: number;
        revisionGap: number;
      }[];
    } } = {};

    for (const row of filtered) {
      const breadcrumbKey = `${row.budget_nomenclature || ''}_${row.budget_object || ''}_${row.activity_type || ''}_${row.project_code}_${row.project_name || ''}`;

      if (!groups[breadcrumbKey]) {
        groups[breadcrumbKey] = {
          key: breadcrumbKey,
          project_code: row.project_code,
          project_name: row.project_name,
          project_manager: row.project_manager,
          jira_references: row.jira_references,
          reconciliation_status: row.reconciliation_status,
          project_id: row.project_id,
          project_ids: row.project_ids,
          initial_jh: 0,
          revised_jh: 0,
          previsionnel_jh: 0,
          consomme_jh: 0,
          budget_nomenclature: row.budget_nomenclature,
          budget_object: row.budget_object,
          activity_type: row.activity_type,
          hasConsumedAnomaly: false,
          hasRevisionAnomaly: false,
          hasAnyAnomaly: false,
          services: [],
        };
      }

      const grp = groups[breadcrumbKey];
      grp.initial_jh += row.initial_jh || 0;
      grp.revised_jh += row.revised_jh || 0;
      grp.previsionnel_jh += row.previsionnel_jh || 0;
      grp.consomme_jh += row.consomme_jh || 0;

      const hasConsumedAnomaly = (row.consomme_jh || 0) > (row.previsionnel_jh || 0);
      const hasRevisionAnomaly = Math.abs((row.previsionnel_jh || 0) - (row.revised_jh || 0)) > 0.01;

      grp.services.push({
        id: row.id,
        service_name: row.service_name,
        initial_jh: row.initial_jh,
        revised_jh: row.revised_jh,
        previsionnel_jh: row.previsionnel_jh,
        consomme_jh: row.consomme_jh,
        hasConsumedAnomaly,
        hasRevisionAnomaly,
        consumedGap: (row.consomme_jh || 0) - (row.previsionnel_jh || 0),
        revisionGap: (row.revised_jh || 0) - (row.previsionnel_jh || 0),
      });
    }

    // Sort services alphabetically for each project group and compute project-level flags
    for (const group of Object.values(groups)) {
      group.services.sort((a, b) => a.service_name.localeCompare(b.service_name));
      group.hasConsumedAnomaly = group.services.some(s => s.hasConsumedAnomaly);
      group.hasRevisionAnomaly = group.services.some(s => s.hasRevisionAnomaly);
      group.hasAnyAnomaly = group.hasConsumedAnomaly || group.hasRevisionAnomaly;
    }

    let result = Object.values(groups);

    // If anomalies tab is active, filter the services inside each group by selected multi-choice filters,
    // and exclude groups that have no matching services left.
    if (this.activeTab() === 'anomalies') {
      const filters = this.anomalyFilters();
      
      result = result.map(grp => {
        const filteredServices = grp.services.filter(s => {
          const isConsumed = s.hasConsumedAnomaly;
          const isRevisionHausse = s.hasRevisionAnomaly && s.revisionGap > 0.01;
          const isRevisionBaisse = s.hasRevisionAnomaly && s.revisionGap < -0.01;
          const isConforme = !s.hasConsumedAnomaly && !s.hasRevisionAnomaly;

          if (isConsumed && filters.includes('dépassement')) return true;
          if (isRevisionHausse && filters.includes('écart_hausse')) return true;
          if (isRevisionBaisse && filters.includes('écart_baisse')) return true;
          if (isConforme && filters.includes('conforme')) return true;
          
          return false;
        });

        return {
          ...grp,
          services: filteredServices,
          hasConsumedAnomaly: filteredServices.some(s => s.hasConsumedAnomaly),
          hasRevisionAnomaly: filteredServices.some(s => s.hasRevisionAnomaly),
          hasAnyAnomaly: filteredServices.some(s => s.hasConsumedAnomaly || s.hasRevisionAnomaly)
        };
      }).filter(grp => grp.services.length > 0);
    }

    // 3. Sort by Nomenclature -> Objet -> Type activité -> Project Code
    return result.sort((a, b) => {
      const nomA = a.budget_nomenclature || '';
      const nomB = b.budget_nomenclature || '';
      if (nomA !== nomB) return nomA.localeCompare(nomB);

      const objA = a.budget_object || '';
      const objB = b.budget_object || '';
      if (objA !== objB) return objA.localeCompare(objB);

      const actA = a.activity_type || '';
      const actB = b.activity_type || '';
      if (actA !== actB) return actA.localeCompare(actB);

      return a.project_code.localeCompare(b.project_code);
    });
  });

  // Anomalies Stats for the active batch (based on all raw rows in the batch)
  anomaliesStats = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    let totalServicesWithAnomalies = 0;
    let consumedAnomaliesCount = 0;
    let revisionAnomaliesCount = 0;

    rows.forEach((r: ImportBudgetRow) => {
      const hasConsumed = (r.consomme_jh || 0) > (r.previsionnel_jh || 0);
      const hasRevision = Math.abs((r.previsionnel_jh || 0) - (r.revised_jh || 0)) > 0.01;

      if (hasConsumed) consumedAnomaliesCount++;
      if (hasRevision) revisionAnomaliesCount++;
      if (hasConsumed || hasRevision) totalServicesWithAnomalies++;
    });

    return {
      total: totalServicesWithAnomalies,
      consumed: consumedAnomaliesCount,
      revision: revisionAnomaliesCount,
    };
  });

  // Modal / Dropdown State for manual reconciliation selection
  reconcileActiveRowId = signal<number | null>(null);
  reconcileSearchQuery = signal('');

  // Projets list available for manual mapping (filtered by query)
  availableProjetsForMapping = computed(() => {
    const search = this.reconcileSearchQuery().trim();
    const projets = this.projetsQuery.data() || [];

    return projets.filter(
      (p) =>
        !search ||
        textContains(p.nom_projet, search) ||
        textContains(p.code_projet, search) ||
        textContains(p.reference_externe, search),
    );
  });

  // Target row selected for manual reconciliation
  activeReconcileRow = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    return rows.find((r: ImportBudgetRow) => r.id === this.reconcileActiveRowId()) || null;
  });

  // Suggested projects for multi_matched list
  suggestedProjets = computed(() => {
    const row = this.activeReconcileRow();
    const projets = this.projetsQuery.data() || [];
    if (!row) return [];

    if (row.project_ids && row.project_ids.length > 0) {
      return projets.filter((p) => row.project_ids!.includes(p.id!));
    }

    // fallback: find projects matching the code
    return projets.filter((p) => p.code_projet === row.project_code);
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const tab = params['tab'];
        if (tab === 'data' || tab === 'anomalies' || tab === 'administration') {
          this.activeTab.set(tab);
        }
      }
    });
  }

  openReconcileModal(rowId: number) {
    this.reconcileActiveRowId.set(rowId);
    this.reconcileSearchQuery.set('');
  }

  closeReconcileModal() {
    this.reconcileActiveRowId.set(null);
  }

  getProjectName(projectId: string | null): string {
    if (!projectId) return '—';
    const projets = this.projetsQuery.data() || [];
    const p = projets.find((x) => x.id === projectId);
    return p ? p.nom_projet : 'Projet inconnu';
  }

  getProjectUUIDCode(projectId: string | null): string {
    if (!projectId) return '';
    const projets = this.projetsQuery.data() || [];
    const p = projets.find((x) => x.id === projectId);
    return p ? p.code_projet : '';
  }

  getProjectExternalRef(projectId: string | null): string | null {
    if (!projectId) return null;
    const projets = this.projetsQuery.data() || [];
    const p = projets.find((x) => x.id === projectId);
    return p ? (p.reference_externe || null) : null;
  }

  cleanJiraRef(ref: string | null | undefined): string {
    if (!ref) return '';
    const match = ref.match(/(SUIVI-\d+)/i);
    if (match) {
      return match[1].toUpperCase();
    }
    return ref.trim();
  }

  copiedCodes = signal<Set<string>>(new Set());

  copyToClipboard(event: MouseEvent, text: string) {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      const current = new Set(this.copiedCodes());
      current.add(text);
      this.copiedCodes.set(current);

      setTimeout(() => {
        const updated = new Set(this.copiedCodes());
        updated.delete(text);
        this.copiedCodes.set(updated);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  }

  async setReconciliation(rowId: number, projectId: string | null) {
    this.reconcileMutation.mutate(
      { rowId, projectId },
      {
        onSuccess: () => {
          this.closeReconcileModal();
        },
      },
    );
  }

  toNumber(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }


}
