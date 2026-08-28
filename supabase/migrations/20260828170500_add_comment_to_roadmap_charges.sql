-- Migration: Ajout du champ commentaire sur roadmap_charges
-- Feature: Saisie de commentaire sur les charges dans plan-view

ALTER TABLE public.roadmap_charges
    ADD COLUMN IF NOT EXISTS comment text NULL;

-- Documentation de la colonne
COMMENT ON COLUMN public.roadmap_charges.comment IS 'Commentaire / note textuelle optionnelle sur la charge de ressource';
