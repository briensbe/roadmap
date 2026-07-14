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

export interface ImportProgress {
  stage: 'reading' | 'creating_batch' | 'inserting' | 'reconciling';
  percent: number;
  current?: number;
  total?: number;
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
  public async processImport(
    filePath: string,
    filename: string,
    onProgress?: (progress: ImportProgress) => void,
    fileHash?: string
  ): Promise<ImportResult> {
    if (onProgress) onProgress({ stage: 'reading', percent: 0 });
    const parsedData = await this.reader.readFile(filePath);
    return this.executeImportWorkflow(parsedData, filename, onProgress, fileHash);
  }

  /**
   * Entrypoint to import an Excel file from an ArrayBuffer (browser context).
   */
  public async processImportBuffer(
    buffer: ArrayBuffer,
    filename: string,
    onProgress?: (progress: ImportProgress) => void,
    fileHash?: string
  ): Promise<ImportResult> {
    if (onProgress) onProgress({ stage: 'reading', percent: 0 });
    const parsedData = await this.reader.readArrayBuffer(buffer);
    return this.executeImportWorkflow(parsedData, filename, onProgress, fileHash);
  }

  private async executeImportWorkflow(
    parsedData: any,
    filename: string,
    onProgress?: (progress: ImportProgress) => void,
    fileHash?: string
  ): Promise<ImportResult> {
    let batchId: number | null = null;
    let excelExportDate: Date | null = null;

    try {
      excelExportDate = parsedData.excelExportDate;

      if (onProgress) onProgress({ stage: 'creating_batch', percent: 0 });

      // 2. Create the import batch tracking record (status = 'pending')
      const { data: batchData, error: batchError } = await this.supabase
        .from('roadmap_import_batches')
        .insert({
          excel_export_date: excelExportDate!.toISOString(),
          filename: filename,
          status: 'pending',
          is_active: false,
          file_hash: fileHash || null
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
      const stagingRowsWithBatch = stagingRows.map((row) => ({
        ...row,
        batch_id: batchId,
        reconciliation_status: 'pending',
      }));

      // 4. Bulk insert staging rows into roadmap_import_budget (chunked for safety)
      const chunkSize = 200;
      const totalRows = stagingRowsWithBatch.length;
      
      for (let i = 0; i < totalRows; i += chunkSize) {
        if (onProgress) {
          onProgress({
            stage: 'inserting',
            percent: Math.round((i / totalRows) * 100),
            current: i,
            total: totalRows
          });
        }

        const chunk = stagingRowsWithBatch.slice(i, i + chunkSize);
        const { error: insertError } = await this.supabase.from('roadmap_import_budget').insert(chunk);

        if (insertError) {
          throw new Error(`Failed to insert staging rows chunk (index ${i}): ${insertError.message}`);
        }
      }

      if (onProgress) {
        onProgress({
          stage: 'inserting',
          percent: 100,
          current: totalRows,
          total: totalRows
        });
      }

      if (!batchId || !excelExportDate) {
        throw new Error('Import state is invalid: missing batchId or excelExportDate');
      }

      // 5. Run the reconciliation process
      if (onProgress) onProgress({ stage: 'reconciling', percent: 0 });
      const reconciliationResult = await this.reconciliator.reconcile(batchId, (recProgress) => {
        if (onProgress) {
          onProgress({
            stage: 'reconciling',
            percent: recProgress.percent,
            current: recProgress.current,
            total: recProgress.total,
          });
        }
      });

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
        reconciliation: reconciliationResult,
      };
    } catch (error) {
      // If we created a batch, mark it as failed
      if (batchId) {
        await this.supabase.from('roadmap_import_batches').update({ status: 'failed' }).eq('id', batchId);
      }
      throw error;
    }
  }
}
