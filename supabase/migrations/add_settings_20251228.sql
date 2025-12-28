create table settings (
  id uuid primary key default gen_random_uuid(),

  key text not null,
  value text not null,
  type text not null check (type in (
    'string',
    'number',
    'boolean',
    'json'
  )),

  scope text not null default 'global',
  -- ex:
  -- global
  -- user:uuid
  -- tenant:uuid
  -- env:prod

  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint settings_key_scope_unique unique (key, scope)
);

create index idx_settings_key on settings(key);
create index idx_settings_scope on settings(scope);

-- activation de la sécurité RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);