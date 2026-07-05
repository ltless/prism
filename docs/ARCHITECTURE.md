# architecture

why things are the way they are, and why some of them shouldn't be.

---

## high-level

three processes. two AI engines. one database file per user. zero cloud dependency.

```
┌──────────┐         ┌────────────────────────┐         ┌──────────────┐
│  Browser │ ──3000──▶│       Next.js          │──8080──▶│     Go       │
└──────────┘         │  React 19 / App Router │         │  Echo / ONNX │
                     │  Drizzle ORM           │         │  CLIP CLIP   │
                     └───────────┬────────────┘         └──────┬───────┘
                                 │                             │
                                 │    per-user SQLite          │  global db
                                 │    (better-sqlite3)         │  (modernc/sqlite)
                                 │                             │
                                 │       ┌─────────────────────┴────┐
                                 └─8081──▶│   Python Sidecar         │
                                          │   FastAPI / PyTorch      │
                                          │   CLIP + aesthetic       │
                                          └──────────────────────────┘
```

Next.js is the brain. it renders the UI, handles auth, runs server actions, and manages the Drizzle connections to per-user SQLite databases. it also proxies AI requests to the Python sidecar because Next.js cannot load PyTorch models (nobody's fault, just the nature of Node.js).

Go is the muscle. it handles file serving, range requests, video transcoding, and runs ONNX CLIP inference natively (no IPC hop, no cold start). it talks to the global database for auth and to per-user databases for media CRUD.

Python sidecar is the specialist. it does everything Go can't: aesthetic scoring and CLIP inference via PyTorch (for the people who don't trust the ONNX version of the same model). CPU-only. always. forever probably.

---

## database

global db: `prism.db` (project root). one row per user: id, username, password_hash, role, profile images, storage quota, invite status. every connection — Go and Node — reads this.

per-user db: `storage/users/{id}/prism.db`. one SQLite file per user. schema: `media`, `folders`, `vault_items`. no `user_id` column anywhere — the file system IS the user boundary. this means a catastrophic bug in one tenant can't leak another tenant's data. it can only lose its own data, which is fine.

Drizzle handles per-user DB connections in Node via a connection pool keyed by user ID. Go does the same with a `TenantPool` of `sql.DB` instances, also keyed by user ID. both enforce WAL mode and `PRAGMA foreign_keys = ON` on every new connection via DSN pragmas. if a pragma fails, the connection dies. this means we trust SQLite more than we trust ourselves, which is a reasonable position.

migrations: 15 tenant migrations + a few for the global db. managed by Drizzle-Kit in Next.js, raw SQL files in Go. they agree on the end state even if they disagree on the method. this is a philosophical difference i'm not resolving.

---

## auth

two auth systems. yes, two. no regrets.

### Next.js side (NextAuth v5 beta)

NextAuth manages sessions, CSRF tokens, and the standard cookie dance. it's good at its job. it also verifies Go-issued JWTs so the two systems can share an auth state without a shared session store.

### Go side

Go issues JWTs (HMAC-SHA256, issuer `"prism"`, subject = user ID). JWTs are set as HttpOnly cookies with `SameSite=Lax`. token expiration is 7 days by default. no refresh tokens yet — users just re-login. this is fine for a personal tool.

### why two?

because at some point someone said "i can write a better auth system in Go" and then committed 3 files, and then it was easier to keep both than to remove one. the Go JWT system is used for API endpoints (`/api/v1/*`). NextAuth is used for the UI and server actions. they coexist like roommates who share rent but not a Netflix account.

the JWT secret MUST match in `.env.local` (Next.js) and `backend/.env` (Go). `pnpm setup:env` generates one and writes it to both places, so you probably never have to think about this. until you hand-edit one file. then everything breaks subtly for 45 minutes.

---

## AI engines (the twins nobody asked for)

### Go engine (ONNX Runtime)

