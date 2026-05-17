CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE file_kind AS ENUM ('file', 'directory');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE container_status AS ENUM ('pending', 'starting', 'running', 'stopped', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  image_id text NOT NULL,
  image_ref text NOT NULL,
  container_id text,
  container_status container_status NOT NULL DEFAULT 'pending',
  container_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_owner_idx ON workspaces (owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  path text NOT NULL,
  kind file_kind NOT NULL,
  language text,
  content text NOT NULL DEFAULT '',
  readonly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT files_workspace_path_unique UNIQUE (workspace_id, path)
);

CREATE INDEX IF NOT EXISTS files_workspace_idx ON files (workspace_id);

CREATE TABLE IF NOT EXISTS collab_documents (
  name text PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  file_id uuid REFERENCES files(id) ON DELETE CASCADE,
  state bytea NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_documents_file_idx ON collab_documents (file_id);
