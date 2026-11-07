import { ThemePreference } from '../services/theme.service';

export interface PlanScreenPreferences {
  viewMode?: 'resource' | 'projet' | 'service';
  zoomLevel?: 'compact' | 'normal';
  showAvailability?: boolean;
  planningMode?: 'saisie' | 'lecture';
  chiffreMode?: 'previsionnel' | 'consomme';
  selectedCapacityYear?: string;
  labelColumnWidth?: number;
  weekFilters?: number[];
  filterEquipeIds?: string[];
  filterProjetIds?: string[];
  filterResourceIds?: string[];
  filterStatusIds?: string[];
  filterJalonTypes?: string[];
  filterPeriodEnabled?: boolean;
  filterPeriodStart?: string;
  filterPeriodEnd?: string;
  filterSizeEnabled?: boolean;
  filterSizeCriterion?: string;
  filterSizeOperator?: string;
  filterSizeValue?: number | null;
  globalSearch?: string;
  hasSeenTutorialActions?: boolean;
  hasSeenTutorialViewMode?: boolean;
}

export interface CapacityScreenPreferences {
  zoomLevel?: 'compact' | 'normal';
  selectedTeamIds?: string[];
  selectedCapacityYear?: string;
}

export interface ProjectsScreenPreferences {
  viewMode?: 'list' | 'card' | 'table';
  statusFilter?: string[];
  searchQuery?: string;
}

export interface RoadmapUserPreferences {
  theme?: ThemePreference;
  releaseNotes?: {
    lastSeenVersion?: string;
  };
  screens?: {
    plan?: PlanScreenPreferences;
    capacity?: CapacityScreenPreferences;
    projects?: ProjectsScreenPreferences;
    [key: string]: unknown;
  };
}

export const DEFAULT_USER_PREFERENCES: RoadmapUserPreferences = {
  theme: 'system',
  releaseNotes: {},
  screens: {
    plan: {
      zoomLevel: 'compact',
    },
    capacity: {
      zoomLevel: 'compact',
    },
    projects: {},
  },
};
