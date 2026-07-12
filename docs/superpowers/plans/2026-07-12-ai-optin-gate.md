# AI Opt-In Gate (B + C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI subsystem opt-in: OFF by default, model list hidden until an admin enables it, every Go AI endpoint rejects calls when disabled (backend enforcement), and models unload from VRAM when disabled. RAM++ appears as its own downloadable model entry.

**Architecture:** `aiActive` is a server-authoritative boolean stored in the opaque `app_config.ai` JSON blob (no DB migration). The Go `ai.Service` reads it via `config.Service.IsAIActive()` and rejects every AI chokepoint with `ErrAIInactive` when false. The Python sidecar gains a `tagger` branch in `/load-model` plus a `/unload-all` endpoint. The frontend `AdminAITab` renders only an "Enable AI" card while `aiActive` is false.

**Tech Stack:** TypeScript/React (zustand store), Go (echo, net/http httptest for tests), Python FastAPI (uvicorn sidecar).

**Spec:** `docs/superpowers/specs/2026-07-12-ai-optin-gate-design.md`

---

## File Structure

- `src/features/ai/types.ts` — add `aiActive` to `AppAIConfig`, `EffectiveAIConfig`, `DEFAULT_APP_AI_CONFIG`.
- `src/features/ai/store.ts` — `aiActive` state + `setAiActive`, persisted, synced from server.
- `src/features/ai/utils/triggerConfigUpdate.ts` — send `aiActive` in config payload.
- `src/features/ai/constants.ts` — export `RAM_MODEL_ID`.
- `src/features/ai/services/aiStatusClient.ts` — `loadModelOnServer(modelId)` takes a model id; add `unloadAllOnServer()`.
- `src/features/ai/hooks/useModelDownload.ts` — `downloadRAM` / `activateRAM`.
- `src/features/settings/components/AdminAITab.tsx` — gate + RAM++ card + unload-on-off.
- `python-sidecar/app/routes/models.py` — `tagger` branch + `load_ram_session` + `/unload-all`.
- `backend/internal/sidecar/client.go` — add `LoadModelRequest`, `LoadModel`, `UnloadAll`.
- `backend/internal/api/config/service.go` — `IsAIActive()`.
- `backend/internal/api/ai/service.go` — inject config, `ErrAIInactive`, guards, wire `LoadModel`, add `UnloadAll`.
- `backend/internal/api/ai/handler.go` — `loadModelBody` → `ModelID`; map `ErrAIInactive` → 403; add `Unload` handler.
- `backend/internal/api/router.go` — pass `configSvc` to `ai.NewService`; add `/unload` route.

---

### Task 1: Frontend state model (`aiActive`)

**Files:**
- Modify: `src/features/ai/types.ts`
- Modify: `src/features/ai/store.ts`
- Modify: `src/features/ai/utils/triggerConfigUpdate.ts`
- Test: `src/features/ai/__tests__/store.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { useAIStore } from "@/features/ai/store";

describe("aiActive state", () => {
  beforeEach(() => {
    useAIStore.setState({ aiActive: false });
  });

  it("defaults to false", () => {
    expect(useAIStore.getState().aiActive).toBe(false);
  });

  it("setAiActive updates state", () => {
    useAIStore.getState().setAiActive(true);
    expect(useAIStore.getState().aiActive).toBe(true);
  });

  it("syncFromServer sets aiActive from server config", () => {
    useAIStore.getState().syncFromServer({
      isEnabled: false,
      userAIEnabled: false,
      aiActive: true,
      variant: "standard",
      aestheticModel: "clip",
      tagThreshold: 0.12,
      aestheticEnabled: false,
      autoFavoriteEnabled: false,
      autoFavoriteThreshold: 0.75,
      device: "gpu",
    });
    expect(useAIStore.getState().aiActive).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/lightness/Documents/Project/prism && npx vitest run src/features/ai/__tests__/store.test.ts`
Expected: FAIL — `aiActive` does not exist on state / `syncFromServer` lacks the field.

- [ ] **Step 3: Add `aiActive` to types**

In `src/features/ai/types.ts`, add the field to each interface/const:

