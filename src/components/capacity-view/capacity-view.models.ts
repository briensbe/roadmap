/**
 * @file capacity-view.models.ts
 * @description Modèles et types de données pour la vue de gestion des capacités.
 */

import { Equipe, Role, Personne, RoleAttachment } from '../../models/types';
import { CapacitySourceConfig, CrewdayzTeamAvailability, RoadmapMappingRoleProfile } from '../../models/crewdayz.types';

export interface ResourceWeekData {
  capacite: number;
  override_capacite?: number | null;
  override_delta?: number | null;
  comment?: string | null;
}

export interface ResourceRow {
  type: 'role' | 'personne';
  id: string;
  uniqueId: string;
  label: string;
  equipeId: string;
  weeks: Map<string, number>;
  weekData?: Map<string, ResourceWeekData>;
  jours_par_semaine: number;
  color?: string;
}

export interface TeamRow {
  equipe: Equipe;
  resources: ResourceRow[];
  expanded: boolean;
}

export interface SelectedCapacityCell {
  resource: ResourceRow;
  week: Date;
}

export interface LoadedCapacityDataset {
  allEquipes: Equipe[];
  availableRoles: Role[];
  availablePersonnes: Personne[];
  roleAttachmentsList: RoleAttachment[];
  crewdayzMappings: RoadmapMappingRoleProfile[];
  crewdayzAvailabilities: CrewdayzTeamAvailability[];
  capacitySourceConfigs: CapacitySourceConfig[];
  teamRows: TeamRow[];
}
