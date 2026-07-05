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

three processes. one database per user. two AI engines doing the same job in different languages, because at 2am that felt like a good idea.

---

## the pitch (short version)

google photos kept telling me "remember this day" and i genuinely did not want to. i wanted my photo library judged *locally*, where google can't see me ugly-cry at a LAION aesthetic score of 0.02.

so i wrote one. it has three processes, two AI engines, a BPE tokenizer hand-written in Go (because why not), and a database per user. it works most of the time.

---

## what it actually does

- **photos on your disk, not someone's training set.** your cat's bad angles remain exclusively yours.
- **two AI engines** — Go runs ONNX CLIP for fast embed/tag; Python PyTorch does aesthetic scoring. i wrote the same thing twice in different languages. no i won't explain why. yes they both need to be downloaded. yes in different formats. yes this is a known footgun.
- **per-user SQLite databases.** no `user_id` columns. no cross-user leaks. no excuses. if you leak your own data that's a *you* problem.
- **folders + smart folders** that auto-populate from AI tags like a creepy butler who knows your organizational preferences before you do.
- **trash + PIN-protected vault.** bcrypt-hashed PIN. i learned. don't ask.
- **image editor** with crop, curves, split toning, filters, and undo/redo. it's basically Lightroom for people who couldn't afford Lightroom and also didn't want one.
- **duplicate detection** via SHA-256 for exact and CLIP cosine ≥0.95 for near-duplicates. we judge cryptographically, the only honest kind of judgment.
- **video transcoding** via ffmpeg. optional, like wearing pants, like respecting personal boundaries.
- **EXIF parsing, dominant color extraction, auto-favorite by aesthetic score.** your AI has opinions about your photography and they are not kind.
- **lasso selection + shift-click range + bulk ops.** select 400 photos and do something regrettable to all of them at once.
- **484 frontend tests + 106 Go tests + 67 Python tests = 657 tests** that mostly pass and definitely prove something, maybe.

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

## AI engines

two engines. same job. different implementations. i'm not proud of this but i'm also not fixing it.

### Go engine — ONNX Runtime

runs inside the Go backend. no Python dependency, no separate process, no IPC hop. loads quantized CLIP models via `onnxruntime_go`. has its own BPE tokenizer written in Go by hand, which i mention because it took longer than it should have and i'm still processing.

- CLIP image/text embeddings — 3 variants (standard / sharp / high)
- zero-shot tag generation (top-k tags with confidence scores)
- aesthetic scoring *delegates* to the sidecar because i didn't feel like writing a third thing

needs `ONNX_LIB_PATH` in `backend/.env` pointing to `libonnxruntime.so`. wrong path = instant exit on startup, no fallback, no helpful message, just vibes. match the version in `go.mod`.

### Python sidecar — "not your neighbor car, if its gone, i stole it"

FastAPI on `:8081`. auto-starts with `pnpm dev`. CPU-only PyTorch because GPUs are expensive and i'm cheap.

- **CLIP** (3 variants) — embeddings + zero-shot tagging. standard (~600MB), sharp (~600MB), high (~1.7GB). all 512-dim, except high which is 768. because consistency is for people with fewer models.
- **aesthetic scoring** (~1.2GB) — ViT-L/14 + MLP on AVA dataset. score 0–1. lazy-loaded, falls back to CLIP prompt-pair scoring if unavailable. the fallback exists because the real model broke once and i panicked.

**turn it on:** Settings → AI → Global AI Processing → pick variant → Download → Activate. models download via `huggingface_hub` with per-file progress. after that, uploads get auto-tagged + scored, search becomes semantic, smart folders populate themselves like magic. it's not magic, it's cosine similarity.

auto-favorite threshold defaults to 0.75. adjust if your taste differs from whatever AVA decided was good.

CPU inference on a Ryzen 3600: ~0.2s/image for CLIP, ~0.3s for aesthetic scoring. your mileage will vary. so will your patience.

---

## commands

```bash
pnpm dev                # 3 processes, hot reload, maximum chaos
pnpm prod               # build + run all 3, less chaos, more guilt
pnpm dev:fe             # frontend only. you will get 502s. that's on you.
pnpm dev:be             # backend only.
pnpm dev:ai             # sidecar only.
pnpm test               # 484 vitest tests. they pass. mostly.
pnpm test:watch         # watch mode, for the anxious
pnpm test:e2e           # playwright. because unit tests aren't enough anxiety.
cd backend && go test ./...   # 106 Go tests
cd python-sidecar && uv run pytest   # 67 pytest tests
pnpm lint               # eslint. it's clean. i'm as surprised as you are.
npx drizzle-kit push    # schema sync. don't ask what happens if you forget.
pnpm setup:env          # regenerate env (idempotent, like hitting yourself with a hammer is idempotent)
pnpm setup:ffmpeg       # install ffmpeg (optional, like oxygen)
```

---

## troubleshooting (the parts i know about, and the parts i refuse to fix)

**502 / "sidecar unreachable"** — you forgot to start the sidecar. `pnpm dev` auto-starts it. you ran `pnpm dev:fe` only, didn't you? yeah. don't lie to me. start it with `pnpm dev:ai`, or check `http://localhost:8081/health`. the sidecar is not your ex — it won't ghost you for no reason (it will, but only if you didn't start it).

