export type SourceDonnee = 'TRISKELL' | 'LOCAL' | 'VIERGE';

export interface Chiffre {
  id_chiffres?: number;
  id_projet: string;
  id_service: string;
  initial?: number;
  revise?: number;
  previsionnel?: number;
  consomme?: number;
  created_at?: string;
  updated_at?: string;
}

/** Ligne renvoyée par la vue v_roadmap_projet_budget_unifie */
export interface BudgetUnifieEntry {
  id_projet: string;
  id_service: string;
  id_chiffres_local: number | null;
  nom_projet: string;
  nom_service: string;
  initial: number;
  revise: number;
  previsionnel: number;
  consomme: number;
  source_donnee: SourceDonnee;
  active_batch_id: string | null;
  ppm_project_id: string | null;
  ppm_project_ids: string[] | null;
  jira_references: string[] | null;
}

export interface ChiffresFormData {
  id_chiffres?: number;
  id_service?: string;
  initial?: number;
  revise?: number;
  previsionnel?: number;
  consomme?: number;
  delta?: number;
  restant?: number;
  raf?: number;
  raf_date?: string;
  /** Source de la donnée issue de la vue unifiée */
  source_donnee?: SourceDonnee;
}
