import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { QueryClient, injectQuery, injectMutation } from '@tanstack/angular-query-experimental';
import { paginateQuery } from '../../utils/supabase-pagination';

export interface ImportBatch {
  id: number;
  created_at: string;
  excel_export_date: string;
  filename: string;
  status: 'pending' | 'processed' | 'failed';
  imported_at?: string;
  is_active: boolean;
}

export interface ImportBudgetRow {
  id: number;
  batch_id: number;
  budget_type: string | null;
  budget_nomenclature: string | null;
  budget_object: string | null;
  activity_type: string | null;
  project_code: string;
  project_name: string | null;
  project_manager: string | null;
  project_status: string | null;
  jira_references: string[] | null;
  service_name: string;
  initial_jh: number | null;
  revised_jh: number | null;
  previsionnel_jh: number | null;
  consomme_jh: number | null;
  project_id: string | null;
  reconciliation_status: 'matched' | 'multi_matched' | 'ambiguous' | 'unmapped';
  project_ids: string[] | null;
}

@Injectable({
  providedIn: 'root',
})
export class ImportService {
  private supabase = inject(SupabaseService);
  private queryClient = inject(QueryClient);

  /**
   * Get all import batches
   */
  getBatchesQuery() {
    return injectQuery(() => ({
      queryKey: ['import-batches'],
      queryFn: async () => {
        return paginateQuery<ImportBatch>(() =>
          this.supabase.client
            .from('roadmap_import_batches')
            .select('*')
            .order('excel_export_date', { ascending: false }),
        );
      },
    }));
  }

  /**
   * Get budget rows for a specific batch (passing a function to evaluate batchId reactively within injection context)
   */
  getBudgetRowsQuery(batchIdFn: () => number | null) {
    return injectQuery(() => ({
      queryKey: ['import-budget-rows', batchIdFn()],
      queryFn: async () => {
        const id = batchIdFn();
        if (id === null || id === undefined) return [];
        return paginateQuery<ImportBudgetRow>(() =>
          this.supabase.client
            .from('roadmap_import_budget')
            .select('*')
            .eq('batch_id', id)
            .order('project_code', { ascending: true }),
        );
      },
      enabled: !!batchIdFn(),
    }));
  }

  /**
   * Manually reconciles a staging row with a specific Roadmap project
   */
  reconcileRowMutation() {
    return injectMutation(() => ({
      mutationFn: async ({ rowId, projectId }: { rowId: number; projectId: string | null }) => {
        // If projectId is null, we unmap the row (set status to unmapped)
        const updateData: Partial<ImportBudgetRow> = {
          project_id: projectId,
          reconciliation_status: projectId ? 'matched' : 'unmapped',
          // Clear multi matched list if manually resolved
          project_ids: null,
        };

        const { data, error } = await this.supabase.client
          .from('roadmap_import_budget')
          .update(updateData)
          .eq('id', rowId)
          .select()
          .single();

        if (error) throw error;
        return data as ImportBudgetRow;
      },
      onSuccess: (data) => {
        // Invalidate the budget rows query to refetch updated staging rows
        this.queryClient.invalidateQueries({ queryKey: ['import-budget-rows', data.batch_id] });
      },
    }));
  }
}
