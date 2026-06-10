import { Component, OnInit, HostListener, ElementRef, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ProjetService } from "../../services/projet.service";
import { SettingsService } from "../../services/settings.service";
import { Projet } from "../../models/types";
import { ChiffresModalComponent } from "../chiffres/chiffres-modal.component";
import { Chiffre } from "../../models/chiffres.type";
import { LucideAngularModule, Plus, LucideCalculator, MoreVertical, Edit, Trash2, Copy, ExternalLink, FileDown, FileUp, AlertCircle, ChevronDown } from "lucide-angular";
import { ConfirmModalComponent } from "../confirm-modal.component";
import { ProjectModalComponent } from "../project-modal.component";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { calculateNewRank, sortByRank } from "../../utils/lexorank.utils";
import { storageSignal } from "../../utils/storage-signal";
import * as XLSX from 'xlsx';

@Component({
  selector: "app-projects-view",
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent, LucideAngularModule, ConfirmModalComponent, ProjectModalComponent, DragDropModule],
  templateUrl: "./projects-view.component.html",
  styleUrl: "./projects-view.component.css"
})
export class ProjectsViewComponent implements OnInit {
  viewMode = storageSignal<"list" | "card" | "table">("projects_view_mode", "list");
  searchQuery = signal("");
  statusFilter = storageSignal<string[]>("projects_view_status_filter", []);
  showStatusDropdown = false;
  ChevronDown = ChevronDown;

  LucideCalculator = LucideCalculator;
  MoreVertical = MoreVertical;
  Edit = Edit;
  Trash2 = Trash2;
  Copy = Copy;
  ExternalLink = ExternalLink;
  Plus = Plus;
  FileDown = FileDown;
  FileUp = FileUp;
  AlertCircle = AlertCircle;

  // TanStack Query - Reactive data
  projetsQuery = this.projetService.getAllProjetsQuery();
  createMutation = this.projetService.createProjetMutation();
  updateMutation = this.projetService.updateProjetMutation();
  deleteMutation = this.projetService.deleteProjetMutation();

  // Computed filtered projects based on query data
  filteredProjects = computed(() => {
    const projects = this.projetsQuery.data() || [];
    const sorted = sortByRank(
      projects,
      (p) => p.rank,
      (a, b) => a.nom_projet.localeCompare(b.nom_projet)
    );

    const search = this.searchQuery();
    const status = this.statusFilter();

    return sorted.filter((projet) => {
      const matchesSearch =
        !search ||
        projet.nom_projet.toLowerCase().includes(search.toLowerCase()) ||
        projet.code_projet.toLowerCase().includes(search.toLowerCase()) ||
        (projet.reference_externe && projet.reference_externe.toLowerCase().includes(search.toLowerCase())) ||
        (projet.description && projet.description.toLowerCase().includes(search.toLowerCase())) ||
        (projet.chef_projet && projet.chef_projet.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = status.length === 0 || status.includes(projet.statut);

      return matchesSearch && matchesStatus;
    });
  });

  private externalReferenceUrlQuery = this.settingsService.getSettingQuery("external_reference_url", "global");
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);

  showProjectModal = false;
  activeMenuId: string | null = null;
  showChiffresModal: boolean = false;
  selectedProjetId: number | null = null;

  newProjet: Partial<Projet> = {
    code_projet: "",
    nom_projet: "",
    statut: "En cours",
    description: "",
    reference_externe: "",
    color: "#3b82f6",
  };

  // Confirm Modal state
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmIcon = 'alert-triangle';
  confirmLabel = 'Confirmer';
  confirmVariant: 'danger' | 'primary' = 'danger';
  showCancelButton = true;
  private pendingConfirmAction: (() => void) | null = null;

  showExportMenu = false;


  constructor(
    private projetService: ProjetService,
    private settingsService: SettingsService,
    private route: ActivatedRoute
  ) { }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Close menu when clicking outside
    if (this.activeMenuId) {
      this.activeMenuId = null;
    }
    this.showExportMenu = false;

