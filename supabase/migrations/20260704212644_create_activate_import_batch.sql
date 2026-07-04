-- Create table roadmap_service_mapping if it doesn't exist
CREATE TABLE IF NOT EXISTS public.roadmap_service_mapping (
  id bigint generated always as identity not null,
  service_id uuid not null,
  service_name text not null,
  created_at timestamp with time zone not null default now(),
  constraint roadmap_service_mapping_pkey primary key (id),
  constraint roadmap_service_mapping_service_name_key unique (service_name),
  constraint roadmap_service_mapping_service_id_fkey foreign KEY (service_id) references public.roadmap_services (id) on delete CASCADE
);

-- Enable RLS on roadmap_service_mapping
ALTER TABLE public.roadmap_service_mapping ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all operations for authenticated users on roadmap_service_mapping" ON public.roadmap_service_mapping;
CREATE POLICY "Allow all operations for authenticated users on roadmap_service_mapping" 
ON public.roadmap_service_mapping 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Postgres function to activate an import batch transactionally
CREATE OR REPLACE FUNCTION public.activate_import_batch(target_batch_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all other batches as inactive
  UPDATE public.roadmap_import_batches
  SET is_active = false
  WHERE id <> target_batch_id;

  -- Mark the selected batch as active
  UPDATE public.roadmap_import_batches
  SET is_active = true
  WHERE id = target_batch_id;
END;
$$;
