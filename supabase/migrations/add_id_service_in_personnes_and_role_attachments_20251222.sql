-- Ajouter id_personne_serial à la table personne
ALTER TABLE personnes 
ADD COLUMN id_service INTEGER;

ALTER TABLE personnes
ADD CONSTRAINT fk_personnes_services 
FOREIGN KEY (id_service) REFERENCES services(id_service);

-- Ajouter id_personne_serial à la table personne
ALTER TABLE role_attachments
ADD COLUMN id_service INTEGER;

-- Ajouter la contrainte de clé étrangère
ALTER TABLE role_attachments
ADD CONSTRAINT fk_role_attachments_services 
FOREIGN KEY (id_service) REFERENCES services(id_service);