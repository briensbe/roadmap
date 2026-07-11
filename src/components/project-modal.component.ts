import { Component, Input, Output, EventEmitter, OnInit, HostListener, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../services/projet.service';
import { SettingsService } from '../services/settings.service';
import { Projet, PROJECT_STATUS_LIST } from '../models/types';
import { LucideAngularModule, Plus, ExternalLink, LucideCalculator } from 'lucide-angular';
import { ProjectJsonImportComponent } from './project-json-import.component';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ProjectJsonImportComponent],
  templateUrl: './project-modal.component.html',
  styleUrl: './project-modal.component.css',
})
export class ProjectModalComponent implements OnInit {
  @Input() projet: Partial<Projet> | null = null;
  @Output() saved = new EventEmitter<Projet>();
  @Output() closed = new EventEmitter<void>();
  @Output() openChiffres = new EventEmitter<string>();

  editableProjet: Partial<Projet> = {};
  isSaving = false;
  private externalReferenceUrlQuery = this.settingsService.getSettingQuery('external_reference_url', 'global');
  externalReferenceUrl = computed(() => this.externalReferenceUrlQuery.data()?.value || null);
  isCustomColor = false;
  formErrors = { nom_projet: false };

  private projectsQuery = this.projetService.getAllProjetsQuery();
  allProjects = computed(() => this.projectsQuery.data() || []);

  codeProjetSignal = signal('');
  referenceExterneSignal = signal('');

  similarProjects = computed(() => {
    // Si on édite un projet déjà existant, on n'affiche la section similaire que si le code ou la ref externe a été modifié
    if (this.projet?.id) {
      const initialCode = (this.projet.code_projet || '').trim().toLowerCase();
      const currentCode = this.codeProjetSignal().trim().toLowerCase();
      const initialRef = (this.projet.reference_externe || '').trim().toLowerCase();
      const currentRef = this.referenceExterneSignal().trim().toLowerCase();

      const isCodeModified = initialCode !== currentCode;
      const isRefModified = initialRef !== currentRef;

      if (!isCodeModified && !isRefModified) {
        return [];
      }
    }

    const codeInput = this.codeProjetSignal().trim().toLowerCase();
    const refInput = this.referenceExterneSignal().trim().toLowerCase();

    if (!codeInput && !refInput) {
      return [];
    }

    const cleanStr = (s: string | null | undefined) => (s || '').trim().toLowerCase();

    return this.allProjects().filter(p => {
      // Ne pas se comparer à soi-même
      if (this.projet?.id && p.id === this.projet.id) return false;

      const dbCode = cleanStr(p.code_projet);
      const dbRef = cleanStr(p.reference_externe);

      const codeMatch = codeInput && dbCode && (
        codeInput === dbCode || 
        codeInput.endsWith('-' + dbCode) || 
        dbCode.endsWith('-' + codeInput)
      );

      const refMatch = refInput && dbRef && (
        refInput === dbRef || 
        refInput.endsWith('-' + dbRef) || 
        dbRef.endsWith('-' + refInput)
      );

      return codeMatch || refMatch;
    });
  });

  predefinedColors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
  ];

  readonly PROJECT_STATUTS = PROJECT_STATUS_LIST;
  private isMouseDownOnOverlay = false;

  constructor(
    private projetService: ProjetService,
    private settingsService: SettingsService,
  ) {}

  async ngOnInit() {
    this.editableProjet = this.projet
      ? { ...this.projet }
      : {
          code_projet: '',
          nom_projet: '',
          statut: 'En cours',
          description: '',
          reference_externe: '',
          color: '#3b82f6',
        };

    this.isCustomColor = this.editableProjet.color ? !this.predefinedColors.includes(this.editableProjet.color) : false;

    // Initialiser les signaux
    this.codeProjetSignal.set(this.editableProjet.code_projet || '');
    this.referenceExterneSignal.set(this.editableProjet.reference_externe || '');
  }

  get ngModelColor(): string {
    return this.editableProjet.color || '';
  }

  set ngModelColor(val: string) {
    this.editableProjet.color = val;
  }

  onColorHexChange(val: string) {
    if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
      this.editableProjet.color = val;
    }
  }

  selectColor(color: string) {
    this.editableProjet.color = color;
    this.isCustomColor = false;
  }

  onOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.isMouseDownOnOverlay = true;
    }
  }

  @HostListener('window:keydown.control.enter')
  handleCtrlEnter() {
    if (!this.isSaving) {
      this.save();
    }
  }

  @HostListener('window:keydown.escape')
  handleEscape() {
    this.close();
  }

  onOverlayMouseUp(event: MouseEvent) {
    if (this.isMouseDownOnOverlay && event.target === event.currentTarget) {
      this.close();
    }
    this.isMouseDownOnOverlay = false;
  }

  close() {
    this.closed.emit();
  }

  onOpenChiffres(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (this.editableProjet.id) {
      this.openChiffres.emit(this.editableProjet.id);
    }
  }

  async save() {
    if (!this.editableProjet.nom_projet || this.editableProjet.nom_projet.trim() === '') {
      this.formErrors.nom_projet = true;
      return;
    }

    this.isSaving = true;
    try {
      let savedProject: Projet;
      if (this.editableProjet.id) {
        savedProject = await this.projetService.updateProjet(this.editableProjet.id, this.editableProjet);
      } else {
        savedProject = await this.projetService.createProjet(this.editableProjet);
      }
      this.saved.emit(savedProject);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      this.isSaving = false;
    }
  }

  onJsonImported(data: any) {
    this.editableProjet = {
      ...this.editableProjet,
      reference_externe: data.reference_externe || this.editableProjet.reference_externe,
      nom_projet: data.nom_projet || this.editableProjet.nom_projet,
      chef_projet: data.chef_projet || this.editableProjet.chef_projet,
      description: data.description || this.editableProjet.description,
      code_projet: data.code_projet || this.editableProjet.code_projet,
    };
    this.codeProjetSignal.set(this.editableProjet.code_projet || '');
    this.referenceExterneSignal.set(this.editableProjet.reference_externe || '');
    this.formErrors.nom_projet = false;
  }

  Plus = Plus;
  ExternalLink = ExternalLink;
  LucideCalculator = LucideCalculator;
}
