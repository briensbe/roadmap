import { SupabaseClient } from '@supabase/supabase-js';
import { paginateQuery } from '../../utils/supabase-pagination';

export interface ReconciliationResult {
  totalProcessed: number;
  matched: number;
  multiMatched: number;
  ambiguous: number;
  unmapped: number;
}

export class RoadmapReconciliator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Reconciles staging rows for the given batch with production projects.
   */
  public async reconcile(batchId: number): Promise<ReconciliationResult> {
    // 1. Fetch all staging rows for this batch
    const stagingRows = await paginateQuery<any>(() =>
      this.supabase
        .from('roadmap_import_budget')
        .select('id, project_code, project_name, jira_references')
        .eq('batch_id', batchId),
    );

    if (!stagingRows || stagingRows.length === 0) {
      return { totalProcessed: 0, matched: 0, multiMatched: 0, ambiguous: 0, unmapped: 0 };
    }

    // Get all unique project codes in the staging table
    const uniqueProjectCodes = Array.from(new Set(stagingRows.map((r) => r.project_code)));

    // 2. Fetch all matching projects from roadmap_projets
    const dbProjects = await paginateQuery<any>(() =>
      this.supabase
        .from('roadmap_projets')
        .select('id, code_projet, reference_externe')
        .in('code_projet', uniqueProjectCodes),
    );

    const projectsDb = dbProjects || [];

    // Group DB projects by code_projet
    const dbProjectsByCode: { [code: string]: typeof projectsDb } = {};
    for (const proj of projectsDb) {
      if (!dbProjectsByCode[proj.code_projet]) {
        dbProjectsByCode[proj.code_projet] = [];
      }
      dbProjectsByCode[proj.code_projet].push(proj);
    }

    // Group staging rows by project_code
    const stagingRowsByCode: { [code: string]: typeof stagingRows } = {};
    for (const row of stagingRows) {
      if (!stagingRowsByCode[row.project_code]) {
        stagingRowsByCode[row.project_code] = [];
      }
      stagingRowsByCode[row.project_code].push(row);
    }

    let matchedCount = 0;
    let multiMatchedCount = 0;
    let ambiguousCount = 0;
    let unmappedCount = 0;

    for (const row of stagingRows) {
      const code = row.project_code;
      const matchedDb = dbProjectsByCode[code] || [];
      const sameCodeStaging = stagingRowsByCode[code] || [];

      // Determine if there are multiple distinct project names in Excel sharing this code
      const distinctProjectNames = Array.from(new Set(sameCodeStaging.map((r) => r.project_name)));
      const multipleExcelProjects = distinctProjectNames.length > 1;

      let projectId: string | null = null;
      let projectIds: string[] | null = null;
      let status: 'matched' | 'multi_matched' | 'ambiguous' | 'unmapped' = 'unmapped';

      if (matchedDb.length === 0) {
        // No match in production database
        projectId = null;
        projectIds = null;
        status = 'unmapped';
        unmappedCount++;
      } else if (matchedDb.length === 1 && !multipleExcelProjects) {
        // Perfect 1-to-1 match
        projectId = matchedDb[0].id;
        projectIds = null;
        status = 'matched';
        matchedCount++;
      } else {
        // Multiple projects match in DB, or multiple distinct Excel projects share the code
        const rowJiras = row.jira_references || [];

        // Find DB projects where the reference_externe matches one of the row's Jira keys (allowing prefixes)
        const strictMatches = matchedDb.filter((p) => {
          if (!p.reference_externe) return false;
          const dbKey = p.reference_externe.trim().toLowerCase();

          return rowJiras.some((excelJira: string) => {
            const excelKey = excelJira.trim().toLowerCase();
            return excelKey === dbKey || excelKey.endsWith('-' + dbKey) || dbKey.endsWith('-' + excelKey);
          });
        });

        if (strictMatches.length === 1) {
          // Check if any other distinct project in Excel with this code also matches the same DB project
          const otherConflictingRows = sameCodeStaging.filter((otherRow) => {
            if (otherRow.project_name === row.project_name) return false; // same project, not a conflict
            const otherJiras = otherRow.jira_references || [];
            const dbKey = (strictMatches[0].reference_externe || '').trim().toLowerCase();

            return otherJiras.some((excelJira: string) => {
              const excelKey = excelJira.trim().toLowerCase();
              return excelKey === dbKey || excelKey.endsWith('-' + dbKey) || dbKey.endsWith('-' + excelKey);
            });
          });

          if (otherConflictingRows.length === 0) {
            // We resolved it uniquely via Jira!
            projectId = strictMatches[0].id;
            projectIds = null;
            status = 'matched';
            matchedCount++;
          } else {
            // Multiple distinct projects in Excel match the same database project (which was narrowed down by Jira)
            // But because they map to the same target, it's ambiguous
            projectId = null;
            projectIds = null;
            status = 'ambiguous';
            ambiguousCount++;
          }
        } else if (strictMatches.length > 1) {
          // Multiple database projects match both code AND Jira references -> multi_matched!
          projectId = null;
          projectIds = strictMatches.map((p) => p.id);
          status = 'multi_matched';
          multiMatchedCount++;
        } else {
          // Multiple projects match on code, but none match on Jira (or no Jira refs provided) -> ambiguous
          projectId = null;
          projectIds = null;
          status = 'ambiguous';
          ambiguousCount++;
        }
      }

      // Update the row in the staging table
      const { error: updateError } = await this.supabase
        .from('roadmap_import_budget')
        .update({
          project_id: projectId,
          project_ids: projectIds,
          reconciliation_status: status,
        })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`Failed to update staging row ID ${row.id}: ${updateError.message}`);
      }
    }

    return {
      totalProcessed: stagingRows.length,
      matched: matchedCount,
      multiMatched: multiMatchedCount,
      ambiguous: ambiguousCount,
      unmapped: unmappedCount,
    };
  }
}
