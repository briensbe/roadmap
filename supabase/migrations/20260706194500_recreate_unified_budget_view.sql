-- Migration: Recreate v_roadmap_projet_budget_unifie to support multi-linked projects in staging
DROP VIEW IF EXISTS public.v_roadmap_projet_budget_unifie;

CREATE OR REPLACE VIEW public.v_roadmap_projet_budget_unifie AS
WITH active_batch AS (
  SELECT id FROM public.roadmap_import_batches WHERE is_active = true LIMIT 1
),
triskell_chiffres AS (
  SELECT 
    p.id AS id_projet,
    sm.service_id AS id_service,
    NULL::integer AS id_chiffres_local,
    p.nom_projet,
    s.nom AS nom_service,
    COALESCE(b.initial_jh, 0::numeric) AS initial,
    COALESCE(b.revised_jh, 0::numeric) AS revise,
    COALESCE(b.previsionnel_jh, 0::numeric) AS previsionnel,
    COALESCE(b.consomme_jh, 0::numeric) AS consomme,
    'TRISKELL'::text AS source_donnee,
    b.batch_id AS active_batch_id,
    b.project_id AS ppm_project_id,
    b.project_ids AS ppm_project_ids,
    b.jira_references
  FROM public.roadmap_import_budget b
  JOIN public.roadmap_service_mapping sm ON sm.service_name = b.service_name
  JOIN public.roadmap_projets p ON (
    p.id = b.project_id 
    OR (b.project_id IS NULL AND b.project_ids IS NOT NULL AND p.id = ANY(b.project_ids))
  )
  JOIN public.roadmap_services s ON s.id = sm.service_id
  WHERE b.batch_id = (SELECT id FROM active_batch)
),
local_chiffres AS (
  SELECT 
    p.id AS id_projet,
    s.id AS id_service,
    c.id_chiffres AS id_chiffres_local,
    p.nom_projet,
    s.nom AS nom_service,
    COALESCE(c.initial, 0::numeric) AS initial,
    COALESCE(c.revise, 0::numeric) AS revise,
    COALESCE(c.previsionnel, 0::numeric) AS previsionnel,
    COALESCE(c.consomme, 0::numeric) AS consomme,
    'LOCAL'::text AS source_donnee,
    (SELECT id FROM active_batch) AS active_batch_id,
    NULL::uuid AS ppm_project_id,
    NULL::uuid[] AS ppm_project_ids,
    NULL::text[] AS jira_references
  FROM public.roadmap_chiffres c
  JOIN public.roadmap_projets p ON p.id = c.id_projet
  JOIN public.roadmap_services s ON s.id = c.id_service
)
SELECT * FROM triskell_chiffres
UNION ALL
SELECT l.* FROM local_chiffres l
WHERE NOT EXISTS (
  SELECT 1 FROM triskell_chiffres t 
  WHERE t.id_projet = l.id_projet AND t.id_service = l.id_service
);

-- 3. Sécurité : La vue applique le RLS des tables de l'utilisateur connecté
ALTER VIEW public.v_roadmap_projet_budget_unifie SET (security_invoker = on);
