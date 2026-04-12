/*
  # Add Unique Constraint on Role Attachments
  
  This migration ensures that each role can only be attached once per team.
  
  1. Changes
    - Remove any duplicate role attachments within the same team (keeping the most recent one)
    - Add UNIQUE constraint on (role_id, equipe_id) in role_attachments table
  
  2. Impact
    - Prevents the same role from being attached multiple times to the same team
    - Allows the same role to be used across different teams
    - Ensures data integrity for capacity management
*/

-- First, identify and remove duplicate role attachments within the same team
-- Keep only the most recent attachment for each (role_id, equipe_id) combination
DELETE FROM role_attachments
WHERE id NOT IN (
  SELECT DISTINCT ON (role_id, equipe_id) id
  FROM role_attachments
  WHERE equipe_id IS NOT NULL
  ORDER BY role_id, equipe_id, created_at DESC
);

-- supprimer l'ancien contrainte
ALTER TABLE role_attachments
DROP CONSTRAINT unique_role_per_team;

-- Add UNIQUE constraint on (role_id, equipe_id) to prevent future duplicates
-- This ensures a role can only be attached once per team, but can be used in multiple teams
ALTER TABLE role_attachments
ADD CONSTRAINT unique_role_per_team UNIQUE (role_id, equipe_id);
