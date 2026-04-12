-- Supprimer la contrainte unique sur code_projet pour autoriser plusieurs projets avec ce code externe pour le moment
ALTER TABLE public.projets 
DROP CONSTRAINT projets_code_projet_key; 