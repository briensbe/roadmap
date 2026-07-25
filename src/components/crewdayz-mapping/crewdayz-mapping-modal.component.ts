import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrewdayzIntegrationService } from '../../services/crewdayz-integration.service';
import {
  CapacitySource,
  CapacitySourceConfig,
  CrewdayzDiscoveryResponse,
  RoadmapMappingRoleProfile,
} from '../../models/crewdayz.types';
import { Equipe, Role, Personne, RoleAttachment } from '../../models/types';
import {
  LucideAngularModule,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  RefreshCw,
  Sliders,
  Layers,
  Users,
  Zap,
  Database,
} from 'lucide-angular';

@Component({
  selector: 'app-crewdayz-mapping-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './crewdayz-mapping-modal.component.html',
  styleUrl: './crewdayz-mapping-modal.component.css',
})
export class CrewdayzMappingModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() roadmapTeams: Equipe[] = [];
  @Input() roadmapRoles: Role[] = [];
  @Input() roadmapPersonnes: Personne[] = [];
  @Input() roleAttachments: RoleAttachment[] = [];

  @Output() closeModal = new EventEmitter<void>();
  @Output() mappingSaved = new EventEmitter<void>();

  discovery: CrewdayzDiscoveryResponse = { equipes: [] };
  mappings: RoadmapMappingRoleProfile[] = [];
  sourceConfigs: CapacitySourceConfig[] = [];
  savingSource: string | null = null; // equipeId en cours de sauvegarde
  loading = false;
  saving = false;

  // Form State
  editingId: string | null = null;
  selectedRoadmapTeamId = '';
  selectedRoadmapRoleAttachmentId = '';
  selectedRoadmapPersonneId = '';
  selectedCrewdayzTeamName = '';
  selectedCrewdayzProfileName = '';
  availabilityRatio = 1.0;

  // Lucide icons
  Plus = Plus;
  Trash2 = Trash2;
  Edit2 = Edit2;
  X = X;
  Check = Check;
  RefreshCw = RefreshCw;
  Sliders = Sliders;
  Layers = Layers;
  Users = Users;
  Zap = Zap;
  Database = Database;

  constructor(
    private crewdayzService: CrewdayzIntegrationService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    if (this.isOpen) {
      await this.loadAll();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      await this.loadAll();
    }
  }

  async loadAll() {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [disc, mapList, sourceConfigs] = await Promise.all([
        this.crewdayzService.getDiscovery(true),
        this.crewdayzService.getMappings(true),
        this.crewdayzService.getCapacitySourceConfigs(true),
      ]);
      this.discovery = disc;
      this.mappings = mapList;
      this.sourceConfigs = sourceConfigs;
    } catch (err) {
      console.error('[CrewdayzMappingModal] Error loading data:', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get availableCrewdayzProfiles(): string[] {
    if (!this.selectedCrewdayzTeamName) return [];
    const team = this.discovery.equipes.find(
      (t) => t.nom.trim().toLowerCase() === this.selectedCrewdayzTeamName.trim().toLowerCase()
    );
    return team ? team.profils : [];
  }

  getSourceForTeam(equipeId: string): CapacitySource {
    return this.crewdayzService.getSourceForTeam(equipeId, this.sourceConfigs);
  }

  async setSource(equipeId: string, source: CapacitySource): Promise<void> {
    if (this.savingSource === equipeId) return;
    this.savingSource = equipeId;
    this.cdr.markForCheck();
    try {
      await this.crewdayzService.setCapacitySource(equipeId, source);
      // Mettre à jour le cache local
      const idx = this.sourceConfigs.findIndex((c) => c.equipe_id === equipeId);
      if (idx >= 0) {
        this.sourceConfigs[idx] = { ...this.sourceConfigs[idx], capacity_source: source };
      } else {
        this.sourceConfigs = [...this.sourceConfigs, { equipe_id: equipeId, capacity_source: source }];
      }
      this.mappingSaved.emit();
    } catch (err: any) {
      console.error('[CrewdayzMappingModal] Error saving source config:', err);
      alert('Erreur lors de la sauvegarde de la source : ' + (err.message || err));
    } finally {
      this.savingSource = null;
      this.cdr.markForCheck();
    }
  }

  onCrewdayzTeamChange() {
    this.selectedCrewdayzProfileName = '';
  }

  getAvailableRoleAttachmentsForTeam(): { id: string; label: string }[] {
    if (!this.selectedRoadmapTeamId) {
      return this.roleAttachments.map((att) => {
        const role = this.roadmapRoles.find((r) => r.id === att.role_id);
        const team = this.roadmapTeams.find((t) => t.id === att.equipe_id);
        return {
          id: att.id!,
          label: `${role ? role.nom : 'Rôle inconnu'} (${team ? team.nom : 'Toutes équipes'})`,
        };
      });
    }

    const teamAtts = this.roleAttachments.filter(
      (att) => att.equipe_id === this.selectedRoadmapTeamId
    );
    return teamAtts.map((att) => {
      const role = this.roadmapRoles.find((r) => r.id === att.role_id);
      return {
        id: att.id!,
        label: role ? role.nom : 'Rôle inconnu',
      };
    });
  }

  getAvailablePersonnesForTeam(): Personne[] {
    if (!this.selectedRoadmapTeamId) return this.roadmapPersonnes;
    return this.roadmapPersonnes.filter((p) => p.equipe_id === this.selectedRoadmapTeamId);
  }

  startNewMapping() {
    this.editingId = null;
    this.selectedRoadmapTeamId = this.roadmapTeams.length > 0 ? this.roadmapTeams[0].id! : '';
    this.selectedRoadmapRoleAttachmentId = '';
    this.selectedRoadmapPersonneId = '';
    this.selectedCrewdayzTeamName = this.discovery.equipes.length > 0 ? this.discovery.equipes[0].nom : '';
    this.selectedCrewdayzProfileName = '';
    this.availabilityRatio = 1.0;
  }

  editMapping(m: RoadmapMappingRoleProfile) {
    this.editingId = m.id || null;
    this.selectedRoadmapTeamId = m.roadmap_team_id || '';
    this.selectedRoadmapRoleAttachmentId = m.roadmap_role_attachment_id || '';
    this.selectedRoadmapPersonneId = m.roadmap_personne_id || '';
    this.selectedCrewdayzTeamName = m.crewdayz_team_name;
    this.selectedCrewdayzProfileName = m.crewdayz_profile_name;
    this.availabilityRatio = m.availability_ratio ?? 1.0;
  }

  cancelEdit() {
    this.editingId = null;
    this.startNewMapping();
  }

  async saveMapping() {
    if (!this.selectedCrewdayzTeamName || !this.selectedCrewdayzProfileName) {
      alert('Veuillez sélectionner une équipe et un profil Crewdayz.');
      return;
    }

    if (!this.selectedRoadmapRoleAttachmentId && !this.selectedRoadmapPersonneId && !this.selectedRoadmapTeamId) {
      alert('Veuillez associer à au moins une équipe, un rôle ou une ressource Roadmap.');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    try {
      await this.crewdayzService.saveMapping({
        id: this.editingId || undefined,
        roadmap_team_id: this.selectedRoadmapTeamId || null,
        roadmap_role_attachment_id: this.selectedRoadmapRoleAttachmentId || null,
        roadmap_personne_id: this.selectedRoadmapPersonneId || null,
        crewdayz_team_name: this.selectedCrewdayzTeamName,
        crewdayz_profile_name: this.selectedCrewdayzProfileName,
        availability_ratio: Number(this.availabilityRatio),
      });

      await this.loadAll();
      this.cancelEdit();
      this.mappingSaved.emit();
    } catch (err: any) {
      console.error('[CrewdayzMappingModal] Error saving mapping:', err);
      alert("Erreur lors de l'enregistrement du mapping: " + (err.message || err));
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async deleteMapping(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer ce mapping ?')) return;

    try {
      await this.crewdayzService.deleteMapping(id);
      await this.loadAll();
      this.mappingSaved.emit();
    } catch (err: any) {
      console.error('[CrewdayzMappingModal] Error deleting mapping:', err);
      alert('Erreur lors de la suppression: ' + (err.message || err));
    }
  }

  getRoadmapTeamName(teamId?: string | null): string {
    if (!teamId) return 'Toutes équipes';
    const t = this.roadmapTeams.find((eq) => eq.id === teamId);
    return t ? t.nom : 'Équipe inconnue';
  }

  getRoadmapResourceLabel(m: RoadmapMappingRoleProfile): string {
    if (m.roadmap_role_attachment_id) {
      const att = this.roleAttachments.find((a) => a.id === m.roadmap_role_attachment_id);
      if (att) {
        const role = this.roadmapRoles.find((r) => r.id === att.role_id);
        return `Rôle : ${role ? role.nom : 'Rôle'}`;
      }
    }
    if (m.roadmap_personne_id) {
      const p = this.roadmapPersonnes.find((pers) => pers.id === m.roadmap_personne_id);
      if (p) {
        return `Personne : ${p.prenom} ${p.nom}`;
      }
    }
    return 'Global Équipe';
  }

  close() {
    this.closeModal.emit();
  }
}
