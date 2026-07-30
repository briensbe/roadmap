-- Migration: Optimisation de la fonction cd_get_availabilities et des index associés
-- Date: 2026-07-30

-- 1. Optimisation des index BDD pour le schéma crewdayz

-- Index composite / fonctionnel sur crewdayz.cd_absences pour accélérer la jointure par employé et date
CREATE INDEX IF NOT EXISTS idx_cd_absences_employee_date 
ON crewdayz.cd_absences USING btree (employee_id, date);

CREATE INDEX IF NOT EXISTS idx_cd_absences_employee_date_cast 
ON crewdayz.cd_absences ((employee_id::text), ((date)::date));

-- Index couvrant pour autoriser l'Index Only Scan sur les colonnes d'absences
CREATE INDEX IF NOT EXISTS idx_cd_absences_covering 
ON crewdayz.cd_absences (employee_id, date) 
INCLUDE (category, period);

-- Index sur crewdayz.cd_employees pour les recherches par équipe et profil
CREATE INDEX IF NOT EXISTS idx_cd_employees_team_profile 
ON crewdayz.cd_employees (team, profile);

CREATE INDEX IF NOT EXISTS idx_cd_employees_team_lower 
ON crewdayz.cd_employees (TRIM(LOWER(team))) 
WHERE team IS NOT NULL;


-- 2. Réécriture hautement optimisée de public.cd_get_availabilities

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
    v_team_filter text;
BEGIN
    -- Normalisation du paramètre d'équipe une seule fois
    IF p_team_name IS NOT NULL AND TRIM(p_team_name) <> '' THEN
        v_team_filter := TRIM(LOWER(p_team_name));
    END IF;

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
            (w.week_start + (d || ' day')::interval)::date AS day_date,
            -- Calcul unique du jour férié par jour (1 fois par jour au lieu de N x D)
            public.cd_is_french_public_holiday((w.week_start + (d || ' day')::interval)::date) AS is_holiday
        FROM week_series w
        CROSS JOIN generate_series(0, 4) d
    ),
    -- Sub-CTE : Filtrage et normalisation initiale des employés valides
    active_employees AS (
        SELECT 
            e.id,
            TRIM(e.team) AS team_name,
            TRIM(e.profile) AS profile_name,
            CASE WHEN e.arrival_date IS NULL OR TRIM(e.arrival_date::text) = '' THEN NULL ELSE e.arrival_date::date END AS arrival_d,
            CASE WHEN e.departure_date IS NULL OR TRIM(e.departure_date::text) = '' THEN NULL ELSE e.departure_date::date END AS departure_d
        FROM crewdayz.cd_employees e
        WHERE e.team IS NOT NULL AND TRIM(e.team) <> ''
          AND e.profile IS NOT NULL AND TRIM(e.profile) <> ''
          AND (v_team_filter IS NULL OR TRIM(LOWER(e.team)) = v_team_filter)
    ),
    -- Sub-CTE : Pré-agrégation des absences sur la plage temporelle demandée
    daily_absences AS (
        SELECT 
            a.employee_id::text AS employee_id_text,
            a.date::date AS absence_date,
            LEAST(1.0, SUM(
                CASE 
                    WHEN LOWER(TRIM(COALESCE(a.category::text, ''))) = 'formation' THEN 0.0
                    WHEN LOWER(a.period::text) IN ('morning', 'afternoon', 'matin', 'apres-midi', 'demi') THEN 0.5
                    ELSE 1.0
                END
            )) AS absence_val
        FROM crewdayz.cd_absences a
        WHERE a.date::date >= date_trunc('week', p_start_date)::date
          AND a.date::date <= (date_trunc('week', p_end_date)::date + interval '6 days')::date
        GROUP BY a.employee_id::text, a.date::date
    ),
    employee_day_status AS (
        SELECT 
            e.team_name,
            e.profile_name,
            e.id AS employee_id,
            wd.week_num,
            wd.year_num,
            wd.week_start,
            wd.week_end,
            wd.day_date,
            CASE 
                WHEN wd.is_holiday THEN 1.0
                ELSE COALESCE(da.absence_val, 0.0)
            END AS absence_val
        FROM working_days wd
        JOIN active_employees e
          ON (e.arrival_d IS NULL OR e.arrival_d <= wd.day_date)
         AND (e.departure_d IS NULL OR e.departure_d >= wd.day_date)
        LEFT JOIN daily_absences da 
          ON da.employee_id_text = e.id::text 
         AND da.absence_date = wd.day_date
    ),
    employee_week_summary AS (
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
        FROM employee_day_status
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
        FROM employee_week_summary
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
