-- ÉTAPE 1 : Créer la colonne (en acceptant les NULL pour l'instant)
ALTER TABLE projets ADD COLUMN rank text;

--index pour les perfs
CREATE INDEX IF NOT EXISTS projets_rank_idx ON projets (rank COLLATE "C");

-- requête d'initialisation du rang des projets existants
WITH sorted_rows AS (
  SELECT 
    id, 
    -- Ici, je trie par date de création pour garder ton ordre historique.
    -- Tu peux changer 'created_at' par ce que tu veux.
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn 
  FROM projets
)
UPDATE projets
SET rank = '0|' || LPAD(s.rn::text, 6, '0') 
-- Résultat : Le 1er projet aura "0|000001", le 2ème "0|000002", etc.
-- C'est un format LexoRank valide que la librairie JS saura lire et manipuler.
FROM sorted_rows s
WHERE projets.id = s.id;