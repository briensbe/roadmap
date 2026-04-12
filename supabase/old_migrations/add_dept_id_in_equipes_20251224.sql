-- 1. Supprimer la contrainte de clé étrangère existante
ALTER TABLE public.equipes DROP CONSTRAINT equipes_service_id_fkey;

-- 2. Rendre la colonne service_id nullable
ALTER TABLE public.equipes ALTER COLUMN service_id DROP NOT NULL;

-- 3. Ajouter la colonne department_id de type UUID
ALTER TABLE public.equipes ADD COLUMN departement_id UUID;

-- 4. Recréer la contrainte de clé étrangère pour service_id
ALTER TABLE public.equipes
ADD CONSTRAINT equipes_service_id_fkey
FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

ALTER TABLE public.equipes
ADD CONSTRAINT equipes_departement_id_fkey
FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE SET NULL;