import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResourceService } from '../services/resource.service';
import { Societe, Departement, Service, Equipe } from '../models/types';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="organization-view">
      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <div class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3b82f6"/>
              <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="#3b82f6" opacity="0.6"/>
            </svg>
            <span class="logo-text">ResourceFlow</span>
          </div>
        </div>
        <div class="header-right">
          <button class="header-btn" (click)="openCreateModal('societe')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
              <path d="M10 6h4"/>
              <path d="M10 10h4"/>
              <path d="M10 14h4"/>
              <path d="M10 18h4"/>
            </svg>
            Société
          </button>
          <button class="header-btn" (click)="openCreateModal('departement')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12.83 2.12 6 3.06a3.5 3.5 0 0 1 0 6.33l-6 3.05a3.5 3.5 0 0 1-3.66 0l-6-3.05a3.5 3.5 0 0 1 0-6.33l6-3.06a3.5 3.5 0 0 1 1.66 0Z"/>
              <path d="m22 12-7.44 3.78c-1.6.8-4.52.8-6.12 0L1 12"/>
              <path d="m22 17-7.44 3.78c-1.6.8-4.52.8-6.12 0L1 17"/>
            </svg>
            Département
          </button>
          <button class="header-btn" (click)="openCreateModal('service')">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
            </svg>
            Service
          </button>
          <button class="header-btn" (click)="openCreateModal('equipe')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Équipe
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main-content">
        <h1 class="page-title">Organisation</h1>
        <p class="page-subtitle">Structurez votre organisation</p>

        <!-- Organization Structure Section -->
        <section class="org-structure">
          <div class="tree-container">
            <!-- Recursive Tree Rendering -->
            <ng-container *ngFor="let node of orgTree">
              <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node }"></ng-container>
            </ng-container>
          </div>
        </section>
      </main>

      <!-- Modal Overlay -->
      <div class="modal-overlay" *ngIf="showCreateModal || showEditModal" (click)="closeModals()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2 class="modal-title">
            {{ showEditModal ? 'Modifier' : 'Créer' }}
            {{ getModalTitleType() }}
          </h2>

          <div class="form-group">
            <label>Nom</label>
            <input type="text" [(ngModel)]="formData.nom" placeholder="Nom">
          </div>

          <div class="form-group">
            <label>Code</label>
            <input type="text" [(ngModel)]="formData.code" placeholder="Code (e.g. CAT)">
          </div>

          <div class="form-group">
            <label>Couleur</label>
            <input type="color" [(ngModel)]="formData.color" class="color-input">
          </div>

          <!-- Parent Selectors based on type -->
          <div class="form-group" *ngIf="(createModalType === 'departement') || (editingNode?.type === 'departement')">
             <label>Société de rattachement</label>
             <select [(ngModel)]="formData.societe_id">
               <option *ngFor="let s of societes" [value]="s.id">{{ s.nom }}</option>
             </select>
          </div>

          <div class="form-group" *ngIf="(createModalType === 'service') || (editingNode?.type === 'service')">
             <label>Département de rattachement</label>
             <select [(ngModel)]="formData.departement_id">
               <option *ngFor="let d of departements" [value]="d.id">{{ d.nom }}</option>
             </select>
          </div>

          <div class="form-group" *ngIf="(createModalType === 'equipe') || (editingNode?.type === 'equipe')">
             <label>Rattachement (Service ou Département)</label>
             <select [(ngModel)]="formData.parentType" (change)="formData.parentId = ''">
               <option value="service" selected>Service</option>
               <option value="departement">Département</option>
             </select>
          </div>

           <div class="form-group" *ngIf="((createModalType === 'equipe') || (editingNode?.type === 'equipe')) && formData.parentType === 'service'">
             <label>Service</label>
             <select [(ngModel)]="formData.parentId">
               <option *ngFor="let s of services" [value]="s.id">{{ s.nom }}</option>
             </select>
          </div>

          <div class="form-group" *ngIf="((createModalType === 'equipe') || (editingNode?.type === 'equipe')) && formData.parentType === 'departement'">
             <label>Département</label>
             <select [(ngModel)]="formData.parentId">
               <option *ngFor="let d of departements" [value]="d.id">{{ d.nom }}</option>
             </select>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" (click)="closeModals()">Annuler</button>
            <button class="btn-confirm" (click)="showEditModal ? handleUpdate() : handleCreate()">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- Recursive Node Template -->
      <ng-template #nodeTemplate let-node>
        <div class="tree-node" [style.padding-left.px]="node.level * 32">
          
          <!-- Expand/Collapse Icon -->
          <div class="toggle-icon" (click)="toggleNode(node)" [class.hidden]="node.children.length === 0">
            <svg *ngIf="!node.expanded" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <svg *ngIf="node.expanded" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
           <!-- Spacer for leaves -->
           <div class="toggle-placeholder" *ngIf="node.children.length === 0"></div>

          <!-- Type Icon -->
          <div class="node-icon" [ngClass]="node.type" [style.background-color]="node.type === 'societe' ? node.color : ''" [style.color]="node.type === 'societe' ? '#fff' : ''">
             <!-- Building for Societe -->
             <svg *ngIf="node.type === 'societe'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
               <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
               <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
               <path d="M10 6h4"/>
               <path d="M10 10h4"/>
               <path d="M10 14h4"/>
               <path d="M10 18h4"/>
             </svg>

             <!-- Layers for Department -->
             <svg *ngIf="node.type === 'departement'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12.83 2.12 6 3.06a3.5 3.5 0 0 1 0 6.33l-6 3.05a3.5 3.5 0 0 1-3.66 0l-6-3.05a3.5 3.5 0 0 1 0-6.33l6-3.06a3.5 3.5 0 0 1 1.66 0Z"/>
              <path d="m22 12-7.44 3.78c-1.6.8-4.52.8-6.12 0L1 12"/>
              <path d="m22 17-7.44 3.78c-1.6.8-4.52.8-6.12 0L1 17"/>
             </svg>

             <!-- Settings/Cog for Service -->
              <svg *ngIf="node.type === 'service'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="12" cy="12" r="3"/>
               <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
             </svg>

             <!-- Users for Team -->
             <svg *ngIf="node.type === 'equipe'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
             </svg>
          </div>

          <div class="node-info">
            <span class="node-name">{{ node.nom }}</span>
            <span class="node-code" *ngIf="node.code">({{ node.code }})</span>
          </div>

          <!-- Kebab Menu -->
          <div class="kebab-menu-container" (click)="$event.stopPropagation()">
            <button class="kebab-btn" (click)="toggleMenu(node, $event)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            <div class="menu-dropdown" *ngIf="activeMenuId === node.id">
              <button (click)="openEditModal(node)">Modifier</button>
              <button (click)="handleDelete(node)" class="delete-btn">Supprimer</button>
            </div>
          </div>
        </div>

        <!-- Children -->
        <ng-container *ngIf="node.expanded">
           <ng-container *ngFor="let child of node.children">
              <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: child }"></ng-container>
           </ng-container>
        </ng-container>
      </ng-template>

    </div>
  `,
  styles: [`
    .organization-view { min-height: 100vh; background: #f3f4f6; font-family: 'Inter', sans-serif; }
    
    /* Header */
    .header { background: white; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; }
    .header-left { display: flex; align-items: center; gap: 24px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-text { font-size: 20px; font-weight: 700; color: #111827; }
    .header-right { display: flex; gap: 12px; }
    .header-btn { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: #374151; transition: all 0.2s; }
    .header-btn:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }
    
    /* Main Content */
    .main-content { max-width: 1200px; margin: 0 auto; padding: 32px; }
    .page-title { font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-subtitle { font-size: 14px; color: #6b7280; margin: 0 0 32px 0; }
    
    /* Organization Tree */
    .org-structure { background: transparent; }
    .tree-container { display: flex; flex-direction: column; gap: 4px; }
    
    .tree-node { 
      display: flex; align-items: center; padding: 8px 12px; background: white; border-radius: 8px; 
      border: 1px solid transparent; transition: all 0.2s; position: relative;
    }
    .tree-node:hover { background: #f9fafb; border-color: #e5e7eb; }
    
    .toggle-icon { cursor: pointer; color: #9ca3af; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 8px; border-radius: 4px; }
    .toggle-icon:hover { background: #e5e7eb; color: #4b5563; }
    .toggle-placeholder { width: 32px; }
    
    .node-icon { 
      width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; 
      background: #f3f4f6; color: #6b7280; flex-shrink: 0;
    }
    .node-icon.societe { /* Custom color applied inline */ }
    
    .node-info { flex: 1; display: flex; align-items: baseline; gap: 8px; }
    .node-name { font-weight: 600; color: #111827; font-size: 15px; }
    .node-code { font-size: 12px; color: #6b7280; font-weight: 500; }
    
    /* Kebab Menu */
    .kebab-menu-container { position: relative; }
    .kebab-btn { 
      background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 4px; color: #9ca3af; display: flex;
      opacity: 0; transition: opacity 0.2s;
    }
    .tree-node:hover .kebab-btn { opacity: 1; }
    .kebab-btn:hover { background: #e5e7eb; color: #4b5563; }
    
    .menu-dropdown {
      position: absolute; right: 0; top: 100%; background: white; border: 1px solid #e5e7eb; border-radius: 8px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); py: 4px; min-width: 120px; z-index: 20; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .menu-dropdown button {
      background: none; border: none; padding: 8px 12px; text-align: left; cursor: pointer; font-size: 13px; color: #374151; width: 100%;
    }
    .menu-dropdown button:hover { background: #f3f4f6; }
    .menu-dropdown button.delete-btn { color: #ef4444; }
    .menu-dropdown button.delete-btn:hover { background: #fee2e2; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50;
      backdrop-filter: blur(2px);
    }
    .modal-content {
      background: white; border-radius: 16px; padding: 24px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .modal-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 24px; }
    
    .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 14px; font-weight: 500; color: #374151; }
    .form-group input, .form-group select {
      padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; color: #111827;
      transition: border-color 0.2s;
    }
    .form-group input:focus, .form-group select:focus { border-color: #3b82f6; outline: none; ring: 2px solid #fee2e2; }
    
    .color-input { width: 100%; height: 40px; padding: 2px; cursor: pointer; }

    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
    .btn-cancel { padding: 10px 20px; background: white; border: 1px solid #d1d5db; border-radius: 8px; font-weight: 500; color: #374151; cursor: pointer; }
    .btn-confirm { padding: 10px 20px; background: #3b82f6; border: none; border-radius: 8px; font-weight: 500; color: white; cursor: pointer; }
    .btn-confirm:hover { background: #2563eb; }
  `]
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

  formData: any = {
    nom: '',
    code: '',
    color: '#3b82f6',
    societe_id: '',
    departement_id: '',
    service_id: '',
    parentType: 'service', // for equipe
    parentId: ''         // for equipe
  };

  constructor(private resourceService: ResourceService) {
    // click outside to close menu
    window.addEventListener('click', () => {
      this.activeMenuId = null;
    });
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
    this.orgTree = this.societes.map(s => {
      // Find departements for this societe
      const sDepts = this.departements.filter(d => d.societe_id === s.id);

      const deptNodes: OrgNode[] = sDepts.map(d => {
        // Find services for this departement
        const dServices = this.services.filter(srv => srv.departement_id === d.id);

        const serviceNodes: OrgNode[] = dServices.map(srv => {
          const sEquipes = this.equipes.filter(e => e.service_id === srv.id);
          return {
            type: 'service',
            id: srv.id!,
            nom: srv.nom,
            code: srv.code,
            color: srv.color,
            originalData: srv,
            children: sEquipes.map(e => ({
              type: 'equipe',
              id: e.id!,
              nom: e.nom,
              code: e.code,
              color: e.color,
              originalData: e,
              children: [],
              expanded: false,
              level: 3,
              parentId: srv.id
            })),
            expanded: true,
            level: 2,
            parentId: d.id
          };
        });

        // Also find equipes attached to department (if any)
        const dDirectEquipes = this.equipes.filter(e => e.departement_id === d.id);
        const equipeNodes: OrgNode[] = dDirectEquipes.map(e => ({
          type: 'equipe',
          id: e.id!,
          nom: e.nom,
          code: e.code,
          color: e.color,
          originalData: e,
          children: [],
          expanded: false,
          level: 2, // Same level as Service if direct child of Dept
          parentId: d.id
        }));

        return {
          type: 'departement',
          id: d.id!,
          nom: d.nom,
          code: d.code,
          color: d.color,
          originalData: d,
          children: [...serviceNodes, ...equipeNodes],
          expanded: true,
          level: 1,
          parentId: s.id
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
        expanded: true,
        level: 0
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
    this.formData = { nom: '', code: '', color: '#3b82f6', societe_id: '', departement_id: '', service_id: '', parentType: 'service', parentId: '' };

    // Set default parents if possible (e.g. first one)
    if (type === 'departement' && this.societes.length > 0) this.formData.societe_id = this.societes[0].id;
    if (type === 'service' && this.departements.length > 0) this.formData.departement_id = this.departements[0].id;
    if (type === 'equipe') {
      if (this.services.length > 0) {
        this.formData.parentType = 'service';
        this.formData.parentId = this.services[0].id;
      } else if (this.departements.length > 0) {
        this.formData.parentType = 'departement';
        this.formData.parentId = this.departements[0].id;
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

    // Special handling for Equipe parent
    if (node.type === 'equipe') {
      console.log(node);
      if (node.originalData.service_id) {
        this.formData.parentType = 'service';
        this.formData.parentId = node.originalData.service_id;
      } else if (node.originalData.departement_id) {
        this.formData.parentType = 'departement';
        this.formData.parentId = node.originalData.departement_id;
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
      case 'societe': return 'une Société';
      case 'departement': return 'un Département';
      case 'service': return 'un Service';
      case 'equipe': return 'une Équipe';
      default: return '';
    }
  }

  async handleCreate() {
    try {
      if (this.createModalType === 'societe') {
        const payload: Partial<Societe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color
        };
        await this.resourceService.createSociete(payload);
      } else if (this.createModalType === 'departement') {
        const payload: Partial<Departement> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          societe_id: this.formData.societe_id
        };
        await this.resourceService.createDepartement(payload);
      } else if (this.createModalType === 'service') {
        const payload: Partial<Service> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          departement_id: this.formData.departement_id
        };
        await this.resourceService.createService(payload);
      } else if (this.createModalType === 'equipe') {
        const payload: Partial<Equipe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        //en fonction du type de parent, on met le service_id ou le departement_id
        if (this.formData.parentType === 'service') {
          payload.service_id = this.formData.parentId
        } else if (this.formData.parentType === 'departement') {
          payload.departement_id = this.formData.parentId
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
          color: this.formData.color
        };
        await this.resourceService.updateSociete(id, payload);
      } else if (this.editingNode.type === 'departement') {
        const payload: Partial<Departement> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          societe_id: this.formData.societe_id
        };
        await this.resourceService.updateDepartement(id, payload);
      } else if (this.editingNode.type === 'service') {
        const payload: Partial<Service> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
          departement_id: this.formData.departement_id
        };
        await this.resourceService.updateService(id, payload);
      } else if (this.editingNode.type === 'equipe') {
        const payload: Partial<Equipe> = {
          nom: this.formData.nom,
          code: this.formData.code,
          color: this.formData.color,
        };
        //en fonction du type de parent, on met le service_id ou le departement_id
        if (this.formData.parentType === 'service') {
          payload.service_id = this.formData.parentId
        } else if (this.formData.parentType === 'departement') {
          payload.departement_id = this.formData.parentId
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
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${node.nom} ?`)) return;
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
  }
}
