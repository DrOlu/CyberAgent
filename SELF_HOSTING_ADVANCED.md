# Self-Hosting — Advanced Configuration

This document covers advanced configuration for self-hosted CyberAgent deployments. For the quick start guide, see [SELF_HOSTING.md](SELF_HOSTING.md).

## Configuration

All configuration is done via environment variables. Copy `.env.example` as a starting point.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://cyberagent:cyberagent@localhost:5432/cyberagent?sslmode=disable` |
| `JWT_SECRET` | **Must change from default.** Secret key for signing JWT tokens. Use a long random string. | `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | URL where the frontend is served (used for CORS) | `https://app.example.com` |

### Database Pool Tuning (Optional)

These have sensible defaults and only need to be set when tuning a large or constrained deployment. Precedence (highest first): env var → `pool_*` query params on `DATABASE_URL` → built-in default.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_MAX_CONNS` | pgxpool max connections per pod. `pod_count × DATABASE_MAX_CONNS` should stay well below the Postgres `max_connections` ceiling. With a connection pooler (PgBouncer / RDS Proxy / Supavisor) in front, this can be raised significantly. | `25` |
| `DATABASE_MIN_CONNS` | pgxpool warm baseline connections per pod. Auto-clamped to `DATABASE_MAX_CONNS`. | `5` |

### Email (Required for Authentication)

CyberAgent uses email-based magic link authentication via [Resend](https://resend.com).

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | Sender email address (default: `noreply@multica.ai`) |

> **Note:** If Resend is not configured, generated verification codes are printed to backend logs. A fixed local testing code is disabled by default; to opt in on a private test instance, set `APP_ENV=development` and `MULTICA_DEV_VERIFICATION_CODE` to a 6-digit value. It is ignored when `APP_ENV=production`.

### Google OAuth (Optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (e.g. `https://app.example.com/auth/callback`) |

Changes take effect after restarting the backend / compose stack. The web UI reads `GOOGLE_CLIENT_ID` from `/api/config` at runtime, so no web rebuild is needed.

### Signup Controls (Optional)

| Variable | Description |
|----------|-------------|
| `ALLOW_SIGNUP` | Set to `false` to disable new user signups on a private instance |
| `ALLOWED_EMAIL_DOMAINS` | Optional comma-separated allowlist of email domains |
| `ALLOWED_EMAILS` | Optional comma-separated allowlist of exact email addresses |

Changes take effect after restarting the backend / compose stack. The web UI reads `ALLOW_SIGNUP` from `/api/config` at runtime, so no web rebuild is needed.

### File Storage (Optional)

For file uploads and attachments, configure S3 and (optionally) CloudFront:

| Variable | Description |
|----------|-------------|
| `S3_BUCKET` | Bucket name only (e.g. `my-bucket`). Do **not** include the `.s3.<region>.amazonaws.com` suffix — the server constructs the public URL from `S3_BUCKET` + `S3_REGION` |
| `S3_REGION` | AWS region (default: `us-west-2`). Must match the bucket's actual region — used for both SDK signing and public URLs |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Static credentials. When both are unset, the AWS SDK default credential chain is used |
| `AWS_ENDPOINT_URL` | Custom S3-compatible endpoint (e.g. MinIO, R2, B2). Setting this switches to path-style URLs |
| `CLOUDFRONT_DOMAIN` | CloudFront distribution domain — when set, public URLs use this host instead of the S3 host |
| `CLOUDFRONT_KEY_PAIR_ID` | CloudFront key pair ID for signed URLs |
| `CLOUDFRONT_PRIVATE_KEY` | CloudFront private key (PEM format) |

### Cookies

| Variable | Description |
|----------|-------------|
| `COOKIE_DOMAIN` | Optional `Domain` attribute for session + CloudFront cookies. **Leave empty** for single-host deployments (localhost, LAN IP, or a single hostname). Only set it when the frontend and backend sit on different subdomains of one registered domain (e.g. `.example.com`). **Do not use an IP literal** — RFC 6265 forbids IP addresses in the cookie `Domain` attribute and browsers will drop such `Set-Cookie` headers. |

The `Secure` flag on session cookies is derived automatically from the scheme of `FRONTEND_ORIGIN`: HTTPS origins get `Secure` cookies; plain-HTTP origins (LAN / private-network self-host) get non-secure cookies so the browser can actually store them.

