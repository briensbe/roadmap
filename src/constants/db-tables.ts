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
  SETTINGS: `${DB_PREFIX}settings`,
  SOCIETES: `${DB_PREFIX}societes`,
} as const;
