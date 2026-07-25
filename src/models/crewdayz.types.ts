export interface CrewdayzTeamDiscovery {
  nom: string;
  profils: string[];
}

export interface CrewdayzDiscoveryResponse {
  equipes: CrewdayzTeamDiscovery[];
}

export interface CrewdayzWeekAvailability {
  year: number;
  weekNumber: number;
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string;   // YYYY-MM-DD (Sunday)
  membersCount: number;
  capacityDays: number;
  absenceDays: number;
  availableDays: number;
}

export interface CrewdayzProfileAvailability {
  profileId: string;
  profileName: string;
  weeks: CrewdayzWeekAvailability[];
}

export interface CrewdayzTeamAvailability {
  teamId: string;
  teamName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  profiles: CrewdayzProfileAvailability[];
}

export interface RoadmapMappingRoleProfile {
  id?: string;
  roadmap_team_id?: string | null;
  roadmap_role_attachment_id?: string | null;
  roadmap_personne_id?: string | null;
  crewdayz_team_name: string;
  crewdayz_profile_name: string;
  availability_ratio: number;
  created_at?: string;
  updated_at?: string;
}

export type CapacitySource = 'roadmap' | 'crewdayz';

export interface CapacitySourceConfig {
  id?: string;
  equipe_id: string;
  capacity_source: CapacitySource;
  created_at?: string;
  updated_at?: string;
}
