export interface Chiffre {
  id_chiffres?: number;
  id_projet: number;
  id_service: number;
  initial?: number;
  revise?: number;
  previsionnel?: number;
  consomme?: number;
  date_mise_a_jour?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChiffresFormData {
  id_chiffres?: number;
  id_service?: number;
  initial?: number;
  revise?: number;
  previsionnel?: number;
  consomme?: number;
  date_mise_a_jour?: string;
  delta?: number;
  restant?: number;
  raf?: number;
  raf_date?: string;
}
