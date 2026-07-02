# Prism — Private Media Intelligence

> **P**lease **R**emember **I**'m **S**till **M**aking this up as i go

i built this because google photos kept telling me "remember this day" and i didn't want to remember. i wanted my photo library judged locally, where google can't see me ugly-cry at a LAION aesthetic score of 0.02.

three processes. one database per user. zero cloud. zero venture capital. zero adult supervision.

**[Go](backend/)** handles auth + fileserving because Node.js tried to write a file once and had a dissociative episode. **[Next.js](.)** does the UI, server actions, and emotional labor. A **[Python sidecar](python-sidecar/)** does all the AI thinking — pure PyTorch on CPU, no GPU drama, no CUDA, no ONNX (we don't talk about ONNX. ONNX betrayed me. ONNX promised portability and delivered silent corruption. ONNX is why we can't have nice things).

```
[ Browser ] ──> [ Next.js :3000 ] ──/api/v1/*──> [ Go :8080 ]
                       │                              │
                       ├── Drizzle (per-user SQLite) ─┤
                       ├── /api/ai/* ──proxy──> [ Python Sidecar :8081 ]
                       │                            ├── CLIP (embed + tag)
                       │                            ├── LAION v2.5 (aesthetic)
                       │                            └── Florence-2 (waiting)
                       └────────────────────────────┘
                                    ▼
                         storage/users/{id}/ + prism.db
```

they share each user's database like divorced parents who still go to the same holiday party — technically functional, emotionally fraught, nobody's happy.

---

## what you get

- photos live on **your disk**, not in someone's training set. your cat's bad angles remain exclusively yours
- local AI: CLIP embeddings, semantic search, auto-tagging, LAION aesthetic scoring — all running on your CPU, slowly and philosophically
- video transcoding via ffmpeg (optional, zero guilt if missing, it just ghosts you silently)
- multi-user, each gets their own SQLite db. no `user_id` columns = no accidental data leaks. unless you leak it yourself, which is a *you* problem
- folders + smart folders that auto-populate by AI tags like a creepy butler who knows your organizational preferences
- trash + PIN-protected vault (to protect your photos from *you*, specifically)
- EXIF parsing, dominant color extraction, auto-favorite by aesthetic score — your AI has opinions about your photography and they are not kind
- image editor: crop, curves, split toning, filters, undo/redo — basically Lightroom for people who couldn't afford Lightroom
- duplicate detection via SHA-256 (we judge cryptographically, the only honest kind of judgment)
- bulk ops + lasso selection + shift-click range selection
- **485 tests** (vitest frontend + 67 pytest sidecar) that mostly pass and definitely prove something

---

## what you need

| thing | minimum | recommended | why |
|-------|---------|-------------|-----|
| OS | linux | linux | i tried running this on windows and my RAM called a crisis hotline. macos *might* work but i won't support it because i respect you enough to be honest |
| CPU | any x64 | 4+ cores | PyTorch loves cores the way i love questionable architectural decisions |
| RAM | 4GB | 8GB+ | Node.js + Go + Python + browser = your RAM is a group project and nobody's pulling their weight |
| Disk | 2GB free | 10GB+ | photos are fat, model cache is morbidly obese (~5GB just for AI weights) |
| GPU | not needed | lol no | sidecar runs torch+cpu. GPU support is planned the way i plan to go to the gym — eventually, maybe, don't hold your breath |
| Node.js | v18 | v22+ | older versions work but i judge you silently |
| Go | 1.22+ | 1.25+ | someone decided to rewrite half the backend in Go at 2am and honestly? that person had a point |
| Python | 3.12+ | 3.12 | transformers requires exactly this version or it throws errors that would make a theologian weep |
| uv | 0.5+ | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh`. it's faster than pip. pip is a beautiful disaster but uv is a contained disaster |
| FFmpeg | optional | please | video transcoding silently skips itself if missing. like a guest who texts "i'm outside" and you never see them |

---

## install this garbage

takes ~4 minutes. i timed it. then i cried. then i realized the timer included the crying.

```bash
# 1. clone + install deps (go make coffee. or therapy)
git clone https://github.com/ltless/prism.git
cd prism
pnpm install
cd python-sidecar && uv sync && cd ..

# 2. env (generates matching JWT secrets for go + next.js)
# yes, they need to match. no, i don't have a better system. yes, i'm aware.
pnpm setup:env

# 3. push schema
npx drizzle-kit push

