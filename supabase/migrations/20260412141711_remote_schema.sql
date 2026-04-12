


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "events";


ALTER SCHEMA "events" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_random_color"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    colors VARCHAR[] := ARRAY['#3b82f6', '#06b6d4', '#84cc16', '#f59e0b', '#a855f7', '#6366f1', '#ec4899', '#14b8a6'];
    random_color VARCHAR(255);
BEGIN
    random_color := colors[FLOOR(1 + RANDOM() * array_length(colors, 1))];
    RETURN random_color;
END;
$$;


ALTER FUNCTION "public"."get_random_color"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."roadmap_chiffres" (
    "id_chiffres" integer NOT NULL,
    "id_projet" integer NOT NULL,
    "id_service" integer NOT NULL,
    "initial" numeric(15,3),
    "revise" numeric(15,3),
    "previsionnel" numeric(15,3),
    "consomme" numeric(15,3),
    "date_mise_a_jour" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."roadmap_chiffres" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."chiffres_id_chiffres_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chiffres_id_chiffres_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."chiffres_id_chiffres_seq" OWNED BY "public"."roadmap_chiffres"."id_chiffres";



CREATE TABLE IF NOT EXISTS "public"."roadmap_projets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_projet" "text" NOT NULL,
    "nom_projet" "text" NOT NULL,
    "chef_projet" "text",
    "statut" "text" DEFAULT 'En cours'::"text",
    "reference_externe" "text",
    "description" "text",
    "chiffrage_initial" numeric DEFAULT 0,
    "chiffrage_revise" numeric DEFAULT 0,
    "chiffrage_previsionnel" numeric DEFAULT 0,
    "temps_consomme" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "id_projet" integer NOT NULL,
    "color" character varying(255),
    "rank" "text"
);


ALTER TABLE "public"."roadmap_projets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."projets_id_projet_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."projets_id_projet_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."projets_id_projet_seq" OWNED BY "public"."roadmap_projets"."id_projet";



CREATE TABLE IF NOT EXISTS "public"."roadmap_capacites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "semaine_debut" "date" NOT NULL,
    "capacite" numeric DEFAULT 0 NOT NULL,
    "role_id" "uuid",
    "personne_id" "uuid",
    "societe_id" "uuid",
    "departement_id" "uuid",
    "service_id" "uuid",
    "equipe_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_capacites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projet_id" "uuid" NOT NULL,
    "semaine_debut" "date",
    "semaine_fin" "date",
    "unite_ressource" numeric DEFAULT 1 NOT NULL,
    "role_id" "uuid",
    "personne_id" "uuid",
    "societe_id" "uuid",
    "departement_id" "uuid",
    "service_id" "uuid",
    "equipe_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_custom_field_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "custom_field_id" "uuid" NOT NULL,
    "entite_id" "uuid" NOT NULL,
    "valeur" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_custom_field_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_custom_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "entite" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_departements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "societe_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(255),
    "color" character varying(255)
);


ALTER TABLE "public"."roadmap_departements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_equipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "service_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(255),
    "color" character varying(255),
    "departement_id" "uuid"
);


ALTER TABLE "public"."roadmap_equipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_equipes_projets" (
    "equipe_id" "uuid" NOT NULL,
    "projet_id" "uuid" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_equipes_projets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_jalons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "date_jalon" "date" NOT NULL,
    "projet_id" "uuid",
    "type" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_jalons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_personne_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "personne_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roadmap_personne_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_personnes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "prenom" "text" NOT NULL,
    "email" "text",
    "jours_par_semaine" numeric DEFAULT 5,
    "societe_id" "uuid",
    "departement_id" "uuid",
    "service_id" "uuid",
    "equipe_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "id_service" integer,
    "code" character varying(255),
    "color" character varying(255)
);


ALTER TABLE "public"."roadmap_personnes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_role_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "societe_id" "uuid",
    "departement_id" "uuid",
    "service_id" "uuid",
    "equipe_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "id_service" integer
);


ALTER TABLE "public"."roadmap_role_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "jours_par_semaine" numeric DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(255),
    "color" character varying(255)
);


ALTER TABLE "public"."roadmap_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "departement_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "id_service" integer NOT NULL,
    "code" character varying(255),
    "color" character varying(255)
);


ALTER TABLE "public"."roadmap_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "type" "text" NOT NULL,
    "scope" "text" DEFAULT 'global'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "settings_type_check" CHECK (("type" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'json'::"text"])))
);


