import { Component, OnInit, Output, EventEmitter, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ResourceService } from "../services/resource.service";
import { RolesService } from "../services/roles.service";
import { Service, Role, Personne, RoleAttachment } from "../models/types";
import { LucideAngularModule, Building2, Layers, Box, Users, MoreVertical, Plus, Edit, Trash2, Search, Check, X, ChevronDown, User } from 'lucide-angular';

@NgModule({
  imports: [LucideAngularModule.pick({ Building2, Layers, Box, Users, MoreVertical, Plus, Edit, Trash2, Search, Check, X, ChevronDown, User })],
  exports: [LucideAngularModule]
})
export class LucideIconsModule { }

interface ResourceFormData {
  id?: string;
  nom: string;
  prenom?: string;
  email?: string;
  jours_par_semaine: number;
  code?: string;
  color: string;
  service_id: string; // Used for the select dropdown (UUID)
}

@Component({
  selector: "app-resource-manager",
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule],
  template: `
    <div class="resource-manager">
      <div class="view-header">
        <div class="title-group">
          <h1 class="view-title">Ressources</h1>
          <p class="view-subtitle">Gérez vos équipes et collaborateurs</p>
        </div>
        
        <div class="header-actions">
          <div class="search-container">
            <lucide-icon name="search" [size]="18" class="search-icon"></lucide-icon>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par nom ou code..." class="search-input" />
          </div>
          <button class="btn-create" (click)="openCreateModal()">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            Ajouter {{ activeTab === 'role' ? 'un Rôle' : 'une Personne' }}
          </button>
        </div>
      </div>

      <div class="tabs">
        <button [class.active]="activeTab === 'role'" (click)="activeTab = 'role'" class="tab-btn">
          <lucide-icon name="layers" [size]="18"></lucide-icon>
          Rôles
        </button>
        <button [class.active]="activeTab === 'personne'" (click)="activeTab = 'personne'" class="tab-btn">
          <lucide-icon name="users" [size]="18"></lucide-icon>
          Personnes
        </button>
      </div>

      <div class="resource-list">
        @if (activeTab === 'role') {
          @for (role of filteredRoles(); track role.id) {
            <div class="resource-card" (click)="openEditModal('role', role)">
              <div class="card-left">
                <div class="avatar role" [style.background-color]="role.color || '#3b82f6'">
                  {{ role.nom.charAt(0).toUpperCase() }}
                </div>
                <div class="resource-info">
                  <div class="resource-name">{{ role.nom }}</div>
                  <div class="resource-meta">
                    @if (role.code) { <span>{{ role.code }}</span> • }
                    <span>{{ role.jours_par_semaine }}j/sem</span>
                    @if (getRoleServiceName(role.id!)) { • <span>{{ getRoleServiceName(role.id!) }}</span> }
                  </div>
                </div>
              </div>
              <div class="card-right">
                <div class="kebab-menu-container" (click)="$event.stopPropagation()">
                  <button class="kebab-btn" (click)="toggleMenu(role.id!, $event)">
                    <lucide-icon name="more-vertical" [size]="20"></lucide-icon>
                  </button>
                  @if (activeMenuId === role.id) {
                    <div class="menu-dropdown">
                      <button (click)="openEditModal('role', role)"><lucide-icon name="edit" [size]="14"></lucide-icon> Modifier</button>
                      <button (click)="handleDelete('role', role.id!)" class="delete-btn"><lucide-icon name="trash2" [size]="14"></lucide-icon> Supprimer</button>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">Aucun rôle trouvé.</div>
          }
        } @else {
          @for (personne of filteredPersonnes(); track personne.id) {
            <div class="resource-card" (click)="openEditModal('personne', personne)">
              <div class="card-left">
                <div class="avatar personne" [style.background-color]="personne.color || '#10b981'">
                  {{ getPersonneInitials(personne) }}
                </div>
                <div class="resource-info">
                  <div class="resource-name">{{ personne.prenom }} {{ personne.nom }}</div>
                  <div class="resource-meta">
                    @if (personne.email) { <span>{{ personne.email }}</span> • }
                    <span>{{ personne.jours_par_semaine }}j/sem</span>
                    @if (getServiceName(personne.service_id)) { • <span>{{ getServiceName(personne.service_id) }}</span> }
                  </div>
                </div>
              </div>
              <div class="card-right">
                <div class="kebab-menu-container" (click)="$event.stopPropagation()">
                  <button class="kebab-btn" (click)="toggleMenu(personne.id!, $event)">
                    <lucide-icon name="more-vertical" [size]="20"></lucide-icon>
                  </button>
                  @if (activeMenuId === personne.id) {
                    <div class="menu-dropdown">
                      <button (click)="openEditModal('personne', personne)"><lucide-icon name="edit" [size]="14"></lucide-icon> Modifier</button>
                      <button (click)="handleDelete('personne', personne.id!)" class="delete-btn"><lucide-icon name="trash2" [size]="14"></lucide-icon> Supprimer</button>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">Aucune personne trouvée.</div>
          }
        }
      </div>

      <!-- Modal Création/Édition -->
      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <h2 class="modal-title">{{ isEditing ? 'Modifier' : 'Ajouter' }} {{ activeTab === 'role' ? 'un Rôle' : 'une Personne' }}</h2>
            
            <form (submit)="$event.preventDefault(); handleSave()">
              <div class="form-grid">
                @if (activeTab === 'personne') {
                  <div class="form-group">
                    <label>Prénom</label>
                    <input type="text" [(ngModel)]="formData.prenom" name="prenom" placeholder="Ex: Jean" required />
                  </div>
                }
                <div class="form-group">
                  <label>Nom</label>
                  <input type="text" [(ngModel)]="formData.nom" name="nom" [placeholder]="activeTab === 'role' ? 'Ex: Développeur Senior' : 'Ex: Dupont'" required />
                </div>
                
                @if (activeTab === 'personne') {
                  <div class="form-group full-width">
                    <label>Email</label>
                    <input type="email" [(ngModel)]="formData.email" name="email" placeholder="jean.dupont@exemple.com" />
                  </div>
                }

                @if (activeTab === 'role') {
                  <div class="form-group">
                    <label>Code</label>
                    <input type="text" [(ngModel)]="formData.code" name="code" placeholder="Ex: DEV-SEN" />
                  </div>
                }
                
                <div class="form-group">
                  <label>Service rattaché</label>
                  <select [(ngModel)]="formData.service_id" name="service_id">
                    <option value="">Aucun service</option>
                    @for (s of services; track s.id) {
                      <option [value]="s.id">{{ s.nom }}</option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label>Jours / Semaine</label>
                  <input type="number" [(ngModel)]="formData.jours_par_semaine" name="jours_par_semaine" step="0.5" min="0.5" max="7" required />
                </div>


                <div class="form-group full-width">
                  <label>Couleur</label>
                  <div class="color-palette">
                    @for (color of predefinedColors; track color) {
                      <div class="color-swatch" 
                           [style.background-color]="color"
                           [class.active]="formData.color === color"
                           (click)="selectColor(color)">
                      </div>
                    }
                    <div class="color-swatch custom-trigger" 
                         [class.active]="isCustomColor"
                         (click)="isCustomColor = !isCustomColor">
                      <lucide-icon name="plus" [size]="16" *ngIf="!isCustomColor"></lucide-icon>
                      <div class="custom-preview" *ngIf="isCustomColor" [style.background-color]="formData.color"></div>
                    </div>
                  </div>

                  @if (isCustomColor) {
                    <div class="custom-color-input-wrapper">
                      <input type="color" [(ngModel)]="formData.color" name="customColor" class="color-input" />
                      <input type="text" [(ngModel)]="formData.color" name="customColorText" class="color-hex-input" placeholder="#HEXCODE" />
                    </div>
                  }
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-cancel" (click)="closeModal()">Annuler</button>
                <button type="submit" class="btn-confirm">{{ isEditing ? 'Mettre à jour' : 'Créer' }}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .resource-manager { 
      padding: 20px;
      background: #f5f7fa;
      min-height: 100vh;
      font-family: 'Inter', sans-serif; 
    }

    .view-header { 
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 32px;
      gap: 24px;
    }

    .view-title { font-size: 28px; font-weight: 700; color: #1e293b; margin: 0; }
    .view-subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0 0; font-weight: 500; }

    .header-actions { display: flex; align-items: center; gap: 12px; }
    .search-container { position: relative; width: 320px; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
    .search-input { 
      width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; 
      transition: all 0.2s; background: white; color: #1e293b;
    }
    .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

    .btn-create { 
      display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #3b82f6; color: white; border: none; 
      border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-size: 14px;
    }
    .btn-create:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-create:active { transform: translateY(0); }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; background: #f3f4f6; padding: 6px; border-radius: 14px; width: fit-content; }
    .tab-btn { padding: 10px 24px; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; color: #6b7280; display: flex; align-items: center; gap: 8px; transition: all 0.2s; background: transparent; }
    .tab-btn.active { background: white; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab-btn:hover:not(.active) { color: #374151; }
    .resource-list { display: grid; gap: 16px; }
    .resource-card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; cursor: pointer; }
    .resource-card:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .card-left { display: flex; align-items: center; gap: 16px; }
    .avatar { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; flex-shrink: 0; }
    .resource-info { display: flex; flex-direction: column; gap: 2px; }
    .resource-name { font-weight: 700; color: #111827; font-size: 16px; }
    .resource-meta { font-size: 13px; color: #6b7280; font-weight: 500; }
    .kebab-menu-container { position: relative; }
    .kebab-btn { background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: 8px; color: #9ca3af; display: flex; transition: all 0.2s; }
    .kebab-btn:hover { background: #f3f4f6; color: #374151; }
    .menu-dropdown { position: absolute; right: 0; top: 100%; background: white; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 6px; min-width: 160px; z-index: 50; display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
    .menu-dropdown button { background: none; border: none; padding: 10px 12px; text-align: left; cursor: pointer; font-size: 14px; color: #374151; width: 100%; display: flex; align-items: center; gap: 10px; border-radius: 8px; font-weight: 500; }
    .menu-dropdown button:hover { background: #f3f4f6; }
    .menu-dropdown button.delete-btn { color: #ef4444; }
    .menu-dropdown button.delete-btn:hover { background: #fee2e2; }
    .empty-state { padding: 48px; text-align: center; color: #9ca3af; font-size: 15px; background: white; border-radius: 16px; border: 2px dashed #e5e7eb; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); padding: 20px; }
    .modal-content { background: white; border-radius: 20px; padding: 32px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .modal-title { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group.full-width { grid-column: span 2; }
    .form-group label { font-size: 14px; font-weight: 600; color: #374151; }
    .form-group input, .form-group select { padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; color: #111827; transition: all 0.2s; }
    .form-group input:focus, .form-group select:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .color-palette { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
    .color-swatch { width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
    .color-swatch:hover { transform: scale(1.1); }
    .color-swatch.active { border-color: #111827; box-shadow: 0 0 0 2px white, 0 0 0 4px #111827; }
    .color-input { width: 60px; height: 40px; padding: 2px; cursor: pointer; border-radius: 8px; border: 1px solid #d1d5db; }
    .color-hex-input { flex: 1; text-transform: uppercase; }
    .custom-trigger { background: #f3f4f6; border: 2px dashed #d1d5db; display: flex; align-items: center; justify-content: center; color: #6b7280; }
    .custom-trigger.active { border: 2px solid #111827; background: white; color: #111827; }
    .custom-preview { width: 100%; height: 100%; border-radius: 6px; }
    .custom-color-input-wrapper { display: flex; gap: 12px; align-items: center; margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
    .btn-cancel { padding: 12px 24px; background: white; border: 1px solid #d1d5db; border-radius: 12px; font-weight: 600; color: #374151; cursor: pointer; }
    .btn-confirm { padding: 12px 24px; background: #3b82f6; border: none; border-radius: 12px; font-weight: 600; color: white; cursor: pointer; }
    .btn-confirm:hover { background: #2563eb; }
  `]
})
export class ResourceManagerComponent implements OnInit {
  @Output() resourceCreated = new EventEmitter<void>();

