# AI Opt-In Gate (B + C)

**Date:** 2026-07-12
**Status:** Approved design, pending implementation plan

## Goal

Make the AI subsystem opt-in:

- **AI is OFF by default.** No models are shown or downloaded until the admin
  enables it.
- When OFF, the AI settings panel shows **only** an "Enable AI" toggle plus a
  short explanation. All other AI configuration (model list, aesthetic, tag
  settings) is hidden.
- When toggled ON, the model list becomes visible and each model can be
  downloaded / loaded manually by the admin.
- RAM++ (the new dedicated tagger) appears as its own downloadable entry in the
  model list.
- **Backend enforcement (B):** the Go backend is the authority for `aiActive`.
  When AI is disabled, every AI endpoint rejects the call (`ErrAIInactive`) and
  the sidecar is never contacted. This keeps the "disabled" state consistent
  across all clients, not just cosmetic.
- **Lifecycle unload (C):** when AI is toggled OFF, all loaded models are
  unloaded from VRAM (files stay on disk) so re-enabling is fast and VRAM is
  freed.

## Approach decision

Chosen: **B + C**.

- `A` (UI-only gate) was rejected for long-term maintenance: the "off" state
  would be purely client-side and could be bypassed by any other client; state
  could drift (UI says off but models stay loaded).
- `B` makes the server the source of truth for `aiActive`, matching the existing
  pattern where `globalAIEnabled` is already synced to the server via
  `triggerConfigUpdate` / `syncFromServer`.
- `C` is orthogonal to B and layered on top to free VRAM when idle.

## Architecture

```
Admin toggles aiActive (localStorage + server config blob)
        │
        ▼
Frontend AdminAITab ── aiActive=false ──► render ONLY "Enable AI" card
                    └─ aiActive=true  ──► render sections 1-3 + RAM++ card
        │
        ▼  (download / load / unload actions)
Go backend  /api/v1/ai/*   ── checks config.IsAIActive() ──► 403 if disabled
        │  (only when active)
        ▼
Python sidecar  /load-model (tagger branch → load_ram_session)
                /download-model (already works via registry spec)
                /unload-all (new, frees VRAM)
```

The AI config is stored as an opaque JSON **string blob** in
`app_config` (key `ai`). Adding `aiActive` requires **no DB schema change** —
the backend stores/returns the blob as-is; only the frontend and the Go
`config.Service` reader need to know the new field.

## Components & changes

### 1. State & config model

Files:
- `src/features/ai/types.ts`
  - Add `aiActive: boolean` to `AppAIConfig`, `EffectiveAIConfig`.
  - Add `aiActive: false` to `DEFAULT_APP_AI_CONFIG`.
- `src/features/ai/store.ts`
  - Add `aiActive: boolean` (default `false`) to `AIState`.
  - Add `setAiActive: (v: boolean) => void`.
  - Persist `aiActive` in `partialize` (mirror `globalAIEnabled`).
  - `syncFromServer` reads `config.aiActive` into `aiActive`.
- `src/features/ai/utils/triggerConfigUpdate.ts`
  - Include `aiActive: ai.aiActive` in the `updateAppConfigAction` payload.

### 2. Frontend gating (AdminAITab)

File: `src/features/settings/components/AdminAITab.tsx`

- At the top of the component body: if `!ai.aiActive`, return a single card:
  - Heading "Enable AI".
  - One-line explanation: models download locally on demand; nothing runs until
    enabled.
  - `Toggle` bound to `ai.aiActive` / `setAiActive` + `triggerConfigUpdate(ai, { aiActive: v })`.
  - On toggling **off**, also call the unload action (see §5).
- When `ai.aiActive` is true, render the existing sections 1–3 unchanged.

Note: `globalAIEnabled` ("Global AI Processing" — auto-tag on upload) stays a
separate toggle and is only meaningful while `aiActive` is true.

### 3. RAM++ entry in the model list

Files:
- `src/features/ai/constants.ts`
  - `export const RAM_MODEL_ID = "xcinc/recognize-anything-plus";` (the registry
    spec id used by the sidecar).
- `src/features/settings/components/AdminAITab.tsx` (section 1)
  - Add a card "RAM++ Tagger" that reads its row from
    `modelData.models.find(m => m.id === RAM_MODEL_ID)`.
  - Download button → `downloadModelOnServer(RAM_MODEL_ID)`.
  - Load button → `loadModelOnServer(RAM_MODEL_ID)` (the Go/sidecar load-model
    now accepts a generic modelId, not just a CLIP variant — see §4/§6).
  - Reflect `downloaded` / `loaded` from the row.
- `src/features/ai/hooks/useModelDownload.ts`
  - Expose `downloadRAM()` / `activateRAM()` (thin wrappers over the existing
    `downloadModelOnServer` / `loadModelOnServer` with `RAM_MODEL_ID`).
- `src/features/ai/services/aiStatusClient.ts`
  - `fetchAIStatus` already filters `type === "embed"` for CLIP variants; RAM is
    `type === "tagger"` and is consumed directly from the raw `models` array in
    AdminAITab, so no change needed there beyond the new card.

### 4. Backend enforcement — Go (`internal/api/ai`)

Files:
- `backend/internal/api/ai/service.go`
  - Change ctor `NewService(resolver PathResolver, sc *sidecar.Client)` to also
    accept the config reader (inject `config.Service` or `*db.GlobalDB`).
  - Add `ErrAIInactive = errors.New("ai is disabled")`.
  - Add guard helper: load `aiActive` via config; if false, return
    `ErrAIInactive` from every AI chokepoint:
    `EmbedImage`, `EmbedText`, `GenerateTags`, `ScoreAesthetic`, `LoadModel`,
    `DownloadModel` (and `BatchTag` / `BatchScore` if present).
  - Wire `LoadModel` (currently a stub `return nil`) to forward to
    `s.sidecar.LoadModel(sidecar.LoadModelRequest{ModelID: modelID})`.
