# prism

> **P**lease **R**emember **I**'m **S**till **M**aking this up as i go

local-first photo library. no cloud. no sync. no venture capital. no adult supervision. no sqlite anymore (we graduated to postgres like a big kid).

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Browser   │ ──3000──▶    Next.js       │──api/v1─▶     Go          │
└─────────────┘         │  (React 19 +     │         │  (Echo +        │
                        │   App Router)    │         │   pgx + EXIF)   │
                        └────────┬─────────┘         └────────┬────────┘
                                 │                            │
                                 │   goFetch (JSON)           │
                                 │                            │
                                 ▼                            ▼
                    storage/users/{id}/ + PostgreSQL :5432
```

two processes. one database (shared, like a bathroom at a gas station). the Next.js frontend is a pure UI layer — all database queries go through the Go backend via `goFetch`. we used to have Drizzle ORM on the Node side but we deleted it because maintaining the same schema in two languages is a special kind of suffering.

---

## the pitch (short version)

google photos kept telling me "remember this day" and i genuinely did not want to. so i built a photo library that runs entirely on my machine, where nobody can see my terrible photos or judge my organizational habits.

it's a Next.js frontend talking to a Go backend backed by PostgreSQL. upload photos, browse them, tag them, organize into folders, crop them in a built-in editor, and occasionally delete everything in a fit of existential dread. it works most of the time.

---

## what it actually does

- **photos on your disk, not someone's training set.** your cat's bad angles remain exclusively yours.
- **PostgreSQL.** one database. all users. `user_id` columns. row-level isolation via queries. we used to have one sqlite db per user like a gremlin hoarding shiny rocks, but then i discovered foreign keys and never looked back.
- **folders.** regular folders. they hold photos. that's it. no magic, no self-populating folders, no AI butler judging your organizational preferences.
- **trash + PIN-protected vault.** bcrypt-hashed PIN. i learned. don't ask.
- **image editor** with crop, curves, split toning, filters, and undo/redo. it's basically Lightroom for people who couldn't afford Lightroom and also didn't want one.
- **duplicate detection** via SHA-256. we judge cryptographically, the only honest kind of judgment.
- **video transcoding** via ffmpeg. optional, like wearing pants, like respecting personal boundaries.
- **EXIF parsing + dominant color extraction.** your phone camera writes weird metadata. we read it anyway.
- **lasso selection + shift-click range + bulk ops.** select 400 photos and do something regrettable to all of them at once.
- **31 vitest test files + Go tests.** they pass. mostly. the count is lower than before because we deleted a bunch of tests that were testing AI-specific behavior and honestly good riddance.

---

## what you need to run this dumpster fire

| thing | minimum | recommended | why |
|-------|---------|-------------|-----|
| OS | linux | linux | i tried this on windows once. it crashed. macos might work but i won't support it because i respect you enough to be honest |
| CPU | any x64 | 2+ cores | Node + Go + PostgreSQL, all at once. your CPU is a group project and nobody's pulling their weight |
| RAM | 2GB | 4GB+ | Node + Go + PostgreSQL, no longer fighting over resources like divorced parents |
| Disk | 1GB free | 5GB+ | your photos, presumably. no AI model weights anymore |
| GPU | not needed | lol no | CPU-only everything. GPU support is planned the way i plan to go to the gym — eventually, maybe, don't hold your breath |
| Node.js | v22 | v26+ | older versions work but i judge you silently |
| Go | 1.25+ | 1.26+ | someone decided to rewrite the backend in Go at 2am and honestly? that person had a point |
| TypeScript | 5.9 (exact) | not 7.0. typescript-eslint doesn't support 7.0 yet. we tried. we failed. we downgraded. we have peace now |
| Docker | yes | yes | postgres runs in a container because installing postgres natively is a personality test i failed |
| ffmpeg | optional | please | video transcoding silently skips itself if missing. like a guest who texts "i'm outside" and then you never see them again |

---

## install this garbage

takes ~2 minutes. i timed it. then i realized i was timing it because i have nothing better to do.

**the easy way (recommended):**

```bash
# 1. clone + install deps (go make coffee. or therapy.)
git clone https://github.com/ltless/prism.git
cd prism
pnpm install

# 2. one-shot setup (env secrets + postgres + schema + admin user)
pnpm setup
#   asks for admin username + password, does everything else automatically.
#   if you're scripting: echo -e "admin\nmypassword" | pnpm setup

