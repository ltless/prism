"""Shared-secret auth gate. if SIDECAR_KEY is set, requests need X-Sidecar-Key.
unset = dev mode (auth off). the browser never sees the secret — next.js
forwards it. don't run exposed without a key, that's on you."""
from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger("prism.sidecar.auth")

PUBLIC_PATHS = {"/health"}


async def auth_middleware(request: Request, call_next):
    key = settings.sidecar_key
    if key is None:
        # Dev/test mode: auth disabled. Warn once at first request.
        if not getattr(auth_middleware, "_warned", False):
            logger.warning("SIDECAR_KEY unset — sidecar auth DISABLED (dev mode only)")
            auth_middleware._warned = True  # type: ignore[attr-defined]
        return await call_next(request)

    path = request.url.path
    if path in PUBLIC_PATHS:
        return await call_next(request)

    provided = request.headers.get("x-sidecar-key")
    if not provided or provided != key:
        return JSONResponse(
            status_code=401, content={"detail": "invalid or missing sidecar key"}
        )
    return await call_next(request)
