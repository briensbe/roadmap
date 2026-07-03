import { RawExcelRow } from './ExcelReader';

export interface StagingBudgetRow {
  budget_type: string | null;
  budget_nomenclature: string | null;
  budget_object: string | null;
  activity_type: string | null;
  project_code: string;
  project_name: string;
  project_manager: string | null;
  project_status: string | null;
  jira_references: string[];
  service_name: string;
  initial_jh: number | null;
  revised_jh: number | null;
  previsionnel_jh: number | null;
  consomme_jh: number | null;
}

export class RoadmapTransformer {
  /**
   * Transforms flat raw Excel rows into verticalized database records (one per active service)
   */
  public transform(rawRows: RawExcelRow[]): StagingBudgetRow[] {
    const transformed: StagingBudgetRow[] = [];

    for (const row of rawRows) {
      for (const [serviceName, metrics] of Object.entries(row.serviceMetrics)) {
        // Skip service row if all JH metrics are null or undefined
        const { initialJh, revisedJh, previsionnelJh, consommeJh } = metrics;
        if (initialJh === null && revisedJh === null && previsionnelJh === null && consommeJh === null) {
          continue;
        }

        transformed.push({
          budget_type: row.budgetType,
          budget_nomenclature: row.budgetNomenclature,
          budget_object: row.budgetObject,
          activity_type: row.activityType,
          project_code: row.projectCode,
          project_name: row.projectName,
          project_manager: row.projectManager,
          project_status: row.projectStatus,
          jira_references: row.jiraReferences,
          service_name: serviceName,
          initial_jh: initialJh,
          revised_jh: revisedJh,
          previsionnel_jh: previsionnelJh,
          consomme_jh: consommeJh,
        });
      }
    }

    return transformed;
  }
}
