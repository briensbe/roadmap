import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
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
  Import,
  Download,
  Clipboard,
  MessageSquare,
  Share2,
} from 'lucide-angular';
import { textContains } from '../../utils/text.utils';
import { SettingsService } from '../../services/settings.service';
import { AdministrationComponent } from '../administration/administration.component';
import * as XLSX from 'xlsx';

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
  Import = Import;
  Download = Download;
  Clipboard = Clipboard;
  MessageSquare = MessageSquare;
  Share2 = Share2;

  // Selected Batch ID state
  selectedBatchId = signal<number | null>(
    localStorage.getItem('selected_import_batch_id')
      ? Number(localStorage.getItem('selected_import_batch_id'))
      : null
  );
  showStats = signal<boolean>(false);
  // Active Tab & Anomaly Filters
  activeTab = signal<'data' | 'anomalies' | 'administration'>('data');
  anomalyFilters = signal<string[]>(['dépassement', 'écart_hausse', 'écart_baisse']);
  showAnomalyDropdown = signal<boolean>(false);
  showExportModal = signal<boolean>(false);
  copiedExportText = signal<boolean>(false);
  copiedPmCode = signal<string | null>(null);

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
    const exists = batches.some(b => b.id === id);
    if ((!id || !exists) && batches.length > 0) {
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

  constructor() {
    effect(() => {
      const id = this.selectedBatchId();
      if (id !== null) {
        localStorage.setItem('selected_import_batch_id', String(id));
      }
    });
  }

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

  anomaliesByPm = computed(() => {
    const projects = this.groupedProjects();
    const pmGroups: { [pmName: string]: any[] } = {};

    projects.forEach(proj => {
      // Find services with anomalies in this project group
      const anomalousServices = proj.services.filter(s => s.hasConsumedAnomaly || s.hasRevisionAnomaly);
      if (anomalousServices.length > 0) {
        const pm = proj.project_manager ? proj.project_manager.trim() : 'Sans Chef de Projet';
        if (!pmGroups[pm]) {
          pmGroups[pm] = [];
        }
        pmGroups[pm].push({
          ...proj,
          services: anomalousServices
        });
      }
    });

    // Convert to sorted array
    return Object.keys(pmGroups)
      .map(pm => ({
        pm,
        projects: pmGroups[pm],
        totalAlerts: pmGroups[pm].reduce((acc, curr) => acc + curr.services.length, 0)
      }))
      .sort((a, b) => a.pm.localeCompare(b.pm));
  });

  generateIndividualReportMarkdown(pmName: string): string {
    const pmGroup = this.anomaliesByPm().find(g => g.pm === pmName);
    if (!pmGroup) return '';

    let text = `Bonjour ${pmName === 'Sans Chef de Projet' ? '' : pmGroup.pm},\n`;
    text += `Voici un récapitulatif des alertes/écarts budgétaires constatés sur tes projets (Import Triskell) :\n\n`;

    pmGroup.projects.forEach((proj: any) => {
      text += `*Projet : ${proj.project_code} - ${proj.project_name}*\n`;
      proj.services.forEach((srv: any) => {
        text += `  - *${srv.service_name}* :`;
        if (srv.hasConsumedAnomaly) {
          text += ` ⚠️ Dépassement consommé de +${srv.consumedGap.toFixed(1)} JH (Consommé : ${(srv.consomme_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
        }
        if (srv.hasRevisionAnomaly) {
          const sign = srv.revisionGap > 0 ? '+' : '';
          text += ` 🔄 Écart révision de ${sign}${srv.revisionGap.toFixed(1)} JH (Révisé : ${(srv.revised_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
        }
      });
      text += `\n`;
    });

    text += `Merci de vérifier ces écarts dans l'outil Roadmap ou Triskell.`;
    return text;
  }

  generateGlobalReportMarkdown(): string {
    const groups = this.anomaliesByPm();
    if (groups.length === 0) return 'Aucune anomalie détectée ou filtrée.';

    let text = `*RAPPORT DES ANOMALIES BUDGÉTAIRES TRISKELL*\n`;
    text += `Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}\n`;
    text += `Nombre de collaborateurs concernés : ${groups.length}\n`;
    text += `--------------------------------------------------\n\n`;

    groups.forEach(g => {
      text += `👤 *Chef de projet : ${g.pm}* (${g.totalAlerts} alerte(s))\n`;
      text += `==================================================\n`;
      g.projects.forEach((proj: any) => {
        text += `• *Projet : ${proj.project_code} - ${proj.project_name}*\n`;
        proj.services.forEach((srv: any) => {
          if (srv.hasConsumedAnomaly) {
            text += `  - [${srv.service_name}] ⚠️ Dépassement : +${srv.consumedGap.toFixed(1)} JH (Consommé : ${(srv.consomme_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
          }
          if (srv.hasRevisionAnomaly) {
            const sign = srv.revisionGap > 0 ? '+' : '';
            text += `  - [${srv.service_name}] 🔄 Écart Révision : ${sign}${srv.revisionGap.toFixed(1)} JH (Révisé : ${(srv.revised_jh ?? 0).toFixed(1)} JH vs Prév : ${(srv.previsionnel_jh ?? 0).toFixed(1)} JH)\n`;
          }
        });
      });
      text += `\n`;
    });

    return text;
  }

  copyTextToClipboard(text: string, isGlobal: boolean = false, pmName: string | null = null) {
    navigator.clipboard.writeText(text).then(() => {
      if (isGlobal) {
        this.copiedExportText.set(true);
        setTimeout(() => this.copiedExportText.set(false), 2000);
      } else if (pmName) {
        this.copiedPmCode.set(pmName);
        setTimeout(() => this.copiedPmCode.set(null), 2000);
      }
    }).catch(err => {
      console.error('Erreur lors de la copie du rapport: ', err);
    });
  }

  exportAnomaliesToExcel() {
    const groups = this.anomaliesByPm();
    const rows: any[] = [];

    groups.forEach(g => {
      g.projects.forEach((proj: any) => {
        proj.services.forEach((srv: any) => {
          let diag = '';
          let gap = 0;
          if (srv.hasConsumedAnomaly) {
            diag = 'Dépassement';
            gap = srv.consumedGap;
          } else if (srv.hasRevisionAnomaly) {
            diag = srv.revisionGap > 0 ? 'Écart hausse' : 'Écart baisse';
            gap = srv.revisionGap;
          } else {
            diag = 'Conforme';
          }

          rows.push({
            'Chef de projet': g.pm,
            'Code Projet': proj.project_code,
            'Nom Projet': proj.project_name || '',
            'Service': srv.service_name,
            'Initial (JH)': srv.initial_jh,
            'Révisé (JH)': srv.revised_jh,
            'Prévisionnel (JH)': srv.previsionnel_jh,
            'Consommé (JH)': srv.consomme_jh,
            'Diagnostic': diag,
            'Écart (JH)': gap
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anomalies Triskell');

    const wscols = [
      {wch: 25}, // PM
      {wch: 15}, // Code
      {wch: 35}, // Nom
      {wch: 25}, // Service
      {wch: 12}, // Initial
      {wch: 12}, // Revised
      {wch: 12}, // Prev
      {wch: 12}, // Cons
      {wch: 20}, // Diag
      {wch: 12}  // Gap
    ];
    ws['!cols'] = wscols;

    const fileName = `Export_Anomalies_Triskell_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  exportAnomaliesToCSV() {
    const groups = this.anomaliesByPm();
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'Chef de projet;Code Projet;Nom Projet;Service;Initial (JH);Révisé (JH);Prévisionnel (JH);Consommé (JH);Diagnostic;Écart (JH)\n';

    groups.forEach(g => {
      g.projects.forEach((proj: any) => {
        proj.services.forEach((srv: any) => {
          let diag = '';
          let gap = 0;
          if (srv.hasConsumedAnomaly) {
            diag = 'Dépassement';
            gap = srv.consumedGap;
          } else if (srv.hasRevisionAnomaly) {
            diag = srv.revisionGap > 0 ? 'Écart hausse' : 'Écart baisse';
            gap = srv.revisionGap;
          } else {
            diag = 'Conforme';
          }

          const pm = (g.pm || '').replace(/"/g, '""');
          const code = (proj.project_code || '').replace(/"/g, '""');
          const name = (proj.project_name || '').replace(/"/g, '""');
          const srvName = (srv.service_name || '').replace(/"/g, '""');

          const initial = srv.initial_jh !== null ? String(srv.initial_jh).replace('.', ',') : '';
          const revised = srv.revised_jh !== null ? String(srv.revised_jh).replace('.', ',') : '';
          const prev = srv.previsionnel_jh !== null ? String(srv.previsionnel_jh).replace('.', ',') : '';
          const cons = srv.consomme_jh !== null ? String(srv.consomme_jh).replace('.', ',') : '';
          const gapStr = String(gap).replace('.', ',');

          csvContent += `"${pm}";"${code}";"${name}";"${srvName}";"${initial}";"${revised}";"${prev}";"${cons}";"${diag}";"${gapStr}"\n`;
        });
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Export_Anomalies_Triskell_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
