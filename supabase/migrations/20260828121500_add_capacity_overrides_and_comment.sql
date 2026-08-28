-- Migration: Ajout des surcharges de capacite (override_capacite, override_delta) et commentaire sur roadmap_capacites
-- Feature : SIDE-79 C-R Surcharge Capacites

ALTER TABLE public.roadmap_capacites
    ADD COLUMN IF NOT EXISTS override_capacite numeric NULL,
    ADD COLUMN IF NOT EXISTS override_delta numeric NULL,
    ADD COLUMN IF NOT EXISTS comment text NULL;

-- Documentation des colonnes
COMMENT ON COLUMN public.roadmap_capacites.override_capacite IS 'Capacite forcee en valeur absolue (ex: 1.5 ETP) pour les equipes en source Crewdayz';
COMMENT ON COLUMN public.roadmap_capacites.override_delta IS 'Ajustement relatif en plus ou en moins (+/- ETP) par rapport a la base calculee Crewdayz';
COMMENT ON COLUMN public.roadmap_capacites.comment IS 'Commentaire / justification textuelle de la saisie ou de la surcharge';
