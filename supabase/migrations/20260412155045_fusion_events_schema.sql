create schema if not exists "events";

CREATE TABLE IF NOT EXISTS "events"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "events_event_type_check" CHECK (("event_type" = ANY (ARRAY['livraison'::"text", 'mep'::"text"])))
);

-- Transférer la propriété de la table au super-utilisateur
ALTER TABLE "events"."events" OWNER TO "postgres";


-- Indispensable pour que l'API puisse "entrer" dans le schéma
GRANT USAGE ON SCHEMA events TO anon, authenticated;

-- Donner les accès à l'API Supabase
GRANT ALL ON TABLE "events"."events" TO "anon";
GRANT ALL ON TABLE "events"."events" TO "authenticated";
GRANT ALL ON TABLE "events"."events" TO "service_role";

-- Si vous utilisez des IDs auto-générés (sequences), ne les oubliez pas !
GRANT ALL ON ALL SEQUENCES IN SCHEMA events TO "anon", "authenticated", "service_role";

-- Activer la sécurité au niveau des lignes
ALTER TABLE "events"."events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON "events"."events" FOR SELECT USING (true);
CREATE POLICY "Allow authenticated delete access" ON "events"."events" FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "Allow authenticated insert access" ON "events"."events" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Allow authenticated update access" ON "events"."events" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);


ALTER TABLE ONLY "events"."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");

-- Ré-création des index pour la rapidité des recherches
CREATE INDEX IF NOT EXISTS "idx_events_date" ON "events"."events" USING "btree" ("event_date");
CREATE INDEX IF NOT EXISTS "idx_events_type" ON "events"."events" USING "btree" ("event_type");

-- 1. Création de la fonction dans le schéma public
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attachement du trigger à la table dans le schéma 'events'
-- On vérifie d'abord s'il existe pour éviter les doublons
DROP TRIGGER IF EXISTS trigger_update_updated_at ON events.events;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON events.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();