# 3. run both processes (like managing a tiny dysfunctional couple)
pnpm dev
```

**the manual way (if you like pain):**

```bash
git clone https://github.com/ltless/prism.git
cd prism
pnpm install
pnpm setup:env                          # generate JWT secrets
docker compose up -d                    # start postgres
pnpm dev                                # run the thing
```

then promote yourself to admin:

```bash
docker exec prism-postgres psql -U prism -d prism -c "UPDATE users SET role = 'admin' WHERE username = 'your_username';"
```

log out, log back in. both processes must run simultaneously or you get 502 errors. this is not a bug, it's a *trust exercise*.

---

## migrating from sqlite (if you had the old version)

if you're upgrading from the sqlite era, i wrote a migration script that reads your old `.db` files and shoves everything into postgres. it handles null bytes in EXIF metadata (don't ask), fixes `storage_limit` overflow (5GB doesn't fit in a 32-bit integer, who knew), and injects `user_id` into tenant data that never had it.

```bash
python3 scripts/migrate-sqlite-to-pg.py --dry-run   # see what it'll do
python3 scripts/migrate-sqlite-to-pg.py              # actually do it
```

your old `.db` files get backed up to `backup/sqlite/`. the script is idempotent-ish (`ON CONFLICT DO NOTHING`) so running it twice won't duplicate data. probably. i tested it once.

---

## commands

```bash
pnpm setup              # one-shot wizard: env + postgres + schema + admin user. start here.
pnpm dev                # 2 processes, hot reload, maximum chaos
pnpm prod               # build + run all 2, less chaos, more guilt
pnpm dev:fe             # frontend only. you will get 502s. that's on you.
pnpm dev:be             # backend only.
pnpm test               # vitest tests. they pass. mostly.
pnpm test:watch         # watch mode, for the anxious
pnpm test:e2e           # playwright. because unit tests aren't enough anxiety.
cd backend && go test -p 1 ./...   # Go tests (serial, because they share a test DB)
pnpm lint               # eslint. it's clean. i'm as surprised as you are.
docker compose up -d    # start postgres. you need this. i'm not explaining why.
docker compose down      # stop postgres. gentle.
pnpm setup:env          # regenerate env (idempotent, like hitting yourself with a hammer is idempotent)
pnpm setup:ffmpeg       # install ffmpeg (optional, like oxygen)
```

the Go tests run with `-p 1` (serial package execution) because all test packages share the same `prism_test` database and running them in parallel causes table truncation race conditions that will make you question your life choices. this is documented here so future me doesn't think it's a bug. it's not a bug. it's a *concession*.

---

## architecture

```
backend/internal/
  api/         Echo handlers split by domain:
                 auth/    login, register, logout, me
                 media/   CRUD, upload, bulk, file serving (path guards everywhere)
                 folders/ CRUD, transactional delete
                 config/  app config (admin-only writes)
                 users/   profile, storage quota, setup
  auth/        JWT (issuer/subject), middleware, constant-time invite code
  config/      env loading (32-byte JWT minimum, enforced)
  db/          GlobalDB + TenantPool (shared PostgreSQL, user_id-scoped queries)
  dbtest/      test helpers (embedded schema, truncate between tests)
  media/       Storage (4 layers of path traversal guards. paranoid on purpose)
               + EXIF parser (now stops at null terminators like a normal parser)

src/           Next.js 16 App Router
  app/         /login, /register, /setup, /dashboard, /trash, /vault, /duplicates, /editor
  features/    media, onboarding, profile, settings
  lib/         api (goFetch → Go backend), auth context
  auth.ts      Server-side session via cookie → Go /auth/me
```

### database

**PostgreSQL 16** (in a Docker container, port 5432). one database, all users, all data. tables: `users`, `app_settings`, `folders`, `media`, `error_logs`, `transcode_queue`. `user_id` columns on all tenant tables. foreign key constraints enforced. this is what a real database looks like.

the Go backend owns all database access via `pgx/v5/stdlib` + `database/sql`. the Next.js frontend talks to Go via `goFetch` (JSON over HTTP on localhost). no direct DB connection from Node.js — we learned our lesson about maintaining schemas in two languages.

the test database (`prism_test`) is a separate database on the same postgres instance. Go tests share it and run serially (`-p 1`). this is fine.

### auth

**Go side:** Go issues JWTs (HMAC-SHA256, issuer `"prism"`, subject = user ID). JWTs are set as HttpOnly cookies with `SameSite=Lax`. token expiration is 7 days by default. no refresh tokens yet — users just re-login. this is fine for a personal tool.

**Next.js side:** `auth.ts` reads the `auth_token` cookie and calls Go's `/auth/me` to validate the session. no separate auth library — just a cookie + an API call. simple. boring. works.

### file serving

file serving happens in Go. every serving request goes through 4 path-traversal guard layers:

1. `ServeFile` — canonical path guard
2. `ServeThumbnail` — resolves absolute path, checks prefix
3. `ResolveUserMediaPath` — rejects `..`, absolute-outside-root, symlinks
4. user_id-scoped query — per-user path lookup

a maliciously crafted `filePath` like `../../etc/passwd` is rejected at layer 1. a crafted absolute path like `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID is rejected at layer 4 (non-existent user = 404).

