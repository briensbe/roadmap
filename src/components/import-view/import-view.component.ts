import { Component, inject, signal, computed, HostListener } from '@angular/core';
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
  Check,
  Eye,
  EyeOff,
  Upload,
  FileUp
} from 'lucide-angular';
import { TriskellImportProcessor, ImportResult } from '../../services/import/TriskellImportProcessor';

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
  Eye = Eye;
  EyeOff = EyeOff;
  Upload = Upload;
  FileUp = FileUp;

  // Selected Batch ID state
  selectedBatchId = signal<string | null>(null);
  showStats = signal<boolean>(false);
  showUploadArea = signal<boolean>(true); // Visible par défaut à l'arrivée
  showImportButton = signal<boolean>(false); // Apparaît dès qu'on a scrollé
  hasScrolled = signal<boolean>(false); // Marqueur de premier scroll
  window = window;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    
    // Si on a scrollé de plus de 40px et qu'on ne l'a pas encore fait
    if (scrollOffset > 40 && !this.hasScrolled()) {
      this.hasScrolled.set(true);
      this.showUploadArea.set(false);
      this.showImportButton.set(true);
    }
  }

  toggleUploadArea() {
    this.showUploadArea.set(!this.showUploadArea());
    if (this.showUploadArea()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Excel Upload States
  isDragging = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  excelError = signal<string | null>(null);
  excelSuccessSummary = signal<ImportResult | null>(null);

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
  serviceFilter = signal<string>('all');

  // Available unique services in the current rows
  filterOptions = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const services = new Set<string>();

    rows.forEach((r: ImportBudgetRow) => {
      if (r.service_name) services.add(r.service_name);
    });

    return {
      services: Array.from(services).sort()
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
      'color': `hsl(${h}, 75%, 25%)`,
      'border': `1px solid hsl(${h}, 60%, 80%)`
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
        case 'matched': matched++; break;
        case 'multi_matched': multiMatched++; break;
        case 'ambiguous': ambiguous++; break;
        case 'unmapped': unmapped++; break;
      }
    });

    const percent = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { total, matched, multiMatched, ambiguous, unmapped, percent };
  });

  // Regrouped rows computed for template display
  filteredRows = computed(() => {
    const rows = this.budgetRowsQuery.data() || [];
    const search = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const service = this.serviceFilter();

    // 1. Filter rows
    const filtered = rows.filter((r: ImportBudgetRow) => {
      const matchesSearch = !search ||
        (r.project_code && r.project_code.toLowerCase().includes(search)) ||
        (r.project_name && r.project_name.toLowerCase().includes(search)) ||
        (r.project_manager && r.project_manager.toLowerCase().includes(search)) ||
        (r.jira_references && r.jira_references.some((j: string) => j.toLowerCase().includes(search)));

      const matchesStatus = status === 'all' || r.reconciliation_status === status;
      const matchesService = service === 'all' || r.service_name === service;

      return matchesSearch && matchesStatus && matchesService;
    });

    // 2. Sort by Nomenclature -> Objet -> Type activité -> Project Code
    return filtered.sort((a, b) => {
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

  // Drag & Drop Handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processExcelFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processExcelFile(input.files[0]);
    }
  }

  private async processExcelFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.excelError.set("Type de fichier invalide. Veuillez déposer un fichier Excel (.xlsx).");
      return;
    }

    this.isProcessing.set(true);
    this.excelError.set(null);
    this.excelSuccessSummary.set(null);

    try {
      const reader = new FileReader();
      
      // Promisify FileReader load event
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });

      // Initialize processor and invoke client-side pipeline
      const processor = new TriskellImportProcessor(this.projetService['supabase'].client);
      const result = await processor.processImportBuffer(arrayBuffer, file.name);

      this.excelSuccessSummary.set(result);

      // Invalidate query caches to trigger UI reload
      const queryClient = this.importService['queryClient'];
      await queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      
      // Auto select the newly created batch
      this.selectedBatchId.set(result.batchId);
      await queryClient.invalidateQueries({ queryKey: ['import-budget-rows', result.batchId] });
      
      // Auto collapse drag & drop area on success
      this.showUploadArea.set(false);

    } catch (err: any) {
      console.error("Error processing Excel import:", err);
      this.excelError.set(err.message || "Une erreur est survenue lors de la lecture du fichier Excel.");
    } finally {
      this.isProcessing.set(false);
    }
  }

  closeSummary() {
    this.excelSuccessSummary.set(null);
  }

  closeError() {
    this.excelError.set(null);
  }
}
