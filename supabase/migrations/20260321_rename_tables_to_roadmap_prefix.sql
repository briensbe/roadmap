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