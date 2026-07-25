-- Migration: Table de configuration de la source de capacité par équipe
-- Domaine : intégration Crewdayz
-- Une ligne par équipe (optionnel — absence = 'roadmap' par défaut)

CREATE TABLE IF NOT EXISTS public.roadmap_capacity_source_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipe_id uuid NOT NULL,
    capacity_source text NOT NULL DEFAULT 'roadmap',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roadmap_capacity_source_config_pkey PRIMARY KEY (id),
    CONSTRAINT roadmap_capacity_source_config_equipe_id_key UNIQUE (equipe_id),
    CONSTRAINT roadmap_capacity_source_config_source_check CHECK (
        capacity_source IN ('roadmap', 'crewdayz')
    ),
    CONSTRAINT roadmap_capacity_source_config_equipe_fk
        FOREIGN KEY (equipe_id)
        REFERENCES public.roadmap_equipes(id)
        ON DELETE CASCADE
);

ALTER TABLE public.roadmap_capacity_source_config OWNER TO postgres;

-- RLS
ALTER TABLE public.roadmap_capacity_source_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on capacity_source_config"
    ON public.roadmap_capacity_source_config
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grants
GRANT ALL ON TABLE public.roadmap_capacity_source_config TO anon;
GRANT ALL ON TABLE public.roadmap_capacity_source_config TO authenticated;
GRANT ALL ON TABLE public.roadmap_capacity_source_config TO service_role;