# 4. run all 3 processes (like managing a tiny dysfunctional circus)
pnpm dev
```

open http://localhost:3000. **register** — first user gets `user` role (i don't trust defaults. or you. or me.). promote yourself like the self-important monarch you always knew you were:

```bash
sqlite3 prism.db "UPDATE users SET role = 'admin' WHERE username = 'your_username';"
```

log out, log back in. now you can open Settings → AI. you are now admin of your own media library — a position that comes with exactly zero compensation, infinite responsibility, and a vague sense of disappointment.

all three processes must run simultaneously or you get 502 errors. this is not a bug, it's a *trust exercise*.

> ffmpeg is optional — `pnpm setup:ffmpeg` if you want video. skip it if you're photos-only. i'll judge you but i'll do it silently, which is the polite form of judgment.

---

## the AI situation

the Python sidecar (`python-sidecar/`) is a FastAPI application on `:8081` that does all the thinking so you don't have to. it auto-starts with `pnpm dev`. pure PyTorch on CPU — no GPU needed, no CUDA, no drivers, no "my NVIDIA driver version is incompatible and now i have to reinstall my entire OS" energy.

**models (auto-downloaded via Settings → AI → Download, because manually wrangling model files is my trauma, not yours):**

- **CLIP** (3 variants) — embeddings + zero-shot tagging. base (fast, ~600MB, ready to disappoint you quickly), sharp (better accuracy, ~600MB, slightly slower disappointment), high (best accuracy, ~1.7GB, exquisite disappointment). all 512-dim for semantic search.
- **LAION v2.5** (~1.2GB) — aesthetic scoring. ViT-L/14 + MLP trained on the AVA dataset. gives your photos a score from 0 (this is an atrocity) to 1 (congratulations, you pointed a camera at something). the sidecar lazy-loads it and falls back to CLIP prompt-pair scoring if it breaks, because resilience is my middle name.
- **Florence-2** (~460MB) — object-detection tagger. infrastructure ready. inference blocked because Microsoft's custom code hates my specific version of `transformers`. it's not you, Florence-2. it's me. (it's actually you). CLIP zero-shot tagging covers for it.

**turn it on:** Settings → AI → toggle Global AI Processing → pick CLIP variant → Download → Activate. the sidecar downloads models via `huggingface_hub` with per-file progress (the UI polls live because keeping a WebSocket alive felt like emotional commitment). after that, every upload gets auto-tagged + scored in the background, search becomes semantic, and smart folders populate like they have opinions about your organizational habits.

auto-favorite threshold defaults to 0.75 — photos scoring above it get a star. your AI judges you at 3am when the server has nothing better to do.

CPU inference is fast enough for a personal library: ~0.2s per image for CLIP, ~0.3s for LAION on a Ryzen 3600. on a potato? your patience may vary, but your tests will still pass.

---

## commands

```bash
pnpm dev              # 3 procs, hot reload (next + go + sidecar) — the trifecta of mediocrity
pnpm prod             # build + run all 3 (no dev tax, all the guilt)
pnpm test             # 485 vitest tests. they pass. mostly.
cd python-sidecar && uv run pytest   # 67 sidecar tests. they also pass. i checked.
pnpm lint             # eslint. it's clean. i'm as surprised as you are.
pnpm test:e2e         # playwright. because unit tests aren't enough anxiety.
npx drizzle-kit push  # schema sync. don't ask what happens if you forget.
pnpm setup:env        # regenerate env (idempotent, like hitting yourself with a hammer is idempotent)
pnpm setup:ffmpeg     # install ffmpeg (optional, like oxygen)
```

---

## things that will go wrong

**502 / "sidecar unreachable"** — you forgot to start the sidecar. `pnpm dev` auto-starts it. you ran `pnpm dev:fe` only, didn't you? yeah. don't lie to me. start it: `pnpm dev:ai`. or check `http://localhost:8081/health`. the sidecar is not your ex, it won't ghost you for no reason (it will, but only if you didn't start it).

**"model not loaded"** — Settings → AI → Download → Activate. it's a 4-click fix. you've clicked harder things for less reward. the sidecar can lazy-load on first request if you're impatient, but cold start is 2-5 seconds. you've waited longer for a microwave meal.

**LAION scoring doesn't work** — download it first. Settings → AI → Aesthetic → LAION v2.5 → Download. i know, clicking is hard. the sidecar auto-loads on first score request, then falls back to CLIP prompt-pair scoring if LAION is broken. it's like having a backup friend who's *technically* there but you both know.

**port 8081 already in use** — a leftover sidecar is still running somewhere. it's like finding a forgotten houseguest. `pkill -f uvicorn` evicts it. happens when you kill `pnpm dev` with SIGKILL instead of SIGINT. you monster.

**"CPU Fallback Mode"** — that's not a bug, that's a feature description. the sidecar runs `torch+cpu`. GPU is future work, like world peace and folding my laundry.

**dev eats all your RAM** — dev toolchain tax: HMR + PyTorch + Go + file watchers. `pnpm prod` idles near zero because it has respect for system resources. be more like prod.

**photos delete but reappear like a curse** — Go and Next.js use different SQLite drivers. writes must go through Drizzle server actions. if `GLOBAL_DB_PATH` in `backend/.env` doesn't point to `../prism.db` (not `./data/global.db`), you get two realities. two database files. neither of them correct. welcome to the multiverse, it runs on SQLite.

---

## if you're paranoid

optional production hardening. skip if localhost-only. or if paranoia is too much effort (it is).

- **SIDECAR_KEY** — set in `.env.local`. the sidecar checks for `X-Sidecar-Key` header on all requests except `/health`. unset = dev mode (free entry, like an open bar). set = enforced (members-only, no riff-raff). don't expose this beyond localhost without it unless you hate your data.
- **JWT_SECRET** — must match in `.env.local` and `backend/.env`. minimum 32 bytes. not `"password"`. not `"secret"`. not `"my-super-secret-jwt-key-2024"`. `pnpm setup:env` generates one for you. if you hand-edit one file, edit both, because consistency is the hobgoblin of small minds and also a security requirement.
- **sidecar binds 127.0.0.1** — not exposed to the network. don't change this binding. you think you know what you're doing? you don't. i don't either. let's not find out together.
- **path traversal guard** — both Go and the sidecar validate all `filePath` params against storage root. blocks `..`, absolute-outside-root, symlinks, and your hopes of exploiting this.
- CSP + CSRF middleware on edge routes. rate limiting on Go and Next.js. `NUKE_CONFIRMATION_TOKEN` required to wipe the entire library (i made it deliberately annoying to type so you'd think twice). vault PIN is bcrypt-hashed because even your worst decisions deserve cryptographic protection.

---

<div align="center">

*one database per user. three processes. infinite emotional labor.*

*everything's on fire but at least the tests pass.*

**Proprietary. All rights reserved. Therapy: not included.**
</div>
