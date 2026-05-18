ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS password_hash text;

DO $$ BEGIN
  ALTER TABLE workspaces
    ADD CONSTRAINT workspaces_visibility_check CHECK (visibility IN ('public', 'protected'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS workspaces_visibility_idx ON workspaces (visibility);
CREATE INDEX IF NOT EXISTS workspaces_name_search_idx ON workspaces USING gin (to_tsvector('simple', name));
