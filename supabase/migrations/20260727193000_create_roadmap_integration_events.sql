-- Migration: Table des événements d'intégration Roadmap
-- Domaine : Intégration Crewdayz -> Roadmap (Réception par Supabase Edge Function)

CREATE TABLE IF NOT EXISTS public.roadmap_integration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roadmap_integration_events_pkey PRIMARY KEY (id)
);

ALTER TABLE public.roadmap_integration_events OWNER TO postgres;

-- Index ultra-performant pour requêter le dernier événement par source en < 5ms
CREATE INDEX IF NOT EXISTS idx_roadmap_events_source_created 
ON public.roadmap_integration_events (source, created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.roadmap_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on integration events for authenticated users"
    ON public.roadmap_integration_events
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- Grants
GRANT SELECT ON TABLE public.roadmap_integration_events TO anon;
GRANT ALL ON TABLE public.roadmap_integration_events TO authenticated;
GRANT ALL ON TABLE public.roadmap_integration_events TO service_role;
