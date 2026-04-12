-- Ajout des colonnes à la table Services
ALTER TABLE Services
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

-- Ajout des colonnes à la table Equipes
ALTER TABLE Equipes
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

-- Ajout des colonnes à la table Personnes
ALTER TABLE Personnes
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

-- Ajout des colonnes à la table Roles
ALTER TABLE Roles
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

-- Ajout des colonnes à la table Societes
ALTER TABLE Societes
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

-- Ajout des colonnes à la table Departements
ALTER TABLE Departements
ADD COLUMN code VARCHAR(255),
ADD COLUMN color VARCHAR(255);

ALTER TABLE projets
ADD COLUMN color VARCHAR(255);

-- Fonction pour retourner une couleur aléatoire
CREATE OR REPLACE FUNCTION get_random_color()
RETURNS VARCHAR(255) AS $$
DECLARE
    colors VARCHAR[] := ARRAY['#3b82f6', '#06b6d4', '#84cc16', '#f59e0b', '#a855f7', '#6366f1', '#ec4899', '#14b8a6'];
    random_color VARCHAR(255);
BEGIN
    random_color := colors[FLOOR(1 + RANDOM() * array_length(colors, 1))];
    RETURN random_color;
END;
$$ LANGUAGE plpgsql;

-- Mise à jour de la table Projets
UPDATE projets SET color = get_random_color() WHERE color IS NULL OR color = '';