from __future__ import annotations

import os
from dataclasses import dataclass


def _models_dir_default() -> str:
    sidecar_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_root = os.path.dirname(sidecar_dir)
    return os.path.join(repo_root, "storage", "models")


def _media_root_default() -> str:
    """Default allowed root for inference file paths (all user media lives here)."""
    sidecar_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_root = os.path.dirname(sidecar_dir)
    return os.path.join(repo_root, "storage", "users")


@dataclass
class Settings:
    port: int = int(os.environ.get("SIDECAR_PORT", "8081"))
    device: str = os.environ.get("SIDECAR_DEVICE", "cpu")
    models_dir: str = os.environ.get("SIDECAR_MODELS_DIR", _models_dir_default())
    # shared secret for auth. unset = dev mode (auth off). don't deploy without it.
    sidecar_key: str | None = os.environ.get("SIDECAR_KEY") or None
    # filePath params must resolve under this root. default = storage/users.
    media_root: str = os.environ.get("SIDECAR_MEDIA_ROOT", _media_root_default())


settings = Settings()
