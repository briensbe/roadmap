import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  Link,
  Unlink,
  Check
} from 'lucide-angular';

@Component({
  selector: 'app-import-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './import-view.component.html',
  styleUrl: './import-view.component.css'
})
export class ImportViewComponent {
  private importService = inject(ImportService);
  private projetService = inject(ProjetService);

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
  Link = Link;
  Unlink = Unlink;
  Check = Check;

  // Selected Batch ID state
  selectedBatchId = signal<string | null>(null);

  // Queries
  batchesQuery = this.importService.getBatchesQuery();
  budgetRowsQuery = this.importService.getBudgetRowsQuery(() => this.selectedBatchId());
  projetsQuery = this.projetService.getAllProjetsQuery();

  // Mutations
  reconcileMutation = this.importService.reconcileRowMutation();

  // Selected Batch Detail
  selectedBatch = computed(() => {
    const batches = this.batchesQuery.data() || [];
    const id = this.selectedBatchId();
    if (!id && batches.length > 0) {
      // Auto-select latest batch
      setTimeout(() => this.selectedBatchId.set(batches[0].id), 0);
      return batches[0];
    }
    return batches.find(b => b.id === id) || null;
  });

  // Filters State
  searchQuery = signal('');
  statusFilter = signal<string>('all'); // 'all', 'matched', 'multi_matched', 'ambiguous', 'unmapped'
  typeFilter = signal<string>('all');
  serviceFilter = signal<string>('all');

  // Available unique types & services in the current rows
  filterOptions = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const types = new Set<string>();
    const services = new Set<string>();

    rows.forEach((r: ImportBudgetRow) => {
      if (r.budget_type) types.add(r.budget_type);
      if (r.service_name) services.add(r.service_name);
    });

    return {
      types: Array.from(types).sort(),
      services: Array.from(services).sort()
    };
  });

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
        case 'matched': matched++; break;
        case 'multi_matched': multiMatched++; break;
        case 'ambiguous': ambiguous++; break;
        case 'unmapped': unmapped++; break;
      }
    });

    const percent = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { total, matched, multiMatched, ambiguous, unmapped, percent };
  });

  // Filtered Rows list
  filteredRows = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const search = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const service = this.serviceFilter();

    return rows.filter((r: ImportBudgetRow) => {
      const matchesSearch = !search ||
        (r.project_code && r.project_code.toLowerCase().includes(search)) ||
        (r.project_name && r.project_name.toLowerCase().includes(search)) ||
        (r.project_manager && r.project_manager.toLowerCase().includes(search)) ||
        (r.jira_references && r.jira_references.some((j: string) => j.toLowerCase().includes(search)));

      const matchesStatus = status === 'all' || r.reconciliation_status === status;
      const matchesType = type === 'all' || r.budget_type === type;
      const matchesService = service === 'all' || r.service_name === service;

      return matchesSearch && matchesStatus && matchesType && matchesService;
    });
  });

  // Modal / Dropdown State for manual reconciliation selection
  reconcileActiveRowId = signal<number | null>(null);
  reconcileSearchQuery = signal('');

  // Projets list available for manual mapping (filtered by query)
  availableProjetsForMapping = computed(() => {
    const search = this.reconcileSearchQuery().toLowerCase().trim();
    const projets = this.projetsQuery.data() || [];

    return projets.filter(p =>
      !search ||
      p.nom_projet.toLowerCase().includes(search) ||
      p.code_projet.toLowerCase().includes(search) ||
      (p.reference_externe && p.reference_externe.toLowerCase().includes(search))
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
      return projets.filter(p => row.project_ids!.includes(p.id!));
    }

    // fallback: find projects matching the code
    return projets.filter(p => p.code_projet === row.project_code);
  });

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
    const p = projets.find(x => x.id === projectId);
    return p ? p.nom_projet : 'Projet inconnu';
  }

  getProjectUUIDCode(projectId: string | null): string {
    if (!projectId) return '';
    const projets = this.projetsQuery.data() || [];
    const p = projets.find(x => x.id === projectId);
    return p ? p.code_projet : '';
  }

  async setReconciliation(rowId: number, projectId: string | null) {
    this.reconcileMutation.mutate({ rowId, projectId }, {
      onSuccess: () => {
        this.closeReconcileModal();
      }
    });
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
