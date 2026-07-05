# security

i thought about this. probably more than i should have. here's what's in place, what's not, and what you should do about it.

---

## threat model

prism is a personal media library. threat model is:

- **an unauthenticated attacker** trying to reach your photos, your AI features, or anything else.
- **an authenticated non-admin user** trying to do admin things (invite others, delete all media, change AI config).
- **a compromised sidecar** trying to read media or models it shouldn't.
- **yourself, at 2am**, about to delete everything.

not modeled:

- a state-level adversary with infinite resources. if you're that target, don't use prism. use Tails.
- a compromised server. if you run prism on a host that's already owned, no amount of code can help.
- a rogue admin. if your admin account is compromised, the library is compromised. this is true of every system.

---

## authentication

### Next.js (NextAuth v5)

session cookies + CSRF tokens. sessions live on the client, signed by a server-side secret. the `AUTH_SECRET` is the only thing protecting your sessions. it's generated with `openssl rand -base64 48` — long enough for most attackers.

session lifetime is a few days. when the user logs out, the session cookie is invalidated. when the user's password changes, existing sessions are NOT invalidated (known gap; users must manually log out everywhere).

### Go (JWT)

JWTs with `HMAC-SHA256`. issuer `"prism"`, subject = user ID. the JWT is an `HttpOnly` cookie with `SameSite=Lax`. algorithm validation happens on every request — no "alg": "none" nonsense.

token validity: 7 days. no refresh tokens. users re-login. this is fine for a personal tool and annoying for a multi-user deployment.

invite codes are compared with `subtle.ConstantTimeCompare`. no code configured = all invites rejected. `REQUIRE_INVITE=true` is the default. changing this to `false` with no code configured will lock out all new registrations (not fail open — fail closed).

### why two auth systems

see [docs/ARCHITECTURE.md](./ARCHITECTURE.md), section "auth (why two?)". short answer: legacy, inertia, and the fact that Go is better at auth and Node is better at sessions, and i'd rather maintain two than rip out one.

---

## authorization

roles: `user` and `admin`.

- `user`: upload, browse, edit, delete their own media. folders, vault, etc. cannot manage users. cannot change app config. cannot wipe the library.
- `admin`: all user capabilities, plus promote/demote users, change app config, enable/disable global AI, wipe the library (with token).

the first registered user gets `user` role by default (not admin). to promote:

```bash
sqlite3 prism.db "UPDATE users SET role = 'admin' WHERE username = 'your_username';"
```

this is a manual SQL statement. there is no UI for it. this is intentional. the first user should be the only admin until they explicitly decide to make someone else one.

---

## file access

this is the most important section.

### tenant isolation

each user has their own SQLite file at `storage/users/{id}/prism.db`. queries are scoped to this file. there is no `user_id` column anywhere in the media table — the filesystem boundary is the user boundary.

a catastrophic data corruption in one tenant's DB cannot leak another tenant's data (different files). it can only lose the corrupted tenant's data, which is bad but contained.

### path traversal guards

every file access in Go goes through 4 layers:

1. **`ServeFile`** — canonical path guard. rejects `..`, absolute-outside-root.
2. **`ServeThumbnail`** — resolves absolute path, checks prefix against thumb dir.
3. **`ResolveUserMediaPath`** — rejects `..`, absolute-outside-root, symlinks pointing outside storage.
4. **tenant DB path lookup** — per-user SQLite connection. non-existent DB = 404.

