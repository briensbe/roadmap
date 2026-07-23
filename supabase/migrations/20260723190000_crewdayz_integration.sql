-- Migration: Integration Crewdayz <-> Roadmap via RPC & Mapping table
-- Date: 2026-07-23

-- 1. Table de mapping Roadmap <-> Crewdayz
CREATE TABLE IF NOT EXISTS public.roadmap_mapping_roles_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roadmap_team_id UUID NULL,
    roadmap_role_attachment_id UUID NULL,
    roadmap_personne_id UUID NULL,
    crewdayz_team_name TEXT NOT NULL,
    crewdayz_profile_name TEXT NOT NULL,
    availability_ratio NUMERIC(3,2) DEFAULT 1.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- S'assurer que le DEFAULT est bien positionné sur id si la table existait déjà
ALTER TABLE public.roadmap_mapping_roles_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_roadmap_mapping_team ON public.roadmap_mapping_roles_profiles(roadmap_team_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_mapping_role_att ON public.roadmap_mapping_roles_profiles(roadmap_role_attachment_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_mapping_personne ON public.roadmap_mapping_roles_profiles(roadmap_personne_id);

-- RLS sur la table de mapping
ALTER TABLE public.roadmap_mapping_roles_profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'roadmap_mapping_roles_profiles' 
        AND policyname = 'Allow all access to roadmap_mapping_roles_profiles'
    ) THEN
        CREATE POLICY "Allow all access to roadmap_mapping_roles_profiles"
            ON public.roadmap_mapping_roles_profiles
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 2. Fonction RPC Discovery (Liste des équipes et profils Crewdayz)
DROP FUNCTION IF EXISTS public.cd_get_teams_discovery();

CREATE OR REPLACE FUNCTION public.cd_get_teams_discovery()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'equipes', COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'nom', team_name,
                        'profils', profils_list
                    ) ORDER BY team_name
                )
                FROM (
                    SELECT 
                        TRIM(team) AS team_name,
                        json_agg(DISTINCT TRIM(profile) ORDER BY TRIM(profile)) AS profils_list
                    FROM crewdayz.cd_employees
                    WHERE team IS NOT NULL AND TRIM(team) <> ''
                      AND profile IS NOT NULL AND TRIM(profile) <> ''
                    GROUP BY TRIM(team)
                ) sub
            ),
            '[]'::json
        )
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cd_get_teams_discovery() TO authenticated, anon, service_role;

-- 3. Fonctions utilitaires : Calcul de Pâques & Jours fériés français
CREATE OR REPLACE FUNCTION public.cd_get_easter_date(p_year integer)
RETURNS date
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
    a int := p_year % 19;
    b int := p_year / 100;
    c int := p_year % 100;
    d int := b / 4;
    e int := b % 4;
    f int := (b + 8) / 25;
    g int := (b - f + 1) / 3;
    h int := (19 * a + b - d - g + 15) % 30;
    i int := c / 4;
    k int := c % 4;
    l int := (32 + 2 * e + 2 * i - h - k) % 7;
    m int := (a + 11 * h + 22 * l) / 451;
    month int := (h + l - 7 * m + 114) / 31;
    day int := ((h + l - 7 * m + 114) % 31) + 1;
BEGIN
    RETURN make_date(p_year, month, day);
END;
$$;

CREATE OR REPLACE FUNCTION public.cd_is_french_public_holiday(p_date date)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
    y int := EXTRACT(YEAR FROM p_date);
    m int := EXTRACT(MONTH FROM p_date);
    d int := EXTRACT(DAY FROM p_date);
    easter date;
BEGIN
    -- Jours fériés fixes
    IF (m = 1 AND d = 1) OR (m = 5 AND d = 1) OR (m = 5 AND d = 8) OR
       (m = 7 AND d = 14) OR (m = 8 AND d = 15) OR (m = 11 AND d = 1) OR
       (m = 11 AND d = 11) OR (m = 12 AND d = 25) THEN
        RETURN TRUE;
    END IF;
    
    easter := public.cd_get_easter_date(y);
    
    -- Lundi de Pâques (Pâques + 1)
    IF p_date = easter + 1 THEN RETURN TRUE; END IF;
    -- Ascension (Pâques + 39)
    IF p_date = easter + 39 THEN RETURN TRUE; END IF;
    -- Lundi de Pentecôte (Pâques + 50)
    IF p_date = easter + 50 THEN RETURN TRUE; END IF;
    
    RETURN FALSE;
END;
$$;

-- 4. Fonction RPC Availabilities (Calcul des disponibilités par semaine / équipe / profil)
DROP FUNCTION IF EXISTS public.cd_get_availabilities(date, date, text);