```ts
export interface AppAIConfig {
  enabled: boolean;
  aiActive: boolean;
  variant: AIModelVariant;
  aestheticModel: AestheticModelType;
  tagThreshold: number;
  autoFavoriteThreshold: number;
  device?: AIDevice;
  customTaxonomy?: Record<string, string[]>;
  aestheticEnabled?: boolean;
}

export interface EffectiveAIConfig {
  isEnabled: boolean;
  userAIEnabled: boolean;
  aiActive: boolean;
  variant: AIModelVariant;
  aestheticModel: AestheticModelType;
  tagThreshold: number;
  aestheticEnabled: boolean;
  autoFavoriteEnabled: boolean;
  autoFavoriteThreshold: number;
  device: AIDevice;
  customTaxonomy?: Record<string, string[]>;
}

export const DEFAULT_APP_AI_CONFIG: AppAIConfig = {
  enabled: false,
  aiActive: false,
  variant: 'standard',
  aestheticModel: 'clip',
  tagThreshold: 0.12,
  autoFavoriteThreshold: 0.75,
  device: 'gpu',
  aestheticEnabled: false,
};
```

- [ ] **Step 4: Wire `aiActive` into the store**

In `src/features/ai/store.ts`:
- Add to `AIState` interface: `aiActive: boolean;` and `setAiActive: (enabled: boolean) => void;`
- In the `create` initializer add `aiActive: false,` (near `globalAIEnabled: false,`).
- Add setter: `setAiActive: (enabled) => set({ aiActive: enabled }),` (near `setGlobalAIEnabled`).
- In `partialize` add `aiActive: state.aiActive,`.
- In `syncFromServer` add `aiActive: config.aiActive,`.

- [ ] **Step 5: Send `aiActive` in config updates**

In `src/features/ai/utils/triggerConfigUpdate.ts`, add `aiActive: ai.aiActive,` to the `updateAppConfigAction({...})` object (alongside `enabled: ai.globalAIEnabled,`).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/ai/__tests__/store.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/ai/types.ts src/features/ai/store.ts src/features/ai/utils/triggerConfigUpdate.ts src/features/ai/__tests__/store.test.ts
git commit -m "feat(ai): add aiActive flag to state, types, and config sync"
```

---

### Task 2: Python sidecar — tagger load + unload-all

**Files:**
- Modify: `python-sidecar/app/routes/models.py`
- Test: `python-sidecar/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Append to `python-sidecar/tests/test_models.py`:

```python
def test_load_model_tagger_dispatches_to_ram():
    from app.models import ram

    spec = registry.find_spec("xcinc/recognize-anything-plus")
    assert spec is not None and spec.type == "tagger"
    with patch.object(ram, "get_ram", return_value=None) as mock_get, \
         patch.object(registry, "find_spec", return_value=spec):
        client = TestClient(app)
        res = client.post("/load-model", json={"modelId": spec.id})
        assert res.status_code == 200
        assert res.json()["success"] is True
        mock_get.assert_called_once()


def test_unload_all_calls_every_session_unload():
    from app.models import aesthetic, clip, ram

    with patch.object(clip, "unload_clip") as m_clip, \
         patch.object(aesthetic, "unload_aesthetic") as m_aes, \
         patch.object(ram, "unload_ram") as m_ram:
        client = TestClient(app)
        res = client.post("/unload-all")
        assert res.status_code == 200
        assert res.json()["success"] is True
        m_clip.assert_called_once()
        m_aes.assert_called_once()
        m_ram.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/lightness/Documents/Project/prism/python-sidecar && uv run python -m pytest tests/test_models.py::test_load_model_tagger_dispatches_to_ram tests/test_models.py::test_unload_all_calls_every_session_unload -q`
Expected: FAIL — `/load-model` with tagger raises 400; `/unload-all` is 404.

- [ ] **Step 3: Implement tagger load + unload-all**

In `python-sidecar/app/routes/models.py`:

Add after `load_aesthetic_session`:

```python
def load_ram_session(spec: registry.ModelSpec) -> None:
    from app.models import ram

    ram.get_ram(spec.id)
```

Change `load_model` to handle `tagger`:

