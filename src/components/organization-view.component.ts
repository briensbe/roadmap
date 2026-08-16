import { Component, OnInit, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Building2,
  Layers,
  Box,
  Users,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Plus,
} from 'lucide-angular';
import { ResourceService } from '../services/resource.service';
import { Societe, Departement, Service, Equipe } from '../models/types';
import { ConfirmModalComponent } from './confirm-modal.component';

@NgModule({
  imports: [LucideAngularModule.pick({ Building2, Layers, Box, Users, ChevronRight, ChevronDown, MoreVertical, Plus })],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

interface FormData {
  nom: string;
  code: string;
  color: string;
  societe_id: string;
  departement_id: string;
  service_id: string;
  parentType: 'service' | 'departement';
  parentId: string;
}

interface OrgNode {
  type: 'societe' | 'departement' | 'service' | 'equipe';
  id: string;
  nom: string;
  code?: string;
  color?: string;
  originalData: any;
  children: OrgNode[];
  expanded: boolean;
  level: number;
  parentId?: string;
}

@Component({
  selector: 'app-organization-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule, ConfirmModalComponent],
  templateUrl: './organization-view.component.html',
  styleUrl: './organization-view.component.css',
})
export class OrganizationViewComponent implements OnInit {
  societes: Societe[] = [];
  departements: Departement[] = [];
  services: Service[] = [];
  equipes: Equipe[] = [];

  orgTree: OrgNode[] = [];

  showCreateModal = false;
  showEditModal = false;
  createModalType: 'societe' | 'departement' | 'service' | 'equipe' | null = null;
  editingNode: OrgNode | null = null;
  activeMenuId: string | null = null;
  showAddDropdown = false;

  formData: FormData = {
    nom: '',
    code: '',
    color: '#3b82f6',
    societe_id: '',
    departement_id: '',
    service_id: '',
    parentType: 'service',
    parentId: '',
  };

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

  isCustomColor = false;

  // Confirm Modal state
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingConfirmAction: (() => void) | null = null;

  onConfirmAction() {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
    this.showConfirmModal = false;
  }

  selectColor(color: string) {
    this.formData.color = color;
    this.isCustomColor = false;
  }

  constructor(private resourceService: ResourceService) {
    // click outside to close menu
    window.addEventListener('click', () => {
      this.activeMenuId = null;
      this.showAddDropdown = false;
    });
  }

  toggleAddDropdown() {
    this.showAddDropdown = !this.showAddDropdown;
  }

  selectAddOption(type: 'societe' | 'departement' | 'service' | 'equipe') {
    this.showAddDropdown = false;
    this.openCreateModal(type);
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.societes = await this.resourceService.getAllSocietes();
      this.departements = await this.resourceService.getAllDepartements();
      this.services = await this.resourceService.getAllServices();
      this.equipes = await this.resourceService.getAllEquipes();
      this.buildOrgTree();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  buildOrgTree() {
    this.orgTree = this.societes.map((s) => {
      // Find departements for this societe
      const sDepts = this.departements.filter((d) => d.societe_id === s.id);

      const deptNodes: OrgNode[] = sDepts.map((d) => {
        // Find services for this departement
        const dServices = this.services.filter((srv) => srv.departement_id === d.id);

        const serviceNodes: OrgNode[] = dServices.map((srv) => {
          const sEquipes = this.equipes.filter((e) => e.service_id === srv.id);
          return {
            type: 'service',
            id: srv.id!,
            nom: srv.nom,
            code: srv.code,
            color: srv.color,
            originalData: srv,
            children: sEquipes.map((e) => ({
              type: 'equipe',
              id: e.id!,
              nom: e.nom,
              code: e.code,
              color: e.color,
              originalData: e,
              children: [],
              expanded: false,
              level: 3,
              parentId: srv.id,
            })),
            expanded: false,
            level: 2,
            parentId: d.id,
          };
        });

        // Also find equipes attached to department (if any)
        const dDirectEquipes = this.equipes.filter((e) => e.departement_id === d.id);
        const equipeNodes: OrgNode[] = dDirectEquipes.map((e) => ({
          type: 'equipe',
          id: e.id!,
          nom: e.nom,
          code: e.code,
          color: e.color,
          originalData: e,
          children: [],
          expanded: false,
          level: 2, // Same level as Service if direct child of Dept
          parentId: d.id,
        }));

        return {
          type: 'departement',
          id: d.id!,
          nom: d.nom,
          code: d.code,
          color: d.color,
          originalData: d,
          children: [...serviceNodes, ...equipeNodes],
          expanded: false,
          level: 1,
          parentId: s.id,
        };
      });

      return {
        type: 'societe',
        id: s.id!,
        nom: s.nom,
        code: s.code,
        color: s.color || '#3b82f6',
        originalData: s,
        children: deptNodes,
        expanded: false,
        level: 0,
      };
    });
  }

  toggleNode(node: OrgNode) {
    node.expanded = !node.expanded;
  }

  toggleMenu(node: OrgNode, event: Event) {
    event.stopPropagation();
    if (this.activeMenuId === node.id) {
      this.activeMenuId = null;
    } else {
      this.activeMenuId = node.id;
    }
  }

  openCreateModal(type: 'societe' | 'departement' | 'service' | 'equipe') {
    this.createModalType = type;
    this.showCreateModal = true;
    this.showEditModal = false;
    this.formData = {
      nom: '',
      code: '',
      color: '#3b82f6',
      societe_id: '',
      departement_id: '',
      service_id: '',
      parentType: 'service',
      parentId: '',
    };

    // Set default parents if possible (e.g. first one)
    if (type === 'departement' && this.societes.length > 0) this.formData.societe_id = this.societes[0].id ?? '';
    if (type === 'service' && this.departements.length > 0)
      this.formData.departement_id = this.departements[0].id ?? '';
    if (type === 'equipe') {
      if (this.services.length > 0) {
        this.formData.parentType = 'service';
        this.formData.parentId = this.services[0].id ?? '';
      } else if (this.departements.length > 0) {
        this.formData.parentType = 'departement';
        this.formData.parentId = this.departements[0].id ?? '';
      }
    }
  }

  openEditModal(node: OrgNode) {
    this.editingNode = node;
    this.createModalType = null;
    this.showEditModal = true;
    this.showCreateModal = false;
    this.activeMenuId = null; // close menu

    this.formData = { ...node.originalData };
    this.isCustomColor = !this.predefinedColors.includes(this.formData.color);

    // Special handling for Equipe parent
    if (node.type === 'equipe') {
      if (node.originalData.service_id) {
        this.formData.parentType = 'service';
        this.formData.parentId = node.originalData.service_id ?? '';
      } else if (node.originalData.departement_id) {
        this.formData.parentType = 'departement';
        this.formData.parentId = node.originalData.departement_id ?? '';
      }
    }
  }

  closeModals() {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.createModalType = null;
    this.editingNode = null;
  }

  getModalTitleType() {
    const type = this.showEditModal ? this.editingNode?.type : this.createModalType;
    switch (type) {
      case 'societe':
        return 'une Société';
      case 'departement':
        return 'un Département';
      case 'service':
        return 'un Service';
      case 'equipe':
        return 'une Équipe';
      default:
        return '';
    }
  }

  async handleCreate() {
    try {
      if (this.createModalType === 'societe') {
        const payload: Partial<Societe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        await this.resourceService.createSociete(payload);
      } else if (this.createModalType === 'departement') {
        const payload: Partial<Departement> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          societe_id: this.formData.societe_id,
        };
        await this.resourceService.createDepartement(payload);
      } else if (this.createModalType === 'service') {
        const payload: Partial<Service> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          departement_id: this.formData.departement_id,
        };
        await this.resourceService.createService(payload);
      } else if (this.createModalType === 'equipe') {
        const payload: Partial<Equipe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        if (this.formData.parentType === 'service') {
          payload.service_id = this.formData.parentId;
        } else if (this.formData.parentType === 'departement') {
          payload.departement_id = this.formData.parentId;
        }

        await this.resourceService.createEquipe(payload);
      }
      this.closeModals();
      await this.loadData();
    } catch (error) {
      console.error('Error creating:', error);
    }
  }

  async handleUpdate() {
    if (!this.editingNode) return;
    try {
      const id = this.editingNode.id;
      if (this.editingNode.type === 'societe') {
        const payload: Partial<Societe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        await this.resourceService.updateSociete(id, payload);
      } else if (this.editingNode.type === 'departement') {
        const payload: Partial<Departement> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          societe_id: this.formData.societe_id,
        };
        await this.resourceService.updateDepartement(id, payload);
      } else if (this.editingNode.type === 'service') {
        const payload: Partial<Service> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          departement_id: this.formData.departement_id,
        };
        await this.resourceService.updateService(id, payload);
      } else if (this.editingNode.type === 'equipe') {
        const payload: Partial<Equipe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        if (this.formData.parentType === 'service') {
          payload.service_id = this.formData.parentId;
        } else if (this.formData.parentType === 'departement') {
          payload.departement_id = this.formData.parentId;
        }
        await this.resourceService.updateEquipe(id, payload);
      }
      this.closeModals();
      await this.loadData();
    } catch (error) {
      console.error('Error updating:', error);
    }
  }

  async handleDelete(node: OrgNode) {
    this.confirmTitle = "Supprimer l'élément";
    this.confirmMessage = `Êtes-vous sûr de vouloir supprimer ${node.nom} ?`;

    this.pendingConfirmAction = async () => {
      try {
        if (node.type === 'societe') {
          await this.resourceService.deleteSociete(node.id);
        } else if (node.type === 'departement') {
          await this.resourceService.deleteDepartement(node.id);
        } else if (node.type === 'service') {
          await this.resourceService.deleteService(node.id);
        } else if (node.type === 'equipe') {
          await this.resourceService.deleteEquipe(node.id);
        }
        this.activeMenuId = null;
        await this.loadData();
      } catch (error) {
        console.error('Error deleting:', error);
      }
    };
    this.showConfirmModal = true;
  }
}
