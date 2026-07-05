# deployment

putting prism somewhere people other than you can reach it. probably a bad idea. probably necessary anyway.

---

## prerequisites

before you expose this to the internet, you should:

1. read this document once. at least once.
2. have a domain name.
3. have a reverse proxy. nginx, caddy, traefik, whatever. caddy is fine.
4. have a TLS certificate or be prepared to get one from Let's Encrypt.
5. have read [docs/SECURITY.md](./SECURITY.md). seriously.

if any of these sound like too much work, localhost is a perfectly valid endpoint. the internet is overrated.

---

## system service (systemd)

prism runs three processes. systemd manages them as three services, because trying to run them as one unit is a debugging nightmare, and one of us has to be sane.

create three unit files in `/etc/systemd/system/`:

### prism-fe.service (Next.js frontend)

```ini
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

build it first: `pnpm build`. then `systemctl enable --now prism-fe`.

### prism-be.service (Go backend)

```ini
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

build it first: `pnpm build:be`. that produces `backend/prism-server`.

### prism-ai.service (Python sidecar)

```ini
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

no build step. `uv sync` sets up the venv. don't try to bind to `0.0.0.0`. seriously. the sidecar is localhost-only for a reason (see SECURITY.md).

---

## reverse proxy

Next.js serves the UI and all `/api/*` routes. the Go backend serves `/api/v1/*` (auth + media). these two need to be exposed. the sidecar (`:8081`) does NOT need to be exposed — don't. put it behind no proxies. leave it at `127.0.0.1`. pretend it doesn't exist from the outside world's perspective.

### caddy example

```caddyfile
media.yourdomain.com {
  # Next.js frontend + API
  reverse_proxy localhost:3000

  # Go backend for /api/v1/*
  reverse_proxy /api/v1/* localhost:8080

  # TLS handled automatically by Let's Encrypt
}
```

### nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    client_max_body_size 210M;  # required for media uploads

    # Next.js
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

    # Go backend
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

---

## environment variables for production

production needs everything the `.env.example` files mention, plus a few extras. see `.env.example` and `backend/.env.example` in the repo root.

required:

| var | where | notes |
|-----|-------|-------|
| `AUTH_SECRET` | `.env.local` | `openssl rand -base64 48 \| tr -d '\n/=+' \| head -c 64` |
| `JWT_SECRET` | `.env.local` + `backend/.env` | same as AUTH_SECRET. must match. |
| `GLOBAL_DB_PATH` | `backend/.env` | `../prism.db` (relative to backend/) |
| `STORAGE_PATH` | `backend/.env` | `../storage/users` |
| `MODELS_PATH` | `backend/.env` | `../storage/models` |
| `ONNX_LIB_PATH` | `backend/.env` | absolute path to `libonnxruntime.so` |

strongly recommended for internet-facing:

| var | where | notes |
|-----|-------|-------|
| `SIDECAR_KEY` | `.env.local` + sidecar config | shared secret. required. |
| `REGISTRATION_INVITE_CODE` | `.env.local` | set this. don't let random people sign up. |
| `REQUIRE_INVITE` | `.env.local` | `true` (default) or `false` |
| `NUKE_CONFIRMATION_TOKEN` | `.env.local` | required for library wipe. generate with `openssl rand -hex 32`. |
| `NEXT_ALLOWED_ORIGINS` | `.env.local` | your domain, e.g. `https://media.yourdomain.com` |
| `AUTH_TRUST_HOST` | `.env.local` | `true` behind a trusted reverse proxy |

the JWT secret minimum is 32 bytes. `pnpm setup:env` generates something long enough. if you write your own, make it long enough. `"my-super-secret-jwt-key-2024"` is not long enough. it was never long enough.

---

## storage

all user uploads live in `storage/users/{id}/`. thumbnails in `storage/users/{id}/thumbs/`. AI models in `storage/models/`. the global database `prism.db` is at the project root.

in production, these paths become important:

- put `storage/` somewhere with adequate disk space. SSDs are nice. HDDs are fine for bulk storage.
- backups: the entire `storage/` directory + `prism.db` is everything. lose those and you lose everything.
- don't symlink `storage/` across filesystems unless you enjoy debugging SQLite locks.
- don't put this on NFS unless you enjoy debugging SQLite locks even more.

---

## backups

the backup set is:
- `prism.db` (global user accounts)
- `storage/users/*/prism.db` (per-user databases)
- `storage/users/*/` (media files, thumbnails, etc.)

AI models in `storage/models/` can be re-downloaded from Hugging Face. back them up if your outbound bandwidth is expensive; otherwise, let them rebuild.

a minimal backup script:

```bash
#!/bin/bash
DEST=/backup/prism-$(date +%Y%m%d)
mkdir -p "$DEST"
cp /opt/prism/prism.db "$DEST/"
rsync -av /opt/prism/storage/users/ "$DEST/users/"
```

run this via cron. restore is the reverse. it's a real backup, not a backup where you pray and hope.

---

## what breaks first

when i've deployed prism to production (a private server for a few users, not a commercial launch), the things that break first are:

1. **JWT secret mismatch.** one file was hand-edited. everything fails subtly. always check this first.
2. **ONNX Runtime path.** wrong version, wrong file, wrong permissions. Go exits with a useless error.
3. **sidecar unreachable.** it wasn't started. it crashed. port 8081 is taken by something else. `systemctl status prism-ai`.
4. **photos disappearing.** `GLOBAL_DB_PATH` was wrong. Go and Next.js were talking to different SQLite files. check both `.env` files.
5. **slow first load.** AI models were still downloading or hadn't been downloaded at all. Settings → AI → Download → Activate.

the rest is standard stuff: permissions, disk full, memory pressure.

---

## what i won't support

- **kubernetes.** this is a personal media library, not a global service. if you're running this on k8s you're either experimenting or doing something i don't want to know about.
- **multi-instance.** one prism per server or VM. sharing storage across instances will break SQLite.
- **horizontal scaling.** there is no load balancer. there is no replica. there is only you and your photos, on one machine.
- **windows production.** it runs on windows in dev (sometimes). in production, it runs on linux.
- **ARM.** ONNX Runtime and PyTorch on ARM work, sometimes. but i haven't tested it enough to promise anything. proceed with curiosity, not confidence.
