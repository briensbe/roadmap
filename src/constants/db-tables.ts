const DB_PREFIX = 'roadmap_';

export const DB_TABLES = {
  CAPACITES: `${DB_PREFIX}capacites`,
  CHARGES: `${DB_PREFIX}charges`,
  CHIFFRES: `${DB_PREFIX}chiffres`,
  DEPARTEMENTS: `${DB_PREFIX}departements`,
  EQUIPES: `${DB_PREFIX}equipes`,
  EQUIPES_PROJETS: `${DB_PREFIX}equipes_projets`,
  JALONS: `${DB_PREFIX}jalons`,
  PERSONNES: `${DB_PREFIX}personnes`,
  PERSONNE_ROLES: `${DB_PREFIX}personne_roles`,
  PROJETS: `${DB_PREFIX}projets`,
  RELEASE_NOTES: `${DB_PREFIX}release_notes`,
  ROLE_ATTACHMENTS: `${DB_PREFIX}role_attachments`,
  ROLES: `${DB_PREFIX}roles`,
  SERVICES: `${DB_PREFIX}services`,
  SERVICE_MAPPINGS: `${DB_PREFIX}service_mapping`,
  SETTINGS: `${DB_PREFIX}settings`,
  SOCIETES: `${DB_PREFIX}societes`,
  IMPORT_BATCHES: `${DB_PREFIX}import_batches`,
  IMPORT_BUDGET: `${DB_PREFIX}import_budget`,
  MAPPING_ROLES_PROFILES: `${DB_PREFIX}mapping_roles_profiles`,
  CAPACITY_SOURCE_CONFIG: `${DB_PREFIX}capacity_source_config`,
} as const;

export const DB_VIEWS = {
  VIEW_BUDGET_UNIFIE: 'v_roadmap_projet_budget_unifie',
} as const;