ALTER TABLE "public"."roadmap_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmap_societes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(255),
    "color" character varying(255)
);


ALTER TABLE "public"."roadmap_societes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."services_id_service_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."services_id_service_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."services_id_service_seq" OWNED BY "public"."roadmap_services"."id_service";



ALTER TABLE ONLY "public"."roadmap_chiffres" ALTER COLUMN "id_chiffres" SET DEFAULT "nextval"('"public"."chiffres_id_chiffres_seq"'::"regclass");



ALTER TABLE ONLY "public"."roadmap_projets" ALTER COLUMN "id_projet" SET DEFAULT "nextval"('"public"."projets_id_projet_seq"'::"regclass");



ALTER TABLE ONLY "public"."roadmap_services" ALTER COLUMN "id_service" SET DEFAULT "nextval"('"public"."services_id_service_seq"'::"regclass");



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_chiffres"
    ADD CONSTRAINT "chiffres_id_projet_id_service_key" UNIQUE ("id_projet", "id_service");



ALTER TABLE ONLY "public"."roadmap_chiffres"
    ADD CONSTRAINT "chiffres_pkey" PRIMARY KEY ("id_chiffres");



ALTER TABLE ONLY "public"."roadmap_custom_field_values"
    ADD CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_custom_fields"
    ADD CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_departements"
    ADD CONSTRAINT "departements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_equipes"
    ADD CONSTRAINT "equipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_equipes_projets"
    ADD CONSTRAINT "equipes_projets_pkey" PRIMARY KEY ("equipe_id", "projet_id");



ALTER TABLE ONLY "public"."roadmap_jalons"
    ADD CONSTRAINT "jalons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_personne_roles"
    ADD CONSTRAINT "personne_roles_personne_id_role_id_key" UNIQUE ("personne_id", "role_id");



ALTER TABLE ONLY "public"."roadmap_personne_roles"
    ADD CONSTRAINT "personne_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_projets"
    ADD CONSTRAINT "projets_id_projet_unique" UNIQUE ("id_projet");



ALTER TABLE ONLY "public"."roadmap_projets"
    ADD CONSTRAINT "projets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_services"
    ADD CONSTRAINT "services_id_service_unique" UNIQUE ("id_service");



ALTER TABLE ONLY "public"."roadmap_services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_settings"
    ADD CONSTRAINT "settings_key_scope_unique" UNIQUE ("key", "scope");



ALTER TABLE ONLY "public"."roadmap_settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_societes"
    ADD CONSTRAINT "societes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "unique_role_per_team" UNIQUE ("role_id", "equipe_id");



CREATE INDEX "idx_capacites_semaine" ON "public"."roadmap_capacites" USING "btree" ("semaine_debut");



CREATE INDEX "idx_charges_projet" ON "public"."roadmap_charges" USING "btree" ("projet_id");



CREATE INDEX "idx_charges_semaine" ON "public"."roadmap_charges" USING "btree" ("semaine_debut", "semaine_fin");



CREATE INDEX "idx_chiffres_projet" ON "public"."roadmap_chiffres" USING "btree" ("id_projet");



CREATE INDEX "idx_chiffres_service" ON "public"."roadmap_chiffres" USING "btree" ("id_service");



CREATE INDEX "idx_departements_societe" ON "public"."roadmap_departements" USING "btree" ("societe_id");



CREATE INDEX "idx_equipes_projets_equipe" ON "public"."roadmap_equipes_projets" USING "btree" ("equipe_id");



CREATE INDEX "idx_equipes_projets_projet" ON "public"."roadmap_equipes_projets" USING "btree" ("projet_id");



CREATE INDEX "idx_equipes_service" ON "public"."roadmap_equipes" USING "btree" ("service_id");



CREATE INDEX "idx_jalons_date" ON "public"."roadmap_jalons" USING "btree" ("date_jalon");



CREATE INDEX "idx_jalons_projet" ON "public"."roadmap_jalons" USING "btree" ("projet_id");



CREATE INDEX "idx_personnes_equipe" ON "public"."roadmap_personnes" USING "btree" ("equipe_id");



CREATE INDEX "idx_services_departement" ON "public"."roadmap_services" USING "btree" ("departement_id");



CREATE INDEX "idx_settings_key" ON "public"."roadmap_settings" USING "btree" ("key");



CREATE INDEX "idx_settings_scope" ON "public"."roadmap_settings" USING "btree" ("scope");



