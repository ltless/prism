# prism

> **P**lease **R**emember **I**'m **S**till **M**aking this up as i go

local-first photo library. no cloud. no sync. no venture capital. no adult supervision.

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Browser   │ ──3000──▶    Next.js       │──api/v1─▶     Go          │
└─────────────┘         │  (React 19 +     │         │  (Echo + ONNX   │
                        │   App Router)    │         │   Runtime CLIP) │
                        └────────┬─────────┘         └────────┬────────┘
                                 │                            │
                                 │   Drizzle (SQLite)         │
                                 │                            │
                                 │         ┌──────────────────┴──────────┐
                                 └──8081──▶│   Python Sidecar            │
                                           │   (FastAPI + PyTorch CLIP   │
                                           │    + aesthetic predictor)   │
                                           └─────────────────────────────┘
                                 │
                                 ▼
                    storage/users/{id}/ + prism.db
```

three processes. one database per user. two AI engines doing the same job in different languages, because at 2am that felt like a good idea. all media loads at once — no pagination, no "load more" button, no lazy loading. you wanted everything? you get everything.

---

## the pitch

google photos kept telling me "remember this day" and i genuinely did not want to. i wanted my photo library judged *locally*, where google can't see me ugly-cry at a LAION aesthetic score of 0.02.

so i wrote one. it has three processes, two AI engines, a BPE tokenizer hand-written in Go (because why not), and a database per user. it works most of the time.

---

## what it does

- **photos on your disk, not someone's training set.** your cat's bad angles remain exclusively yours.
- **two AI engines** — Go runs ONNX CLIP for fast embed/tag; Python PyTorch does aesthetic scoring. i wrote the same thing twice in different languages. no i won't explain why.
- **per-user SQLite databases.** no `user_id` columns. no cross-user leaks. the filesystem is the user boundary.
- **folders + smart folders** that auto-populate from AI tags like a creepy butler who knows your organizational preferences before you do.
- **trash + PIN-protected vault.** bcrypt-hashed PIN. i learned. don't ask.
- **image editor** with crop, curves, split toning, filters, and undo/redo. it's basically Lightroom for people who couldn't afford Lightroom.
- **duplicate detection** via SHA-256 for exact and CLIP cosine ≥0.95 for near-duplicates.
- **video transcoding** via ffmpeg. optional, like wearing pants.
- **EXIF parsing, dominant color extraction, auto-favorite by aesthetic score.** your AI has opinions about your photography and they are not kind.
- **lasso selection + shift-click range + bulk ops.** select 400 photos and do something regrettable to all of them at once.
- **all media loads at once.** no pagination. no "load more". you scroll, you see everything. your browser may have opinions about this.

---

## what you need to run this dumpster fire

| thing | minimum | recommended | why |
|-------|---------|-------------|-----|
| OS | linux | linux | i tried this on windows once. it crashed. macos might work but i won't support it because i respect you enough to be honest |
| CPU | any x64 | 4+ cores | two AI engines fighting for the same CPU like divorced parents at a school play |
| RAM | 4GB | 8GB+ | Node + Go + Python + ONNX + PyTorch, all at once. your RAM is a group project and nobody's pulling their weight |
| Disk | 2GB free | 10GB+ | ~5GB for AI model weights alone. the rest is your photos, presumably |
| GPU | not needed | lol no | CPU-only inference. deliberately. GPU support is planned the way i plan to go to the gym — eventually, maybe, don't hold your breath |
| Node.js | v18 | v22+ | older versions work but i judge you silently |
| Go | 1.22+ | 1.25+ | someone decided to rewrite half the backend in Go at 2am and honestly? that person had a point |
| Python | 3.12 | 3.12 (exact) | HuggingFace transformers requires exactly this version or it throws errors that would make a theologian weep |
| uv | 0.5+ | latest | faster than pip and less emotionally volatile |
| ffmpeg | optional | please | video transcoding silently skips itself if missing. like a guest who texts "i'm outside" and then you never see them again |
| `libonnxruntime.so` | required | required | Go backend refuses to start without it. download from [Microsoft's ONNX Runtime releases](https://github.com/microsoft/onnxruntime/releases) |

---

## install this garbage

takes ~4 minutes. i timed it. then i cried. then i realized the timer included the crying.

```bash
# 1. clone + install deps (go make coffee. or therapy.)
git clone https://github.com/ltless/prism.git
cd prism
pnpm install
cd python-sidecar && uv sync && cd ..

