import { Component, OnInit, Output, EventEmitter, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ResourceService } from '../services/resource.service';
import { RolesService } from '../services/roles.service';
import { Service, Role, Personne, RoleAttachment } from '../models/types';
import {
  LucideAngularModule,
  Building2,
  Layers,
  Box,
  Users,
  MoreVertical,
  Plus,
  Edit,
  Trash2,
  Search,
  Check,
  X,
  ChevronDown,
  User,
} from 'lucide-angular';
import { ConfirmModalComponent } from './confirm-modal.component';
import { textContains } from '../utils/text.utils';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      Building2,
      Layers,
      Box,
      Users,
      MoreVertical,
      Plus,
      Edit,
      Trash2,
      Search,
      Check,
      X,
      ChevronDown,
      User,
    }),
  ],
  exports: [LucideAngularModule],
})
export class LucideIconsModule {}

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
  selector: 'app-resource-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconsModule, ConfirmModalComponent],
  templateUrl: './resource-manager.component.html',
  styleUrl: './resource-manager.component.css',
})
export class ResourceManagerComponent implements OnInit {
  @Output() resourceCreated = new EventEmitter<void>();

  activeTab: 'role' | 'personne' = 'role';
  searchQuery = '';
  activeMenuId: string | null = null;

  roles: Role[] = [];
  personnes: Personne[] = [];
  services: Service[] = [];
  roleAttachments: RoleAttachment[] = [];

  showModal = false;
  isEditing = false;
  editingId: string | null = null;
  formData: ResourceFormData = this.resetFormData();

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

  constructor(
    private resourceService: ResourceService,
    private rolesService: RolesService,
    private route: ActivatedRoute,
  ) {
    window.addEventListener('click', () => (this.activeMenuId = null));
  }

  async ngOnInit() {
    // Read query params for tab selection
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'personne' || params['tab'] === 'role') {
        this.activeTab = params['tab'];
      }
    });

    await this.loadData();
  }

  async loadData() {
    try {
      this.roles = await this.rolesService.getAllRoles();
      this.personnes = await this.resourceService.getAllPersonnes();
      this.services = await this.resourceService.getAllServices();
      this.roleAttachments = await this.rolesService.getAllRoleAttachments();
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  }

  resetFormData(): ResourceFormData {
    return {
      nom: '',
      prenom: '',
      email: '',
      jours_par_semaine: 5,
      code: '',
      color: '#3b82f6',
      service_id: '',
    };
  }

  filteredRoles() {
    return this.roles.filter(
      (r) =>
        textContains(r.nom, this.searchQuery) ||
        textContains(r.code, this.searchQuery),
    );
  }

  filteredPersonnes() {
    return this.personnes.filter(
      (p) =>
        textContains(p.nom, this.searchQuery) ||
        textContains(p.prenom, this.searchQuery),
    );
  }

  getPersonneInitials(p: Personne) {
    if (p.prenom && !p.nom) return p.prenom.charAt(0).toUpperCase();
    if (p.nom && !p.prenom) return p.nom.charAt(0).toUpperCase();
    if (!p.prenom && !p.nom) return '?';
    return (p.prenom.charAt(0) + p.nom.charAt(0)).toUpperCase();
  }

  getServiceName(id?: string | null) {
    if (!id) return '';
    return this.services.find((s) => s.id === id)?.nom || '';
  }

  getRoleServiceName(roleId: string) {
    const attachment = this.roleAttachments.find((a) => a.role_id === roleId);
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
      const attachment = this.roleAttachments.find((a) => a.role_id === resource.id);
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
      const selectedService = this.services.find((s) => s.id === this.formData.service_id);
      const idService = selectedService?.id_service || null;
      const serviceId = this.formData.service_id || null;

      if (this.activeTab === 'role') {
        const payload: Partial<Role> = {
          nom: this.formData.nom,
          code: this.formData.code,
          jours_par_semaine: this.formData.jours_par_semaine,
          color: this.formData.color,
        };

        let savedRole: Role;
        if (this.isEditing && this.editingId) {
          savedRole = await this.rolesService.updateRole(this.editingId, payload);
        } else {
          savedRole = await this.rolesService.createRole(payload);
        }

        // Handle attachments (update all attachments for this role)
        const existingAttachments = this.roleAttachments.filter((a) => a.role_id === savedRole.id);
        if (serviceId) {
          const attachmentPayload: Partial<RoleAttachment> = {
            role_id: savedRole.id!,
            service_id: serviceId,
            id_service: idService,
            societe_id: selectedService?.societe_id || null,
            departement_id: selectedService?.departement_id || null,
          };

          if (existingAttachments.length > 0) {
            for (const att of existingAttachments) {
              await this.rolesService.updateRoleAttachment(att.id!, attachmentPayload);
            }
          } else {
            await this.rolesService.createRoleAttachment(attachmentPayload);
          }
        } else {
          for (const att of existingAttachments) {
            if (!att.equipe_id) {
              await this.rolesService.deleteRoleAttachment(att.id!);
            } else {
              await this.rolesService.updateRoleAttachment(att.id!, {
                service_id: null,
                id_service: null,
                societe_id: null,
                departement_id: null,
              });
            }
          }
        }
      } else {
        const payload: Partial<Personne> = {
          nom: this.formData.nom,
          prenom: this.formData.prenom || '',
          email: this.formData.email,
          jours_par_semaine: this.formData.jours_par_semaine,
          color: this.formData.color,
          service_id: serviceId,
          id_service: idService,
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
      console.error('Error saving resource:', error);
    }
  }

  async handleDelete(type: 'role' | 'personne', id: string) {
    this.confirmTitle = 'Supprimer la ressource';
    this.confirmMessage = 'Êtes-vous sûr de vouloir supprimer cette ressource ?';

    this.pendingConfirmAction = async () => {
      try {
        if (type === 'role') {
          await this.rolesService.deleteRole(id);
        } else {
          await this.resourceService.deletePersonne(id);
        }
        await this.loadData();
        this.resourceCreated.emit();
      } catch (error) {
        console.error('Error deleting resource:', error);
      }
    };
    this.showConfirmModal = true;
  }
}
