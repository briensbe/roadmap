export interface ImportAnomaliesServiceRow {
  id: number;
  service_name: string;
  initial_jh: number | null;
  revised_jh: number | null;
  previsionnel_jh: number | null;
  consomme_jh: number | null;
  hasConsumedAnomaly: boolean;
  hasRevisionAnomaly: boolean;
  consumedGap: number;
  revisionGap: number;
}

export interface ImportAnomaliesGroupedProject {
  key: string;
  project_code: string;
  project_name: string | null;
  project_manager: string | null;
  jira_references: string[] | null;
  reconciliation_status: 'matched' | 'multi_matched' | 'ambiguous' | 'unmapped';
  project_id: string | null;
  project_ids: string[] | null;
  initial_jh: number;
  revised_jh: number;
  previsionnel_jh: number;
  consomme_jh: number;
  budget_nomenclature: string | null;
  budget_object: string | null;
  activity_type: string | null;
  hasConsumedAnomaly: boolean;
  hasRevisionAnomaly: boolean;
  hasAnyAnomaly: boolean;
  services: ImportAnomaliesServiceRow[];
}

export interface ImportAnomaliesStats {
  total: number;
  consumed: number;
  revision: number;
}

export interface ImportAnomaliesPmGroup {
  pm: string;
  projects: ImportAnomaliesGroupedProject[];
  totalAlerts: number;
}