If the frontend and backend are served from different hostnames, `COOKIE_DOMAIN` is **required**, not optional: the browser must be able to read the `multica_csrf` cookie from the page's own origin to send the `X-CSRF-Token` header, and without it every write request fails with `403 {"error":"CSRF validation failed"}`. Scope it to the narrowest parent domain that covers both hosts — it also shares the `multica_auth` session cookie with every host under that domain. See [Reverse Proxy](#reverse-proxy) for the full split-domain configuration and its trust requirements.

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |
| `METRICS_ADDR` | empty | Optional Prometheus metrics listener, for example `127.0.0.1:9090` |
| `FRONTEND_PORT` | `3000` | Frontend port |
| `CORS_ALLOWED_ORIGINS` | Value of `FRONTEND_ORIGIN` | Comma-separated list of allowed origins |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

### CLI / Daemon

These are configured on each user's machine, not on the server:

| Variable | Default | Description |
|----------|---------|-------------|
| `MULTICA_SERVER_URL` | `ws://localhost:8080/ws` | WebSocket URL for daemon → server connection |
| `MULTICA_APP_URL` | `http://localhost:3000` | Frontend URL for CLI login flow |
| `MULTICA_DAEMON_POLL_INTERVAL` | `3s` | How often the daemon polls for tasks |
| `MULTICA_DAEMON_HEARTBEAT_INTERVAL` | `15s` | Heartbeat frequency |

Agent-specific overrides:

| Variable | Description |
|----------|-------------|
| `MULTICA_CLAUDE_PATH` | Custom path to the `claude` binary |
| `MULTICA_CLAUDE_MODEL` | Override the Claude model used |
| `MULTICA_CODEX_PATH` | Custom path to the `codex` binary |
| `MULTICA_CODEX_MODEL` | Override the Codex model used |
| `MULTICA_COPILOT_PATH` | Custom path to the `copilot` (GitHub Copilot CLI) binary |
| `MULTICA_COPILOT_MODEL` | Override the Copilot model used (note: GitHub Copilot routes models through your account entitlement, so this may not be honoured) |
| `MULTICA_OPENCODE_PATH` | Custom path to the `opencode` binary |
| `MULTICA_OPENCODE_MODEL` | Override the OpenCode model used |
| `MULTICA_OPENCLAW_PATH` | Custom path to the `openclaw` binary |
| `MULTICA_OPENCLAW_MODEL` | Override the OpenClaw model used |
| `MULTICA_HERMES_PATH` | Custom path to the `hermes` binary |
| `MULTICA_HERMES_MODEL` | Override the Hermes model used |
| `MULTICA_GEMINI_PATH` | Custom path to the `gemini` binary |
| `MULTICA_GEMINI_MODEL` | Override the Gemini model used |
| `MULTICA_PI_PATH` | Custom path to the `pi` binary |
| `MULTICA_PI_MODEL` | Override the Pi model used |
| `MULTICA_CURSOR_PATH` | Custom path to the `cursor-agent` binary |
| `MULTICA_CURSOR_MODEL` | Override the Cursor Agent model used |

## Database Setup

CyberAgent requires PostgreSQL 17 with the pgvector extension.

### Using Docker Compose (Recommended)

The `docker-compose.selfhost.yml` includes PostgreSQL. No separate setup needed.

### Using Your Own PostgreSQL

If you prefer to use an existing PostgreSQL instance, ensure the pgvector extension is available:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Set `DATABASE_URL` in your `.env` and remove the `postgres` service from the compose file.

### Running Migrations Manually

The Docker Compose setup runs migrations automatically. If you need to run them manually:

```bash
# Using the built binary
./server/bin/migrate up

# Or from source
cd server && go run ./cmd/migrate up
```

## Manual Setup (Without Docker Compose)

If you prefer to build and run services manually:

**Prerequisites:** Go 1.26+, Node.js 20+, pnpm 10.28+, PostgreSQL 17 with pgvector.

```bash
# Start your PostgreSQL (or use: docker compose up -d postgres)

# Build the backend
make build

# Run database migrations
DATABASE_URL="your-database-url" ./server/bin/migrate up

# Start the backend server
DATABASE_URL="your-database-url" PORT=8080 JWT_SECRET="your-secret" ./server/bin/server
```

For the frontend:

```bash
pnpm install
pnpm build

# Start the frontend (production mode)
cd apps/web
REMOTE_API_URL=http://localhost:8080 pnpm start
```

## Reverse Proxy

In production, put a reverse proxy in front of both the backend and frontend to handle TLS and routing.

### Caddy (Recommended)

**Single-domain layout** — frontend and backend served on the same hostname (this is what `docker-compose.selfhost.yml` defaults to):

