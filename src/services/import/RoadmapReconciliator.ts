import { SupabaseClient } from '@supabase/supabase-js';

export interface ReconciliationResult {
  totalProcessed: number;
  matched: number;
  ambiguous: number;
  unmapped: number;
}

export class RoadmapReconciliator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Reconciles staging rows for the given batch with production projects.
   */
  public async reconcile(batchId: string): Promise<ReconciliationResult> {
    // 1. Fetch all staging rows for this batch
    const { data: stagingRows, error: stagingError } = await this.supabase
      .from('roadmap_import_budget')
      .select('id, project_code, project_name, jira_references')
      .eq('batch_id', batchId);

    if (stagingError) {
      throw new Error(`Failed to fetch staging rows: ${stagingError.message}`);
    }

    if (!stagingRows || stagingRows.length === 0) {
      return { totalProcessed: 0, matched: 0, ambiguous: 0, unmapped: 0 };
    }

    // Get all unique project codes in the staging table
    const uniqueProjectCodes = Array.from(new Set(stagingRows.map(r => r.project_code)));

    // 2. Fetch all matching projects from roadmap_projets
    const { data: dbProjects, error: projectsError } = await this.supabase
      .from('roadmap_projets')
      .select('id, code_projet, reference_externe')
      .in('code_projet', uniqueProjectCodes);

    if (projectsError) {
      throw new Error(`Failed to fetch production projects: ${projectsError.message}`);
    }

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
    let ambiguousCount = 0;
    let unmappedCount = 0;

    // We'll prepare bulk updates if possible, or update rows one by one.
    // Since this is a staging/batch processor run weekly, updating row-by-row or in batches is perfect.
    for (const row of stagingRows) {
      const code = row.project_code;
      const matchedDb = dbProjectsByCode[code] || [];
      const sameCodeStaging = stagingRowsByCode[code] || [];

      // Determine if there are multiple distinct project names in Excel sharing this code
      const distinctProjectNames = Array.from(new Set(sameCodeStaging.map(r => r.project_name)));
      const multipleExcelProjects = distinctProjectNames.length > 1;

      let projectId: string | null = null;
      let status: 'matched' | 'ambiguous' | 'unmapped' = 'unmapped';

      if (matchedDb.length === 0) {
        // No match in production database
        projectId = null;
        status = 'unmapped';
        unmappedCount++;
      } else if (matchedDb.length === 1 && !multipleExcelProjects) {
        // Perfect 1-to-1 match (allowing multiple services of the same project)
        projectId = matchedDb[0].id;
        status = 'matched';
        matchedCount++;
      } else {
        // Ambiguity exists (either multiple projects in DB or multiple distinct projects in Excel share this code)
        // Try strict matching using Jira references
        const rowJiras = row.jira_references || [];
        
        // Find DB projects where the reference_externe matches one of the row's Jira keys
        const strictMatches = matchedDb.filter(p => 
          p.reference_externe && rowJiras.includes(p.reference_externe)
        );

        if (strictMatches.length === 1) {
          // Check if any other distinct project in Excel with this code also matches the same DB project
          // (i.e. another staging row with a different project name matches the same project)
          const otherConflictingRows = sameCodeStaging.filter(otherRow => {
            if (otherRow.project_name === row.project_name) return false; // same project, not a conflict
            const otherJiras = otherRow.jira_references || [];
            return otherJiras.includes(strictMatches[0].reference_externe || '');
          });

          if (otherConflictingRows.length === 0) {
            // We resolved it uniquely!
            projectId = strictMatches[0].id;
            status = 'matched';
            matchedCount++;
          } else {
            // Multiple distinct projects match the same database project
            projectId = null;
            status = 'ambiguous';
            ambiguousCount++;
          }
        } else {
          // No strict matches or multiple strict matches
          projectId = null;
          status = 'ambiguous';
          ambiguousCount++;
        }
      }


      // Update the row in the staging table
      const { error: updateError } = await this.supabase
        .from('roadmap_import_budget')
        .update({
          project_id: projectId,
          reconciliation_status: status
        })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`Failed to update staging row ID ${row.id}: ${updateError.message}`);
      }
    }

    return {
      totalProcessed: stagingRows.length,
      matched: matchedCount,
      ambiguous: ambiguousCount,
      unmapped: unmappedCount
    };
  }
}