a crafted `filePath` of `../../etc/passwd` is rejected at layer 1. `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID (one that doesn't exist) is rejected at layer 4.

same guards exist in Node for thumbnails and the sidecar path resolver.

### media ownership

when you request `/api/v1/media/{id}`, Go first queries the tenant DB (your user's DB) to verify the media exists there. if it doesn't, 404. there is no cross-user enumeration. you cannot list another user's media even if you guess their media IDs.

same for folders, vault items, and tags. every query is scoped to the current user's DB.

---

## data in transit

- **client ↔ Next.js** — HTTPS. Next.js handles TLS at the reverse proxy level.
- **Next.js ↔ Go** — HTTP over `127.0.0.1` (localhost). same host. loopback.
- **Next.js ↔ Sidecar** — HTTP over `127.0.0.1`. sidecar binds to localhost only. not exposed to the network.
- **Go ↔ Go DB** — SQLite uses the local filesystem. no network.
- **any of these ↔ the internet** — only via the reverse proxy. don't expose ports 8080 or 8081 to the network.

in production, use `SIDECAR_KEY` to authenticate sidecar requests. sidecar checks `X-Sidecar-Key` header on all requests except `/health`. unset = dev mode (no auth, open to localhost). set = enforced (members-only).

for internet-facing deployments, **set `SIDECAR_KEY`**. even though the sidecar binds to localhost, a compromised process on the same host could reach it. a shared secret is defense in depth.

---

## data at rest

- **passwords:** bcrypt, cost 10. fine for 2026. not bulletproof forever.
- **invites:** constant-time comparison. no time-based side channel (that we know of).
- **media files:** stored on disk. file permissions are whatever the prism user has. no per-file encryption.
- **per-user SQLite:** WAL mode + `PRAGMA foreign_keys = ON`, enforced on every pooled connection via DSN pragmas. if a pragma fails, connection dies.
- **vault PIN:** bcrypt-hashed. never logged in plaintext. not reversible. if you forget it, the vault stays locked until you reset the database.
- **AI models:** `storage/models/`. anyone with filesystem access can read them. they're public models from HuggingFace, not secret. but they're big (~5GB total) and take hours to re-download.

---

## rate limiting

in-memory sliding window. per-key rate limits:

- global: 100/min per IP
- auth endpoints: 10/min per user ID
- AI endpoints: 10–30/min per user ID (varies by endpoint)

resets on process restart. this is intentional — rate limit state is transient. the goal is to blunt brute-force attacks and runaway scripts, not to persist across restarts.

in dev: rate limits are real but rarely hit. in prod: set them appropriately. the defaults work for a personal tool.

---

## library wipe (`NUKE_CONFIRMATION_TOKEN`)

the admin can wipe the entire library — every user's media, every folder, every vault item. this is irreversible.

to prevent accidental wipes:

- the endpoint requires `NUKE_CONFIRMATION_TOKEN` in the request body.
- the token is set via env var and never exposed in the UI.
- the token should be long and hard to type. `openssl rand -hex 32` produces something suitably annoying.
- the action also requires the admin's password.

set `NUKE_CONFIRMATION_TOKEN` in `.env.local`. if you don't set it, the wipe endpoint is disabled — fail closed, not fail open.

---

## what isn't protected

honest accounting:

- **session hijacking via XSS.** Next.js sets `HttpOnly` on cookies, but client-rendered React apps can be vulnerable to XSS if user input is rendered unsanitized. we sanitize everything user-generated, but i'm not a perfect human.
- **cross-site request forgery** on endpoints that don't check it. most of them do (via NextAuth CSRF). some direct API endpoints rely on CORS + same-origin policy only.
- **data exfiltration by compromised server.** if an attacker owns the host, they own everything. this is a universal truth, not a prism-specific issue.
- **AI model compromise.** models download from HuggingFace with no integrity check beyond HTTPS. if HuggingFace is compromised, so are your models.
- **backups.** this document doesn't cover backup encryption. if your backups contain sensitive data, encrypt them separately.

---

## what you should do

in dev (localhost):

- leave `REGISTRATION_INVITE_CODE` set. default `REQUIRE_INVITE=true`. only invite people you trust.
- don't bother with `SIDECAR_KEY` (localhost only).
- don't bother with `NUKE_CONFIRMATION_TOKEN` (no wipe risk on localhost).

in production:

- set every single recommended env var from [docs/DEPLOYMENT.md](./DEPLOYMENT.md).
- use HTTPS. always.
- use a reverse proxy. always.
- set `SIDECAR_KEY`. share it with nobody.
- set `NUKE_CONFIRMATION_TOKEN`. pick something long.
- set `NEXT_ALLOWED_ORIGINS` to your domain.
- don't expose 8080 or 8081 to the network.
- back up `storage/` + `prism.db`. encrypt the backups separately.
- change your password annually. i don't. you should.

---

## reporting a vulnerability

there is no security team. there is no bounty program. there is only a GitHub issue queue and one person who reads it between coffee breaks.

if you find a security issue, open a private issue or email me directly. i'll fix it eventually. not immediately. eventually.

don't file a CVE for this. it's a personal media library. nobody's running it at scale. the blast radius is "your photos on your disk", not "millions of users compromised". a CVE is overkill for something you can fix by deleting a folder.

but seriously, if you find a path traversal bypass, i'd like to know.
