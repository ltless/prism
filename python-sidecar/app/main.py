from __future__ import annotations

import os

# Use cached models only — don't phone home to huggingface.co.
# Models are already downloaded; from_pretrained doesn't need to check for
# updates. Without this, DNS failures (offline/dev) cause 30s retry loops
# that block the entire sidecar.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from fastapi import FastAPI

from app.auth import auth_middleware
from app.config import settings
from app.routes import aesthetic as aesthetic_routes
from app.routes import clip as clip_routes
from app.routes import models as models_routes
from app.routes import tagger as tagger_routes

# torch will eat all your CPU cores by default. 2 threads per inference
# keeps the pc from having a existential crisis during bulk upload.
try:
    import torch
    torch.set_num_threads(2)
except Exception:
    pass

app = FastAPI(title="Prism AI Sidecar", version="0.1.0")
app.middleware("http")(auth_middleware)
app.include_router(clip_routes.router)
app.include_router(aesthetic_routes.router)
app.include_router(models_routes.router)
app.include_router(tagger_routes.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "device": settings.device}
