-- Migration to rename all tables with the "roadmap_" prefix

ALTER TABLE IF EXISTS capacites RENAME TO roadmap_capacites;
ALTER TABLE IF EXISTS charges RENAME TO roadmap_charges;
ALTER TABLE IF EXISTS chiffres RENAME TO roadmap_chiffres;
ALTER TABLE IF EXISTS departements RENAME TO roadmap_departements;
ALTER TABLE IF EXISTS equipes RENAME TO roadmap_equipes;
ALTER TABLE IF EXISTS equipes_projets RENAME TO roadmap_equipes_projets;
ALTER TABLE IF EXISTS jalons RENAME TO roadmap_jalons;
ALTER TABLE IF EXISTS personnes RENAME TO roadmap_personnes;
ALTER TABLE IF EXISTS personne_roles RENAME TO roadmap_personne_roles;
ALTER TABLE IF EXISTS projets RENAME TO roadmap_projets;
ALTER TABLE IF EXISTS release_notes RENAME TO roadmap_release_notes;
ALTER TABLE IF EXISTS role_attachments RENAME TO roadmap_role_attachments;
ALTER TABLE IF EXISTS roles RENAME TO roadmap_roles;
ALTER TABLE IF EXISTS services RENAME TO roadmap_services;
ALTER TABLE IF EXISTS settings RENAME TO roadmap_settings;
ALTER TABLE IF EXISTS societes RENAME TO roadmap_societes;
ALTER TABLE IF EXISTS custom_fields RENAME TO roadmap_custom_fields;
ALTER TABLE IF EXISTS custom_field_values RENAME TO roadmap_custom_field_values;

-- migration des clés étrangères

-- 1. Corrections pour la table ROADMAP_CAPACITES
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_departement_id_fkey, ADD CONSTRAINT roadmap_capacites_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES roadmap_departements(id) ON DELETE CASCADE;
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_equipe_id_fkey, ADD CONSTRAINT roadmap_capacites_equipe_id_fkey FOREIGN KEY (equipe_id) REFERENCES roadmap_equipes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_personne_id_fkey, ADD CONSTRAINT roadmap_capacites_personne_id_fkey FOREIGN KEY (personne_id) REFERENCES roadmap_personnes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_role_id_fkey, ADD CONSTRAINT roadmap_capacites_role_id_fkey FOREIGN KEY (role_id) REFERENCES roadmap_roles(id) ON DELETE CASCADE;
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_service_id_fkey, ADD CONSTRAINT roadmap_capacites_service_id_fkey FOREIGN KEY (service_id) REFERENCES roadmap_services(id) ON DELETE CASCADE;
ALTER TABLE roadmap_capacites DROP CONSTRAINT IF EXISTS capacites_societe_id_fkey, ADD CONSTRAINT roadmap_capacites_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES roadmap_societes(id) ON DELETE CASCADE;

-- 2. Corrections pour la table ROADMAP_CHARGES
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_departement_id_fkey, ADD CONSTRAINT roadmap_charges_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES roadmap_departements(id) ON DELETE SET NULL;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_equipe_id_fkey, ADD CONSTRAINT roadmap_charges_equipe_id_fkey FOREIGN KEY (equipe_id) REFERENCES roadmap_equipes(id) ON DELETE SET NULL;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_personne_id_fkey, ADD CONSTRAINT roadmap_charges_personne_id_fkey FOREIGN KEY (personne_id) REFERENCES roadmap_personnes(id) ON DELETE SET NULL;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_projet_id_fkey, ADD CONSTRAINT roadmap_charges_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES roadmap_projets(id) ON DELETE CASCADE;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_role_id_fkey, ADD CONSTRAINT roadmap_charges_role_id_fkey FOREIGN KEY (role_id) REFERENCES roadmap_roles(id) ON DELETE SET NULL;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_service_id_fkey, ADD CONSTRAINT roadmap_charges_service_id_fkey FOREIGN KEY (service_id) REFERENCES roadmap_services(id) ON DELETE SET NULL;
ALTER TABLE roadmap_charges DROP CONSTRAINT IF EXISTS charges_societe_id_fkey, ADD CONSTRAINT roadmap_charges_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES roadmap_societes(id) ON DELETE SET NULL;

-- 3. Corrections pour la table ROADMAP_CHIFFRES
ALTER TABLE roadmap_chiffres DROP CONSTRAINT IF EXISTS chiffres_id_projet_fkey, ADD CONSTRAINT roadmap_chiffres_id_projet_fkey FOREIGN KEY (id_projet) REFERENCES roadmap_projets(id_projet) ON DELETE CASCADE;
ALTER TABLE roadmap_chiffres DROP CONSTRAINT IF EXISTS chiffres_id_service_fkey, ADD CONSTRAINT roadmap_chiffres_id_service_fkey FOREIGN KEY (id_service) REFERENCES roadmap_services(id_service) ON DELETE CASCADE;

