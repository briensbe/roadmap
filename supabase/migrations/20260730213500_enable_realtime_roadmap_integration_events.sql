-- Migration: Activation de Supabase Realtime sur roadmap_integration_events
-- Permet d'écouter les insertions/modifications en temps réel dans l'application Angular pour invalider le cache sans polling/requêtes SELECT.

ALTER PUBLICATION supabase_realtime ADD TABLE public.roadmap_integration_events;
