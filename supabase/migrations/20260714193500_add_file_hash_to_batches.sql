-- Migration: Add file_hash to roadmap_import_batches to detect duplicates
ALTER TABLE public.roadmap_import_batches ADD COLUMN IF NOT EXISTS file_hash TEXT;
