-- Migration: Création de la table roadmap_user_preferences pour la persistance des préférences utilisateur dans le schéma public
CREATE TABLE IF NOT EXISTS public.roadmap_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activation de RLS
ALTER TABLE public.roadmap_user_preferences ENABLE ROW LEVEL SECURITY;

-- Politiques RLS utilisateur (accès uniquement à ses propres préférences)
CREATE POLICY "Users can view and manage their own preferences"
  ON public.roadmap_user_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger de mise à jour automatique de updated_at (utilise public.update_updated_at())
DROP TRIGGER IF EXISTS trg_roadmap_user_preferences_updated_at ON public.roadmap_user_preferences;
CREATE TRIGGER trg_roadmap_user_preferences_updated_at
  BEFORE UPDATE ON public.roadmap_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