range requests for video are handled with a `Content-Range` response. thumbnails are generated by sharp on the Node side and served by Go.

### EXIF parsing

EXIF data is parsed in Go during upload. the parser reads TIFF/EXIF IFDs and extracts camera make, model, lens, exposure, aperture, ISO, focal length, flash, white balance, metering mode, exposure program, color space, GPS coordinates, and capture date. it also extracts a 5-color dominant palette.

some phone cameras (INFINIX, OPPO) write raw binary garbage into EXIF makernote fields, including null bytes and control characters. postgresql JSONB rejects these (SQLSTATE 22P05), so we sanitize all metadata before insert. the parser also now stops at the first null byte in ASCII strings instead of reading the full `count` (which some cameras set larger than the actual string, causing adjacent EXIF fields to leak in). these bugs existed for years under sqlite because sqlite doesn't care what you put in it. postgres has standards. we have standards now too.

---

## security (because paranoid, and also because of several other problems related to trust issues)

i thought about this. probably more than i should have.

### threat model

prism is a personal media library. threat model is:

- **an unauthenticated attacker** trying to reach your photos or anything else.
- **an authenticated non-admin user** trying to do admin things (invite others, delete all media, change config).
- **yourself, at 3am**, about to delete everything.

not modeled: a state-level adversary with infinite resources. a compromised server. a rogue admin. if your admin account is compromised, the library is compromised. this is true of every system.

### tenant isolation

all tenant tables (`media`, `folders`) have `user_id` columns with foreign key constraints to `users(id)`. every Go query is scoped with `WHERE user_id = $1`. a bug in a query could theoretically leak data across users, but the FK constraints prevent orphaned rows and the application layer enforces the boundary. this is less isolated than per-user sqlite files (where a bug literally cannot reach another user's data because it's a different file), but it's what grown-up databases do and we're doing grown-up database things now.

### path traversal guards

every file access in Go goes through 4 layers: canonical path guard, absolute path resolution, symlink rejection, user_id-scoped query. a crafted `filePath` of `../../etc/passwd` is rejected at layer 1. `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID is rejected at layer 4.

### data in transit

- **client <-> Next.js** — HTTPS (via reverse proxy)
- **Next.js <-> Go** — HTTP over `127.0.0.1` (localhost)
- **any of these <-> the internet** — only via the reverse proxy. don't expose ports 8080 or 5432.

### data at rest

- **passwords:** bcrypt, cost 10. fine for 2026.
- **invites:** constant-time comparison. no time-based side channel.
- **media files:** stored on disk. no per-file encryption.
- **database:** PostgreSQL with foreign key constraints. `user_id` on all tenant tables. WAL mode enabled.
- **vault PIN:** bcrypt-hashed. never logged in plaintext. not reversible.

### rate limiting

in-memory sliding window. per-key rate limits: global 100/min per IP, auth 10/min per user ID. resets on process restart. this is intentional.

### library wipe

the admin can wipe the entire library — every user's media, every folder, every vault item. this is irreversible. requires `NUKE_CONFIRMATION_TOKEN` in the request body + admin password. set via env var, never exposed in the UI. `openssl rand -hex 32` produces something suitably annoying. if you don't set it, the wipe endpoint is disabled — fail closed, not fail open.

---

## deployment

putting prism somewhere people other than you can reach it. probably a bad idea. probably necessary anyway.

### prerequisites

1. have a domain name.
2. have a reverse proxy. nginx, caddy, traefik, whatever. caddy is fine.
3. have a TLS certificate or be prepared to get one from Let's Encrypt.
4. have Docker (for postgres) or a local postgres install.
5. have read the security section above. seriously.

if any of these sound like too much work, localhost is a perfectly valid endpoint. the internet is overrated.

### docker compose

postgres runs in a container via `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: prism-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: prism
      POSTGRES_USER: prism
      POSTGRES_PASSWORD: change-this-in-prod
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prism -d prism"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

in production: change the password. don't use `prism_dev_2024`. i shouldn't have to say this but here we are. consider not exposing port 5432 to the host at all — let the app talk to postgres via a Docker network.

### systemd services

prism runs two processes. systemd manages them as two services, because trying to run them as one unit is a debugging nightmare.

```ini
# prism-fe.service (Next.js frontend)
[Unit]
Description=Prism Frontend (Next.js)
After=network.target
[Service]
Type=simple
User=prism
WorkingDirectory=/opt/prism
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
```

```ini
# prism-be.service (Go backend)
[Unit]
Description=Prism Backend (Go)
After=network.target prism-postgres.service
[Service]
Type=simple
User=prism
WorkingDirectory=/opt/prism/backend
ExecStart=/opt/prism/backend/prism-server
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
```