**"model not loaded"** — Settings → AI → Download → Activate. it's a 4-click fix. you've clicked harder things for less reward. the sidecar lazy-loads on first request if you're impatient, but cold start is 2–5 seconds. you've waited longer for a microwave meal.

**ONNX Runtime won't init** — wrong `ONNX_LIB_PATH` = exit on startup. download `libonnxruntime.so`, set path in `backend/.env`, match version from `go.mod`. the error message is unhelpful on purpose. probably.

**aesthetic scoring not working** — download the model first. Settings → AI → Aesthetic → Download. sidecar lazy-loads on first request, falls back to CLIP prompt-pair if unavailable. the fallback is worse but it's something.

**port 8081 already in use** — a leftover sidecar is still running somewhere. it's like finding a forgotten houseguest. `pkill -f uvicorn` evicts it. happens when you kill `pnpm dev` with SIGKILL instead of SIGINT. you monster.

**"CPU Fallback Mode"** — that's not a bug, that's a feature description. the sidecar runs `torch+cpu`. GPU support is future work, like world peace and folding my laundry.

**dev eats all your RAM** — dev toolchain tax: HMR + PyTorch + Go + ONNX + file watchers. `pnpm prod` idles near zero because it has respect for system resources. be more like prod.

**photos delete but reappear like a curse** — Go and Next.js use different SQLite drivers. writes must go through Drizzle server actions. if `GLOBAL_DB_PATH` in `backend/.env` doesn't point to `../prism.db` (not `./data/global.db`), you get two realities. two database files. neither of them correct. welcome to the multiverse, it runs on SQLite.

**two engines, neither loads** — need ONNX models (Go engine) AND PyTorch models (sidecar). different formats for the same model. ONNX gets `.onnx`, PyTorch gets `.bin`/`.safetensors`. yes this is annoying. no i won't merge them.

---

## security (because paranoid, and also because of several other problems related to trust issues)

i thought about this. probably more than i should have. see [docs/SECURITY.md](./docs/SECURITY.md) for the full threat model.

- `MeInfo` struct excludes `password_hash` — the SQL doesn't even SELECT it. it's not there.
- JWT tokens: issuer `"prism"` + subject `userID`, algorithm validation on every request. no, you can't just swap algorithms.
- invite code: constant-time comparison (`subtle.ConstantTimeCompare`). no code set = all invites rejected. that's the point.
- body size limits: 1MB global, 210MB media uploads. don't upload a DVD.
- rate limiting: 100/min global, 10/min auth endpoints. in-memory sliding window. resets on restart (not a bug).
- folder delete: transactional unlink + delete. rollback on failure. your files are safer than your feelings.
- input validation: folder names ≤100 chars, type whitelist, `go-playground/validator/v10`.
- path traversal: 4 guard layers across `ServeFile`, `ServeThumbnail`, `ResolveUserMediaPath`, tenant DB paths. `..`, symlinks, outside-root — all blocked. i checked. twice.
- CSP + CSRF middleware. `NUKE_CONFIRMATION_TOKEN` required for library wipe. vault PIN bcrypt-hashed.
- WAL mode + foreign keys in DSN pragmas — every pooled connection, always. this matters more than you think.

---

## production hardening (skip if localhost-only. don't skip if it's on the internet.)

see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the long version.

- **`SIDECAR_KEY`** — set in `.env.local`. sidecar checks `X-Sidecar-Key` header on all requests except `/health`. unset = dev mode (free entry, like an open bar). set = enforced (members-only). don't expose to the network without it unless you hate your data.
- **`JWT_SECRET`** — must match in `.env.local` and `backend/.env`. minimum 32 bytes. not `"password"`. not `"secret"`. not `"my-super-secret-jwt-key-2024"`. `pnpm setup:env` generates one. if you hand-edit one file, edit both — because consistency is the hobgoblin of small minds and also a security requirement.
- **`REGISTRATION_INVITE_CODE`** — default `REQUIRE_INVITE=true`. no code = no registration. keep it that way unless you enjoy spam.
- **sidecar binds `127.0.0.1`** — not exposed to the network. don't change this binding. you think you know what you're doing? you don't. i don't either. let's not find out together.
- **`NUKE_CONFIRMATION_TOKEN`** — required to wipe the entire library. i made it deliberately hard to confirm so you'd think twice.

---

## architecture

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

see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) if you want the gory details about why a tenant database per user was a good idea at the time.

---

## docs

| file | about |
|------|-------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | the why and how, with diagrams and justifications |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | putting this on a server where strangers can reach it |
| [docs/SECURITY.md](./docs/SECURITY.md) | threat model, data flow, what can go wrong and what can't |
| [docs/testing-report.md](./docs/testing-report.md) | test coverage audit |
| [docs/testing-roadmap.md](./docs/testing-roadmap.md) | what's left to test |

---

<div align="center">

*one database per user. two AI engines that do the same thing. three processes. zero guarantees.*

*everything's on fire but at least the tests pass.*

**proprietary. all rights reserved. therapy: not included.**

</div>
