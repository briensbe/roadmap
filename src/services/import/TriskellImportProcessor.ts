import { SupabaseClient } from '@supabase/supabase-js';
import { ExcelReader } from './ExcelReader';
import { RoadmapTransformer } from './RoadmapTransformer';
import { RoadmapReconciliator, ReconciliationResult } from './RoadmapReconciliator';

export interface ImportResult {
  batchId: number;
  excelExportDate: Date;
  filename: string;
  totalRawRows: number;
  totalStagingRowsInserted: number;
  reconciliation: ReconciliationResult;
}

export class TriskellImportProcessor {
  private reader: ExcelReader;
  private transformer: RoadmapTransformer;
  private reconciliator: RoadmapReconciliator;

  constructor(private supabase: SupabaseClient) {
    this.reader = new ExcelReader();
    this.transformer = new RoadmapTransformer();
    this.reconciliator = new RoadmapReconciliator(supabase);
  }

  /**
   * Main entrypoint to import an Excel file.
   */
  public async processImport(filePath: string, filename: string): Promise<ImportResult> {
    const parsedData = await this.reader.readFile(filePath);
    return this.executeImportWorkflow(parsedData, filename);
  }

  /**
   * Entrypoint to import an Excel file from an ArrayBuffer (browser context).
   */
  public async processImportBuffer(buffer: ArrayBuffer, filename: string): Promise<ImportResult> {
    const parsedData = await this.reader.readArrayBuffer(buffer);
    return this.executeImportWorkflow(parsedData, filename);
  }

  private async executeImportWorkflow(parsedData: any, filename: string): Promise<ImportResult> {
    let batchId: number | null = null;
    let excelExportDate: Date | null = null;

    try {
      excelExportDate = parsedData.excelExportDate;

      // 2. Create the import batch tracking record (status = 'pending')
      const { data: batchData, error: batchError } = await this.supabase
        .from('roadmap_import_batches')
        .insert({
          excel_export_date: excelExportDate!.toISOString(),
          filename: filename,
          status: 'pending'
        })
        .select('id')
        .single();

      if (batchError || !batchData) {
        throw new Error(`Failed to create import batch record: ${batchError?.message}`);
      }

      batchId = batchData.id;

      // 3. Transform (unpivot) the parsed rows
      const stagingRows = this.transformer.transform(parsedData.rows);

      // Attach batch_id to all staging rows
      const stagingRowsWithBatch = stagingRows.map(row => ({
        ...row,
        batch_id: batchId,
        reconciliation_status: 'pending'
      }));

      // 4. Bulk insert staging rows into roadmap_import_budget (chunked for safety)
      const chunkSize = 200;
      for (let i = 0; i < stagingRowsWithBatch.length; i += chunkSize) {
        const chunk = stagingRowsWithBatch.slice(i, i + chunkSize);
        const { error: insertError } = await this.supabase
          .from('roadmap_import_budget')
          .insert(chunk);

        if (insertError) {
          throw new Error(`Failed to insert staging rows chunk (index ${i}): ${insertError.message}`);
        }
      }

      if (!batchId || !excelExportDate) {
        throw new Error('Import state is invalid: missing batchId or excelExportDate');
      }

      // 5. Run the reconciliation process
      const reconciliationResult = await this.reconciliator.reconcile(batchId);

      // 6. Mark batch as processed
      const { error: finalizeError } = await this.supabase
        .from('roadmap_import_batches')
        .update({ status: 'processed' })
        .eq('id', batchId);

      if (finalizeError) {
        throw new Error(`Failed to update batch status to processed: ${finalizeError.message}`);
      }

      return {
        batchId,
        excelExportDate,
        filename,
        totalRawRows: parsedData.rows.length,
        totalStagingRowsInserted: stagingRowsWithBatch.length,
        reconciliation: reconciliationResult
      };

    } catch (error) {
      // If we created a batch, mark it as failed
      if (batchId) {
        await this.supabase
          .from('roadmap_import_batches')
          .update({ status: 'failed' })
          .eq('id', batchId);
      }
      throw error;
    }
  }
}