build frontend: `pnpm build`. build backend: `pnpm build:be`. don't try to bind to `0.0.0.0`.

### reverse proxy

Next.js serves the UI and rewrites `/api/v1/*` to the Go backend (`localhost:8080`). no sidecar, no extra ports, no extra processes.

**caddy example:**
```caddyfile
media.yourdomain.com {
  reverse_proxy localhost:3000
}
```

caddy handles TLS automatically. next.js handles the `/api/v1/*` rewrite internally, so you only need to proxy port 3000.

**nginx example:**
```nginx
server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;
    client_max_body_size 210M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

`client_max_body_size 210M` is not optional. uploads are 200MB + overhead. nginx will reject anything bigger.

### environment variables

| var | where | notes |
|-----|-------|-------|
| `AUTH_SECRET` | `.env.local` | `openssl rand -base64 48 \| tr -d '\n/=+' \| head -c 64` |
| `JWT_SECRET` | `.env.local` + `backend/.env` | same as AUTH_SECRET. must match. |
| `DATABASE_URL` | `.env.local` + `backend/.env` | `postgresql://prism:***@localhost:5432/prism` |
| `REQUIRE_INVITE` | `backend/.env` | `true` (default) or `false` |
| `REGISTRATION_INVITE_CODE` | `.env.local` | set this. don't let random people sign up. |
| `NUKE_CONFIRMATION_TOKEN` | `.env.local` | required for library wipe. `openssl rand -hex 32`. |
| `NEXT_ALLOWED_ORIGINS` | `.env.local` | your domain, e.g. `https://media.yourdomain.com` |
| `AUTH_TRUST_HOST` | `.env.local` | `true` behind a trusted reverse proxy |
| `STORAGE_PATH` | `backend/.env` | `../storage/users` (optional, defaults to `storage/users`) |

the JWT secret minimum is 32 bytes. `pnpm setup:env` generates something long enough. if you write your own, make it long enough. `"my-super-secret-jwt-key-2024"` is not long enough. it was never long enough.

### storage

all user uploads live in `storage/users/{id}/`. thumbnails in `storage/users/{id}/media/thumbnails/`. the postgres data lives in the Docker volume `pgdata`.

in production: put `storage/` somewhere with adequate disk space. backups: the entire `storage/` directory + a postgres dump is everything. lose those and you lose everything.

### backups

```bash
#!/bin/bash
DEST=/backup/prism-$(date +%Y%m%d)
mkdir -p "$DEST"

# postgres dump
docker exec prism-postgres pg_dump -U prism prism > "$DEST/prism.sql"

# media files
rsync -av /opt/prism/storage/users/ "$DEST/users/"
```

run this via cron. restore is the reverse (minus the direction). it's a real backup, not a backup where you pray and hope.

### what breaks first

1. **JWT secret mismatch.** one file was hand-edited. everything fails subtly. always check this first.
2. **postgres connection refused.** docker compose isn't running. or port 5432 is taken by a native postgres you forgot about.

---

## troubleshooting (the parts i know about, and the parts i refuse to fix)

**502 errors** — one of the processes died. check which one. `pnpm dev` runs both; if one crashes the other keeps going like nothing happened. check the terminal output.

**postgres connection refused** — did you `docker compose up -d`? no? then there's no database. what did you expect. also check that port 5432 isn't already taken by a native postgres install you forgot about. `lsof -i :5432` is your friend.

**upload fails with 500 / "unsupported Unicode escape sequence"** — EXIF metadata from your phone camera contains control characters that PostgreSQL JSONB rejects. this should be handled automatically by the sanitizer. if you're seeing this, the sanitizer regex is wrong again and i apologize.

**EXIF data looks like garbage** — some phone cameras (INFINIX, OPPO) set EXIF string lengths larger than the actual string, causing the parser to read past the null terminator into adjacent binary data. this is fixed now but old data in the database may still be dirty. re-upload the files or wait for a re-extract script that doesn't exist yet.

**dev eats all your RAM** — dev toolchain tax: HMR + Go + PostgreSQL + file watchers. `pnpm prod` idles near zero because it has respect for system resources. be more like prod.

---

## what i would do differently

if i were starting over today (i won't), i would:

1. **one language for the backend.** we did this — Go owns all DB access now. Next.js is just a UI layer.
2. **start with postgres, not sqlite.** sqlite was easy until it wasn't. foreign keys and JSONB exist for a reason.
3. **a way to delete all test data without deleting all production data.** i have accidentally deleted production data. more than once.

none of these will happen. the codebase is a living document and like most living documents it is mostly fossilized.

---

<div align="center">

*one database. one query layer (Go). two processes. zero guarantees.*

*everything's on fire but at least the tests pass and the database has foreign keys now.*

**proprietary. all rights reserved. therapy: not included.**

</div>