- `backend/internal/api/config/service.go`
  - Add `IsAIActive() (bool, error)`: read the `ai` blob, `json.Unmarshal` into a
    struct with `AiActive bool \`json:"aiActive"\``, return the field (default
    `false` when missing / blob empty).
- `backend/internal/api/ai/handler.go`
  - `loadModelBody` currently has only `Variant string`. Change to accept a
    generic `ModelID string` (or both) so RAM++ (a tagger, not a CLIP variant)
    can be loaded. Forward `ModelID` to `svc.LoadModel`.
  - Map `ErrAIInactive` → HTTP `403` with a clear message (reuse the existing
    error-mapping pattern in the handlers).
- `backend/internal/api/router.go` — no route changes expected; reuse existing
  `/load-model` and add `/unload` (see §5).

### 5. Lifecycle unload — C

- Python sidecar `app/routes/models.py`
  - Add `POST /unload-all` → calls `unload_clip()`, `unload_aesthetic()`,
    `unload_ram()`.
- Go `internal/api/ai/service.go`
  - `UnloadAll()` → `s.sidecar.UnloadAll()` (add `UnloadAll` to
    `internal/sidecar/client.go` + request).
- Go `internal/api/ai/handler.go`
  - `POST /unload` admin route → `svc.UnloadAll()`.
- Frontend `AdminAITab`
  - On toggling `aiActive` off, call `unloadAll()` (new client fn wrapping
    `POST /api/v1/ai/unload`).

### 6. Python sidecar load-model tagger

File: `python-sidecar/app/routes/models.py`
- `load_model` currently handles `embed` (→ `load_clip_session`) and
  `aesthetic` (→ `load_aesthetic_session`) and raises `400` for other types.
- Add branch: `elif spec.type == "tagger": load_ram_session(spec)`.
- Add `load_ram_session(spec)` in the same module (mirror
  `load_clip_session` / `load_aesthetic_session`): call
  `ram.get_ram(pretrained=spec.id)` (or honor `RAM_PRETRAINED` env).
- Remove the `raise HTTPException(400, "unsupported model type")` fallback (or
  keep it only for truly unknown types).

`/download-model` already works for the RAM++ spec because the registry spec
(`xcinc/recognize-anything-plus`, type `tagger`) exists with correct
`allow_patterns`.

## Error handling

- Frontend: if any AI action is attempted while `aiActive === false`, surface a
  toast "Enable AI first" rather than hitting the network. Backend `403`
  responses are already turned into actionable toasts via `extractError`.
- Go: `ErrAIInactive` → `403` with consistent message across all AI endpoints.
- Download / load failures: keep existing status `error` surfacing; UI shows
  detail via `extractError`.

## Testing

- **Python** (`python-sidecar/tests/`)
  - Extend `test_models.py`: `/load-model` with a `tagger` spec dispatches to
    `load_ram_session` (patch `ram.get_ram`, assert called) — mirror the
    existing clip/aesthetic dispatch tests.
  - Add `test_models.py`: `/unload-all` calls all three unload fns.
  - Run full suite (`uv run python -m pytest`) → must stay green (currently 51).
- **Go** (`backend/internal/api/ai/`)
  - `service_test.go`: each chokepoint returns `ErrAIInactive` when config
    `aiActive === false`; returns normally (or forwards) when true.
  - `service_test.go`: `LoadModel` forwards the RAM++ modelId to the sidecar
    client (mock sidecar, assert `LoadModelRequest.ModelID` == RAM id).
  - `go test ./...` must stay green.
- **Frontend** (`src/`)
  - `AdminAITab` renders only the "Enable AI" card when `aiActive === false`
    (add/adjust a test).
  - RAM++ card appears and wires download/load when `aiActive === true`
    (add a test verifying the card renders + buttons call the right client fns).
  - `npx vitest run` must stay green (currently 376).

## Cross-file verification checklist (anti-error)

Before declaring done, grep/confirm these are mutually consistent:

- `src/features/ai/types.ts` — `aiActive` in `AppAIConfig`, `EffectiveAIConfig`,
  `DEFAULT_APP_AI_CONFIG`.
- `src/features/ai/store.ts` — state, `setAiActive`, `partialize`,
  `syncFromServer`.
- `src/features/ai/utils/triggerConfigUpdate.ts` — payload includes `aiActive`.
- `src/features/ai/constants.ts` — `RAM_MODEL_ID` exported.
- `src/features/settings/components/AdminAITab.tsx` — gate branch + RAM++ card +
  unload-on-off.
- `src/features/ai/hooks/useModelDownload.ts` — `downloadRAM` / `activateRAM`.
- `src/features/ai/services/aiStatusClient.ts` — RAM row consumed correctly.
- `backend/internal/api/ai/service.go` — ctor injection, `IsAIActive` guard,
  `LoadModel` forwarding, `UnloadAll`.
- `backend/internal/api/ai/handler.go` — `loadModelBody` accepts `ModelID`,
  `403` mapping, `/unload` route.
- `backend/internal/api/config/service.go` — `IsAIActive`.
- `backend/internal/sidecar/client.go` — `UnloadAll` request/method.
- `python-sidecar/app/routes/models.py` — `tagger` branch + `load_ram_session` +
  `/unload-all`.
- `python-sidecar/app/models/ram.py` — `get_ram` / `unload_ram` (already exist).

## Out of scope

- Changing the model download source / weights (already handled separately).
- Multi-user RBAC beyond the existing admin requirement on AI routes.
- Auto-processing behaviour of `globalAIEnabled` (unchanged).