```
cyberagent.example.com {
    # WebSocket route — must come before the catch-all
    @multica_ws path /ws /ws/*
    handle @multica_ws {
        reverse_proxy localhost:8080 {
            flush_interval -1
        }
    }

    # Everything else → frontend
    reverse_proxy localhost:3000
}
```

**Separate-domain layout** — frontend and backend on different hostnames:

```
app.example.com {
    reverse_proxy localhost:3000
}

api.example.com {
    @multica_ws path /ws /ws/*
    handle @multica_ws {
        reverse_proxy localhost:8080 {
            flush_interval -1
        }
    }

    reverse_proxy localhost:8080
}
```

Two non-obvious bits inside the `/ws` block are worth calling out — both are common reasons real-time updates "stop working" on a Caddy-fronted self-host:

- **`path /ws /ws/*` (not `/ws*`)** — bare `handle /ws` is an exact match, so future path variants under `/ws/` fall through to the frontend block. The obvious shortcut `handle /ws*` overcorrects in the other direction: Caddy's `*` is a glob without a path-segment boundary, so it would also catch unrelated paths like `/ws-foo`, which is a legitimate workspace URL (only the exact slug `ws` is reserved). Listing `/ws` and `/ws/*` explicitly covers both real cases without overreach.
- **`flush_interval -1`** — disables response buffering so WebSocket frames are forwarded as soon as they arrive. Without it, frames can sit behind Caddy's default flush window, which looks like delayed comments, missing typing indicators, or "comments only appear after a page refresh."

### Nginx

```nginx
# Frontend
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

When using separate domains for frontend and backend, set these environment variables accordingly:

```bash
# Backend
FRONTEND_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
COOKIE_DOMAIN=.example.com           # narrowest parent covering both hosts — read the scope warning below

# Frontend (only if you are building the web image from source via docker-compose.selfhost.build.yml)
REMOTE_API_URL=https://api.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws
```

> **`COOKIE_DOMAIN` is required in this setup — omitting it breaks every write.** The web app authenticates with an HttpOnly `multica_auth` cookie plus a JS-readable `multica_csrf` cookie, and sends the CSRF value as an `X-CSRF-Token` header on every non-GET request. Both cookies are host-only unless `COOKIE_DOMAIN` is set, so a frontend on `app.example.com` cannot read a cookie issued by `api.example.com`. The header is then never sent and the backend rejects the request with `403 {"error":"CSRF validation failed"}` — while GET requests keep working, so the app renders but nothing can be created or edited.
>
> After changing `COOKIE_DOMAIN`, delete the existing `multica_auth` / `multica_csrf` cookies on **both** hosts and log in again. Stale host-only cookies otherwise sit alongside the new domain-scoped ones and the browser sends both.

> **Scope `COOKIE_DOMAIN` as narrowly as possible.** The same value also scopes `multica_auth`, the session JWT, and the browser then sends it to **every** host under that domain. `HttpOnly` only stops page scripts from reading the cookie — it does not stop the server behind a sibling subdomain from receiving it on every request. Use the narrowest parent that still covers both hosts: for `agent.example.com` + `api.agent.example.com` that is `.agent.example.com`, **not** `.example.com`, which would also hand your users' session cookie to unrelated hosts such as a separately deployed `docs.example.com`.

Both of these must hold, or this layout is not safe to use:

- The frontend and backend share a common parent domain. Unrelated domains (`app.com` and `api.io`) cannot be covered by any `COOKIE_DOMAIN` value.
- Every host under that parent domain is operated by the same trusted party. If anything in scope is third-party hosted, or other teams can create records under it, a compromise or a rogue service there receives valid sessions for your deployment.

If either condition fails, use the same-origin layout below, which keeps the session cookie host-only.

### Same Origin (Recommended)

A separate API domain is not required. Leave `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` at their defaults and the browser calls `/api` and `/ws` on the page's own origin, so no cross-host cookie problem can arise in the first place:

```bash
# Backend
FRONTEND_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
COOKIE_DOMAIN=                       # empty: cookies are host-only on app.example.com, which is correct here

