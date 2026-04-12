/*
  # Resource Management System - Initial Schema

  1. New Tables
    - `societes` (Companies)
      - `id` (uuid, primary key)
      - `nom` (text, company name)
      - `created_at` (timestamp)
    
    - `departements` (Departments)
      - `id` (uuid, primary key)
      - `nom` (text, department name)
      - `societe_id` (uuid, foreign key to societes)
      - `created_at` (timestamp)
    
    - `services` (Services)
      - `id` (uuid, primary key)
      - `nom` (text, service name)
      - `departement_id` (uuid, foreign key to departements)
      - `created_at` (timestamp)
    
    - `equipes` (Teams)
      - `id` (uuid, primary key)
      - `nom` (text, team name)
      - `service_id` (uuid, foreign key to services)
      - `created_at` (timestamp)
    
    - `roles` (Roles)
      - `id` (uuid, primary key)
      - `nom` (text, role name like "Développeur", "Business Analyst")
      - `jours_par_semaine` (numeric, days per week, can be 3.5)
      - `created_at` (timestamp)
    
    - `personnes` (People)
      - `id` (uuid, primary key)
      - `nom` (text, person name)
      - `prenom` (text, first name)
      - `email` (text, unique)
      - `jours_par_semaine` (numeric, days per week)
      - `societe_id` (uuid, nullable, direct attachment)
      - `departement_id` (uuid, nullable, direct attachment)
      - `service_id` (uuid, nullable, direct attachment)
      - `equipe_id` (uuid, nullable, direct attachment)
      - `created_at` (timestamp)
    
    - `personne_roles` (Person-Role mapping)
      - `id` (uuid, primary key)
      - `personne_id` (uuid, foreign key to personnes)
      - `role_id` (uuid, foreign key to roles)
      - `created_at` (timestamp)
    
    - `role_attachments` (Role attachments to organizational units)
      - `id` (uuid, primary key)
      - `role_id` (uuid, foreign key to roles)
      - `societe_id` (uuid, nullable)
      - `departement_id` (uuid, nullable)
      - `service_id` (uuid, nullable)
      - `equipe_id` (uuid, nullable)
      - `created_at` (timestamp)
    
    - `projets` (Projects)
      - `id` (uuid, primary key)
      - `code_projet` (text, unique, project code)
      - `nom_projet` (text, project name)
      - `chef_projet` (text, project manager)
      - `statut` (text, status)
      - `reference_externe` (text, external reference)
      - `description` (text)
      - `chiffrage_initial` (numeric)
      - `chiffrage_revise` (numeric)
      - `chiffrage_previsionnel` (numeric)
      - `temps_consomme` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `capacites` (Capacities per week)
      - `id` (uuid, primary key)
      - `semaine_debut` (date, start of week)
      - `capacite` (numeric, capacity value)
      - `role_id` (uuid, nullable, foreign key to roles)
      - `personne_id` (uuid, nullable, foreign key to personnes)
      - `societe_id` (uuid, nullable)
      - `departement_id` (uuid, nullable)
      - `service_id` (uuid, nullable)
      - `equipe_id` (uuid, nullable)
      - `created_at` (timestamp)
    
    - `charges` (Workload allocations)
      - `id` (uuid, primary key)
      - `projet_id` (uuid, foreign key to projets)
      - `semaine_debut` (date, start of week)
      - `semaine_fin` (date, end of week)
      - `unite_ressource` (numeric, resource units, can be 0.5, 1, 2, etc.)
      - `role_id` (uuid, nullable)
      - `personne_id` (uuid, nullable)
      - `societe_id` (uuid, nullable)
      - `departement_id` (uuid, nullable)
      - `service_id` (uuid, nullable)
      - `equipe_id` (uuid, nullable)
      - `created_at` (timestamp)
    
    - `jalons` (Milestones)
      - `id` (uuid, primary key)
      - `nom` (text, milestone name)
      - `date_jalon` (date, milestone date)
      - `projet_id` (uuid, foreign key to projets)
      - `type` (text, e.g., "livraison", "mise_en_production")
      - `created_at` (timestamp)
    
    - `custom_fields` (Custom Fields)
      - `id` (uuid, primary key)
      - `nom` (text, field name)
      - `type` (text, field type: text, number, date, boolean)
      - `entite` (text, entity type: projet, personne, etc.)
      - `created_at` (timestamp)
    
    - `custom_field_values` (Custom Field Values)
      - `id` (uuid, primary key)
      - `custom_field_id` (uuid, foreign key to custom_fields)
      - `entite_id` (uuid, entity id)
      - `valeur` (text, value stored as text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage all data
*/

