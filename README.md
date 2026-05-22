# Whaler

Realtime browser code editor with self-hosted IAM, collaborative editing, and Docker-backed sandboxes.

## Stack

- Vue + Vuetify 4 + CodeMirror 6
- Hono + `hc` typed client
- Yjs + Hocuspocus for realtime text, cursor, selection, and workspace presence
- Supabase self-hosted Auth/Postgres
- Drizzle ORM schema/migrations
- Docker runner isolated behind an internal token
- Caddy with HTTP/3

## Local Development

1. Install dependencies:

   ```bash
   just install
   ```

2. Start the full local dev stack:

   ```bash
   just dev
   ```

   `just dev` starts local Supabase, builds missing sandbox preview images,
   starts TURN, and then runs the app services.

3. If this is the first local run, copy `.env.example` to `.env`, then copy
   the values from `just supabase-status` into `.env`. The app expects:

   - `DATABASE_URL`
   - `SUPABASE_JWT_SECRET`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `RUNNER_INTERNAL_TOKEN`

4. Apply/reset local database:

   ```bash
   just supabase-reset
   ```

5. Individual services can still be run separately:

   ```bash
   just dev-api
   just dev-collab
   just dev-runner
   just dev-web
   ```

The web app defaults to `http://localhost:5173`.

## Production Domains

Caddy is configured for separate subdomains:

- `APP_DOMAIN=app.example.com`
- `API_DOMAIN=api.example.com`
- `COLLAB_DOMAIN=collab.example.com`
- `VOICE_DOMAIN=voice.example.com`
- `SUPABASE_DOMAIN=supabase.example.com`
- `STAND_BASE_DOMAIN_DOCKER=stand.example.com`

Create DNS `A` records for each subdomain pointing to the server public IPv4
address. If IPv6 is enabled, also add matching `AAAA` records. Preview
sandboxes require a wildcard record such as `*.stand.example.com`.

Open these ports on the VDS firewall:

- `80/tcp` for ACME HTTP challenge and redirects
- `443/tcp` for HTTPS
- `443/udp` for HTTP/3
- `3478/tcp` and `3478/udp` if the bundled TURN profile is used
- the configured mediasoup RTC range, default `40000-40100/tcp` and `40000-40100/udp`

Do not expose Postgres or the Docker socket publicly.

## Supabase Production Note

`supabase init` is useful for local development. For production, run self-hosted Supabase as its own Docker Compose stack or service, then point Caddy's `SUPABASE_UPSTREAM` to its Kong/API gateway. Set Supabase Auth URLs to:

- public API URL: `https://supabase.example.com`
- site URL: `https://app.example.com`
- allowed redirect URLs: `https://app.example.com`

Email confirmation and password recovery are handled by Supabase Auth, not the
Whaler API. Keep only the SMTP values the Auth service needs:

```dotenv
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_USERNAME=no-reply@example.com
MAIL_PASSWORD=replace-with-smtp-password
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_FROM_NAME=Whaler
```

Map those values into the self-hosted Supabase Auth container:

```dotenv
GOTRUE_SITE_URL=https://app.example.com
GOTRUE_URI_ALLOW_LIST=https://app.example.com
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_HOST=${MAIL_HOST}
GOTRUE_SMTP_PORT=${MAIL_PORT}
GOTRUE_SMTP_USER=${MAIL_USERNAME}
GOTRUE_SMTP_PASS=${MAIL_PASSWORD}
GOTRUE_SMTP_ADMIN_EMAIL=${MAIL_FROM_ADDRESS}
GOTRUE_SMTP_SENDER_NAME=${MAIL_FROM_NAME}
```

## Verification

```bash
just typecheck
just build
docker compose config
```

For a full server checklist, see `docs/PRODUCTION.md`.
