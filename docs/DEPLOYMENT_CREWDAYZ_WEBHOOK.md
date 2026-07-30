# 🚀 Procédure de Déploiement en Production : Cache & Webhook (Crewdayz ↔ Roadmap)

Ce document décrit la procédure étape par étape pour déployer le système de **Cache In-Memory** et d'**Invalidation Événementielle par Webhook HTTP (pg_net + Supabase Vault + Edge Function)** en environnement de production.

---

## 📋 Prérequis & Variables requises

Avant de commencer, définissez un jeton secret unique (ex: un hash aléatoire cryptographique de 32+ caractères) :
- **`SECRET_TOKEN`** : ex: `cd_wh_prod_98f4a7b21e8749c09d8213f`
- **`ROADMAP_PROJECT_REF`** : L'identifiant de projet Supabase de l'application Roadmap.
- **`CREWDAYZ_PROJECT_REF`** : L'identifiant de projet Supabase de l'application Crewdayz.

---

## 🛠️ Étape 1 : Base de Données ROADMAP (Migration)

Connectez-vous au projet Supabase **Roadmap** (via SQL Editor ou Supabase CLI) et exécutez la migration suivante :

📄 **Fichier source** : [20260727193000_create_roadmap_integration_events.sql](file:///c:/Users/brien/Documents/Devs/angular/roadmap-vision/roadmap/supabase/migrations/20260727193000_create_roadmap_integration_events.sql)

```sql
-- Création de la table des événements d'invalidation
CREATE TABLE IF NOT EXISTS public.roadmap_integration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roadmap_integration_events_pkey PRIMARY KEY (id)
);

-- Index pour requêter le dernier événement en < 5ms
CREATE INDEX IF NOT EXISTS idx_roadmap_events_source_created 
ON public.roadmap_integration_events (source, created_at DESC);

-- RLS & Droits
ALTER TABLE public.roadmap_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on integration events for authenticated users"
    ON public.roadmap_integration_events FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON TABLE public.roadmap_integration_events TO anon;
GRANT ALL ON TABLE public.roadmap_integration_events TO authenticated;
GRANT ALL ON TABLE public.roadmap_integration_events TO service_role;
```

---

## ⚡ Étape 2 : Supabase Edge Function ROADMAP (`crewdayz-webhook`)

### 1. Enregistrement du secret dans les variables d'environnement Supabase Edge :
Via le terminal Supabase CLI :
```bash
supabase secrets set ROADMAP_WEBHOOK_SECRET="SECRET_TOKEN" --project-ref <ROADMAP_PROJECT_REF>
```
*(Ou depuis l'interface Supabase Roadmap : **Project Settings ➔ Edge Functions ➔ Secrets**).*

### 2. Déploiement de la fonction :
Depuis le dossier `roadmap/` :
```bash
supabase functions deploy crewdayz-webhook --no-verify-jwt --project-ref <ROADMAP_PROJECT_REF>
```

📌 **URL de production générée** :
`https://<ROADMAP_PROJECT_REF>.supabase.co/functions/v1/crewdayz-webhook`

---

## 🔒 Étape 3 : Base de Données CREWDAYZ (Vault & Emitter)

Connectez-vous au projet Supabase **Crewdayz** (SQL Editor).

### 1. Enregistrement des secrets dans Supabase Vault :
Exécutez le script SQL d'ajout des secrets dans Vault (ne jamais coder les clés en dur !) :

```sql
-- Enregistrement de l'URL de l'Edge Function Roadmap
SELECT vault.create_secret(
    'https://<ROADMAP_PROJECT_REF>.supabase.co/functions/v1/crewdayz-webhook',
    'roadmap_webhook_url'
);

-- Enregistrement du Jeton Secret d'authentification Bearer
SELECT vault.create_secret(
    'SECRET_TOKEN',
    'roadmap_webhook_bearer_token'
);
```

### 2. Exécution du script émetteur SQL :
📄 **Fichier source** : [setup_crewdayz_webhook_emitter.sql](file:///c:/Users/brien/Documents/Devs/angular/crewdayz/supabase/scripts/setup_crewdayz_webhook_emitter.sql)

Exécutez l'intégralité du fichier `setup_crewdayz_webhook_emitter.sql`. Ce script va :
- Activer l'extension HTTP `pg_net`.
- Créer la table d'état anti-rafale `crewdayz.cd_webhook_state`.
- Installer la fonction `crewdayz.trg_emit_roadmap_webhook()` avec **auto-initialisation automatique (UPSERT)**.
- Activer les déclencheurs HTTP `FOR EACH STATEMENT` sur `cd_absences` et `cd_employees`.

---

## 📦 Étape 4 : Déploiement du Frontend Angular ROADMAP

1. Déployez le paquet de production de l'application Angular Roadmap.
2. Le service `CrewdayzIntegrationService` fonctionnera immédiatement avec le nouveau mode :
   - Navigations intra-session : **0ms d'attente, affichage immédiat depuis le cache en mémoire**.
   - Contrôle rapide de fraîcheur : **< 10ms sur BDD Roadmap**.
   - Rechargement de la lourde RPC `cd_get_availabilities` (3-4s) : **Uniquement lors de la réception d'une notification de modification de Crewdayz**.

---

## ✅ Étape 5 : Procédure de Recette & Vérification en Production

1. **Vérification des Logs Edge Function** :
   - Rendez-vous sur **Supabase Roadmap ➔ Edge Functions ➔ crewdayz-webhook ➔ Logs**.
2. **Test d'invalidation bout-en-bout** :
   - Dans Crewdayz, créez ou modifiez une absence.
   - Observez les logs de l'Edge Function Roadmap (affichage des en-têtes, de la validation du token et du succès de l'insertion).
   - Dans Roadmap, naviguez vers la vue Capacités : vérifiez que les données mises à jour sont rechargées.
3. **Test de résistance aux rafales (Throttling)** :
   - Modifiez 10 absences d'un coup dans Crewdayz.
   - Vérifiez dans `crewdayz.cd_webhook_state` et dans la table `roadmap_integration_events` qu'**un seul appel HTTP a été émis**.

---

## 🆘 Dépannage & Rollback

- **Symptôme** : L'Edge Function renvoie `401 Unauthorized`.  
  👉 **Solution** : Vérifiez que la valeur enregistrée dans Supabase Vault (`roadmap_webhook_bearer_token`) correspond exactement à la variable `ROADMAP_WEBHOOK_SECRET` de l'Edge Function.
- **Symptôme** : Exception `[Crewdayz Webhook] Échec : Le jeton... est introuvable`.  
  👉 **Solution** : Vérifiez que l'extension `vault` est active et que les 2 secrets ont été créés via `vault.create_secret()`.
