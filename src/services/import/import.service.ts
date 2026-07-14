import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { QueryClient, injectQuery, injectMutation } from '@tanstack/angular-query-experimental';
import { paginateQuery } from '../../utils/supabase-pagination';
import { ChiffresService } from '../chiffres.service';
import { RoadmapReconciliator } from './RoadmapReconciliator';
import { DB_TABLES } from '../../constants/db-tables';

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

export interface ServiceMapping {
  id: number;
  service_id: string;
  service_name: string;
  created_at: string;
  updated_at?: string;
  roadmap_services?: {
    nom: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ImportService {
  private supabase = inject(SupabaseService);
  private queryClient = inject(QueryClient);
  private chiffresService = inject(ChiffresService);

  /**
   * Get all import batches
   */
  getBatchesQuery() {
    return injectQuery(() => ({
      queryKey: ['import-batches'],
      queryFn: async () => {
        return paginateQuery<ImportBatch>(() =>
          this.supabase.client
            .from(DB_TABLES.IMPORT_BATCHES)
            .select('*')
            .order('id', { ascending: false }),
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
            .from(DB_TABLES.IMPORT_BUDGET)
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
        // 1. Fetch the target row to get its project_code and batch_id
        const { data: targetRow, error: fetchError } = await this.supabase.client
          .from(DB_TABLES.IMPORT_BUDGET)
          .select('project_code, batch_id')
          .eq('id', rowId)
          .single();

        if (fetchError || !targetRow) {
          throw fetchError || new Error('Row not found');
        }

        const { project_code, batch_id } = targetRow;

        const updateData = {
          project_id: projectId,
          reconciliation_status: projectId ? 'matched' : 'unmapped',
          // Clear multi matched list if manually resolved
          project_ids: null,
        };

        // 2. Update all staging rows for this project_code in this batch
        const { data, error } = await this.supabase.client
          .from(DB_TABLES.IMPORT_BUDGET)
          .update(updateData)
          .eq('batch_id', batch_id)
          .eq('project_code', project_code)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No rows updated');

        return data[0] as ImportBudgetRow;
      },
      onSuccess: (data) => {
        // Invalidate the budget rows query to refetch updated staging rows
        this.queryClient.invalidateQueries({ queryKey: ['import-budget-rows', data.batch_id] });
      },
    }));
  }

  /**
   * Run auto-reconciliation on-demand for a specific batch ID
   */
  reconcileBatchMutation() {
    return injectMutation(() => ({
      mutationFn: async ({ batchId, onProgress }: { batchId: number; onProgress?: (progress: { current: number; total: number; percent: number }) => void }) => {
        const reconciliator = new RoadmapReconciliator(this.supabase.client);
        return await reconciliator.reconcile(batchId, onProgress);
      },
      onSuccess: (_, variables) => {
        // Invalidate the budget rows query to refetch updated staging rows
        this.queryClient.invalidateQueries({ queryKey: ['import-budget-rows', variables.batchId] });
      },
    }));
  }

  /**
   * Get all service mappings (local service <-> Triskell service name)
   */
  getServiceMappingsQuery() {
    return injectQuery(() => ({
      queryKey: ['service-mappings'],
      queryFn: async () => {
        const { data, error } = await this.supabase.client
          .from(DB_TABLES.SERVICE_MAPPINGS)
          .select('*, roadmap_services(nom)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ServiceMapping[];
      },
    }));
  }

  /**
   * Create a service mapping
   */
  createServiceMappingMutation() {
    return injectMutation(() => ({
      mutationFn: async (mapping: Omit<ServiceMapping, 'id' | 'created_at'>) => {
        const { data, error } = await this.supabase.client
          .from(DB_TABLES.SERVICE_MAPPINGS)
          .insert(mapping)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['service-mappings'] });
      },
    }));
  }

  /**
   * Update a service mapping
   */
  updateServiceMappingMutation() {
    return injectMutation(() => ({
      mutationFn: async ({ id, ...updates }: Partial<ServiceMapping> & { id: number }) => {
        const { data, error } = await this.supabase.client
          .from(DB_TABLES.SERVICE_MAPPINGS)
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['service-mappings'] });
      },
    }));
  }

  /**
   * Delete a service mapping
   */
  deleteServiceMappingMutation() {
    return injectMutation(() => ({
      mutationFn: async (id: number) => {
        const { error } = await this.supabase.client
          .from(DB_TABLES.SERVICE_MAPPINGS)
          .delete()
          .eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['service-mappings'] });
      },
    }));
  }

  /**
   * Activate an import batch (invokes activate_import_batch Postgres RPC)
   */
  activateBatchMutation() {
    return injectMutation(() => ({
      mutationFn: async (batchId: number) => {
        const { error } = await this.supabase.client.rpc('activate_import_batch', {
          target_batch_id: batchId,
        });
        if (error) throw error;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['import-batches'] });
        this.chiffresService.clearCache();
      },
    }));
  }

  /**
   * Deactivate an import batch
   */
  deactivateBatchMutation() {
    return injectMutation(() => ({
      mutationFn: async (batchId: number) => {
        const { error } = await this.supabase.client
          .from(DB_TABLES.IMPORT_BATCHES)
          .update({ is_active: false })
          .eq('id', batchId);
        if (error) throw error;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['import-batches'] });
        this.chiffresService.clearCache();
      },
    }));
  }

  /**
   * Delete an import batch
   */
  deleteBatchMutation() {
    return injectMutation(() => ({
      mutationFn: async (batchId: number) => {
        const { error } = await this.supabase.client
          .from(DB_TABLES.IMPORT_BATCHES)
          .delete()
          .eq('id', batchId);
        if (error) throw error;
      },
      onSuccess: () => {
        this.queryClient.invalidateQueries({ queryKey: ['import-batches'] });
        this.chiffresService.clearCache();
      },
    }));
  }

  /**
   * Get unique Triskell service names from the budget staging table
   * Implements pagination to handle > 1000 limit of PostgREST
   */
  getTriskellServiceNamesQuery() {
    return injectQuery(() => ({
      queryKey: ['triskell-service-names'],
      queryFn: async () => {
        let allRows: { service_name: string }[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await this.supabase.client
            .from(DB_TABLES.IMPORT_BUDGET)
            .select('service_name')
            .range(from, from + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allRows = allRows.concat(data);
            from += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        const names = allRows
          .map((r) => r.service_name)
          .filter((v, i, self) => v && self.indexOf(v) === i);
        names.sort();
        return names;
      },
    }));
  }
}