```python
@router.post("/load-model")
def load_model(req: LoadModelRequest) -> dict:
    spec = registry.find_spec(req.modelId)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown model: {req.modelId}")
    try:
        if spec.type == "embed":
            load_clip_session(spec)
        elif spec.type == "aesthetic":
            load_aesthetic_session(spec)
        elif spec.type == "tagger":
            load_ram_session(spec)
        else:
            raise HTTPException(status_code=400, detail=f"unsupported model type: {spec.type}")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"success": True, "modelId": spec.id}
```

Add the unload endpoint (after `load_model`):

```python
@router.post("/unload-all")
def unload_all() -> dict:
    from app.models import aesthetic, clip, ram

    clip.unload_clip()
    aesthetic.unload_aesthetic()
    ram.unload_ram()
    return {"success": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run python -m pytest tests/test_models.py -q`
Expected: PASS (full suite stays green — currently 51)

- [ ] **Step 5: Commit**

```bash
git add python-sidecar/app/routes/models.py python-sidecar/tests/test_models.py
git commit -m "feat(sidecar): support tagger load + add /unload-all endpoint"
```

---

### Task 3: Go sidecar client — `LoadModel` + `UnloadAll`

**Files:**
- Modify: `backend/internal/sidecar/client.go`

- [ ] **Step 1: Add request type + methods**

In `backend/internal/sidecar/client.go`, after `DownloadModelResult` (around line 234), add:

```go
type LoadModelRequest struct {
	ModelID string `json:"modelId"`
}

func (c *Client) LoadModel(req LoadModelRequest) error {
	return c.post("/load-model", req, nil)
}

func (c *Client) UnloadAll() error {
	return c.post("/unload-all", map[string]any{}, nil)
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `cd /home/lightness/Documents/Project/prism/backend && go build ./internal/sidecar/`
Expected: success, no output.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/sidecar/client.go
git commit -m "feat(sidecar): add LoadModel and UnloadAll client methods"
```

---

### Task 4: Go `config.Service.IsAIActive`

**Files:**
- Modify: `backend/internal/api/config/service.go`
- Test: `backend/internal/api/config/service_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/api/config/service_test.go`:

```go
func TestConfigService_IsAIActive(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	active, err := svc.IsAIActive()
	if err != nil {
		t.Fatalf("IsAIActive empty: %v", err)
	}
	if active {
		t.Fatal("expected false when no config stored")
	}

	svc.Update(map[string]interface{}{"ai": map[string]interface{}{
		"enabled": true,
		"aiActive": true,
	}})
	active, err = svc.IsAIActive()
	if err != nil {
		t.Fatalf("IsAIActive set: %v", err)
	}
	if !active {
		t.Fatal("expected true after aiActive=true stored")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/lightness/Documents/Project/prism/backend && go test ./internal/api/config/ -run TestConfigService_IsAIActive -v`
Expected: FAIL — `IsAIActive` undefined.

- [ ] **Step 3: Implement `IsAIActive`**

In `backend/internal/api/config/service.go`, add after `Get`:

```go
// IsAIActive reports whether AI is opt-in enabled. Defaults to false when no
// config is stored or the blob is malformed.
func (s *Service) IsAIActive() (bool, error) {
	resp, err := s.Get()
	if err != nil {
		return false, err
	}
	if resp.AI == nil {
		return false, nil
	}
	var m struct {
		AiActive bool `json:"aiActive"`
	}
	if err := json.Unmarshal([]byte(*resp.AI), &m); err != nil {
		return false, fmt.Errorf("parse ai config: %w", err)
	}
	return m.AiActive, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/api/config/ -run TestConfigService_IsAIActive -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/api/config/service.go backend/internal/api/config/service_test.go
git commit -m "feat(config): add IsAIActive reader for opt-in gate"
```

---

### Task 5: Go `ai.Service` — inject config, enforce, wire load/unload

**Files:**
- Modify: `backend/internal/api/ai/service.go`
- Modify: `backend/internal/api/ai/service_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/api/ai/service_test.go`:

```go
type fakeConfig struct{ active bool }

func (f *fakeConfig) IsAIActive() (bool, error) { return f.active, nil }

func TestService_GuardsWhenInactive(t *testing.T) {
	_, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("sidecar must not be contacted when AI inactive: %s", r.URL.Path)
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, nil, &fakeConfig{active: false})

	if _, err := svc.EmbedImage("u", "/x.jpg"); !errors.Is(err, ErrAIInactive) {
		t.Fatalf("EmbedImage expected ErrAIInactive, got %v", err)
	}
	if _, err := svc.GenerateTags("u", "/x.jpg", 0.1); !errors.Is(err, ErrAIInactive) {
		t.Fatalf("GenerateTags expected ErrAIInactive, got %v", err)
	}
	if err := svc.LoadModel("m"); !errors.Is(err, ErrAIInactive) {
		t.Fatalf("LoadModel expected ErrAIInactive, got %v", err)
	}
}

func TestService_LoadModel_ForwardsModelID(t *testing.T) {
	var gotModelID string
	c, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/load-model" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		gotModelID = body["modelId"].(string)
		json.NewEncoder(w).Encode(map[string]any{"success": true})
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, c, &fakeConfig{active: true})
	if err := svc.LoadModel("xcinc/recognize-anything-plus"); err != nil {
		t.Fatalf("LoadModel: %v", err)
	}
	if gotModelID != "xcinc/recognize-anything-plus" {
		t.Fatalf("expected RAM model id forwarded, got %q", gotModelID)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/lightness/Documents/Project/prism/backend && go test ./internal/api/ai/ -run 'TestService_GuardsWhenInactive|TestService_LoadModel_ForwardsModelID' -v`
Expected: FAIL — `NewService` arity mismatch / `ErrAIInactive` undefined.

- [ ] **Step 3: Implement enforcement + wiring**

In `backend/internal/api/ai/service.go`:

Add imports: `"errors"`, `"log"`, and `"github.com/ltless/prism/internal/api/config"`.

Add an interface + error near the top of the file (after imports):

```go
// aiConfig is the minimal config surface ai.Service needs (kept as an interface
// so tests can inject a fake without a database).
type aiConfig interface {
	IsAIActive() (bool, error)
}

// ErrAIInactive is returned by every AI chokepoint when AI is opt-in disabled.
var ErrAIInactive = errors.New("ai is disabled")
```

Change the `Service` struct field for config:

```go
type Service struct {
	resolver PathResolver
	sidecar *sidecar.Client
	config   aiConfig
}
```

Change `NewService`:

```go
func NewService(resolver PathResolver, sc *sidecar.Client, cfg aiConfig) *Service {
	return &Service{resolver: resolver, sidecar: sc, config: cfg}
}
```

Add a helper:

```go
func (s *Service) aiActive() bool {
	if s.config == nil {
		return false
	}
	active, err := s.config.IsAIActive()
	if err != nil {
		log.Printf("ai.Service.aiActive: %v", err)
		return false
	}
	return active
}
```

Add the guard as the first line of `EmbedImage`, `EmbedText`, `GenerateTags`, `ScoreAesthetic`, `DownloadModel`, and `LoadModel`:

```go
	if !s.aiActive() {
		return nil, ErrAIInactive
	}
```
(For `LoadModel` return `ErrAIInactive`; for `DownloadModel` return `nil, ErrAIInactive`.)

Wire `LoadModel` (replace the stub):

```go
func (s *Service) LoadModel(modelID string) error {
	if !s.aiActive() {
		return ErrAIInactive
	}
	if s.sidecar == nil {
		return fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.LoadModel(sidecar.LoadModelRequest{ModelID: modelID})
}
```

Add `UnloadAll`:

```go
func (s *Service) UnloadAll() error {
	if s.sidecar == nil {
		return fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.UnloadAll()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/api/ai/ -run 'TestService_GuardsWhenInactive|TestService_LoadModel_ForwardsModelID' -v`
Expected: PASS

- [ ] **Step 5: Run full ai + config suites**

Run: `go test ./internal/api/ai/ ./internal/api/config/`
Expected: PASS (existing tests still green — note: existing `EmbedImage`/`EmbedText` tests construct `NewService(&mockResolver{}, c)` with NO third arg; update those two calls to `NewService(&mockResolver{}, c, &fakeConfig{active: true})` so they keep passing).

- [ ] **Step 6: Commit**

