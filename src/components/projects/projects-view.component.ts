import { Component, OnInit, HostListener, ElementRef, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { ProjetService } from "../../services/projet.service";
import { SettingsService } from "../../services/settings.service";
import { Projet } from "../../models/types";
import { ChiffresModalComponent } from "../chiffres/chiffres-modal.component";
import { Chiffre } from "../../models/chiffres.type";
import { LucideAngularModule, Plus, LucideCalculator, MoreVertical, Edit, Trash2, Copy, ExternalLink } from "lucide-angular";
import { ConfirmModalComponent } from "../confirm-modal.component";
import { ProjectModalComponent } from "../project-modal.component";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { calculateNewRank, sortByRank } from "../../utils/lexorank.utils";

@Component({
  selector: "app-projects-view",
  standalone: true,
  imports: [CommonModule, FormsModule, ChiffresModalComponent, LucideAngularModule, ConfirmModalComponent, ProjectModalComponent, DragDropModule],
  templateUrl: "./projects-view.component.html",
  styleUrl: "./projects-view.component.css"
})
export class ProjectsViewComponent implements OnInit {
  viewMode: "list" | "card" = "list";
  searchQuery = signal("");
  statusFilter = signal("");

  LucideCalculator = LucideCalculator;
  MoreVertical = MoreVertical;
  Edit = Edit;
  Trash2 = Trash2;
  Copy = Copy;
  ExternalLink = ExternalLink;
  Plus = Plus;

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

      const matchesStatus = !status || projet.statut === status;

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
  private pendingConfirmAction: (() => void) | null = null;


  constructor(
    private projetService: ProjetService,
    private settingsService: SettingsService,
    private route: ActivatedRoute
  ) { }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    // Close menu when clicking outside
    if (this.activeMenuId) {
      this.activeMenuId = null;
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
        this.statusFilter.set(params['status']);
      }
    });
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
}