# 2. env — generates matching JWT secrets for go + next.js
#    yes they need to match. no i don't have a better system. yes i'm aware.
pnpm setup:env

# 3. push schema
npx drizzle-kit push

# 4. run all 3 processes (like managing a tiny dysfunctional circus)
pnpm dev
```

open http://localhost:3000. **register** — invite code required by default. first user gets `user` role, which is not very useful. promote yourself like the self-important monarch you always knew you were:

```bash
sqlite3 prism.db "UPDATE users SET role = 'admin' WHERE username = 'your_username';"
```

log out, log back in. go to Settings → AI to download models. all three processes must run simultaneously or you get 502 errors. this is not a bug, it's a *trust exercise*.

---

## commands

```bash
pnpm dev                # 3 processes, hot reload, maximum chaos
pnpm prod               # build + run all 3, less chaos, more guilt
pnpm dev:fe             # frontend only. you will get 502s. that's on you.
pnpm dev:be             # backend only.
pnpm dev:ai             # sidecar only.
pnpm test               # vitest. they pass. mostly.
pnpm test:watch         # watch mode, for the anxious
pnpm test:e2e           # playwright. because unit tests aren't enough anxiety.
cd backend && go test ./...   # Go tests
cd python-sidecar && uv run pytest   # pytest tests
pnpm lint               # eslint. it's clean. i'm as surprised as you are.
npx drizzle-kit push    # schema sync. don't ask what happens if you forget.
pnpm setup:env          # regenerate env (idempotent, like hitting yourself with a hammer is idempotent)
pnpm setup:ffmpeg       # install ffmpeg (optional, like oxygen)
```

---

## architecture

### high-level

three processes. two AI engines. one database file per user. zero cloud dependency.

- **Next.js** — the brain. renders UI, handles auth, runs server actions, manages Drizzle connections to per-user SQLite databases. proxies AI requests to the Python sidecar because Next.js cannot load PyTorch models (nobody's fault, just the nature of Node.js).
- **Go** — the muscle. file serving, range requests, video transcoding, ONNX CLIP inference natively (no IPC hop, no cold start). talks to the global database for auth and to per-user databases for media CRUD.
- **Python sidecar** — the specialist. everything Go can't: aesthetic scoring and CLIP inference via PyTorch (for the people who don't trust the ONNX version of the same model). CPU-only. always. forever probably.

### directory structure

```
backend/internal/
  ai/          ONNX Runtime CLIP engine + preprocessing + BPE tokenizer
               (hand-written in Go, unfortunately)
  api/         Echo handlers split by domain:
                 auth/    login, register, logout, me
                 media/   CRUD, upload, bulk, file serving (path guards everywhere)
                 folders/ CRUD, smart folders, transactional delete
                 config/  app config (admin-only writes)
                 users/   profile, storage quota, setup
                 ai/      embed, tags, aesthetic, load-model, status
  auth/        JWT (issuer/subject), middleware, constant-time invite code
  config/      env loading (32-byte JWT minimum, enforced)
  db/          GlobalDB + TenantPool (per-user prism.db, WAL+FK per DSN, every connection)
  media/       Storage (4 layers of path traversal guards. paranoid on purpose)

