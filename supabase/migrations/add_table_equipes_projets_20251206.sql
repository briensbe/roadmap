CREATE TABLE equipes_projets (
    equipe_id uuid NOT NULL,
    projet_id uuid NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (equipe_id, projet_id),
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE
);

-- Index pour retrouver rapidement tous les projets d’une équipe
CREATE INDEX idx_equipes_projets_equipe ON equipes_projets(equipe_id);

-- Index pour retrouver rapidement toutes les équipes d’un projet
CREATE INDEX idx_equipes_projets_projet ON equipes_projets(projet_id);

ALTER TABLE equipes_projets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on equipes_projets"
  ON equipes_projets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);