lives inside the Go binary. loads the ONNX version of CLIP models. has a BPE tokenizer written in Go by hand because `onnxruntime_go` doesn't ship with one, and importing a Python tokenizer into Go at runtime was, and remains, a terrible idea. three variants:

- `standard` (~600MB) — `openai/clip-vit-base-patch32`. fastest, lowest accuracy.
- `sharp` (~600MB) — `openai/clip-vit-base-patch16`. faster-accuracy tradeoff.
- `high` (~1.7GB) — `openai/clip-vit-large-patch14`. best accuracy, slowest, needs more VRAM (on GPUs i'll never use).

the Go engine does embeddings + zero-shot tag generation natively. no IPC hop. no cold start. no Python. just a binary and a `.onnx` file. beautiful in theory.

it does NOT do aesthetic scoring. that's the Python sidecar's job, because the ViT-L/14 + MLP model for aesthetics doesn't have a usable ONNX export and i'm not fighting Hugging Face over it.

### Python sidecar

lives in `python-sidecar/`. FastAPI. PyTorch. CPU-only. does everything the Go engine can do (CLIP embed + tag) *plus* aesthetic scoring. the sidecar lazy-loads models on first request, so cold startup is ~2–5 seconds the first time you ask it to do anything.

it has no GPU support. it has no plans for GPU support. it has no desire for GPU support. it is happy as a CPU-only artisanal inference service and would prefer you not bring up the topic.

### which one do i use?

Settings → AI lets you pick. Go engine is the default for embed/tag (faster, no IPC). sidecar is needed for aesthetic scoring. if you're not using that, Go alone is fine.

the sidecar also handles batch operations (upload-time AI processing, bulk tag generation). it's the only service aware of your custom taxonomy from Settings.

---

## file serving

file serving happens in Go. every serving request goes through 4 path-traversal guard layers:

1. `ServeFile` — canonical path guard
2. `ServeThumbnail` — resolves absolute path, checks prefix
3. `ResolveUserMediaPath` — rejects `..`, absolute-outside-root, symlinks
4. tenant DB path lookup — per-user SQLite connection

a maliciously crafted `filePath` like `../../etc/passwd` is rejected at layer 1. a crafted absolute path like `/etc/passwd` is rejected at layer 2. a crafted symlink is rejected at layer 3. a crafted user ID is rejected at layer 4 (non-existent DB = 404).

range requests for video are handled with a `Content-Range` response. thumbnails are generated by sharp on the Node side and served by Go. thumbnails for videos that haven't transcoded yet get a placeholder SVG with a play button because the video file is still `.mp4` not `.mov`.

---

## state management

on the client: Zustand 5 for AI/store state, React Query for server data, React state for local UI.

on the server: drizzle ORM for SQLite, NextAuth sessions, Go Echo context for request-scoped state.

there is no shared state between the three processes except:
- the global database (SQLite)
- JWT cookies
- HTTP requests

no shared memory. no shared message queues. no shared filesystem locks. the processes communicate by politely asking each other things over HTTP and hoping the answer is correct. this is, in fairness, how most distributed systems work.

---

## what i would do differently

if i were starting over today (i won't), i would:

1. **one AI engine, not two.** ONNX or PyTorch, pick one. maintain one codebase. stop downloading the same model twice in different formats.
2. **one auth system, not two.** either NextAuth all the way, or Go all the way. the dual setup exists for historical reasons, not technical ones.
3. **one language for the backend.** either Go (speed, memory safety) or Node.js (Drizzle ecosystem, shared types). not both. both is what happens at 2am.
4. **a database migration tool that doesn't require me to run two commands (`npx drizzle-kit push` + `go run cmd/migrate/`).** they agree on the end state but they disagree on the process.
5. **a way to delete all test data without deleting all production data.** i have accidentally deleted production data. more than once.

none of these will happen. the codebase is a living document and like most living documents it is mostly fossilized.