# Frontend
NEXT_PUBLIC_API_URL=                 # empty: the client uses relative /api paths on the page origin
NEXT_PUBLIC_WS_URL=                  # empty
REMOTE_API_URL=http://backend:8080   # target the Next.js rewrites proxy /api, /auth and /uploads to
```

Serve everything from the single `app.example.com` vhost. HTTP works out of the box, because Next.js rewrites forward `/api`, `/auth` and `/uploads` to `REMOTE_API_URL`. WebSockets do **not** go through those rewrites, so add a `/ws` block to the frontend vhost that reaches the backend directly:

```nginx
# Add to the app.example.com server block above
location /ws {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

See [WebSocket for LAN / Non-localhost Access](#websocket-for-lan--non-localhost-access) for why the rewrites cannot carry the `Upgrade` handshake.

This keeps cookies, CORS, and the WebSocket origin check on a single origin. It is both the configuration least likely to break and the safer one: the session cookie stays host-only, so no sibling subdomain can ever receive it. An `api.example.com` vhost can still be kept for CLI and daemon use: those clients authenticate with a `mul_` personal access token over `Authorization: Bearer`, which never goes through the cookie or CSRF path.

## LAN / Non-localhost Access

By default, CyberAgent works on `localhost`. If you access it from another machine on the LAN (e.g. `http://192.168.1.100:3000`), you need to tell the backend to accept that origin:

```bash
# .env — replace with your server's LAN IP
FRONTEND_ORIGIN=http://192.168.1.100:3000
CORS_ALLOWED_ORIGINS=http://192.168.1.100:3000
```

Then restart the stack:

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

### WebSocket for LAN / Non-localhost Access

HTTP requests (issues, comments, uploads) work on LAN out of the box — Next.js rewrites proxy `/api`, `/auth`, and `/uploads` to the backend. **WebSockets do not**: Next.js rewrites only forward HTTP requests, not the `Upgrade` handshake a WebSocket needs. If you open the app on `http://<lan-ip>:3000`, real-time features (chat streaming, live issue updates, notifications) will fail to connect until you do one of the following:

1. **Put a reverse proxy in front of the stack (recommended).** Nginx or Caddy terminates the WebSocket upgrade and forwards it to the backend on port 8080. See the [Reverse Proxy](#reverse-proxy) section above — the Nginx example already includes a `location /ws { ... }` block with the correct `Upgrade` / `Connection` headers. Once a proxy is in place the browser connects directly through it, so no frontend rebuild is needed.

2. **Bake a WebSocket URL into the web image.** If you are not running a reverse proxy, rebuild the web image with `NEXT_PUBLIC_WS_URL` pointing straight at the backend (port 8080 must be reachable from the browser):

   ```bash
   # In .env
   NEXT_PUBLIC_WS_URL=ws://<lan-ip>:8080/ws

   # Rebuild the web image so the build-time value is baked in
   docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build
   ```

   `NEXT_PUBLIC_WS_URL` is a build-time variable (see `Dockerfile.web`), so setting it only in `environment:` on the pre-built image has no effect — you must use the `selfhost.build.yml` override that rebuilds the image.

> **Note:** If you need to hard-code a different public API / WebSocket endpoint into the web image for any other reason, use the same source-build override: `docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build`.

## Health Check

The backend exposes public health endpoints:

```text
GET /health
→ {"status":"ok"}

GET /readyz
→ {"status":"ok","checks":{"db":"ok","migrations":"ok"}}

GET /healthz
→ same response as /readyz
```

Use `/health` for basic liveness / reachability checks. Use `/readyz` for
dependency-aware readiness probes and external monitoring that should fail when
the database is unavailable or migrations are not fully applied. `/healthz` is
kept as an alias for operator familiarity.

## Prometheus Metrics

The backend can expose Prometheus metrics on a separate management listener:

```bash
METRICS_ADDR=127.0.0.1:9090 ./server/bin/server
curl http://127.0.0.1:9090/metrics
```

`METRICS_ADDR` is empty by default, so no metrics listener is started. The
public API port does not serve `/metrics`; keep it that way for internet-facing
deployments. HTTP request metrics start accumulating only after the metrics
listener is enabled. Metrics can reveal internal routes, traffic volume,
dependency state, and runtime health.

For Docker or Kubernetes deployments, prefer a private scrape path: bind the
metrics listener to an internal interface and protect it with private
networking, allowlists, NetworkPolicy, or proxy authentication. If you bind
`METRICS_ADDR=0.0.0.0:9090` inside a container, only publish that port to a
trusted network, for example a host-local mapping such as
`127.0.0.1:9090:9090`.

## Upgrading

```bash
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```

Pin `MULTICA_IMAGE_TAG` in `.env` to an exact release like `v0.2.4` if you want to stay on a specific version. Migrations run automatically on backend startup. They are idempotent — running them multiple times has no effect.
If the selected GHCR tag has not been published yet, fall back to `docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build`.