src/           Next.js 16 App Router
  app/         /login, /register, /setup, /dashboard, /trash, /vault, /duplicates, /editor
               /api/ai/* (sidecar proxy), /api/media/* (Go-style handlers)
  features/    media, ai, onboarding, profile, settings
  services/    db (per-tenant SQLite), ai (sidecar client), video (queue + transcode)
  auth.ts      NextAuth v5 + Go JWT dual verification
               (two auth systems, one app, no regrets)

python-sidecar/
  app/         FastAPI: /health, embed, tags, aesthetic, load-model, model-status
  ai/          CLIP (3 variants), aesthetic scoring
```

### database

**global db:** `prism.db` (project root). one row per user: id, username, password_hash, role, profile images, storage quota, invite status. every connection — Go and Node — reads this.

**per-user db:** `storage/users/{id}/prism.db`. one SQLite file per user. schema: `media`, `folders`, `vault_items`. no `user_id` column anywhere — the file system IS the user boundary. this means a catastrophic bug in one tenant can't leak another tenant's data. it can only lose its own data, which is fine.

Drizzle handles per-user DB connections in Node via a connection pool keyed by user ID. Go does the same with a `TenantPool` of `sql.DB` instances, also keyed by user ID. both enforce WAL mode and `PRAGMA foreign_keys = ON` on every new connection via DSN pragmas. if a pragma fails, the connection dies. this means we trust SQLite more than we trust ourselves, which is a reasonable position.

migrations: 15 tenant migrations + a few for the global db. managed by Drizzle-Kit in Next.js, raw SQL files in Go. they agree on the end state even if they disagree on the method. this is a philosophical difference i'm not resolving.

### auth

two auth systems. yes, two. no regrets.

**Next.js side (NextAuth v5 beta):** NextAuth manages sessions, CSRF tokens, and the standard cookie dance. it's good at its job. it also verifies Go-issued JWTs so the two systems can share an auth state without a shared session store.

**Go side:** Go issues JWTs (HMAC-SHA256, issuer `"prism"`, subject = user ID). JWTs are set as HttpOnly cookies with `SameSite=Lax`. token expiration is 7 days by default. no refresh tokens yet — users just re-login. this is fine for a personal tool.

**why two?** because at some point someone said "i can write a better auth system in Go" and then committed 3 files, and then it was easier to keep both than to remove one. the JWT secret MUST match in `.env.local` (Next.js) and `backend/.env` (Go). `pnpm setup:env` generates one and writes it to both places, so you probably never have to think about this. until you hand-edit one file. then everything breaks subtly for 45 minutes.

### AI engines (the twins nobody asked for)

**Go engine (ONNX Runtime):** lives inside the Go binary. loads the ONNX version of CLIP models. has a BPE tokenizer written in Go by hand because `onnxruntime_go` doesn't ship with one. three variants: `standard` (~600MB, `clip-vit-base-patch32`), `sharp` (~600MB, `clip-vit-base-patch16`), `high` (~1.7GB, `clip-vit-large-patch14`). does embeddings + zero-shot tag generation natively. no IPC hop. no cold start. no Python. it does NOT do aesthetic scoring. that's the Python sidecar's job.

**Python sidecar:** lives in `python-sidecar/`. FastAPI. PyTorch. CPU-only. does everything the Go engine can do (CLIP embed + tag) *plus* aesthetic scoring. the sidecar lazy-loads models on first request, so cold startup is ~2–5 seconds the first time you ask it to do anything. it has no GPU support. it has no plans for GPU support. it has no desire for GPU support. it is happy as a CPU-only artisanal inference service and would prefer you not bring up the topic.

Settings → AI lets you pick. Go engine is the default for embed/tag (faster, no IPC). sidecar is needed for aesthetic scoring. if you're not using that, Go alone is fine.

### file serving

file serving happens in Go. every serving request goes through 4 path-traversal guard layers:

1. `ServeFile` — canonical path guard
2. `ServeThumbnail` — resolves absolute path, checks prefix
3. `ResolveUserMediaPath` — rejects `..`, absolute-outside-root, symlinks
4. tenant DB path lookup — per-user SQLite connection

a maliciously crafted `filePath` like `../../etc/passwd` is rejected at layer 1. a crafted absolute path like `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID is rejected at layer 4 (non-existent DB = 404).

range requests for video are handled with a `Content-Range` response. thumbnails are generated by sharp on the Node side and served by Go.

### state management

on the client: Zustand 5 for AI/store state, React Query for server data, React state for local UI.

on the server: drizzle ORM for SQLite, NextAuth sessions, Go Echo context for request-scoped state.

there is no shared state between the three processes except:
- the global database (SQLite)
- JWT cookies
- HTTP requests

no shared memory. no shared message queues. no shared filesystem locks. the processes communicate by politely asking each other things over HTTP and hoping the answer is correct.

---

## security

i thought about this. probably more than i should have.

### threat model

prism is a personal media library. threat model is:

- **an unauthenticated attacker** trying to reach your photos, your AI features, or anything else.
- **an authenticated non-admin user** trying to do admin things (invite others, delete all media, change AI config).
- **a compromised sidecar** trying to read media or models it shouldn't.
- **yourself, at 2am**, about to delete everything.

not modeled: a state-level adversary with infinite resources. a compromised server. a rogue admin. if your admin account is compromised, the library is compromised. this is true of every system.

### tenant isolation

each user has their own SQLite file at `storage/users/{id}/prism.db`. queries are scoped to this file. there is no `user_id` column anywhere in the media table — the filesystem boundary is the user boundary. a catastrophic data corruption in one tenant's DB cannot leak another tenant's data (different files).

### path traversal guards

every file access in Go goes through 4 layers: canonical path guard, absolute path resolution, symlink rejection, tenant DB path lookup. a crafted `filePath` of `../../etc/passwd` is rejected at layer 1. `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID is rejected at layer 4.

### data in transit

- **client ↔ Next.js** — HTTPS (via reverse proxy)
- **Next.js ↔ Go** — HTTP over `127.0.0.1` (localhost)
- **Next.js ↔ Sidecar** — HTTP over `127.0.0.1` (localhost only)
- **Go ↔ Go DB** — SQLite local filesystem
- **any of these ↔ the internet** — only via the reverse proxy. don't expose ports 8080 or 8081.

in production, use `SIDECAR_KEY` to authenticate sidecar requests. sidecar checks `X-Sidecar-Key` header on all requests except `/health`. unset = dev mode (no auth, open to localhost). set = enforced.

### data at rest

- **passwords:** bcrypt, cost 10. fine for 2026.
- **invites:** constant-time comparison. no time-based side channel.
- **media files:** stored on disk. no per-file encryption.
- **per-user SQLite:** WAL mode + `PRAGMA foreign_keys = ON`, enforced on every pooled connection via DSN pragmas.
- **vault PIN:** bcrypt-hashed. never logged in plaintext. not reversible.
- **AI models:** `storage/models/`. anyone with filesystem access can read them. they're public models from HuggingFace.

### rate limiting

in-memory sliding window. per-key rate limits: global 100/min per IP, auth 10/min per user ID, AI 10–30/min per user ID (varies by endpoint). resets on process restart. this is intentional.

### library wipe

the admin can wipe the entire library — every user's media, every folder, every vault item. this is irreversible. requires `NUKE_CONFIRMATION_TOKEN` in the request body + admin password. set via env var, never exposed in the UI. `openssl rand -hex 32` produces something suitably annoying. if you don't set it, the wipe endpoint is disabled — fail closed, not fail open.

### what isn't protected

- session hijacking via XSS. we sanitize everything user-generated, but i'm not a perfect human.
- CSRF on endpoints that don't check it. most do (via NextAuth CSRF). some rely on CORS + same-origin only.
- data exfiltration by compromised server. if an attacker owns the host, they own everything.
- AI model compromise. models download from HuggingFace with no integrity check beyond HTTPS.
- backups. this document doesn't cover backup encryption.

### what you should do

**dev (localhost):** leave `REGISTRATION_INVITE_CODE` set. default `REQUIRE_INVITE=true`. don't bother with `SIDECAR_KEY` or `NUKE_CONFIRMATION_TOKEN`.

**production:** set every recommended env var. use HTTPS. use a reverse proxy. set `SIDECAR_KEY`. set `NUKE_CONFIRMATION_TOKEN`. set `NEXT_ALLOWED_ORIGINS` to your domain. don't expose 8080 or 8081. back up `storage/` + `prism.db`. encrypt backups separately.

---

## deployment

putting prism somewhere people other than you can reach it. probably a bad idea. probably necessary anyway.

### prerequisites

1. have a domain name.
2. have a reverse proxy. nginx, caddy, traefik, whatever. caddy is fine.
3. have a TLS certificate or be prepared to get one from Let's Encrypt.
4. have read the security section above. seriously.

if any of these sound like too much work, localhost is a perfectly valid endpoint. the internet is overrated.

### systemd services

prism runs three processes. systemd manages them as three services, because trying to run them as one unit is a debugging nightmare.

create three unit files in `/etc/systemd/system/`:

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
After=network.target
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

```ini
# prism-ai.service (Python sidecar)
[Unit]
Description=Prism AI Sidecar (Python)
After=network.target
[Service]
Type=simple
User=prism
WorkingDirectory=/opt/prism/python-sidecar
ExecStart=/opt/prism/python-sidecar/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8081
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
```

build frontend: `pnpm build`. build backend: `pnpm build:be`. sidecar: `uv sync` sets up the venv. don't try to bind to `0.0.0.0`.

### reverse proxy

Next.js serves the UI and all `/api/*` routes. the Go backend serves `/api/v1/*` (auth + media). the sidecar (`:8081`) does NOT need to be exposed — don't.

**caddy example:**
```caddyfile
media.yourdomain.com {
  reverse_proxy localhost:3000
  reverse_proxy /api/v1/* localhost:8080
}
```

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

    location /api/v1/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`client_max_body_size 210M` is not optional. uploads are 200MB + overhead. nginx will reject anything bigger.

### environment variables

| var | where | notes |
|-----|-------|-------|
| `AUTH_SECRET` | `.env.local` | `openssl rand -base64 48 \| tr -d '\n/=+' \| head -c 64` |
| `JWT_SECRET` | `.env.local` + `backend/.env` | same as AUTH_SECRET. must match. |
| `GLOBAL_DB_PATH` | `backend/.env` | `../prism.db` (relative to backend/) |
| `STORAGE_PATH` | `backend/.env` | `../storage/users` |
| `MODELS_PATH` | `backend/.env` | `../storage/models` |
| `ONNX_LIB_PATH` | `backend/.env` | absolute path to `libonnxruntime.so` |
| `SIDECAR_KEY` | `.env.local` + sidecar | shared secret. required in prod. |
| `REGISTRATION_INVITE_CODE` | `.env.local` | set this. don't let random people sign up. |
| `REQUIRE_INVITE` | `.env.local` | `true` (default) or `false` |
| `NUKE_CONFIRMATION_TOKEN` | `.env.local` | required for library wipe. `openssl rand -hex 32`. |
| `NEXT_ALLOWED_ORIGINS` | `.env.local` | your domain, e.g. `https://media.yourdomain.com` |
| `AUTH_TRUST_HOST` | `.env.local` | `true` behind a trusted reverse proxy |

the JWT secret minimum is 32 bytes. `pnpm setup:env` generates something long enough. if you write your own, make it long enough. `"my-super-secret-jwt-key-2024"` is not long enough. it was never long enough.

### storage

all user uploads live in `storage/users/{id}/`. thumbnails in `storage/users/{id}/thumbs/`. AI models in `storage/models/`. the global database `prism.db` is at the project root.

in production: put `storage/` somewhere with adequate disk space. backups: the entire `storage/` directory + `prism.db` is everything. lose those and you lose everything. don't symlink `storage/` across filesystems unless you enjoy debugging SQLite locks. don't put this on NFS unless you enjoy debugging SQLite locks even more.

### backups

the backup set: `prism.db` (global user accounts), `storage/users/*/prism.db` (per-user databases), `storage/users/*/` (media files, thumbnails). AI models can be re-downloaded from Hugging Face.

```bash
#!/bin/bash
DEST=/backup/prism-$(date +%Y%m%d)
mkdir -p "$DEST"
cp /opt/prism/prism.db "$DEST/"
rsync -av /opt/prism/storage/users/ "$DEST/users/"
```

run this via cron. restore is the reverse. it's a real backup, not a backup where you pray and hope.

### what breaks first

1. **JWT secret mismatch.** one file was hand-edited. everything fails subtly. always check this first.
2. **ONNX Runtime path.** wrong version, wrong file, wrong permissions. Go exits with a useless error.
3. **sidecar unreachable.** it wasn't started. it crashed. port 8081 is taken by something else.
4. **photos disappearing.** `GLOBAL_DB_PATH` was wrong. Go and Next.js were talking to different SQLite files.
5. **slow first load.** AI models were still downloading or hadn't been downloaded at all.

### what i won't support

- **kubernetes.** this is a personal media library, not a global service.
- **multi-instance.** one prism per server or VM. sharing storage across instances will break SQLite.
- **horizontal scaling.** there is no load balancer. there is no replica. there is only you and your photos, on one machine.
- **windows production.** it runs on windows in dev (sometimes). in production, it runs on linux.
- **ARM.** ONNX Runtime and PyTorch on ARM work, sometimes. proceed with curiosity, not confidence.

---

## troubleshooting

**502 / "sidecar unreachable"** — you forgot to start the sidecar. `pnpm dev` auto-starts it. you ran `pnpm dev:fe` only, didn't you? start it with `pnpm dev:ai`, or check `http://localhost:8081/health`.

**"model not loaded"** — Settings → AI → Download → Activate. it's a 4-click fix. the sidecar lazy-loads on first request if you're impatient, but cold start is 2–5 seconds.

**ONNX Runtime won't init** — wrong `ONNX_LIB_PATH` = exit on startup. download `libonnxruntime.so`, set path in `backend/.env`, match version from `go.mod`.

**aesthetic scoring not working** — download the model first. Settings → AI → Aesthetic → Download. sidecar lazy-loads on first request, falls back to CLIP prompt-pair if unavailable.

**port 8081 already in use** — a leftover sidecar is still running. `pkill -f uvicorn` evicts it. happens when you kill `pnpm dev` with SIGKILL instead of SIGINT.

**"CPU Fallback Mode"** — that's not a bug, that's a feature description. the sidecar runs `torch+cpu`. GPU support is future work, like world peace and folding my laundry.

**dev eats all your RAM** — dev toolchain tax: HMR + PyTorch + Go + ONNX + file watchers. `pnpm prod` idles near zero because it has respect for system resources. be more like prod.

**photos delete but reappear like a curse** — Go and Next.js use different SQLite drivers. writes must go through Drizzle server actions. if `GLOBAL_DB_PATH` in `backend/.env` doesn't point to `../prism.db`, you get two realities. two database files. neither of them correct.

**two engines, neither loads** — need ONNX models (Go engine) AND PyTorch models (sidecar). different formats for the same model. yes this is annoying. no i won't merge them.

---

## what i would do differently

if i were starting over today (i won't), i would:

1. **one AI engine, not two.** ONNX or PyTorch, pick one. maintain one codebase.
2. **one auth system, not two.** either NextAuth all the way, or Go all the way.
3. **one language for the backend.** either Go or Node.js. not both. both is what happens at 2am.
4. **a database migration tool that doesn't require me to run two commands.** they agree on the end state but they disagree on the process.
5. **a way to delete all test data without deleting all production data.** i have accidentally deleted production data. more than once.

none of these will happen. the codebase is a living document and like most living documents it is mostly fossilized.

---

<div align="center">

*one database per user. two AI engines that do the same thing. three processes. zero guarantees.*

*everything's on fire but at least the tests pass.*

**proprietary. all rights reserved. therapy: not included.**

</div>