  activeTab: 'role' | 'personne' = 'role';
  searchQuery = "";
  activeMenuId: string | null = null;

  roles: Role[] = [];
  personnes: Personne[] = [];
  services: Service[] = [];
  roleAttachments: RoleAttachment[] = [];

  showModal = false;
  isEditing = false;
  editingId: string | null = null;
  formData: ResourceFormData = this.resetFormData();

  predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  isCustomColor = false;

  constructor(private resourceService: ResourceService, private rolesService: RolesService) {
    window.addEventListener('click', () => this.activeMenuId = null);
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.roles = await this.rolesService.getAllRoles();
      this.personnes = await this.resourceService.getAllPersonnes();
      this.services = await this.resourceService.getAllServices();
      this.roleAttachments = await this.rolesService.getAllRoleAttachments();
    } catch (error) {
      console.error("Error loading resources:", error);
    }
  }

  resetFormData(): ResourceFormData {
    return {
      nom: '', prenom: '', email: '', jours_par_semaine: 5, code: '', color: '#3b82f6', service_id: ''
    };
  }

  filteredRoles() {
    return this.roles.filter(r =>
      r.nom.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      (r.code && r.code.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );
  }

  filteredPersonnes() {
    return this.personnes.filter(p =>
      p.nom.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      p.prenom.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  getPersonneInitials(p: Personne) {
    //je veux retourner une initiale si il n'y a que nom ou prénom
    if (p.prenom && !p.nom) return p.prenom.charAt(0).toUpperCase();
    if (p.nom && !p.prenom) return p.nom.charAt(0).toUpperCase();
    if (!p.prenom && !p.nom) return '?';
    return (p.prenom.charAt(0) + p.nom.charAt(0)).toUpperCase();
  }

  getServiceName(id?: string | null) {
    if (!id) return '';
    return this.services.find(s => s.id === id)?.nom || '';
  }

  getRoleServiceName(roleId: string) {
    const attachment = this.roleAttachments.find(a => a.role_id === roleId);
    if (!attachment) return '';
    return this.getServiceName(attachment.service_id);
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  openCreateModal() {
    this.isEditing = false;
    this.editingId = null;
    this.formData = this.resetFormData();
    this.isCustomColor = false;
    this.showModal = true;
  }

  async openEditModal(type: 'role' | 'personne', resource: any) {
    this.isEditing = true;
    this.editingId = resource.id;
    this.formData = { ...resource, service_id: '' };

    if (type === 'role') {
      const attachment = this.roleAttachments.find(a => a.role_id === resource.id);
      if (attachment) {
        this.formData.service_id = attachment.service_id || '';
      }
    } else {
      this.formData.service_id = resource.service_id || '';
    }

    this.isCustomColor = !this.predefinedColors.includes(this.formData.color);
    this.showModal = true;
    this.activeMenuId = null;
  }

  closeModal() {
    this.showModal = false;
  }

  selectColor(color: string) {
    this.formData.color = color;
    this.isCustomColor = false;
  }

  async handleSave() {
    try {
      const selectedService = this.services.find(s => s.id === this.formData.service_id);
      const idService = selectedService?.id_service || null;
      const serviceId = this.formData.service_id || null;

      if (this.activeTab === 'role') {
        const payload: Partial<Role> = {
          nom: this.formData.nom,
          code: this.formData.code,
          jours_par_semaine: this.formData.jours_par_semaine,
          color: this.formData.color
        };

        let savedRole: Role;
        if (this.isEditing && this.editingId) {
          savedRole = await this.rolesService.updateRole(this.editingId, payload);
        } else {
          savedRole = await this.rolesService.createRole(payload);
        }

        // Handle attachment
        const existingAttachment = this.roleAttachments.find(a => a.role_id === savedRole.id);
        if (serviceId) {
          const attachmentPayload: Partial<RoleAttachment> = {
            role_id: savedRole.id!,
            service_id: serviceId,
            id_service: idService,
            societe_id: selectedService?.societe_id || null,
            departement_id: selectedService?.departement_id || null
          };

          if (existingAttachment) {
            await this.rolesService.updateRoleAttachment(existingAttachment.id!, attachmentPayload);
          } else {
            await this.rolesService.createRoleAttachment(attachmentPayload);
          }
        } else if (existingAttachment) {
          // Explicitly nullify or delete based on previous behavior, but here nullifying is requested
          // However for attachments, if no service/team/etc remains, we usually delete.
          // The user specifically asked to "remettre à null les champs"
          await this.rolesService.updateRoleAttachment(existingAttachment.id!, {
            service_id: null,
            id_service: null,
            societe_id: null,
            departement_id: null
          });
        }
      } else {
        const payload: Partial<Personne> = {
          nom: this.formData.nom,
          prenom: this.formData.prenom || '',
          email: this.formData.email,
          jours_par_semaine: this.formData.jours_par_semaine,
          color: this.formData.color,
          service_id: serviceId,
          id_service: idService
        };
        if (this.isEditing && this.editingId) {
          await this.resourceService.updatePersonne(this.editingId, payload);
        } else {
          await this.resourceService.createPersonne(payload);
        }
      }
      this.closeModal();
      await this.loadData();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error saving resource:", error);
    }
  }

  async handleDelete(type: 'role' | 'personne', id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette ressource ?')) return;
    try {
      if (type === 'role') {
        await this.rolesService.deleteRole(id);
      } else {
        await this.resourceService.deletePersonne(id);
      }
      await this.loadData();
      this.resourceCreated.emit();
    } catch (error) {
      console.error("Error deleting resource:", error);
    }
  }
}
