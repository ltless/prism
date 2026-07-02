# prism

> **P**lease **R**emember **I**'m **S**till **M**aking this up as i go

local-first photo library. no cloud. no sync. no venture capital. no adult supervision.

`Browser ─3000→ Next.js ─/api/v1→ Go (Echo+pgx) ── storage/users + PostgreSQL`

two processes. one database. Next.js renders pixels and holds opinions. Go owns the DB, the disk, the metadata. Node never sees a SQL string, a file handle, or a moment of glory.

## what it does

- photos on your disk, not someone's training set.
- PostgreSQL as single source of truth, every query `WHERE user_id = $1`.
- folders, search + filters, trash with restore, storage quotas enforced on upload.
- vault: PIN-protected server-side, 5 wrong tries → 15-min shared lockout. bcrypt, never client-side.
- editor at `/editor`: crop/adjust/color grade + history, engine in a web worker.
- duplicate detection via SHA-256, EXIF + palette (sanitized for the DB), video via ffmpeg (optional, like pants).
- at-rest encryption: every file on disk is AES-256-GCM under a memory-only master key. stolen backup = noise.

## how it works

Next = pixels only. no DB, no filesystem — all writes go through Go (uploads, editor saves, profile pics). Go = everything else. every tenant query is `WHERE user_id = $1`, file reads pass 4 path-traversal guards, EXIF is sanitized before insert. all API under `/api/v1`, one JWT cookie, Next rewrites it to Go so the browser never learns port 8080 exists.

## running it

```bash
git clone https://github.com/ltless/prism.git && cd prism
pnpm install && pnpm setup && pnpm dev   # env + postgres + schema + admin, then run
```

manual: `pnpm setup:env` + `docker compose up -d`. promote yourself: `docker exec prism-postgres psql -U prism -d prism -c "UPDATE users SET role='admin' WHERE username='you'"`. registration wants the invite code in `backend/.env` by default.

both processes must run or you get 502s. that's not a bug, it's a *trust exercise*.

## commands

```bash
pnpm dev | build | test | lint       # split with :fe / :be / :e2e
cd backend && go test -p 1 ./...     # serial: shared prism_test DB
cd backend && go run ./cmd/migrate-encrypt   # plaintext→encrypted, idempotent
```

## security

- at-rest encryption: per-file key wrapped by `ENCRYPTION_MASTER_KEY` (memory-only, fail-closed startup). serve decrypts to a `0600` temp, shreds it on close — plaintext never survives a request. thumbnails stay plaintext by design (rebuildable).
- auth: JWT cookie (HMAC-SHA256, HttpOnly, 7-day), bcrypt cost 10, invites constant-time, uploads magic-byte validated, rate limits per-IP. nuke = own data only, `NUKE_CONFIRMATION_TOKEN` gated.
- threat model: you, curious users, attackers, and anyone who walks off with the disk or a backup (encryption = noise). not modeled: compromised servers, rogue admins.

## deployment

env: `JWT_SECRET` + `DATABASE_URL` in both env files; `ENCRYPTION_MASTER_KEY` (`openssl rand -hex 32`), `STORAGE_PATH`, `REGISTRATION_INVITE_CODE` in `backend/.env`. reverse proxy → 3000, TLS; nginx `client_max_body_size 210M`. existing library? run `migrate-encrypt` before booting the new build.

backup: `pg_dump` + `rsync storage/users/` — and the encryption key *separately*, without it the backup is noise. a backup you haven't tested is a prayer, not a backup.

## troubleshooting

502s = one process died. profile/cover 404 = Go + Next on different `STORAGE_PATH`. every file 500 = wrong `ENCRYPTION_MASTER_KEY` or plaintext that dodged a migration. postgres refused = `docker compose up -d`.

---

<div align="center">

*one database. one query layer. two processes. zero guarantees.*

**proprietary. all rights reserved. therapy: not included.**

</div>