import { Component, OnInit, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Building2, Layers, Box, Users, ChevronRight, ChevronDown, MoreVertical, Plus } from 'lucide-angular';
import { ResourceService } from '../services/resource.service';
import { Societe, Departement, Service, Equipe } from '../models/types';


@NgModule({
  imports: [LucideAngularModule.pick({ Building2, Layers, Box, Users, ChevronRight, ChevronDown, MoreVertical, Plus })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

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
  imports: [
    CommonModule,
    FormsModule,
    LucideIconsModule,
  ],
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
            <lucide-icon name="building-2" [size]="20"></lucide-icon>
            Société
          </button>
          <button class="header-btn" (click)="openCreateModal('departement')">
            <lucide-icon name="layers" [size]="20"></lucide-icon>
            Département
          </button>
          <button class="header-btn" (click)="openCreateModal('service')">
            <lucide-icon name="box" [size]="20"></lucide-icon>
            Service
          </button>
          <button class="header-btn" (click)="openCreateModal('equipe')">
            <lucide-icon name="users" [size]="20"></lucide-icon>
            Équipe
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main-content">
        <h1 class="page-title">Organisation</h1>
        <p class="page-subtitle">Structurez votre organisation</p>
 
        <!-- Summary Stats Section -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon societe"><lucide-icon name="building-2" [size]="24"></lucide-icon></div>
            <div class="stat-value">{{ societes.length }}</div>
            <div class="stat-label">Sociétés</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon departement"><lucide-icon name="layers" [size]="24"></lucide-icon></div>
            <div class="stat-value">{{ departements.length }}</div>
            <div class="stat-label">Départements</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon service"><lucide-icon name="box" [size]="24"></lucide-icon></div>
            <div class="stat-value">{{ services.length }}</div>
            <div class="stat-label">Services</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon equipe"><lucide-icon name="users" [size]="24"></lucide-icon></div>
            <div class="stat-value">{{ equipes.length }}</div>
            <div class="stat-label">Équipes</div>
          </div>
        </div>

        <!-- Organization Structure Section -->
        <section class="org-structure">
          <div class="tree-container">
            <!-- Recursive Tree Rendering -->
            @for (node of orgTree; track node.id) {
              <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node }"></ng-container>
            }
          </div>
        </section>
      </main>
 
      <!-- Modal Overlay -->
      @if (showCreateModal || showEditModal) {
        <div class="modal-overlay" (click)="closeModals()">
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
              <div class="color-palette">
                @for (color of predefinedColors; track color) {
                  <div 
                    class="color-swatch" 
                    [style.background-color]="color"
                    [class.active]="formData.color === color && !isCustomColor"
                    (click)="selectColor(color)"
                  ></div>
                }
                <div 
                  class="color-swatch custom-trigger" 
                  [class.active]="isCustomColor"
                  (click)="isCustomColor = !isCustomColor"
                  title="Couleur personnalisée"
                >
                  @if (!isCustomColor) {
                    <lucide-icon name="plus" [size]="16"></lucide-icon>
                  } @else {
                    <div class="custom-preview" [style.background-color]="formData.color"></div>
                  }
                </div>
              </div>
              
              @if (isCustomColor) {
                <div class="custom-color-input-wrapper">
                  <input type="color" [(ngModel)]="formData.color" class="color-input">
                  <input type="text" [(ngModel)]="formData.color" placeholder="#000000" class="color-hex-input">
                </div>
              }
            </div>
  
            <!-- Parent Selectors based on type -->
            @if ((createModalType === 'departement') || (editingNode?.type === 'departement')) {
              <div class="form-group">
                <label>Société de rattachement</label>
                <select [(ngModel)]="formData.societe_id">
                  @for (s of societes; track s.id) {
                    <option [value]="s.id">{{ s.nom }}</option>
                  }
                </select>
              </div>
            }
  
            @if ((createModalType === 'service') || (editingNode?.type === 'service')) {
              <div class="form-group">
                <label>Département de rattachement</label>
                <select [(ngModel)]="formData.departement_id">
                  @for (d of departements; track d.id) {
                    <option [value]="d.id">{{ d.nom }}</option>
                  }
                </select>
              </div>
            }
  
            @if ((createModalType === 'equipe') || (editingNode?.type === 'equipe')) {
              <div class="form-group">
                <label>Rattachement (Service ou Département)</label>
                <select [(ngModel)]="formData.parentType" (change)="formData.parentId = ''">
                  <option value="service" selected>Service</option>
                  <option value="departement">Département</option>
                </select>
              </div>
            }
  
            @if (((createModalType === 'equipe') || (editingNode?.type === 'equipe')) && formData.parentType === 'service') {
              <div class="form-group">
                <label>Service</label>
                <select [(ngModel)]="formData.parentId">
                  @for (s of services; track s.id) {
                    <option [value]="s.id">{{ s.nom }}</option>
                  }
                </select>
              </div>
            }
  
            @if (((createModalType === 'equipe') || (editingNode?.type === 'equipe')) && formData.parentType === 'departement') {
              <div class="form-group">
                <label>Département</label>
                <select [(ngModel)]="formData.parentId">
                  @for (d of departements; track d.id) {
                    <option [value]="d.id">{{ d.nom }}</option>
                  }
                </select>
              </div>
            }
  
            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeModals()">Annuler</button>
              <button class="btn-confirm" (click)="showEditModal ? handleUpdate() : handleCreate()">Enregistrer</button>
            </div>
          </div>
        </div>
      }
 
      <!-- Recursive Node Template -->
      <ng-template #nodeTemplate let-node>
        <div class="tree-node" [style.margin-left.px]="node.level * 32" (click)="toggleNode(node)">
          
          <!-- Expand/Collapse Icon -->
          @if (node.children.length > 0) {
            <div class="toggle-icon">
              <lucide-icon [name]="node.expanded ? 'chevron-down' : 'chevron-right'" [size]="20"></lucide-icon>
            </div>
          } @else {
            <!-- Spacer for leaves -->
            <div class="toggle-placeholder"></div>
          }
 
          <!-- Type Icon -->
          <div class="node-icon" [ngClass]="node.type" [style.background-color]="node.color || '#e5e7eb'" [style.color]="'#fff'">
             @if (node.type === 'societe') {
               <lucide-icon name="building-2" [size]="18"></lucide-icon>
             }
             @if (node.type === 'departement') {
               <lucide-icon name="layers" [size]="18"></lucide-icon>
             }
             @if (node.type === 'service') {
               <lucide-icon name="box" [size]="18"></lucide-icon>
             }
             @if (node.type === 'equipe') {
               <lucide-icon name="users" [size]="18"></lucide-icon>
             }
          </div>
 
          <div class="node-info">
            <span class="node-name">{{ node.nom }}</span>
            @if (node.code) {
              <span class="node-code">({{ node.code }})</span>
            }
          </div>
 
          <!-- Kebab Menu -->
          <div class="kebab-menu-container" (click)="$event.stopPropagation()">
            <button class="kebab-btn" (click)="toggleMenu(node, $event)">
              <lucide-icon name="more-vertical" [size]="16"></lucide-icon>
            </button>
            @if (activeMenuId === node.id) {
              <div class="menu-dropdown">
                <button (click)="openEditModal(node)">Modifier</button>
                <button (click)="handleDelete(node)" class="delete-btn">Supprimer</button>
              </div>
            }
          </div>
        </div>
 
        <!-- Children -->
        @if (node.expanded) {
          @for (child of node.children; track child.id) {
            <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: child }"></ng-container>
          }
        }
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
    .main-content { padding: 32px; }
    .page-title { font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-subtitle { font-size: 14px; color: #6b7280; margin: 0 0 32px 0; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.2s;
      border: 1px solid #f3f4f6;
    }
    .stat-card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
    .stat-icon {
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-icon.societe { color: #3b82f6; background: #eff6ff; }
    .stat-icon.departement { color: #8b5cf6; background: #f5f3ff; }
    .stat-icon.service { color: #10b981; background: #ecfdf5; }
    .stat-icon.equipe { color: #f97316; background: #fff7ed; }
    .stat-value { font-size: 24px; font-weight: 700; color: #111827; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 14px; color: #6b7280; font-weight: 500; }
    
    /* Organization Tree */
    .org-structure { background: transparent; }
    .tree-container { display: flex; flex-direction: column; gap: 12px; }
    
    .tree-node { 
      display: flex; align-items: center; padding: 16px 20px; background: white; border-radius: 16px; 
      border: 1px solid #e5e7eb; transition: all 0.2s; position: relative;
      cursor: pointer;
    }
    .tree-node:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateY(-1px); }
    
    .toggle-icon { cursor: pointer; color: #9ca3af; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 12px; border-radius: 4px; }
    .toggle-icon:hover { background: #e5e7eb; color: #4b5563; }
    .toggle-placeholder { width: 32px; }
    
    .node-icon { 
      width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 16px; 
      background: #f3f4f6; color: #6b7280; flex-shrink: 0;
    }
    .node-icon.societe { /* Custom color applied inline */ }
    
    .node-info { flex: 1; display: flex; align-items: baseline; gap: 8px; }
    .node-name { font-weight: 700; color: #111827; font-size: 16px; }
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
    
    .color-input { width: 60px; height: 36px; padding: 2px; cursor: pointer; border-radius: 6px; border: 1px solid #d1d5db; }
    .color-hex-input { flex: 1; text-transform: uppercase; }

    .color-palette { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .color-swatch { 
      width: 28px; height: 28px; border-radius: 8px; cursor: pointer; transition: all 0.2s; 
      border: 2px solid transparent; 
    }
    .color-swatch:hover { transform: scale(1.1); }
    .color-swatch.active { border-color: #111827; box-shadow: 0 0 0 2px white, 0 0 0 4px #111827; }
    
    .custom-trigger { 
      background: #f3f4f6; border: 1px dashed #d1d5db; display: flex; align-items: center; justify-content: center; color: #6b7280; 
    }
    .custom-trigger.active { border: 2px solid #111827; background: white; }
    .custom-preview { width: 100%; height: 100%; border-radius: 6px; }

    .custom-color-input-wrapper { display: flex; gap: 12px; align-items: center; margin-top: 12px; padding: 12px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }

    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
    .btn-cancel { padding: 10px 20px; background: white; border: 1px solid #d1d5db; border-radius: 8px; font-weight: 500; color: #374151; cursor: pointer; }
    .btn-confirm { padding: 10px 20px; background: #3b82f6; border: none; border-radius: 8px; font-weight: 500; color: white; cursor: pointer; }
    .btn-confirm:hover { background: #2563eb; }
    .btn-confirm:active { transform: translateY(1px); }
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

  formData: FormData = {
    nom: '',
    code: '',
    color: '#3b82f6',
    societe_id: '',
    departement_id: '',
    service_id: '',
    parentType: 'service',
    parentId: ''
  };

  predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];

  isCustomColor = false;

  selectColor(color: string) {
    this.formData.color = color;
    this.isCustomColor = false;
  }

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
            expanded: false,
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
          expanded: false,
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
        expanded: false,
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
    if (type === 'departement' && this.societes.length > 0) this.formData.societe_id = this.societes[0].id ?? '';
    if (type === 'service' && this.departements.length > 0) this.formData.departement_id = this.departements[0].id ?? '';
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
      console.log(node);
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