CREATE INDEX "projets_rank_idx" ON "public"."roadmap_projets" USING "btree" ("rank" COLLATE "C");



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."roadmap_equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "public"."roadmap_personnes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roadmap_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."roadmap_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_capacites"
    ADD CONSTRAINT "capacites_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."roadmap_societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."roadmap_equipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "public"."roadmap_personnes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "public"."roadmap_projets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roadmap_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."roadmap_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_charges"
    ADD CONSTRAINT "charges_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."roadmap_societes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_chiffres"
    ADD CONSTRAINT "chiffres_id_projet_fkey" FOREIGN KEY ("id_projet") REFERENCES "public"."roadmap_projets"("id_projet") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_chiffres"
    ADD CONSTRAINT "chiffres_id_service_fkey" FOREIGN KEY ("id_service") REFERENCES "public"."roadmap_services"("id_service") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_custom_field_values"
    ADD CONSTRAINT "custom_field_values_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "public"."roadmap_custom_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_departements"
    ADD CONSTRAINT "departements_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."roadmap_societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_equipes"
    ADD CONSTRAINT "equipes_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_equipes_projets"
    ADD CONSTRAINT "equipes_projets_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."roadmap_equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_equipes_projets"
    ADD CONSTRAINT "equipes_projets_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "public"."roadmap_projets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_equipes"
    ADD CONSTRAINT "equipes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."roadmap_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "fk_personnes_services" FOREIGN KEY ("id_service") REFERENCES "public"."roadmap_services"("id_service");



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "fk_role_attachments_services" FOREIGN KEY ("id_service") REFERENCES "public"."roadmap_services"("id_service");



ALTER TABLE ONLY "public"."roadmap_jalons"
    ADD CONSTRAINT "jalons_projet_id_fkey" FOREIGN KEY ("projet_id") REFERENCES "public"."roadmap_projets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_personne_roles"
    ADD CONSTRAINT "personne_roles_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "public"."roadmap_personnes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_personne_roles"
    ADD CONSTRAINT "personne_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roadmap_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."roadmap_equipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."roadmap_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_personnes"
    ADD CONSTRAINT "personnes_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."roadmap_societes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."roadmap_equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roadmap_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."roadmap_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_role_attachments"
    ADD CONSTRAINT "role_attachments_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "public"."roadmap_societes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmap_services"
    ADD CONSTRAINT "services_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."roadmap_departements"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all operations for authenticated users on capacites" ON "public"."roadmap_capacites" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on charges" ON "public"."roadmap_charges" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on chiffres" ON "public"."roadmap_chiffres" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on custom_field_va" ON "public"."roadmap_custom_field_values" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on custom_fields" ON "public"."roadmap_custom_fields" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on departements" ON "public"."roadmap_departements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on equipes" ON "public"."roadmap_equipes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on equipes_projets" ON "public"."roadmap_equipes_projets" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on jalons" ON "public"."roadmap_jalons" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on personne_roles" ON "public"."roadmap_personne_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on personnes" ON "public"."roadmap_personnes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on projets" ON "public"."roadmap_projets" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on role_attachment" ON "public"."roadmap_role_attachments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on roles" ON "public"."roadmap_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on services" ON "public"."roadmap_services" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on settings" ON "public"."roadmap_settings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users on societes" ON "public"."roadmap_societes" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."roadmap_capacites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_chiffres" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_custom_field_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_departements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_equipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_equipes_projets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_jalons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_personne_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_personnes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_projets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_role_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmap_societes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."roadmap_projets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."roadmap_settings";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_random_color"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_random_color"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_random_color"() TO "service_role";


















GRANT ALL ON TABLE "public"."roadmap_chiffres" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_chiffres" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_chiffres" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chiffres_id_chiffres_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chiffres_id_chiffres_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chiffres_id_chiffres_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_projets" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_projets" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_projets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."projets_id_projet_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."projets_id_projet_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."projets_id_projet_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_capacites" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_capacites" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_capacites" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_charges" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_charges" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_custom_field_values" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_custom_field_values" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_custom_field_values" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_departements" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_departements" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_departements" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_equipes" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_equipes" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_equipes" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_equipes_projets" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_equipes_projets" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_equipes_projets" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_jalons" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_jalons" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_jalons" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_personne_roles" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_personne_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_personne_roles" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_personnes" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_personnes" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_personnes" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_role_attachments" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_role_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_role_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_roles" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_roles" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_services" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_services" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_services" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_settings" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_settings" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_societes" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_societes" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_societes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."services_id_service_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."services_id_service_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."services_id_service_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