```bash
git add backend/internal/api/ai/service.go backend/internal/api/ai/service_test.go
git commit -m "feat(ai): enforce aiActive gate on all chokepoints + wire LoadModel/UnloadAll"
```

---

### Task 6: Go handler + router wiring

**Files:**
- Modify: `backend/internal/api/ai/handler.go`
- Modify: `backend/internal/api/router.go`

- [ ] **Step 1: Change `loadModelBody` to `ModelID` + map `ErrAIInactive` → 403 + add `Unload`**

In `backend/internal/api/ai/handler.go`:

Replace the `loadModelBody` struct and `LoadModel` handler:

```go
type loadModelBody struct {
	ModelID string `json:"modelId"`
}

func (h *Handler) LoadModel(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	var body loadModelBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.ModelID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "modelId required")
	}
	if err := h.svc.LoadModel(body.ModelID); err != nil {
		if errors.Is(err, ErrAIInactive) {
			return echo.NewHTTPError(http.StatusForbidden, "ai is disabled")
		}
		log.Printf("LoadModel error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "modelId": body.ModelID})
}
```

Add an `Unload` handler (after `LoadModel`):

```go
func (h *Handler) Unload(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	if err := h.svc.UnloadAll(); err != nil {
		log.Printf("UnloadAll error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
```

In `DownloadModel` handler, add the `ErrAIInactive` → 403 mapping (same `errors.Is` pattern) before the generic 500.

Ensure `handler.go` imports `"errors"` (it likely already imports `errors` via `stdErrors` or uses `fmt`; add `"errors"` if missing) and the `ai` package's `ErrAIInactive` is reachable — `handler.go` is in package `ai`, so `ErrAIInactive` is in-package.

- [ ] **Step 2: Wire router**

In `backend/internal/api/router.go`:
- Change `aiSvc := aiH.NewService(mediaStorage, sidecarClient)` to `aiSvc := aiH.NewService(mediaStorage, sidecarClient, configSvc)`.
- Add the unload route near the existing `aiG.POST("/load-model", ...)`:
  `aiG.POST("/unload", aiHandler.Unload, auth.RequireAdmin)`

- [ ] **Step 3: Build + test**

Run: `cd /home/lightness/Documents/Project/prism/backend && go build ./... && go vet ./internal/api/ai/ && go test ./internal/api/ai/ ./internal/api/config/`
Expected: build + vet clean, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/ai/handler.go backend/internal/api/router.go
git commit -m "feat(ai): accept modelId in load-model, 403 when disabled, add /unload route"
```

---

### Task 7: Frontend client — `loadModelOnServer(modelId)` + `unloadAllOnServer`

**Files:**
- Modify: `src/features/ai/services/aiStatusClient.ts`

- [ ] **Step 1: Change `loadModelOnServer` signature + add `unloadAllOnServer`**

In `src/features/ai/services/aiStatusClient.ts`, replace `loadModelOnServer`:

```ts
export async function loadModelOnServer(modelId: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/v1/ai/load-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) return { success: false, error: await extractError(res, `HTTP ${res.status}`) };
  const data = await res.json();
  return { success: !!data.success, error: data.error };
}

export async function unloadAllOnServer(): Promise<void> {
  await fetch("/api/v1/ai/unload", { method: "POST" });
}
```

- [ ] **Step 2: Update `activateModel` caller (variant → modelId)**

In `src/features/ai/hooks/useModelDownload.ts`, `activateModel(v.id)` currently passes a `AIModelVariant`. Change it to pass the model id:

```ts
const ok = await loadModelOnServer(SIDECAR_MODEL_IDS[v.id]);
```

(import `SIDECAR_MODEL_IDS` from `@/features/ai/constants` if not already imported.)

- [ ] **Step 3: Type-check**

Run: `cd /home/lightness/Documents/Project/prism && npx tsc --noEmit`
Expected: no errors related to `loadModelOnServer`.

- [ ] **Step 4: Commit**

```bash
git add src/features/ai/services/aiStatusClient.ts src/features/ai/hooks/useModelDownload.ts
git commit -m "feat(ai): loadModelOnServer takes modelId; add unloadAllOnServer"
```

---

### Task 8: Frontend `useModelDownload` — `downloadRAM` / `activateRAM`

**Files:**
- Modify: `src/features/ai/hooks/useModelDownload.ts`
- Modify: `src/features/ai/constants.ts`

- [ ] **Step 1: Export `RAM_MODEL_ID`**

In `src/features/ai/constants.ts`, add:

```ts
export const RAM_MODEL_ID = "xcinc/recognize-anything-plus";
```

- [ ] **Step 2: Add `downloadRAM` / `activateRAM` to the hook**

In `src/features/ai/hooks/useModelDownload.ts`, ensure imports include `RAM_MODEL_ID` and the client fns `downloadModelOnServer`, `loadModelOnServer`. Add to the returned object and define:

```ts
const downloadRAM = useCallback(async (): Promise<boolean> => {
  const res = await downloadModelOnServer(RAM_MODEL_ID);
  return res.started || res.downloaded;
}, []);

