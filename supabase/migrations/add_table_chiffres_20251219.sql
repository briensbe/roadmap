-- 1. Ajouter la nouvelle colonne id_projet
ALTER TABLE projets ADD COLUMN id_projet SERIAL;
-- 1. Ajouter la nouvelle colonne id_service
ALTER TABLE services ADD COLUMN id_service SERIAL;

--contrainte d'unicité nécessaires (en attendant de passer PRIMARY KEY un jour) 
ALTER TABLE projets ADD CONSTRAINT projets_id_projet_unique UNIQUE (id_projet);
ALTER TABLE services ADD CONSTRAINT services_id_service_unique UNIQUE (id_service);

-- Table CHIFFRES
CREATE TABLE chiffres (
    id_chiffres SERIAL PRIMARY KEY,
    id_projet INTEGER NOT NULL,
    id_service INTEGER NOT NULL,
    initial DECIMAL(15, 3),
    revise DECIMAL(15, 3),
    previsionnel DECIMAL(15, 3),
    consomme DECIMAL(15, 3),
    date_mise_a_jour TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_projet) REFERENCES projets(id_projet) ON DELETE CASCADE,
    FOREIGN KEY (id_service) REFERENCES services(id_service) ON DELETE CASCADE,
    UNIQUE(id_projet, id_service)
);


-- Création des index pour les performances
CREATE INDEX idx_chiffres_projet ON chiffres(id_projet);
CREATE INDEX idx_chiffres_service ON chiffres(id_service);

-- activation de la sécurité RLS
ALTER TABLE chiffres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on chiffres"
  ON chiffres FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);