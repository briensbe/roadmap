-- Migration to add updated_at to several tables, backfill with created_at, and attach table-specific triggers

-- Function to handle table ALTER and backfill
DO $$
BEGIN
    -- 1. Alter tables to add updated_at as nullable first
    ALTER TABLE public.roadmap_role_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.roadmap_equipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.roadmap_departements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.roadmap_personnes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.roadmap_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.roadmap_service_mapping ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

    -- 2. Backfill existing rows with created_at (or now() if created_at is null)
    UPDATE public.roadmap_role_attachments SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
    UPDATE public.roadmap_equipes SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
    UPDATE public.roadmap_departements SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
    UPDATE public.roadmap_personnes SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
    UPDATE public.roadmap_roles SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
    UPDATE public.roadmap_service_mapping SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;

    -- 3. Set DEFAULT and NOT NULL constraints
    ALTER TABLE public.roadmap_role_attachments ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_role_attachments ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE public.roadmap_equipes ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_equipes ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE public.roadmap_departements ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_departements ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE public.roadmap_personnes ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_personnes ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE public.roadmap_roles ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_roles ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE public.roadmap_service_mapping ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE public.roadmap_service_mapping ALTER COLUMN updated_at SET NOT NULL;
END $$;

-- 4. Clean up generic or old triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_role_attachments;
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_equipes;
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_departements;
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_personnes;
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_roles;
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.roadmap_service_mapping;

-- 5. Drop and recreate table-specific triggers
DROP TRIGGER IF EXISTS trg_roadmap_role_attachments_updated_at ON public.roadmap_role_attachments;
CREATE TRIGGER trg_roadmap_role_attachments_updated_at
  BEFORE UPDATE ON public.roadmap_role_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_roadmap_equipes_updated_at ON public.roadmap_equipes;
CREATE TRIGGER trg_roadmap_equipes_updated_at
  BEFORE UPDATE ON public.roadmap_equipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_roadmap_departements_updated_at ON public.roadmap_departements;
CREATE TRIGGER trg_roadmap_departements_updated_at
  BEFORE UPDATE ON public.roadmap_departements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_roadmap_personnes_updated_at ON public.roadmap_personnes;
CREATE TRIGGER trg_roadmap_personnes_updated_at
  BEFORE UPDATE ON public.roadmap_personnes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_roadmap_roles_updated_at ON public.roadmap_roles;
CREATE TRIGGER trg_roadmap_roles_updated_at
  BEFORE UPDATE ON public.roadmap_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_roadmap_service_mapping_updated_at ON public.roadmap_service_mapping;
CREATE TRIGGER trg_roadmap_service_mapping_updated_at
  BEFORE UPDATE ON public.roadmap_service_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