const activateRAM = useCallback(async (): Promise<boolean> => {
  const res = await loadModelOnServer(RAM_MODEL_ID);
  return res.success;
}, []);
```

Return `{ downloadRAM, activateRAM, ...existing }` from the hook.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/ai/hooks/useModelDownload.ts src/features/ai/constants.ts
git commit -m "feat(ai): add downloadRAM/activateRAM for RAM++ tagger"
```

---

### Task 9: Frontend `AdminAITab` — gate + RAM++ card + unload-on-off

**Files:**
- Modify: `src/features/settings/components/AdminAITab.tsx`
- Test: `src/features/settings/components/__tests__/AdminAITab.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { AdminAITab } from "@/features/settings/components/AdminAITab";

const noop = () => {};

function renderTab(aiActive: boolean) {
  return render(
    <AdminAITab
      ai={{ aiActive } as any}
      tagStats={null}
      onSetTagStats={noop}
      scoreStats={null}
      onSetScoreStats={noop}
    />
  );
}

describe("AdminAITab gate", () => {
  it("shows only Enable AI when aiActive is false", () => {
    renderTab(false);
    expect(screen.getByText(/Enable AI/i)).toBeInTheDocument();
    expect(screen.queryByText(/Core Tagging Models/i)).not.toBeInTheDocument();
  });

  it("shows RAM++ card when aiActive is true", () => {
    renderTab(true);
    expect(screen.getByText(/RAM\+\+ Tagger/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/settings/components/__tests__/AdminAITab.test.tsx`
Expected: FAIL — gate not implemented (model list always shown; RAM++ card absent).

- [ ] **Step 3: Implement the gate**

In `src/features/settings/components/AdminAITab.tsx`:

Add import: `import { RAM_MODEL_ID } from "@/features/ai/constants";` and `import { unloadAllOnServer } from "@/features/ai/services/aiStatusClient";`.

**Hook-order note:** all hooks (`useModelDownload(ai)`, the two `useQuery` calls, the `useEffect`) must run unconditionally. Insert the gate as an **early `return` placed after the last hook (`useEffect`) and immediately before the `return (` JSX** — NOT before the hooks.

At that point (after hooks, before the JSX return), add the gate:

```tsx
  const setAiActive = ai.setAiActive;
  const handleToggleAi = (val: boolean) => {
    setAiActive(val);
    triggerConfigUpdate(ai, { aiActive: val });
    if (!val) {
      unloadAllOnServer().catch(() => {});
    }
  };

  if (!ai.aiActive) {
    return (
      <div className="flex flex-col gap-6 py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between border-b border-main-border/50 pb-3">
          <div className="flex items-center gap-2">
            <Shield size={16} weight="fill" className="text-primary" />
            <div>
              <h3 className="text-[12px] font-semibold text-main-text">AI Configuration</h3>
              <p className="text-xs text-muted-text mt-0.5">Global Admin Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted-text/10 text-muted-text">
            Inactive
          </div>
        </div>
        <div className="p-4 rounded-xl border border-main-border/50 bg-surface-bg flex items-center justify-between gap-3">
          <div>
            <h5 className="text-[11px] font-medium text-main-text">Enable AI</h5>
            <p className="text-xs text-muted-text mt-0.5">Models download locally on demand. Nothing runs until enabled.</p>
          </div>
          <Toggle
            checked={false}
            onChange={() => handleToggleAi(true)}
          />
        </div>
      </div>
    );
  }
```

