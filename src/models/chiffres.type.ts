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
}