CREATE OR REPLACE FUNCTION public.cd_get_availabilities(
    p_start_date date,
    p_end_date date,
    p_team_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    WITH week_series AS (
        SELECT 
            (ws)::date AS week_start,
            (ws + interval '6 days')::date AS week_end,
            EXTRACT(week FROM ws)::integer AS week_num,
            EXTRACT(isoyear FROM ws)::integer AS year_num
        FROM generate_series(
            date_trunc('week', p_start_date)::date,
            date_trunc('week', p_end_date)::date,
            '1 week'::interval
        ) ws
    ),
    working_days AS (
        SELECT 
            w.week_start,
            w.week_end,
            w.week_num,
            w.year_num,
            (w.week_start + (d || ' day')::interval)::date AS day_date
        FROM week_series w
        CROSS JOIN generate_series(0, 4) d
    ),
    emp_day_status AS (
        SELECT 
            TRIM(e.team) AS team_name,
            TRIM(e.profile) AS profile_name,
            e.id AS employee_id,
            wd.week_num,
            wd.year_num,
            wd.week_start,
            wd.week_end,
            wd.day_date,
            CASE 
                WHEN public.cd_is_french_public_holiday(wd.day_date) THEN 1.0
                ELSE COALESCE(
                    (
                        SELECT LEAST(1.0, SUM(
                            CASE 
                                WHEN LOWER(TRIM(COALESCE(a.category::text, ''))) = 'formation' THEN 0.0
                                WHEN LOWER(a.period::text) IN ('morning', 'afternoon', 'matin', 'apres-midi', 'demi') THEN 0.5
                                ELSE 1.0
                            END
                        ))
                        FROM crewdayz.cd_absences a
                        WHERE a.employee_id::text = e.id::text
                          AND a.date::date = wd.day_date
                        HAVING COUNT(a.id) > 0
                    ),
                    0.0
                )
            END AS absence_val
        FROM working_days wd
        JOIN crewdayz.cd_employees e 
          ON (e.arrival_date IS NULL OR TRIM(e.arrival_date::text) = '' OR e.arrival_date::date <= wd.day_date)
         AND (e.departure_date IS NULL OR TRIM(e.departure_date::text) = '' OR e.departure_date::date >= wd.day_date)
        WHERE e.team IS NOT NULL AND TRIM(e.team) <> ''
          AND e.profile IS NOT NULL AND TRIM(e.profile) <> ''
          AND (p_team_name IS NULL OR TRIM(LOWER(e.team)) = TRIM(LOWER(p_team_name)))
    ),
    emp_week_summary AS (
        SELECT 
            team_name,
            profile_name,
            employee_id,
            week_num,
            year_num,
            week_start,
            week_end,
            COUNT(day_date)::numeric AS capacity_days,
            SUM(absence_val)::numeric AS absence_days,
            SUM(1.0 - absence_val)::numeric AS available_days
        FROM emp_day_status
        GROUP BY team_name, profile_name, employee_id, week_num, year_num, week_start, week_end
    ),
    profile_week_agg AS (
        SELECT 
            team_name,
            profile_name,
            week_num,
            year_num,
            week_start,
            week_end,
            ROUND(SUM(available_days), 2) AS available_days,
            ROUND(SUM(absence_days), 2) AS absence_days,
            ROUND(SUM(capacity_days), 2) AS capacity_days,
            COUNT(DISTINCT employee_id)::integer AS members_count
        FROM emp_week_summary
        GROUP BY team_name, profile_name, week_num, year_num, week_start, week_end
    ),
    profile_agg AS (
        SELECT 
            team_name,
            profile_name,
            json_agg(
                json_build_object(
                    'year', year_num,
                    'weekNumber', week_num,
                    'startDate', to_char(week_start, 'YYYY-MM-DD'),
                    'endDate', to_char(week_end, 'YYYY-MM-DD'),
                    'membersCount', members_count,
                    'capacityDays', capacity_days,
                    'absenceDays', absence_days,
                    'availableDays', available_days
                ) ORDER BY year_num, week_num
            ) AS weeks_list
        FROM profile_week_agg
        GROUP BY team_name, profile_name
    ),
    team_agg AS (
        SELECT 
            team_name,
            json_agg(
                json_build_object(
                    'profileId', profile_name,
                    'profileName', profile_name,
                    'weeks', weeks_list
                ) ORDER BY profile_name
            ) AS profiles_list
        FROM profile_agg
        GROUP BY team_name
    )
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'teamId', team_name,
                'teamName', team_name,
                'period', json_build_object(
                    'startDate', to_char(p_start_date, 'YYYY-MM-DD'),
                    'endDate', to_char(p_end_date, 'YYYY-MM-DD')
                ),
                'profiles', profiles_list
            ) ORDER BY team_name
        ),
        '[]'::json
    ) INTO result
    FROM team_agg;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cd_get_availabilities(date, date, text) TO authenticated, anon, service_role;