Replace the existing `globalAIEnabled` toggle `onChange` to also route through `handleToggleAi` so toggling it off unloads models. Find the existing block:

```tsx
<Toggle checked={ai.globalAIEnabled} onChange={() => { const val = !ai.globalAIEnabled; ai.setGlobalAIEnabled(val); triggerConfigUpdate(ai, { enabled: val }); }} />
```

Keep it as-is for `globalAIEnabled` (it is separate from `aiActive`); the `aiActive` toggle is the new Enable AI card above. (No change needed there.)

Add the RAM++ card inside section 1, after the `variants.map(...)` block and before the closing of that `space-y-3` div:

```tsx
  {/* RAM++ Tagger */}
  {(() => {
    const ramRow = modelData?.models.find((m) => m.id === RAM_MODEL_ID);
    const ramDownloaded = ramRow?.downloaded ?? false;
    const ramLoaded = ramRow?.loaded ?? false;
    return (
      <div className={cn(
        "p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3",
        ramLoaded ? "border-emerald-500/30 bg-emerald-500/5" : "border-main-border/30"
      )}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-main-text">RAM++ Tagger</span>
            {ramLoaded && <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">LOADED</span>}
            {ramDownloaded && !ramLoaded && <span className="text-[11px] font-medium bg-muted-text/10 text-muted-text px-1.5 py-0.5 rounded">READY</span>}
          </div>
          <p className="text-xs text-muted-text mt-0.5">Dedicated tagger (~1.5GB VRAM)</p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          {!ramDownloaded ? (
            <button onClick={async () => { await downloadRAM(); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium cursor-pointer transition-colors">
              Download
            </button>
          ) : (
            <button onClick={async () => { await activateRAM(); }} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer", ramLoaded ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {ramLoaded ? "Loaded" : "Load"}
            </button>
          )}
        </div>
      </div>
    );
  })()}
```

Pull `downloadRAM` / `activateRAM` from `useModelDownload(ai)` at the top of the component (add to the existing destructure).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/settings/components/__tests__/AdminAITab.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full frontend suite**

Run: `npx vitest run`
Expected: PASS (currently 376; new tests added on top).

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/components/AdminAITab.tsx src/features/settings/components/__tests__/AdminAITab.test.tsx
git commit -m "feat(ai): gate AdminAITab behind aiActive + RAM++ model entry"
```

---

### Task 10: Final cross-file verification

- [ ] **Step 1: Grep for consistency**

Run from repo root:
```bash
grep -rn "aiActive" src/features/ai/types.ts src/features/ai/store.ts src/features/ai/utils/triggerConfigUpdate.ts
grep -rn "aiActive" backend/internal/api/config/service.go backend/internal/api/ai/service.go
grep -rn "RAM_MODEL_ID" src/features/ai/constants.ts src/features/settings/components/AdminAITab.tsx
```
Expected: every grep returns the expected lines (no missing wiring).

- [ ] **Step 2: Run all three suites**

```bash
cd python-sidecar && uv run python -m pytest -q
cd backend && go test ./...
cd /home/lightness/Documents/Project/prism && npx vitest run
```
Expected: Python 51+ pass, Go all pass, Frontend 378+ pass.

- [ ] **Step 3: Commit a verification note (optional)**

No code change needed unless a gap is found; fix any gap and commit separately.

---

## Notes / gotchas

- `ai.Service.NewService` callers: existing `service_test.go` `EmbedImage`/`EmbedText` tests pass `NewService(&mockResolver{}, c)` with two args — update them to `NewService(&mockResolver{}, c, &fakeConfig{active: true})` (Task 5 Step 5).
- `config.Service` is created in `router.go` as `configSvc := configH.NewService(global)` (line ~108) and is in scope at the `ai.NewService` call (line ~130).
- The model id for RAM++ must match the sidecar registry spec id exactly: `xcinc/recognize-anything-plus`.
- `loadModelOnServer` previously took a `AIModelVariant`; callers in `useModelDownload`/`AdminAITab` that passed a variant must now pass `SIDECAR_MODEL_IDS[variant]`.
