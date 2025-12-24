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
