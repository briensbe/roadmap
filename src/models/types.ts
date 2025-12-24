export interface Societe {
  id?: string;
  nom: string;
  created_at?: string;
  code?: string;
  color?: string;
}

export interface Departement {
  id?: string;
  nom: string;
  societe_id: string;
  created_at?: string;
  code?: string;
  color?: string;
}

export interface Service {
  id?: string;
  id_service?: number;
  nom: string;
  departement_id: string;
  societe_id?: string;
  created_at?: string;
  code?: string;
  color?: string;
}

export interface Equipe {
  id?: string;
  nom: string;
  service_id: string;
  departement_id: string;
  created_at?: string;
  code?: string;
  color?: string;
}

export interface EquipeResource {
  type: 'role' | 'personne';
  id: string;
  uniqueId: string;
  nom: string;
  prenom?: string;
  jours_par_semaine: number;
  code?: string;
  color?: string;
}

export interface Role {
  id?: string;
  nom: string;
  jours_par_semaine: number;
  created_at?: string;
  code?: string;
  color?: string;
  service_id?: string;
}

export interface RoleAttachment {
  id?: string;
  role_id: string;
  societe_id?: string;
  departement_id?: string;
  service_id?: string;
  equipe_id?: string;
  created_at?: string;
  id_service?: number;
}

export interface Personne {
  id?: string;
  nom: string;
  prenom: string;
  email?: string;
  jours_par_semaine: number;
  societe_id?: string;
  departement_id?: string;
  service_id?: string;
  equipe_id?: string;
  id_service?: number;
  created_at?: string;
  code?: string;
  color?: string;
}

export interface Projet {
  id?: string;
  id_projet: number;
  code_projet: string;
  nom_projet: string;
  chef_projet?: string;
  statut: string;
  reference_externe?: string;
  description?: string;
  chiffrage_initial: number;
  chiffrage_revise: number;
  chiffrage_previsionnel: number;
  temps_consomme: number;
  created_at?: string;
  updated_at?: string;
}

export interface Capacite {
  id?: string;
  semaine_debut: string;
  capacite: number;
  role_id?: string;
  personne_id?: string;
  societe_id?: string;
  departement_id?: string;
  service_id?: string;
  equipe_id?: string;
  created_at?: string;
}

export interface Charge {
  id?: string;
  projet_id: string;
  semaine_debut: string;
  semaine_fin: string;
  unite_ressource: number;
  jours_par_semaine: number; // !!  à récupérer du role ou de la personne et pas de la table !! 
  role_id?: string;
  personne_id?: string;
  societe_id?: string;
  departement_id?: string;
  service_id?: string;
  equipe_id?: string;
  created_at?: string;
}

export interface Jalon {
  id?: string;
  nom: string;
  date_jalon: string;
  projet_id?: string;
  type: string;
  created_at?: string;
}

export interface CustomField {
  id?: string;
  nom: string;
  type: string;
  entite: string;
  created_at?: string;
}

export interface CustomFieldValue {
  id?: string;
  custom_field_id: string;
  entite_id: string;
  valeur?: string;
  created_at?: string;
}

export type ResourceType = "societe" | "departement" | "service" | "equipe" | "role" | "personne";

export interface WeekData {
  weekStart: Date;
  weekNumber: number;
  capacite?: number;
  charge?: number;
  disponible?: number;
}

export interface EquipeProjet {
  equipe_id: string;
  projet_id: string;
  created_at?: string;
  updated_at?: string;
}