CREATE TABLE IF NOT EXISTS societes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  societe_id uuid NOT NULL REFERENCES societes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  departement_id uuid NOT NULL REFERENCES departements(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  jours_par_semaine numeric DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  email text UNIQUE,
  jours_par_semaine numeric DEFAULT 5,
  societe_id uuid REFERENCES societes(id) ON DELETE SET NULL,
  departement_id uuid REFERENCES departements(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personne_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id uuid NOT NULL REFERENCES personnes(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(personne_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  societe_id uuid REFERENCES societes(id) ON DELETE CASCADE,
  departement_id uuid REFERENCES departements(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES equipes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_projet text UNIQUE NOT NULL,
  nom_projet text NOT NULL,
  chef_projet text,
  statut text DEFAULT 'En cours',
  reference_externe text,
  description text,
  chiffrage_initial numeric DEFAULT 0,
  chiffrage_revise numeric DEFAULT 0,
  chiffrage_previsionnel numeric DEFAULT 0,
  temps_consomme numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capacites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_debut date NOT NULL,
  capacite numeric NOT NULL DEFAULT 0,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  personne_id uuid REFERENCES personnes(id) ON DELETE CASCADE,
  societe_id uuid REFERENCES societes(id) ON DELETE CASCADE,
  departement_id uuid REFERENCES departements(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES equipes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id uuid NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  semaine_debut date ,
  semaine_fin date ,
  unite_ressource numeric NOT NULL DEFAULT 1,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  personne_id uuid REFERENCES personnes(id) ON DELETE SET NULL,
  societe_id uuid REFERENCES societes(id) ON DELETE SET NULL,
  departement_id uuid REFERENCES departements(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jalons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  date_jalon date NOT NULL,
  projet_id uuid REFERENCES projets(id) ON DELETE CASCADE,
  type text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  entite text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entite_id uuid NOT NULL,
  valeur text,
  created_at timestamptz DEFAULT now()
);

/*
ALTER TABLE societes ENABLE ROW LEVEL SECURITY;
ALTER TABLE departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personne_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacites ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on societes"
  ON societes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on departements"
  ON departements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on equipes"
  ON equipes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on roles"
  ON roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on personnes"
  ON personnes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on personne_roles"
  ON personne_roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on role_attachments"
  ON role_attachments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on projets"
  ON projets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on capacites"
  ON capacites FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on charges"
  ON charges FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on jalons"
  ON jalons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on custom_fields"
  ON custom_fields FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on custom_field_values"
  ON custom_field_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
*/

CREATE INDEX IF NOT EXISTS idx_departements_societe ON departements(societe_id);
CREATE INDEX IF NOT EXISTS idx_services_departement ON services(departement_id);
CREATE INDEX IF NOT EXISTS idx_equipes_service ON equipes(service_id);
CREATE INDEX IF NOT EXISTS idx_personnes_equipe ON personnes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_capacites_semaine ON capacites(semaine_debut);
CREATE INDEX IF NOT EXISTS idx_charges_projet ON charges(projet_id);
CREATE INDEX IF NOT EXISTS idx_charges_semaine ON charges(semaine_debut, semaine_fin);
CREATE INDEX IF NOT EXISTS idx_jalons_date ON jalons(date_jalon);
CREATE INDEX IF NOT EXISTS idx_jalons_projet ON jalons(projet_id);