    // Close status dropdown if clicked outside
    if (!target.closest('.status-dropdown-container')) {
      this.showStatusDropdown = false;
    }
  }

  toggleMenu(event: MouseEvent, projetId: string) {
    event.stopPropagation();
    if (this.activeMenuId === projetId) {
      this.activeMenuId = null;
    } else {
      this.activeMenuId = projetId;
    }
  }

  async ngOnInit() {
    // Read query params for status filter
    this.route.queryParams.subscribe(params => {
      if (params['status']) {
        this.statusFilter.set([params['status']]);
      }
    });
  }

  toggleStatusDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showStatusDropdown = !this.showStatusDropdown;
  }

  toggleStatusSelection(status: string) {
    const current = this.statusFilter();
    if (current.includes(status)) {
      this.statusFilter.set(current.filter(x => x !== status));
    } else {
      this.statusFilter.set([...current, status]);
    }
  }

  isStatusSelected(status: string): boolean {
    return this.statusFilter().includes(status);
  }

  getStatusFilterLabel(): string {
    const current = this.statusFilter();
    if (current.length === 0) {
      return "Tous les statuts";
    }
    if (current.length === 1) {
      return current[0];
    }
    return `${current.length} statuts`;
  }

  clearStatusFilter() {
    this.statusFilter.set([]);
  }

  setViewMode(mode: "list" | "card" | "table") {
    this.viewMode.set(mode);
  }

  async drop(event: CdkDragDrop<Projet[]>) {
    const projects = [...this.filteredProjects()];
    // Move in local array first to correctly calculate rank neighbors
    moveItemInArray(projects, event.previousIndex, event.currentIndex);

    const movedItem = projects[event.currentIndex];
    if (!movedItem) return;

    try {
      const rankStr = calculateNewRank(
        projects,
        event.currentIndex,
        (p) => p.rank
      );

      // Perform optimistic update via mutation
      // The Service handles updating the cache immediately, which drives this.filteredProjects()
      this.updateMutation.mutate({
        id: movedItem.id!,
        projet: { rank: rankStr }
      });

    } catch (error) {
      console.error('Error calculating rank:', error);
    }
  }




  getProgressPercent(projet: Projet): number {
    if (projet.chiffrage_previsionnel === 0) return 0;
    const percent = (projet.temps_consomme / projet.chiffrage_previsionnel) * 100;
    return Math.min(Math.round(percent), 100);
  }

  calculateRAF(projet: Projet): number {
    return this.projetService.calculateRAF(projet);
  }

  openCreateModal() {
    this.newProjet = {
      code_projet: "",
      nom_projet: "",
      statut: "En cours",
      description: "",
      reference_externe: "",
      color: "#3b82f6",
    };
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  openEditModal(projet: Projet) {
    this.newProjet = { ...projet };
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  duplicateProjet(projet: Projet) {
    console.log("PROJET Origine : ", projet);

    // Destructure pour exclure les propriétés à ne pas copier
    const { id, created_at, updated_at, id_projet, ...restProjet } = projet;

    // Trouver le prochain id_projet (max + 1) from query data
    const projects = this.projetsQuery.data() || [];
    const maxId = projects.reduce((max: number, p: Projet) => (p.id_projet > max ? p.id_projet : max), 0);

    this.newProjet = {
      ...restProjet,
      id_projet: maxId + 1,
      code_projet: `${projet.code_projet}-COPY`,
      nom_projet: `${projet.nom_projet} (Copie)`,
    };

    console.log("PROJET Copie : ", this.newProjet);
    this.showProjectModal = true;
    this.activeMenuId = null;
  }

  closeModal() {
    this.showProjectModal = false;
  }

  onProjectSaved() {
    // No need to manually reload - mutations auto-invalidate cache!
    this.closeModal();
  }

  deleteProjet(projet: Projet) {
    this.activeMenuId = null;
    this.confirmTitle = "Supprimer le projet";
    this.confirmMessage = `Êtes-vous sûr de vouloir supprimer le projet "${projet.nom_projet}" ?`;
    this.confirmIcon = 'alert-triangle';
    this.confirmLabel = 'Supprimer';
    this.confirmVariant = 'danger';
    this.showCancelButton = true;

    this.pendingConfirmAction = async () => {
      try {
        // Use legacy method for now (mutations will auto-invalidate cache)
        await this.projetService.deleteProjet(projet.id!);
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    };
    this.showConfirmModal = true;
  }

  async onConfirmAction() {
    if (this.pendingConfirmAction) {
      await this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
  }

  // méthodes pour la gestion des chiffres d'un projet

  openChiffresModal(idProjet: number) {
    this.selectedProjetId = idProjet;
    this.showChiffresModal = true;
    this.activeMenuId = null;
  }

  closeChiffresModal() {
    this.showChiffresModal = false;
  }

  onChiffresModalSaved(chiffres: Chiffre[]) {
    console.log("Chiffres sauvegardés:", chiffres);
  }

  // --- Excel Export ---

  exportToExcel(mode: 'all' | 'filtered') {
    this.showExportMenu = false;
    const projects = mode === 'filtered' ? this.filteredProjects() : (this.projetsQuery.data() || []);

    const data = projects.map(p => ({
      'Code Projet': p.code_projet,
      'Nom Projet': p.nom_projet,
      'Statut': p.statut,
      'Description': p.description || '',
      'Référence Externe': p.reference_externe || '',
      'Chef de Projet': p.chef_projet || '',
      'Couleur': p.color || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projets');

    const fileName = `Export_Projets_${mode === 'filtered' ? 'Filtrés_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // --- Excel Import ---

  triggerImport() {
    const fileInput = document.getElementById('excel-import-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  async importFromExcel(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr = e.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      this.processImportData(data);
      // Reset input
      event.target.value = '';
    };
    reader.readAsBinaryString(file);
  }

  private async processImportData(data: any[]) {
    const existingProjects = this.projetsQuery.data() || [];
    const errors: string[] = [];
    const projectsToCreate: Partial<Projet>[] = [];

    // Map headers to fields (handles potential variation in headers)
    const headerMap: { [key: string]: string } = {
      'Code Projet': 'code_projet',
      'Nom Projet': 'nom_projet',
      'Statut': 'statut',
      'Description': 'description',
      'Référence Externe': 'reference_externe',
      'Chef de Projet': 'chef_projet',
      'Couleur': 'color'
    };

    const mandatoryHeaders = ['Code Projet', 'Nom Projet'];
    const fileHeaders = data.length > 0 ? Object.keys(data[0]) : [];
    const missingHeaders = mandatoryHeaders.filter(h => !fileHeaders.includes(h));

    if (missingHeaders.length > 0) {
      this.confirmTitle = "En-têtes manquants";
      let message = `Le fichier Excel doit contenir les colonnes obligatoires suivantes : ${mandatoryHeaders.join(', ')}.\n\n`;
      message += `Colonnes manquantes détectées : ${missingHeaders.join(', ')}.\n\n`;
      message += `Colonnes possibles : ${Object.keys(headerMap).join(', ')} (pour la couleur, utilisez le format Hexa #000000).`;
      
      this.confirmMessage = message;
      this.confirmIcon = 'alert-circle';
      this.confirmLabel = 'Fermer';
      this.confirmVariant = 'danger';
      this.showCancelButton = false;
      this.showConfirmModal = true;
      return;
    }

    data.forEach((row, index) => {
      const lineNum = index + 2; // +1 for 1-based index, +1 for header row
      const project: any = {};

      // Normalize row keys and map them
      Object.keys(row).forEach(key => {
        const mappedKey = headerMap[key];
        if (mappedKey) {
          project[mappedKey] = row[key];
        }
      });

      if (!project.code_projet && !project.nom_projet) {
        errors.push(`Ligne ${lineNum}: Le Code Projet et le Nom Projet sont manquants`);
        return;
      }
      if (!project.code_projet) {
        errors.push(`Ligne ${lineNum}: Le Code Projet est manquant`);
        return;
      }
      if (!project.nom_projet) {
        errors.push(`Ligne ${lineNum}: Le Nom Projet est manquant`);
        return;
      }

      // Check duplicates in existing data
      const duplicateCode = existingProjects.find(p => p.code_projet === project.code_projet);
      if (duplicateCode) {
        errors.push(`Ligne ${lineNum}: Le Code Projet "${project.code_projet}" existe déjà`);
      }

      if (project.reference_externe) {
        const duplicateRef = existingProjects.find(p => p.reference_externe === project.reference_externe);
        if (duplicateRef) {
          errors.push(`Ligne ${lineNum}: La Référence externe "${project.reference_externe}" existe déjà`);
        }
      }

      // Check duplicates within the import file itself
      const internalDuplicateCode = projectsToCreate.find(p => p.code_projet === project.code_projet);
      if (internalDuplicateCode) {
         errors.push(`Ligne ${lineNum}: Le Code Projet "${project.code_projet}" est présent plusieurs fois dans le fichier`);
      }

      if (project.reference_externe) {
        const internalDuplicateRef = projectsToCreate.find(p => p.reference_externe === project.reference_externe);
        if (internalDuplicateRef) {
           errors.push(`Ligne ${lineNum}: La Référence externe "${project.reference_externe}" est présente plusieurs fois dans le fichier`);
        }
      }

      projectsToCreate.push({
        ...project,
        statut: project.statut || 'En cours',
        color: project.color || '#3b82f6'
      });
    });

    if (errors.length > 0) {
      this.showImportError(errors);
      return;
    }

    // No errors, show confirmation
    this.confirmTitle = "Confirmer l'import";
    this.confirmMessage = `Le fichier contient ${projectsToCreate.length} projet(s) prêt(s) à être importé(s).\n\nVoulez-vous lancer l'importation ?`;
    this.confirmIcon = 'file-down';
    this.confirmLabel = "Importer";
    this.confirmVariant = 'primary';
    this.showCancelButton = true;
    
    this.pendingConfirmAction = async () => {
      try {
        // Find max id_projet
        let maxId = existingProjects.reduce((max: number, p: Projet) => (p.id_projet > max ? p.id_projet : max), 0);

        // We need to create them one by one or via a bulk insert in the service
        for (const p of projectsToCreate) {
          maxId++;
          const newProj = { ...p, id_projet: maxId };
          await this.projetService.createProjet(newProj);
        }
      } catch (error) {
        console.error("Erreur lors de l'import :", error);
        this.confirmTitle = "Erreur d'import";
        this.confirmMessage = "Une erreur est survenue lors de l'enregistrement des projets.";
        this.confirmIcon = 'alert-circle';
        this.confirmLabel = 'Fermer';
        this.confirmVariant = 'danger';
        this.showCancelButton = false;
        this.showConfirmModal = true;
      }
    };
    this.showConfirmModal = true;
  }

  private showImportError(errors: string[]) {
    this.confirmTitle = "Import KO";
    const first3 = errors.slice(0, 3);
    let message = `L'import a été annulé car des doublons ou des erreurs ont été détectés :\n\n`;
    message += first3.join('\n');
    if (errors.length > 3) {
      message += `\n... et ${errors.length - 3} autres erreurs.`;
    }

    this.confirmMessage = message;
    this.confirmIcon = 'alert-circle';
    this.confirmLabel = 'Fermer';
    this.confirmVariant = 'danger';
    this.showCancelButton = false;
    this.pendingConfirmAction = null;
    this.showConfirmModal = true;
  }
}
