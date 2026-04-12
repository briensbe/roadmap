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



INSERT INTO "events"."events" ("id", "title", "event_type", "event_date", "description", "version", "created_at", "updated_at") VALUES
	('c2a37a71-e3d7-4cfd-b068-f48a29c78506', 'Test Event', 'livraison', '2025-12-31', '', '2025.1', '2025-11-08 17:39:16.506233+00', '2025-11-08 17:39:16.506233+00'),
	('7f728380-5c86-48f0-ad91-059e5af55ea9', 'Test Event', 'livraison', '2025-12-31', '', '2025.1', '2025-11-08 17:39:19.471495+00', '2025-11-08 17:39:19.471495+00'),
	('fe74ebd3-ec92-4122-bef2-60bd78728944', 'LV 2025.2', 'livraison', '2025-11-08', 'test', '2025.2', '2025-11-08 17:41:49.607608+00', '2025-11-08 17:41:49.607608+00'),
	('5b645f9e-98b7-489e-9eb3-01b4155ee538', 'LV test 1', 'livraison', '2025-12-12', '', 'test 1', '2025-11-11 18:33:46.572966+00', '2025-11-11 18:33:46.572966+00'),
	('1419ad78-e2a1-4d19-92f8-b1358553fc31', 'LV thibault', 'livraison', '2025-11-13', 'test', 'thibault', '2025-11-14 09:50:56.70241+00', '2025-11-14 09:51:06.512094+00'),
	('333e1f44-a561-4bd7-a46a-4a4768b409fc', 'MEP 2025.1', 'mep', '2025-11-20', 'nouvelle livraison', '2025.1', '2025-11-08 17:39:12.892745+00', '2025-11-15 17:32:52.251349+00'),
	('468d6c85-3207-4795-b839-65f467685f7d', 'MEP 2026.1', 'mep', '2025-11-16', 'une belle et assez longue description
avec une deuxième ligne
', '2026.1', '2025-11-16 17:56:49.64644+00', '2025-11-16 17:57:18.807033+00'),
	('11bbd4f2-572a-4dcc-8fc3-5c87b4de2bc4', 'MEP tests à venir', 'mep', '2025-12-05', '', 'tests à venir', '2025-11-16 17:58:01.168206+00', '2025-11-16 17:58:27.471653+00'),
	('13d14c1f-0e0b-47d7-8004-0989c39fb4f9', 'MEP test test test 2', 'mep', '2025-12-12', '', 'test test test 2', '2025-11-19 18:55:44.986099+00', '2025-11-19 18:56:05.528497+00'),
	('b9be9bd1-e9aa-4a3f-8bbd-3ebf2b1c3245', 'LV 2025.6.1', 'livraison', '2025-12-07', 'coucou', '2025.6.1', '2025-11-24 15:53:50.46098+00', '2025-11-24 15:53:50.46098+00'),
	('5ef60db8-1635-4bf9-8f9c-fe8da583a08b', 'MEP toto', 'mep', '2025-12-16', '', 'toto', '2025-11-19 19:16:31.073972+00', '2025-11-24 16:05:10.788251+00'),
	('5aebb276-af52-4dbc-aae5-ee9ae8c74a16', 'LV Test FA merci', 'livraison', '2025-12-12', 'description blabla', 'Test FA merci', '2025-11-09 09:49:14.481628+00', '2025-11-27 22:08:10.168414+00'),
	('84a065d3-4c04-4944-a1ad-67c61b67f4e7', 'LV premier de l''an', 'livraison', '2026-01-01', '', 'premier de l''an', '2025-12-22 16:33:20.371671+00', '2025-12-22 16:33:20.371671+00'),
	('8ae3471a-b00c-4208-ac1a-6d6db3707ba8', 'MEP test', 'mep', '2026-01-06', '', 'test', '2025-12-23 10:17:38.619738+00', '2025-12-23 10:17:43.856131+00'),
	('23ef9fac-0fde-41d3-8252-d25193b959a3', 'MEP 2026.2', 'mep', '2026-03-17', '', '2026.2', '2025-12-29 10:51:54.03934+00', '2025-12-29 10:52:38.377713+00'),
	('4cbd472b-8a67-423b-af5b-88d82539454f', 'LV 2026.1.1', 'livraison', '2026-01-07', '', '2026.1.1', '2026-01-05 10:22:06.652192+00', '2026-01-05 10:22:06.652192+00'),
	('7715e5b9-d874-407c-8e65-2b2ae33bc53a', 'LV 2026.1.2', 'livraison', '2026-03-10', '', '2026.1.2', '2026-02-06 11:22:44.942822+00', '2026-02-06 11:22:44.942822+00');