-- 4. Corrections pour ROADMAP_EQUIPES et ROADMAP_DEPARTEMENTS
ALTER TABLE roadmap_departements DROP CONSTRAINT IF EXISTS departements_societe_id_fkey, ADD CONSTRAINT roadmap_departements_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES roadmap_societes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_equipes DROP CONSTRAINT IF EXISTS equipes_departement_id_fkey, ADD CONSTRAINT roadmap_equipes_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES roadmap_departements(id) ON DELETE SET NULL;
ALTER TABLE roadmap_equipes DROP CONSTRAINT IF EXISTS equipes_service_id_fkey, ADD CONSTRAINT roadmap_equipes_service_id_fkey FOREIGN KEY (service_id) REFERENCES roadmap_services(id) ON DELETE SET NULL;

-- 5. Corrections pour ROADMAP_EQUIPES_PROJETS (Table de liaison)
ALTER TABLE roadmap_equipes_projets DROP CONSTRAINT IF EXISTS equipes_projets_equipe_id_fkey, ADD CONSTRAINT roadmap_equipes_projets_equipe_id_fkey FOREIGN KEY (equipe_id) REFERENCES roadmap_equipes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_equipes_projets DROP CONSTRAINT IF EXISTS equipes_projets_projet_id_fkey, ADD CONSTRAINT roadmap_equipes_projets_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES roadmap_projets(id) ON DELETE CASCADE;

-- 6. Corrections pour ROADMAP_PERSONNES
ALTER TABLE roadmap_personnes DROP CONSTRAINT IF EXISTS fk_personnes_services, ADD CONSTRAINT roadmap_personnes_id_service_fkey FOREIGN KEY (id_service) REFERENCES roadmap_services(id_service);
ALTER TABLE roadmap_personnes DROP CONSTRAINT IF EXISTS personnes_departement_id_fkey, ADD CONSTRAINT roadmap_personnes_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES roadmap_departements(id) ON DELETE SET NULL;
ALTER TABLE roadmap_personnes DROP CONSTRAINT IF EXISTS personnes_equipe_id_fkey, ADD CONSTRAINT roadmap_personnes_equipe_id_fkey FOREIGN KEY (equipe_id) REFERENCES roadmap_equipes(id) ON DELETE SET NULL;
ALTER TABLE roadmap_personnes DROP CONSTRAINT IF EXISTS personnes_service_id_fkey, ADD CONSTRAINT roadmap_personnes_service_id_fkey FOREIGN KEY (service_id) REFERENCES roadmap_services(id) ON DELETE SET NULL;
ALTER TABLE roadmap_personnes DROP CONSTRAINT IF EXISTS personnes_societe_id_fkey, ADD CONSTRAINT roadmap_personnes_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES roadmap_societes(id) ON DELETE SET NULL;

-- 7. Corrections pour ROADMAP_PERSONNE_ROLES et ROADMAP_ROLE_ATTACHMENTS
ALTER TABLE roadmap_personne_roles DROP CONSTRAINT IF EXISTS personne_roles_personne_id_fkey, ADD CONSTRAINT roadmap_personne_roles_personne_id_fkey FOREIGN KEY (personne_id) REFERENCES roadmap_personnes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_personne_roles DROP CONSTRAINT IF EXISTS personne_roles_role_id_fkey, ADD CONSTRAINT roadmap_personne_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roadmap_roles(id) ON DELETE CASCADE;

ALTER TABLE roadmap_role_attachments DROP CONSTRAINT IF EXISTS role_attachments_role_id_fkey, ADD CONSTRAINT roadmap_role_attachments_role_id_fkey FOREIGN KEY (role_id) REFERENCES roadmap_roles(id) ON DELETE CASCADE;
ALTER TABLE roadmap_role_attachments DROP CONSTRAINT IF EXISTS role_attachments_equipe_id_fkey, ADD CONSTRAINT roadmap_role_attachments_equipe_id_fkey FOREIGN KEY (equipe_id) REFERENCES roadmap_equipes(id) ON DELETE CASCADE;
ALTER TABLE roadmap_role_attachments DROP CONSTRAINT IF EXISTS fk_role_attachments_services, ADD CONSTRAINT roadmap_role_attachments_id_service_fkey FOREIGN KEY (id_service) REFERENCES roadmap_services(id_service);

-- 8. Corrections pour ROADMAP_SERVICES et ROADMAP_JALONS
ALTER TABLE roadmap_services DROP CONSTRAINT IF EXISTS services_departement_id_fkey, ADD CONSTRAINT roadmap_services_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES roadmap_departements(id) ON DELETE CASCADE;
ALTER TABLE roadmap_jalons DROP CONSTRAINT IF EXISTS jalons_projet_id_fkey, ADD CONSTRAINT roadmap_jalons_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES roadmap_projets(id) ON DELETE CASCADE;

-- 9. CUSTOM FIELDS
ALTER TABLE roadmap_custom_field_values DROP CONSTRAINT IF EXISTS custom_field_values_custom_field_id_fkey, ADD CONSTRAINT roadmap_custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES roadmap_custom_fields(id) ON DELETE CASCADE;




